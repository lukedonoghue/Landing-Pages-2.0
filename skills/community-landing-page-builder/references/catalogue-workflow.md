# Brochure or Useful PDF Workflow

For a complete landing-page build, create a useful PDF by default. Research determines its purpose: service overview, options comparison, preparation checklist, catalogue, menu or verified prices. Do not create generic padding or invent a download-led primary offer. Omission requires a concrete buyer-research reason and sources in the existing strategy brief, not merely the absence of a supplied brochure or explicit request. Copy-only and audit-only work does not require a PDF.

## Content and build

- Reuse the verified claims, brand tokens, offer, contact details, and qualifiers from the page.
- Organize the document around the buyer's decisions, not a company-history template.
- Use the actual cover or a verified page spread as the page preview.
- Keep page copy in the canonical copy master before layout.
- Keep the document useful to its reader. A necessary independent-demo disclosure can state provenance, fictional-data limits and no real-business routing in a compact note. Receipt checks, CRM cleanup, QA steps, GTM and consent setup are owner-handoff material, not brochure content.
- Use available PDF/document tooling and embedded fonts with known rights.
- Link the real locally hosted PDF visibly from the funnel. For a genuinely gated offer, verify its promised delivery from the confirmed success state. Never claim email delivery unless configured and tested.
- Keep actionable PDF links within the funnel, apart from appropriate phone/email or required third-party conversion destinations. Do not link back to the main business website. Research citations belong in owner notes.

## Image composition rules

Classify every image before layout.

- Decorative images may sit behind text only when contrast and subject safety are verified.
- Diagrams, roadmaps, screenshots, documents, and any image with labels must be separate figures or have a protected text-free region.
- Do not place titles or body copy over existing image text.
- Do not place text over a face or the subject needed to understand the photo.
- Do not enlarge portraits until heads, hands, or meaningful context are clipped.
- Do not use `cover` behavior for information-bearing figures.
- Reusing a page photograph inside the guide can be intentional. A rendered cover or composite that contains that photograph remains the same source original and cannot earn another on-page original in the image minimum.

## Required render review

Render every PDF page to an image. Inspect every page at readable size, not only as a small contact sheet. Extracted text and successful PDF generation do not prove the layout is acceptable.

Create `build/catalogue-review.json` with this shape:

```json
{
  "pdf": "public/assets/guide.pdf",
  "page_count": 2,
  "reviewer": "actual reviewer or model",
  "pages": [
    {
      "page": 1,
      "rendered_path": "build/catalogue-pages/page-01.png",
      "reviewed_at_readable_size": true,
      "no_clipping": true,
      "no_truncation": true,
      "no_text_image_collision": true,
      "no_text_on_face_or_subject": true,
      "information_bearing_images_complete": true,
      "links_and_contact_checked": true,
      "findings": []
    },
    {
      "page": 2,
      "rendered_path": "build/catalogue-pages/page-02.png",
      "reviewed_at_readable_size": true,
      "no_clipping": true,
      "no_truncation": true,
      "no_text_image_collision": true,
      "no_text_on_face_or_subject": true,
      "information_bearing_images_complete": true,
      "links_and_contact_checked": true,
      "findings": []
    }
  ],
  "unresolved_findings": []
}
```

Fill this from an actual visual inspection. Do not copy the example values. Record page-specific findings and rerender affected pages after fixes.

Run:

```bash
python3 scripts/validate_catalogue_review.py /path/to/project build/catalogue-review.json
```

The validator checks coverage and evidence shape. It cannot see the page for the reviewer, so a fresh acceptance pass must still inspect the rendered pixels. Any clipping, truncation, collision, unreadable text, incomplete information-bearing image, or unresolved finding blocks the brochure and final delivery.
