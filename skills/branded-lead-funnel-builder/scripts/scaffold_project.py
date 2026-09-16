#!/usr/bin/env python3
"""Create a non-destructive branded lead-funnel project scaffold."""

from __future__ import annotations

import argparse
import json
import html
import shutil
from pathlib import Path


DOCS = {
    "RESEARCH-BRIEF.md": "# Research Brief\n\n## Sources\n\n## Client facts\n\n## Reference-page findings\n\n## Open questions\n",
    "CLAIM-LEDGER.md": "# Claim Ledger\n\n| Claim | Exact source | Retrieved | Confidence | Approved? | Required qualifier | Locations |\n|---|---|---|---:|---|---|---|\n",
    "REFERENCE-PAGE-COMPARISON.md": "# Reference Page Comparison\n\n| Position | Visible pattern | Persuasive job | Evidence | Objection | CTA behavior | Client adaptation |\n|---|---|---|---|---|---|---|\n",
    "BUYER-PSYCHOLOGY.md": "# Buyer Psychology\n\n## Audience\n\n## Desired after-state\n\n## Internal monologue\n\n## Buying criteria\n",
    "OBJECTION-MAP.md": "# Objection Map\n\n| Objection | Fear or cost | Evidence | Page location | Status |\n|---|---|---|---|---|\n",
    "DESIGN-SYSTEM.md": "# Design System\n\n## Brand evidence\n\n## Color\n\n## Typography\n\n## Imagery\n\n## Components\n",
    "SECTION-COPY.md": "# Section Copy\n\n## H1\n\n## Primary CTA\n\n## Follow-up promise\n\n## Sections\n",
    "COPY-GATE-CHECKLIST.md": "# Copy Gate Checklist\n\n| Requirement | Status | Evidence |\n|---|---|---|\n",
    "FORM-SCHEMA.md": "# Form Schema\n\n| Step | Field | Type | Required | Options | Reason |\n|---|---|---|---|---|---|\n",
    "QA-REPORT.md": "# QA Report\n\n| Gate | Status | Evidence | Warnings |\n|---|---|---|---|\n",
}


def write_if_missing(path: Path, content: str) -> bool:
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--client", default="")
    parser.add_argument("--website", default="")
    parser.add_argument("--reference", action="append", default=[])
    parser.add_argument("--static-only", action="store_true", help="Omit Workers/D1/CRM when explicitly requested")
    parser.add_argument("--with-github", action="store_true", help="Optionally include a GitHub Actions workflow; Cloudflare publishing does not require GitHub")
    args = parser.parse_args()

    root = args.project_root.expanduser().resolve()
    skill_root = Path(__file__).resolve().parents[1]
    created: list[str] = []

    for relative in (
        "assets/brochure",
        "assets/fonts",
        "assets/images/optimized",
        "assets/reviews",
        "build",
        "docs",
        "research",
        "screenshots",
    ):
        path = root / relative
        path.mkdir(parents=True, exist_ok=True)

    web_root = root if args.static_only else root / "public"
    web_root.mkdir(parents=True, exist_ok=True)
    config = {
        "schema_version": 3,
        "quality": {"complete_workflow": True, "browsers": ["chromium", "webkit"], "performance": {"minimum_score": 90, "lcp_ms": 2500, "cls": 0.1, "tbt_ms": 200}},
        "images": {"enabled": True, "preferred_model": "gpt-image-2.5-sunburst", "max_generated_assets": 3, "max_attempts_per_asset": 2},
        "client": {
            "name": args.client,
            "website": args.website,
            "phone_display": "",
            "phone_uri": "",
            "region": "",
            "privacy_url": "",
        },
        "reference_urls": args.reference,
        "audience": "",
        "search_intent": "",
        "offer": "",
        "cta": "",
        "follow_up_promise": "",
        "brochure_gated": True,
        "form_fields": json.loads((skill_root / "assets/cloudflare/src/site-config.json").read_text())["formFields"] if not args.static_only else [],
        "webhook_url": "" if args.static_only else "/api/leads",
        "backend": {"provider": "none" if args.static_only else "cloudflare-d1", "response_contract": "receipt-v1"},
        "analytics": {"mode": "consent", "timezone": "UTC", "conversion": "measured visitor with accepted lead"},
        "tracking": {"gtm": "", "ga4": "", "google_ads": "", "meta": ""},
        "publish_target": "static-handoff" if args.static_only else "cloudflare-workers",
    }
    if write_if_missing(root / "funnel.json", json.dumps(config, indent=2) + "\n"):
        created.append("funnel.json")

    for name, content in DOCS.items():
        if write_if_missing(root / "docs" / name, content):
            created.append(f"docs/{name}")

    if not args.static_only:
        template = skill_root / "assets" / "cloudflare"
        excluded = {"node_modules", ".wrangler", ".secrets", ".git", ".venv", ".development", "build", "screenshots", "__pycache__"}
        for source in sorted(template.rglob("*")):
            relative = source.relative_to(template)
            if relative.parts[0] == ".github" and not args.with_github:
                continue
            if not source.is_file() or any(part in excluded for part in relative.parts) or source.name.startswith((".dev.vars", ".env")):
                continue
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                shutil.copy2(source, target)
                if args.client and target.suffix == ".html" and relative.parts[0] == "public":
                    target.write_text(target.read_text().replace("Your business", html.escape(args.client)))
                created.append(str(relative))
        for name in ("check_gates.py", "copy_parity.py", "measure_funnel.mjs", "extract_brand.mjs", "validate_funnel.py", "workflow.py", "workflow_progress.py", "workflow_storage.py", "release_state.py", "copy_library.py", "image_workflow.py", "optimize_images.py", "package_handoff.py", "portable_handoff.py"):
            source = skill_root / "scripts" / name
            target = root / "scripts" / name
            if source.exists() and not target.exists():
                shutil.copy2(source, target)
                created.append("scripts/" + name)
        site_config = root / "src" / "site-config.json"
        if site_config.exists() and "src/site-config.json" in created:
            value = json.loads(site_config.read_text())
            value["name"] = args.client or "Your business"
            site_config.write_text(json.dumps(value, indent=2) + "\n")
        for relative in ("assets/brochure", "assets/fonts", "assets/images/optimized", "assets/reviews"):
            (web_root / relative).mkdir(parents=True, exist_ok=True)
        write_if_missing(root / "START-HERE.md", """# Your Cloudflare funnel

Your public page, brochure, admin CRM, API, leads and visitor/conversion records are published together on Cloudflare. Workers serves the application and D1 stores the data. GitHub, Supabase, Netlify and a separate analytics account are not required.

## Resume work

Ask the agent to run `python3 scripts/workflow.py resume .` and continue from the reported evidence and next action. This reuses existing valid local checks; it does not publish or create a new image request. An uncertain external operation must be inspected before any retry.

## Build and preview

Use Node.js 22.19+, run `npm ci`, `npm run setup`, then `npm run dev`. Marketing files live in public/. Finish client configuration, browser testing and visual review before publishing. The local admin password is in .secrets/local-admin-password.txt.

## Publish to Cloudflare

Tell the agent: “Publish this funnel to Cloudflare.” It handles the setup and publishing commands for you. Connect Cloudflare once if needed and provide the intended account/domain; a workers.dev address can be used before a custom domain is ready.

After copy approval, the agent reuses your existing explicit setup/publishing instruction and runs `npm run setup -- --cloudflare --site <site-name> --account-id <account-id> --admin-username <owner> --authorization-file <private-message-file> --authorization-message-id <conversation/message-reference>` (plus `--domain leads.example.com` if chosen), completes the final evidence checks against that configuration, records your final publish approval, then runs `npm run publish`. This preserves the two review points (copy and finished funnel), without an extra generic permission question. This provisions/binds the D1 database, applies schema migrations, sets up admin access and publishes the page, CRM and API to the same Cloudflare account. Production uses its own generated password. The agent then verifies the live page, admin, lead receipt and reporting.

The first account connection and domain ownership cannot be skipped. After those are configured, publication is one guided action; the user does not have to operate several hosting/database products.

## Optional source backup

Use GitHub only if requested. `npm run github -- --repo owner/repository` is an optional source backup and is not a publishing dependency. An optional GitHub Actions workflow is included only when the scaffold uses --with-github.

Never share .secrets/, .dev.vars or local .wrangler data. Production admin access is handed over separately from source files.
""")

    target_js = web_root / "script.js"
    source_js = skill_root / "assets" / "multistep-lightbox.js"
    if source_js.exists() and not target_js.exists():
        shutil.copy2(source_js, target_js)
        created.append(str(target_js.relative_to(root)))

    print(json.dumps({"project_root": str(root), "created": created, "web_root": str(web_root), "backend": config["backend"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
