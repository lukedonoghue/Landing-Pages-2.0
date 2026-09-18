#!/usr/bin/env python3
"""Validate page-specific brochure review evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


BOOL_KEYS = (
    "reviewed_at_readable_size",
    "no_clipping",
    "no_truncation",
    "no_text_image_collision",
    "no_text_on_face_or_subject",
    "information_bearing_images_complete",
    "links_and_contact_checked",
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("review", type=Path)
    args = parser.parse_args()

    root = args.project_root.expanduser().resolve()
    review_path = args.review if args.review.is_absolute() else root / args.review
    data = json.loads(review_path.read_text(encoding="utf-8"))
    failures: list[str] = []

    page_count = data.get("page_count")
    pages = data.get("pages")
    if not isinstance(page_count, int) or page_count < 1:
        failures.append("page_count must be a positive integer")
        page_count = 0
    if not isinstance(pages, list):
        failures.append("pages must be an array")
        pages = []

    numbers = [item.get("page") for item in pages if isinstance(item, dict)]
    expected = list(range(1, page_count + 1))
    if numbers != expected:
        failures.append(f"pages must cover every page in order: expected {expected}, got {numbers}")

    for item in pages:
        if not isinstance(item, dict):
            failures.append("Each page review must be an object")
            continue
        number = item.get("page", "?")
        rendered = item.get("rendered_path", "")
        rendered_path = Path(rendered)
        if not rendered or not (rendered_path if rendered_path.is_absolute() else root / rendered_path).is_file():
            failures.append(f"Page {number}: rendered page evidence is missing")
        for key in BOOL_KEYS:
            if item.get(key) is not True:
                failures.append(f"Page {number}: {key} must be true after actual review")
        findings = item.get("findings")
        if not isinstance(findings, list):
            failures.append(f"Page {number}: findings must be an array")
        elif findings:
            failures.append(f"Page {number}: unresolved findings remain: {findings}")

    unresolved = data.get("unresolved_findings", [])
    if not isinstance(unresolved, list) or unresolved:
        failures.append("unresolved_findings must be an empty array")

    pdf = data.get("pdf", "")
    pdf_path = Path(pdf)
    if not pdf or not (pdf_path if pdf_path.is_absolute() else root / pdf_path).is_file():
        failures.append("Reviewed PDF is missing")
    if not str(data.get("reviewer", "")).strip():
        failures.append("reviewer is required")

    result = {"status": "blocked" if failures else "pass", "failures": failures, "page_count": page_count}
    sys.stdout.write(json.dumps(result, indent=2) + "\n")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
