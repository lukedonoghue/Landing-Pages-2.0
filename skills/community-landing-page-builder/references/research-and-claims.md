# Research and Claims

## Source order

Prefer evidence in this order:

1. user-supplied facts, assets, and instructions;
2. the business's official website and owned media;
3. official public profiles that match the same business, website, and phone;
4. authoritative registries, product documentation, or industry sources;
5. credible editorial coverage when clearly attributed;
6. third-party commentary only when necessary and clearly labelled.

Record the URL and retrieval date for material facts. Recheck facts that can drift, including ratings, review counts, prices, availability, service areas, staff, and response times.

## Compact strategy brief

Write one `build/strategy-brief.md`. Keep it decision-focused:

- buyer situation and likely awareness stage;
- desired action;
- offer or result;
- real process or capability that makes the result plausible;
- strongest trust anchor;
- leading reason to choose this business: buyer benefit, specific supporting capability, source and limits, and the alternative or buyer frustration it addresses; distinguish a useful advantage from proven uniqueness;
- primary objection or perceived risk;
- source or search intent, supplied or clearly labelled as inferred;
- source conversion contract: exact CTA and offer, conversion type, required fields, consent, promised delivery or follow-up, destination type, and success behavior;
- verified public enquiry phone, source and any named contact's supported relationship to the business; record absence/conflict rather than inventing details;
- typography provenance: verified brand-guide fonts when available, fonts declared by the supplied official page, fonts declared by other current official properties, and any conflict between them;
- visual tone and brand evidence;
- optional modules selected and why.

Ask the user only when a missing answer would materially change one of these decisions.

Choose the leading advantage rather than collecting an unranked list of positives. In the same brief, compare up to three plausible angles for buyer relevance, evidence strength and specificity, then select one. Map the strongest supporting reasons as `source fact -> buyer consequence -> benefit -> proof/limit -> section`. Read real customer feedback for the customer's problem and language when available. Do not turn inferred concerns into quotations. If competitor evidence is absent, say the advantage is supported but uniqueness is unverified; do not claim it is exclusive. If no distinguishing capability is supported, lead with the clearest specific offer and honest fit, not invented superiority. This is a few rows in the existing brief, not a new research report or prerequisite questionnaire.

Label those reasons in the same rows: `table_stakes` (expected category competence), `useful_advantage` (a specific capability/term valuable to this buyer), `supported_comparison` (a scoped difference backed by comparable evidence), or `verified_unique` (exclusivity actually established). A meaningful combination of useful advantages can lead the page; do not force uniqueness. Rank the buyer's material objections by decision impact and mark whether each comes from observed customer evidence or a reasonable hypothesis. Capture a short actual brand/customer language sample when available and describe the intended register; do not infer a fearful emotional state from a keyword alone.

The supplied page is evidence of conversion intent even when its production endpoint cannot or should not be reused. A public endpoint is not permission to transmit data, run a live test, or adopt unsafe behavior. If the source form is broken or unsafe, preserve the form offer and buyer journey while rebuilding the local behavior safely.

Inspect the visible content around the source contact/form, not only its fields. Capture commercial differentiators such as a conditional price promise or guarantee with their exact eligibility limits; either use them accurately or record why they are excluded. A missing price list does not imply there is no useful price-related offer. Do not invent terms when they are unclear.

## Claim ledger

Write `build/claim-ledger.md` for material claims that will appear on the page. Use a compact table:

| Claim | Source | Retrieved | Qualifier or limit | Planned location |
| --- | --- | --- | --- | --- |

Record numbers, credentials, ratings, awards, guarantees, prices, timing, geographic scope, comparative claims, customer outcomes, and proof-bearing identities. Ordinary descriptions that are directly visible on the official site do not need a separate row unless they can mislead or drift.

In each material claim's existing qualifier column, distinguish company assertion, individual customer experience, demonstration, internal measurement or independent evidence, and state the scope it supports. A communication review does not prove durability; years in business do not establish financial returns; a product demonstration does not prove every customer's result. Safety, financial, regulated-outcome, guarantee and comparison claims need matching evidence and visible material limits. Narrow or omit unsupported claims instead of borrowing stronger language from a reference.

Rules:

- Preserve words such as `some`, `typically`, `when eligible`, and `depending on conditions`.
- Do not turn a company achievement into a promised customer outcome.
- Do not infer a guarantee, exclusivity, certification, or availability from suggestive language.
- Do not use a competitor's statement as a fact about the client.
- Do not use schema, alt text, metadata, or hidden text to make a claim that would be unacceptable in visible copy.

## Reviews and people

Read [review-intelligence-and-testimonials.md](review-intelligence-and-testimonials.md) whenever customer feedback is reasonably available. Review research is a positioning input, not only a testimonial hunt.

- Match the review source to the exact business and location before using it.
- Build `research/reviews/review-manifest.json` and keep each review tied to one source and one reviewer.
- Extract supported customer problems, desired outcomes, buying triggers, objections resolved, praised capabilities, practical/emotional benefits, differentiator signals and useful voice-of-customer language.
- Run `python3 scripts/review_workflow.py all PROJECT` to create source-linked aggregate insights and complementary testimonial candidates.
- Feed repeated review themes into the existing leading-advantage analysis, but do not infer uniqueness or a comparative claim from reviews alone.
- Keep reviewer identity, quote, rating, date, source, and avatar provenance together.
- Shorten only without changing meaning or increasing certainty.
- Never combine reviewers or split one person's statement into several independent testimonial cards.
- Never turn aggregate/paraphrased review intelligence into a quotation.
- Separate `research_only`, `publishable_text`, `publishable_full` and `blocked` records. Public discoverability does not establish publication permission.
- If only one or two verified testimonials exist, use fewer cards or a different verified proof type.
- Never generate a photorealistic reviewer, customer, employee, franchisee, patient, or owner.
- Do not scrape Google Maps or another restricted provider. Google review publication is an optional compliant provider integration, not a prerequisite for the local build.
- Validate review evidence before copy acceptance with `python3 scripts/validate_reviews.py PROJECT --stage research`.

## Reference and competitor use

For a supplied reference or existing landing page, use the material coverage table from `reference-fidelity.md` inside the same strategy brief:

| Buyer question or media beat | Source | Specific client answer/proof | Final section | Kept, changed, or omitted and why |
| --- | --- | --- | --- | --- |

Preserve useful buyer questions, proof rhythm, media cadence, and CTA logic. Do not copy wording, proprietary assets, brand styling, or literal geometry.

When direct competitors are easy to identify and the client's differentiation remains unclear, inspect two or three official competitor pages. Compare promise, offer, proof, CTA, and repeated category language. Select only a supportable gap. Do not run this step when the client already has a clear position or when research would add delay without changing the page.

Classify a third-party name as a comparator, platform or specification, or provenance credential. Publish a named comparison only with substantiation and user approval. Keep factual platform and provenance names when they are useful.

## Research stopping rule

Stop when the offer, audience, action, material claims, primary objections, brand direction, and image roles are supported well enough to build. Do not collect arbitrary quotas of reviews, competitors, quotes, or emotional language.
