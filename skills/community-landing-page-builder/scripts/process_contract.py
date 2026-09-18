#!/usr/bin/env python3
"""Semantic phase guards for the novice-facing one-prompt workflow."""

from __future__ import annotations

import json
import re
from pathlib import Path


TEMPLATE_MARKER = "WORKFLOW_TEMPLATE_INCOMPLETE"

COPY_GATE_DOCS = (
    "RESEARCH-BRIEF.md",
    "CLAIM-LEDGER.md",
    "REFERENCE-PAGE-COMPARISON.md",
    "BUYER-PSYCHOLOGY.md",
    "OBJECTION-MAP.md",
    "SECTION-COPY.md",
    "COPY-GATE-CHECKLIST.md",
    "FORM-SCHEMA.md",
)

BUILD_GATE_DOCS = (*COPY_GATE_DOCS, "DESIGN-SYSTEM.md", "IMAGE-RESEARCH.md")

MINIMUM_MEANINGFUL_CHARACTERS = {
    "RESEARCH-BRIEF.md": 160,
    "CLAIM-LEDGER.md": 80,
    "REFERENCE-PAGE-COMPARISON.md": 120,
    "BUYER-PSYCHOLOGY.md": 120,
    "OBJECTION-MAP.md": 80,
    "DESIGN-SYSTEM.md": 120,
    "SECTION-COPY.md": 200,
    "COPY-GATE-CHECKLIST.md": 80,
    "FORM-SCHEMA.md": 80,
    "IMAGE-RESEARCH.md": 500,
}

def meaningful_text(value: str) -> str:
    """Remove Markdown scaffolding so headings and empty tables do not count as work."""
    lines = []
    for raw in value.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or TEMPLATE_MARKER in line:
            continue
        if re.fullmatch(r"\|?(?:\s*:?-{3,}:?\s*\|)+", line):
            continue
        if line.startswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            known_headers = {
                "claim", "exact source", "retrieved", "confidence", "approved?",
                "required qualifier", "locations", "position", "visible pattern",
                "persuasive job", "evidence", "objection", "cta behavior",
                "client adaptation", "fear or cost", "page location", "status",
                "requirement", "step", "field", "type", "required", "options", "reason",
            }
            if cells and all(cell.lower() in known_headers for cell in cells):
                continue
        lines.append(line)
    return "\n".join(lines)


def validate_documents(root: Path, names=BUILD_GATE_DOCS) -> list[str]:
    root = Path(root).resolve()
    failures = []
    for name in names:
        path = root / "docs" / name
        relative = f"docs/{name}"
        if not path.is_file():
            failures.append(f"Missing required workflow document: {relative}")
            continue
        value = path.read_text(encoding="utf-8")
        if TEMPLATE_MARKER in value:
            failures.append(f"Workflow template is still incomplete: {relative}")
            continue
        meaningful = meaningful_text(value)
        minimum = MINIMUM_MEANINGFUL_CHARACTERS[name]
        if len(meaningful) < minimum:
            failures.append(
                f"Workflow document has placeholder-level content: {relative} "
                f"({len(meaningful)} meaningful characters; need at least {minimum})"
            )
    return failures


def check_copy_documents(root: Path) -> dict:
    failures = validate_documents(root, COPY_GATE_DOCS)
    return {"status": "blocked" if failures else "pass", "failures": failures}


def validate_reference_fidelity(root: Path) -> list[str]:
    root = Path(root).resolve()
    path = root / "build" / "reference-fidelity.json"
    if not path.is_file():
        return ["Missing required build/reference-fidelity.json. Compare the complete client/reference journeys before visual assembly."]
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"Invalid build/reference-fidelity.json: {exc}"]
    failures = []
    reference_sections = value.get("reference_sections")
    mappings = value.get("coverage")
    if not isinstance(reference_sections, list) or not reference_sections:
        failures.append("Reference fidelity must inventory every section and media moment in the supplied reference and relevant existing client page.")
        return failures
    if not isinstance(mappings, list):
        failures.append("Reference fidelity must contain a coverage mapping.")
        return failures
    mapped = {str(item.get("reference_id", "")).strip() for item in mappings if isinstance(item, dict)}
    missing = [str(item.get("id", "")).strip() for item in reference_sections if isinstance(item, dict) and str(item.get("id", "")).strip() not in mapped]
    if missing:
        failures.append("Reference sections missing from the final coverage decision: " + ", ".join(missing))
    for item in mappings:
        if not isinstance(item, dict) or item.get("disposition") not in {"preserved", "adapted", "replaced", "omitted"}:
            failures.append("Every reference coverage row needs a preserved, adapted, replaced, or omitted disposition.")
            continue
        if item.get("disposition") in {"replaced", "omitted"} and not str(item.get("rationale", "")).strip():
            failures.append(f"Reference coverage {item.get('reference_id', '<unknown>')} needs a researched rationale for replacement or omission.")
    dimensions = value.get("comparison", {})
    for key in ("content_depth", "media_cadence", "proof_density", "visual_variety", "cta_journey"):
        item = dimensions.get(key, {}) if isinstance(dimensions, dict) else {}
        if item.get("status") not in {"equal_or_stronger", "justified_difference"} or not str(item.get("evidence", "")).strip():
            failures.append(f"Reference fidelity comparison is incomplete for {key}.")
    return failures


def check_build_documents(root: Path) -> dict:
    failures = validate_documents(root, BUILD_GATE_DOCS)
    failures.extend(validate_reference_fidelity(root))
    image_plan = Path(root).resolve() / "image-plan.json"
    if not image_plan.is_file():
        failures.append(
            "Missing image-plan.json. Record sourced, supplied, generated, or explicitly unnecessary imagery before building."
        )
    return {"status": "blocked" if failures else "pass", "failures": failures}
