# Landing Pages 2.0

A reusable, research-led funnel-building skill: client website → approved copy → design and images → verified page, brochure, form and CRM → guided Cloudflare publishing.

**For Bohdan:** [Implementation handoff and remaining work](README-BOHDAN.md) lists the prioritized fixes, exact source files, acceptance tests, and live checks still needed before client rollout. It separates confirmed defects from optional integrations and unverified external setup.

**Next release:** [Self-guided beta plan](docs/SELF-GUIDED-BETA-PLAN.md) defines the end-user journey, proposed scope, implementation milestones, and the first-time-user tests required before sharing the skill more widely.

**Current work:** [Development progress](docs/PROGRESS.md) records implemented improvements, new verification results, and remaining acceptance work.

## What it builds

- A branded responsive landing page, accessible multistep form, brochure PDF and thank-you page.
- A protected mini CRM with named owner login, pipeline, lead table, notes, source attribution, in-app notifications, CSV export and account recovery.
- Daily reporting with date presets, source/device/paid-organic filters, all/unique visits and Count/Rate charts.
- Cloudflare Workers for the site/admin/API and D1 for leads, sessions and reporting. No Supabase, Netlify or GitHub hosting dependency.

The included copy library contains 44 curated primary examples, 27 reviewed supporting variants and 112 annotated passages. Quarantined OCR is available for investigation but excluded from default writing context. Reference examples inform structure and style; they are never evidence for a new client's claims.

## Install and use

Copy `skills/branded-lead-funnel-builder/` into your Codex skills directory, or run `python3 scripts/install_skill.py` from this repository. Then ask:

> Use $branded-lead-funnel-builder for this client website: [URL]. The reference page, if useful, is [optional URL]. Focus on [optional service/audience] and [optional offer]. Draft and review the copy first, then stop for my approval. After approval, build the complete funnel, source or generate suitable imagery, test desktop/mobile and the real lead journey, and present the finished result for final publishing approval.

The two planned review points are **copy approval before design** and **final approval before publishing**. The agent handles the work between them. A missing reference is fine: the library selects suitable patterns. Business promises and proof must still be grounded in the actual client evidence.

## Tool requirements

Use Python 3.10+ and Node 22.19+ (Node 24 recommended). A generated project installs its locked dependencies with `npm ci`. `npx playwright-core install chromium webkit` supplies cross-browser test engines. PDF/image helpers use the available bundled runtime or the dependencies documented by their scripts. Research uses Firecrawl when configured; unavailable source access must be reported.

Image generation uses the available native tool, with source-first planning, bounded retries and explicit provenance. GPT Image 2.5 is the requested family. If the tool does not report its actual model, exact-model verification remains unresolved; the skill cannot silently label a different or unknown model as 2.5. An optional official bundled image CLI route supports an explicit GPT Image 2.5 selection when the user chooses that API route and supplies its connection; it records the exact request and output without putting API credentials in project assets. Generated images are static assets at deployment time, not a live OpenAI dependency for the site.

## Cloudflare publishing

After account connection and project setup, the user says **“Publish to Cloudflare.”** The agent provisions/binds D1, configures admin access, applies migrations, publishes and verifies the resulting URL. Use workers.dev first or an optional custom domain in the intended account. GitHub is optional source backup/version control only.

The publish command requires current quality evidence and the actual final approval. Full post-deployment verification also requires authorization for a controlled synthetic test lead and private admin credentials. Upload success alone is not launch verification.

## Development and verification

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [portable first-run guide](skills/branded-lead-funnel-builder/references/first-run.md). The quickstart can check tools, install local dependencies, generate a fictional page/CRM/PDF demo, verify it end to end, and preserve/reset its local state. It never deploys to Cloudflare.

```sh
python3 scripts/dev.py doctor
python3 scripts/dev.py bootstrap
python3 scripts/dev.py check
python3 scripts/dev.py demo
python3 scripts/dev.py verify-demo --full
python3 scripts/dev.py serve
```

Use Node 24; pass `--node /path/to/node` if the supported runtime is not on PATH. The original individual regression commands remain available:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
python3 skills/branded-lead-funnel-builder/scripts/test_gates.py
python3 skills/branded-lead-funnel-builder/tests/test_image_workflow.py
cd skills/branded-lead-funnel-builder/assets/cloudflare
npm ci
npm test
```

See `docs/VERIFICATION.md` for the actual verification record and limits. Tests use isolated fictional data and mocked remote mutations; no real client lead databases, credentials, local runtime databases or client publishing packages are included.

## Ownership and provenance

This is a private collaboration repository. Original client/source material in the reference library retains its original rights and provenance; inclusion is not an open-source license grant. The implementation adapts workflow lessons from the reviewed page-builder project and CRM reference, without shipping their old Supabase or Apps Script backends. See the skill's integration-provenance reference.
