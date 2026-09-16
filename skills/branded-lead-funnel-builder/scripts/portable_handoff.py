#!/usr/bin/env python3
"""Portable nonsecret Worker handoffs. Hashes prove integrity, not author consent."""

from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import unicodedata
import uuid
import zipfile

import check_gates
import workflow
import workflow_storage as storage

MAX_FILES = 20000
MAX_FILE = 128 * 1024 * 1024
MAX_TOTAL = 1024 * 1024 * 1024
PRIVATE_DIRS = {
    ".secrets",
    ".git",
    ".wrangler",
    "node_modules",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "coverage",
    "test-results",
    "playwright-report",
}
SECRET_KEYS = {
    "password",
    "newpassword",
    "currentpassword",
    "generatedpassword",
    "passwordhash",
    "adminpasswordhash",
    "sessionsecret",
    "webhooksigningsecret",
    "apikey",
    "accesstoken",
    "refreshtoken",
    "authorization",
    "cookie",
    "setcookie",
}
STATE_FILES = [
    *workflow.COPY_FILES.values(),
    "build/workflow.json",
    "build/progress.json",
    "build/gates.json",
    "build/gate-snapshot.json",
    "build/handoff-import.json",
]
HISTORY_FILES = ["build/current-release.json", "build/deployment-record.json"]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    return check_gates.file_hash(Path(path))


def packed(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def read(path):
    return json.loads(path.read_text())


def safe_name(value):
    if not isinstance(value, str) or not value or "\\" in value or ":" in value or "\x00" in value:
        raise ValueError("Archive paths must be ordinary portable relative paths.")
    name = PurePosixPath(value)
    if (
        name.is_absolute()
        or any(part in {"..", "."} for part in name.parts)
        or name.as_posix() != value
    ):
        raise ValueError("Archive path traversal or ambiguous normalization is not allowed.")
    return name


def eligible(name):
    parts = safe_name(name).parts
    base = parts[-1].lower()
    if any(part in PRIVATE_DIRS for part in parts) or base.startswith(
        (".env", ".dev.vars", ".npmrc", ".pypirc", "id_rsa", "id_ed25519")
    ):
        raise ValueError("Private/runtime data cannot enter a handoff: " + name)
    suffix = Path(base).suffix
    if (
        suffix
        in {
            ".pem",
            ".key",
            ".p12",
            ".pfx",
            ".db",
            ".sqlite",
            ".sqlite3",
            ".csv",
            ".zip",
            ".tar",
            ".gz",
            ".7z",
        }
        or re.search(r"\.(?:db|sqlite3?)-(?:wal|shm|journal)$", base)
        or (suffix == ".sql" and "migrations" not in parts)
    ):
        raise ValueError("Credential/database/export file cannot enter a handoff: " + name)
    if suffix not in {".py", ".mjs", ".js", ".ts", ".tsx", ".css", ".html", ".sql"} and re.search(
        r"(?:^|[._-])(?:credentials?|passwords?|secrets?|private.?key|lead.?export|customer.?export|backup)(?:[._-]|$)",
        base,
    ):
        raise ValueError("Secret/export-like file requires separate private handover: " + name)


def leaves(value, package=False):
    if isinstance(value, dict):
        for key, item in value.items():
            yield re.sub("[^a-z]", "", key.lower()), item
            if not (
                package
                and key
                in {"dependencies", "devDependencies", "peerDependencies", "optionalDependencies"}
            ):
                yield from leaves(item, package)
    elif isinstance(value, list):
        for item in value:
            yield from leaves(item, package)


def secret_values(root):
    values = set()
    directory = root / ".secrets"
    if directory.is_dir() and not directory.is_symlink():
        for file in directory.rglob("*"):
            if file.is_symlink() or not file.is_file() or file.stat().st_size > MAX_FILE:
                continue
            try:
                if file.suffix == ".json":
                    for key, value in leaves(read(file)):
                        if key in SECRET_KEYS and isinstance(value, str) and len(value) >= 8:
                            values.add(value.encode())
                elif re.search(r"password|secret|token", file.name, re.I) and file.suffix == ".txt":
                    value = file.read_text().strip()
                    if len(value) >= 8:
                        values.add(value.encode())
            except (ValueError, UnicodeError):
                continue
    # Bootstrap variables may exist before a .secrets handoff was generated.
    dev = root / ".dev.vars"
    if dev.is_file() and not dev.is_symlink():
        for line in dev.read_text().splitlines():
            key, sep, value = line.partition("=")
            if sep and re.sub("[^a-z]", "", key.lower()) in SECRET_KEYS:
                try:
                    value = json.loads(value)
                except ValueError:
                    value = value.strip().strip("\"'")
                if isinstance(value, str) and len(value) >= 8:
                    values.add(value.encode())
    return values


def check_data(name, data, secrets=()):
    eligible(name)
    if data.startswith(b"SQLite format 3\x00"):
        raise ValueError("Runtime database content cannot enter a handoff: " + name)
    if len(data) > MAX_FILE:
        raise ValueError("A handoff file exceeds the supported size: " + name)
    if any(value in data for value in secrets):
        raise ValueError("A private credential value appears in a handoff file: " + name)
    if name.endswith(".json"):
        try:
            value = json.loads(data)
        except (ValueError, UnicodeError):
            return
        for key, item in leaves(value, Path(name).name in {"package.json", "package-lock.json"}):
            if key in SECRET_KEYS and isinstance(item, str) and item and not item.startswith("${"):
                raise ValueError("JSON credential data requires a private handover: " + name)
            if (
                key
                in {
                    "formdata",
                    "sessions",
                    "leads",
                    "customers",
                    "contacts",
                    "cookies",
                    "localstorage",
                    "sessionstorage",
                }
                and isinstance(item, (dict, list))
                and item
            ):
                raise ValueError(
                    "Raw contact/session records cannot enter a source handoff: " + name
                )


def linked(value):
    if isinstance(value, dict):
        if isinstance(value.get("path"), str) and isinstance(value.get("sha256"), str):
            yield value["path"], value["sha256"]
        if isinstance(value.get("manifest_path"), str) and isinstance(
            value.get("manifest_sha256"), str
        ):
            yield value["manifest_path"], value["manifest_sha256"]
        for item in value.values():
            yield from linked(item)
    elif isinstance(value, list):
        for item in value:
            yield from linked(item)


def catalogue_assets(value):
    if not isinstance(value, dict) or not all(
        key in value for key in ("brand", "cover", "services")
    ):
        return
    brand = value.get("brand", {})
    if brand.get("logo"):
        yield brand["logo"]
    yield from brand.get("fonts", {}).values()

    def images(item):
        if isinstance(item, dict):
            if isinstance(item.get("image"), str) and item["image"]:
                yield item["image"]
            for child in item.values():
                yield from images(child)
        elif isinstance(item, list):
            for child in item:
                yield from images(child)

    yield from images(value)


def sanitize_workflow(data, archive_publish=True):
    original = json.loads(data)
    value = {"schema_version": original.get("schema_version", 1), "approvals": {}}
    allowed = {
        "actor",
        "approved_at",
        "fingerprint",
        "message_id",
        "allow_test_lead",
        "message_sha256",
    }
    for section in ("approvals", "historical_approvals"):
        for kind, approval in original.get(section, {}).items():
            if kind not in {"copy", "publish"} or not isinstance(approval, dict):
                continue
            retained = {key: item for key, item in approval.items() if key in allowed}
            if "message" in approval:
                retained["message_sha256"] = digest(str(approval["message"]).encode())
            value.setdefault(section, {})[kind] = retained
    if archive_publish and "publish" in value.get("approvals", {}):
        value.setdefault("historical_approvals", {})["publish"] = value["approvals"].pop("publish")
    return packed(value)


def collect(root, extra=(), in_progress=False):
    snapshot = check_gates.source_snapshot(root)
    selected = {}  # project-relative path -> bytes; no fallback to the old location.
    transformations = []
    original_inputs = {}
    missing = []
    pending = [(name, root) for name in snapshot["files"]]
    pending += [
        (name, root)
        for name in STATE_FILES + HISTORY_FILES
        if storage.path_inside(root, name).is_file()
    ]
    pending += [(name, root) for name in extra]
    # An interruption may occur after a producer finished but before its report
    # was registered. Preserve the same candidates the resume helper examines.
    import workflow_progress

    pending += [
        (name, root)
        for name in workflow_progress.CANDIDATES.values()
        if storage.path_inside(root, name).is_file()
    ]
    journeys = root / "build/live-verification"
    if journeys.is_dir():
        pending += [
            (file.relative_to(root).as_posix(), root)
            for file in journeys.rglob("*")
            if (file.is_file() or file.is_symlink())
            and file.name in {"attempt.json", "result.json", "local-journey.json"}
        ]
    marker = storage.read(root, ".landing-pages-demo.json", {})
    if marker.get("kind") == "synthetic-local-demo":
        pending += [
            (name, root)
            for name in ("build/demo-catalogue.json", "build/demo-copy.json")
            if storage.path_inside(root, name).is_file()
        ]
    history = root / "build/handoff-history"
    if history.is_dir():
        pending += [
            (file.relative_to(root).as_posix(), root)
            for file in history.rglob("*")
            if file.is_file() or file.is_symlink()
        ]
    gates = storage.read(root, "build/gates.json", {})
    pending += [(item["report"], root) for item in gates.get("gates", {}).values()]
    pointer = storage.read(root, "build/current-release.json")
    release_ids = {pointer.get("id", "")} if pointer else set()
    releases = root / "build/releases"
    if releases.is_dir():
        release_ids.update(file.parent.name for file in releases.glob("*/inputs.json"))
    for ident in sorted(release_ids):
        import release_state

        release = release_state.directory(root, ident)
        manifest = release_state.validate(root, ident)
        for name in ["inputs.json", "state.json", "verification.json"]:
            if (release / name).is_file():
                pending.append(
                    (
                        (release / name).relative_to(root).as_posix(),
                        release / "package" if name == "verification.json" else root,
                    )
                )
        package = release / "package"
        pending += [
            ((package / name).relative_to(root).as_posix(), package) for name in manifest["inputs"]
        ]
        live = package / "build/live"
        if live.is_dir():
            # Journals and produced evidence are redacted by their writers; every
            # file still goes through the same private-data checks below.
            for file in live.rglob("*"):
                if file.is_file() or file.is_symlink():
                    pending.append((file.relative_to(root).as_posix(), package))
    seen = set()
    while pending:
        name, context = pending.pop()
        safe_name(name)
        if name in seen:
            continue
        seen.add(name)
        path = storage.path_inside(root, name)
        if not path.is_file():
            if in_progress and name.startswith(("build/", "screenshots/")):
                missing.append(name)
                continue
            raise ValueError("Required portable input is missing: " + name)
        if path.stat().st_size > MAX_FILE:
            raise ValueError("A handoff input exceeds the supported size: " + name)
        data = path.read_bytes()
        check_data(name, data)
        if name.endswith("/package/build/workflow.json") and json.loads(
            sanitize_workflow(data, False)
        ) != json.loads(data):
            raise ValueError(
                "Sealed release approval data contains private text or unrelated state. It cannot be redacted without invalidating the seal: "
                + name
            )
        selected[name] = data
        original_inputs[name] = digest(data)
        if path.suffix == ".json":
            try:
                value = json.loads(data)
            except (ValueError, UnicodeError):
                continue
            for relative in catalogue_assets(value):
                if (
                    not isinstance(relative, str)
                    or Path(relative).is_absolute()
                    or "://" in relative
                ):
                    raise ValueError(
                        "Catalogue assets need relative project-local paths for handoff: " + name
                    )
                candidate = path.parent / relative
                if any(parent.is_symlink() for parent in [candidate, *candidate.parents]):
                    raise ValueError("Catalogue assets cannot use symlinks.")
                asset = candidate.resolve()
                if not asset.is_relative_to(root):
                    raise ValueError("Catalogue asset escapes the project.")
                pending.append((asset.relative_to(root).as_posix(), context))
            for relative, expected in linked(value):
                if Path(relative).is_absolute():
                    # Absolute tool/provenance locators are historical metadata.
                    # Copy/QA validation below catches any required nonportable input.
                    continue
                asset = storage.path_inside(context, relative)
                if not asset.is_file() or digest(asset.read_bytes()) != expected:
                    if not in_progress:
                        raise ValueError("Linked evidence is missing or changed: " + relative)
                    missing.append(asset.relative_to(root).as_posix())
                    if not asset.is_file():
                        continue
                pending.append((asset.relative_to(root).as_posix(), context))
    if "build/workflow.json" in selected:
        old = selected["build/workflow.json"]
        selected["build/workflow.json"] = sanitize_workflow(old)
        transformations.append(
            {
                "path": "build/workflow.json",
                "original_sha256": digest(old),
                "reason": "Keep approval-message hashes; publication scope becomes historical, not executable consent.",
            }
        )
    for name in HISTORY_FILES:
        if name in selected:
            renamed = "build/handoff-history/" + digest(selected[name])[:16] + "-" + Path(name).name
            if renamed in selected and selected[renamed] != selected[name]:
                raise ValueError("An existing history file would be overwritten: " + renamed)
            selected[renamed] = selected.pop(name)
            transformations.append(
                {
                    "path": name,
                    "archived_as": renamed,
                    "reason": "No automatic resumption of another publishing process/account.",
                }
            )
    return snapshot, selected, transformations, original_inputs, sorted(set(missing))


def audit(root):
    try:
        copy = workflow.copy_state(root)
    except (ValueError, KeyError, OSError, TypeError) as error:
        copy = {"status": "blocked", "failures": [str(error)]}
    try:
        gates = check_gates.check(root, "handoff", root / "build/gates.json")
    except (ValueError, KeyError, OSError, TypeError) as error:
        gates = {"status": "blocked", "failures": [str(error)]}
    return {"copy": copy, "quality": gates}


def export_bundle(root, output, client, in_progress=False, extra=()):
    root = Path(root).resolve()
    output = Path(output).absolute()
    if output.is_symlink():
        raise ValueError("Do not replace a symlink with a handoff.")
    if output.suffix.lower() != ".zip":
        raise ValueError("Use a .zip output, not a project state or evidence file.")
    output = output.resolve()
    if output.is_relative_to(root) and output.relative_to(root).parts[0] != "build":
        raise ValueError(
            "Write the ZIP outside project source, or under build/, so packaging does not change the reviewed revision."
        )
    before = audit(root)
    if not in_progress and (
        before["quality"].get("status") not in {"pass", "pass_with_warnings"}
        or before["copy"].get("status") not in {"pass", "pass_with_warnings"}
    ):
        raise ValueError(
            "Reviewed handoff needs current copy and quality evidence. Finish the checks or explicitly export an in-progress handoff."
        )
    snapshot, files, changes, original_inputs, missing = collect(root, extra, in_progress)
    if output.is_relative_to(root) and output.relative_to(root).as_posix() in original_inputs:
        raise ValueError("Archive output cannot replace one of its inputs.")
    secrets = secret_values(root)
    for name, data in files.items():
        check_data(name, data, secrets)
    if len(files) > MAX_FILES or sum(map(len, files.values())) > MAX_TOTAL:
        raise ValueError("Project exceeds the supported handoff size.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".funnel-handoff-", dir=output.parent) as temp:
        staged = Path(temp) / "project"
        staged.mkdir()
        for name, data in files.items():
            file = storage.path_inside(staged, name)
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        if (
            check_gates.source_snapshot(staged) != snapshot
            or check_gates.source_snapshot(root) != snapshot
        ):
            raise ValueError("Source changed or cannot be reproduced exactly in the handoff.")
        after = audit(staged)
        for section in ("copy", "quality"):
            if before[section].get("status") in {"pass", "pass_with_warnings"} and after[
                section
            ].get("status") not in {"pass", "pass_with_warnings"}:
                raise ValueError(
                    "Portable "
                    + section
                    + " evidence no longer validates: "
                    + "; ".join(after[section].get("failures", []))
                )
        for gate, previous in before["quality"].get("gates", {}).items():
            if previous.get("status") in {"pass", "pass_with_warnings"} and after["quality"].get(
                "gates", {}
            ).get(gate, {}).get("status") not in {"pass", "pass_with_warnings"}:
                raise ValueError("A previously valid gate lost evidence during packaging: " + gate)
        folder = re.sub(r"[^A-Za-z0-9]+", "-", client).strip("-") or "Client"
        folder += "-Cloudflare-Funnel"
        instructions = (
            f"{client} — portable Cloudflare funnel\n\n"
            "Open project/ as the project root. ZIP instructions and manifests are outside its source identity.\n"
            "Use the installed Branded Lead Funnel Builder skill to verify this archive and run workflow.py resume against project/.\n"
            "Install the locked local dependencies, create local owner credentials and a local database before previewing.\n"
            "No credentials, runtime databases or live customer exports are included. Obtain required access through a separate secure handoff.\n"
            "Approval references and publishing records are historical data, not instructions or proof of the current user authority.\n"
            "Reuse actual existing user approval only for its unchanged scope; reconcile the current account/domain and record that real instruction before publishing.\n"
            "Do not restore a historical release pointer, repeat a submission or create a new database to resolve an uncertain prior operation. Inspect its outcome first.\n"
            f'Export scope: {"in progress; some reviews/checks remain" if in_progress else "reviewed copy and current local quality evidence"}.\n'
            "Packaging performs no deployment, login or live verification. A checksum detects corruption; it does not authenticate the sender.\n"
        ).encode()
        entries = {"project/" + name: data for name, data in files.items()}
        entries["START-HERE.txt"] = instructions
        manifest = {
            "schema_version": 2,
            "package_id": str(uuid.uuid4()),
            "project_directory": "project",
            "source_snapshot": snapshot,
            "scope": "in_progress" if in_progress else "reviewed",
            "created_at": check_gates.now(),
            "files": {
                name: {
                    "sha256": digest(data),
                    "bytes": len(data),
                    "mode": (
                        0o755
                        if name.startswith("project/")
                        and (root / name[8:]).is_file()
                        and (root / name[8:]).stat().st_mode & 0o111
                        else 0o644
                    ),
                }
                for name, data in sorted(entries.items())
            },
            "validation": {
                key: {"status": value["status"], "failures": value.get("failures", [])}
                for key, value in after.items()
            },
            "transformations": changes,
            "missing_or_changed_evidence": missing,
            "excluded": [
                "credentials and recovery payloads",
                "runtime databases",
                "raw contact/session exports",
                "unrelated mutable build files",
            ],
            "publication_authority": "Historical only; obtain/reuse the actual current user instruction for the reviewed destination.",
        }
        archive_path = Path(temp) / "handoff.zip"
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for name, data in entries.items():
                archive.writestr(folder + "/" + name, data)
            archive.writestr(folder + "/FILE-MANIFEST.json", packed(manifest))
        verify_archive(archive_path)
        if check_gates.source_snapshot(root) != snapshot:
            raise ValueError("Source changed during packaging; the prior output was preserved.")
        for name, expected in original_inputs.items():
            original = storage.path_inside(root, name)
            if not original.is_file() or digest(original.read_bytes()) != expected:
                raise ValueError(
                    "An input changed during packaging; the prior output was preserved: " + name
                )
        os.replace(archive_path, output)
    return {
        "archive": str(output),
        "sha256": file_digest(output),
        "files": len(entries) + 1,
        "scope": manifest["scope"],
        "source_fingerprint": snapshot["source_fingerprint"],
        "validation": manifest["validation"],
    }


def verify_archive(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        infos = archive.infolist()
        if len(infos) > MAX_FILES + 2 or sum(item.file_size for item in infos) > MAX_TOTAL:
            raise ValueError("Archive exceeds the supported handoff limits.")
        names = set()
        normalized = set()
        for item in infos:
            name = safe_name(item.filename)
            folded = unicodedata.normalize("NFC", str(name)).casefold()
            mode = item.external_attr >> 16
            if (
                item.is_dir()
                or stat.S_ISLNK(mode)
                or (stat.S_IFMT(mode) not in {0, stat.S_IFREG})
                or item.flag_bits & 1
            ):
                raise ValueError("Only ordinary unencrypted files are supported in a handoff.")
            if item.filename in names or folded in normalized:
                raise ValueError("Archive contains duplicate or filesystem-colliding paths.")
            names.add(item.filename)
            normalized.add(folded)
            if item.file_size > MAX_FILE or item.file_size > max(1, item.compress_size) * 1000:
                raise ValueError("Archive member exceeds safe extraction limits.")
        manifests = [
            name
            for name in names
            if len(PurePosixPath(name).parts) == 2 and name.endswith("/FILE-MANIFEST.json")
        ]
        if len(manifests) != 1:
            raise ValueError("Use a version-2 portable handoff with one manifest.")
        manifest_name = manifests[0]
        prefix = manifest_name.rsplit("/", 1)[0] + "/"
        if archive.getinfo(manifest_name).file_size > 8 * 1024 * 1024:
            raise ValueError("Handoff manifest exceeds the supported size.")
        manifest = json.loads(archive.read(manifest_name))
        if (
            not isinstance(manifest, dict)
            or not isinstance(manifest.get("files"), dict)
            or not isinstance(manifest.get("source_snapshot"), dict)
            or not isinstance(manifest.get("validation"), dict)
        ):
            raise ValueError("Handoff manifest has an invalid structure.")
        uuid.UUID(manifest.get("package_id", ""))
        if (
            manifest.get("schema_version") != 2
            or manifest.get("project_directory") != "project"
            or manifest.get("scope") not in {"in_progress", "reviewed"}
        ):
            raise ValueError("Unsupported handoff schema.")
        if set(manifest["validation"]) != {"copy", "quality"} or any(
            not isinstance(item, dict) for item in manifest["validation"].values()
        ):
            raise ValueError("Handoff validation summary is incomplete.")
        if manifest["scope"] == "reviewed" and any(
            item.get("status") not in {"pass", "pass_with_warnings"}
            for item in manifest["validation"].values()
        ):
            raise ValueError("Reviewed handoff classification contradicts its blocked validation.")
        if names != {prefix + name for name in manifest["files"]} | {manifest_name}:
            raise ValueError("Archive inventory differs from its manifest.")
        source = {}
        for name, expected in manifest["files"].items():
            safe_name(name)
            if expected.get("mode") not in {0o644, 0o755}:
                raise ValueError("Unsupported archive file permissions.")
            if name != "START-HERE.txt" and not name.startswith("project/"):
                raise ValueError("Unexpected package member.")
            data = archive.read(prefix + name)
            if len(data) != expected["bytes"] or digest(data) != expected["sha256"]:
                raise ValueError("Archive file hash/size mismatch: " + name)
            if name.startswith("project/"):
                relative = name[len("project/") :]
                check_data(relative, data)
                if not check_gates.excluded(Path(relative)):
                    source[relative] = digest(data)
        snapshot = manifest["source_snapshot"]
        computed = digest(
            json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        )
        if source != snapshot["files"] or computed != snapshot["source_fingerprint"]:
            raise ValueError("Archive does not reproduce its declared project source.")
        return {"manifest": manifest, "prefix": prefix, "sha256": file_digest(archive_path)}


def extract_archive(archive_path, destination):
    verified = verify_archive(archive_path)
    destination = Path(destination).absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError("Extract into a new directory; existing work is never overwritten.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".funnel-import-", dir=destination.parent) as temp:
        staging = Path(temp) / "handoff"
        staging.mkdir()
        with zipfile.ZipFile(archive_path) as archive:
            for name in verified["manifest"]["files"]:
                file = storage.path_inside(staging, name)
                file.parent.mkdir(parents=True, exist_ok=True)
                expected = verified["manifest"]["files"][name]
                item = archive.getinfo(verified["prefix"] + name)
                if item.file_size != expected["bytes"]:
                    raise ValueError("Archive changed after verification.")
                data = archive.read(item)
                if len(data) != expected["bytes"] or digest(data) != expected["sha256"]:
                    raise ValueError("Archive changed after verification.")
                file.write_bytes(data)
                file.chmod(verified["manifest"]["files"][name]["mode"])
        (staging / "FILE-MANIFEST.json").write_bytes(packed(verified["manifest"]))
        project = staging / "project"
        storage.write(
            project,
            "build/handoff-import.json",
            {
                "schema_version": 1,
                "package_id": verified["manifest"]["package_id"],
                "archive_sha256": verified["sha256"],
                "source_fingerprint": verified["manifest"]["source_snapshot"]["source_fingerprint"],
                "scope": verified["manifest"]["scope"],
                "publication_context_pending": True,
                "limits": [
                    "No runtime database or private recovery files were transferred.",
                    "Past approvals and provider records are evidence, not current user instructions.",
                ],
            },
        )
        if check_gates.source_snapshot(project) != verified["manifest"]["source_snapshot"]:
            raise ValueError("Extracted source identity differs from the archive.")
        outcome = audit(project)
        if verified["manifest"]["scope"] == "reviewed" and any(
            item.get("status") not in {"pass", "pass_with_warnings"} for item in outcome.values()
        ):
            raise ValueError(
                "Reviewed handoff does not pass its actual extracted copy/quality checks."
            )
        for key, previous in verified["manifest"]["validation"].items():
            if previous["status"] in {"pass", "pass_with_warnings"} and outcome[key][
                "status"
            ] not in {"pass", "pass_with_warnings"}:
                raise ValueError("Extracted evidence could not be validated independently: " + key)
        if destination.exists():
            raise ValueError("Destination appeared during extraction; existing work was preserved.")
        os.rename(staging, destination)
    return {
        "project": str(destination / "project"),
        "source_fingerprint": verified["manifest"]["source_snapshot"]["source_fingerprint"],
        "validation": {key: value["status"] for key, value in outcome.items()},
        "publication_context_pending": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    for name in ("verify", "extract"):
        command = sub.add_parser(name)
        command.add_argument("archive", type=Path)
        if name == "extract":
            command.add_argument("--into", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = (
            extract_archive(args.archive, args.into)
            if args.action == "extract"
            else verify_archive(args.archive)
        )
        if args.action == "verify":
            result = {
                "sha256": result["sha256"],
                "scope": result["manifest"]["scope"],
                "source_fingerprint": result["manifest"]["source_snapshot"]["source_fingerprint"],
                "integrity": "verified; sender and user authority are not authenticated",
            }
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError, zipfile.BadZipFile) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
