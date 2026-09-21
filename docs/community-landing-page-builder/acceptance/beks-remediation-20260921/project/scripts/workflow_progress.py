"""Evidence-derived progress and local resumption; never runs paid or remote actions."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
import uuid

import check_gates
import image_workflow
import workflow_storage as storage

PROGRESS = "build/progress.json"
STAGES = {
    "research",
    "copy_drafting",
    "copy_review",
    "design_and_build",
    "local_verification",
    "publishing_setup",
    "publishing",
    "live_verification",
}
EXTERNAL_STAGES = {"publishing_setup", "publishing", "live_verification"}
CANDIDATES = {
    "copy": "build/copy-audit.json",
    "images": "build/images-audit.json",
    "browser": "build/layout/result.json",
    "browser_compat": "build/browser-compat/result.json",
    "performance": "build/performance/result.json",
    "rendered_copy": "build/rendered-copy/result.json",
    "local_journey": "build/live-verification/local-journey.json",
}
PASS = {"pass", "pass_with_warnings"}
LABELS = {
    "setup": "Create the project",
    "research": "Research the business and reference",
    "copy_drafting": "Draft complete copy",
    "copy_review": "Review the copy",
    "awaiting_copy_approval": "Review and approve the copy",
    "design_and_build": "Build and review the design",
    "image_generation_pending": "Resolve the existing image request",
    "local_verification": "Test the complete local funnel",
    "publishing_setup": "Local final ready for launch setup",
    "awaiting_publish_authorization": "Connect launch destinations",
    "ready_to_publish": "Ready for the approved publish",
    "deployed_unverified": "Uploaded; verification is incomplete",
    "publishing_outcome_unknown": "Check the interrupted external action",
    "live_checks_passed": "Live checks passed; release identity is not finalized",
    "ready_for_handoff": "Ready for the reviewed handoff",
    "demo": "Explore the fictional local demo",
    "release_recovery": "Resume the saved publishing release",
    "published_verified": "Published; saved live verification passed",
    "published_with_local_changes": "Published release verified; local changes remain",
}


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(root):
    value = storage.read(root, PROGRESS, {"schema_version": 1, "events": [], "observations": []})
    if (
        value.get("schema_version") != 1
        or not isinstance(value.get("events"), list)
        or not isinstance(value.get("observations"), list)
    ):
        raise ValueError(
            "Progress history has an unsupported or damaged schema; preserve it and restore the intended record."
        )
    return value


def approval_summary(value):
    # Do not print private approval messages or credential fields in a status view.
    return {
        kind: {
            key: item.get(key)
            for key in ("actor", "approved_at", "fingerprint", "message_id", "allow_test_lead")
        }
        for kind, item in value.get("approvals", {}).items()
        if isinstance(item, dict)
    }


def gate_state(root, mode="handoff"):
    try:
        result = check_gates.check(root, mode, root / "build/gates.json")
        saved = storage.read(root, "build/gates.json", {}).get("snapshot", {})
        result["snapshot_current"] = bool(
            saved.get("source_fingerprint")
            and saved.get("source_fingerprint") == result.get("source_fingerprint")
            and saved.get("mode") == mode
        )
        for gate in check_gates.required_gates(root, mode):
            result["gates"].setdefault(
                gate, {"status": "missing", "failures": ["Required gate has no evidence"]}
            )
        return result
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        return {
            "status": "blocked",
            "gates": {},
            "failures": ["Quality evidence cannot be validated: " + str(error)],
            "warnings": [],
        }


def image_state(root, config):
    if config.get("images", {}).get("enabled") is False:
        return {"enabled": False, "passed": True, "pending": [], "errors": []}
    plan = storage.read(root, "image-plan.json")
    if plan is None:
        return {
            "enabled": True,
            "passed": False,
            "pending": [],
            "errors": ["Plan the image placements and source assets before image review."],
        }
    pending = [
        {key: a.get(key) for key in ("id", "asset_id", "status", "mode", "requested_model")}
        for a in plan.get("generation_attempts", [])
        if a.get("status") == "pending"
    ]
    try:
        result = image_workflow.gate(plan, root)
    except (OSError, ValueError, KeyError, TypeError) as error:
        result = {"passed": False, "errors": ["Image plan cannot be validated: " + str(error)]}
    return {"enabled": True, **result, "pending": pending}


def deployment_state(root):
    deployment = storage.read(root, "build/deployment-record.json")
    if deployment is None:
        return None
    url = urlsplit(deployment.get("url", ""))
    if (
        url.scheme != "https"
        or not url.hostname
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path not in ("", "/")
    ):
        raise ValueError(
            "The saved deployment destination is invalid; inspect it privately before any verification."
        )
    result = {
        key: deployment.get(key)
        for key in (
            "worker",
            "account_id",
            "database_id",
            "version_id",
            "uploaded_at",
            "verification_pending",
        )
    }
    result["url"] = url.geturl().rstrip("/")
    # A legacy success flag cannot prove actual running version/binding identity.
    result["identity_finalized"] = False
    result["live_evidence"] = gate_state(root, "live")
    live = storage.read(root, "build/live-verification/result.json")
    if live:
        result["last_verification"] = {
            key: live.get(key)
            for key in (
                "status",
                "readiness",
                "fully_verified",
                "executed_at",
                "lead_id",
                "cleanup",
            )
        }
        result["last_verification"]["failures"] = live.get("failures", [])
    snapshot = storage.read(root, "build/gate-snapshot.json", {})
    result["checked_live_reports"] = {}
    for gate in ("crm", "tracking", "deployment"):
        failures = []
        try:
            report = storage.read(root, f"build/live-verification/{gate}.json")
            if (
                not report
                or report.get("status") not in PASS
                or report.get("fully_verified") is not True
            ):
                failures.append("Current successful live report is missing")
            elif (
                snapshot.get("mode") != "live"
                or snapshot.get("source_fingerprint")
                != check_gates.source_snapshot(root)["source_fingerprint"]
            ):
                failures.append("Live source snapshot is missing or stale")
            else:
                failures += check_gates.validate_report(root, report, snapshot, gate)
                if report.get("target", {}).get("url", "").rstrip("/") != result[
                    "url"
                ] or report.get("observations", {}).get("database_id") != deployment.get(
                    "database_id"
                ):
                    failures.append("Live report is for a different destination or database")
        except (OSError, ValueError, KeyError, TypeError) as error:
            failures.append("Live report cannot be validated: " + str(error))
        result["checked_live_reports"][gate] = {"valid": not failures, "failures": failures}
    return result


def guarded_release_state(root):
    """Read sealed saved proof only; this does not contact Cloudflare or assert liveness."""
    root = Path(root).resolve()
    pointer = storage.read(root, "build/current-release.json")
    if pointer is None:
        return None
    import release_state

    ident = pointer.get("id", "")
    result = {
        "id": ident,
        "evidence_scope": "saved release evidence; current provider state was not queried",
        "verified": False,
        "failures": [],
    }
    try:
        base = release_state.directory(root, ident)
        state = storage.read(root, (base / "state.json").relative_to(root).as_posix())
        sealed = release_state.validate(root, ident)
        if (
            state.get("id") != ident
            or state.get("source_fingerprint") != sealed["source_fingerprint"]
        ):
            raise ValueError("Saved release state does not match its frozen inputs.")
        result.update(
            phase=state.get("phase"),
            source_fingerprint=sealed["source_fingerprint"],
            source_current=sealed["source_fingerprint"]
            == check_gates.source_snapshot(root)["source_fingerprint"],
        )
        attempt = state.get("attempt")
        if isinstance(attempt, int) and attempt > 0:
            relative = f"build/releases/{ident}/package/build/live/{attempt:03d}/"
            journal = storage.read(root, relative + "attempt.json", {})
            result["journey"] = {
                key: journal.get(key)
                for key in ("schema_version", "runs", "stage", "form_attempted", "cleanup_started")
            }
            last = storage.read(root, relative + "result.json", {})
            result["journey"]["recovery_code"] = last.get("recovery", {}).get("code")
        if state.get("phase") == "verified":
            proof = release_state.verified(root, ident)
            result.update(verified=True, url=proof["url"], verified_at=proof["verified_at"])
        elif state.get("phase") == "public_checks_passed":
            result["failures"].append(
                "Only public checks ran; the frozen approval did not authorize the controlled live lead."
            )
        else:
            result["failures"].append(
                "This release has not finished validated live verification. Preserve its attempts before resuming."
            )
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        result["failures"].append("Saved release evidence cannot be validated: " + str(error))
    return result


def inspect(root):
    import workflow

    root = Path(root).resolve()
    history = record(root)
    for event in history["events"]:
        current = True
        for artifact in event.get("artifacts", []):
            try:
                path = check_gates.resolve_inside(root, artifact["path"])
                current &= path.is_file() and digest(path) == artifact["sha256"]
            except (OSError, ValueError, KeyError):
                current = False
        event["artifacts_current"] = current
    config = storage.read(root, "funnel.json")
    report = {
        "schema_version": 1,
        "observed_at": now(),
        "stage": "setup",
        "stage_label": LABELS["setup"],
        "status": "in_progress",
        "completed": [],
        "blockers": [],
        "warnings": [],
        "next_action": {},
        "checkpoints": history["events"][-20:],
        "checkpoint_count": len(history["events"]),
        "limits": [
            "Progress is derived from current evidence. Saved stage labels and operator notes cannot grant approval or pass a gate.",
            "A saved started event is not proof of a running process. Inspect the actual process/provider before retrying an uncertain external action.",
            "Resume only registers existing valid local QA reports and saves progress. It never generates images, provisions a database, deploys, logs in, or submits a lead.",
        ],
    }

    def at(stage, instruction, *, status="in_progress", command=None):
        report.update(stage=stage, stage_label=LABELS[stage], status=status)
        report["next_action"] = {
            "instruction": instruction,
            "kind": "agent_work",
            "command": command,
        }
        if status == "awaiting_review":
            report["next_action"]["kind"] = "user_review"
        if stage in {"deployed_unverified", "live_checks_passed", "publishing_outcome_unknown"}:
            report["next_action"]["kind"] = "recovery"
        active = next(
            (event for event in reversed(history["events"]) if event.get("stage") == stage), None
        )
        if active and active.get("event") == "blocked":
            report["operator_blocker"] = active
            report["status"] = "blocked"
            report["blockers"].append("Operator checkpoint: " + active["summary"])
            report["warnings"].append(
                "The saved operator blocker still needs examination; a checkpoint is not QA evidence."
            )
        return report

    if config is None:
        return at(
            "setup",
            "Create a new project with the installed skill scaffold; retain the supplied website, reference and actual brief.",
        )
    report["completed"].append("project_created")
    report["source_fingerprint"] = check_gates.source_snapshot(root)["source_fingerprint"]
    incoming = storage.read(root, "build/handoff-import.json")
    if incoming:
        report["handoff"] = {
            key: incoming.get(key)
            for key in ("package_id", "scope", "source_fingerprint", "publication_context_pending")
        }
    state = workflow.load(root)
    report["approvals"] = approval_summary(state)
    report["quality"] = gate_state(root)
    if report["quality"].get("snapshot_current"):
        report["completed"] += [
            gate + "_evidence_verified"
            for gate, item in report["quality"]["gates"].items()
            if item.get("status") in PASS
        ]
    report["warnings"] += report["quality"].get("warnings", [])
    if config.get("development_fixture"):
        report["publication"] = "disabled"
        return at(
            "demo",
            "Use the local quickstart to explore or verify the fictional page and CRM. Start a new client project for a real build; this demo cannot be published.",
            status="development_only",
        )

    release = guarded_release_state(root)
    if release:
        report["release"] = release
        if release["verified"]:
            report["completed"].append("saved_live_release_verified")
            report["warnings"].append(
                "This status validates retained evidence only. A guarded publish --resume rechecks the actual provider/runtime identity before claiming the current destination is verified."
            )
            if not release["source_current"]:
                return at(
                    "published_with_local_changes",
                    "Keep the verified published release. Review and test the changed local source, then use --new-release only after its actual final approval.",
                    status="in_progress",
                )
            return at(
                "published_verified",
                "Use the saved site/admin handoff. Recheck current release identity with the guarded publisher when needed; local status does not contact the provider.",
                status="verified_saved",
            )
        report["blockers"] += release["failures"]
        return at(
            "release_recovery",
            "Use the guarded publisher with --resume to inspect the same saved release and its supported journey journal. Completed steps are reused; uncertain acknowledgements retry the exact private request and idempotency key. Preserve the receipt and follow the recorded diagnosis for a legacy journal, changed version/contact, missing private payload or exhausted recovery limit.",
            status="blocked",
            command=["node", "scripts/publish.mjs", "--resume"],
        )

    deployment = deployment_state(root)
    if deployment:
        report["deployment"] = deployment
        report["completed"].append("deployment_record_present")
        report["blockers"].append(
            "The running release identity has not been reconciled with the reviewed source and database."
        )
        report["blockers"] += deployment["live_evidence"].get("failures", [])
        if all(item["valid"] for item in deployment["checked_live_reports"].values()):
            return at(
                "live_checks_passed",
                "Retain the validated live test evidence and reconcile the running revision/database with the reviewed release. A saved verification result is not final release identity. Do not redeploy merely to refresh a status.",
                status="blocked",
            )
        return at(
            "deployed_unverified",
            "Inspect this legacy deployment and verification record before any retry. The guarded publisher will block it until its origin, current version and reviewed source are reconciled into a release record; a legacy success flag is insufficient.",
            status="blocked",
        )

    unresolved = {}
    for event in history["events"]:
        if event.get("stage") in EXTERNAL_STAGES:
            if (
                event.get("event") == "resolved"
                and event.get("artifacts")
                and event.get("artifacts_current")
            ):
                unresolved.pop(event["stage"], None)
            else:
                unresolved[event["stage"]] = event
    if unresolved:
        report["uncertain_external_actions"] = list(unresolved.values())
        report["blockers"] += ["Unreconciled operator checkpoint: " + stage for stage in unresolved]
        return at(
            "publishing_outcome_unknown",
            "Inspect the actual process handle and provider state for the recorded action. A stored start/failure note cannot prove whether it ran. Reconcile its result before another database creation, deployment or test submission.",
            status="blocked",
        )

    paths = {key: root / value for key, value in workflow.COPY_FILES.items()}
    report["copy_files"] = {
        key: {"path": str(path.relative_to(root)), "present": path.is_file()}
        for key, path in paths.items()
    }
    if not paths["brief"].is_file():
        return at(
            "research",
            "Inspect client/reference sources and supplied facts, then prepare the research-grounded copy brief. Keep unknown claims explicit.",
        )
    if not paths["context"].is_file() or not paths["copy"].is_file():
        return at(
            "copy_drafting",
            "Use the installed copy helper to prepare current source/reference context, then write the complete canonical page, form, thank-you and brochure copy.",
        )
    if not paths["review"].is_file():
        return at(
            "copy_review",
            "Perform the actual eight-part editorial review against current sources and copy. Save its anchored findings and hashes; a script must not invent the review.",
        )
    copy_state = workflow.copy_state(root)
    report["copy_review"] = copy_state
    if copy_state["status"] not in PASS:
        report["blockers"] += copy_state["failures"]
        return at(
            "copy_review",
            "Resolve the reported copy/source/review findings in the existing project. Refresh only the affected evidence; do not discard the draft or invent approval.",
            status="blocked",
        )
    report["completed"].append("copy_review_passed")
    if config.get("approvals", {}).get("copy_before_design"):
        approval = workflow.check_copy_approval(root)
        report["copy_approval"] = approval
        if approval["status"] not in PASS:
            report["blockers"] += approval["failures"]
            return at(
                "awaiting_copy_approval",
                "This project explicitly requested approval-gated copy. Present the full current copy and record the user’s actual approval before design.",
                status="awaiting_review",
            )
        report["completed"].append("copy_approved")
    else:
        report["completed"].append("copy_gate_passed_without_optional_approval")
    report["images"] = image_state(root, config)
    if report["images"]["pending"]:
        report["blockers"] += [
            "Unresolved image attempt: " + str(item.get("id"))
            for item in report["images"]["pending"]
        ]
        return at(
            "image_generation_pending",
            "Inspect the existing tool request/output and resolve that exact attempt before retrying. Register a real result, or record its actual failure. No new generation request is made by resume.",
            status="blocked",
        )
    build_readiness = workflow.check_build(root)
    report["build_readiness"] = build_readiness
    if build_readiness["status"] not in PASS:
        report["blockers"] += build_readiness["failures"]
        return at(
            "design_and_build",
            "Complete the substantive design system and valid image plan, then run workflow.py check-build. Do not create or edit client HTML or generate the brochure PDF while it is blocked.",
            status="blocked",
            command=["python3", "scripts/workflow.py", "check-build", "."],
        )
    if not report["images"]["passed"]:
        report["blockers"] += report["images"]["errors"]
        return at(
            "design_and_build",
            "Continue the design and its existing image plan. Source, optimize and inspect the selected assets; resolve these findings without restarting the approved copy.",
        )
    report["completed"].append("image_plan_satisfied")
    if not (root / "build/gate-snapshot.json").is_file():
        return at(
            "design_and_build",
            "Finish the actual page, form, thank-you page and brochure. Once assembled, create a handoff snapshot and execute the required reviews and tests.",
            command=["python3", "scripts/check_gates.py", "snapshot", ".", "--mode", "handoff"],
        )
    if report["quality"]["status"] not in PASS:
        report["blockers"] += report["quality"]["failures"]
        return at(
            "local_verification",
            "Resolve the listed missing, failed or stale checks against the current build. Resume reuses valid unregistered reports; it never manufactures reviews or reruns a paid/remote operation.",
        )
    report["completed"].append("local_quality_verified")
    if config.get("backend", {}).get("provider") == "none":
        return at(
            "ready_for_handoff",
            "Present the reviewed static handoff and its recorded limitations. Cloudflare/CRM publication is not part of this static-only project.",
            status="ready",
        )
    target = storage.read(root, "wrangler.jsonc", {})
    databases = target.get("d1_databases", [])
    configured = bool(
        re.fullmatch(r"[a-f0-9]{32}", str(target.get("account_id", "")))
        and re.fullmatch(r"[a-z][a-z0-9-]{2,48}", str(target.get("name", "")))
        and target.get("name") != "branded-lead-funnel"
        and databases
        and re.fullmatch(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}",
            databases[0].get("database_id", ""),
        )
    )
    report["publishing_target"] = {
        "configured": configured,
        "worker": target.get("name"),
        "account_id": target.get("account_id"),
        "domains": [v.get("pattern") for v in target.get("routes", [])],
    }
    if not configured:
        return at(
            "publishing_setup",
            "The local final is ready. Collect the intended Cloudflare account/site, domain and GTM destination values. Reuse existing publish scope when present; configuration changes need a fresh QA snapshot before publication authorization is recorded.",
            status="ready",
        )
    publish = workflow.check_publish_approval(root)
    report["publish_approval"] = publish
    if publish["status"] not in PASS:
        report["blockers"] += publish["failures"]
        if not publish["failures"] or not all(
            item.startswith(
                (
                    "Publication authorization is missing or stale",
                    "Imported handoff history does not grant publishing authority",
                )
            )
            for item in publish["failures"]
        ):
            return at(
                "local_verification",
                "Copy or quality evidence changed during readiness inspection. Resolve these findings and inspect again before recording publication authorization.",
                status="blocked",
            )
        return at(
            "awaiting_publish_authorization",
            "The local final is complete. Reuse the original instruction if it explicitly authorized publication; otherwise ask once whether to publish. Collect the Cloudflare/domain/GTM inputs and controlled-test-lead choice, then record the real publication instruction.",
            status="awaiting_review",
        )
    report["completed"].append("publication_authorized")
    return at(
        "ready_to_publish",
        "Use the guarded publishing procedure after its current credential/browser/fixture prerequisites are checked. No upload has been performed by this status/resume command.",
        status="ready",
    )


def checkpoint(root, stage, event, summary, artifacts=()):
    root = Path(root).resolve()
    if stage not in STAGES or event not in {"started", "blocked", "resolved"}:
        raise ValueError("Use a supported work stage and started, blocked or resolved event.")
    summary = summary.strip()
    if (
        not summary
        or len(summary) > 1000
        or re.search(
            r"(?:password|api[_ -]?key|token|secret|authorization)\s*[:=]\s*\S+", summary, re.I
        )
    ):
        raise ValueError(
            "Use a short redacted work note, never credentials, tokens or raw customer data."
        )
    references = []
    for name in artifacts:
        path = check_gates.resolve_inside(root, name)
        if not path.is_file():
            raise ValueError("Checkpoint artifact is missing.")
        references.append({"path": path.relative_to(root).as_posix(), "sha256": digest(path)})
    if stage in EXTERNAL_STAGES and event == "resolved" and not references:
        raise ValueError(
            "Record the actual inspected process/provider outcome as an artifact before resolving an external-action checkpoint."
        )
    with storage.lock(root):
        history = record(root)
        entry = {
            "id": uuid.uuid4().hex,
            "stage": stage,
            "event": event,
            "summary": summary,
            "recorded_at": now(),
            "source_fingerprint": check_gates.source_snapshot(root)["source_fingerprint"],
            "artifacts": references,
            "evidence_scope": "operator checkpoint only; not approval, QA proof or process liveness",
        }
        history["events"].append(entry)
        storage.write(root, PROGRESS, history)
    return entry


def resume(root):
    """Consume only existing successful reports for a current handoff snapshot."""
    root = Path(root).resolve()
    record(root)  # Reject damaged history before making any local bookkeeping changes.
    registered = []
    snapshot = storage.read(root, "build/gate-snapshot.json")
    if (
        snapshot
        and snapshot.get("mode") == "handoff"
        and snapshot.get("source_fingerprint")
        == check_gates.source_snapshot(root)["source_fingerprint"]
    ):
        for gate, path in CANDIDATES.items():
            if gate not in check_gates.required_gates(root, "handoff"):
                continue
            manifest = storage.read(root, "build/gates.json", {})
            # Preserve an existing failed/stale entry for examination; do not select an older green report over it.
            same_snapshot = (
                manifest.get("snapshot", {}).get("source_fingerprint"),
                manifest.get("snapshot", {}).get("mode"),
            ) == (snapshot["source_fingerprint"], snapshot["mode"])
            if same_snapshot and gate in manifest.get("gates", {}):
                continue
            candidate = storage.read(root, path)
            if (
                candidate
                and candidate.get("status") in PASS
                and not check_gates.validate_report(root, candidate, snapshot, gate)
            ):
                check_gates.record_report(root, gate, path)
                registered.append(gate)
    with storage.lock(root):
        result = inspect(root)
        history = record(root)
        observation = {
            key: result[key] for key in ("observed_at", "stage", "status", "next_action")
        }
        observation["source_fingerprint"] = result.get("source_fingerprint")
        observation["registered_existing_reports"] = registered
        history["observations"].append(observation)
        history["latest"] = observation
        storage.write(root, PROGRESS, history)
    result["registered_existing_reports"] = registered
    result["saved_progress"] = PROGRESS
    return result
