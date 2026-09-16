# Catalogue Workflow

## Purpose

The catalogue should help the buyer choose the right service and understand the next step. It is not a company-history document and must not introduce claims absent from the landing-page claim ledger.

## Default composition

1. **Cover:** desired transformation, category, region, phone, brand image.
2. **Service selector:** concise service list, what each accomplishes, proof pillars.
3. **Service pages:** outcome headline, fit/use cases, scope, differentiator, important limitation.
4. **Process:** what happens from evaluation through handover.
5. **Final CTA:** offer, phone, URL/QR, and exact follow-up promise.

Use more or fewer pages according to the service set. Do not pad the document.

## Build

1. Read the PDF skill.
2. Prepare optimized local logo and imagery. Named missing/corrupt assets block the build; they never silently become coloured panels. A deliberate image-free section must explicitly set `image_mode: "none"` and omit/clear its `image`. Set a real local `image` path (optionally `image_mode: "asset"`) when using imagery. Omitting `brand.logo` deliberately uses the complete business name as a wordmark; a named missing logo is an error.
3. Copy and customize `assets/catalogue.example.json`. Derive the offer, CTA, process and follow-up wording from the canonical `build/page-copy.json`. Set `cta.action_label` to its exact primary CTA; the builder's generic fallback is "Take the next step", never an invented estimate offer. Set `include_contents: false` for short guides where a contents page adds no value. A guide can supply `ideal_for_label`/`includes_label` on a content page instead of implying unverified service inclusions. When a test fixture has no real contact destination, omit phone/URL/QR and use `cta.action_body` for its actual delivery instruction.
4. Run:

Use the bundled workspace Python when system Python lacks ReportLab/Pillow. Then run:

```bash
<python-with-reportlab> scripts/build_catalogue.py \
  --config <project>/catalogue.json \
  --output <project>/assets/brochure/services-catalogue.pdf
```

The builder reports its actual page count and font hashes. It measures text, wraps headings and uses bounded font sizes, and automatically continues long contents, process and CTA-step lists across pages. Contents page references account for those added pages and link directly to the corresponding service pages. The supplied brand region is printed on the cover. It writes the replacement PDF atomically only after the entire build succeeds.

5. Render every page to PNG/JPEG and inspect a contact sheet.
6. Iterate until there are no clipped lines, overlaps, unreadable contrast, broken glyphs, or low-resolution images.
7. Run:

```bash
python3 scripts/render_catalogue_cover.py \
  <project>/assets/brochure/services-catalogue.pdf \
  <project>/assets/brochure
```

## Verification

- Reopen the final PDF and confirm metadata and page count.
- Check phone/URL/QR values and clickable PDF links.
- Confirm every number and customer outcome exists in the claim ledger.
- Confirm the page's download link resolves to the final PDF.
- If a separate handoff copy is created, compare SHA-256 hashes with the website copy.
- Keep the PDF out of the landing-page critical path; use the lightweight WebP cover on the page.

## Decision limits

- Do not invent service inclusions to fill a page.
- Do not add a QR target that has not been verified.
- Do not imply the brochure download is delivered by email when it is only exposed on the thank-you page.
- Do not claim PDF creation is complete until every rendered page has been visually inspected.


## Fonts and content limits

The skill ships DejaVu Sans regular/bold with the upstream license and checksums under `assets/pdf-fonts`. It needs no system-font lookup or font download at build time. Its default supports many Latin, Greek and Cyrillic names; actual glyph coverage is checked before drawing. For another suitable typeface, set `brand.fonts.regular` and `brand.fonts.bold` to licensed local TrueType files (relative to the catalogue JSON, or absolute for a local exercise). Keep the accompanying license in the handoff. Image/font paths are not altered when typographic punctuation is normalized in displayed text.

A missing glyph produces a field-specific error instead of a black square. RTL, bidirectional controls and complex text requiring shaping are explicitly blocked by this simple canvas layout. For those scripts, use a shaping-capable custom PDF layout, preserve the actual spelling, and inspect the rendered result. Do not transliterate a client name merely to obtain a pass. This is not a claim of universal language support.

Some sections intentionally have fixed composition areas: cover wording, one service's detail columns/callout, the four-pillar proof panel, a single step group and the final action/contact panel. When a complete item cannot fit at a readable size, the command returns `status: blocked` with its exact field, reason and next action. The previous PDF stays unchanged. It never adds ellipses, slices a name/summary, drops extra pillars or hides conflicting delivery instructions.

The agent should respond by adjusting the project-specific layout or moving complete content to appropriate additional pages, preserving approved wording. It can copy the builder and its font resources into the project for a custom layout, or use another reviewed PDF renderer. Keep font paths portable. Do not edit the shared installed helper for one client, shorten qualifiers or quietly rewrite the master. Only a material copy change needs the applicable copy approval; layout correction is normal autonomous work.

A build pass is not visual approval. Always render every final page, inspect readability/crops/contrast/link and QR placement, then run the required rendered-copy gate against the served PDF and canonical master. Automatic page-bound and text-overlap regressions support this review; they do not replace it.

## Regression command

Run `python3 tests/test_catalogue.py` from the installed skill with its supported Python and Poppler tools. It generates actual PDFs and checks long names/CTAs/qualifiers, pagination and contents references, Unicode extraction/font embedding, missing/corrupt assets, intentional image-free modes, overflow diagnostics, previous-file preservation and QR contrast. The quickstart `check` command includes this suite.
