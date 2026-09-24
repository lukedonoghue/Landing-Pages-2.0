#!/usr/bin/env python3
"""Create a non-destructive branded lead-funnel project scaffold."""

from __future__ import annotations

import argparse
import json
import html
import shutil
from pathlib import Path


MARKER = "<!-- WORKFLOW_TEMPLATE_INCOMPLETE: replace this template with researched content before advancing. -->\n\n"

DOCS = {
    "RESEARCH-BRIEF.md": "# Research Brief\n\n" + MARKER + "## Sources\n\n## Client facts\n\n## Reference-page findings\n\n## Open questions\n",
    "CLAIM-LEDGER.md": "# Claim Ledger\n\n" + MARKER + "| Claim | Exact source | Retrieved | Confidence | Approved? | Required qualifier | Locations |\n|---|---|---|---:|---|---|---|\n",
    "REFERENCE-PAGE-COMPARISON.md": "# Reference Page Comparison\n\n" + MARKER + "| Position | Visible pattern | Persuasive job | Evidence | Objection | CTA behavior | Client adaptation |\n|---|---|---|---|---|---|---|\n",
    "BUYER-PSYCHOLOGY.md": "# Buyer Psychology\n\n" + MARKER + "## Audience\n\n## Desired after-state\n\n## Internal monologue\n\n## Buying criteria\n",
    "OBJECTION-MAP.md": "# Objection Map\n\n" + MARKER + "| Objection | Fear or cost | Evidence | Page location | Status |\n|---|---|---|---|---|\n",
    "DESIGN-SYSTEM.md": "# Design System\n\n" + MARKER + "## Brand evidence\n\n## Color\n\n## Typography\n\n## Imagery\n\n## Components\n",
    "SECTION-COPY.md": "# Section Copy\n\n" + MARKER + "## H1\n\n## Primary CTA\n\n## Follow-up promise\n\n## Sections\n",
    "COPY-GATE-CHECKLIST.md": "# Copy Gate Checklist\n\n" + MARKER + "| Requirement | Status | Evidence |\n|---|---|---|\n",
    "FORM-SCHEMA.md": "# Form Schema\n\n" + MARKER + "| Step | Field | Type | Required | Options | Reason |\n|---|---|---|---|---|---|\n",
    "IMAGE-RESEARCH.md": "# Image Research\n\n" + MARKER + "## Search queries and sources\n\n## Candidate inventory\n\n## Identity and provenance checks\n\n## Placement coverage\n\n## Generation decision and gaps\n\n## Rejected candidates\n",
    "QA-REPORT.md": "# QA Report\n\n" + MARKER + "| Gate | Status | Evidence | Warnings |\n|---|---|---|---|\n",
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
    parser.add_argument("--profile", choices=["lead_inbox", "static_action"], help="Select from the confirmed visitor journey, not from available credentials")
    args = parser.parse_args()
    if args.profile:
        if args.static_only and args.profile != 'static_action':
            parser.error('--static-only conflicts with --profile lead_inbox')
        args.static_only = args.profile == 'static_action'

    root = args.project_root.expanduser().resolve()
    from runtime_context import skill_root as resolve_skill, bundle_runtime
    skill_root = resolve_skill(__file__)
    created: list[str] = []

    for relative in (
        "assets/brochure",
        "assets/fonts",
        "assets/images/optimized",
        "assets/reviews",
        "build",
        "docs",
        "research",
        "research/reviews",
        "screenshots",
    ):
        path = root / relative
        path.mkdir(parents=True, exist_ok=True)

    reader_guide = not (args.static_only and not args.profile)
    web_root = root if args.static_only and not args.profile else root / "public"
    web_root.mkdir(parents=True, exist_ok=True)
    config = {
        "schema_version": 3,
        "quality": {"complete_workflow": True, "contract_version": 2, "reader_guide_version": 1 if reader_guide else 0, "control_review": True, "browsers": ["chromium", "webkit"], "performance": {"minimum_score": 90, "lcp_ms": 2500, "cls": 0.1, "tbt_ms": 200}},
        "approvals": {"copy_before_design": False},
        "images": {"enabled": True, "preferred_model": None, "max_generated_assets": 3, "max_attempts_per_asset": 2},
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
        "catalogue": {"enabled": True, "config": "build/guide.json", "output": "public/assets/brochure/service-guide.pdf"},
        "product_mode": "static-only" if args.static_only else "form-crm",
        "form_fields": json.loads((skill_root / "assets/cloudflare/src/site-config.json").read_text())["formFields"] if not args.static_only else [],
        "webhook_url": "" if args.static_only else "/api/leads",
        "backend": {"provider": "none" if args.static_only else "cloudflare-d1", "response_contract": "receipt-v1"},
        "analytics": {"mode": "disabled", "attribution_mode": "lead", "required_attribution_mode": "lead", "timezone": "UTC", "conversion": "accepted lead"},
        "privacy": {"consent_ui": "disabled"},
        "tracking": {
            "gtm": {"container_id": "", "hostname": ""},
            "customer_data_mode": "disabled",
            "sensitive_category": False,
            "google_ads": {"conversion_id": "", "conversion_label": "", "enhanced_conversions": False},
            "meta": {"pixel_id": "", "enabled": False},
            "microsoft": {"uet_tag_id": "", "enabled": False},
        },
        "requested_hosts": {"public": "", "crm": "", "pages_gateway": ""},
        "publish_target": "static-handoff" if args.static_only else "cloudflare-workers",
    }
    if write_if_missing(root / "funnel.json", json.dumps(config, indent=2) + "\n"):
        created.append("funnel.json")

    for name, content in DOCS.items():
        if write_if_missing(root / "docs" / name, content):
            created.append(f"docs/{name}")

    structure = {
        "schema_version": 1,
        "reference_url": args.reference[0] if args.reference else "",
        "sections": [],
        "instructions": "Map the complete buyer journey; section count follows the research and reference coverage rather than a preset number."
    }
    if write_if_missing(root / "build" / "page-structure.json", json.dumps(structure, indent=2) + "\n"):
        created.append("build/page-structure.json")

    fidelity = {
        "schema_version": 1,
        "sources": args.reference,
        "reference_sections": [],
        "coverage": [],
        "comparison": {},
        "instructions": "Inventory every reference/client-page section and media moment, map its final treatment, and compare perceived completeness before check-build."
    }
    if write_if_missing(root / "build" / "reference-fidelity.json", json.dumps(fidelity, indent=2) + "\n"):
        created.append("build/reference-fidelity.json")

    guide = json.loads((skill_root / "assets" / ("reader-guide.example.json" if reader_guide else "catalogue.example.json")).read_text())
    guide["brand"]["name"] = args.client or "Your business"
    if write_if_missing(root / "build" / "guide.json", json.dumps(guide, indent=2) + "\n"):
        created.append("build/guide.json")

    confirmation = {"schema_version": 1, "main_page": "public/index.html", "output": "public/thank-you.html", "confirmed_headline": "", "follow_up": "", "guide_title": "", "guide_summary": "", "download_label": "Download your guide"}
    if write_if_missing(root / "build" / "thank-you.json", json.dumps(confirmation, indent=2) + "\n"):
        created.append("build/thank-you.json")

    # Reviews are optional evidence, but the normalized schema is available from the start.
    # Do not create a fake manifest: the researcher copies the example only when a real
    # review source has been identity-matched.
    review_example = skill_root / "assets" / "review-manifest.example.json"
    review_target = root / "references" / "review-manifest.example.json"
    review_target.parent.mkdir(parents=True, exist_ok=True)
    if review_example.exists() and write_if_missing(review_target, review_example.read_text(encoding="utf-8")):
        created.append("references/review-manifest.example.json")

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
        for name in ("ship.py", "ship_ui.py", "guide_image_handoff.py", "runtime_context.py", "control_review.py", "capture-control.mjs", "guide.py", "guide_ui.py", "workflow_runner.py", "static_publish.py", "copy_acceptance.py", "native_routing.py", "check_gates.py", "copy_parity.py", "measure_funnel.mjs", "extract_brand.mjs", "rendered_fonts.mjs", "modal_chrome.mjs", "validate_funnel.py", "build_gtm_container.py", "workflow.py", "workflow_progress.py", "workflow_storage.py", "process_contract.py", "release_state.py", "copy_library.py", "image_workflow.py", "optimize_images.py", "review_workflow.py", "validate_reviews.py", "package_handoff.py", "portable_handoff.py"):
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

The form already uses this built-in CRM. You do not need to choose an external CRM, create a Google Sheet, supply GTM or configure advertising conversions before the page can collect leads. Those are optional later connections.

## Publish with guidance

Ask your coding assistant to prepare publishing. Open `python3 scripts/ship.py --operator --ui` yourself in a trusted local terminal. The wizard asks for your domain and owner email, handles routine checks, and resumes after interruptions. Google Sheets is optional. Do not put production credentials into chat.

## Resume work

Ask the agent to run `python3 scripts/workflow.py resume .` and continue from the reported evidence and next action. This reuses existing valid local checks; it does not publish or create a new image request. An uncertain external operation must be inspected before any retry.

## Build and preview

Use Node.js 22.19+, run `npm ci`, `npm run setup`, then `npm run dev`. Marketing files live in public/. Finish client configuration, browser testing and visual review before publishing. The local admin password is in .secrets/local-admin-password.txt.

Complete `build/guide.json` from the researched client facts, set `workflow_ready` to `true`, and run `python3 scripts/build_guide.py .`. Read references/reader-guide-quality.md. This builds the researched, illustrated guide and its real cover preview. Complete build/thank-you.json and run `python3 scripts/thank_you_page.py .` to reuse the main page with a post-submission hero. Record the actual all-page reader review, then run `python3 scripts/build_guide.py . --check`. A missing, placeholder, unrendered or undelivered guide blocks final QA unless `funnel.json` records a source-supported catalogue omission.

## Publish to Cloudflare

Tell the assistant: “Prepare this page for the guided publishing wizard.” The assistant finishes local checks and gives you one launcher. Run `python3 scripts/ship.py --operator --ui` in your own trusted terminal. Enter your domain and owner email, sign in to Cloudflare if needed, then follow the single current card. Keep Google Sheets off unless you need it.

The standard wizard uses a custom domain in your selected Cloudflare account and the built-in D1 CRM. It prepares hosting separately from publication, preserves your final approval, saves a database recovery bookmark, publishes through the existing guarded release engine, verifies one labelled synthetic enquiry and permanently erases that test contact. Closing the window does not discard progress; reopening the same project resumes it. The optional Google setup opens only when selected. Account MFA/ownership confirmations are clearly labelled when they cannot be checked automatically.

Do not paste passwords or tokens into chat or this browser form. Private password and Google handoffs open locally on your computer. Separate CRM/public domains, external-DNS gateways and workers.dev-only destinations use the advanced publishing guide rather than being silently changed by the standard wizard. Outside the standard production wizard, a workers.dev address is the default for the existing basic publishing path, so a custom domain can still wait when that path is intentionally chosen. A code rollback does not undo a database migration.

## Optional source backup

Use GitHub only if requested. `npm run github -- --repo owner/repository` is an optional source backup and is not a publishing dependency. An optional GitHub Actions workflow is included only when the scaffold uses --with-github.

Never share .secrets/, .dev.vars or local .wrangler data. Production admin access is handed over separately from source files.
""")

    # PDF delivery is part of every ordinary page build, including explicit
    # static-only projects. CRM/runtime helpers remain conditional above.
    for name in ("build_catalogue.py", "build_guide.py", "build_reader_guide.py", "guide_quality.py", "thank_you_page.py", "runtime_context.py", "render_catalogue_cover.py"):
        source = skill_root / "scripts" / name
        target = root / "scripts" / name
        if source.exists() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            created.append("scripts/" + name)
    font_source = skill_root / "assets" / "pdf-fonts"
    font_target = root / "assets" / "pdf-fonts"
    for source in sorted(font_source.glob("*")):
        if source.is_file() and not (font_target / source.name).exists():
            font_target.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, font_target / source.name)
            created.append("assets/pdf-fonts/" + source.name)

    # Carry the complete instruction/reference/template context outside public.
    if not args.static_only or args.profile:
        bundle_runtime(skill_root, root)

    # Keep controller metadata and reference evidence outside the public assets.
    if args.profile == 'static_action':
        for source in sorted((skill_root / 'scripts').glob('*')):
            if source.is_file() and source.suffix in {'.py', '.mjs'}:
                target = root / 'scripts' / source.name
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    shutil.copy2(source, target)
        for name in ('package.json', 'package-lock.json', '.node-version'):
            source = skill_root / 'assets/cloudflare' / name
            target = root / name
            if not target.exists():
                shutil.copy2(source, target)
        write_if_missing(root / 'START-HERE.md', '# Your guided static page\n\nMarketing files live in public/. Owner tools and guide state never belong there. Ask the active agent to resume the guide. The static publisher uses an explicitly selected existing Cloudflare Pages project, no Worker/D1/CRM. Account setup and publication require separate actual authority.\n')

    for rel in ('config/routing.json', 'assets/guide/questions.json', 'assets/guide/index.html', 'assets/guide/app.js', 'assets/guide/style.css', 'references/control-comparison.md', 'references/control-layout.json', 'references/guided-workflow.md', 'references/guided-ship.md', 'references/guided-publishing.md', 'references/review-intelligence-and-testimonials.md'):
        source = skill_root / rel
        target = root / rel
        if (not args.static_only or args.profile) and source.is_file() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    if not args.static_only or args.profile:
        # control_review.reference() also works when helpers live in project/scripts.
        import sys
        sys.path.insert(0, str(skill_root/'scripts'))
        import control_review
        write_if_missing(root/'references'/'control-reference.json', json.dumps(control_review.reference(), indent=2)+'\n')

    if not args.static_only:
        # Fresh projects inherit the same credential boundary as the reusable
        # repository. Existing operator policies are never overwritten here.
        import sys
        sys.path.insert(0, str(skill_root/'scripts'))
        import agent_security
        for rel, body in {'.claude/settings.json':json.dumps(agent_security.claude_settings(),indent=2)+'\n',
                          '.codex/config.toml':agent_security.codex_config()}.items():
            target=root/rel
            if target.is_symlink() or target.parent.is_symlink():
                raise ValueError('Refusing a symlinked agent policy. Preserve and reconcile it before scaffolding.')
            target.parent.mkdir(parents=True,exist_ok=True)
            if write_if_missing(target,body):created.append(rel)

    target_js = web_root / "script.js"
    source_js = skill_root / "assets" / "multistep-lightbox.js"
    if source_js.exists() and not target_js.exists():
        shutil.copy2(source_js, target_js)
        created.append(str(target_js.relative_to(root)))

    print(json.dumps({"project_root": str(root), "created": created, "web_root": str(web_root), "backend": config["backend"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
