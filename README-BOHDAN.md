# Bohdan's implementation handoff — Landing Pages 2.0

**For:** Bohdan / bohdanshev  
**Audit date:** 16 September 2026  
**Code reviewed:** [2f0de96](https://github.com/lukedonoghue/Landing-Pages-2.0/tree/2f0de9602088f5a01c193f64de58ef5f9e2bfbd9)  
**Purpose:** An actionable backlog of fixes, missing integration work, and live acceptance checks. This audit changed documentation only; unchecked items below remain open.

**Execution plan:** [Self-guided beta milestones](docs/SELF-GUIDED-BETA-PLAN.md) groups this backlog into a staged release plan centered on a new user's ability to finish unaided. The supported environment is a pending product decision, not an assumed compatibility promise.

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
| [ ] | B01 | P1 if enabled | Make optional GitHub deployment use the release safeguards | Confirmed defect |
| [ ] | B02 | P1 | Require the local form-to-CRM journey before publication | Integration gap |
| [ ] | B03 | P1 | Finish live evidence registration, release status and deployed identity checks | Integration gap |
| [ ] | B04 | P1 | Validate publishing prerequisites early and handle changed passwords | Confirmed defects |
| [ ] | B05 | P1 | Fix first-use CLI session-revocation race | Reproduced defect |
| [ ] | B06 | P2 | Make owner username changes consistent and persistent | Confirmed defect |
| [ ] | B07 | P1 for handoff | Make generated-project ZIPs resumable without invalidating evidence | Reproduced defect |
| [ ] | B08 | P1 for handoff | Make research evidence portable across machines/directories | Reproduced defect |
| [ ] | B09 | P1 | Support a new external reference page without editing the global library | Integration gap |
| [ ] | B10 | P1 | Enforce approved-copy parity across page, modal, thank-you and PDF | Integration gap |
| [ ] | B11 | P1 when generating | Resolve the exact image-model path and run it once | Live verification / default-path gap |
| [ ] | B12 | P2 | Prevent brochure truncation, overflow and silent missing assets | Confirmed limitations |
| [ ] | B13 | P1 for ad tracking | Deduplicate conversion events by receipt, including lost-response retries | Reproduced defect |
| [ ] | B14 | P1 | Add persistent privacy choices and define attribution-consent behavior | Missing UI / decision |
| [ ] | B15 | P1 before promising erasure | Complete retention and permanent personal-data removal | Missing operation / decision |
| [ ] | B16 | P2 | Run a reproducible complete generated funnel in CI | Coverage gap |
| [ ] | B17 | P2 | Add a dependency doctor and complete clean-machine setup | Onboarding gap |
| [ ] | B18 | P2 | Add reliable stage/resume status | Integration gap |
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

**P1 · Integration gap**

The publish driver creates a live snapshot and runs the journey verifier, but does not register the emitted CRM/tracking/deployment reports or run the complete live gate check. It creates a deployment record with verification_pending set to true and never clears it. The general workflow status still only reports copy approval or design/QA.

Deployment identity is also taken from a supplied record: the verifier checks URL origin and database-ID format, but does not independently reconcile the running build/version and actual Worker database binding. Health currently proves database connectivity, not revision identity.

**Work:** Preserve pre-publish evidence separately from live evidence, record a durable uploaded/verification-failed/verified outcome, register the appropriate reports and reconcile the actual deployed version/binding. Define which pre-publish quality evidence can legitimately accompany a verified identical deployed revision. Do not relabel handoff screenshots as fresh live screenshots to satisfy the checker.

**Done when:** A successful controlled publish has a coherent final status and valid release evidence; interrupted/failed verification can resume without another deployment; stale/wrong revision or database metadata is detected; historical approval evidence remains intact.

**Files:** [publish completion](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish.mjs#L40), [live record validation](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs#L87), [report emission](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs#L212), [gate recording](skills/branded-lead-funnel-builder/scripts/check_gates.py#L282), [health endpoint](skills/branded-lead-funnel-builder/assets/cloudflare/src/worker.js#L31).

### B04 — Detect missing verification prerequisites before publishing

**P1 · Confirmed defects**

Publishing checks whether fixture/password files exist, but invalid fixture content, malformed credentials and missing Chromium can be discovered only after remote migrations and deployment. Local application tests can skip browser coverage; the publishing driver does not reject skipped tests as the repository CI does.

After an Account password change or recovery, the default production password file can also be stale. The new D1 password remains valid; deployment does not reset it. The problem is that the subsequent live verifier defaults to the original password and fails after making remote changes.

**Work:** Validate fixture schema/selectors, credential structure, required tool/browser availability and test execution before mutation. Establish a secure current-credential handoff/reference. For an existing deployment, check current login where appropriate before redeployment. Do not store replacement plaintext credentials in source control.

**Done when:** Invalid prerequisites cause no remote mutations. Redeployment after both UI password rotation and CLI recovery verifies using the current credential. Missing browsers cannot produce a green release via skipped tests.

**Files:** [publish preconditions/order](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish.mjs#L12), [late fixture/auth/browser checks](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/live-verify.mjs#L69), [password rotation](skills/branded-lead-funnel-builder/assets/cloudflare/src/admin-operations.js#L14), [recovery output](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs#L38).

### B05 — CLI session revocation has a first-use race

**P1 · Reproduced defect**

The CLI revocation SQL only increments an existing credential-version row. A new owner who has never rotated their password has no such row. A login that read version zero before revocation can insert a valid session after the deletion and survive the revoke operation.

This sequence was reproduced with the shipped SQL in isolated in-memory SQLite. The authenticated API revocation implementation already handles the first-use row correctly; do not rewrite it as though it has the same defect.

**Work:** Make the CLI also create/advance the credential version atomically for a first-use owner, aligned with the API behavior.

**Done when:** A concurrency regression proves that a login that captured the old credential version before CLI revocation cannot create a valid session afterward, for both new and previously rotated accounts.

**Files:** [CLI recovery SQL](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs#L22), [login version guard](skills/branded-lead-funnel-builder/assets/cloudflare/src/worker.js#L40), [working API revocation](skills/branded-lead-funnel-builder/assets/cloudflare/src/admin-operations.js#L26).

### B06 — Owner username changes need one supported procedure

**P2 · Confirmed defect**

Setup directs username changes to the recovery tool, but that tool explicitly preserves the username. Documentation instead suggests changing the Worker secret. A live-secret-only change can then be overwritten by the old username in the local production configuration on the next publish.

**Work:** Provide one coherent identity-change procedure covering the Worker secret, local deployment configuration and session revocation. Correct the setup guidance.

**Done when:** Changing the owner username invalidates old access, works with the new identity and survives redeployment. Passwords remain private.

**Files:** [setup instruction](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/setup.mjs#L25), [recovery behavior](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/admin-account.mjs#L49), [secret upload](skills/branded-lead-funnel-builder/assets/cloudflare/scripts/publish.mjs#L21), [recovery guide](skills/branded-lead-funnel-builder/references/admin-access-and-recovery.md).

### B07 — Generated-project ZIP handoffs cannot reliably resume the approved workflow

**P1 when handing off generated projects · Reproduced defect**

The archive allowlist omits the root test fixture and the workflow approval state. It adds START-HERE.txt and FILE-MANIFEST.json, which then affect source fingerprints after extraction. A complete image gate can include the image plan through its declared artifacts, but the root allowlist does not guarantee it.

An isolated archive test confirmed fixture/approval omissions and a changed extracted fingerprint. That narrow reproduction used the explicit missing-evidence override to inspect archive inclusion; it was not represented as a fully approved handoff.

**Work:** Define the complete portable, nonsecret project state, separate packaging metadata from release source identity, and package required fixtures/plans/evidence. Preserve the minimal approved revision/provenance needed for the audit trail, without unrelated private chat text, while distinguishing reusable copy approval from account/destination-specific publication approval.

**Done when:** A fully reviewed fictional project can be zipped, extracted on another machine, audited and resumed with the expected source identity and nonsecret state. It must not inherit authority to publish to an unrelated account. No credentials or runtime databases enter the archive.

**Files:** [Worker packaging](skills/branded-lead-funnel-builder/scripts/package_handoff.py#L76), [archive metadata](skills/branded-lead-funnel-builder/scripts/package_handoff.py#L146), [source fingerprinting](skills/branded-lead-funnel-builder/scripts/check_gates.py#L15), [approval state](skills/branded-lead-funnel-builder/scripts/workflow.py#L27).

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

**P1 · Integration gap**

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

**P2 · Confirmed implementation limits**

The PDF builder truncates wrapped text with ellipses, slices some summaries to a fixed character count and draws some headings without measuring their width. Fixed positions limit service/process density. Missing images can silently become solid blocks.

**Work:** Paginate/adapt or fail with an explicit actionable message when content cannot fit. Do not silently discard approved qualifiers or substantive copy. Identify intentional image-free designs separately from missing required files.

**Done when:** Tests cover long service names/CTAs, long qualifiers, many services/steps, Unicode names and missing images. Extracted PDF text preserves approved content; all rendered pages remain readable without clipping or overlap.

**Files:** [text truncation](skills/branded-lead-funnel-builder/scripts/build_catalogue.py#L118), [service summaries/layout](skills/branded-lead-funnel-builder/scripts/build_catalogue.py#L208), [process layout](skills/branded-lead-funnel-builder/scripts/build_catalogue.py#L288).

### B13 — Conversion-event deduplication must use the receipt

**P1 before relying on advertising conversions · Reproduced defect**

If D1 saves a lead but the response is lost, the safe retry returns the existing receipt with duplicate=true. The browser's first confirmed receipt is then suppressed by the tracking helper. Conversely, calling the helper twice with the same ordinary successful receipt queues two events.

Executing the shipped tracker in an isolated VM reproduced **zero events** for the first-observed duplicate receipt and **two events** for the repeated nonduplicate receipt. D1 lead storage and the internal dashboard remain intact; this affects the optional downstream event.

**Work:** Deduplicate eligible browser/provider emissions by receipt ID, separately from server request idempotency.

**Done when:** Ordinary success, response-loss recovery, retries and repeated helper calls each emit exactly one eligible conversion; denied consent and thank-you refresh/direct navigation emit none. Provider failures never undo stored-lead success.

**Files:** [tracker accepted handler](skills/branded-lead-funnel-builder/assets/cloudflare/public/funnel.js#L32), [existing client tests](skills/branded-lead-funnel-builder/assets/cloudflare/tests/client.test.mjs#L39).

### B14 — Privacy choices must be revisitable; attribution behavior must be explicit

**P1 for the missing choice UI; P2 for policy/configuration refinement**

The banner hides after a stored decision, and the shipped footer/privacy page offers no control to reopen it. A consent setter exists internally but is not reachable by the visitor after dismissal.

Separately, first/latest attribution and click IDs are stored before optional measurement consent and included with the lead even when measurement is declined. DNT/GPC suppress visitor measurement, not this separate capture. That is a behavior requiring an explicit client choice, not a universal legal conclusion.

**Work:** Add a persistent accessible privacy-choice control and document/configure the boundary between lead-origin capture and optional analytics. Ensure generated pages retain the control. If attribution requires consent for the project, gate and clear it accordingly.

**Done when:** A keyboard/mobile visitor can accept, decline, reopen, withdraw and reload; withdrawal stops future optional events and removes the measurement identifier; the form still works. Tests separately check attribution storage/payloads for accept, decline, DNT/GPC, disabled mode and withdrawal. Privacy wording matches actual behavior.

**Files:** [attribution and consent](skills/branded-lead-funnel-builder/assets/cloudflare/public/funnel.js#L9), [starter footer](skills/branded-lead-funnel-builder/assets/cloudflare/public/index.html#L57), [privacy template](skills/branded-lead-funnel-builder/assets/cloudflare/public/privacy.html).

### B15 — Complete retention and permanent personal-data removal

**P1 before promising erasure/customer-data lifecycle support · Missing operation / decision**

CRM removal currently sets deleted_at. Contact fields, form answers, notes, attribution and history remain stored. Scheduled cleanup only removes expired sessions and rate-limit rows. This limitation is already documented; soft removal is not permanent erasure.

**Work:** Keep archive/removal distinct from a deliberate authenticated erasure/anonymization operation. Define configurable retention for contacts, notes, attribution, visits and queued payloads, plus a documented backup retention process. Decide which non-identifying historical totals remain. Prevent retries from resurrecting erased records.

**Done when:** A seeded contact's unique personal-data markers disappear from the intended live records and queued deliveries; historical totals behave as specified; retention is idempotent and stays within configured scope. Document backups and payloads already delivered to optional third parties separately.

**Needs:** Client retention choices; no assumed universal retention period.

**Files:** [soft removal](skills/branded-lead-funnel-builder/assets/cloudflare/src/repository.js#L164), [scheduled cleanup](skills/branded-lead-funnel-builder/assets/cloudflare/src/worker.js#L16), [data schema](skills/branded-lead-funnel-builder/assets/cloudflare/migrations/0001_crm.sql), [documented distinction](skills/branded-lead-funnel-builder/references/cloudflare-crm.md#L15).

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

**P2 · Integration gap**

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
