# Bohdan's implementation handoff — Landing Pages 2.0

**For:** Bohdan / bohdanshev  
**Audit date:** 16 September 2026  
**Code reviewed:** [2f0de96](https://github.com/lukedonoghue/Landing-Pages-2.0/tree/2f0de9602088f5a01c193f64de58ef5f9e2bfbd9)  
**Purpose:** An actionable backlog of fixes, missing integration work, and live acceptance checks. This audit changed documentation only; unchecked items below remain open.

**Execution plan:** [Self-guided beta milestones](docs/SELF-GUIDED-BETA-PLAN.md) groups this backlog into a staged release plan centered on a new user's ability to finish unaided. The supported environment is a pending product decision, not an assumed compatibility promise.

**Progress update:** [The active development record](docs/PROGRESS.md) tracks fixes after this audit. B05, B08, B14, B15 and the browser-session portion of B13 are fixed and tested. B01 is mitigated by disabling optional automatic client deployment. B16 now has a complete generated-funnel CI run; B17 has working local onboarding/tool checks, with agent/account capabilities still checked at their own stages. The detailed findings below preserve the original audit context.

## What we are trying to finish

A user supplies a client website, optionally a reference page, service/audience description and offer. The agent researches, drafts and reviews copy, gets **copy approval**, builds the design and images, tests and iterates the complete funnel, gets **final publishing approval**, then guides publication to Cloudflare.

The deployed page, form API, brochure, thank-you page, protected CRM and visitor/conversion reporting should all run on **Cloudflare Workers + D1**. GitHub is optional source control for generated client projects. Preserve the two planned human checkpoints; reuse existing authorization instead of adding repetitive permission questions.

The repository already contains working components and an installed skill. This is currently an **agent-operated workflow with supporting scripts**, not a standalone application that deterministically turns any URL into a finished site without an agent.

## What is already working

- Responsive page/form/thank-you starter; accepted lead receipts and retry-safe D1 storage.
- Named owner login, protected admin APIs, CRM board/table, stages, notes, account controls and in-app notifications.
- Date presets/custom ranges, visitors/conversions/rates, source/device/traffic filters and CSV export.
- Curated copy library, copy review/approval records, image planning/provenance/optimization, brochure generation and browser/performance tools.
- **188 regression tests passed:** 43 copy/research/approval, 14 evidence, 40 image and 91 application tests. [GitHub verification passed](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35116633622).
- The fictional local funnel passed an actual form → D1-backed CRM → status/note → reporting → logout journey, Chromium/WebKit checks and nine layout sizes. Its three-run local Lighthouse median was 100.
- The installer and fresh scaffold were tested. The generated-project ZIP handoff has separate gaps below; do not confuse the two.

See [VERIFICATION.md](docs/VERIFICATION.md) for exact coverage and limitations. Passing existing tests does not cover every newly identified case in this audit. There has been **no live Cloudflare client deployment**, exact-model paid image API execution, or remote restore rehearsal.

## How to read the backlog

- **P1:** Complete before relying on the affected path for a client launch. An optional path only blocks launch if enabled.
- **P2:** Complete during the first pilot and before a broad client rollout.
- **Confirmed defect:** Code inspection and/or the stated isolated reproduction demonstrates the problem.
- **Integration gap:** Instructions promise a step that is not yet enforced or connected by the helpers.
- **Live verification:** Capability exists locally but needs a controlled real-account test; not evidence it is broken.
- **Decision/optional:** A product choice or additional capability, not automatically a required feature.

Suggested owner for implementation and technical acceptance is **Bohdan**. Luke/client supplies the actual account/domain, approved claims, retention/tracking choices and any optional advertising/notification accounts. Never put passwords, API keys, real leads or raw production exports in this repository.

## Prioritized checklist

| Done | ID | Priority | Work | Classification |
| --- | --- | --- | --- | --- |
| Disabled for beta | B01 | P1 if enabled | Make optional GitHub deployment use the release safeguards | Mitigated; guarded automation still deferred |
| [x] | B02 | P1 | Require the local form-to-CRM journey before publication | Implemented; actual local receipt/visit/CRM/reporting gate verified |
| Partial | B03 | P1 | Finish live evidence registration, release status and deployed identity checks | Release/evidence and partial-journey recovery implemented; pilot and superseding remain |
| Partial | B04 | P1 | Validate publishing prerequisites early and handle changed passwords | Early checks/current references implemented; real redeploy acceptance remains |
| [x] | B05 | P1 | Fix first-use CLI session-revocation race | Fixed; first-use and rotated-account race regression passed |
| Local implementation | B06 | P2 | Make owner username changes consistent and persistent | D1 identity and guarded CLI implemented; live pilot remains |
| Partial acceptance | B07 | P1 for handoff | Make generated-project ZIPs resumable without invalidating evidence | Portable format implemented; full reviewed creative handoff acceptance remains |
| [x] | B08 | P1 for handoff | Make research evidence portable across machines/directories | Fixed for newly prepared contexts; relocated legacy contexts need a truthful refresh |
| [x] | B09 | P1 | Support a new external reference page without editing the global library | Implemented; real capture, independent preparation and relocation verified |
| [x] | B10 | P1 | Enforce approved-copy parity across page, modal, thank-you and PDF | Implemented; real desktop/mobile/PDF capture and drift rejection verified |
| [ ] | B11 | P1 when generating | Resolve the exact image-model path and run it once | Live verification / default-path gap |
| [x] | B12 | P2 | Prevent brochure truncation, overflow and silent missing assets | Implemented; measured layouts, pagination and actionable failures verified |
| [x] | B13 | P1 for ad tracking | Deduplicate conversion events by receipt, including lost-response retries | Fixed for recent receipts in the browser session; provider adapter deduplication remains B23 |
| [x] | B14 | P1 | Add persistent privacy choices and define attribution-consent behavior | Implemented locally; client policy and live/physical acceptance remain |
| [x] | B15 | P1 before real leads | Complete enquiry erasure and configurable retention | Implemented locally; client periods, provider recovery history and live cutover remain separate |
| [x] | B16 | P2 | Run a reproducible complete generated funnel in CI | Implemented; fresh Linux CI passed the full local journey |
| Local profile ready | B17 | P2 | Add a dependency doctor and complete clean-machine setup | macOS/Linux local tools verified; account/agent capabilities remain separate |
| Partial | B18 | P2 | Make workflow progress and safe resumption durable | Local state plus guarded release journal; full remote reconciliation remains |
| [ ] | B19 | P1 before live claims | Run the first controlled Cloudflare deployment | Live verification |
| [ ] | B20 | P2 | Rehearse remote backup, restore and recovery | Live verification |
| [ ] | B21 | P2 | Validate physical mobile behavior and deployed performance | Live verification |
| [ ] | B22 | P2 | Add useful redacted diagnostics and an operator runbook | Operations gap |
| [ ] | B23 | Optional | Complete and verify requested advertising/webhook integrations | Optional integration |
| [ ] | B24 | Before rollout | Resolve reporting, export, spam and client-setup choices | Decisions / known limits |

## Detailed work items

### B01 — Optional GitHub deployment bypasses the guarded publishing path

**P1 when GitHub deployment is enabled · Confirmed defect**

The generated project's optional workflow directly applies remote migrations and runs Wrangler deploy. It bypasses the normal approval/evidence checks, production-secret setup and post-deployment verification. This is the template copied by the scaffold's GitHub option; the repository's own verification-only CI does not deploy.

**Work:** Route every supported deployment entry point through the same release rules, or disable the optional deployment workflow until it can meet them. A fresh CI checkout also lacks the ignored build directory containing approval/evidence records, so replacing one command with the publish script is insufficient. Design a revision-bound reviewed release artifact or another explicit, trusted transfer of the required nonsecret release state. Install browsers and reject skipped tests.

**Done when:** Missing/stale approval or evidence results in zero remote mutations; the reviewed revision is the deployed revision; expected existing secrets are checked; full authorized live verification runs; partial uploads are reported as incomplete.

**Files:** [optional deployment workflow](skills/branded-lead-funnel-builder/assets/cloudflare/.github/workflows/deploy.yml#L19), [publishing driver](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish.mjs#L7), [generated ignore rules](skills/branded-lead-funnel-builder/assets/cloudflare/.gitignore).

### B02 — The required local submission test is not a handoff gate

**P1 · Integration gap**

The skill instructs the agent to test the real local submission journey. However, required handoff gates do not include that journey. Browser compatibility checks deliberately block writes, and CRM/tracking/deployment gates are only required in live mode. A project can therefore satisfy the enforced pre-publication gate list without its actual local form saving a lead.

**Work:** Add a required local-journey gate, bound to the current source, using the existing real verifier. Require accepted receipt and visit correlation, stored contact, named admin access, stage/note persistence, reporting and logout.

**Done when:** A broken lead endpoint, missing journey report, read-only report or mocked acknowledgement blocks final-publish eligibility. A genuine local D1/browser run passes. Add negative regression coverage.

**Files:** [required gates](skills/branded-lead-funnel-builder/scripts/check_gates.py#L200), [approval checks](skills/branded-lead-funnel-builder/scripts/workflow.py#L55), [journey verifier](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs#L68).

### B03 — Complete the live evidence and publication-state lifecycle

**P1 · Partial implementation; live acceptance remains**

The guarded publisher now seals reviewed source/handoff evidence and actual approval scope per release, keeps separate live snapshots/reports, validates CRM/tracking/deployment artifacts and records prepared, migrated, uploaded, verification-failed and verified states. Completed result files regenerate missing derived reports after interruption. The compatibility summary clears verification_pending after valid complete evidence. Progress distinguishes saved verification from current provider inspection and newer unpublished local changes.

Identity comes from pinned Wrangler deployment/version inspection (account, Worker, fully active version and actual D1 binding), matched against runtime release/version/source markers before credentials and after the journey. A replacement version preserving source/release variables cannot reuse older verification. Offline protocol and actual local runtime tests cover this behavior; account/API compatibility still needs B19.

**Recovery update:** version-2 source-bound journey journals retain exact private synthetic requests, fixed reporting dates and per-run evidence. Lost form/visit acknowledgements reuse the same idempotency/event key; completed browser proof is retained, status updates reconcile their expected version, notes use stable IDs and cleanup can finish after the test contact was already removed. Actual source is checked before/after verification. Conflict/private-state diagnoses are redacted and actionable. Real loopback tests and independent interruption tests cover this; live Cloudflare acceptance remains separate.

**Remaining:** real authorized pilot; explicit replacement of failed releases/frozen read-only scope; legacy release migration and uncertain origin/migration reconciliation. Define safe continuation after the three-run limit and reporting-day-boundary interruptions. Preserve history and never reset IDs or blindly resubmit/redeploy.

**Done when:** a controlled publish has coherent final status and valid release evidence; interrupted verification resumes without another deployment or duplicate lead; wrong revision/database is detected; historical approval evidence stays intact.

**Files:** [driver](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish-driver.mjs), [sealed evidence](skills/branded-lead-funnel-builder/scripts/release_state.py), [provider/runtime inspection](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/release-tools.mjs), [verifier](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs).

### B04 — Detect verification prerequisites before publishing

**P1 · Partial implementation; rotation/recovery redeploy acceptance remains**

New-release checks now validate current credential structure, fixture schema and actual selector parsing, launch Chromium, require complete non-skipped application tests and check pinned Wrangler before remote mutation. Invalid target overrides are rejected before inspection, including resume. Initial secret/password mismatch blocks migrations; secrets join the first upload rather than a later bulk call.

The publisher accepts current private credential/password files and saves a private reference. It checks login/session for existing guarded deployments before migration/upload and retains remote secrets on later releases. Confirmed CLI recovery now updates a destination-bound private reference automatically; UI password changes still need their current private file supplied because a browser cannot update the local filesystem. The bootstrap file is intentionally retained as initial configuration.

**Update:** recovery keeps one sealed private intent, applies a version-checked D1 change, reconciles lost responses and updates the current reference only after readback. Local and production references are separate. Tests cover UI-rotated credentials, CLI recovery, uncertain writes, interrupted private handoff, concurrent changes and a Worker restart with stale bootstrap identity.

**Remaining:** run both rotation paths through actual Cloudflare redeployment/verification; test resumed pre-upload operations and infrastructure restore/first-upload paths with changed runtime/credentials. Local acceptance is not a live account pilot.

**Done when:** invalid prerequisites cause no remote mutations; redeployment after UI rotation and CLI recovery verifies using current credentials; missing browsers cannot produce a green release through skipped tests.

**Files:** [preconditions](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish-driver.mjs), [credential helpers](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/release-tools.mjs), [password rotation](skills/branded-lead-funnel-builder/assets/cloudflare/src/admin-operations.js), [recovery output](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs).

### B05 — CLI session revocation has a first-use race

**P1 · Fixed; current version-checked recovery SQL retains regression coverage**

The original CLI revocation SQL only incremented an existing credential-version row. A new owner who has never rotated their password has no such row. A login that read version zero before revocation can insert a valid session after the deletion and survive the revoke operation.

This sequence was reproduced with the shipped SQL in isolated in-memory SQLite. The authenticated API revocation implementation already handles the first-use row correctly; do not rewrite it as though it has the same defect.

**Work:** Make the CLI also create/advance the credential version atomically for a first-use owner, aligned with the API behavior.

**Done when:** A concurrency regression proves that a login that captured the old credential version before CLI revocation cannot create a valid session afterward, for both new and previously rotated accounts.

**Files:** [CLI recovery SQL](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs#L22), [login version guard](skills/branded-lead-funnel-builder/assets/cloudflare/src/worker.js#L40), [working API revocation](skills/branded-lead-funnel-builder/assets/cloudflare/src/admin-operations.js#L26).

### B06 — Owner username changes need one supported procedure

**P2 · Implemented and locally verified; Cloudflare acceptance remains in B19**

Migration `0004_owner_identity.sql` adds a nullable D1 owner identity and recovery operation marker without changing existing accounts. `admin-account.mjs change-username` preserves the password, advances the credential version and revokes old access. D1 becomes authoritative for the changed identity, so neither the original Worker secret nor private bootstrap configuration restores the old username on redeployment. Setup now names the supported command.

The same helper rotates passwords and revokes sessions using a pinned account/database, a private retained intent, an inherited process lock and expected-version comparison. It reads the completed operation back before updating the publisher's private current-credential reference. A lost command response or interrupted local handoff resumes the original operation; a newer account change is preserved. Missing current passwords become an explicit credential blocker. Local maintenance never overwrites the production reference.

**Evidence:** actual local Worker/D1 login/session tests, a Worker restart using stale bootstrap configuration, UI password rotation followed by rename/recovery, lost-response/failure/handoff tests and the real local Wrangler recovery/backup round-trip. No actual Cloudflare redeployment has been claimed.

**Done when:** the supported identity change also passes B19 on an authorized real deployed destination, with old access rejected and the new identity surviving redeployment. Preserve bootstrap files as initial configuration; do not recommend a competing manual Worker-secret rename.

**Files:** [owner tool](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs), [identity migration](skills/branded-lead-funnel-builder/assets/cloudflare/migrations/0004_owner_identity.sql), [authentication](skills/branded-lead-funnel-builder/assets/cloudflare/src/security.js), [recovery guide](skills/branded-lead-funnel-builder/references/admin-access-and-recovery.md).

### B07 — Portable generated-project handoffs

**P1 · Core implementation verified; full creative handoff acceptance remains**

Version-2 Worker handoffs put `project/` beneath wrapper-only instructions/manifest metadata. Source bytes/fingerprints survive extraction. The collector retains root fixtures/plans, canonical copy inputs, research, minimal approval provenance, progress, registered and standard unregistered QA, linked artifacts and nonsecret sealed release history. Catalogue inputs use local relative paths. The demo authoring configuration is retained as well.

Private runtime directories, credentials/recovery payloads, database files and raw contact/session exports are excluded or rejected. Approval-message text and unrelated workflow state are omitted. Publication approvals/pointers become historical records; imports require current user/account context before publishing. This is not a new routine permission question when the user has already supplied valid scope. Checksum/inventory checks are not sender authentication.

Verification rejects unsafe paths, symlinks, case/Unicode collisions, inconsistent reviewed labels, corrupted files, source drift and oversized archives. Extraction uses a new directory. A failed export preserves the previous output. An unfinished build can be shared with explicit `--in-progress` status; it never becomes reviewed merely through packaging.

**Evidence:** copy-audit round trip with the original directory unavailable; reviewed-path synthetic protocol regressions; actual fictional demo source/QA relocation and repeated history transfer; unregistered performance evidence consumed by recipient resume; privacy and hostile-archive tests; independent review. The full demo now automatically performs an in-progress ZIP/extract check in the existing CI flow.

**Remaining acceptance:** complete a genuinely fully reviewed fictional creative build (including its editorial, visual and catalogue reviews), transfer it to another supported machine, and execute its resumed workflow. The current real demo transfer deliberately preserves incomplete creative gates; validator-passing synthetic fixtures are not that creative acceptance. Live private credentials/data and unresolved account operations remain a separate secure/reconciled handover, linked to B18/B19/B20. The legacy static ZIP path has not gained Worker workflow portability.

**Files:** [Worker packaging entry](skills/branded-lead-funnel-builder/scripts/package_handoff.py), [portable format/verifier](skills/branded-lead-funnel-builder/scripts/portable_handoff.py), [approval state](skills/branded-lead-funnel-builder/scripts/workflow.py), [handoff guide](skills/branded-lead-funnel-builder/references/qa-and-handoff.md).

### B08 — Research evidence is tied to the original filesystem location

**P1 for collaboration/handoff · Reproduced defect**

The copy context stores absolute research/funnel paths and later reads those original paths. An unchanged copied project failed its previously passing copy audit when the original research location was unavailable, even though the copied research was present.

**Work:** Use project-relative evidence paths with controlled resolution and content hashes. Treat historical source locators separately from required readable evidence. Include relocation tests.

**Done when:** Moving/cloning/unpacking a project and removing the original location does not break a valid copy audit. Editing a relocated source still correctly invalidates its evidence.

**Files:** [copy context paths](skills/branded-lead-funnel-builder/scripts/copy_library.py#L40), [context creation](skills/branded-lead-funnel-builder/scripts/copy_library.py#L93), [evidence lookup](skills/branded-lead-funnel-builder/scripts/copy_library.py#L152).

### B09 — A new user-supplied reference page needs a project-local path

**P1 · Integration gap**

The structured copy preparation helper rejects a primary reference URL unless it is already an eligible curated library source. The client-site collector's extra-page option only accepts the client's domain. An agent can research another page manually, but the advertised arbitrary-reference workflow lacks a complete supported path through these helpers.

**Work:** Add capture, inspection and provenance for a project-local external reference. Extract persuasive structure and lessons while keeping the new client's factual claims separate. Do not require modifying the global training library or silently substituting a different reference. Separately ship or clearly document library maintenance tooling; its README currently points to build/curation scripts in the original workspace.

**Done when:** A fresh clone handles a new client plus a never-before-seen external reference URL, without Luke's original workspace or changes to held-out/training partitions. An unavailable reference produces a clear, scoped fallback.

**Files:** [reference eligibility](skills/branded-lead-funnel-builder/scripts/copy_library.py#L107), [client collection boundary](skills/branded-lead-funnel-builder/scripts/copy_project.py#L64), [library maintenance instructions](skills/branded-lead-funnel-builder/references/copy-library/README.md#L15).

### B10 — Bind rendered wording to the approved copy

**P1 · Implemented and locally verified**

**Update:** Complete Worker releases require `rendered_copy` evidence. The capture reads actual desktop/mobile landing, all modal steps, thank-you and served PDF; the gate recomputes comparison against the canonical master and checks source/artifact freshness. Full generated-brochure text is required before copy approval; genuinely supplied PDFs remain byte-bound. Actual browser regressions cover disclosures, hidden mobile qualifiers and zero POSTs in read-only mode. The generated demo passes the comparison and existing full local journey. Visual/editorial review remains required; B12's generator limitations remain open. See [the operating guide](skills/branded-lead-funnel-builder/references/rendered-copy.md) and [current progress](docs/PROGRESS.md).

Original finding:

Copy checks validate the structured master, brief and editorial review. The page validator checks selected CTA/link conditions, but does not compare all assembled HTML/PDF wording with the approved master. The reference guide requires this comparison as agent work, without a mandatory comparison artifact. This permits assembly drift unless the reviewer catches it.

**Work:** Add a required rendered-copy comparison covering claims, qualifiers, offer, CTA, form promise, thank-you wording and brochure text. Normalize legitimate layout/typography differences; retain human/agent editorial and visual judgment.

**Done when:** Changing a rendered claim, removing a qualifier or altering the follow-up promise while leaving the master unchanged blocks release. The same applies to PDF text. An unchanged approved draft does not require another human approval just because its comparison was rerun.

**Files:** [copy audit](skills/branded-lead-funnel-builder/scripts/copy_library.py#L145), [page validation](skills/branded-lead-funnel-builder/scripts/validate_funnel.py#L168), [manual comparison instruction](skills/branded-lead-funnel-builder/references/copy-workflow.md#L72).

### B11 — Resolve the exact GPT Image model route

**P1 when image generation is required · External verification / default-path gap**

Native generation worked in the local exercise and produced an actual image. Its tool result did not identify the model. The strict GPT Image 2.5 gate therefore correctly remained unresolved. The optional official CLI path prepares an exact model request and validates output evidence, but has only offline tests; the helper itself does not execute generation.

**Work:** Confirm the currently available supported model/account route and perform one authorized real request. Record actual request/output provenance, optimize the result and review its desktop/mobile placement. Define the honest default when native generation cannot attest the model: use suitable sourced imagery, the configured exact-model API route, or a real user-approved exception. Never fabricate model identity or silently waive the requirement.

**Done when:** One complete generation → file registration → optimization → rendered review → image gate succeeds with truthful provenance. Test unavailable credentials/model, exhausted retry budget and restart recovery. Public assets contain no keys.

**Needs:** Image API access only if using the explicit API route; no new live dependency for the Cloudflare site.

**Files:** [image preparation/registration](skills/branded-lead-funnel-builder/scripts/image_workflow.py#L329), [model review restriction](skills/branded-lead-funnel-builder/scripts/image_workflow.py#L497), [image workflow](skills/branded-lead-funnel-builder/references/image-workflow.md).

### B12 — Brochure generation must preserve approved content

**P2 · Implemented with explicit layout/language limits**

**Update:** The builder no longer slices names/summaries, adds ellipses or drops excess items. It measures text, wraps within readable limits, paginates contents/process/CTA lists and writes atomically. Fixed compositions that cannot fit return the exact field and an action while preserving the existing PDF. Named missing/corrupt images are errors; intentional colour-only sections are explicit. Bundled font coverage is checked, unsupported shaping is rejected truthfully, and the region is printed. Contents rows now link to the correct service pages. An independent 13-page fixture preserved all 111 supplied customer-text fields after its review exposed and we fixed the omitted region. QR contrast and contents-label contrast were also corrected. See [the workflow](skills/branded-lead-funnel-builder/references/catalogue-workflow.md), [real-PDF regressions](skills/branded-lead-funnel-builder/tests/test_catalogue.py) and [progress](docs/PROGRESS.md).

Original finding:

The PDF builder truncates wrapped text with ellipses, slices some summaries to a fixed character count and draws some headings without measuring their width. Fixed positions limit service/process density. Missing images can silently become solid blocks.

**Work:** Paginate/adapt or fail with an explicit actionable message when content cannot fit. Do not silently discard approved qualifiers or substantive copy. Identify intentional image-free designs separately from missing required files.

**Done when:** Tests cover long service names/CTAs, long qualifiers, many services/steps, Unicode names and missing images. Extracted PDF text preserves approved content; all rendered pages remain readable without clipping or overlap.

**Files:** [measured PDF builder](skills/branded-lead-funnel-builder/scripts/build_catalogue.py), [catalogue regressions](skills/branded-lead-funnel-builder/tests/test_catalogue.py), [font provenance and license](skills/branded-lead-funnel-builder/assets/pdf-fonts/provenance.json).

### B13 — Conversion-event deduplication must use the receipt

**P1 before relying on advertising conversions · Reproduced defect**

If D1 saves a lead but the response is lost, the safe retry returns the existing receipt with duplicate=true. The browser's first confirmed receipt is then suppressed by the tracking helper. Conversely, calling the helper twice with the same ordinary successful receipt queues two events.

Executing the shipped tracker in an isolated VM reproduced **zero events** for the first-observed duplicate receipt and **two events** for the repeated nonduplicate receipt. D1 lead storage and the internal dashboard remain intact; this affects the optional downstream event.

**Work:** Deduplicate eligible browser/provider emissions by receipt ID, separately from server request idempotency.

**Done when:** Ordinary success, response-loss recovery, retries and repeated helper calls each emit exactly one eligible conversion; denied consent and thank-you refresh/direct navigation emit none. Provider failures never undo stored-lead success.

**Files:** [tracker accepted handler](skills/branded-lead-funnel-builder/assets/cloudflare/public/funnel.js#L32), [existing client tests](skills/branded-lead-funnel-builder/assets/cloudflare/tests/client.test.mjs#L39).

### B14 — Privacy choices must be revisitable; attribution behavior must be explicit

**Implemented and locally verified — 17 September 2026**

Generated landing, thank-you and privacy pages now have a persistent accessible Privacy choices control. Keyboard focus stays in the dialog and returns on Escape. Withdrawal clears measurement IDs and consent-gated attribution, updates other tabs and stops future optional events; forms remain usable. An uncertain form retry retains its contact identity/receipt while removing newly disallowed metadata.

`analytics.attribution_mode` makes the previous implicit boundary explicit: `consent` (new default), `lead` (independent enquiry origin details), or `disabled`. Analytics retains its own consent/default-on/disabled choice. DNT/GPC overrides both. Browser wording and server enforcement read the same Worker configuration. Missing settings fail closed for optional data; uncollected origin displays Unknown. The old per-field form cache is retired.

**Evidence:** actual Chromium desktop and WebKit mobile interactions, real Worker/D1 submissions, lost-response retry after withdrawal, cross-tab withdrawal, browser privacy signals, unavailable settings, legacy receipt compatibility and mode/payload tests. Preflight requires the shared controls; generated-funnel browser QA now exercises them at three sizes in both engines. The fresh fictional demo passed the complete form/CRM/reporting journey and portable handoff checks. See [the development record](docs/PROGRESS.md) for counts and limitations.

**Remaining:** choose the actual client's policy and finish their privacy content; perform live/physical-device acceptance under B19/B21. Changing a visitor choice does not erase an already accepted lead, and soft removal is not erasure (B15). This implementation is not a universal legal conclusion.

**Files:** [privacy/attribution client](skills/branded-lead-funnel-builder/assets/cloudflare/public/funnel.js), [accessible controls](skills/branded-lead-funnel-builder/assets/cloudflare/public/privacy-controls.js), [server enforcement](skills/branded-lead-funnel-builder/assets/cloudflare/src/security.js), [policy configuration](skills/branded-lead-funnel-builder/references/cloudflare-crm.md#visitor-privacy-and-attribution), [real browser/Worker tests](skills/branded-lead-funnel-builder/assets/cloudflare/tests/privacy.test.mjs).

### B15 — Complete retention and permanent personal-data removal

**Implemented and locally verified — 17 September 2026**

Account now provides an accessible erasure preview, explicit confirmation, removed-contact search, operation recovery, complete source-bound erasure-record export and configurable retention. Automatic cleanup starts off. The scheduled job rotates through configured enquiry, note/activity, campaign/referrer, visit and completed-delivery periods in bounded batches. The owner can preview the currently eligible counts and request one cleanup batch.

Permanent enquiry erasure removes its contact fields, form data, attribution, notes, activity, notifications and outbox rows. A suppression hash blocks old submission retries from recreating it. Active delivery leases delay completion, including when a connection is removed; read-only status reports those leases accurately. Lost responses and interrupted finalization recover the accepted operation. A changed preview requires fresh review and acknowledgement. Ordinary Remove contact remains a soft removal.

**Reporting decision:** reports show retained records. Permanent erasure removes the enquiry and its conversion link, so historical lead/conversion totals can decrease; visit retention separately removes expired visits and their links. A dashboard warning makes this visible. No fixed client retention period or universal person-level/legal erasure claim is assumed.

**Backup preparation:** the owner downloads a complete erasure record with a stable source identity and expected entry count. `backup.mjs verify --erasure-records ... --clean-output ...` cleans only an isolated temporary local restore, checks suppression relationships in both directions, verifies foreign keys, revokes sessions, disables retention/connections and pauses old delivery jobs before writing a separate private SQL file. It leaves the source database and backup unchanged. Modern source mismatch, incomplete records and conflicting IDs/keys block output. Legacy source confirmation requires actual provenance and is parsed as a strict flag. Enabling a reviewed connection later permits new deliveries only; it does not restart old jobs.

**Evidence:** real Worker/D1 transactions, authentication/origin checks, live local browser controls at desktop/390px/320px, delivery interruption and cancellation, stale previews, ambiguous-response recovery, bounded maintenance, ledger pagination, a pre-feature SQL backup round trip, cleaned re-import and negative restoration cases. Independent review reproduced and then retested the delivery, stale-preview, reverse-key, flag and restored-connection defects. See [Development progress](docs/PROGRESS.md) for final suite and clean-machine results.

**Remaining:** choose the real client's periods and handling of external copies; maintain a current authentic erasure record; verify actual Cloudflare recovery-history expiry, live retention capacity and an authorized restore/cutover under B19/B20/B24. A local cleaned backup is not a completed live recovery. Physical backup/export copies and data already sent to other tools require their own documented handling.

**Files:** [operator/owner guide](skills/branded-lead-funnel-builder/references/data-lifecycle.md), [transaction and retention engine](skills/branded-lead-funnel-builder/assets/cloudflare/src/data-lifecycle.js), [owner controls](skills/branded-lead-funnel-builder/assets/cloudflare/public/admin/data-lifecycle.js), [isolated backup reconciliation](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/erasure-backup.mjs), [regressions](skills/branded-lead-funnel-builder/assets/cloudflare/tests/data-lifecycle.test.mjs).

### B16 — Make the full generated-funnel test reproducible in CI

**P2 · Coverage gap**

Repository CI runs real application regressions and checks browser availability. The complete assembled fictional funnel, generated PDF and its integration evidence are local ignored artifacts. A fresh contributor cannot reproduce that exact integrated exercise from the checkout alone.

**Work:** Add a sanitized deterministic fixture builder. CI should scaffold, configure local D1, create/render the brochure, start Wrangler, exercise both engines and submit through the actual form to the CRM. Keep fixture approval explicitly synthetic and invalid for publication.

**Done when:** A fresh CI runner produces the full journey and safe evidence without Luke's machine, Cloudflare credentials or a public deployment. Broken form wiring, missing brochure, stale source and missing browser all fail.

**Files:** [repository CI](.github/workflows/verify.yml), [scaffold](skills/branded-lead-funnel-builder/scripts/scaffold_project.py), [verification record](docs/VERIFICATION.md), [journey verifier](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs).

### B17 — Add a portable dependency doctor

**P2 · Onboarding gap**

Requirements are spread across helpers: Python, Node, browser engines, Firecrawl access, cwebp, ReportLab/Pillow and Poppler. Some were supplied by Luke's bundled runtime. There is no complete environment doctor or Python dependency specification.

**Work:** Provide a read-only preflight that names missing tools/versions and offers reproducible macOS/Linux setup instructions. Distinguish build-time research/image tools from dependencies of the deployed Cloudflare site.

**Done when:** Bohdan can use a clean machine to research, build/render a PDF, optimize images and run both browser engines without copying Luke's absolute runtime paths. Missing capabilities produce one clear setup report before a long build.

**Files:** [PDF imports](skills/branded-lead-funnel-builder/scripts/build_catalogue.py#L11), [cover-render tools](skills/branded-lead-funnel-builder/scripts/render_catalogue_cover.py#L34), [image optimizer](skills/branded-lead-funnel-builder/scripts/optimize_images.py#L23), [setup runtime check](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/setup.mjs).

### B18 — Make progress and safe resumption durable

**P2 · In progress — local resumption implemented; remote recovery remains**

**Update:** `workflow.py status/resume` now derives research, drafting, editorial review, actual approval, design/image, QA and publishing-readiness stages from current evidence. Resume registers existing valid unregistered local reports, retains failures and exact-revision approvals, and stores atomic progress/checkpoints with a local lock. Pending image requests and uncertain external checkpoints remain visible; the helper never executes those actions. It distinguishes uploaded/unverified from validated legacy live checks and deliberately does not claim release completion. A relocated actual demo retained its validated browser/performance/copy/local-journey evidence and stayed nonpublishable. See [resumption guide](skills/branded-lead-funnel-builder/references/resuming-work.md).

**Publishing update:** durable sealed-release journals, a process lock, control-plane/runtime identity checks, separate handoff/live evidence and bounded recovery are implemented. Lost upload responses are inspected rather than reuploaded; completed journeys recover interrupted report serialization. Supported partial journeys now resume with their retained private request and stable IDs; legacy or missing journals still block unsafe repetition. Local status validates saved release proof without claiming a live query.

**Still required:** setup journals, explicit superseding of failed/read-only releases, uncertain migration/origin/legacy reconciliation, reporting-day and exhausted-budget recovery, and the real interruption pilot. B03/B04/B18 remain partial until these acceptance cases pass.

Original finding:

The status helper only distinguishes waiting for copy approval from design/QA. It does not report pending image generation, failed review, awaiting final approval, uploaded-but-unverified or complete. Several scripts work correctly independently, but the agent must reconstruct the overall state.

**Work:** Add a durable stage/status view with exact missing evidence and safe next actions. Preserve subjective writing/design as agent work. Reuse approvals for unchanged approved content, and avoid duplicate generation, D1 creation or deployment on restart. Carry forward actual failures rather than restarting the whole flow.

**Done when:** A new task/session can resume at each interruption point with an accurate status and no duplicate external actions. Successful publish and failed live verification are distinguishable. No extra routine human approval checkpoint is introduced.

**Files:** [current workflow status](skills/branded-lead-funnel-builder/scripts/workflow.py#L124), [image attempt state](skills/branded-lead-funnel-builder/scripts/image_workflow.py), [setup](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/setup.mjs), [publish](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish.mjs).

### B19 — Run the first real Cloudflare acceptance pilot

**P1 before claiming live readiness · Live verification**

This has not happened. Local Wrangler/Miniflare tests establish local behavior, not Cloudflare account permissions, real bindings, DNS, TLS or production capacity.

**Work:** Use an expressly authorized isolated test site/account. Exercise first-time account connection; per-site D1 creation/binding and collision safeguards; migrations; secret setup; workers.dev; and an optional custom subdomain in the intended zone. Do not deploy the current Clean Slate page as a side effect of testing the skill.

**Done when:** The actual public page, admin protection/login, form, thank-you and PDF work; a controlled browser submission yields the identical stored receipt and expected source/device totals; logout and password operations work; the correct account/Worker/database/revision are evidenced. Repeat on the final domain after DNS/TLS is ready. Check current account limits and bounded representative traffic/query volume instead of assuming unlimited free capacity.

**Needs:** Authorized Cloudflare account/site, domain ownership if testing custom DNS, private current admin credentials and an authorized synthetic lead. Mark its reporting impact.

**Files:** [guided publishing](skills/branded-lead-funnel-builder/references/guided-publishing.md), [publishing driver](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish.mjs), [live verifier](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs).

### B20 — Rehearse remote backup, restoration and owner recovery

**P2 · Live verification**

A real local D1 export/restore check already passed. A remote restore/cutover has not been demonstrated.

**Work:** Export a disposable remote database, verify the export locally, restore into a new remote database, reconcile expected data, revoke restored sessions and rotate recovery access. Attach an isolated preview Worker and rehearse cutover/rollback. Define backup cadence, retention, responsible owner and recovery instructions.

**Done when:** The restored preview serves the expected CRM data and receives a new synthetic lead, stale sessions fail, the original database remains untouched, and the rollback procedure is documented. Backups stay private and out of Git.

**Files:** [backup CLI](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/backup.mjs), [account recovery](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs), [recovery guide](skills/branded-lead-funnel-builder/references/admin-access-and-recovery.md).

### B21 — Check physical mobile behavior and deployed speed

**P2 · Live verification**

Chromium and WebKit automation passed; WebKit is not a physical iPhone test. Shortened viewports approximate keyboard space. The 100 Lighthouse score is from a fictional local build, not a guarantee for every client or a live domain.

**Work:** Test at least one actual iPhone/Safari and Android/Chrome journey: keyboard, autofill, phone/email inputs, focus/scroll restoration, error recovery, thank-you and PDF download. Run production-domain mobile performance measurements using the actual client images/fonts/scripts.

**Done when:** No clipped final action or inaccessible field on physical devices; no unintended overflow or layout shift; measured budgets pass for the actual release. Distinguish laboratory results from later real-user performance data.

**Files:** [browser matrix](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/browser-compat.mjs), [performance audit](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/performance-audit.mjs), [QA reference](skills/branded-lead-funnel-builder/references/performance-and-browser-qa.md).

### B22 — Make production failures diagnosable

**P2 · Operations gap**

The Worker safely returns generic unexpected-error responses, but does not emit a useful sanitized diagnostic record in that catch path. Observability is disabled in the template. A client could see failed submissions while the operator has little immediate context.

**Work:** Add appropriately configured redacted diagnostics and document how the owner checks health, failed submissions, database errors and optional delivery failures. Define an owner-visible alert/escalation method without requiring additional platforms for the basic site.

**Done when:** An intentionally induced test failure is diagnosable by route/time/error category or correlation ID, without passwords, contact details or complete form payloads in logs. Confirm that logging/alert behavior on the selected Cloudflare account.

**Files:** [Worker error handling](skills/branded-lead-funnel-builder/assets/cloudflare/src/worker.js#L10), [runtime configuration](skills/branded-lead-funnel-builder/assets/cloudflare/wrangler.jsonc), [outbox](skills/branded-lead-funnel-builder/assets/cloudflare/src/webhooks.js).

### B23 — Finish only the external integrations the client actually wants

**Optional · Additional integration and live verification**

**Advertising:** Google/Facebook source filters already work. They do not send conversions back to Google Ads, GA4 or Meta. The baseline queues a generic dataLayer event; it does not include configured provider loaders/adapters or verified provider delivery.

If needed, implement explicit opt-in adapters after B13, map actual account/destination IDs, honor consent, and prove one accepted lead produces one provider conversion. Generic analytics must not receive raw contact details. A provider failure must not break saved-lead success.

**Notifications/webhooks:** Baseline notifications are in the CRM, not email. The signed outbox retries, but terminal failures have no self-service selected-job retry route. If webhooks/email are requested, configure a controlled receiver, verify signatures/acknowledgements, timeout/retry/duplicate behavior and safe manual recovery. Document at-least-once delivery.

**Done when:** Each enabled provider has a recorded real destination test and documented failure/recovery behavior. Unused adapters remain off. Do not introduce Supabase/Netlify or an external service merely to provide the core CRM/reporting.

**Files:** [generic conversion event](skills/branded-lead-funnel-builder/assets/cloudflare/public/funnel.js#L32), [tracking contract](skills/branded-lead-funnel-builder/references/lead-and-tracking-contract.md), [outbox retry limit](skills/branded-lead-funnel-builder/assets/cloudflare/src/webhooks.js#L62), [webhook admin routes](skills/branded-lead-funnel-builder/assets/cloudflare/src/worker.js#L90).

### B24 — Resolve known product limits and per-client launch inputs

**Decisions / intentional limits — do not label all of these bugs**

| Area | Current behavior | Bohdan's action / acceptance |
| --- | --- | --- |
| Unique visitors | Daily unique browsers are added across the range; this is not globally unique people. | Keep labels and documentation exact, or implement a distinct period-unique metric with tests. |
| Midnight attribution | Conversion matching requires the visit and lead on the same reporting day. A pre-midnight visit with a post-midnight form can become an unmeasured lead. | Agree the intended attribution window; test timezone/DST boundaries and delayed submissions before changing the cohort definition. |
| Facebook paid classification | A Facebook click ID alone does not prove paid traffic. | Supply consistent campaign UTMs and test Google/Facebook/organic/direct/unknown samples against documented rules. |
| Test traffic | Synthetic verification affects historical metrics; soft-removing the contact does not undo them. | Use isolated pilot data or add an explicit test-data/report exclusion design. Never silently subtract real traffic. |
| CRM board size | The board uses a 100-record page, with page-specific counts disclosed. | Confirm this is adequate; add full pipeline counts/cursor loading if users need a whole-database board. |
| CSV completeness | Export is capped at 10,000 and omits custom form answers/notes. | If needed, add cursor/date partitioning and a full-data export. Verify older matching contacts cannot become permanently unreachable in exports. |
| Spam/bot handling | Honeypot, validation and IP rate limits exist; bot exclusion is basic. | Run realistic abuse/shared-IP checks. Add Cloudflare-compatible challenge/quarantine only if required; do not obstruct legitimate mobile form submissions. |
| Owner access | One named owner; no team roles, MFA or email-based password reset. | Keep scope explicit. Add these only if requested; current recovery is an operator procedure. |
| Client content | Starter service options, privacy wording, contact details and claims require actual client configuration. | Replace/verify them, choose timezone and exact form scope, confirm media rights and real proof, and obtain the two actual approvals. Preflight already blocks known starter privacy/content strings. |
| Library maintenance | Portable normalized examples work, but original capture/build tooling is outside this repo. | Supply a reproducible curation/rebuild process if Bohdan will maintain the library; do not promote quarantined OCR or change holdouts casually. |

**Files:** [metrics/cohort logic](skills/branded-lead-funnel-builder/assets/cloudflare/src/repository.js), [traffic classification](skills/branded-lead-funnel-builder/assets/cloudflare/src/traffic.js), [CRM pagination](skills/branded-lead-funnel-builder/assets/cloudflare/public/admin/app.js#L199), [CSV export](skills/branded-lead-funnel-builder/assets/cloudflare/src/admin-operations.js#L68), [preflight](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/preflight.mjs#L33), [library guidance](skills/branded-lead-funnel-builder/references/copy-library/README.md).

## Suggested implementation order

1. **Release safety:** B01–B05. Keep optional deployment paths disabled until guarded. Add the missing negative tests before running a live pilot.
2. **Portable complete builds:** B06–B10, B12, B16–B18. A fresh clone must handle a real new reference and carry reviewed content through a portable, resumable build.
3. **Measurement and customer-data behavior:** B13–B15 and the relevant B24 decisions. Keep optional provider reporting separate from the internal dashboard.
4. **External acceptance:** B11 and B19–B22 using a disposable, explicitly scoped site. Add B23 only for integrations being enabled.
5. **First actual client:** supply real claims/assets/privacy/contact details, approve copy, build/review/iterate, approve the final publishing scope, then verify the actual destination.

## Starting and recording work

Start with the setup and test instructions in [README.md](README.md) and [VERIFICATION.md](docs/VERIFICATION.md). Use Node 24 for the existing lockfile. Install Chromium/WebKit and the PDF/image tools before interpreting missing-tool failures as application bugs.

For each item:

- Add a focused regression that demonstrates the specific failure where practical.
- Implement the smallest coherent fix without weakening approvals, consent, evidence freshness or credential protection.
- Record the commit/PR, executed tests, evidence location and remaining live dependency beside the checklist item.
- Keep credentials/lead data private. Use synthetic local fixtures for normal development.
- Mark an item complete only after its acceptance condition passes. A configured endpoint, uploaded Worker or mocked provider response alone does not prove a working live integration.

This file is a work plan for Bohdan. It does not itself authorize deploying an existing client page, changing client DNS, restoring over production data or sending live test leads.
