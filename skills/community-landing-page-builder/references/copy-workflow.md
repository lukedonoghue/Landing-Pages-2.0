# Write and review with the reference library

Use this for new page copy or a substantial rewrite. Small copy corrections should reuse the approved context and recheck the affected claims and components without rebuilding all research.

For a website-to-copy trial, use [copy-only-test.md](copy-only-test.md). Set `output_mode: copy_only` and the requested `required_components`; a page-only test does not require modal, thank-you, brochure, HTML or backend generation. When no follow-up timing is known, use an empty `follow_up_promise` and make no invented timing promise.

## Select evidence and examples

For an arbitrary supplied reference, follow [project-reference.md](project-reference.md). Capture it with --reference, inspect its actual persuasive lessons, and keep it project-local. It does not need global library curation before it can guide this project. Curated examples supplement the supplied primary reference; when none fits, keep the real brief and use client evidence plus the copy doctrine.

New writer contexts store required research, manifest and funnel-contract paths relative to the project. Keep the brief's source_manifest project-relative as well. An unchanged project can be moved to another directory or machine and retain its content/review hashes; editing relocated evidence still invalidates the audit.

Legacy contexts with absolute paths remain readable only inside their original project. After moving a legacy project, copy its actual research files, re-run context preparation and perform the real editorial freshness review. Do not merely overwrite hashes or read evidence from the old project's location. Unchanged customer-facing copy and offer do not need a new user approval just because supporting metadata was refreshed.

Read `copy-doctrine.md`. Create `build/client-copy-brief.json` with: `client_name`, `service`, `audience`, `sector`, `offer_type`, `intent`, `primary_cta`, `follow_up_promise`, `required_sections`, `claims`, and optional `buyer_job`, `style`, `primary_reference_url`, `forbidden_claims`.

All entry controls for the same journey share `primary_cta`. If opening the form and submitting it are different named actions, explicitly set optional `form_submit_label` in the brief and use it as `modal.submit_label`; otherwise the submit label defaults to `primary_cta`. Both labels must accurately describe their own action, not promise a different offer or delivery.

Each claim has `id`, `text`, `source`, `evidence`, `approved` and relevant `qualifiers`. Keep the full claim ledger and underlying research alongside this brief. `approved` means permitted for this draft; it is not a substitute for examining the source. Operational promises supplied directly by the user can use the user's dated instruction as evidence. Unknown facts stay unknown.

When a research manifest is available, add `source_manifest` and a `source_id` for each approved website claim. Preparation verifies the supporting excerpt against its saved source. Changes to the manifest or source text invalidate later review. Use `evidence_type: user_instruction` only for facts the user actually supplied. Source matching establishes provenance, not semantic entailment.

Use the library helper from the skill directory:

```bash
python3 scripts/copy_library.py prepare \
  --brief /absolute/project/build/client-copy-brief.json \
  --out /absolute/project/build/copy-context.json
```

The helper chooses up to three curated supporting examples using offer, audience, intent, sector and source-family diversity. An inspected project-local primary reference takes precedence; an already eligible curated reference can also be selected directly. Bundled retrieval excludes holdout families, error pages, unreviewed candidates and OCR. Read the returned selection reasons. If no suitable example matches the actual client, the result explicitly warns and keeps the real brief; use client evidence, the inspected primary reference if supplied, and the copy doctrine. Do not change the business or offer merely to retrieve an example. Broader library curation is optional maintenance, not a prerequisite for a new client project.

Suitable field vocabulary includes `B2C`, `B2B`, `B2C/B2B`; offers such as `brochure_quote`, `consultation`, `demo`, `menu_quote`, `pricing_booking`; intents such as `planned_project`, `urgent_service`, `complex_project`, `high_anxiety`, `alternative_aware`. Free text is also supported. Use words that describe the actual offer.

Search selected patterns without loading the full archive:

```bash
python3 scripts/copy_library.py search 'brochure quote home improvement'
```

`--include-unreviewed` is an exploration mode. Its results are explicitly not approved writing instructions. Read source context before promoting anything. Database details and promotion rules are in `copy-library/README.md`.

## Writer prompt

Select the writer and reviewer through [platform-native model routing](model-routing.md). Do not invoke a cross-provider CLI or require another provider's credentials for this phase. On Codex/ChatGPT prefer `gpt-6-astra` for writing and `gpt-5.6-sol` for the separate review; on Claude use Sonnet for both passes in separate contexts. Record the models that actually ran.

Read the leading advantage and ranked supporting reasons from the existing strategy brief. Apply the two bounded passes in `copy-and-structure.md` within this writer/reviewer workflow, not as additional review rounds. Write copy before layout. The brief's `buyer_job` and claim references can carry this positioning; no new mandatory schema fields are needed.

Use the following task framing with the current context and research documents. It can be executed by the current writing agent or the configured copy model; creating a prompt file does not count as executing it.

> Write the complete funnel copy for this client using the current brief and sourced research. When `build/review-insights.json` exists, use its supported themes to sharpen customer problems, benefits, objections and natural vocabulary. When `build/testimonial-selection.json` exists, use only those selected source-linked records for testimonial quotations and preserve their publication/attribution limits. Never turn a review theme or paraphrase into a testimonial quote. Treat client evidence as the only basis for client facts. Use the selected examples for structure, rhythm and rhetorical choices. Read each example's cautions. First produce a short benefit/proof map and assign one distinct persuasive job to each section. Then write complete hero, section, card, testimonial, FAQ, primary CTA, modal, brochure-offer and thank-you wording required by the brief. Preserve scope and qualifiers. Make the headline sequence understandable by itself. Do not invent proof or repeat the same benefit as new sections. Record unknowns separately and keep them out of customer-facing text. Return the complete copy plus claim IDs for the sections that use them.

For new builds, use `build/page-copy.json` as the structured master with `h1`, `primary_cta`, `sections`, `modal`, `thank_you`, and `brochure` if needed. Generate `docs/SECTION-COPY.md` with `copy_library.py render --copy <absolute-json-path> --out <absolute-markdown-path>`. Every section has a stable `id`, `headline`, complete `body`, `bullets`, `items`, `questions`, or `testimonial` as appropriate, and `claim_ids`. FAQ questions are objects with complete `question` and `answer`. Primary CTA fields are `cta`; use `cta_role` for controls with other purposes. The modal has `submit_label` and `follow_up_promise`; the thank-you object has `follow_up_promise` and accurate delivery copy. Do not maintain two independently edited drafts. Complete Worker funnels need this canonical master for the required rendered-copy gate. Existing projects should migrate the current approved wording without changing it and verify revision consistency. For a generated brochure include its complete `brochure.text` before approval; see [rendered-copy.md](rendered-copy.md) for supplied unchanged PDFs and additional interface wording.

Shared offer, CTA and follow-up values come from the existing `funnel.json`. The client copy brief is a research-enriched snapshot of that contract, not a new authority. When the usual project-root `funnel.json` exists, preparation checks it and saves its hash; later changes require refreshing the brief and context.

## Reviewer prompt

Use [copy-acceptance.md](copy-acceptance.md) for the cold-reader questions, strongest challenge and source-linked evidence. Prepare its input snapshot after drafting and store the added fields in the same `copy-editorial-review.json` described here. New writer contexts carry `editorial_contract_version: 2`; the audit below invokes that evidence gate too. There is one reviewer pass and one report, not two review systems.

Review current copy with the same client facts and reference lessons. Do not provide the writer's self-rating or an old pass score as evidence. A fresh context is useful for substantial work; the workflow also supports a separate sequential review.

> Review this draft against the actual client evidence, user brief and selected reference lessons. Check message match, exact claim support and qualifiers, outcomes and delivery mechanism, objection coverage, the headline-only story, natural brand voice and density, offer/follow-up consistency, and appropriate reference adaptation. For each finding identify the section, quote the problematic text, explain its effect and provide a concrete revision or identify missing evidence. Distinguish blocking factual/brief failures from substantive improvements and optional polish. Do not approve a topic list, unsupported assertion, stale offer or imported client detail. Revise the affected copy, then assess the final revision. Explain any remaining uncertainty. Your review is editorial judgment, not a conversion prediction.

Save `build/copy-editorial-review.json` against the final revision, with exact file hashes `copy_sha256`, `brief_sha256`, `context_sha256`, `decision`, `unresolved_findings`, and `checks`. The eight criterion IDs are:

`message_match`, `claim_support`, `outcome_and_mechanism`, `objection_coverage`, `headline_story`, `voice_and_density`, `offer_consistency`, `reference_adaptation`.

Each check has `criterion`, `verdict`, and `evidence` containing a short exact `copy_excerpt` from the final copy and an `explanation`. For claim support, also record which client sources were actually inspected. A pass requires actual inspection; never fill generic pass rows just to satisfy the checker. Compute hashes only after all revisions are saved. Record the reviewer/model and execution result truthfully if another runner is used.

Within `message_match`, assess whether the first screen names a concrete service/offer and buyer benefit instead of only an interchangeable slogan. Within `outcome_and_mechanism`, identify the leading reason to choose, its actual supporting capability/evidence, and whether it is merely a category benefit or a supported advantage. Within `reference_adaptation`, account for the reference's why-choose, benefits, proof and process jobs. Missing evidence of uniqueness means narrower honest positioning, not an invented claim. A structurally complete catalogue cannot pass these checks merely because it mentions every service. Keep the existing eight criterion IDs.

Run:

```bash
python3 scripts/copy_library.py audit \
  --copy /absolute/project/build/page-copy.json \
  --brief /absolute/project/build/client-copy-brief.json \
  --context /absolute/project/build/copy-context.json \
  --review /absolute/project/build/copy-editorial-review.json \
  --out /absolute/project/build/copy-scorecard.json
```

Without a completed current review, automated checks cannot approve the draft. Create `docs/COPY-GATE-CHECKLIST.md` from that same result and editorial findings. A changed copy, brief or context invalidates the review. A numeric token in the claim ledger does not prove a sentence is supported; interpret the evidence semantically.

Usually one draft and one or two focused revisions are sufficient. If a blocker remains, resolve the specific missing information instead of endlessly rewriting or claiming a pass. Never make another round of user approval compulsory when the existing brief already settles the decision.

## Review after assembly

Read the actual desktop and mobile page and the conversion flow. Compare the rendered wording with the master and derivative. Check heading wraps, missing text, proof adjacency, highlighted testimonial meaning, modal promises, brochure contents and thank-you delivery. Correct copy in the master and regenerate affected representations; do not quietly remove qualifiers inside HTML.

Run and record the required [rendered-copy comparison](rendered-copy.md) for complete Worker funnels. A pre-build editorial pass does not prove the built page matches. Keep operational launch checks separate from editorial quality.
