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

[GitHub run 35151867088](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35151867088) passed at revision ad371b1, including the actual generated demo and its resume step. Both installed skill copies match all 132 distributed files. The installed helper also inspected the verified demo successfully and now lists its individually verified local gates in the completed-work summary.

### Remaining scope

This is the local progress/resumption layer of B18, not its full completion. Setup/deployment/verification operation journals, reliable remote retries, immutable release evidence, running version/database reconciliation and current-credential handling remain in B03/B04/B18. The existing publisher must not be blindly rerun to refresh a status. Portable handoff and the remaining live/human acceptance requirements also remain open. The full goal stays active.

## Guarded publishing and release evidence — 16 September 2026

### Implemented

- The publisher freezes the reviewed source, linked handoff artifacts, canonical copy and sanitized actual approval provenance into a sealed per-release package. Live snapshots and CRM/tracking/deployment reports are separate; historical QA is never relabeled as fresh live evidence.
- New-release prerequisites check current private credentials, synthetic fixture/selectors, actual Chromium availability, non-skipped tests and pinned Wrangler before remote mutation. First-deployment secrets join the code upload; later releases retain existing remote secrets and check current owner login first.
- Durable release phases and a real process lock support resumption. An uncertain upload is inspected for the original release marker, version and D1 binding instead of uploaded again. Runtime metadata is checked before credentials and after the journey.
- Completed journeys recover missing derived report writes without another form submission. Possibly submitted leads retain their request key/receipt and block repetition. A changed active version cannot inherit an older version's verification even when its release/source markers are unchanged.
- Workflow progress now recognizes validated saved release proof and newer unpublished source changes. Local status explicitly does not query Cloudflare; the guarded publisher's resume performs that check.
- Bohdan's B03/B04/B18 notes and the publishing/resumption guides describe implemented behavior and the remaining boundaries.

### Verification

The combined local command passed **319 regression tests**: 118 repository Python, 19 evidence, 40 image, 18 catalogue and 124 application tests, with no application skips. Added coverage includes actual OS-lock inheritance after parent interruption, archive relocation/sealing, live/handoff separation, evidence reconstruction and tampering, initial upload/secret ordering, missing browser, current private credential references, provider/runtime mismatch and bounded recovery. Cloudflare responses and approval preconditions in publishing protocol tests are explicitly synthetic; these are not launch evidence.

An independent offline forward test found and confirmed fixes for three defects: verified resume resetting the compatibility summary to pending, a replacement active version reusing older proof, and interrupted derived-report writes stranding a completed journey. Its seven final scenarios passed without provider/account calls or canonical-source edits.

A fresh generated demo (`.development/release-pilot`) passed 72 browser checks, 28 real local form/CRM checks, 118 layout checks and three PDF renders. Mobile Lighthouse median: 100, LCP about 930 ms, CLS 0, TBT 0. The demo resumed with valid report reuse and remained nonpublishable. Representative desktop page, short mobile modal and thank-you captures were inspected; this was not a complete client visual approval. Wrangler's local dry-run built the Worker/assets and recognized D1, assets and version-metadata bindings. No account deployment occurred.

### Still open

B03/B04/B18 are **partial**, not closed. Remaining work includes receipt-based continuation after partial live journeys, explicit superseding of failed/read-only releases, setup journals, uncertain migration/origin/legacy reconciliation, automatic current-password handoff after CLI recovery and actual deployed rotation/recovery acceptance. B07 portable distribution, the real authorized Cloudflare pilot, privacy/retention work, exact image-route acceptance and first-time human sessions also remain open. No existing client page was deployed and no paid image request was made. The development goal stays active.

### Fresh Linux verification and distribution

[GitHub run 35157137154](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35157137154) passed on the published code revision `1bfd65b`, including the regression suites and a newly generated local funnel with its actual PDF, D1, CRM, browser and performance checks. Both skill installations were synchronized and checksum-verified (136 files each). The older manual live-record guide now routes through guarded publishing as well. This is fresh-machine local acceptance, not a real Cloudflare account pilot.

## Resuming partial verification journeys — 16 September 2026

### Implemented

- Version-2 journey journals bind the actual source, snapshot, fixture, origin, release identity and cleanup scope. Exact synthetic form/visit requests are kept in private files; public evidence contains hashes/IDs, redacted paths and aggregate metrics. No passwords or browser sessions are saved in the journal.
- Lost acknowledgements retry the same original request and idempotency/event key. Completed browser redirect/brochure evidence is reused without another submission or measured visit. Reporting dates and the original baseline stay fixed.
- CRM status recovery compares the persisted version before acting, and preserves concurrent edits. Verification notes use an optional stable request ID supported by the real backend, preventing duplicate notes/activity after lost responses or concurrent retries.
- Cleanup retains validated receipt/CRM/reporting evidence before removing the test contact. A later run can confirm that the same contact is already removed, complete verification and preserve the historical metric impact.
- Current source is checked before and after full verification; stale source cannot inherit an earlier browser pass. Reports provide safe, specific diagnoses for concurrent edits and missing/changed private payloads. String-valued scope flags are rejected.
- Guarded publication resumes the existing approved journey instead of allocating another test attempt. Individual run reports are retained. Fresh independent demo QA runs use unique output directories so they preserve earlier journals.

### Verification

The combined local command passed **331 tests**: 118 repository Python, 19 evidence, 40 image, 18 catalogue and 136 application tests. Focused scope-flag tests passed after the final input validation adjustment. Nine added recovery cases exercise an actual loopback Chromium/Worker/D1 fixture, including lost form/visit/note/status responses, stale source, concurrent edits, cleanup and private-file tampering. Successful recovered reports pass the Python artifact/evidence validator; database queries confirm one stored lead, one measured event and one note. This fixture tests brochure routing/header behavior; PDF rendering is covered by the separate generated demo.

An independent forward test passed eight targeted cases, including real SIGKILL before receipt journaling and after public browser completion. It found and confirmed fixes for stale-source false success, interrupted-cleanup recovery and missing conflict diagnoses. The agent made no canonical-source edits or external account calls.

A freshly generated full demo passed 72 browser checks, 27 actual local form/CRM checks, 118 layout checks and all three real PDF renders. The local_journey and rendered_copy gates were recorded, current browser/performance evidence was reused, and the project stayed explicitly nonpublishable. Its new journey report uses a unique directory. No new full client visual approval is claimed for these backend/recovery changes.

### Still open

This closes the implemented version-2 partial-journey path within its bounded three-run policy, not all of B03/B18. Legacy/missing private state, unfinished submissions crossing a reporting-day boundary, exhausted budgets, unconfirmed migrations/origins and replacing failed/read-only releases still need reconciliation work. Setup journals, portable distribution, account recovery handoff, privacy/retention, an authorized real Cloudflare pilot and first-time human acceptance remain open. No client page was deployed or paid image request made. The full development goal remains active.

### Fresh Linux verification and installed copies

[GitHub run 35159042423](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35159042423) passed on code revision `66818bc`, including all regression jobs and the complete freshly generated local funnel. Both skill installations are checksum-verified at 140 files. This confirms fresh-machine local acceptance; no Cloudflare account deployment or real customer data was involved.

## Owner identity and password recovery — 17 September 2026

### Implemented

- Added migration 0004 with a nullable D1 owner username and recovery-operation marker. Existing identities/passwords remain unchanged by migration; explicit identity changes override bootstrap configuration and survive Worker restarts/redeployment bindings.
- One supported owner helper handles username changes, password resets, session revocation and resumption. It pins the account/database, shares the publishing process lock, retains a private intent before mutation and applies an expected-version change. Child commands inherit the lock; isolated tests acquire their own project's lock instead of trusting a parent project's descriptor.
- A lost command response is reconciled by reading the operation ID, version, identity and hash back from D1. Resumption reuses the original password/intent; a newer account change prevents the pending operation from overwriting it.
- Confirmed recovery updates the private credential reference consumed by publishing. Local and production references stay separate and are destination-bound. Rename carries a password only when it matches the authoritative hash; otherwise it records an explicit missing-current-password state.
- Missing or corrupt old handoff files no longer disable password recovery. An explicitly supplied current-credential reference survives interrupted rename. No passwords, hashes or provider output appear in normal command output.
- Local verification follows recovered owner credentials. An owned demo reset privately archives its old database, owner references/operations and journey request files, then returns to the initial local account. Restore guidance now applies missing migrations before using the current owner tools.
- Updated B04/B06, setup guidance and the owner-maintenance guide. Existing sites must deploy the current Worker after the additive migration before using D1-backed username changes; a legacy Worker does not gain that behavior from migration alone.

### Verification

The combined local command passed **344 checks**: 120 repository Python, 19 evidence, 40 image, 18 catalogue and 147 application tests. Focused owner tests also passed after the final malformed-reference tolerance adjustment. Actual local Worker/D1 tests cover old-login/session rejection, first-use rename, UI rotation, CLI recovery, stale bootstrap settings after Worker restart, uncertain writes, interrupted private handoff, current-password loss, newer account changes and local/production isolation. The real local Wrangler recovery and SQL backup round-trip also passed, including the inherited-lock environment case.

Independent review confirmed that migration/maintenance preserved seeded CRM rows and legacy login, and found two gaps: dependence on a lost old credential file and loss of an explicit credential reference on resume. Both were fixed and all three targeted independent retests passed. This used only synthetic local resources.

A fresh demo was renamed to `demo-owner` and password-reset using the actual local CLI. Full verification then used its recovered private reference and passed 72 browser checks, 27 form/CRM checks, 118 layout checks and three PDF renders; Lighthouse median was 100 (LCP about 930 ms, CLS 0, TBT 0). An actual reset preserved the old private state, removed active old references/operations, and passed a new browser/form/CRM/PDF run with the initial owner. The second run intentionally did not repeat layout/performance measurements. No new client visual approval is claimed for these account/backend changes.

### Still open

B06's local implementation is verified; B04/B06 still need the real Cloudflare rotation/rename/redeployment acceptance in B19. Infrastructure restore/first-upload edge cases and resumed pre-upload checks remain separate. Portable distribution, privacy/retention, remaining publication reconciliation and first-time human acceptance remain unfinished. No existing client page or real account was changed, no live Cloudflare launch was performed and no paid image call was made. The development goal stays active.

### Fresh Linux verification and distribution

[GitHub run 35161627115](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35161627115) passed on code revision `651bb45`, including all regression jobs and the complete newly generated local funnel. Both skill installations are checksum-verified at 142 files. This is fresh-machine local verification of the updated account/runtime flow, not a Cloudflare account deployment or owner cutover.

## Portable Worker handoff implementation — 17 September 2026

### Implemented

- Version-2 ZIPs place unchanged project source beneath `project/`, with wrapper instructions and a manifest outside the source fingerprint. Fixtures, image plans, canonical copy inputs, research and catalogue authoring assets retain relative paths.
- The collector follows declared evidence links and includes standard unregistered reports, so an interruption between producing and registering QA does not lose that work. Public journey journals/results retain their linked evidence; private request bodies, credentials and runtime databases stay out.
- Approval messages/unrelated workflow fields become minimal hash/provenance records. Publication approvals and active deployment pointers become historical data. Extraction marks publication context pending, and the publisher blocks provider calls until current scope is reconciled from an actual user instruction. Existing valid authorization should be reused, not requested again.
- Integrity verification covers file inventory, hashes, source identity, safe relative paths, regular-file permissions, collisions, size limits and consistent scope labels. Extraction uses a new directory; failed packaging preserves previous output. Recognized credential/export/database content is rejected. Catalogue inputs that still rely on original absolute asset paths fail explicitly.
- History survives another export. Packaging keeps unfinished work explicitly unfinished. It does not perform a deployment, authenticate the sender, transfer live customer data, or recreate private recovery state.
- The full fictional demo now performs an automatic in-progress ZIP/extract round trip. Newly executed browser/layout/performance reports are explicitly registered, avoiding stale manifest entries on repeated demo checks.

### Verification

The combined local suite passed **360 checks**: 135 repository Python, 19 evidence, 40 image, 18 catalogue and 148 application tests. The 15 new handoff cases cover relocation with the original source directory unavailable, real copy-audit preservation, reviewed-format protocol fixtures, private-data exclusion, source/evidence drift, unregistered QA, repeated transfer, unsafe/corrupt ZIPs and previous-file preservation. A publisher regression proves an imported pending context makes zero runner/provider calls.

Independent review transferred the actual fictional demo, retained valid source/QA with original-path access denied, and tested second transfers, archive swaps, unsafe paths and publication boundaries. It found a misleading reviewed-scope label and loss of an unregistered performance report; both were fixed and independently retested. The recipient now registers the transferred real performance report. No remaining defect appeared in those tested cases.

A new full demo passed 72 browser checks, 27 local form/CRM checks, 118 layout checks, three PDF renders and the automatic archive/extract check. Lighthouse median was 100 (LCP about 929 ms, CLS 0, TBT 0). Its source fingerprint and verified gates survived extraction. It remained a nonpublishable **in-progress** fictional handoff, with incomplete editorial/visual/catalogue-review gates visible. Synthetic validator-passing fixtures do not constitute real creative review.

### Still open

B07's core format and integrity/resumption behavior are implemented. Its full acceptance still requires a genuinely fully reviewed fictional creative build to be transferred and resumed on another supported machine. Private access, live database restoration and unresolved account operations remain separate secure/reconciled handovers. The legacy static-only ZIP path has not gained Worker workflow portability. Remaining privacy/retention, publication reconciliation, real Cloudflare and first-time-human acceptance work stays open. No client page was deployed and no real approval or paid image call was invented. The goal remains active.

### Fresh Linux verification and distribution

[GitHub run 35164662704](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35164662704) passed on code revision `ac6ff01`, including all regressions, the freshly generated full local funnel and its in-progress archive/extract check. Both skill installations are checksum-verified at 143 files. This is fresh-machine local portability evidence; the actual sample's unfinished creative reviews and lack of live-account verification remain explicit.


## Revisitable privacy and explicit attribution policy — 17 September 2026

### Implemented

- A shared accessible Privacy choices dialog remains available from generated landing, thank-you and privacy pages. It supports keyboard/mobile use, focus containment, Escape and focus restoration; a dismissed banner can be reopened from the page footer.
- Measurement and enquiry attribution have separate settings. `analytics.attribution_mode` supports `consent` (new default), `lead` (independent origin details) and `disabled`. The public Worker policy endpoint, actual server enforcement and visitor wording use the same configuration. Default-on measurement is described as already on, with an effective opt-out.
- DNT/GPC overrides both optional measurement and lead-origin capture. Withdrawal clears the visitor ID and consent-gated session touches, aborts pending measurement where possible, rejects late acknowledgements and propagates across tabs. A functional allow/deny cookie lets the server discard stale optional fields. Already received data remains subject to separate retention/erasure operations.
- Regrant creates a new browser identity, shared by existing tabs, with a distinct event per page visit. The old per-field form cache is removed. Missing/disabled attribution displays Unknown rather than falsely implying Direct.
- Contact details and request identity remain stable during an uncertain retry, while newly disallowed optional metadata is removed. Legacy saved fingerprints still return the original receipt for the same normalized enquiry; changed contact details still conflict. Missing privacy settings do not block actual form delivery.
- Preflight requires the privacy assets and script on all three public pages. Browser verification now opens the dialog at three sizes in Chromium and WebKit, checks focus/reachability and saves screenshots. The live/local journey checks the public policy endpoint and shared assets.

### Review findings addressed

Real browser checks caught keyboard focus escaping on Safari-engine Tab navigation. The dialog now owns its complete focus cycle. Independent forward QA and the expanded regression both reproduced a second issue: regrant in two tabs created separate renewed visitor IDs and inflated the unique-browser count. Successful storage removal now releases stale in-memory state, and the shared ID is seeded before the consent event wakes another tab. Independent retesting confirmed coherent visit/lead correlation and the corrected unique count.

A slow-response regression also caught loss of a permitted pending visit when default-on measurement gained attribution consent. Only revocation now invalidates pending measurement; the permissive choice preserves its eventual acknowledgement. These changes were driven by actual failures, not a replacement of the configured reporting definition.

### Verification

The final combined local regression suite passed **377 checks**: 135 repository Python, 19 evidence, 40 image, 18 catalogue and 165 application tests, with no skips. Ten actual privacy browser/Worker cases cover desktop/mobile choice changes, cross-tab regrant and two enquiries, ambiguous accepted responses, DNT/GPC, independent attribution, disabled capture, server denial enforcement, unavailable settings and legacy receipt compatibility. Client regressions also exercise unwritable storage and late visit acknowledgements.

The final source-consistent fictional demo passed **96 browser checks**, **31 form/CRM/reporting checks**, **118 layout checks**, copy parity, three PDF renders and the archive/extract round trip. Local mobile Lighthouse median was **100**, with LCP about **1360 ms**, CLS **0** and TBT **0 ms**. The current desktop/390px/320px privacy captures were inspected; the short dialog scrolls internally to keep its actions reachable. This privacy inspection does not claim the unfinished fictional build has full editorial/creative approval.

Independent QA exercised a 14-case privacy matrix plus WebKit mobile and the two-tab enquiry/reporting scenario. The final exact-hash two-tab rerun confirmed the corrected identity relationships. Its four visits/two enquiries yielded two unique identity periods (before withdrawal and after regrant), with one renewed identity shared by both tabs. Evidence stays in local synthetic test artifacts; no customer data is checked in.

### Remaining scope

B14 is implemented locally. The actual client must still have truthful configured privacy content and a chosen attribution policy. B15 retention/permanent erasure remains open: changing a choice does not erase an accepted lead and CRM removal remains a soft delete. Live Cloudflare, physical-device, exact-image-model and first-time independent-user acceptance remain separate unfinished work. No client page was deployed, real contacts used, approval invented or paid image call made. The development goal remains active.


### Fresh Linux verification and distribution

[GitHub run 35167608010](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35167608010) passed on code revision `8b0fae6`, including all regression jobs and the complete freshly generated local funnel. Both installed skill copies are checksum-verified at **146 files**. This confirms repeatable local setup and privacy behavior on macOS/Linux; it is not live Cloudflare or first-time-human acceptance. The next data-lifecycle implementation order is recorded under B15 in Bohdan's handoff.
