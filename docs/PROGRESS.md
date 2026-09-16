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

### Follow-on portability fix

B08 is now fixed for newly prepared copy contexts: research, manifest and funnel-contract evidence uses project-relative paths. Three regressions first failed on the previous implementation and now pass, covering relocation without the original directory, changed relocated evidence, and rejection of evidence pointing into a different project. Legacy absolute contexts work in their original project and receive an explicit refresh requirement after relocation. All **55 repository Python tests** passed after this change; the earlier 202-test combined run remains the onboarding baseline.

### Fresh-machine CI acceptance

[GitHub run 35134975849](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35134975849) passed on a fresh Ubuntu runner at code revision 946fa11. It ran **206 regressions** (55 root Python, 14 evidence, 40 image, 97 application) and generated a new fictional project from source. The generated project passed 72 browser checks, 28 real local form/CRM checks, 118 layout checks and all three PDF renders. Its mobile Lighthouse median was 100, with LCP approximately 980 ms, CLS 0 and TBT 0.

The first Linux integration attempt failed at the performance-audit step. The fix added an explicit browser profile restricted to a marked synthetic loopback fixture under CI; normal client audits keep their default sandbox behavior. Redacted failure stage/code is now retained, and missing measurements still fail. The subsequent complete run passed. No live Cloudflare deployment was involved.

The verified source has been synchronized into both the global and project skill installations (119 files each). The development goal remains active.

### Still open

- M0's supported end-user environment decision remains provisional; these helpers provide a macOS/Linux local profile.
- Independent installed-copy UI/journey testing and fresh Linux CI now pass. These do not replace first-time human beta acceptance. The owned local reset was verified to retain the prior SQLite state privately and restore exactly three seeded contacts/nine visits.
- M2 content/reference/parity work and M3 durable orchestration/portable handoff remain open.
- No Cloudflare client page was deployed, no paid exact-model image request was made, and no remote restore was performed.
- The three first-time human acceptance sessions have not happened.

Use README-BOHDAN.md for remaining engineering details. Fixed/mitigated items are identified there; unverified live capabilities remain open.
