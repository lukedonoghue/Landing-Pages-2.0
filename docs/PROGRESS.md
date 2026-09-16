# Development progress toward the self-guided beta

The goal is active. This is progress on the existing [beta plan](SELF-GUIDED-BETA-PLAN.md), not a declaration that the shared skill is ready for unrestricted client use.

## First implementation batch — 16 September 2026

### Implemented

- Portable local tool doctor covering Python/Node, locked application dependencies, actual Chromium/WebKit launch, PDF rendering/text extraction and WebP optimization.
- Project-local dependency bootstrap, with a private Python environment when needed; no system Python modification or implicit account access.
- One repository regression command, with explicit installed-skill versus full-repository scope and rejection of skipped application tests.
- A deterministic fictional demo built from the actual scaffold, with a real three-page PDF, rendered cover, synthetic CRM records and traffic cohorts.
- Local serve/verify/reset commands. Verification manages its own loopback server. Reset preserves the previous local database privately and rejects a project with remote bindings.
- Explicit demo publication/remote-setup guards and demo-specific starting instructions.
- Focused fixes for B05 (first-use CLI session revocation) and B13 (receipt-based conversion event deduplication).
- The optional generated GitHub deployment workflow is disabled, mitigating B01 until a guarded CI release artifact exists.
- A contributor map and first-run guide, linked from the skill and repository.
- A bounded lazy-image wait in the browser verifier after the new demo exposed a WebKit hang on an off-screen brochure cover.

### Executed locally

- Combined regression run: **202 tests passed**, no application skips (52 root Python, 14 evidence, 40 image, 96 application).
- New demo: **72 Chromium/WebKit checks**, **28 actual local form/CRM checks**, and **118 checks across nine layout sizes** passed.
- Three mobile Lighthouse runs: median **100**, LCP approximately **907 ms**, CLS **0**, TBT **0**, on this local fictional fixture.
- All three PDF pages plus representative mobile page/modal and desktop thank-you renders were inspected. They are readable and intact. The type/color-only PDF is a deterministic test fixture, not a finished client design.
- Python build dependency pins were verified as available through an actual package-resolution dry run.

The earlier **188-test** result in VERIFICATION.md is the original baseline. The new work adds regression coverage; it does not erase the earlier evidence or change its scope.

### Independent first-run feedback

A separate agent installed the skill into a new temporary location and followed its guide. Installed-only doctor, demo creation and the local browser-to-CRM journey passed; rerunning demo preserved a manual HTML edit and existing database counts. It identified two onboarding ambiguities:

1. Bootstrap's --project flag refers to an existing application, while demo's flag selects a new output directory. The error message and guide now explain the correct sequence.
2. The generic generated START-HERE document described real Cloudflare publishing inside a demo. New demos now receive explicit local-only instructions.

The independent agent also inspected the CRM overview/table and ran the installed-skill regression scope successfully. Its snapshot preceded the two documented guidance fixes. Servers and browser resources were closed afterward. This is an independent agent rehearsal on the development host, not the planned three first-time human beta sessions.

### Still open

- M0's supported end-user environment decision remains provisional; these helpers provide a macOS/Linux local profile.
- Fresh-run CI verification of the generated project is being completed with this batch. Independent installed-copy UI/journey testing passed; the owned local reset was verified to retain the prior SQLite state privately and restore exactly three seeded contacts/nine visits.
- M2 content/reference/parity work and M3 durable orchestration/portable handoff remain open.
- No Cloudflare client page was deployed, no paid exact-model image request was made, and no remote restore was performed.
- The three first-time human acceptance sessions have not happened.

Use README-BOHDAN.md for remaining engineering details. Fixed/mitigated items are identified there; unverified live capabilities remain open.
