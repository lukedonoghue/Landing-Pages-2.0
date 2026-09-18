# Optional Brochure or Catalogue Workflow

Activate this workflow only when the user asks for a document or when the real offer includes one. Do not create a generic brochure merely to justify a download CTA.

## Content and build

- Reuse the verified claims, brand tokens, offer, contact details, and qualifiers from the page.
- Organize the document around the buyer's decisions, not a company-history template.
- Use the actual cover or a verified page spread as the page preview.
- Keep page copy in the canonical copy master before layout.
- Use available PDF/document tooling and embedded fonts with known rights.

## Image composition rules

Classify every image before layout.

- Decorative images may sit behind text only when contrast and subject safety are verified.
- Diagrams, roadmaps, screenshots, documents, and any image with labels must be separate figures or have a protected text-free region.
- Do not place titles or body copy over existing image text.
- Do not place text over a face or the subject needed to understand the photo.
- Do not enlarge portraits until heads, hands, or meaningful context are clipped.
- Do not use `cover` behavior for information-bearing figures.

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
