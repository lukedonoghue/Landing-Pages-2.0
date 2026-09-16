# Research and Claims

## Source inventory

Prefer, in order:

1. client-supplied assets and explicit instructions;
2. the client's official website and service/process/FAQ/testimonial pages;
3. official public business listings tied to the same phone and website;
4. authoritative registries or product documentation;
5. third-party commentary only when clearly labelled and necessary.

Store live scrape/capture artifacts outside production assets. Record source URL, retrieval date, and whether the fact may drift.

## Reference-page matrix

For each reference section record:

| Position | Visible pattern | Persuasive job | Evidence used | Objection handled | CTA behavior | Client adaptation |
|---|---|---|---|---|---|---|

Do not describe a visual block only by its component name. Explain why it exists in the sales argument.

## Claim ledger

Use this schema in `docs/CLAIM-LEDGER.md`:

| Claim | Exact source | Retrieved | Confidence | Approved? | Required qualifier | Page/catalogue locations |
|---|---|---|---:|---|---|---|

Rules:

- A claim absent from the ledger cannot ship.
- Preserve qualifiers such as “some,” “typically,” “when permitted,” and “depending on site conditions.”
- Separate business proof from customer outcome; translate credentials into what they reduce or enable.
- Mark time-sensitive review counts, ratings, prices, service areas, and response times with a recheck date.
- Do not turn absence of evidence into a negative claim.

## Reviews

- Match a public listing to the client's exact website and phone before extracting reviews.
- Keep reviewer name, rating, quote, date, source link, and profile image provenance together.
- A shortened excerpt may remove sentences but may not intensify praise, broaden results, or combine different reviewers.
- Use ellipses only when omission could otherwise mislead.
- Use a public avatar from the same review when available. If it is an initials avatar, preserve it as such. Never generate a photorealistic replacement.
- Do not infer an aggregate rating from a small sample of individual reviews.
- Place proof near the claim it supports: communication reviews near process, finish-quality reviews near outcomes, service-specific reviews near the relevant service.

## Asset integrity

- Do not label unrelated project images as before/after.
- Do not remove watermarks or ownership marks.
- Do not use reference-page logos, badges, photos, videos, or brochure art in the client result.
- Keep a manifest of source file, generated derivatives, dimensions, format, and intended placement.

## Rendered brand evidence

Use `node scripts/extract_brand.mjs <client-url> --out <project>/build/brand.json` with the discovered Playwright module/browser paths when the design needs measured brand matching. It records computed heading/body typography, actual button styles, loaded fonts, images, screenshots, and approximate visible surface-color coverage at 390 and 1440 widths. The area calculation can double-count overlapping boxes and describes the first viewport only; inspect the screenshots before deciding the brand hierarchy. Never turn an approximation into a claim about the entire site's palette.

Customer language and competitor research should answer the buyer's actual decision, not satisfy arbitrary collection quotas. Record verbatim source phrases separately from proposed copy; map each objection to relevant proof and its intended page/catalogue location.
