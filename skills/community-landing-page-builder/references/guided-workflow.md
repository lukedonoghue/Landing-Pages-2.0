# Guided workflow and execution contract

## Start with one guide

Use this mode when the owner asks to be guided, to work step by step, or to build through publication. Preserve automatic mode for owners who want autonomous work without routine copy/design approvals. Existing projects do not silently switch modes.

From the installed skill, the agent starts the project with `python3 scripts/guide.py start PROJECT --mode guided --goal publish` (use `preview` when that is the actual goal). The agent, not the business owner, operates commands and schemas. Never treat a publication goal as permission to create resources, change DNS, publish, send email, buy anything or submit a lead.

The nine visible stages are Start, Business, Conversion, Copy, Design, Preview, Connections, Publish and Complete. They are not nine approval screens. Research, design, checks and repairs run without “shall I continue?” pauses. In guided mode confirm the brief and complete copy; launch needs actual scoped authority. In automatic mode retain the existing optional copy checkpoint setting.

Always say what is happening, what the owner needs to do, and what happens next. Reuse supplied answers. Ask one to three necessary questions, with discovered choices, a reason, and free text where meaningful. Help and cancellation never count as answers or approval. The customer makes business decisions, not CSS/database/schema decisions.

## One authority for each kind of state

* `funnel.json` contains actual business choices, conversion and selected modules. `build/guide-business.json` is its material business projection consumed by copy acceptance. A changed service, audience, offer, region, conversion or follow-up must refresh this projection and the copy-review input hashes.
* `build/guide-state.json` contains question revisions, answer provenance, pending questions and interruption state. It is not an approval or readiness store.
* `build/workflow.json` remains the authority for actual content-bound approvals. `guide.py approve` delegates to its locked, expected-fingerprint check. A stale screen cannot approve newer unseen copy.
* Existing quality reports, snapshots, release records and `workflow_progress.py` determine readiness. The runner cannot replace them with “done”.
* Existing `native_routing.py` SQLite state owns worker reservations, attempts and the pending continuation. The runner uses that same database. Credentials and recovery journals remain in `.secrets/`, not answers, captures, public assets or exports.

Guide answer/configuration updates use a recoverable write-ahead transaction. Duplicate answer events are idempotent only when identical. Conflicting events, stale revisions, changed files during a task and late worker receipts are rejected, not silently merged.

## Research before questioning

The first research task writes `build/discovery.json` with `schema_version: 1`, `input_fingerprint` from the task's `research_input_fingerprint`, `suggestions` as consumed by `guide.py discover`. Each suggestion has `id` (a catalog question ID), `source_path`, `source_sha256`, exact `excerpt`, and either `value` or `ambiguous: true` with an explanatory `reason` and optional `{value,label}` options. Suggestions use actual source evidence; do not infer unsupported guarantees, prices, credentials, response times or proof. Read the question catalog and controller contract before writing discovery. A changed business identity invalidates its research suggestions. User-confirmed facts remain user evidence, not independent verification.

After research, the guide asks only the unanswered material questions. Capture several answers from a single message together. The agent translates natural-language changes into validated answer events; owners never need to edit JSON. In the local form renderer, use the ordinary active host conversation for uploads, business changes and questions beyond the catalog; those are not silently treated as completed form fields.

## Actual continuation, two supported interfaces

### Active ChatGPT/Codex or Claude session

Repeatedly request the next action, perform it, and continue immediately. `workflow_runner.py claim PROJECT` returns a claim token and a hash-bound input package. Perform only its task using the actual available native tools. Return a truthful receipt with `status`, `summary`, `outputs`, and `blockers` via `workflow_runner.py finish PROJECT --task ID --token CLAIM --receipt FILE`, then claim the next eligible task. `guide.py next PROJECT` also identifies local transitions, questions, approvals, connection actions and reconciliation. Handle local transitions through `guide.py` rather than asking the user to run them.

This works with inherited host models when model selection or subagents are unavailable. Capability detection must be real. Never claim a model switch or independent reviewer merely because a profile requests one. A closed ChatGPT/Claude task cannot be forced to continue by a JSON response; resume from the saved project, not a reconstructed conversation.

### Local subscribed CLI runner and selectable guide

`python3 scripts/workflow_runner.py run PROJECT --provider codex` or `--provider claude` actually dispatches supported native CLI work, validates outputs and immediately advances. It probes existing subscription authentication; no extra model API key or hosted orchestration server is required by this implementation. It never uses an API-key fallback or Claude bare mode. The CLI and its authenticated subscription must actually be available on the running machine.

`python3 scripts/guide_ui.py PROJECT --provider codex` starts a loopback interface. Open its private fragment-token URL. Submitting answers wakes the real runner bridge; this is not a disconnected questionnaire. It shows the current step, remembered brief, contextual help, complete copy, scoped launch approval and blockers. Keep this interface outside `public/`. The interface is a bounded local renderer, not a claim that every ChatGPT host supports native clickable questions.

The runner stages ordinary work without project production secrets, checks the output allowlist and unchanged inputs, then applies changes through a recovery journal. Workers cannot propose edits to approvals, configuration, the controller or the preserved initial comparison. Filesystem allowlisting and environment filtering are not a hostile-process operating-system security boundary: do not run untrusted executable plugins, and use the host's sandbox/permissions. Publishing runs only through the separate guarded coordinator operation.

## Prevent stalls and loops

Each completed task persists its validated result and pending next action together. A live task retains ownership, PID/host and heartbeat; do not launch a duplicate. If a runner stops, reconcile the recorded process on its original host before retrying. An existing heartbeat is liveness, not proof of useful progress.

A stage gets at most three attempts, with a stop after two unchanged attempts. Failures that can be repaired are agent work. Diagnose repeated failures and use `workflow_runner.py reopen PROJECT --stage STAGE --reason 'specific changed condition'` only after the diagnosis or capability change. Do not reset the budget to repeat identical prompts. A worker blocker must name the missing fact, permission or capability. Preserve independent valid work.

The runner never blindly repeats a deployment, provider operation or lead submission with an unknown outcome. Reconcile the actual existing operation. Connection acknowledgments mean “check now”, not “connected”.

## Conversion profiles and copy

`lead_inbox` preserves enquiry forms and adds the existing Worker/D1 CRM only when selected. `static_action` keeps a real booking, call, purchase or download path without adding a database. `--static-only` remains a legacy scaffold option; the guided static profile always separates public assets in `public/`.

Lightweight static builds use the supported Markdown copy master and existing copy acceptance, including the current `guide-business.json` projection. Full Worker builds use the structured JSON copy workflow. Do not route a valid lightweight page through nonexistent JSON-only evidence. Optional tracking remains disabled unless selected; missing ad accounts must not block page quality or substitute a different conversion.

## Mandatory first-build control improvement

After initial implementation and before the owner sees a “final” page, execute [control-comparison.md](control-comparison.md): preserve the first build, compare its actual copy/pixels to Blue Mountain Mesh, record a prioritized checklist, apply all warranted changes and recapture/review. This happens automatically in guided and automatic new-build contracts. Do not ask the owner whether to repair weak headlines, unclear benefits or broken layout.

Refresh copy acceptance and any selected user copy approval after material wording/offer changes. Retest form, mobile, font, PDF, claim, rendered-copy, performance and other affected gates after the last source change. Do not remove useful information, qualifications or proof merely to shorten the page.

## Connections, publication and completion

For Worker/D1, reuse `setup.mjs`, the existing actual setup authorization and guarded `publish.mjs`. Account connection, infrastructure creation, DNS mutation, publication and live-test submission remain separate scopes. Reuse valid explicit instructions; never invent permissions or ask for passwords in conversation. Give exact provider-returned DNS records and a recheck action; preserve other website/mail records.

Static publication uses `static_publish.py` and the same content-bound publish authority plus real handoff gates. It checks a selected existing Pages project/account/production branch, uploads only `public/`, and verifies the deployed bytes at the intended HTTPS origin. Its supported automatic adapter does not create a new Pages project, register a domain or edit DNS. Those require the active host's separately authorized existing provider setup path. Do not advertise an unconnected new-account setup as already verified. A required custom domain remains pending; a temporary provider URL is not completion.

Static live verification reports exactly deployed-byte and local conversion checks. It never claims a purchase, appointment, telephone call, delivered email or CRM receipt that was not actually tested. Worker live leads require the separate explicit test choice; soft-removal leaves historical metrics. Optional integrations remain visibly unverified when unconnected.

Return the real public address, appropriate private owner-access instructions, selected conversion destination, enabled tracking, saved verification time/scope and remaining limitations. For a publish-goal session, a local preview is intermediate. Saved success is not a fresh check of the currently running site.

## Release validation limits

Unit, synthetic-provider and local browser tests establish mechanical behavior, not novice usability or model-generated page quality. Run packaged cold-start sessions in the actual subscribed Codex and Claude environments, an authorized isolated provider pilot, and independent copy/pixel review before calling every supported path fully self-guided. No guide may claim these pilots occurred merely because its state machine tests pass.
