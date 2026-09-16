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

## Reference handling and required local journey — 16 September 2026

### Implemented

- B09: bounded client/reference collection with separate roles, project-local reference analysis, source/review freshness checks and explicit primary-reference status.
- New references do not need global library curation. If no curated example suits the actual client, preparation keeps the real brief and reports that limitation instead of forcing a different offer.
- Reference sources cannot substantiate client claims. Reference brand leakage, unanchored lessons, changed review/source files and invalid source roles are tested.
- B02: complete Worker funnels now require a local_journey gate before publication approval. It checks an actual loopback browser execution, named login, redirect/PDF, correlated receipt/visit, persisted CRM updates, numeric reporting evidence and logout.
- Valid read-only/failed verification attempts cannot leave old successful derived gate files at the same output location.
- The browser verifier now waits for real image completion when WebKit rejects decode early, while still failing broken rendered images.

### Verification

The bounded collection helper actually fetched the official [Cloudflare Workers](https://www.cloudflare.com/developer-platform/products/workers/) and [Netlify platform](https://www.netlify.com/platform/) pages into an ignored local pilot directory. A separate agent read those saved sources, prepared a grounded copy-only brief and anchored reference analysis, then ran preparation and relocation checks. The primary reference remained explicit even with zero curated matches, relocation produced identical context, edited relocated evidence was rejected, and all nine library files remained unchanged. This was a text/context exercise, not a visual design review, client copy approval or publication.

The actual local demo completed 72 browser checks and 28 form/CRM checks, and its new local_journey report was successfully recorded and independently validated against the receipt, event, HTTP and dashboard artifacts. The marker still prevents demo publication.

The combined local regression command passed **222 tests**: 65 repository Python, 19 evidence-gate, 40 image and 98 application tests. A controlled real WebKit test covers a delayed image whose decode method rejects early and a truly broken image.

[GitHub run 35140605873](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35140605873) passed at code revision ffbc86c, including the fresh generated local demo and automatic recording of its local_journey evidence. Both skill installations have been synchronized. Approved-copy-to-rendered-output parity (B10), complete stage/resume orchestration and the remaining live/account/human acceptance items are still open.


## Approved wording through assembly — 16 September 2026

### Implemented

- B10: complete Worker funnels require a rendered_copy gate for page, modal, thank-you and brochure wording. It compares actual 1440px/390px browser states with the canonical master, recomputes the result when recording/checking a gate, and rejects stale source, master, capture or PDF artifacts.
- The capture opens native disclosures, supports reviewed custom interaction selectors, reads every form step, checks the visible brochure link and compares the served PDF bytes with the local asset. Its default mode sends zero form/analytics writes. Authored placeholders/options are included, while entered values are excluded.
- Full new brochure text is part of the copy review before approval. A genuinely supplied final PDF can instead be approved as an inspected immutable asset. Neither comparison nor a fictional fixture creates a user approval.
- Added the operating guide and automatic capture/comparison/recording to the synthetic quickstart. Older demos missing the new contract are detected before starting a server or adding a lead, with existing files/data preserved.
- Typography normalization supports case, whitespace, inline emphasis and common smart punctuation. Only recognized page-number lines/suffixes are excluded; additional prices, percentages and claims still fail.

### Executed verification

The new generated local demo passed 72 Chromium/WebKit checks, 28 real form-to-CRM checks, 118 layout checks, all three PDF renders and the new recorded copy comparison. The original run exposed a footer/page-number extraction case, which was corrected narrowly and regression-tested. The three PDF pages and representative desktop/mobile page, modal and thank-you screenshots were inspected: complete, readable wording and usable controls; the short-height modal scrolls. This remains a fictional deterministic test design, not a completed client design.

An independent agent rehearsed the documented path in an isolated copy on a static loopback server. All 12 captured states and the three-page served PDF matched. Adding an unsupported guaranteed-price claim caused comparison and gate recording to fail at both widths; stale evidence also failed. No lead was submitted. That rehearsal did not verify CRM delivery or human approval. It identified missing command arguments in the report and omitted placeholder/option wording; both were addressed with an additional real-browser regression.

The final combined local regression command passed **245 tests**: 83 repository Python, 19 evidence-gate, 40 image and 103 application tests, with no application skips. [GitHub run 35145574358](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35145574358) passed on the fresh Ubuntu runner at revision 95601b2, including the actual generated funnel and recorded rendered_copy/local_journey gates. Both installed skill copies were synchronized and all 124 distributed files match the repository. No Cloudflare client deployment, paid image request or real user approval was performed in this batch.

### Remaining scope

B10 catches text drift; it does not fix B12's PDF overflow/truncation generator, prove raster-image text or every dynamic variant, or replace semantic/visual review. Durable stage/resume state, portable project handoff, the remaining publishing/account/privacy controls and live/human acceptance remain open. The goal stays active.


## Brochure content and layout reliability — 16 September 2026

### Implemented

- B12: replaced silent truncation, fixed-character slicing and discarded list entries with measured text areas, bounded readable font sizes, automatic contents/process/CTA-step pagination, or a field-specific actionable failure. A failed build leaves the existing PDF untouched; successful replacement is atomic.
- Named missing/corrupt images and logos are errors. Deliberate colour-only sections explicitly use `image_mode: none`; typography normalization no longer alters asset filenames. Delivery instructions cannot silently disappear behind contact rows.
- Bundled DejaVu Sans regular/bold from the official 2.37 release, with the original license, download provenance and file hashes. The local doctor verifies those assets. Many Latin/Greek/Cyrillic names survive actual PDF extraction; missing glyphs and unsupported shaping receive explicit errors. This does not claim universal language support.
- Complete business names and service regions are preserved. Contents references account for pagination and now link to the matching service pages. Corrected a faint contents label and added a white QR quiet zone on dark panels.
- Added real-PDF regressions to the unified local checks. Explicit standalone `Page N` navigation labels are treated as neutral PDF UI only within the actual page count; arbitrary bare numbers, prices and percentages remain subject to copy comparison.

### Executed verification

The combined local command passed **264 tests**: 84 repository Python, 19 evidence, 40 image, 18 catalogue and 103 application tests. Catalogue regressions actually generate/extract PDFs, check all word bounds and overlaps, verify contents destinations, preserve long qualifiers/Unicode names, and exercise missing assets, overflow and previous-output protection. QR contrast is checked on a real rasterized page.

The six-page example was rendered and inspected. An independent agent used an unchanged, supplied fictional configuration to build and individually inspect a 13-page brochure. Its initial review found the missing region and low-contrast contents label. After correction, all **111/111 supplied customer-text fields** remained present; the seven encoded links resolved to the correct physical service pages. Changed pages were inspected again, and unchanged pages had identical rendered PNG hashes. It noted sparse image-free/continuation layouts and no outline-sidebar tree as refinement opportunities, not missing-copy blockers. Encoded navigation was verified; no claim is made about manual testing in every PDF viewer.

The refreshed complete local demo passed 72 browser checks, 28 actual form/CRM checks, 118 layout checks, all three PDF renders, and recorded rendered_copy/local_journey gates. No client page was deployed, no paid image request was made, and no user approval was invented. [GitHub run 35148411361](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35148411361) passed at revision a33dd72, including the new actual-PDF regression stage and complete generated demo. Both skill installations match all 129 distributed files. The installed global copy passed its 18 catalogue regressions, and its local doctor reported ready after the normal dependency bootstrap, including actual Chromium/WebKit launch.

### Remaining scope

Fixed-composition overflows still require the agent to adjust a project-specific layout while keeping the approved wording. Complex-script shaping needs an appropriate renderer and its own visual review. Final client PDFs still require inspection of every page and comparison with the canonical approved master. The remaining image-route acceptance, durable workflow/resume, portable handoff, Cloudflare controls and live/human beta acceptance remain open; the goal stays active.


## Durable local progress and resumption — 16 September 2026

### Implemented

- Added evidence-derived `workflow.py status` and local-bookkeeping `resume`, distinguishing research, drafting, editorial review, actual copy approval, design/images, local QA, publishing setup and final review. A status label cannot bypass evidence or approval checks.
- Resume reuses existing successful unregistered reports only when they validate against the current handoff snapshot. It preserves current failed entries instead of substituting an older green report. It does not generate imagery, provision, publish, authenticate or submit a lead.
- Added persistent redacted work checkpoints and observations under build/progress.json, with atomic writes and a local update lock. Concurrent writers retain their events; failed writes, symlinked storage and unsupported history cannot silently replace the current record. Raw approval-message text is omitted from the progress view.
- Pending image attempts and unresolved external checkpoints stay visible. A saved start is explicitly not process liveness. An external checkpoint resolution needs a current artifact of the actual inspection; the note itself never becomes QA or approval proof.
- Unchanged copy approval can be recorded again without deleting an existing final approval record. Material changes and fixture approvals still invalidate publication eligibility.
- Uploaded/unverified and validated legacy live-check reports are distinct from completion. Actual deployed release identity and guarded remote recovery are still incomplete and are stated as such.

### Verification

The combined local command passed **285 tests**: 105 repository Python, 19 evidence, 40 image, 18 catalogue and 103 application tests. The new cases cover actual file-based stage changes, retained approvals, pending generation, valid/stale/failed report reuse, concurrent checkpoint writes, atomic failure recovery, relocation-safe paths, secret/symlink boundaries and refusal to promote bare deployment success flags.

The fresh generated demo passed 72 browser checks, 28 real local form/CRM checks, 118 layout checks and all three PDF renders. Its resume command reused the existing browser, compatibility and performance reports, retained local_journey/rendered_copy gates, and correctly remained in the nonpublishable demo stage. No user approval was synthesized.

An independent agent exercised a fresh scaffold/checkpoint and a relocated copy of that actually verified demo using the documented installed-helper path. It confirmed current source/evidence hashes, no approval creation, no remote actions and preservation of existing files. Its feedback exposed a matching blocked checkpoint only appearing in a secondary field; it now appears in the top-level blocked status/reasons while remaining explicitly an operator note. The copied demo kept valid browser/performance/copy/journey evidence and accurately retained missing client review gates; demo status does not claim a client release is ready.

Fresh CI and installation synchronization are recorded after publishing this batch.

### Remaining scope

This is the local progress/resumption layer of B18, not its full completion. Setup/deployment/verification operation journals, reliable remote retries, immutable release evidence, running version/database reconciliation and current-credential handling remain in B03/B04/B18. The existing publisher must not be blindly rerun to refresh a status. Portable handoff and the remaining live/human acceptance requirements also remain open. The full goal stays active.
