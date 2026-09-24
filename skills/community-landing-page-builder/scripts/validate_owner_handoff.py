"""Check owner-action handoff completeness, not provider identity or live behavior."""
import argparse
import json
import re
from pathlib import Path


PASS = {"pass", "pass_with_warnings"}
CLEANUP_CHECK = "Only this run’s synthetic contact was removed"


def cleanup_claimed(data):
    """Recognize affirmative cleanup prose without treating pending cleanup as success."""
    values = []

    def collect(value, key=None):
        if key == "cleanup":
            return
        if isinstance(value, dict):
            for child_key, child in value.items():
                collect(child, child_key)
        elif isinstance(value, list):
            for child in value:
                collect(child)
        elif isinstance(value, str):
            values.append(value)

    collect(data)
    subject = r"(?:synthetic(?: test)?|test|demo)[ -](?:lead|contact)"
    complete = r"(?:soft-removed|removed|deleted|cleaned up|cleanup (?:is )?(?:complete|completed|verified|succeeded))"
    negative = r"(?:not|never|isn't|wasn't|hasn't been|remains?|retained|pending|incomplete|failed)"
    for value in values:
        match = re.search(subject + r".{0,100}" + complete, value, re.I)
        if match is None:
            match = re.search(complete + r".{0,100}" + subject, value, re.I)
        if match is not None and re.search(negative, match.group(0), re.I) is None:
            return True
    return False


def complete_erasure_claimed(data):
    """Reject unqualified erasure claims while allowing 'not complete erasure'."""
    values = []

    def collect(value, key=None):
        if key == "cleanup":
            return
        if isinstance(value, dict):
            for child_key, child in value.items():
                collect(child, child_key)
        elif isinstance(value, list):
            for child in value:
                collect(child)
        elif isinstance(value, str):
            values.append(value)

    collect(data)
    claim = re.compile(
        r"complete erasure|completely erased|zero traces?|all (?:test )?data (?:was |is )?(?:deleted|removed)",
        re.I,
    )
    for value in values:
        for match in claim.finditer(value):
            prefix = value[max(0, match.start() - 24):match.start()]
            if re.search(r"(?:not|no|isn't|wasn't|without)\s*$", prefix, re.I) is None:
                return True
    return False


def validate_cleanup(data, project, errors):
    cleanup = data.get("cleanup")
    claimed = cleanup_claimed(data)
    if cleanup is None:
        if claimed:
            errors.append("cleanup claim requires a structured cleanup disposition")
        return
    if not isinstance(cleanup, dict):
        errors.append("cleanup must be an object")
        return
    disposition = cleanup.get("disposition")
    if disposition not in {"pending", "retained", "verified_soft_removed"}:
        errors.append("cleanup disposition must be pending, retained or verified_soft_removed")
        return
    owner_note = cleanup.get("owner_note")
    if not isinstance(owner_note, str) or not owner_note.strip():
        errors.append("cleanup: missing owner_note")
    elif owner_note not in data.get("message", ""):
        errors.append("cleanup owner_note must be surfaced in the handoff message")
    if disposition != "verified_soft_removed":
        if claimed:
            errors.append(f"cleanup disposition {disposition} does not support an affirmative cleanup claim")
        return
    if cleanup.get("historical_metrics") != "retained":
        errors.append("verified cleanup must state historical_metrics as retained")
    if complete_erasure_claimed(data):
        errors.append("verified soft-removal cannot be described as complete erasure")
    report_name = cleanup.get("report")
    if not isinstance(report_name, str) or not report_name.strip():
        errors.append("cleanup: missing report")
        return
    if project is None:
        errors.append("cleanup evidence cannot be checked without the project path")
        return
    relative = Path(report_name)
    root = Path(project).resolve()
    report_path = (root / relative).resolve()
    try:
        report_path.relative_to(root / "build")
    except ValueError:
        errors.append("cleanup report must be a relative file under build/")
        return
    if relative.is_absolute():
        errors.append("cleanup report must be a relative file under build/")
        return
    try:
        report = json.loads(report_path.read_text())
    except (OSError, ValueError) as exc:
        errors.append(f"cleanup report cannot be read: {exc}")
        return
    if not isinstance(report, dict):
        errors.append("cleanup report must be an object")
        return
    if report.get("status") not in PASS or report.get("fully_verified") is not True:
        errors.append("cleanup report is not a completed live verification")
    if report.get("cleanup") != "synthetic-contact-soft-removed":
        errors.append("cleanup report does not record guarded synthetic-contact soft-removal")
    checks = report.get("checks")
    if not isinstance(checks, list) or not any(
        isinstance(check, dict)
        and check.get("name") == CLEANUP_CHECK
        and check.get("status") == "pass"
        for check in checks
    ):
        errors.append("cleanup report lacks the successful post-cleanup readback")
    impact = report.get("synthetic_impact")
    if not isinstance(impact, dict) or not isinstance(impact.get("lead_id"), str) or not impact["lead_id"]:
        errors.append("cleanup report does not identify its internal synthetic contact")


def validate(data, requested_hosts=(), project=None):
    errors = []
    if not isinstance(data, dict):
        return ["handoff must be an object"]

    def required(obj, key, label):
        if not isinstance(obj.get(key), str) or not obj[key].strip():
            errors.append(f"{label}: missing {key}")

    if project is not None and data.get('release_level'):
        try:
            import completion_contract as c
            import check_gates
            root=Path(project).resolve()
            if data.get('release_status_path')!='build/release-inputs.json':raise ValueError('Owner status must derive from immutable release inputs')
            core=c.read(c.evidence(root,{'path':data['release_status_path'],'sha256':data.get('release_status_sha256')}))
            if core.get('source_fingerprint')!=check_gates.source_snapshot(root)['source_fingerprint'] or data.get('source_fingerprint')!=core.get('source_fingerprint'):
                raise ValueError('Owner handoff refers to stale release source')
            if data.get('release_level') in {'local-final','live-verified'} and core.get('quality_status') not in PASS:
                raise ValueError('Owner cannot claim final while release inputs are blocked')
        except (OSError,ValueError,KeyError,TypeError) as error:errors.append(str(error))
    required(data, "message", "handoff")
    blockers = data.get("blockers")
    domains = data.get("domains")
    if not isinstance(blockers, list) or not isinstance(domains, list):
        return errors + ["domains and blockers must be lists"]
    recorded = {d.get("hostname", "").lower().rstrip(".") for d in domains
                if isinstance(d, dict) and isinstance(d.get("hostname"), str)}
    for hostname in requested_hosts:
        if hostname.lower().rstrip(".") not in recorded:
            errors.append(f"requested hostname missing from handoff: {hostname}")
    expected = "action_required" if blockers else "complete"
    if data.get("status") != expected:
        errors.append(f"handoff status must be {expected}")
    ids = set()
    for index, blocker in enumerate(blockers):
        label = f"blocker {index + 1}"
        if not isinstance(blocker, dict):
            errors.append(f"{label}: must be an object")
            continue
        for key in ("id", "feature", "evidence", "completed", "preserve", "resume"):
            required(blocker, key, label)
        identifier = blocker.get("id")
        if isinstance(identifier, str):
            if identifier in ids:
                errors.append(f"{label}: duplicate id")
            ids.add(identifier)
        steps = blocker.get("steps")
        if not isinstance(steps, list) or not steps:
            errors.append(f"{label}: numbered owner steps required")
            continue
        for step in steps:
            if not isinstance(step, dict):
                errors.append(f"{label}: step must be an object")
                continue
            required(step, "action", label)
            required(step, "expected", label)
    for index, domain in enumerate(domains):
        label = f"domain {index + 1}"
        if not isinstance(domain, dict):
            errors.append(f"{label}: must be an object")
            continue
        required(domain, "hostname", label)
        for key in ("registrar", "dns_provider"):
            observation = domain.get(key)
            if not isinstance(observation, dict):
                errors.append(f"{label}: separate {key} evidence required")
            else:
                required(observation, "name", label + " " + key)
                required(observation, "evidence", label + " " + key)
        state = domain.get("status")
        if state == "blocked":
            if not isinstance(domain.get("blocker_id"), str) or domain["blocker_id"] not in ids:
                errors.append(f"{label}: missing linked owner-action blocker")
        elif state == "verified":
            required(domain, "verification", label)
        elif state == "deferred":
            required(domain, "decision", label)
        else:
            errors.append(f"{label}: status must be blocked, verified or deferred")
    if project is not None and (Path(project) / "src/free-usage.js").exists():
        monitoring = data.get("usage_monitoring")
        if not isinstance(monitoring, dict):
            errors.append("CRM handoff requires usage_monitoring status and owner instructions")
        else:
            for key in ("evidence", "coverage", "owner_note"):
                required(monitoring, key, "usage_monitoring")
            note = monitoring.get("owner_note")
            if isinstance(note, str) and note not in data.get("message", ""):
                errors.append("usage_monitoring owner_note must be surfaced in the handoff message")
            state = monitoring.get("status")
            if state == "not_connected":
                if monitoring.get("blocker_id") not in ids:
                    errors.append("Unconnected usage monitoring requires a linked setup blocker")
            elif state == "deferred":
                required(monitoring, "decision", "usage_monitoring")
            elif state != "verified":
                errors.append("usage_monitoring status must be verified, not_connected or deferred")
    validate_cleanup(data, project, errors)
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    parser.add_argument("--hostname", action="append", default=[], help="Repeat for each hostname supplied by the user")
    args = parser.parse_args()
    try:
        data = json.loads((args.project / "build/owner-handoff.json").read_text())
        errors = validate(data, args.hostname, args.project)
    except (OSError, ValueError) as exc:
        errors = [str(exc)]
    print(json.dumps({"status": "blocked" if errors else "pass", "failures": errors,
                      "scope": "handoff structure and cited cleanup report; not proof of delivery, provider identity, DNS or other live setup"}, indent=2))
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
