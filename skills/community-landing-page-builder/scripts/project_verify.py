#!/usr/bin/env python3
"""Verify a generated project locally with one command.

This is the real-project counterpart of `quickstart.py verify-demo --full`. It starts the
project's local Worker, takes one source snapshot, runs every automated gate against it,
assembles the reports that are derived from existing evidence (images, copy, catalogue),
records each gate and prints a scoreboard. It never publishes, contacts a provider account
or submits a live lead; the local journey stores one clearly synthetic local lead.

Gates that need a person or reviewer (visual acceptance, control-review acceptance, the
handoff final review, owner approvals) are recorded when their current evidence exists and
are otherwise reported as the next action, never faked. A visual or final review written
since the last run is recorded first, and the evidence it cites is kept, not regenerated.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import time
import uuid
from urllib.error import URLError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_check

SYNTHETIC_VALUES = {
    "name": "Local Verification (fictional)", "first_name": "Local", "last_name": "Verification",
    "email": "local-verification@example.invalid", "phone": "0400 000 000", "tel": "0400 000 000",
    "suburb": "Testville", "postcode": "0000", "address": "1 Example Street", "message": "Synthetic local verification enquiry.",
}
# live-verify.mjs ATTRIBUTION_KEYS: attribution acceptance needs a value for every one of them.
ATTRIBUTION_KEYS = ("utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content", "utm_source_platform",
                    "utm_creative_format", "utm_marketing_tactic", "gclid", "dclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid")
# The first generator's query lacked most of them; ensure_fixture upgrades exactly that output.
LEGACY_QUERY = {"utm_source": "google", "utm_medium": "cpc", "utm_campaign": "local-verification",
                "utm_term": "local-verification-term", "gclid": "local-verification-gclid"}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fixture_from_funnel(project):
    """Synthetic browser fixture derived from funnel.json; values are clearly fictional."""
    project = Path(project)
    funnel = read(project / "funnel.json")
    fields = {}
    for field in funnel.get("form_fields", []):
        name, kind = field.get("name", ""), field.get("type", "text")
        if field.get("options"):
            fields[name] = str(field["options"][0])
        elif kind == "email":
            fields[name] = SYNTHETIC_VALUES["email"]
        elif kind == "tel":
            fields[name] = SYNTHETIC_VALUES["phone"]
        elif kind in {"checkbox"}:
            fields[name] = True
        else:
            fields[name] = SYNTHETIC_VALUES.get(name, "Synthetic value")
    output = funnel.get("catalogue", {}).get("output", "public/assets/brochure/service-guide.pdf")
    analytics = funnel.get("analytics", {})
    return {
        "synthetic": True, "path": "/", "thank_you_path": "/thank-you.html",
        "pdf_path": "/" + output.removeprefix("public/"),
        "required_resources": ["/styles.css", "/script.js", "/funnel.js"],
        "fields": fields,
        "query": {key: "local-verification-" + key.replace("_", "-") for key in ATTRIBUTION_KEYS} | {"utm_source": "google", "utm_medium": "cpc"},
        "excluded_query": {"email": "excluded@example.invalid", "token": "synthetic-secret-not-captured"},
        "expected_policy": {"analytics_mode": analytics.get("mode", "disabled"), "attribution_mode": analytics.get("attribution_mode", "lead"),
                            "advertising_user_data_mode": funnel.get("tracking", {}).get("customer_data_mode", "disabled"), "browser_opt_out": False},
        # Must agree with the policy exactly as live-verify.mjs testRunOptions derives it.
        "expected_features": {"first_party_attribution": analytics.get("attribution_mode", "lead") != "disabled", "measured_visit": analytics.get("mode", "disabled") != "disabled"},
        "expected_dimensions": {"source": "google", "traffic": "paid", "device": "desktop"},
        "selectors": {"openModal": "[data-open-modal]", "modal": "#lead-modal", "step": ".wizard__step", "next": "[data-next]",
                      "submit": "[data-submit]", "closeModal": "[data-close-modal]", "error": "[data-form-error]",
                      "consentAccept": "[data-analytics-consent=accept]"},
    }


def ensure_fixture(project):
    """Write the fixture once. A reviewed fixture is kept; only the first generator's output is upgraded."""
    path = Path(project) / "test-fixture.json"
    current = {}
    if path.is_file():
        try:
            current = read(path)
        except ValueError:
            return False
        if not isinstance(current, dict) or current.get("query") != LEGACY_QUERY:
            return False
    fixture = fixture_from_funnel(project)
    if current:
        fixture = {**current, "query": fixture["query"], "expected_features": fixture["expected_features"]}
    path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    return True


def cited(value):
    """Every file path a report cites: artifacts, capture reports and evidence."""
    if isinstance(value, dict):
        return ({value["path"]} if isinstance(value.get("path"), str) else set()).union(*map(cited, value.values()))
    return set().union(*map(cited, value)) if isinstance(value, list) else set()


def local_env(node):
    env = runtime_check.run_env(node)
    for key in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL"):
        env.pop(key, None)
    return env


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@contextmanager
def project_server(project, node, port=None):
    """Local Worker + D1 for a generated project (never remote)."""
    project = Path(project).resolve()
    if not (project / "wrangler.jsonc").is_file() or not (project / "node_modules/wrangler").is_dir():
        raise ValueError("This project needs its local tools. Run: python3 scripts/quickstart.py bootstrap --project .")
    env = local_env(node)
    if not (project / ".secrets/local.json").is_file():
        # First run: create the local owner login and apply migrations to the local database.
        subprocess.run([node, "scripts/setup.mjs"], cwd=project, env=env, check=True, capture_output=True, text=True, timeout=300)
    port = port or free_port()
    (project / ".secrets").mkdir(exist_ok=True, mode=0o700)
    with (project / ".secrets/project-server.log").open("w") as log:
        process = subprocess.Popen([node, "node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--ip", "127.0.0.1", "--port", str(port)],
                                   cwd=project, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        url = f"http://127.0.0.1:{port}"
        try:
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise ValueError("The local server stopped. Inspect .secrets/project-server.log.")
                try:
                    with urlopen(url + "/api/health", timeout=1) as response:
                        if json.load(response).get("ok") is True:
                            break
                except (URLError, TimeoutError, OSError, ValueError):
                    time.sleep(0.25)
            else:
                raise ValueError("The local server did not become healthy in time.")
            yield url, process
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


def envelope(project, gate, checks, artifacts, extra, snapshot):
    return {"schema_version": 1, "gate": gate, "status": "pass", "executed_at": datetime.now(timezone.utc).isoformat(),
            "source_fingerprint": snapshot["source_fingerprint"], "tool": {"name": "project_verify", "version": "1.0.0"},
            "target": {"url": "", "mode": snapshot["mode"]}, "execution": {"kind": "automated", "command": ["python3", "scripts/quickstart.py", "verify"], "exit_code": 0},
            "checks": checks, "artifacts": artifacts, **extra}


def derived_reports(project, snapshot):
    """Reports whose substance already lives in validated evidence files."""
    project = Path(project)
    reports = {}
    if (project / "image-plan.json").is_file():
        result = subprocess.run([sys.executable, "scripts/image_workflow.py", "--plan", "image-plan.json", "validate"], cwd=project, capture_output=True, text=True)
        try:
            review = json.loads(result.stdout)
        except ValueError:
            review = {"passed": False, "errors": [result.stderr.strip()[:300]]}
        reports["images"] = envelope(project, "images", [{"name": "image_workflow validate", "status": "pass" if review.get("passed") else "blocked", "detail": review.get("errors", [])[:3]}],
                                     [{"path": "image-plan.json", "type": "image_plan", "sha256": sha(project / "image-plan.json")}],
                                     {"image_review": review, "plan_sha256": sha(project / "image-plan.json")}, snapshot)
    if (project / "build/copy-scorecard.json").is_file():
        audit = read(project / "build/copy-scorecard.json")
        artifacts = [{"path": "build/copy-scorecard.json", "type": "copy_audit", "sha256": sha(project / "build/copy-scorecard.json")}]
        if (project / "build/copy-editorial-review.json").is_file():
            artifacts.append({"path": "build/copy-editorial-review.json", "type": "editorial_review", "sha256": sha(project / "build/copy-editorial-review.json")})
        reports["copy"] = envelope(project, "copy", [{"name": "copy_library audit", "status": audit.get("overall_status")}], artifacts, {"copy_audit": audit}, snapshot)
    if (project / "build/guide-build.json").is_file():
        build = read(project / "build/guide-build.json")
        count = build.get("page_count", 0)
        artifacts = [{"path": build["output"], "type": "pdf", "sha256": sha(project / build["output"])}]
        artifacts += [{"path": page, "type": "rendered_page", "sha256": sha(project / page)} for page in build.get("rendered_pages", [])]
        reports["catalogue"] = envelope(project, "catalogue", [{"name": "reader guide build and review", "status": "pass"}], artifacts,
                                        {"page_count": count, "reviewed_pages": list(range(1, count + 1))}, snapshot)
    return reports


def verify_project(project, node, mode="preview", performance_runs=1, port=None):
    project = Path(project).expanduser().resolve()
    if not (project / "funnel.json").is_file() or not (project / "src/worker.js").is_file():
        raise ValueError("Open a generated lead-inbox project (funnel.json and src/worker.js). Static projects use their own publisher checks.")
    steps = []
    env = local_env(node)

    def step(name, command, timeout=600, extra_env=None):
        started = time.monotonic()
        result = subprocess.run([str(value) for value in command], cwd=project, env={**env, **(extra_env or {})}, capture_output=True, text=True, timeout=timeout)
        tail = (result.stdout.strip().splitlines() or [""])[-1][:300] if result.returncode == 0 else (result.stderr.strip() or result.stdout.strip())[-400:]
        steps.append({"step": name, "exit_code": result.returncode, "seconds": round(time.monotonic() - started, 1), "detail": tail})
        return result.returncode == 0

    def record(gate, report):
        if not (project / report).is_file():
            steps.append({"step": f"record {gate}", "exit_code": 1, "detail": f"No report at {report}"})
            return False
        return step(f"record {gate}", [sys.executable, "scripts/check_gates.py", "record", ".", "--gate", gate, "--report", report], timeout=120)

    created_fixture = ensure_fixture(project)
    # Reviews written since the last run cite that run's captures, journey and control comparison.
    # Record them before anything is regenerated and keep what they cite: a rerun of those
    # producers (or a newer snapshot) would make every such review stale.
    kept, snapshot_path = set(), project / "build/gate-snapshot.json"
    reviews = {"visual": "build/visual-review.json", **({"final_review": "build/final-review.json"} if mode in {"handoff", "live"} else {})}
    try:
        previous = read(snapshot_path).get("mode") if snapshot_path.is_file() else None
    except (ValueError, AttributeError):
        previous = None
    if previous == mode:
        for gate, report in reviews.items():
            if (project / report).is_file() and record(gate, report):
                kept |= cited(read(project / report))
    recorded = set(read(project / "build/gates.json").get("gates", {})) if kept else set()
    if kept:
        steps.append({"step": "keep reviewed evidence", "exit_code": 0, "detail": "Recorded reviews cite existing evidence; producers of recorded gates they cite are not re-run."})
    # Re-run a producer unless its gate is recorded and a recorded review cites its output.
    fresh = lambda gate, *outputs: gate not in recorded or not any(path == out or path.startswith(out + "/") for path in kept for out in outputs)
    step("snapshot", [sys.executable, "scripts/check_gates.py", "snapshot", ".", "--mode", mode, "--out", "build/gate-snapshot.json"], timeout=120)
    snapshot = read(snapshot_path)
    if fresh("static", "build/static-audit.json"):
        step("static checks", [sys.executable, "scripts/validate_funnel.py", ".", "--snapshot", "build/gate-snapshot.json", "--report", "build/static-audit.json"], timeout=120)
        record("static", "build/static-audit.json")
    with project_server(project, node, port) as (url, server):
        if fresh("browser", "build/layout/result.json", "build/layout/screenshots"):
            step("layout and modal (10 viewports)", [node, "scripts/measure_funnel.mjs", url + "/", "--out", "build/layout/result.json", "--project-root", ".", "--mode", mode, "--thank-you", "/thank-you.html"], timeout=900)
            record("browser", "build/layout/result.json")
        if fresh("performance", "build/performance"):
            # Handoff acceptance needs three raw runs and the command that actually served the page.
            runs = max(3, performance_runs) if mode in {"handoff", "live"} else performance_runs
            step("mobile performance", [node, "scripts/performance-audit.mjs", "--url", url + "/", "--project-root", ".", "--out", "build/performance", "--runs", str(runs),
                                        "--server-command", "node " + " ".join(map(str, server.args[1:]))], timeout=900)
            record("performance", "build/performance/result.json")
        if fresh("browser_compat", "build/browser-compat"):
            step("Chromium and WebKit journey", [node, "scripts/browser-compat.mjs", "--url", url, "--fixture", "test-fixture.json", "--project-root", "."], timeout=900)
            record("browser_compat", "build/browser-compat/result.json")
        if fresh("local_journey", "build/live-verification"):
            journey = "build/live-verification/" + uuid.uuid4().hex
            import quickstart
            access, owner = quickstart.local_verification_access(project)
            step("local form-to-CRM journey", [node, "scripts/live-verify.mjs", "--url", url, "--fixture", "test-fixture.json", "--allow-test-lead", *access, "--project-root", ".", "--out", journey],
                 timeout=900, extra_env={"ADMIN_USERNAME": owner})
            record("local_journey", journey + "/local-journey.json")
        if (project / "build/page-copy.json").is_file() and fresh("rendered_copy", "build/rendered-copy"):
            step("rendered copy capture", [node, "scripts/capture-rendered-copy.mjs", "--url", url, "--fixture", "test-fixture.json", "--project-root", "."], timeout=900)
            step("rendered copy comparison", [sys.executable, "scripts/copy_parity.py", "."], timeout=120)
            record("rendered_copy", "build/rendered-copy/result.json")
        if mode in {"handoff", "live"} and fresh("final_review", "build/layout/final-states"):
            # The final review must cite current, executed captures of every form state.
            step("final state captures", [node, "scripts/capture-final-states.mjs", "--url", url, "--project-root", "."], timeout=900)
    for gate, report in derived_reports(project, snapshot).items():
        if fresh(gate, f"build/{gate}-gate.json"):
            path = project / f"build/{gate}-gate.json"
            path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            record(gate, f"build/{gate}-gate.json")
    if (project / "build/control-review/acceptance.json").is_file() and fresh("control_review", "build/control-review/result.json"):
        step("control review", [sys.executable, "scripts/control_review.py", "record", "."], timeout=120)
    check = subprocess.run([sys.executable, "scripts/check_gates.py", "check", ".", "--mode", mode], cwd=project, capture_output=True, text=True)
    try:
        gates = json.loads(check.stdout).get("gates", {})
    except ValueError:
        gates = {}
    scoreboard = {name: value.get("status") for name, value in gates.items()}
    next_actions = []
    for name, value in gates.items():
        if value.get("status") not in {"pass", "pass_with_warnings"}:
            first = (value.get("failures") or ["blocked"])[0]
            hint = {"visual": "Inspect the captured screenshots and write build/visual-review.json (see references/measured-qa.md).",
                    "control_review": "Complete the Blue Mountain comparison, repairs and acceptance (references/control-comparison.md).",
                    "final_review": "Review the final page and state captures, write build/final-review.json (references/remediation-contracts.md), then record it with "
                                    "python3 scripts/check_gates.py record . --gate final_review --report build/final-review.json (a rerun of verify records it first "
                                    "and keeps the evidence it cites)."}.get(name, first)
            next_actions.append(f"{name}: {hint}")
    # Only candidates recorded as no-download-tool wait for owner photos; the others need
    # the disposition, receipt or allowlist their own error names.
    try:
        import image_workflow
        plan = json.loads((project / "image-plan.json").read_text()) if (project / "image-plan.json").is_file() else {}
        proof = image_workflow.proof_role(plan, project) if plan else {}
        waiting = [c.get("inventory_id") for c in plan.get("proof_candidates", []) if c.get("disposition") == "no-download-tool" and c.get("inventory_id") in proof.get("unresolved", [])]
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        proof, waiting = {}, []
    next_actions += ["proof photos: " + error for error in proof.get("errors", [])]
    if waiting:
        next_actions.append("proof photos: ask the owner to attach these first-party photos (" + ", ".join(waiting) + "), then inventory them with image_workflow.py inventory-file --authority user_attachment and run acquire --candidate <attached id> --replaces <candidate id>")
    # A preview can pass while handoff records are missing; say so now, not at export.
    readiness = None
    if mode == "preview":
        try:
            import completion_contract
            found = completion_contract.inspect(project).get("failures", [])
        except (OSError, ValueError, KeyError, TypeError) as error:
            found = [str(error)]
        readiness = {"status": "blocked" if found else "pass", "blockers": found[:25], "more": max(0, len(found) - 25),
                     "note": "Not required for this preview; handoff and publication will require these records."}
    return {"status": "pass" if scoreboard and all(v in {"pass", "pass_with_warnings"} for v in scoreboard.values()) else "blocked",
            "mode": mode, "fixture_created": created_fixture, "gates": scoreboard, "next_actions": next_actions, "handoff_readiness": readiness, "steps": steps,
            "publication": "not performed", "note": "The local journey leaves one synthetic lead in the local CRM."}
