# Write and review with the reference library

Use this for new page copy or a substantial rewrite. Small copy corrections should reuse the approved context and recheck the affected claims and components without rebuilding all research.

For a website-to-copy trial, use [copy-only-test.md](copy-only-test.md). Set `output_mode: copy_only` and the requested `required_components`; a page-only test does not require modal, thank-you, brochure, HTML or backend generation. When no follow-up timing is known, use an empty `follow_up_promise` and make no invented timing promise.

## Select evidence and examples

New writer contexts store required research, manifest and funnel-contract paths relative to the project. Keep the brief's source_manifest project-relative as well. An unchanged project can be moved to another directory or machine and retain its content/review hashes; editing relocated evidence still invalidates the audit.

Legacy contexts with absolute paths remain readable only inside their original project. After moving a legacy project, copy its actual research files, re-run context preparation and perform the real editorial freshness review. Do not merely overwrite hashes or read evidence from the old project's location. Unchanged customer-facing copy and offer do not need a new user approval just because supporting metadata was refreshed.

Read `copy-doctrine.md`. Create `build/client-copy-brief.json` with: `client_name`, `service`, `audience`, `sector`, `offer_type`, `intent`, `primary_cta`, `follow_up_promise`, `required_sections`, `claims`, and optional `buyer_job`, `style`, `primary_reference_url`, `forbidden_claims`.

Each claim has `id`, `text`, `source`, `evidence`, `approved` and relevant `qualifiers`. Keep the full claim ledger and underlying research alongside this brief. `approved` means permitted for this draft; it is not a substitute for examining the source. Operational promises supplied directly by the user can use the user's dated instruction as evidence. Unknown facts stay unknown.

When a research manifest is available, add `source_manifest` and a `source_id` for each approved website claim. Preparation verifies the supporting excerpt against its saved source. Changes to the manifest or source text invalidate later review. Use `evidence_type: user_instruction` only for facts the user actually supplied. Source matching establishes provenance, not semantic entailment.

Use the library helper from the skill directory:

```bash
python3 scripts/copy_library.py prepare \
  --brief /absolute/project/build/client-copy-brief.json \
  --out /absolute/project/build/copy-context.json
```

The helper chooses up to three curated references using offer, audience, intent, sector and source-family diversity. An explicit reference is prioritized when it is eligible. It excludes holdout families, error pages, unreviewed candidates and OCR. Read the returned selection reasons. If the examples do not fit, correct the classification or deliberately curate another example; do not silently pretend the closest match is a good match.

Suitable field vocabulary includes `B2C`, `B2B`, `B2C/B2B`; offers such as `brochure_quote`, `consultation`, `demo`, `menu_quote`, `pricing_booking`; intents such as `planned_project`, `urgent_service`, `complex_project`, `high_anxiety`, `alternative_aware`. Free text is also supported. Use words that describe the actual offer.

Search selected patterns without loading the full archive:

```bash
python3 scripts/copy_library.py search 'brochure quote home improvement'
```

`--include-unreviewed` is an exploration mode. Its results are explicitly not approved writing instructions. Read source context before promoting anything. Database details and promotion rules are in `copy-library/README.md`.

## Writer prompt

Use the following task framing with the current context and research documents. It can be executed by the current writing agent or the configured copy model; creating a prompt file does not count as executing it.

> Write the complete funnel copy for this client using the current brief and sourced research. Treat client evidence as the only basis for client facts. Use the selected examples for structure, rhythm and rhetorical choices. Read each example's cautions. First produce a short benefit/proof map and assign one distinct persuasive job to each section. Then write complete hero, section, card, testimonial, FAQ, primary CTA, modal, brochure-offer and thank-you wording required by the brief. Preserve scope and qualifiers. Make the headline sequence understandable by itself. Do not invent proof or repeat the same benefit as new sections. Record unknowns separately and keep them out of customer-facing text. Return the complete copy plus claim IDs for the sections that use them.

For new builds, use `build/page-copy.json` as the structured master with `h1`, `primary_cta`, `sections`, `modal`, `thank_you`, and `brochure` if needed. Generate `docs/SECTION-COPY.md` with `copy_library.py render --copy <absolute-json-path> --out <absolute-markdown-path>`. Every section has a stable `id`, `headline`, complete `body`, `bullets`, `items`, `questions`, or `testimonial` as appropriate, and `claim_ids`. FAQ questions are objects with complete `question` and `answer`. Primary CTA fields are `cta`; use `cta_role` for controls with other purposes. The modal has `submit_label` and `follow_up_promise`; the thank-you object has `follow_up_promise` and accurate delivery copy. Do not maintain two independently edited drafts. Existing projects may retain their master format if they verify revision consistency.

Shared offer, CTA and follow-up values come from the existing `funnel.json`. The client copy brief is a research-enriched snapshot of that contract, not a new authority. When the usual project-root `funnel.json` exists, preparation checks it and saves its hash; later changes require refreshing the brief and context.

## Reviewer prompt

Review current copy with the same client facts and reference lessons. Do not provide the writer's self-rating or an old pass score as evidence. A fresh context is useful for substantial work; the workflow also supports a separate sequential review.

> Review this draft against the actual client evidence, user brief and selected reference lessons. Check message match, exact claim support and qualifiers, outcomes and delivery mechanism, objection coverage, the headline-only story, natural brand voice and density, offer/follow-up consistency, and appropriate reference adaptation. For each finding identify the section, quote the problematic text, explain its effect and provide a concrete revision or identify missing evidence. Distinguish blocking factual/brief failures from substantive improvements and optional polish. Do not approve a topic list, unsupported assertion, stale offer or imported client detail. Revise the affected copy, then assess the final revision. Explain any remaining uncertainty. Your review is editorial judgment, not a conversion prediction.

Save `build/copy-editorial-review.json` against the final revision, with exact file hashes `copy_sha256`, `brief_sha256`, `context_sha256`, `decision`, `unresolved_findings`, and `checks`. The eight criterion IDs are:

`message_match`, `claim_support`, `outcome_and_mechanism`, `objection_coverage`, `headline_story`, `voice_and_density`, `offer_consistency`, `reference_adaptation`.

Each check has `criterion`, `verdict`, and `evidence` containing a short exact `copy_excerpt` from the final copy and an `explanation`. For claim support, also record which client sources were actually inspected. A pass requires actual inspection; never fill generic pass rows just to satisfy the checker. Compute hashes only after all revisions are saved. Record the reviewer/model and execution result truthfully if another runner is used.

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

Record this as a separate rendered-copy check in the existing QA evidence. A pre-build editorial pass does not prove the built page matches. Keep operational launch checks separate from editorial quality.
