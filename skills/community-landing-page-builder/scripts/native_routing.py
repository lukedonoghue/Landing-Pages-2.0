#!/usr/bin/env python3
"""Local task routing/state only. Native host tools launch agents; no model API calls.

A reservation coordinates cooperating workers; it is not an OS sandbox. Existing
copy/image/release gates remain authoritative. A completed task is not a release.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sqlite3
import sys
import uuid

SKILL = Path(__file__).resolve().parents[1]
POLICY_FILE = SKILL / "config/routing.json"
TIERS = ("fast", "standard", "deep", "critical")
ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
PROTECTED = {".git", ".secrets", ".codex", ".claude", "node_modules", ".wrangler"}
SECRET_NAMES = {"credentials.json", "secrets.json"}
SOURCE_EXCLUDES = {"build", "screenshots", "__pycache__", ".venv", ".pytest_cache", "coverage", "test-results", "playwright-report"} | PROTECTED

class RoutingError(ValueError):
    pass

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def policy():
    value = json.loads(POLICY_FILE.read_text(encoding="utf-8"))
    if value.get("schema_version") != 1:
        raise RoutingError("Unsupported routing policy version")
    return value


def role_routes(item, provider):
    routes = item.get("provider_routes", {}).get(provider, [])
    if not isinstance(routes, list):
        raise RoutingError("Role provider routes must be an ordered list")
    for route in routes:
        if not isinstance(route, dict) or not isinstance(route.get("model"), str):
            raise RoutingError("Invalid role provider route")
        if route.get("effort") is not None and not isinstance(route.get("effort"), str):
            raise RoutingError("Invalid role provider effort")
    return routes

def relative(value):
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise RoutingError("Use nonempty project-relative POSIX paths")
    path = PurePosixPath(value)
    if path.is_absolute() or any(p in ("", ".", "..") for p in value.split("/")):
        raise RoutingError("Unsafe project-relative path: " + value)
    if any(p in PROTECTED or p.startswith((".env", ".dev.vars")) or p in SECRET_NAMES for p in path.parts):
        raise RoutingError("Private/runtime/config path is not a task artifact: " + value)
    if path.suffix.lower() in {".pem", ".key", ".p12", ".pfx"} or value.startswith("build/orchestration/"):
        raise RoutingError("Private or scheduler-owned path is not a task artifact")
    if any(c in value for c in "*?[]\x00\n\r"):
        raise RoutingError("Task ownership uses exact file/directory paths, not globs")
    return path.as_posix()

def inside(root, value):
    value = relative(value)
    path = root
    for part in PurePosixPath(value).parts:
        path = path / part
        if path.is_symlink():
            raise RoutingError("Symlinks are not supported in task artifacts")
    return path

def overlap(a, b):
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")

def snapshot(root, paths):
    result = {}
    for value in sorted(set(paths)):
        path = inside(root, value)
        if not path.exists():
            result[value] = None
        elif path.is_file():
            result[value] = hashlib.sha256(path.read_bytes()).hexdigest()
        elif path.is_dir():
            result[value + "/"] = "directory"
            for child in sorted(path.rglob("*")):
                rel = child.relative_to(root).as_posix()
                inside(root, rel)
                if child.is_file():
                    result[rel] = hashlib.sha256(child.read_bytes()).hexdigest()
        else:
            raise RoutingError("Unsupported artifact type")
    return result

def source_paths(root):
    """Freeze source plus build evidence inputs explicitly supplied by the coordinator."""
    result = []
    for directory, dirs, names in os.walk(root, followlinks=False):
        parent = Path(directory)
        dirs[:] = [d for d in dirs if d not in SOURCE_EXCLUDES]
        for name in dirs + names:
            path = parent / name
            if name.startswith((".env", ".dev.vars")) or name in SECRET_NAMES:
                continue
            if path.suffix.lower() in {".pem", ".key", ".p12", ".pfx"}:
                continue
            if path.is_symlink():
                raise RoutingError("Freeze cannot include source symlinks")
            if path.is_file():
                result.append(path.relative_to(root).as_posix())
    return sorted(result)

def resolve(role, provider="chat", *, attempt=1, capabilities=None, high_risk=False):
    p = policy()
    if role not in p["roles"] or provider not in {"chat", "codex", "claude"}:
        raise RoutingError("Unknown role or runtime")
    if type(attempt) is not int or not 1 <= attempt <= p["max_attempts"]:
        raise RoutingError("Attempt budget exhausted")
    item = p["roles"][role]
    tier = item["tier"]
    if tier == "mechanical":
        return {"role": role, "tier": tier, "execution": "tool", "agent": None,
                "model": None, "effort": None, "reason": "Existing deterministic helper"}
    if high_risk:
        tier = "critical"
    elif attempt >= 3:
        tier = TIERS[min(3, TIERS.index(tier) + 1)]
    result = {"role": role, "tier": tier, "agent": None, "attempt": attempt,
              "execution": "sequential", "model": None, "effort": None,
              "reason": "No verified native subagent capability; use the current session"}
    if not capabilities or capabilities.get("native_subagents") is not True:
        return result
    if provider == "chat" or capabilities.get("provider") != provider:
        return result
    result["execution"] = "native_subagent"
    result["agent"] = "lp-reviewer-inherit" if role == "review" else "lp-inherit"
    if capabilities.get("model_selection") is not True:
        result["reason"] = "Native delegation available; model/effort inherit and remain unverified"
        return result
    routed = role_routes(item, provider)
    requested = routed[0] if routed else p["providers"][provider][tier]
    available = capabilities.get("models", {})
    if not isinstance(available, dict):
        raise RoutingError("capabilities.models must map model names to supported effort lists")
    candidates = [(tier, candidate) for candidate in routed] if routed else [
        (t, p["providers"][provider][t]) for t in TIERS[TIERS.index(tier):]
    ]
    for selected_tier, candidate in candidates:
        model, effort = candidate["model"], candidate["effort"]
        if model not in available:
            continue
        supported = available[model]
        if not isinstance(supported, list):
            raise RoutingError("Supported efforts must be a list")
        if effort is not None and effort not in supported:
            continue
        if routed:
            agent = item["agent"]
        elif role == "review":
            agent = "lp-reviewer-critical" if selected_tier == "critical" else item["agent"]
        elif selected_tier == item["tier"]:
            agent = item["agent"]
        else:
            agent = "lp-" + selected_tier
        result.update(agent=agent, model=model, effort=effort,
                      reason="Preferred profile" if candidate == requested else "Available stronger profile")
        return result
    result["reason"] = "Preferred model/effort unavailable; inherit current session and disclose fallback"
    return result

@contextmanager
def database(root):
    root = Path(root).expanduser().resolve()
    if not root.is_dir():
        raise RoutingError("Project directory must exist")
    folder = root / "build" / "orchestration"
    for path in (root / "build", folder, folder / "state.sqlite3"):
        if path.is_symlink():
            raise RoutingError("Scheduler state cannot use symlinks")
    folder.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(folder / "state.sqlite3", timeout=10)
    try:
        db.execute("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT value FROM state WHERE id=1").fetchone()
        value = json.loads(row[0]) if row else {"schema_version": 1, "tasks": {}, "events": [], "freeze": None}
        if value.get("schema_version") != 1:
            raise RoutingError("Unsupported state schema")
        yield root, value
        db.execute("INSERT OR REPLACE INTO state VALUES (1, ?)", (json.dumps(value),))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def event(state, kind, task=None, **data):
    state["events"].append({"at": now(), "kind": kind, "task": task, **data})

def validate_graph(tasks):
    visiting, visited = set(), set()
    def visit(name):
        if name not in tasks:
            raise RoutingError("Unknown dependency: " + name)
        if name in visiting:
            raise RoutingError("Task dependency cycle")
        if name in visited:
            return
        visiting.add(name)
        for dep in tasks[name]["depends_on"]:
            visit(dep)
        visiting.remove(name)
        visited.add(name)
    for name in tasks:
        visit(name)

def add_tasks(root, definitions):
    if not isinstance(definitions, list) or not definitions:
        raise RoutingError("Provide a nonempty task array")
    with database(root) as (root, state):
        if state["freeze"]:
            raise RoutingError("Thaw before changing the graph")
        for raw in definitions:
            task = dict(raw)
            name = task.get("id", "")
            if not isinstance(name, str) or not ID.fullmatch(name) or name in state["tasks"]:
                raise RoutingError("Invalid or duplicate task ID")
            if task.get("role") not in policy()["roles"]:
                raise RoutingError("Unknown role")
            for key in ("inputs", "writes", "depends_on"):
                values = task.get(key, [])
                if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                    raise RoutingError("Task path/dependency fields must be arrays of strings")
                task[key] = list(dict.fromkeys(values))
            for name_or_path in task["inputs"] + task["writes"]:
                inside(root, name_or_path)
            if task.get("phase", "build") not in {"research", "copy", "build", "qa", "acceptance"}:
                raise RoutingError("Unknown task phase")
            task.setdefault("phase", "build")
            task.setdefault("resources", [])
            if not isinstance(task["resources"], list) or any(not ID.fullmatch(r) for r in task["resources"]):
                raise RoutingError("Invalid resource reservation")
            if type(task.get("high_risk", False)) is not bool:
                raise RoutingError("high_risk must be boolean")
            if not str(task.get("brief", "")).strip():
                raise RoutingError("A bounded brief is required")
            if task["role"] == "review" and task["phase"] == "acceptance" and task["writes"]:
                raise RoutingError("Final acceptance is read-only; return findings to the coordinator")
            task.update(status="pending", attempts=0)
            state["tasks"][task["id"]] = task
        validate_graph(state["tasks"])
        event(state, "tasks_added", count=len(definitions))
        return {"status": "recorded", "tasks": [t["id"] for t in definitions]}

def fresh(root, task, tasks, seen=None):
    if task["status"] != "done":
        return False
    seen = set() if seen is None else seen
    if task["id"] in seen:
        return True
    seen.add(task["id"])
    if snapshot(root, task["inputs"]) != task.get("input_hashes"):
        return False
    if snapshot(root, task.get("outputs", [])) != task.get("output_hashes"):
        return False
    return all(fresh(root, tasks[d], tasks, seen) for d in task["depends_on"])

def frozen_now(root, state):
    frozen = state.get("freeze")
    return bool(frozen and source_paths(root) == frozen["sources"] and
                snapshot(root, frozen["paths"]) == frozen["hashes"])

def blockers(root, state, task):
    problems = []
    if task["status"] != "pending":
        problems.append("not_pending")
    if any(not fresh(root, state["tasks"][d], state["tasks"]) for d in task["depends_on"]):
        problems.append("dependency_missing_or_stale")
    if any(value is None for value in snapshot(root, task["inputs"]).values()):
        problems.append("input_missing")
    running = [t for t in state["tasks"].values() if t["status"] == "running"]
    if len(running) >= state.get("max_workers", 1):
        problems.append("worker_limit")
    if any(active["phase"] == "acceptance" for active in running):
        problems.append("acceptance_is_exclusive")
    for active in running:
        if set(task["resources"]) & set(active["resources"]):
            problems.append("resource_busy:" + active["id"])
        if any(overlap(a, b) for a in task["writes"] for b in active["writes"] + active["inputs"]) or any(
                overlap(a, b) for a in task["inputs"] for b in active["writes"]):
            problems.append("artifact_busy:" + active["id"])
    if task["phase"] == "acceptance":
        if not frozen_now(root, state):
            problems.append("current_source_freeze_required")
        if running:
            problems.append("acceptance_requires_idle_workers")
        if task["role"] != "review":
            problems.append("acceptance_requires_reviewer")
    elif state["freeze"] and task["writes"]:
        problems.append("source_frozen")
    return problems

def configure(root, capabilities):
    if not isinstance(capabilities, dict) or capabilities.get("provider") not in {"chat", "codex", "claude"}:
        raise RoutingError("Declare chat, codex or claude capabilities from actual host observations")
    for flag in ("native_subagents", "model_selection"):
        if type(capabilities.get(flag)) is not bool:
            raise RoutingError("Capability flags must be booleans")
    evidence = capabilities.get("evidence")
    if not isinstance(evidence, str) or not evidence.strip():
        raise RoutingError("Record how capabilities were observed; no credentials")
    maximum = capabilities.get("max_workers", 4 if capabilities["native_subagents"] else 1)
    if type(maximum) is not int or not 1 <= maximum <= policy()["max_workers"]:
        raise RoutingError("max_workers must be 1..4")
    if not capabilities["native_subagents"]:
        maximum = 1
    if capabilities["provider"] == "chat":
        maximum = 1
    with database(root) as (_, state):
        if any(t["status"] == "running" for t in state["tasks"].values()):
            raise RoutingError("Cannot change runtime while workers are running")
        state.update(capabilities=capabilities, max_workers=maximum)
        event(state, "runtime_configured", provider=capabilities["provider"])
    return {"status": "configured", "max_workers": maximum}

def claim(root, name, worker):
    if not isinstance(worker, str) or not worker.strip():
        raise RoutingError("Worker identity is required")
    with database(root) as (root, state):
        if name not in state["tasks"]:
            raise RoutingError("Unknown task")
        task = state["tasks"][name]
        why = blockers(root, state, task)
        if why:
            raise RoutingError(", ".join(why))
        cap = state.get("capabilities", {})
        route = resolve(task["role"], cap.get("provider", "chat"), attempt=task["attempts"] + 1,
                        capabilities=cap, high_risk=task.get("high_risk", False))
        if task["phase"] == "acceptance" and route["execution"] != "sequential" and worker in {
                t.get("worker") for t in state["tasks"].values() if t["phase"] != "acceptance"}:
            raise RoutingError("Independent reviewer cannot be a recorded builder identity")
        token = uuid.uuid4().hex
        task.update(status="running", worker=worker, claim_token=token,
                    input_hashes=snapshot(root, task["inputs"]), started_at=now(),
                    attempts=task["attempts"] + 1, route=route)
        event(state, "claimed", name, worker=worker, route=route)
        return {"task": task, "claim_token": token}

def finish(root, name, token, receipt):
    with database(root) as (root, state):
        task = state["tasks"].get(name)
        if not task or task["status"] != "running" or task.get("claim_token") != token:
            raise RoutingError("Not the active task claim")
        if receipt.get("status") not in {"done", "failed", "blocked"}:
            raise RoutingError("Receipt status must be done, failed or blocked")
        if not isinstance(receipt.get("summary"), str) or not receipt["summary"].strip():
            raise RoutingError("Receipt needs a concrete summary, not a pass boolean")
        if not isinstance(receipt.get("outputs", []), list):
            raise RoutingError("Receipt outputs must be an array")
        outputs = receipt.get("outputs", [])
        for output in outputs:
            inside(root, output)
            if not any(overlap(w, output) and (output == w or output.startswith(w + "/")) for w in task["writes"]):
                raise RoutingError("Output outside task write ownership: " + output)
        if receipt["status"] == "done":
            current_inputs = snapshot(root, task["inputs"])
            def unowned(hashes):
                return {k: v for k, v in hashes.items() if not any(
                    k.rstrip("/") == w or k.startswith(w + "/") for w in task["writes"])}
            if unowned(current_inputs) != unowned(task["input_hashes"]):
                raise RoutingError("Inputs changed during execution; cannot accept stale work")
            if any(not fresh(root, state["tasks"][d], state["tasks"]) for d in task["depends_on"]):
                raise RoutingError("Dependency became stale during execution")
            if task["writes"] and not outputs:
                raise RoutingError("Writable tasks must report produced artifacts")
            if any(v is None for v in snapshot(root, outputs).values()):
                raise RoutingError("Reported output does not exist")
            if task["phase"] == "acceptance" and not frozen_now(root, state):
                raise RoutingError("Source/evidence changed during acceptance")
            if task["phase"] == "acceptance":
                if receipt.get("review_mode") not in {"independent", "self_review"}:
                    raise RoutingError("Acceptance must report truthful review_mode")
                if receipt["review_mode"] == "independent" and not receipt.get("host_task_id"):
                    raise RoutingError("Independent review needs a distinct host task ID")
                builder_ids = {t.get("effective", {}).get("host_task_id") for t in state["tasks"].values()
                               if t["phase"] != "acceptance"}
                if receipt["review_mode"] == "independent" and receipt.get("host_task_id") in builder_ids:
                    raise RoutingError("Review host task ID belongs to a builder")
                if receipt["review_mode"] == "independent" and task["route"]["execution"] == "sequential":
                    raise RoutingError("Sequential fallback must be labeled self_review")
        # Requested configuration is never fabricated as the effective model.
        actual = {"model": receipt.get("effective_model"), "effort": receipt.get("effective_effort"),
                  "host_task_id": receipt.get("host_task_id"), "evidence": receipt.get("runtime_evidence")}
        if (actual["model"] or actual["effort"]) and not actual["evidence"]:
            raise RoutingError("Effective model/effort needs runtime evidence")
        if receipt["status"] == "done":
            task["input_hashes"] = snapshot(root, task["inputs"])
        task.update(status=receipt["status"], outputs=outputs,
                    output_hashes=snapshot(root, outputs), receipt=receipt,
                    effective=actual, finished_at=now())
        task.pop("claim_token", None)
        event(state, "finished", name, status=task["status"], effective=actual)
        return {"status": task["status"], "release_approved": False}

def retry(root, name, reason, worker_stopped=False):
    if not reason.strip():
        raise RoutingError("Retry requires a concrete reason")
    with database(root) as (_, state):
        task = state["tasks"].get(name)
        if not task:
            raise RoutingError("Unknown task")
        if task["status"] == "running" and not worker_stopped:
            raise RoutingError("Stop the native worker before releasing its ownership")
        if task["attempts"] >= policy()["max_attempts"]:
            raise RoutingError("Attempt budget exhausted; coordinator must diagnose or report blocker")
        if state["freeze"]:
            raise RoutingError("Thaw before retrying")
        task["status"] = "pending"
        task.pop("claim_token", None)
        event(state, "retry", name, reason=reason)
        return {"status": "pending", "next_attempt": task["attempts"] + 1}

def freeze(root, inputs):
    with database(root) as (root, state):
        if any(t["status"] == "running" for t in state["tasks"].values()):
            raise RoutingError("Stop all workers before freezing")
        unfinished = [t["id"] for t in state["tasks"].values()
                      if t["phase"] != "acceptance" and not fresh(root, t, state["tasks"])]
        if unfinished:
            raise RoutingError("Unfinished or stale work: " + ", ".join(unfinished))
        sources = source_paths(root)
        if not sources:
            raise RoutingError("No product source to freeze")
        paths = sorted(set(sources + inputs))
        hashes = snapshot(root, paths)
        if any(v is None for v in hashes.values()):
            raise RoutingError("Missing freeze input")
        state["freeze"] = {"sources": sources, "paths": paths, "hashes": hashes,
                           "fingerprint": digest(hashes), "at": now()}
        event(state, "frozen", fingerprint=state["freeze"]["fingerprint"])
        return state["freeze"]

def thaw(root, reason):
    if not reason.strip():
        raise RoutingError("Thaw requires a reason")
    with database(root) as (_, state):
        if any(t["status"] == "running" for t in state["tasks"].values()):
            raise RoutingError("Stop all workers before thawing")
        state["freeze"] = None
        for task in state["tasks"].values():
            if task["phase"] == "acceptance" and task["status"] == "done":
                task["status"] = "pending"
        event(state, "thawed", reason=reason)
        return {"status": "thawed", "release_approved": False}

def status(root):
    with database(root) as (root, state):
        tasks = []
        for task in state["tasks"].values():
            item = {k: task.get(k) for k in ("id", "role", "phase", "status", "attempts", "worker", "route", "effective")}
            item["fresh"] = fresh(root, task, state["tasks"])
            item["blockers"] = blockers(root, state, task) if task["status"] == "pending" else []
            tasks.append(item)
        return {"schema_version": 1, "tasks": tasks, "ready": [t["id"] for t in tasks if t["status"] == "pending" and not t["blockers"]],
                "freeze_current": frozen_now(root, state), "release_approved": False,
                "max_workers": state.get("max_workers", 1)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("route")
    p.add_argument("role", choices=policy()["roles"])
    p.add_argument("--provider", choices=["chat", "codex", "claude"], default="chat")
    p.add_argument("--attempt", type=int, default=1)
    p.add_argument("--capabilities", type=Path)
    p.add_argument("--high-risk", action="store_true")
    for cmd in ("configure", "add", "status", "claim", "finish", "retry", "freeze", "thaw"):
        p = sub.add_parser(cmd)
        p.add_argument("project", type=Path)
        if cmd in {"configure", "add"}:
            p.add_argument("file", type=Path)
        if cmd in {"claim", "finish", "retry"}:
            p.add_argument("task")
        if cmd == "claim":
            p.add_argument("--worker", required=True)
        if cmd == "finish":
            p.add_argument("--token", required=True)
            p.add_argument("--receipt", type=Path, required=True)
        if cmd in {"retry", "thaw"}:
            p.add_argument("--reason", required=True)
        if cmd == "retry":
            p.add_argument("--worker-stopped", action="store_true")
        if cmd == "freeze":
            p.add_argument("--input", action="append", default=[])
    args = parser.parse_args()
    def read(path):
        return json.loads(path.read_text(encoding="utf-8"))
    try:
        if args.command == "route":
            result = resolve(args.role, args.provider, attempt=args.attempt,
                             capabilities=read(args.capabilities) if args.capabilities else None, high_risk=args.high_risk)
        elif args.command == "configure": result = configure(args.project, read(args.file))
        elif args.command == "add": result = add_tasks(args.project, read(args.file))
        elif args.command == "status": result = status(args.project)
        elif args.command == "claim": result = claim(args.project, args.task, args.worker)
        elif args.command == "finish": result = finish(args.project, args.task, args.token, read(args.receipt))
        elif args.command == "retry": result = retry(args.project, args.task, args.reason, args.worker_stopped)
        elif args.command == "freeze": result = freeze(args.project, args.input)
        else: result = thaw(args.project, args.reason)
        print(json.dumps(result, indent=2))
    except (RoutingError, OSError, sqlite3.Error, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}))
        return 2
    return 0

if __name__ == "__main__":
    sys.exit(main())
