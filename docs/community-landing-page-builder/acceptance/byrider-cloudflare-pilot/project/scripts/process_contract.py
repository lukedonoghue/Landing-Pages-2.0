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

REQUIRED_PAGE_JOBS = {
    "hero", "offer", "proof", "problem", "solution", "process",
    "objections", "faq", "final-cta",
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


def validate_page_structure(root: Path) -> list[str]:
    root = Path(root).resolve()
    path = root / "build" / "page-structure.json"
    if not path.is_file():
        return ["Missing required build/page-structure.json. Map the full persuasive journey before visual assembly."]
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"Invalid build/page-structure.json: {exc}"]
    failures = []
    config_path = root / "funnel.json"
    config = json.loads(config_path.read_text(encoding="utf-8")) if config_path.is_file() else {}
    minimum = config.get("quality", {}).get("minimum_sections", 12)
    sections = value.get("sections")
    if not isinstance(sections, list) or len(sections) < minimum:
        failures.append(f"Page structure has {len(sections) if isinstance(sections, list) else 0} sections; complete funnels require at least {minimum} substantive sections.")
        return failures
    jobs = set()
    visual_sections = 0
    cta_sections = 0
    for index, section in enumerate(sections, 1):
        if not isinstance(section, dict):
            failures.append(f"Page structure section {index} must be an object.")
            continue
        missing = [key for key in ("id", "job", "headline", "persuasive_purpose", "buyer_question", "visual_role", "cta_role") if not str(section.get(key, "")).strip()]
        if missing:
            failures.append(f"Page structure section {index} is missing: {', '.join(missing)}")
        jobs.add(str(section.get("job", "")).strip())
        if str(section.get("visual_role", "")).strip().lower() not in {"none", "not-applicable"}:
            visual_sections += 1
        if str(section.get("cta_role", "")).strip().lower() not in {"none", "not-applicable"}:
            cta_sections += 1
    missing_jobs = sorted(REQUIRED_PAGE_JOBS - jobs)
    if missing_jobs:
        failures.append("Page structure is missing required persuasive jobs: " + ", ".join(missing_jobs))
    if visual_sections < 5:
        failures.append("Page structure needs meaningful visual roles in at least five sections.")
    if cta_sections < 3:
        failures.append("Page structure needs CTA roles in at least three decision points.")
    return failures


def check_build_documents(root: Path) -> dict:
    failures = validate_documents(root, BUILD_GATE_DOCS)
    failures.extend(validate_page_structure(root))
    image_plan = Path(root).resolve() / "image-plan.json"
    if not image_plan.is_file():
        failures.append(
            "Missing image-plan.json. Record sourced, supplied, generated, or explicitly unnecessary imagery before building."
        )
    return {"status": "blocked" if failures else "pass", "failures": failures}
