# Community Landing Page Builder Handoff

## Checkpoint

This is the first repository checkpoint for the community-focused fork of Landing Pages 2.0. It is intentionally committed as a new folder so the existing `branded-lead-funnel-builder` working copy and `README-BOHDAN.md` remain untouched.

The user wants a skill that a business owner with little or no AI, landing-page, hosting, or analytics experience can use from one prompt. A business website URL must be sufficient. The default result is a strong local landing page, not a mandatory brochure, CRM, D1 database, reporting stack, tracking setup, deployment, backup system, or Git workflow.

## Read first

1. `skills/community-landing-page-builder/SKILL.md`
2. `docs/community-landing-page-builder/COMMUNITY-LITE-DECISIONS.md`
3. `docs/community-landing-page-builder/PAGE-BUILDER-SKILL-GAP-AUDIT.md`
4. `docs/community-landing-page-builder/BYRIDER-VISUAL-AUDIT.md`
5. `skills/community-landing-page-builder/references/design-direction.md`

The full gap audit explains every adopted, simplified, conditional, and rejected capability. The visual audit records the failures that produced false passes in the earlier Byrider run.

## Main product changes

- The default path now produces a researched, branded local page with one honest conversion action and real visual QA.
- Brochure, CRM, Cloudflare, tracking, deployment, backup, recovery, and handoff are optional modules.
- The entrypoint was reduced to 149 lines and about 2,000 words.
- The default process uses one compact strategy brief, one material-claim ledger, one copy master, and an image plan only when images require it.
- No API key, MCP server, GitHub account, private ad account, hosting credential, or analytics ID is needed for a local final.
- A fresh acceptance pass is required after source changes. Measurements and broad pass booleans are not visual approval.
- Blue Mountain is now an active conversion-architecture benchmark, while Clean Slate is an execution-quality benchmark. Neither is a clone target.
- The design brief must separate verified source colors from the applied interface palette and explain color proportions.

## New deterministic gates

- `scripts/scan_surfaces.py` blocks U+2014, U+2013, their HTML equivalents, unresolved template markers, and selected stale text.
- `scripts/validate_page.py` checks the lightweight page contract without forcing a brochure, modal, thank-you page, or backend.
- `scripts/measure_page.mjs` tests mobile, tablet, laptop, short-height laptop, and desktop. It checks primary-action visibility, consent/chat overlap, content-bearing image crops and collisions, footer spacing, modal focus containment, console errors, network errors, and responsive overflow.
- `scripts/validate_catalogue_review.py` requires page-specific evidence for every selected brochure page.
- `scripts/copy_parity.py` no longer normalizes prohibited long-dash characters into ASCII and thereby hides a violation.

## Visual rules added from the Byrider audit

- Classify every image by role and mark information-bearing images explicitly.
- Never use destructive cover cropping on a diagram, roadmap, screenshot, document, or infographic.
- Never overlay copy on image labels or on a person's face or essential subject.
- Keep the primary action visible at 1280 x 600.
- Prevent consent, chat, and sticky UI from covering the H1, CTA, form action, legal links, or final content.
- Use real footer layout gaps rather than whitespace separators.
- Use asset-specific image review evidence.
- Separate official proof from generated illustration.
- Review repeated section composition, duplicate facts, oversized proof imagery, actual guide previews, and the full success state.
- Block pages that remain technically sound but clearly read as a legacy brochure, an enlarged logo palette, or an audience-inappropriate design.
- Do not use generic condensed headings, negative letter spacing, broad saturated bands, hard offset shadows, badges, and rule-heavy grids as an unexamined bundle.

## Tracking retained as an optional module

The GTM builder remains in the new skill. It creates the two-event contract:

- `customer_data_ready` for consented, destination-normalized SHA-256 email and phone values;
- `lead_accepted` for the confirmed receipt and transaction ID.

Google is the primary schema target. Meta and Microsoft use their own hash maps and still require destination-specific live verification. Raw contact data is blocked from analytics. Sensitive-category mode blocks enhanced customer data while allowing ordinary provider conversions when configured.

## Test status at this checkpoint

- Skill Creator validation: pass.
- Community core unit tests: pass.
- Full skill Python suite: 65 tests pass after adding GTM coverage.
- Fork repository Python suite: 140 tests pass.
- New browser harness: real Chromium pass at all five required viewport classes with zero failures and zero warnings on its fixture.
- Focused optional Cloudflare UI tests affected by template punctuation cleanup: 33 tests pass.
- Full optional Cloudflare suite was not used as a release gate in the temporary copied fixture because tests that depend on parent skill scripts and concurrent browser servers do not run correctly from that partial fixture. The focused affected tests pass, and the original advanced module suite remains available in a correctly installed project.

## Independent Byrider acceptance run

Task: `01a0b4bf-b4c5-73b2-8497-a826709bae38`

The task received only the new skill path and a plain request to build Byrider from `https://go.byriderfranchise.com/`. It was explicitly forbidden from reading prior Byrider outputs, audits, sibling skills, or this conversation.

Observed behavior before this checkpoint:

- selected the page-only default without prompting;
- excluded brochure, CRM, tracking, deployment, and live submission;
- chose the verified franchise-development phone line as the honest primary action;
- used first-party images and documented investment caveats;
- passed static and five-viewport browser checks;
- performed a separate pixel review instead of self-approving the measurements;
- found and fixed two Lighthouse accessibility defects;
- found and fixed a figure-label boundary issue during asset-specific review;
- reached Lighthouse 100 for performance, accessibility, and best practices, with about 1.35 second LCP, zero CLS, and zero TBT;
- started a fresh independent acceptance review.

The independent run completed with no reported technical blockers or warnings. Its own final reviewer approved the page, and Lighthouse ended at Performance 99, Accessibility 100, and Best Practices 100. The user then rejected the dated visual direction. The preserved evidence is in `docs/community-landing-page-builder/acceptance/byrider-run-1/` and is classified as a functional pass with a visual-age failure. Do not rewrite that first output to force a pass.

### Design feedback after the first build

The user confirmed that the earlier placement, image, and overlap fixes worked, but rejected the page's visual age. The run used Byrider's exact official blue `#215EAC` and orange `#FF8200`, then combined them with a custom midnight, warm cream, condensed type, clipped corners, rule-heavy rails, and broad saturated bands. That treatment was defensible as brand extraction but not strong enough as a current design direction.

This is recorded as a skill failure because the default workflow did not actively load Blue Mountain, did not distinguish structural from visual references, and did not ask the final reviewer to block an outdated aesthetic. The new design reference corrects those instructions. The completed first run remains useful evidence for functional behavior but no longer qualifies as final visual acceptance for the revised skill.

## Continuation checklist

1. Wait for the independent task to complete.
2. Inspect its final artifacts and acceptance report.
3. Preserve the first result as evidence of the visual-age failure.
4. Run a second context-free Byrider build against the revised skill in a clean task.
5. Copy both result summaries and representative screenshots into `docs/community-landing-page-builder/acceptance/`.
6. Update the decision checklist only from observed evidence.
7. Rerun `quick_validate.py`, the skill Python suite, and the core browser fixture.
8. Commit the revised skill and acceptance evidence separately.
9. Do not edit or overwrite `README-BOHDAN.md`.
10. Do not fold unrelated dirty files from the original builder into these checkpoint commits.

## Current external status

- No client page was deployed.
- No live lead was submitted.
- No Cloudflare or ad account was connected.
- No existing GitHub changes were intentionally included in this checkpoint.
