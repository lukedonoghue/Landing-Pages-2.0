#!/usr/bin/env python3
"""Scan generated customer-facing text for prohibited marks and placeholders."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


TEXT_SUFFIXES = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".json", ".jsonld",
    ".md", ".txt", ".xml", ".svg", ".yaml", ".yml", ".toml",
}
EXCLUDED_PARTS = {
    ".git", ".secrets", "node_modules", "vendor", "screenshots", "catalogue-pages",
    "coverage", ".pytest_cache", "__pycache__", ".community-builder",
    ".codex", ".claude", ".wrangler", ".venv", "test-results", "playwright-report",
}
PROHIBITED = (
    (re.compile("\u2014"), "U+2014 long dash"),
    (re.compile("\u2013"), "U+2013 long dash"),
    (
        re.compile(r"&(?:m|n)dash;|&#0*(?:8211|8212);?|&#x0*(?:2013|2014);?", re.I),
        "long-dash HTML entity",
    ),
)
TEMPLATE_PATTERNS = (
    (re.compile(r"\{\{\s*[A-Z][A-Z0-9_ -]{2,}\s*\}\}"), "template marker"),
    (re.compile(r"\[\[\s*[A-Z][A-Z0-9_ -]{2,}\s*\]\]"), "template marker"),
    (
        re.compile(
            r"\b(?:CLIENT_NAME|DOMAIN_PLACEHOLDER|REPLACE_WITH_[A-Z0-9_]+|YOUR_(?:PHONE|EMAIL|URL|DOMAIN|COMPANY)|WORKFLOW_TEMPLATE_INCOMPLETE)\b",
            re.I,
        ),
        "unresolved placeholder",
    ),
    (re.compile(r"\bLorem ipsum\b", re.I), "sample copy"),
    (re.compile(r"\bGTM-X{4,}\b", re.I), "placeholder GTM ID"),
)


def relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def iter_files(root: Path, report_path: Path | None):
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        rel = path.relative_to(root)
        if rel.parts[0] != "public" and any(part in EXCLUDED_PARTS for part in rel.parts):
            continue
        # Build evidence can quote rejected copy or contain intentionally blocked checks.
        # Canonical customer copy remains in scope; raw QA/research captures are not copy.
        if len(rel.parts) > 1 and rel.parts[0] not in {"public", "docs", "build", "assets", "landing-page"}:
            continue
        if rel.parts[0] == "build" and path.name not in {"page-copy.json", "page-copy.md"}:
            continue
        if path.name == "surface-scan.json" or (report_path and path.resolve() == report_path.resolve()):
            continue
        yield path


def safe_excerpt(line: str, start: int, end: int) -> str:
    excerpt = line[max(0, start - 36): min(len(line), end + 36)].strip()
    return (
        excerpt.replace("\u2014", "<U+2014>")
        .replace("\u2013", "<U+2013>")
        .replace("\t", " ")
    )


def findings_for(path: Path, root: Path, forbidden_text: list[str]):
    try:
        if path.is_symlink():
            raise OSError("Copy the intended source instead of using a symlink")
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError) as error:
        return [{"path": relative(path, root), "line": 1, "column": 1,
                 "reason": "unreadable required text surface", "excerpt": type(error).__name__}]

    findings = []
    patterns = list(PROHIBITED) + list(TEMPLATE_PATTERNS)
    rel = path.relative_to(root)
    if path.suffix.lower() in {".html", ".htm"} and "admin" not in rel.parts:
        patterns.append((re.compile(r"\blocal\s+demo\s+CRM\b", re.I),
                         "visitor-facing implementation jargon; explain preview behavior plainly"))
    patterns.extend((re.compile(re.escape(value), re.I), f"forbidden text: {value}") for value in forbidden_text)
    for line_number, line in enumerate(text.splitlines(), 1):
        for pattern, reason in patterns:
            for match in pattern.finditer(line):
                findings.append(
                    {
                        "path": relative(path, root),
                        "line": line_number,
                        "column": match.start() + 1,
                        "reason": reason,
                        "excerpt": safe_excerpt(line, match.start(), match.end()),
                    }
                )
    return findings


def scan(root, forbidden_text=(), report_path=None, exclude=()):
    root = Path(root).resolve()
    files = [p for p in iter_files(root, report_path) if p.relative_to(root).as_posix() not in exclude]
    findings = [item for path in files for item in findings_for(path, root, list(forbidden_text))]
    return {"schema_version": 1, "gate": "surface-scan", "status": "blocked" if findings else "pass",
            "executed_at": datetime.now(timezone.utc).isoformat(), "files_scanned": len(files),
            "scope": "project text and canonical copy; not tool internals or raw research/QA",
            "excluded_directories": sorted(EXCLUDED_PARTS), "findings": findings}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--report", type=Path, help="Output path, relative to the current working directory or absolute")
    parser.add_argument("--forbid-text", action="append", default=[])
    args = parser.parse_args()

    root = args.project_root.expanduser().resolve()
    if not root.is_dir():
        parser.error(f"Project root does not exist: {root}")
    report_path = None
    if args.report:
        report_path = args.report.resolve()

    files = list(iter_files(root, report_path))
    findings = []
    for path in files:
        findings.extend(findings_for(path, root, args.forbid_text))

    result = {
        "schema_version": 1,
        "gate": "surface-scan",
        "status": "blocked" if findings else "pass",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "files_scanned": len(files),
        "scope": "project text and canonical copy; not copied tools or raw research/QA evidence",
        "excluded_directories": sorted(EXCLUDED_PARTS),
        "findings": findings,
    }
    rendered = json.dumps(result, indent=2, ensure_ascii=True) + "\n"
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(rendered, encoding="utf-8")
    sys.stdout.write(rendered)
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
