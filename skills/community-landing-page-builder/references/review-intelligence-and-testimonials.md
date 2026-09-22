# Review Intelligence and Testimonials

Review research has two separate jobs:

1. understand what real customers say they needed, valued and experienced so the strategy and copy use real buyer language; and
2. publish only testimonials whose text, identity, image and attribution can be used truthfully under the source's rules.

A review that is useful for research is not automatically publishable. Public discoverability is not publication permission.

## Required workflow

Run this workflow during business research whenever customer feedback is reasonably available. Do not delay a build indefinitely to hit an arbitrary review quota. Prefer enough recent, relevant feedback to see repeated patterns, then stop when additional reviews are not materially changing the strategy.

### 1. Discover and identity-match sources

Prefer, in order:

1. user-supplied testimonials, approvals and customer assets;
2. testimonials/reviews published by the business on its owned website or supplied CRM/export;
3. official public business profiles that can be matched to the same company/location;
4. supported review-platform integrations;
5. other third-party feedback only when its provenance and permitted use are clear.

For every source record:

- provider and canonical source URL;
- retrieval date;
- exact business/location identity evidence such as matching website, phone, address or provider place/profile ID;
- match status: `matched`, `ambiguous`, or `mismatch`;
- research-use basis;
- publication rules for review text and avatars;
- required attribution;
- storage policy.

Do not use an `ambiguous` or `mismatch` source to support a client claim or testimonial.

### 2. Build the review manifest

Use `research/reviews/review-manifest.json` as the normalized source record. Start from `assets/review-manifest.example.json`.

Keep each review attached to one source and one reviewer. Preserve:

- source ID and provider review ID where available;
- reviewer display name;
- reviewer profile URL when provided by the source;
- avatar URL/local path and provenance when publication is permitted;
- rating and date when supplied by the source;
- canonical review URL when available;
- verbatim text only when the source/storage policy permits it;
- a hash/provider reference when raw text must remain transient;
- publication state and rights/attribution basis;
- analysis tags used for aggregate intelligence.

Never enrich a reviewer by searching for unrelated personal information. Use only the identity presented by the review source or supplied directly by the client.

### 3. Extract customer intelligence

For each relevant review, record only what the text actually supports:

- `problems`: the situation or frustration before buying;
- `desired_outcomes`: what the buyer wanted;
- `buying_triggers`: what prompted action;
- `objections_resolved`: concerns the experience resolved;
- `praised_capabilities`: specific things the business did well;
- `practical_benefits`: concrete buyer consequences;
- `emotional_benefits`: supported emotional outcomes, not inferred anxiety;
- `voice_phrases`: short customer-language fragments useful for vocabulary, never silently converted into testimonials;
- `differentiator_signals`: observations that may support a reason-to-choose hypothesis;
- `testimonial_roles`: the material claim this review could substantiate;
- `proof_strength`: 1 to 5, based on specificity and relevance rather than positivity alone.

Aggregate those records with:

```sh
python3 scripts/review_workflow.py analyze PROJECT
```

This writes `build/review-insights.json`. The result must show counts and supporting review IDs for each theme so the writer can distinguish repeated evidence from one anecdote.

### 4. Feed strategy and copy

Use review intelligence to strengthen the existing strategy brief, not to create a second positioning system.

For each material review-derived reason, map:

`customer problem -> praised capability -> buyer consequence -> benefit -> proof/limit -> planned section`

Classify the result using the existing positioning labels:

- `table_stakes`
- `useful_advantage`
- `supported_comparison`
- `verified_unique`

Customer feedback can show that buyers repeatedly value a capability. It does not by itself prove the capability is unique or better than every competitor.

The copy agent may paraphrase aggregate findings as ordinary marketing copy when the underlying business fact is separately supportable. It must not present a paraphrase as a quotation or imply every customer had the same outcome.

### 5. Select complementary testimonial candidates

Run:

```sh
python3 scripts/review_workflow.py select PROJECT
```

This writes `build/testimonial-selection.json`.

Selection prefers:

- exact business match;
- publishable status;
- specific, credible wording;
- distinct testimonial roles;
- stronger proof;
- enough attribution to identify the source honestly.

Do not manufacture a three-card grid. One strong testimonial is better than three repetitive or weak ones. Use a larger section only when the evidence supports it.

Publication states:

- `research_only`: may inform aggregate analysis, never rendered as a testimonial;
- `publishable_text`: text/name/source may be rendered, avatar may not;
- `publishable_full`: text/name/source and source-authorized avatar may be rendered;
- `blocked`: do not use for research claims or publication.

### 6. Images and reviewer identity

A reviewer photo is proof-bearing identity media.

Rules:

- never generate or synthesize a reviewer/customer avatar;
- never use an initials avatar as if it were a photograph;
- never pair one person's quote with another person's image;
- never infer a portrait from a social profile unrelated to the review source;
- never crop or stylize a face so aggressively that identity becomes misleading;
- preserve the source attribution required for the image;
- when avatar publication is not allowed, render the testimonial without a portrait.

### 7. Google Reviews and other restricted providers

Do not scrape Google Maps or another provider in violation of its terms.

Google review support is optional and provider-dependent. When enabled:

- obtain content through an approved Google Places/Maps integration or another user-authorized compliant source;
- keep provider place/review identifiers and exact business-match evidence;
- preserve source-provided reviewer attribution;
- show required Google attribution and source access;
- obey current provider storage/cache rules;
- do not copy provider-controlled avatars into permanent project assets when the provider requires live/provider-controlled delivery;
- do not make a Google API key, paid SKU or metered service a prerequisite for the ordinary local landing-page build.

If compliant publication cannot be established, classify the record `research_only` or `blocked` and use another proof source.

### 8. Claim-adjacent placement

Place proof where it supports the decision:

- communication review beside the communication benefit;
- process review beside the process explanation;
- outcome review beside the relevant supported result;
- broad recommendation near the final CTA when useful.

A dedicated testimonial section may also exist, but do not isolate all proof from the claims it substantiates.

The rendered testimonial component must preserve the selected record's:

- quote;
- display name;
- rating/date only when actually sourced;
- provider/source label;
- avatar only when `publishable_full`;
- source link/attribution when required;
- claim IDs/testimonial role.

### 9. Validation

Before copy acceptance, run:

```sh
python3 scripts/validate_reviews.py PROJECT --stage research
```

Before final acceptance, run:

```sh
python3 scripts/validate_reviews.py PROJECT --stage rendered
```

Block when:

- a used source is not identity-matched;
- a testimonial is not mapped to one source review;
- the quote is not verbatim or an allowed shortening of that review;
- reviewer identity or avatar provenance is mismatched;
- a generated avatar is used;
- rating/date/source is invented;
- publication state is unresolved or incompatible with the rendered fields;
- required attribution/source access is missing;
- a research-only review is rendered;
- selected testimonials no longer match the current manifest.

Record unresolved rights or provider limitations honestly and use another proof type rather than fabricating completeness.
