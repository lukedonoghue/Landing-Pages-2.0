"""Check owner-action handoff completeness, not provider identity or live behavior."""
import argparse
import json
from pathlib import Path


def validate(data, requested_hosts=()):
    errors = []
    if not isinstance(data, dict):
        return ["handoff must be an object"]

    def required(obj, key, label):
        if not isinstance(obj.get(key), str) or not obj[key].strip():
            errors.append(f"{label}: missing {key}")

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
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    parser.add_argument("--hostname", action="append", default=[], help="Repeat for each hostname supplied by the user")
    args = parser.parse_args()
    try:
        data = json.loads((args.project / "build/owner-handoff.json").read_text())
        errors = validate(data, args.hostname)
    except (OSError, ValueError) as exc:
        errors = [str(exc)]
    print(json.dumps({"status": "blocked" if errors else "pass", "failures": errors,
                      "scope": "structure only; not proof of delivery or live setup"}, indent=2))
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
