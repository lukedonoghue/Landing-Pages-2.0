# Current research, review and release contracts

This is the agent implementation guide, not a checklist to hand to the business
owner. Complete routine research, schema population, repairs, QA and packaging
without asking the owner to approve technical decisions. New projects use
`quality.contract_version: 4`. Existing projects keep their valid work; missing
new acceptance evidence remains a precise blocker rather than being fabricated.

## One authority, two non-circular artifacts

`release_acceptance.py` is the sole public release-class interface. It delegates
to the existing gate checker, canonical copy checker, workflow inspector, owner
validator and supported portable exporter. It is not a second implementation of
the gates. A passing narrow helper is only that helper's result.

- `build/release-inputs.json` is the immutable source/QA input packet. Owner
  handoff and the archive manifest reference its exact hash.
- `build/release-status.json` is the generated view of current quality, owner
  status and external archive verification. The archive's own hash must be
  outside the archive. Do not create owner/status/archive circular hashes.
- `build/export-verification.json` is the existing exporter-written result,
  including package ID, exporter version, input hash and actual restore result.
  It is equivalent to the blueprint's proposed `export-result.json`.

Use these commands from a generated project:

```sh
python3 scripts/release_acceptance.py .
python3 scripts/release_acceptance.py . --write --require local_final
python3 scripts/workflow.py assert-release . --class local_final
```

The first command is read-only. Exit zero means the inspection ran, not that the
project passed. The assertion commands exit nonzero unless the requested class
is actually accepted. Use `--mode publish --require publish_ready` only after
actual source/intent-bound operator preflight and current explicit publication
authority. Use `--mode live --write --require live_verified` after the existing
publisher has verified the current destination and applicable journey. A saved
live observation is not continuous monitoring or a new live check. Static live
scope means exact deployed bytes and the selected local action; it does not
claim an external booking, purchase, phone call or submission was performed.

The only final phrases are those justified by the returned `release_class`:
`blocked`, `local_preview`, `local_final`, `publish_ready`, `live_verified`.
Quote the actual class, scope and blockers. Never infer it from old chat text,
HTML existence, screenshot counts, a shell exit code from `status`, or one green
checker. A local-final delivery requires an actual verified portable export.
A live-verification-only report does not deliver a new ZIP; an explicitly
selected ZIP requires its separate current handoff acceptance.

## Canonical copy and required records

`copy_contract.py` chooses exactly one master set. All project-level copy
entrypoints delegate to it. `copy_acceptance.verify_review` remains a narrow
review primitive, never whole-project acceptance.

| Mode | Canonical records under build/ |
| --- | --- |
| Worker / structured | client-copy-brief.json, copy-context.json, page-copy.json, copy-review-inputs.json, copy-editorial-review.json |
| Explicit static Markdown | strategy-brief.md, claim-ledger.md, page-copy.md, copy-review-inputs.json, copy-editorial-review.json |

The Markdown mode must be explicitly selected by backend `none` and
`guided_workflow.copy_format: markdown`. Do not build a second competing master.
New contract-4 projects use structured canonical records as authorities. Existing
retained Markdown documents still must be nonempty and free of scaffold markers.
Render declared views with `completion_contract.render_documents`, using
`build/document-sources.json`; do not remove template markers just to pass.
`validate_required_records.py .` checks the selected records and retained views.
Generated QA must have actual result rows. A missing document source is a blocker.

## Research before questions, and before accepted copy

`build/research-acceptance.json` is the existing canonical research-status record.
Do not add a parallel `research-status.json`. Keep its existing actual reviewer,
sources, positioning, image attempts and explicit exception records described
in completion-integrity.md, plus a `sections` object with all these keys:

```text
business_identity service_offer conversion_path contact_details service_area
proof_credentials first_party_assets review_discovery brand source_qualifiers
material_unknowns positioning stop_rule
```

Each section has `status: pass|not_applicable`, a specific `reason`, and nonempty
`evidence: [{path, sha256}]`. A real unresolved material fact blocks the stage.
Do not turn a failed search into a fictional business fact. A not-applicable
result also needs inspected evidence, not absence of a file.

Every complete business build creates `research/reviews/review-manifest.json`.
Keep the existing identity/quote/rights schema. Add `research_status` with one of
`researched`, `unavailable`, `identity_unresolved`, `not_applicable`; a non-researched
state requires a concrete `reason`. `discovery` lists actual searched `source`,
`identity_signals`, `outcome`, `searched_at` and hash-bound `evidence`. An empty
provider response alone is not evidence of no reviews. The existing validator
always runs at research stage. Usable matched reviews cannot be hidden behind an
unavailable label. An unresolved business identity cannot count as accepted
research; resolve it or narrow scope explicitly.

Run the existing review workflow to generate `build/review-insights.json`, even
when no quote is publishable. Assess every `review_workflow.ANALYSIS_FIELDS`
dimension; use an explicit empty list when that theme is unsupported. This
includes problems, outcomes, objections, buying triggers, trust, service language,
value/price, cleanliness/reliability, negative friction and supporting review IDs.
Never invent a positive theme merely to fill the schema.

Compare one to three actual supported `positioning_angles`. Each retains its
existing fields and adds `differentiation`, `review_support`, `claim_risk` and
`placement`. The existing single-angle exception requires concrete reasoning and
search evidence. Choose the strongest supported buyer argument, not a numeric
prediction of conversions.

Acquire appropriate first-party bytes with `image_workflow.acquire`. Its
`provenance.acquisition` retains URL, discovery page, retrieval time, HTTP/MIME,
actual local hash/dimensions and source route. Research image attempts that say
`acquired` must reference that image-plan `asset_id`; failed/rejected candidates
retain their URL, specific error/reason and evidence. Reuse rights remain
mandatory. A text note is not an acquired image.

Retain the actual `build/brand.json` rendered measurements. `brand_decisions` in
the research record has `logo`, `colors`, `heading_font`, `body_font`, each with
`observed`, `selected` and evidence. A changed choice also needs `fallback_reason`.
A missing measurement is not excused by a fallback-font note.

The guided research worker writes `build/discovery.json` with the current
research fingerprint and actual source-bound suggestions. For an unavoidable
owner question, add an `unresolved_facts` row: catalog question `id`, `category`
(identity, offer, claim, primary_action, form_fields, destination or
business_follow_up), `reason`, `material_effect`, and prior searched evidence.
Only unknown initial identity may have no prior evidence. The coordinator logs
actual question presentation in `build/question-log.json`. Do not ask already
answered or source-discoverable facts again. Automatic mode does not introduce
brief/copy/layout approval checkpoints unless configured.

## Conversion and semantic copy

`build/conversion-contract.json` contains the source and selected conversion
`type`, exact source/selected offer and source/selected fields, source success
behavior (or explicit unknown), secondary action, local implementation,
production wiring state, retained evidence and authorized changes. Field names
are `source_conversion_type`, `selected_conversion_type`, `source_offer`,
`selected_offer`, `source_fields`, `selected_fields`, `source_success_behavior`,
`secondary_action`, `local_implementation`, `production_wiring`, `evidence`,
`allowed_changes`. Each actual change needs a reason and source/owner evidence.
Non-form actions additionally bind `selected_destination` to the actual selected
URI. Preserve a source enquiry form; lack of credentials is not a reason to
replace it with an easier phone link. Static validation, browser and local journey
all check this contract. Existing runtime tests still prove accepted receipts,
exactly-once D1 persistence, CRM read/update, errors, retries and direct-entry
thank-you behavior.

Keep these funnel fields separate:

- `business_follow_up_promise`: source-supported business behavior or explicit
  unknown. `follow_up_promise` is a backward-compatible mirror of this field.
- `preview_disclosure`: ordinary visitor language, for example "Preview only.
  Nothing is sent to the business. Your test entry stays within this preview."
- `local_test_behavior`: internal technical details, never persuasive copy.

After editorial review and after any control repair:

```sh
python3 scripts/copy_quality.py lint .
python3 scripts/copy_quality.py verify .
```

The lint command produces stable phrase/risk findings, not a subjective score.
The agent must repair warranted repetition, generic headings, duplicated section
jobs, redundant CTA support, jargon and unsupported implications automatically.
`build/copy-quality-review.json` binds the current `copy: {path, sha256}`, actual
`reviewer`, `status`, findings, and concrete checks for every
`copy_quality.SEMANTIC_DOMAINS` key. Each check has status, observations and evidence.
Remaining lint findings need a matching ID and an evidence-backed specific
nonblocking disposition; implementation/research narration cannot be waived.

`build/claim-review.json` binds the same copy and a reviewed coverage observation.
Every material claim row has unique `id`, exact `wording`, `truth_class`,
`source_excerpt`, hash-bound evidence, `qualifier`, `paraphrase_boundary`, allowed
`locations`, `reviewer_judgment`, and resolved status. Unsupported claims block.
An empty ledger needs a genuine no-material-claims reason and cannot hide detected
high-risk wording. Exact source anchoring is necessary but is not semantic proof;
the reviewer must reject stronger implications such as converting "No job too
small" into an anti-upsell promise.

For every derived review theme, `review_theme_use` in the copy-quality review
records `dimension`, `value`, the exact `review_ids`, `used|omitted` disposition,
and reason. A used theme also cites an actual current `copy_excerpt`. This is
separate from testimonial publication permission.

## Image and generated-surface lineage

The existing image gate still requires four independent relevant content originals,
not four filenames/crops. Source bytes, rights, truth role, live placement and
mobile/desktop crops must match the plan. Logos, icons, blank shapes and guide
previews do not pad the count. Generated illustrations cannot satisfy client-proof
slots. Actual native tool output must be registered after the bytes exist with
its real result identity/time/hash; a handwritten note cannot create generation.
Offline verification checks consistency, not provider authenticity.

`dependency_state.py` records generated page, guide and thank-you inputs/outputs.
Build helpers register their real outputs after success. The native frontend
runner records the main-page edge. In active-session/manual builds run this only
after implementing the accepted copy:

```sh
python3 scripts/dependency_state.py record . --node main_page --input build/page-copy.json --output public/index.html
python3 scripts/dependency_state.py check .
python3 scripts/dependency_state.py changes .
```

Use the selected Markdown master instead for that explicit mode. Guide and
thank-you helpers derive full required input sets themselves; manual graph rows
cannot weaken them. A material change invalidates dependent QA, and unknown
material files conservatively invalidate all verification. Runtime installation
under `.community-builder` changes `build/tool-runtime.json`, not product source
identity. Preserve that identity separately when restoring an archive.

## Final browser and review packet

Acquire brand/source inputs before the common QA snapshot, never midway through
QA. Run the current layout matrix including 390x844, 768x1024, 1024x800,
1280x600, 1440x900 and the existing intermediate widths. The runner also captures
320x700 and reduced 390x420 keyboard-space simulations. Every screenshot needs
actual viewport, DPR, engine/version, URL, source fingerprint and hash. Full-page
pixel height is not viewport height. Exercise every configured browser engine.

Run at least three real mobile Lighthouse audits, keep raw tool/version, URL,
throttling and numeric results, and provide the actual server command with
`--server-command`. Budgets come from funnel quality settings; final validation
recomputes medians and enforces those settings. A missing run/tool is a blocker,
not a warning. Any accepted limit needs `scope`, `reason`, `owner_impact`,
`retest_trigger`, exact warning identity and current evidence.

```sh
node scripts/capture-final-states.mjs --url http://127.0.0.1:8787 --project-root . --fixture test-fixture.json
```

This sampler intercepts all writes and records initial/invalid/final-step/error/
pending/uncertain states plus direct thank-you. Error states are controlled
simulations, not database proof. The real authorized local journey separately
captures receipt-confirmed desktop/mobile thank-you states and text. Do not
manufacture a confirmed receipt in the read-only sampler. The title/close must
remain visible, inline errors must be described, and every primary enquiry CTA
must open the intended shared form.

After control repairs and all affected retests, an actual critical reviewer writes
`build/final-review.json` as a normal gate report (schema, gate, source, target,
tool, execution time, checks, artifacts, status, failures, warnings). It also has:

- `reviewer_provenance`: actual mode and reviewer/builder task identities.
- `capture_reports`: hash-bound executed reports that produced the screenshots
  and rendered text. Receipt captures must come from the registered valid journey.
- `control_review`: the registered current control result and its exact hash.
- `domains`: all `final_review.DOMAINS`, each with pass, observations and evidence.
- `cold_reader`: all `final_review.QUESTIONS`, each answered from exact rendered
  text/PDF excerpts, not drafts or briefing notes. A disabled guide needs its
  explicit not-applicable answer.
- `guide_pages`: every actual rendered PDF page, each with concrete observations
  and evidence. PDF text must match the current generated guide's extracted text.
- `findings`: unique ID, severity, evidence, disposition, fix and retest evidence.
  No unresolved P0/P1/design-risk/evidence gap. An accepted P2 needs the full
  evidence-based limit fields. `unresolved_findings: []` and `decision: pass` are
  necessary but do not replace the observations above.

Inspect full desktop/mobile pages, tablet/laptop/short-height views, modal initial,
invalid, final-step, server error, pending, uncertain, confirmed and direct
thank-you, and all guide pages. Answer service, audience, next step, reason to
choose, supporting proof, follow-up, uncertainty and the guide's useful buyer job.
For a plumbing estimate-preparation guide, solve the customer's preparation job
rather than repeating the form: useful photos, symptoms/timing, visible model/age,
access, safe observations, diagnostic limits, checklist and verified next step.
Do not include unsafe technical DIY instructions or unverified promises.

```sh
python3 scripts/check_gates.py record . --gate final_review --report build/final-review.json
python3 scripts/workflow.py resume .
```

The current host cannot gain native subagents by reading profiles. Independent
review requires a real coordinator-owned receipt under
`build/orchestration/tasks/<task-id>.json`, written by `native_routing.finish` or
the trusted runner after actual returned output. It binds source, input packet,
profile, actual provider/dispatch identity, timestamps and output hashes. The
reviewer report links by task ID, avoiding a report/receipt self-hash cycle.
Reviewers cannot author these receipts or final status. No actual dispatch means
`self_review`. An offline file validator cannot cryptographically authenticate a
provider against a malicious actor who can rewrite every file; preserve the
native sandbox/coordinator boundary and never claim otherwise.

## Package, restore and resume

Use `package_handoff.py` and its existing `portable_handoff` implementation.
No ad hoc ZIP is a reviewed delivery. The exporter stages the exact source,
validates current canonical copy/QA, tests extraction, compares identities and
artifact hashes, and only then promotes the archive. Private data, caches,
locks and runtime databases are excluded. The verification runtime is intentionally
separate from product source and retained when required for portable resumption.

Only the coordinator writes release inputs/status, owner handoff, question log,
preflight observations and export results. Owner/QA/README summaries are generated
views with exact retained report hashes. After restoration, recheck inventory and
current gates rather than requiring the sender's absolute ZIP path. Changed
reports invalidate the accepted archive even when public HTML did not change.
On resume return the first concrete missing/stale dependency and one next action;
never repeat a completed lead, image request, deployment or answered question.
