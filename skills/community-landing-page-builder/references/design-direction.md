# Design Direction and Reference Hierarchy

Read this for every default landing-page build. The goal is a current, audience-fit page that preserves brand recognition without inheriting an old website's visual age.

## Reference hierarchy

Use references for different jobs instead of treating one page as a template to clone.

1. **Client truth:** the client's logo, official colors, real imagery, offer, proof, and buyer language control brand and factual decisions.
2. **Conversion architecture:** use [Blue Mountain](https://bluemountain1.pagedemo.co/) as the built-in structural benchmark when the user does not supply a stronger reference. Study its offer clarity, early proof, mechanism, objection coverage, process, and repeated action. Its wording, visual styling, colors, badges, section order, and assets are not defaults. The live page is visually old and must not be used as a modern design benchmark.
3. **Execution quality:** use [Clean Slate Land Solutions](https://www.cleanslatelandsolutions.com/) as a finish benchmark for hierarchy, spacing, proof presentation, media confidence, and conversion clarity. Do not copy its navy and gold palette, exact layout, wording, or components.
4. **Contextual references:** use any user-supplied page for the role the user states. If no role is stated, record whether it is mainly a brand, structure, copy, interaction, or visual reference before applying it.

If a remote benchmark cannot be opened, use the distilled guidance above. Do not block the build or guess unavailable page details.

## Separate brand facts from interface choices

Extract and record two related palettes:

- **Source palette:** exact colors verified in official logos, brand files, or current owned media.
- **Applied palette:** the colors and tonal variants actually used for backgrounds, text, actions, borders, and emphasis.

For each important applied color, record its source and role in the strategy brief. Exact logo colors should remain exact inside the logo. They do not need to cover large page areas. A saturated brand pair may be supported by quieter neutrals, tints, or shades so the page remains recognizable without looking like an enlarged logo or an old brochure.

Do not inherit dated typography, layout, photography treatment, gradients, shadows, badges, or color proportions merely because they appear on the client's current website. Brand fidelity means recognizable identity and truthful assets, not reproduction of every legacy design decision.

Inspect every distinct logo treatment, including the footer. A brightness/invert filter on an opaque logo can turn the entire image into a solid rectangle; it does not remove the background. Use a verified suitable variant or the unmodified mark on a compatible surface.

## Record typography provenance

Separate typography evidence into three labels:

- **Verified brand-guide typography:** fonts named in a current first-party brand guide or equivalent formal standard.
- **Official-site typography:** computed font stacks on the rendered page's actual heading and body elements. A global declaration or downloaded font file may be overridden and is not sufficient evidence.
- **Applied typography:** fonts used in the new page, including loading method, fallbacks, and the reason for any substitution.

Do not call official-site typography a formal brand font when no brand guide confirms it. When official properties disagree, record the conflict and choose the applied system for readability, audience fit, availability, and current execution quality. Do not invent a generic condensed automotive treatment from category stereotypes. Avoid relying on local-only fonts whose appearance changes by operating system; load an appropriately licensed web font or use a deliberate stable system stack.

The supplied official production page controls the default heading and body stacks. When a browser is available, run `scripts/extract_brand.mjs <official-url> --out <project>/build/brand.json` once during research. Record an actual heading and prose selector, text excerpt and computed family in the existing strategy brief; a heading font is not automatically the body font. The page measurement helper reads this report during its existing viewport pass and flags differences. If rendering is unavailable, trace the CSS cascade and disclose that the result is unverified in-browser. A current formal brand guide can override the page. Another official property is evidence of a conflict, not automatic permission to invent a third system. Change the production fonts only for a concrete licensing, loading, language-support, accessibility, or explicit user-direction reason, and use the closest suitable visual match.

An empty or hidden paragraph is not evidence for body typography. A separate long-form font needs a visible, meaningful prose sample of that role. Naming a font in CSS does not load it: bundle a licensed font or configure an authorized web-font source, then verify the font actually painting the heading/prose. The bundled research and page helpers record Chromium's rendered font families; do not call a system fallback the brand font because the declared stack starts with the right name.

Avoiding a third-party font request is not by itself a reason to replace an available, appropriately licensed brand font. Consider local hosting first and retain its license. Keep the strategy, applied design tokens and final reference-fidelity record consistent with the actual rendered fonts. A measured mismatch stays blocked until corrected or a specific permitted exception has been reviewed; do not overwrite source evidence with the chosen fallback to make comparison pass.

## Choose a current audience-fit direction

For a landing-page hero, use relevant photography or an immersive scene with unframed copy, not a split text-and-image-card composition. Overlay copy only when the photo has genuine negative space outside its proof-bearing subject. Readable text over recognizable glazing is still a collision: a darker scrim does not make that area copy-safe. If no suitable composition exists, choose another verified photo or give photo and copy separate unframed areas of the full-width hero, at desktop as well as mobile. Subject protection takes priority over an overlay layout. Size header and hero so readable content from the following section, not merely a few pixels of its background, appears in the first viewport; do not shrink trust copy to manufacture that fit.

Give the selected primary conversion the strongest filled-button treatment. Secondary phone, email or WhatsApp alternatives should use quieter text or outline styling, not a second equally prominent saturated button. Platform brand colors do not override conversion hierarchy.

When narrow-screen wrapping makes the hero consume the first screen, shorten or move supporting copy into the next section before reducing the useful photo to a sliver. Keep the offer, action and verified contact accessible; do not force every desktop sentence into the mobile hero.

Do not shrink meaningful proof or action instructions to fine-print size to preserve a desktop row. Trust-strip supporting text must be at least 13px at every breakpoint; use 14px or larger when space permits. Reflow the strip rather than keep three compressed columns on phones. Check the final computed size after mobile overrides, not just the base declaration. Tiny legal text is not a sizing model for conversion evidence.

State three visual adjectives tied to the buyer and decision. Examples include `credible`, `current`, and `investment-grade` for a high-consideration franchise offer, or `capable`, `local`, and `direct` for a trade service. Do not use generic adjectives without explaining how the type, space, imagery, and color treatment express them.

Avoid combinations that make a new page resemble a legacy sales brochure:

- generic condensed display fonts or `Arial Narrow` used for most headings;
- negative letter spacing;
- all-caps microcopy repeated in every section;
- full-width saturated brand-color bands used as the main rhythm;
- hard offset shadows, thick outlines, circular sales badges, and rule-heavy grids used together;
- numbered rails or checkpoint strips that look like a printed prospectus rather than a useful process;
- old or heavily staged corporate photography treated as the dominant visual language;
- alternating dark-blue, bright-orange, and cream sections without a quieter neutral system.

Any one of these devices can be intentional when the brand or content supports it. The failure is an unexamined bundle of them. Prefer a clean type system, stable spacing, strong image scale, restrained accents, and one or two distinctive motifs tied to the business.

When first-party proof imagery looks older than the desired direction, keep it as honest proof at an appropriate scale. Do not make it the visual hero by default. Use a stronger current first-party asset, an abstract or material treatment, or clearly non-proof illustrative imagery when that better serves the page.

## Visual-age checkpoint

Before implementation, compare the proposed direction with the client source, Blue Mountain's structural lessons, and Clean Slate's execution quality. Record:

- what remains recognizably on brand;
- what legacy styling is deliberately not inherited;
- why the type and color proportions fit the target buyer;
- which one or two visual motifs make the page specific to this business.

During final pixel review, answer:

- Does this feel like a current commercial page, not a cleaned-up version of an old source site?
- Would the target buyer read it as credible and appropriately premium rather than cheap, nostalgic, childish, or generic?
- Are exact saturated brand colors used with restraint and clear roles?
- Is the typography current, readable, and free of a default condensed-template look?
- Is every applied font supported by recorded provenance or a clear audience-fit rationale?
- Do the applied heading and body stacks match the supplied production page, or is every substitution concrete, necessary, and visually close?
- Is the execution at least as intentional as the Clean Slate benchmark while remaining visibly its own design?

A technically correct page fails the visual gate when these questions expose a clear audience-fit or visual-age problem. Fix the system and recheck the full page; do not hide the issue with isolated component polish.
