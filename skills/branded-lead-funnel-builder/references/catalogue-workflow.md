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
2. Prepare optimized local logo and imagery.
3. Copy and customize `assets/catalogue.example.json`. Derive the offer, CTA, process and follow-up wording from the canonical `build/page-copy.json`. Set `cta.action_label` to its exact primary CTA; the builder's generic fallback is "Take the next step", never an invented estimate offer. Set `include_contents: false` for short guides where a contents page adds no value. A guide can supply `ideal_for_label`/`includes_label` on a content page instead of implying unverified service inclusions. When a test fixture has no real contact destination, omit phone/URL/QR and use `cta.action_body` for its actual delivery instruction.
4. Run:

Use the bundled workspace Python when system Python lacks ReportLab/Pillow. Then run:

```bash
<python-with-reportlab> scripts/build_catalogue.py \
  --config <project>/catalogue.json \
  --output <project>/assets/brochure/services-catalogue.pdf
```

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
