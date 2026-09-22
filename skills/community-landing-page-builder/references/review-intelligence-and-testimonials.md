# Review Intelligence and Testimonials

## Purpose

Customer feedback is both research evidence and potential on-page proof, but those are separate permissions.

Use review intelligence to understand the buyer's real problems, desired outcomes, objections, praised delivery practices and natural language. Use testimonial publication only when the exact review, reviewer identity and any avatar have a valid publication basis.

Never treat "publicly visible" as permission to copy, store, transform or republish a review.

## Required artifacts

New complete builds with `quality.review_intelligence_version >= 1` keep:

- `research/reviews/review-manifest.json`: source discovery, exact business matching, rights/use decisions, provider configuration and rights-cleared review records;
- `build/review-insights.json`: mechanically aggregated themes from the agent-authored review analysis;
- `build/testimonial-selection.json`: the exact publishable testimonials and optional provider-dynamic review widgets selected for the page;
- `build/reviews/result.json`: final source/render integrity evidence for the quality gate.

The semantic work remains an AI research task. `review_workflow.py` validates provenance, freshness, permissions, aggregation and rendering; it does not invent themes or infer customer meaning itself.

## Research order

1. User-supplied testimonials, exports, screenshots and permission records.
2. Testimonials or reviews already published by the business on its own site or owned properties, with a recorded reuse basis.
3. Review platforms whose terms or owner agreement permit the intended research/publication use.
4. Provider-native display integrations, such as Google Places, only under that provider's current display rules.
5. Other third-party feedback only when there is a clear lawful/contractual basis for the intended use.

For every source, match it to the exact business/location before using it. Useful evidence includes the business website, phone, address, location name, stable provider/place identifier, or a user confirmation. Ambiguous matches are blocked, not guessed.

## Review intelligence

For each rights-cleared review that may be analyzed, record structured observations in the manifest:

- customer problem or frustration;
- desired outcome;
- buying trigger;
- praised capability or delivery practice;
- practical benefit;
- emotional benefit;
- objection resolved;
- differentiator signal;
- useful voice-of-customer phrase;
- testimonial role;
- proof strength from 1 to 5.

Do not infer unsupported facts from a review. Do not convert an aggregate theme into a quotation.

`review_workflow.py compile PROJECT` aggregates those reviewed observations into `build/review-insights.json`. The resulting counts are evidence of recurrence within the inspected corpus, not market-share, uniqueness or conversion claims.

Use the insight file to improve the existing strategy brief:

`customer signal -> company capability -> buyer consequence -> benefit -> proof/limit -> page section`

Classify the resulting positioning with the existing taxonomy:

- `table_stakes`;
- `category_benefit`;
- `useful_advantage`;
- `supported_comparison`;
- `verified_unique`.

A recurring review theme can support relevance and customer language. It does not by itself prove exclusivity.

## Testimonial selection

A publishable testimonial must remain one person's evidence. Keep together:

- stable review ID;
- exact quote;
- reviewer display name;
- optional source-displayed public details such as role, company or location when the testimonial source itself provides them and the publication basis covers them;
- rating when the source provides one;
- publication/review date when available;
- source name and source URL;
- reviewer profile URL when available;
- avatar URL or local asset only when its publication basis is recorded; local avatar files are hash-bound in the manifest;
- rights basis;
- testimonial roles and proof strength.

Never:

- enrich a reviewer by finding a role, employer, location, social profile or other identifying detail from a separate source;
- merge reviewers;
- split one review into several apparent customers;
- pair one person's quote with another person's image;
- invent a surname, title, location, rating or date;
- generate a photorealistic reviewer/customer image;
- turn initials into a fake customer photograph;
- "enrich" a reviewer by searching for unrelated personal details elsewhere.

`review_workflow.py compile PROJECT` selects a small, role-diverse set of publishable static testimonials. The copy/layout agent may deliberately reduce the set, but it may not substitute unsupported proof.

Static testimonials use this page contract:

- wrapper: `data-testimonial-id="<manifest id>"`;
- source: `data-testimonial-source="<source name>"`;
- exact reviewer display name and quote remain visible;
- a `publishable_full` testimonial includes the approved avatar URL/path;
- rating/date/source attribution remain visible when they are part of the selected record.

Proof should sit near the claim it supports. A generic three-card review row is not a requirement.

## Publication states

Each stored review has one of these publication states:

- `research_only`: may inform analysis when `analysis_allowed` is true, but is not quoted on the page;
- `publishable_text`: exact text and reviewer attribution may be published, but no reviewer image is authorized;
- `publishable_full`: exact text, reviewer attribution and the recorded avatar may be published;
- `blocked`: do not use for analysis or publication until the blocker is resolved.

The manifest separately records whether analysis is allowed. A review can therefore be publishable but not eligible for AI-derived positioning, or research-only but still useful for customer-language analysis.

## Google Places / Google reviews

Google Maps content has provider-specific restrictions. Current Google Maps Platform terms prohibit scraping/exporting and copying/saving user reviews outside the service, and the Places terms permit use without a map while retaining attribution and other service-specific rules. The Places JavaScript API can return review text, rating, time and `AuthorAttribution` with display name, Google Maps profile URI and photo URI.

Therefore this skill uses Google Places in **provider-dynamic display mode only**:

- do not scrape Google Maps;
- do not save Google review text or reviewer photos into the project;
- do not use Google Maps review content as AI training/research material for generated positioning or copy;
- keep only permitted stable configuration such as the Place ID and the owner's enablement decision;
- fetch the displayed reviews at runtime through the official Places JavaScript API;
- display available author attribution close to each review;
- link to the author/source where supplied;
- show the configured ordering/filtering notice;
- preserve Google/Places attribution required by the current documentation;
- do not enable the provider or a metered Google service without the owner's explicit setup decision.

The bundled `assets/google-reviews-widget.js` renders this provider-dynamic mode after the owner has configured a supported Google Maps JavaScript loader. The widget contains no API key and does not store returned review content.

Relevant provider documentation, rechecked 2026-09-22:

- https://developers.google.com/maps/documentation/javascript/place-reviews
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms
- https://cloud.google.com/maps-platform/terms/maps-service-terms

If provider terms change, follow the current terms rather than this snapshot.

## Page and image behavior

A reviewer avatar is proof imagery, not decoration.

For a static testimonial:

- record its exact provenance and publication basis;
- never crop a face so aggressively that identity is lost;
- do not place copy over the face;
- use the same person's avatar and quote;
- use useful alt text such as "<name>, customer reviewer" when the identity is intentionally displayed.

For provider-dynamic Google reviews, use the provider-returned `photoURI` directly at runtime and do not download it into `assets/reviews`.

If no lawful/authorized reviewer photo exists, use a text-led testimonial design. Do not manufacture social proof to fill a layout.

## Copy integration

Before drafting the page, read `build/review-insights.json` when it exists and is current.

Use it to answer:

- what problems customers actually describe;
- what outcomes they value;
- what delivery practices they repeatedly praise;
- which objections are visibly reduced;
- what customer language sounds natural;
- which candidate advantages deserve stronger company evidence.

Then verify those themes against client/company evidence before making company-level claims.

Only `build/testimonial-selection.json` may supply testimonial quotations to the final page.

## QA and blocking rules

The review gate blocks when:

- the source is not matched to the exact business;
- stored review analysis lacks a recorded analysis basis;
- a Google Maps review has been copied into project storage;
- a testimonial quote, name, rating, date, source or avatar does not match its selected record;
- a quote was materially rewritten;
- two reviewers were combined;
- an avatar belongs to someone else;
- a generated person is presented as a reviewer;
- publication rights are unresolved;
- a required provider-dynamic widget is configured but not present;
- a Google widget stores review content instead of fetching at runtime;
- the manifest/insights/selection hashes are stale.

Use:

```bash
python3 scripts/review_workflow.py compile .
python3 scripts/validate_reviews.py .
```

After the ordinary gate snapshot exists, record final review evidence with:

```bash
python3 scripts/workflow.py record-review-evidence .
```

The gate recomputes the deterministic insight and testimonial-selection records from the current manifest, so editing a compiled quote/name/avatar/source directly is a blocker. Local reviewer avatars are also hash-bound. The gate verifies provenance and rendered integrity. It does not claim that the selected reviews are representative of all customers or that using them will improve conversion.
