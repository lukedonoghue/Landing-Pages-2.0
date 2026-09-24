# Finish the work, then report what actually passed

This is the repair contract for the September 2026 QA reports. It extends
`workflow.py`, `check_gates.py` and the supported exporters. It does not introduce
a second workflow or make the owner run technical checklists.

## Keep the owner experience guided

Start with useful research. Ask only for facts or access the available sources
cannot resolve. Continue through the existing next-action/resume mechanism;
do not ask “continue?” between stages. Preserve successful work and resolve the
specific blocker. Never replace an uncertain prior lead with a fresh submission.

The source reports describe different Bear Plumbing snapshots. Two content
originals in one snapshot and six PNG files in another are not contradictory
counts of the same accepted output. Likewise, a missing copy master in one
archive does not establish that every earlier archive lacked one.

## One record for each fact

Keep the existing canonical paths. Do not relocate a working project into a new
parallel folder system. `workflow.copy_files()` determines the selected mode's
copy, brief, context, editorial review and review-input paths. The image plan
remains `image-plan.json`, reviews remain under `research/reviews/`, and source
bound gate reports remain under `build/`.

Where Markdown documents duplicate canonical inputs, map them explicitly in
`build/document-sources.json`:

```json
{"documents":{"RESEARCH-BRIEF.md":{"path":"build/strategy-brief.md","sha256":"ACTUAL_SOURCE_HASH"}}}
```

Run `python scripts/check_gates.py documents PROJECT` to render only those
mapped records. The command does not research, approve copy or delete template
markers. Missing, changed or incomplete inputs block rendering. Unmapped authored
documents remain supported and still undergo the existing semantic checks.
`SECTION-COPY.md` must represent the actual canonical copy, not a second draft.

## Research and claim acceptance

New projects use quality contract version 4; the additional schemas and final release interface are in remediation-contracts.md. Before accepting copy, retain
`build/research-acceptance.json` with these fields:

- `status: pass`, the actual `reviewer`, and `sources` with `path`, `sha256` and
  `kind`; at least one source must be `official_site`.
- `positioning_angles`: one to three records with `id`, `angle`,
  `buyer_relevance`, `specificity`, `rationale` and hash-bound `evidence`.
  `selected_angle_id` identifies the chosen angle. Normally compare two or three;
  a single evidence-supported option needs `single_angle_reason` as a documented
  exception, not invented alternatives.
- `first_party_image_attempts`: actual `status` (`acquired`, `unavailable`,
  `unsuitable`, `not_permitted`), specific `reason` and retained `evidence`.
- `claim_scope_review`, `copy_repetition_review`, `buyer_questions_review`: each
  contains `status: pass`, concrete `observations`, and hash-bound `evidence`.

Validate identity-matched reviews and run the existing review workflow to produce
current `build/review-insights.json`. No reviews on one directory is not the end
of research. Insights may inform buyer problems, outcomes, objections, praised
capabilities and vocabulary without automatically authorizing testimonial reuse.
Exact quotes, reviewer identities, avatars and publication rights remain subject
to `validate_reviews.py`. Do not fabricate review metadata or human portraits.

A genuine lack of usable reviews needs `review_exception`; a permitted typography fallback still needs actual
rendered measurements and evidence-bound brand decisions. A missing review
manifest or brand measurement cannot be bypassed by an exception. An exception has a specific `reason`,
actual `reviewer`, retained hash-bound `evidence`, and nonempty `attempts` with
`source`, `outcome`, and `evidence`. It records a limitation, not a performed test.
Otherwise retain actual `build/brand.json` rendered measurements and captures.

Do not expand the meaning of business claims. “No job too small” does not prove
an anti-upsell policy. Self-published registration/insurance claims do not prove
independently checked current status. Check each claim's implication, source,
qualifier and factual currency. Remove repeated filler and give each section a
separate buyer decision to resolve. Preserve the approved enquiry intent.

Map real reference sections in `build/reference-fidelity.json` to IDs in
`build/page-structure.json`. The latter also has `buyer_questions`, each with
`question`, `section_id`, `treatment`; an omitted question instead requires
`disposition: omitted`, `rationale` and hash-bound `evidence`.

## Imagery: acquired inputs first, rendered approval second

The pre-layout check uses image **preflight**, not rendered acceptance. Acquire
and optimize suitable first-party or supplied assets, retain actual bytes,
source identity and reuse basis, then build. Discovery alone is not acquisition.
The final image gate separately requires current desktop/mobile crop and
placement reviews. Final acceptance rejects unregistered HTML/CSS images and
content originals that are not actually used on the landing page.

Four independently retained relevant content originals remain the normal LP
minimum. Repeated files, crops, a PDF preview or invented lineage IDs do not add
originals. Composite originals need separate `original_evidence` entries with
actual distinct image bytes. Mark non-content and guide-only visuals explicitly;
register logos/avatars without counting them as service proof.

For a non-proof gap, invoke native generation when available. Retain its actual
result as JSON: `kind: native_image_result`, `status: succeeded`, `tool`,
`tool_call_id`, `output_id`, `raw_result` containing that output ID,
`executed_at` with timezone, and `output_sha256`. `reported_model` is required
only to substantiate an explicitly reported/requested model identity. These
fields must come from the actual execution; do not manufacture a receipt from
a task name, a local drawing or an intention to invoke the tool. An offline
validator checks linkage and bytes, not provider authenticity. If the host
cannot supply evidence, keep the stage blocked or use an explicitly permitted
truthfully classified alternative. Generated illustrations are never client
employees, customers, installations or achieved results.

## Test the real local journey

Use the existing Worker/D1 synthetic local-journey runner against a real local
HTTP server. Prove invalid/error paths, one accepted request, persisted local
lead, authenticated CRM changes/reporting, thank-you receipt/direct entry and
guide download. Do not submit a production lead. A `set_content` screenshot or
API mock is not Worker/D1 journey evidence.

Run the existing browser and compatibility tools against the final snapshot.
Captures retain actual viewport width/height, device scale factor and hash;
full-page screenshot height is not viewport height. Cover the guarded widths
360, 390, 768, 1024, 1180, 1280 and 1440, the 1280 short-height state, and the
320 first-screen check where applicable. Keep configured engine/version evidence,
including Chromium and WebKit when selected. Capture modal initial/error/focus,
server error and result states, not just a closed page. Keep the title and close
control in a non-scrolling header with a separately scrolling body. Inline field
errors retain hints, visible errors, described-by links and focus behavior.

Run real mobile Lighthouse audits. Retain raw JSON and actual throttling settings;
reported median scores must match those files and meet the configured budgets.
Tool unavailability is a blocker, never a pass. Warnings need an explicit
`warning_dispositions` entry: exact `warning`, `disposition` (`accepted_limit`
or `not_applicable`), `reason`, `scope`, `owner_impact`, `retest_trigger`, and hash-bound `evidence`. General caveats about
not measuring conversion uplift belong in `limits`, not unresolved defect flags.

The PDF must pass existing content and page-level pixel review, not just exist.
Check service-specific educational/decision value, repeated or sparse sections,
source-to-claim scope, useful imagery and no internal research language. The
thank-you page must remain a complete page with honest receipt/direct-visit
states. Visitor preview text should say what happens in ordinary language, not
“local demo CRM”; technical routing belongs in the owner handoff.

## Review integrity and final handoff

Control and guide reviews may be `self_review`. An `independent` claim needs a
real coordinator-owned execution receipt in `build/orchestration/tasks/` with
current input/source hashes and actual returned review output. See
`remediation-contracts.md` for the receipt schema and trust boundary. A task name
or handwritten execution note is not an independent reviewer. No separate agent
means self-review. Review current source, actual pixels, claims, image provenance,
modal/error states, guide pages and workflow state rather than trusting old PASS
flags. Fix material findings, then recapture/retest the changed snapshot.

Run `python scripts/check_gates.py summarize PROJECT --mode handoff`. This invokes
the existing aggregate checker and generates `docs/QA-REPORT.md`,
`build/owner-handoff.json`, `build/release-status.json` and `README-DELIVERY.md` from
that result. It must remain a preview while mandatory evidence is blocked,
missing or stale. Accepted local checks are `local-quality-ready`, not production
readiness or yet a verified archive.

Use `portable_handoff.py export` (also called by both modern static and Worker
packaging routes). It checks source identity, actual restored gate/copy evidence,
archive paths and hashes, and records the real clean-restore outcome in
`build/export-verification.json`. Only a successful reviewed export can report
`local-final`. Its hash is retained outside the ZIP to avoid a circular self-hash.
A site's pre-export QA inside the archive is interpreted with the archive's
FILE-MANIFEST scope. `--in-progress` and legacy/site-only exports stay explicit
previews; packaging cannot turn missing tests into success.

Do not package secrets, runtime databases, caches or lock files. Retain the copied
workflow runtime needed to resume; exclude it from customer-copy scanning, not
from the resumable export. Never call arbitrary ZIP creation certified export.
Publication, account configuration and live tests remain separately authorized.


## Automatic local finalization

The guided controller schedules its existing local runner operation
`finalize_local` after quality acceptance. It invokes the same aggregate checker,
summary writer and portable exporter, then rereads the exact archive before
returning `local_final`. Reopening an unchanged project reuses that archive;
missing, stale or changed ZIP bytes return to export instead of trusting a saved
pass flag. Development fixtures can only use explicit in-progress exports.

Research workers may write `build/research-acceptance.json` and
`build/document-sources.json`. Only the coordinator writes release status,
owner handoff and export verification. These records are not worker assertions.

For final visual acceptance, include real screenshot artifacts with `state`,
`viewport: {width, height}` and `device_pixel_ratio`. Review desktop and mobile
`page`; form pages additionally need `server_error`, modal pages need
`modal_initial`, `modal_error` and `modal_focused`; include `thank_you` when that
page exists. The compatibility runner supplies modal captures. The read-only
copy-capture runner supplies a deliberately blocked-request error screenshot and
the direct thank-you state without creating a lead. This error-state capture is
not proof of a real backend outage, persisted success or receipt; the separate
synthetic local-journey test must still prove those applicable behaviors.

The authoritative final conversational check is `python3 scripts/release_acceptance.py PROJECT --write --require local_final`. Run it after supported finalization. The older `local-quality-ready` label is advisory and never the delivered release class.
