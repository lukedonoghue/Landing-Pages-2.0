#!/usr/bin/env python3
"""Freeze reviewed release inputs and keep handoff/live evidence separate."""

from contextlib import contextmanager
from datetime import datetime, timezone
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

import check_gates
import workflow
import workflow_storage as storage

UUID = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def directory(root, ident):
    if not UUID.fullmatch(ident):
        raise ValueError("Use the saved release UUID.")
    return storage.path_inside(root, "build/releases/" + ident)


def linked_artifacts(value):
    if isinstance(value, dict):
        if isinstance(value.get("path"), str) and isinstance(value.get("sha256"), str):
            yield value["path"]
        if isinstance(value.get("manifest_path"), str) and value.get("manifest_sha256"):
            yield value["manifest_path"]
        for item in value.values():
            yield from linked_artifacts(item)
    elif isinstance(value, list):
        for item in value:
            yield from linked_artifacts(item)


def freeze(root, ident, fixture):
    root = Path(root).resolve()
    base = directory(root, ident)
    package = base / "package"
    if base.exists():
        raise ValueError("This release already exists; resume it instead of overwriting evidence.")
    with storage.lock(root):
        checked = workflow.check_publish_approval(root)
        if checked["status"] not in {"pass", "pass_with_warnings"}:
            raise ValueError("; ".join(checked["failures"]))
        snapshot = check_gates.source_snapshot(root)
        fixture_path = check_gates.resolve_inside(root, fixture).relative_to(root).as_posix()
        if fixture_path not in snapshot["files"]:
            raise ValueError(
                "The reviewed fixture must be part of the approved project source, outside build/ and private folders."
            )
        inputs = (
            set(snapshot["files"])
            | set(workflow.COPY_FILES.values())
            | {"build/gates.json", "build/gate-snapshot.json", "build/workflow.json"}
        )
        gates = storage.read(root, "build/gates.json")
        inputs.update(entry["report"] for entry in gates["gates"].values())
        pending = list(inputs)
        seen = set()
        while pending:
            relative = pending.pop()
            if relative in seen:
                continue
            seen.add(relative)
            path = check_gates.resolve_inside(root, relative)
            if not path.is_file():
                raise ValueError("Required release input is missing: " + relative)
            if path.suffix == ".json":
                try:
                    value = json.loads(path.read_text())
                except (UnicodeError, ValueError):
                    continue
                for value_path in linked_artifacts(value):
                    # Absolute tool-provenance paths are historical metadata, not portable inputs.
                    # Required project references are revalidated inside the archive below.
                    if Path(value_path).is_absolute():
                        continue
                    linked = (
                        check_gates.resolve_inside(root, value_path).relative_to(root).as_posix()
                    )
                    if linked not in inputs:
                        inputs.add(linked)
                        pending.append(linked)
        package.mkdir(parents=True)
        try:
            for relative in sorted(inputs):
                source = check_gates.resolve_inside(root, relative)
                dest = storage.path_inside(package, relative)
                dest.parent.mkdir(parents=True, exist_ok=True)
                if relative == "build/workflow.json":
                    value = storage.read(root, relative)
                    for approval in value.get("approvals", {}).values():
                        message = approval.pop("message", "")
                        approval["message_sha256"] = hashlib.sha256(message.encode()).hexdigest()
                    storage.write(package, relative, value)
                else:
                    shutil.copy2(source, dest)
            if (
                check_gates.source_snapshot(package) != snapshot
                or check_gates.source_snapshot(root) != snapshot
            ):
                raise ValueError(
                    "Source changed while freezing the release; review the current revision before trying again."
                )
            archived = workflow.check_publish_approval(package)
            if archived["status"] not in {"pass", "pass_with_warnings"}:
                raise ValueError("The release is not portable: " + "; ".join(archived["failures"]))
            manifest = {
                "schema_version": 1,
                "id": ident,
                "created_at": now(),
                "source_fingerprint": snapshot["source_fingerprint"],
                "fixture": fixture_path,
                "inputs": {name: sha(package / name) for name in sorted(inputs)},
                "approval": storage.read(package, "build/workflow.json")["approvals"]["publish"],
            }
            storage.write(root, base.relative_to(root).as_posix() + "/inputs.json", manifest)
            return {
                "id": ident,
                "package": str(package),
                "source_fingerprint": snapshot["source_fingerprint"],
                "fixture": fixture_path,
            }
        except BaseException:
            shutil.rmtree(base)  # Only this newly-created, unexposed release directory.
            raise


def validate(root, ident):
    root = Path(root).resolve()
    base = directory(root, ident)
    package = base / "package"
    manifest = storage.read(root, base.relative_to(root).as_posix() + "/inputs.json")
    if not manifest or manifest.get("schema_version") != 1 or manifest.get("id") != ident:
        raise ValueError("The frozen release input manifest is missing or invalid.")
    for name, digest in manifest["inputs"].items():
        path = storage.path_inside(package, name)
        if not path.is_file() or sha(path) != digest:
            raise ValueError("Frozen release input changed: " + name)
    if check_gates.source_snapshot(package)["source_fingerprint"] != manifest["source_fingerprint"]:
        raise ValueError("The frozen release source is no longer intact.")
    result = workflow.check_publish_approval(package)
    if result["status"] not in {"pass", "pass_with_warnings"}:
        raise ValueError("; ".join(result["failures"]))
    if storage.read(package, "build/workflow.json")["approvals"]["publish"] != manifest.get(
        "approval"
    ):
        raise ValueError("Frozen publication scope does not match its sealed approval record.")
    return manifest


def live_snapshot(root, ident):
    root = Path(root).resolve()
    manifest = validate(root, ident)
    package = directory(root, ident) / "package"
    existing = storage.read(package, "build/live/snapshot.json")
    if existing:
        if (
            existing.get("mode") != "live"
            or existing.get("source_fingerprint") != manifest["source_fingerprint"]
        ):
            raise ValueError(
                "The retained live snapshot is invalid; preserve the release for inspection."
            )
        return {
            "snapshot": "build/live/snapshot.json",
            "source_fingerprint": manifest["source_fingerprint"],
        }
    snapshot = {
        "schema_version": 1,
        "created_at": now(),
        "mode": "live",
        "tool": {"name": "release_state", "version": "1"},
        **check_gates.source_snapshot(package),
    }
    storage.write(package, "build/live/snapshot.json", snapshot)
    return {
        "snapshot": "build/live/snapshot.json",
        "source_fingerprint": manifest["source_fingerprint"],
    }


def finalize(root, ident, attempt):
    root = Path(root).resolve()
    manifest = validate(root, ident)
    base = directory(root, ident)
    package = base / "package"
    if not re.fullmatch(r"\d{3}", attempt):
        raise ValueError("Invalid verification attempt.")
    snapshot = storage.read(package, "build/live/snapshot.json")
    if (
        snapshot.get("mode") != "live"
        or snapshot.get("source_fingerprint") != manifest["source_fingerprint"]
    ):
        raise ValueError("Live snapshot does not match the frozen release.")
    state = storage.read(root, base.relative_to(root).as_posix() + "/state.json")
    if state.get("phase") not in {"verification_started", "verification_failed", "verified"}:
        raise ValueError("The release has not reached actual live verification.")
    identity = storage.read(package, f"build/live/{attempt}/identity.json")
    expected = state.get("identity", {})
    for key in (
        "version_id",
        "database_id",
        "worker",
        "account_id",
        "release_id",
        "source_fingerprint",
        "url",
    ):
        if not identity or identity.get(key) != expected.get(key):
            raise ValueError("Live identity evidence does not match the verified release: " + key)
    main = storage.read(package, f"build/live/{attempt}/result.json")
    if (
        main
        and main.get("fully_verified") is True
        and main.get("status") in {"pass", "pass_with_warnings"}
    ):
        errors = check_gates.validate_report(package, main, snapshot, "deployment")
        if errors:
            raise ValueError("; ".join(errors))
        for gate in ("crm", "tracking", "deployment"):
            relative = f"build/live/{attempt}/{gate}.json"
            derived = {**main, "gate": gate}
            existing = storage.read(package, relative)
            if existing is None:
                storage.write(package, relative, derived)
            elif existing != derived:
                raise ValueError("Retained live gate conflicts with the completed journey: " + gate)
    reports = {}
    for gate in ("crm", "tracking", "deployment"):
        relative = f"build/live/{attempt}/{gate}.json"
        report = storage.read(package, relative)
        if (
            not report
            or report.get("status") not in {"pass", "pass_with_warnings"}
            or report.get("fully_verified") is not True
        ):
            raise ValueError("Successful live " + gate + " evidence is missing.")
        errors = check_gates.validate_report(package, report, snapshot, gate)
        if errors:
            raise ValueError("; ".join(errors))
        if (
            report.get("target", {}).get("url", "").rstrip("/") != identity["url"].rstrip("/")
            or report.get("observations", {}).get("database_id") != identity["database_id"]
        ):
            raise ValueError("The live journey used a different origin or database.")
        if report.get("deployment_identity") != identity:
            raise ValueError("The live journey did not verify the same release identity.")
        reports[gate] = {
            "path": relative,
            "sha256": sha(package / relative),
            "status": report["status"],
        }
    # Handoff evidence remains byte-identical and explicitly handoff-scoped.
    result = {
        "schema_version": 1,
        "release_id": ident,
        "verified_at": now(),
        "source_fingerprint": manifest["source_fingerprint"],
        "handoff": {
            "path": "build/gates.json",
            "sha256": sha(package / "build/gates.json"),
            "scope": "reviewed frozen source; not relabeled live evidence",
        },
        "live_snapshot": {
            "path": "build/live/snapshot.json",
            "sha256": sha(package / "build/live/snapshot.json"),
        },
        "identity": {
            "path": f"build/live/{attempt}/identity.json",
            "sha256": sha(package / f"build/live/{attempt}/identity.json"),
        },
        "live": reports,
        "status": "verified",
        "url": identity["url"],
    }
    storage.write(root, base.relative_to(root).as_posix() + "/verification.json", result)
    return result


def verified(root, ident):
    root = Path(root).resolve()
    manifest = validate(root, ident)
    base = directory(root, ident)
    package = base / "package"
    value = storage.read(root, base.relative_to(root).as_posix() + "/verification.json")
    if (
        not value
        or value.get("status") != "verified"
        or value.get("release_id") != ident
        or value.get("source_fingerprint") != manifest["source_fingerprint"]
    ):
        raise ValueError("Verified release evidence is missing or inconsistent.")
    if set(value.get("live", {})) != {"crm", "tracking", "deployment"}:
        raise ValueError("All three live release gates are required.")
    identity = storage.read(package, value["identity"]["path"])
    if (
        identity.get("release_id") != ident
        or identity.get("source_fingerprint") != manifest["source_fingerprint"]
        or identity.get("url") != value.get("url")
    ):
        raise ValueError("Verified identity belongs to another release.")
    for item in [
        value["handoff"],
        value["live_snapshot"],
        value["identity"],
        *value["live"].values(),
    ]:
        path = check_gates.resolve_inside(package, item["path"])
        if sha(path) != item["sha256"]:
            raise ValueError("Verified release artifact changed: " + item["path"])
    snapshot = storage.read(package, value["live_snapshot"]["path"])
    if (
        snapshot.get("mode") != "live"
        or snapshot.get("source_fingerprint") != manifest["source_fingerprint"]
    ):
        raise ValueError("Verified live snapshot belongs to another release.")
    if value["handoff"]["path"] != "build/gates.json" or value["handoff"]["sha256"] != manifest[
        "inputs"
    ].get("build/gates.json"):
        raise ValueError("Verified handoff reference differs from the sealed handoff.")
    for gate, item in value["live"].items():
        report = storage.read(package, item["path"])
        errors = check_gates.validate_report(package, report, snapshot, gate)
        if (
            report.get("status") not in {"pass", "pass_with_warnings"}
            or report.get("fully_verified") is not True
            or errors
        ):
            raise ValueError("Verified live evidence no longer validates: " + gate)
        if (
            report.get("deployment_identity") != identity
            or report.get("target", {}).get("url", "").rstrip("/") != identity["url"].rstrip("/")
            or report.get("observations", {}).get("database_id") != identity["database_id"]
        ):
            raise ValueError("Verified live journey belongs to another identity: " + gate)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("freeze", "validate", "live-snapshot", "finalize", "verified", "run"):
        p = sub.add_parser(name)
        p.add_argument("root", type=Path)
        if name == "run":
            p.add_argument("argv", nargs=argparse.REMAINDER)
        else:
            p.add_argument("--id", required=True)
        if name == "freeze":
            p.add_argument("--fixture", default="test-fixture.json")
        if name == "finalize":
            p.add_argument("--attempt", required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if args.command == "run":
            lock = storage.path_inside(root, ".secrets/publish.lock")
            lock.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with lock.open("a") as handle:
                os.chmod(lock, 0o600)
                try:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    raise ValueError(
                        "A publisher process still holds this project lock. Inspect that actual process before starting another."
                    )
                argv = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
                if not argv:
                    raise ValueError("No publishing driver supplied.")
                env = {**os.environ, "FUNNEL_PUBLISH_LOCK_FD": str(handle.fileno())}
                return subprocess.run(
                    argv, cwd=root, env=env, pass_fds=(handle.fileno(),)
                ).returncode
        result = (
            freeze(root, args.id, args.fixture)
            if args.command == "freeze"
            else (
                validate(root, args.id)
                if args.command == "validate"
                else (
                    live_snapshot(root, args.id)
                    if args.command == "live-snapshot"
                    else (
                        verified(root, args.id)
                        if args.command == "verified"
                        else finalize(root, args.id, args.attempt)
                    )
                )
            )
        )
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "blocked", "failures": [str(error)]}, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
