# Plan: a self-guided Landing Pages beta

**Status:** Implementation in progress under the active goal; see [verified progress](PROGRESS.md). The beta acceptance criteria are not yet complete.
**Planning baseline:** [37f7aac](https://github.com/lukedonoghue/Landing-Pages-2.0/tree/37f7aac)  
**Related documents:** [Detailed engineering backlog](../README-BOHDAN.md) · [Existing verification](VERIFICATION.md)  
**Environment decision:** Pending Luke's choice. The provisional planning assumption is one supported Codex environment, because the current implementation uses local Python/Node helpers and browser tools. This is not a claim of compatibility with every ChatGPT/agent environment. If ChatGPT support is required at launch, validate its actual available execution, browser, file, image and publishing capabilities in M0 before committing to the adapter or schedule.

## 1. Outcome and definition of self-guided

A person who has not worked on this repository can install the shared skill, provide a business website, review the copy and finished design, and publish a working funnel to their own Cloudflare account.

They should not need to understand D1, edit configuration files, repair source code, assemble evidence files, or manually coordinate scripts. The agent performs those steps. The person still supplies missing business facts, makes meaningful choices, signs into services where necessary, and gives the two deliberate approvals.

The intended journey:

1. Install/start the skill and pass a clear capability check.
2. Supply a website; optionally supply a reference, audience/service description and offer.
3. Review the researched brief and complete copy; approve or request changes.
4. Let the agent design, source/generate imagery, build, test, inspect and repair.
5. Review the actual page, form, brochure, thank-you page and CRM; choose/confirm the publishing destination.
6. Approve publishing, including the scope of the controlled verification lead.
7. Receive the verified live page URL, private admin-access instructions, reporting explanation and maintenance/recovery guide.

There are **two planned approval checkpoints: copy and final publication**. Sign-in and genuine missing business facts can require input; routine implementation steps do not add permission questions. An unresolved required check is clearly explained, never silently skipped.

### Definition of a successful beta session

- The user starts from a fresh supported installation without Luke's private workspace.
- The agent handles setup and normal recovery through plain-language guidance.
- The rendered page and brochure preserve approved claims, qualifiers, offer and follow-up wording.
- The public form stores a lead, reaches the thank-you page and delivers the correct brochure.
- The owner can log in, find that lead, change its stage and see the expected visitor/source/conversion records.
- The actual Cloudflare account, database, deployed revision and public URL are verified.
- A new session can resume an interrupted build without losing approval or repeating external actions.
- The user completes the flow without editing code/JSON or receiving unplanned engineering help.

## 2. First-beta scope

### Included

- One clearly supported agent environment and a tested installation route.
- Service-business lead-generation pages from real client evidence.
- Optional arbitrary external reference page; no-reference builds also work.
- Copy draft, editorial review, user approval and rendered-copy parity checks.
- Responsive page, accessible multistep form, brochure PDF and thank-you page.
- Source-first image selection plus a tested generation route when generation is required.
- One named owner, protected CRM, pipeline/stages, notes, in-app notifications and usable export.
- Existing date/source/device/traffic filters, with clear definitions for visitors and conversion rate.
- Revisitable privacy choices, explicit attribution behavior and an operational personal-data removal/retention procedure.
- Cloudflare Workers + one D1 database per site, with workers.dev and guided optional custom-domain setup.
- Repeatable verification, credential recovery, backup/restore instructions and usable diagnostics.
- A distributable skill package, short user guide and portable nonsecret project handoff.

### Deferred unless explicitly selected for the pilot

- Additional agent environments before the first environment passes.
- A separate hosted website-builder application or visual drag-and-drop editor.
- Multi-owner roles, team invitations and a multi-client account dashboard.
- Automated email campaigns and external CRM integrations.
- Google/Meta conversion delivery adapters; source filtering remains included.
- Automatic GitHub deployment of client sites. Disable the unsafe optional template until its guarded release path is complete.
- A/B testing, advanced attribution and broader library-curation tooling.

GitHub remains the collaboration/source repository for this project. It is not required to host a generated client's page or database.

## 3. Milestones and acceptance gates

Each milestone must produce a demonstrable result. Documentation alone does not close it.

| Milestone | Deliverable | Acceptance gate | Existing backlog |
| --- | --- | --- | --- |
| M0 — Product and environment contract | Agreed user journey, supported capability profile, pilot choices and distribution scope | Fresh environment proves required capabilities; decisions and unsupported cases are explicit | B11, B17, B24 |
| M1 — A fresh user can start | Installation, capability doctor, unified checks, portable fictional fixture and contributor map | Fresh machine can generate/run the local demo and its complete journey without author-specific paths | B08, B16, B17 |
| M2 — A website becomes trustworthy approved content | New-reference capture, copy review, parity checks, image route and reliable PDF | Three representative briefs produce complete inspectable copy/assets; deliberate content drift is rejected | B09–B12 |
| M3 — The build can run and resume reliably | Durable workflow state, required evidence and portable handoff | Interruption/relocation tests resume correctly; missing local submission proof blocks release | B02, B07, B08, B18 |
| M4 — Cloudflare publishing is dependable | Guarded publication, account/data controls, live evidence, recovery and diagnostics | Controlled cloud pilot passes initial publish, form/CRM/tracking, redeploy and recovery on the actual destination | B01, B03–B06, B13–B15, B19, B20, B22 |
| M5 — New people can finish unaided | User-facing package, concise guidance and independent beta sessions | Three fresh-user scenarios pass the release scorecard; all enabled-path launch blockers are closed | B16, B19, B21, B24 |

M2 and M3 can progress independently after the shared M0/M1 contracts. Small confirmed defects can be fixed early while those contracts are being established. M4 depends on the release/evidence model from M3 and reviewed content from M2. M5 depends on a passing M4.

### M0 — Set the user experience and tool contract

- Confirm the first supported environment through the actual capabilities available to a fresh user: persistent project files, Python/Node execution, browser automation, visual inspection, source capture, image generation and Cloudflare connection.
- Design one ordinary-language starting prompt and short progress messages. The user sees the current stage, outcome, missing input if any, and what happens next.
- Confirm the first pilot's visitor definitions, reporting timezone, attribution window, test-data handling, consent policy, retention choices and one-owner scope. Present proposals rather than making users design a database.
- Choose the image route and identify any required setup before a long build. A named model in a prompt is not model attestation.
- Define installation/update behavior and which library/reference assets can be included in the distributable package. Keep private material separate when it is not intended or approved for sharing.
- Specify two approval records bound to their exact content/release intent; a test fixture is never a substitute for either.
- Record decisions in this plan or a compact decision log, so later work does not repeatedly reopen them.

**Exit evidence:** capability probe on a clean supported environment; agreed journey and pilot settings; identified external dependencies. If the intended environment cannot execute the workflow, revise the delivery mechanism before polishing the prompts.

### M1 — Make a fresh installation reproducible

- Add a readable repository/contributor map: skill instructions, reusable templates, generated projects, tests and evidence.
- Add a dependency doctor with exact setup/recovery instructions. Prefer project-local dependencies and supported runtime discovery.
- Provide one command each for generating the fictional demo, starting it, resetting only its synthetic local state and running all relevant checks.
- Ship a deterministic fixture builder instead of another manually copied demo that drifts from the scaffold.
- Include fictional contacts and representative traffic dates/sources for the CRM UI, separate from the actual submission-verification run.
- Add the integrated fixture to CI: brochure generation/rendering, local Worker/D1, Chromium/WebKit and actual form-to-CRM checks.
- Establish formatting/basic static checks for the files being changed; keep formatting commits separate from behavior changes.
- Mark the current release baseline and define skill/template/schema versions. Update installation must have explicit, safe handling of retired files rather than silently accumulating stale copies.

**Exit evidence:** two independent clean installs of the selected supported setup; all required checks execute with no silent missing-tool skips; no credentials or local runtime databases enter the package.

### M2 — Finish research, copy and design consistency

- Capture a user-provided external reference into project-local research, even when it is absent from the bundled library. Keep client factual evidence separate from reference-page inspiration.
- Make required research evidence portable and hash-verified.
- Present the complete copy in a readable review, covering page, form, thank-you and brochure promises. Ask for missing consequential claims instead of inventing them.
- Add a required comparison between the approved master and rendered HTML/PDF. Deliberately changing a claim or removing a qualifier must fail.
- Plan image placements from the design and source client assets first. Generate appropriate illustrative imagery only through the chosen working route, with actual provenance, bounded retries and crop/weight review.
- Make long PDF content adapt/paginate or fail clearly. Do not silently truncate approved copy or conceal missing required assets.
- Inspect real desktop/mobile renders, including awkward heading wraps, focal crops, form states and every brochure page. Numeric checks support that review.
- Store specific review observations and invalidate the relevant evidence after actual changes.

**Exit evidence:** complete content/design exercises for a website-only brief, a new external reference and a limited-asset business requiring an illustration. Include negative tests for stale evidence, changed wording, image-model uncertainty and PDF overflow.

### M3 — Connect the components into a resumable workflow

Implement a persisted lifecycle with enough detail to answer what is finished, what is blocked and the safe next action:

~~~text
setup → research → copy_drafting → awaiting_copy_approval
      → design_and_build → local_verification → awaiting_publish_approval
      → provisioning → deployed_unverified → live_verification → complete
~~~

Blocked stages retain their reason, completed artifacts and retry context. A recoverable error is not a reason to restart the whole job.

- Version the state schema and keep authoritative business/source configuration separate from generated output, evidence, approvals and secrets.
- Bind copy approval to the meaningful customer-facing revision; harmless report refreshes do not force another human approval.
- Require actual local form → receipt → D1-backed CRM → reporting proof as a release gate.
- Preserve pre-publication evidence and live evidence separately. Do not overwrite or re-label one to manufacture the other.
- Make ZIP handoff/relocation preserve required nonsecret state and evidence identity. Exclude packaging metadata from content identity through a deliberate documented rule.
- Store generation attempts, deployment attempts and accepted receipt identifiers so resumption does not repeat uncertain external actions blindly.
- Provide one status view that explains failed checks and the next action in plain language. Internal scripts remain implementation details.

**Exit evidence:** interrupt and resume after research, copy approval, image request, local verification, deployment upload and partial live verification. Move a prepared project to another directory/machine and verify content/evidence. Missing local journey proof must block publication.

### M4 — Finish publishing, account controls and data operations

- Fix the CLI session-revocation race, stale-password verification and username-change/redeployment behavior with focused regressions.
- Validate fixtures, browser availability, credential structure and required evidence before remote mutation. Check existing live credentials where appropriate; first-time deployment needs its own tested path.
- Resolve the two-checkpoint publishing sequence deliberately: prepare and review the intended account/domain and release locally; perform provisioning only within the user's actual authorized publication/setup scope. Prefer final approval bound to reviewed source plus destination intent, with provider-assigned resource IDs recorded separately and validated against that intent.
- Do not let generated database IDs force an unnecessary third approval, and do not use this separation to allow unreviewed page changes or a changed destination.
- Use one guarded release path. Keep optional GitHub auto-deployment disabled until it can transport revision-bound reviewed evidence and obey the same rules.
- Add receipt-based browser conversion deduplication, persistent privacy choices and a tested attribution-policy configuration.
- Implement a supported personal-data erasure/retention operation before opening the beta to real leads. A synthetic cloud pilot may precede that operation; it must not be described as a real-data launch.
- Publish an isolated approved test site, verify actual Worker/version/database identity, register live results and accurately mark uploaded, incomplete or verified.
- Check first deploy, redeploy after password changes, custom-domain behavior, authorized synthetic submission and reporting correlation.
- Rehearse recovery with a new test database rather than overwriting production. Verify a restored preview, revoke restored sessions and document rollback.
- Add redacted diagnostics and a clear owner recovery/support procedure. No raw leads or secrets in logs.

**Exit evidence:** the full cloud pilot plus a subsequent redeploy and recovery exercise pass. Invalid preconditions create no remote mutations; changed destinations/content invalidate the relevant approval; failed verification resumes without a duplicate deployment.

### M5 — Prove the skill is self-guided and package it

- Prepare the shareable release, short installation/start guide, capability checklist and a simple explanation of what remains the user's responsibility.
- Keep the detailed engineering backlog available to maintainers; it is not the end-user onboarding manual.
- Run three first-time users through different briefs using clean supported installations. They may provide business facts, review work and sign in; they should not need engineering rescue.
- Include at least one new external reference, one website-only brief and one image-generation case. Include first-time Cloudflare setup and an already-connected account across the scenarios.
- Test a physical iPhone/Safari and Android/Chrome journey as well as automated browser checks. Measure the actual deployed page with its client assets.
- Record confusion, retries, questions, time spent on setup and points requiring assistance. Fix recurring friction in the skill or tools and rerun the affected scenario.
- Publish clear release notes and supported-version information. Verify install/update and a fresh project made from the released package, not only the development checkout.

**Exit evidence:** the scorecard below passes for the release candidate. Public/shared availability must accurately state supported environments and any remaining limitations.

## 4. Release scorecard

| Area | Required proof |
| --- | --- |
| Installation | Fresh supported machine/session succeeds without private paths or manual source/config editing |
| Research | Website-only and new external reference both work; missing facts are surfaced |
| Copy approval | Actual user approval is retained for the exact master; rendered content stays consistent |
| Design/media | Desktop/mobile and PDF inspected; generated-image provenance truthful |
| Forms | Validation, retries, saved receipt, thank-you and brochure pass through the real browser |
| CRM/security | Correct stored lead, owner login, stage/note changes, password/recovery/revocation behavior |
| Reporting/privacy | Expected date/source/device cohort; one conversion per intended receipt; privacy changes and retention/erasure work as specified |
| Publishing | Correct Cloudflare account, destination, deployed revision and database; no unapproved/stale release |
| Resumption | Interrupted build and uploaded-but-unverified release resume without duplicate external actions |
| Operations | Redacted diagnostics, private recovery instructions and a verified restore exercise |
| Usability | All three cold-start scenarios complete without unplanned developer assistance |
| Scope | No unresolved P1 issue on an enabled path; deferred features are off and honestly described |

A successful upload, a mocked provider response or a passing unit suite alone does not satisfy this scorecard.

## 5. Suggested small implementation batches

These are proposed work boundaries, not an assertion that Bohdan has accepted a schedule.

| Order | Batch | Main output | Depends on |
| --- | --- | --- | --- |
| 1 | Experience/capability contract | M0 decisions, user journey, lifecycle/approval design | Environment choice/probe |
| 2 | First-run tooling | Doctor, unified checks, contributor map and fixture builder | Batch 1 |
| 3 | Focused reliability fixes | Session revoke, current credentials, early verification validation, receipt deduplication | Existing regression harness; can start early |
| 4 | Portable research/reference inputs | New-reference support and relocation-safe context | Batch 1 |
| 5 | Approved output checks | Rendered-copy/PDF parity, PDF robustness and image route | Batch 4 and working tool capabilities |
| 6 | Workflow state and release gates | Required local journey, safe resume and distinct handoff/live evidence | Batches 1–3 |
| 7 | Privacy/data operations | Choice UI, attribution configuration, retention/erasure | Pilot policy decisions |
| 8 | Portable distribution | Archive/state integrity, install/update versions and permitted bundled material | Batches 4–6 |
| 9 | Guarded cloud release | Provision/deploy/verify lifecycle and identity checks | Batches 3, 5–7 |
| 10 | Live operational acceptance | Initial/repeat publish, custom domain, diagnostics and restore rehearsal | Batch 9 plus test account |
| 11 | Independent usability pass | Three user scenarios, physical devices and release package verification | Batches 8–10 |

Keep functional fixes, formatting changes and documentation changes easy to review independently. Run focused regression checks first, then the relevant integrated journey. Do not repeatedly rerun unrelated suites when only prose changes.

## 6. Proposed responsibilities and decisions

- **Luke:** First-beta environment and audience; product choices; copy/design approval standards; three representative businesses/testers; intended Cloudflare test account/domain; any image/API route choice.
- **Coding agent:** Scoped implementation, portable tooling, fixtures, evidence, documentation and repeatable checks.
- **Bohdan:** Suggested engineering reviewer/maintainer for workflow architecture, Cloudflare/account/data operations, release integration and technical acceptance.
- **Fresh beta users:** Complete the actual journey and report friction without relying on implementation knowledge.

The existing broad access to this development workspace is not a substitute for selecting the intended client deployment/account or authorizing a particular live test. Reuse actual authorization once given; do not ask for it again unnecessarily.

Open decisions that change implementation:

1. First supported environment: pending the current question.
2. Distribution audience: assume invited beta testers initially; confirm the scope before wider distribution.
3. Image route: exact-model API with verified access, or a clearly accepted native-tool capability; retain source-first assets.
4. Analytics/retention defaults: propose settings and wording in M0, then confirm meaningful client differences.
5. Pilot site/account: select a disposable destination and the person responsible for access/recovery.

## 7. Sequencing, estimate and immediate next step

The previous **2–3 focused weeks** estimate is an optimistic planning target for a narrow controlled beta, not a committed delivery date. It assumes one supported environment, quick access to test accounts, agent-assisted implementation and available reviewers/testers. Wider environment support, unavailable model access or major release-state changes can extend it.

Use M0/M1 to replace that rough estimate with observed setup/build effort and a sized remaining batch list. Release on the scorecard, not on a calendar date.

**First implementation slice:** prove the selected environment, establish the user/lifecycle contract, and deliver a fresh-install doctor plus reproducible local demo. In parallel work planning, the isolated session-revocation and conversion-event regressions are suitable small early fixes. The next demonstration should show a new installation reaching a working local funnel through plain-language guidance.

**This planning change does not deploy a page, alter Cloudflare resources, execute paid image generation or mark backlog items complete.**

