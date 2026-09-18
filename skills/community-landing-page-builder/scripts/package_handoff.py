#!/usr/bin/env python3
"""Create a verified client publishing ZIP for a static lead funnel."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
import zipfile
import subprocess
import sys
from datetime import date
from pathlib import Path


SITE_FILES = ("index.html", "thank-you.html", "styles.css", "script.js")
EVIDENCE_SCREENSHOTS = (
    "desktop-1440-hero.png",
    "desktop-1280-hero.png",
    "tablet-768.png",
    "mobile-390-hero.png",
    "modal-open.png",
    "thank-you.png",
)
EVIDENCE_DOCS = (
    "RESEARCH-BRIEF.md",
    "CLAIM-LEDGER.md",
    "REFERENCE-PAGE-COMPARISON.md",
    "BUYER-PSYCHOLOGY.md",
    "OBJECTION-MAP.md",
    "DESIGN-SYSTEM.md",
    "SECTION-COPY.md",
    "COPY-GATE-CHECKLIST.md",
    "FORM-SCHEMA.md",
    "BROCHURE-INTEGRATION.md",
    "QA-REPORT.md",
    "PREVIEW-QA.md",
    "SHIP-CHECKLIST.md",
)
EVIDENCE_BUILD = (
    "copy-scorecard.json",
    "visual-audit.json",
    "tracking-audit.json",
    "ship-checklist.json",
    "reusable-skill-validation.json",
)
REQUIRED_EVIDENCE_DOCS = (
    "RESEARCH-BRIEF.md",
    "CLAIM-LEDGER.md",
    "REFERENCE-PAGE-COMPARISON.md",
    "BUYER-PSYCHOLOGY.md",
    "OBJECTION-MAP.md",
    "DESIGN-SYSTEM.md",
    "SECTION-COPY.md",
    "COPY-GATE-CHECKLIST.md",
    "FORM-SCHEMA.md",
    "SHIP-CHECKLIST.md",
)
REQUIRED_EVIDENCE_BUILD = ("visual-audit.json", "tracking-audit.json", "ship-checklist.json")


def slugify(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-") or "Client"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_workers(root: Path, output: Path, args) -> int:
    """Archive the complete Worker project; never package runtime databases or credentials."""
    if args.site_only:
        raise SystemExit("A Workers CRM cannot run as a static-only ZIP. Package the complete project.")
    import portable_handoff
    extra = []
    if args.evidence_manifest:
        value = json.loads(args.evidence_manifest.read_text())
        extra = value.get('files') if isinstance(value, dict) else value
        if not isinstance(extra, list) or not all(isinstance(name, str) for name in extra):
            raise SystemExit('Evidence manifest must contain project-relative file names.')
    try:
        result = portable_handoff.export_bundle(root, output, args.client, args.in_progress or args.allow_missing_evidence, extra)
    except (ValueError, OSError, KeyError, TypeError) as error:
        raise SystemExit(str(error))
    print(json.dumps(result, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--client", required=True)
    parser.add_argument("--brochure", default="")
    parser.add_argument("--crm-status", default="pending")
    parser.add_argument("--tracking-status", default="pending")
    parser.add_argument("--deployment-status", default="not deployed")
    parser.add_argument("--site-only", action="store_true", help="Omit docs/build/screenshots evidence")
    parser.add_argument("--evidence-manifest", type=Path, help="JSON array or {files: []} of project-relative evidence paths")
    parser.add_argument("--allow-missing-evidence", action="store_true")
    parser.add_argument("--in-progress", action="store_true", help="Preserve an unfinished Worker project with explicit remaining QA; never marks it publishable")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.allow_missing_evidence and not args.in_progress:
        raise SystemExit("Missing evidence may only be preserved in an explicitly --in-progress handoff; it is never a completion package.")

    root = args.project_root.expanduser().resolve()
    output = args.output.expanduser().absolute()
    if output.exists() and not args.force:
        raise SystemExit(f"Output exists; pass --force to replace: {output}")
    if (root / "wrangler.jsonc").is_file() and (root / "public").is_dir():
        return package_workers(root, output, args)
    missing = [name for name in SITE_FILES if not (root / name).is_file()]
    if missing:
        raise SystemExit("Missing required site files: " + ", ".join(missing))

    brochure = (root / args.brochure).resolve() if args.brochure else None
    if brochure and not brochure.is_file():
        raise SystemExit(f"Brochure not found: {brochure}")

    evidence_sources: list[Path] = []
    evidence_warnings: list[str] = []
    if not args.site_only:
        if args.evidence_manifest:
            manifest_path = args.evidence_manifest.expanduser().resolve()
            raw_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(raw_manifest, dict) and "files" not in raw_manifest:
                raise SystemExit("Evidence manifest object must contain a files array")
            entries = raw_manifest["files"] if isinstance(raw_manifest, dict) else raw_manifest
            if not isinstance(entries, list) or not entries or not all(isinstance(item, str) and item.strip() for item in entries):
                raise SystemExit("Evidence manifest must be a JSON string array or an object with a files array")
            evidence_sources = [(root / item).resolve() for item in entries]
            outside = [str(path) for path in evidence_sources if root not in path.parents]
            if outside:
                raise SystemExit("Evidence manifest paths must stay inside the project root: " + ", ".join(outside))
            missing_evidence = [str(path.relative_to(root)) for path in evidence_sources if not path.is_file()]
        else:
            docs_dir = root / "docs"
            build_dir = root / "build"
            screenshots_dir = root / "screenshots"
            evidence_sources.extend(docs_dir / name for name in EVIDENCE_DOCS if (docs_dir / name).is_file())
            evidence_sources.extend(build_dir / name for name in EVIDENCE_BUILD if (build_dir / name).is_file())
            evidence_sources.extend(
                screenshots_dir / name for name in EVIDENCE_SCREENSHOTS
                if (screenshots_dir / name).is_file()
            )
            missing_evidence = [
                f"docs/{name}" for name in REQUIRED_EVIDENCE_DOCS if not (docs_dir / name).is_file()
            ]
            if not any((docs_dir / name).is_file() for name in ("QA-REPORT.md", "PREVIEW-QA.md")):
                missing_evidence.append("docs/QA-REPORT.md or docs/PREVIEW-QA.md")
            missing_evidence.extend(
                f"build/{name}" for name in REQUIRED_EVIDENCE_BUILD if not (build_dir / name).is_file()
            )
            missing_evidence.extend(
                f"screenshots/{name}" for name in EVIDENCE_SCREENSHOTS if not (screenshots_dir / name).is_file()
            )
        if missing_evidence:
            message = "Missing required handoff evidence: " + ", ".join(missing_evidence)
            if not args.in_progress:
                raise SystemExit(message + ". Supply --evidence-manifest, create canonical evidence, use --site-only, or explicitly pass --allow-missing-evidence.")
            evidence_warnings.append(message)

    package_name = f"{slugify(args.client)}-Client-Publishing-Package"
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []

    with tempfile.TemporaryDirectory(prefix="funnel-package-") as temp:
        staging = Path(temp) / package_name
        landing = staging / "landing-page"
        landing.mkdir(parents=True)

        candidates = [root / name for name in SITE_FILES]
        assets = root / "assets"
        if assets.is_dir():
            candidates.extend(path for path in assets.rglob("*") if path.is_file() and path.name != ".DS_Store")

        for source in candidates:
            relative = source.relative_to(root)
            target = landing / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())

        if not args.site_only:
            for source in evidence_sources:
                if not source.is_file():
                    continue
                relative = source.relative_to(root)
                target = staging / "evidence" / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())

        if brochure:
            brochure_target = staging / "brochure" / brochure.name
            brochure_target.parent.mkdir(parents=True, exist_ok=True)
            brochure_target.write_bytes(brochure.read_bytes())

        start_here = f"""{args.client.upper()} - CLIENT HANDOFF
Prepared {date.today().isoformat()}

CONTENTS
landing-page/ - landing page, thank-you page, styles, scripts, and local assets.
brochure/ - separate catalogue copy when supplied.
evidence/ - research, claims, copy, QA reports and canonical screenshots when available.

PREVIEW
Serve landing-page/ through a local static server and open index.html.

PUBLISHING
Upload the contents of landing-page/ while preserving paths and filenames.
This package does not imply a particular host or live deployment.

CURRENT EXTERNAL STATUS
Lead delivery / CRM: {args.crm_status}
Analytics / advertising tracking: {args.tracking_status}
Deployment: {args.deployment_status}

REQUIRED BEFORE LAUNCH
1. Confirm a real lead reaches the intended CRM or inbox and that failed responses do not redirect to success.
2. Verify GTM, GA4, advertising conversions, consent, and raw-PII exclusion as applicable.
3. Test the full form, thank-you route, brochure download, phone links, privacy link, and responsive layouts on the final domain.

This archive is a locally packaged handoff unless the statuses above explicitly say otherwise.
{('EVIDENCE WARNING: ' + ' | '.join(evidence_warnings)) if evidence_warnings else ''}
"""
        (staging / "START-HERE.txt").write_text(start_here, encoding="utf-8")

        if output.exists():
            output.unlink()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(staging.rglob("*")):
                if not path.is_file():
                    continue
                arcname = path.relative_to(staging.parent).as_posix()
                archive.write(path, arcname)
                manifest.append({"path": arcname, "bytes": path.stat().st_size, "sha256": sha256(path)})

    with zipfile.ZipFile(output) as archive:
        bad_member = archive.testzip()
        if bad_member:
            raise SystemExit(f"ZIP integrity failed at: {bad_member}")

    result = {
        "archive": str(output),
        "bytes": output.stat().st_size,
        "files": len(manifest),
        "sha256": sha256(output),
        "manifest": manifest,
        "warnings": evidence_warnings,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
