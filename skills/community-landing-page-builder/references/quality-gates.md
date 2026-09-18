# Lightweight Quality Gates

Use these gates after the page is implemented and after every material source change. The goal is a good, conversion-capable page, not maximum ceremony.

## 1. Static gate

Run from the skill directory:

```bash
python3 scripts/scan_surfaces.py /path/to/project --report /path/to/project/build/surface-scan.json
python3 scripts/validate_page.py /path/to/project --report /path/to/project/build/static-review.json
```

The first command blocks prohibited dash characters/entities and unresolved template markers across customer-facing surfaces. The second checks local assets, links, headings, viewport settings, image classification and alt behavior, basic form relationships, primary destinations, and common privacy/tracking failures.

Report paths are relative to the shell's working directory, not the project argument; absolute paths also work. Link the actual generated files in the handoff.

Static checks do not prove claim truth, visual quality, or real conversion delivery. Review those separately.

## 2. Browser gate

Serve the project over local HTTP. Test at least:

- 390 x 844 mobile;
- 768 x 1024 tablet;
- 1024 x 800 laptop;
- 1280 x 600 short-height laptop;
- 1440 x 900 desktop.

Use `scripts/measure_page.mjs` when Playwright is available:

```bash
node scripts/measure_page.mjs http://127.0.0.1:4173/ \
  --project-root /path/to/project \
  --out /path/to/project/build/browser-review.json
```

You may instead use an available browser automation tool, but preserve the same viewports and checks. Capture full-page screenshots plus open form/modal and thank-you or success states where applicable.

Block on:

- horizontal overflow, missing images, serious console or network errors;
- primary form action not visible or unobscured at 1280 x 600;
- consent, chat, or fixed UI covering the H1, primary CTA, form action, legal links, or final content;
- a content-bearing image cropped with `cover` or missing labels;
- copy physically overlapping an information-bearing image;
- modal focus escaping, missing focus restoration, or inaccessible validation;
- dead primary, phone, privacy, booking, or download destinations;
- footer controls visually merged or too small to operate.

## 3. Visual gate

Open and inspect every required screenshot at its actual size. Do not infer approval from a file existing or a broad boolean.

For each viewport, record specific observations for:

- brand fidelity and logo visibility;
- source-color provenance, applied color proportions, and audience fit;
- hero balance, subject visibility, and CTA priority;
- typography, contrast, wrapping, density, and visual age;
- section rhythm and repeated layouts;
- image crop, role, and proof integrity;
- consent, sticky, modal, and footer behavior;
- clipping, overlap, unfinished text, and dead space;
- final conversion and thank-you state.

Also compare the complete page with the reference hierarchy in `design-direction.md`. Blue Mountain is a structural benchmark, not a style target. Clean Slate is a minimum execution-quality benchmark, not a template to copy. Block a technically sound page when the full composition still reads as a legacy sales brochure, an enlarged logo palette, or an audience-inappropriate design. Fix the underlying type, palette proportions, spacing, imagery treatment, or repeated motifs and then recapture every affected viewport.

Review each used image with asset-specific evidence. Review every modal step and validation state that exists. If a brochure exists, review every rendered page using the catalogue workflow.

## 4. Conversion gate

Test the selected real action, not a substitute.

Before testing behavior, compare the final action with the source conversion contract. Block the build when a supplied source form, booking, quote, purchase, or download journey was replaced merely because credentials or production access were unavailable. Confirm that the offer, delivery promise, consent, and next step remain materially faithful or that a source-supported change is documented.

- Form: required errors, invalid values, keyboard flow, pending state, success confirmation, failure and retry, duplicate prevention, and real configured destination contract.
- Booking: actual destination, date or next-step clarity, and return path.
- Phone or email: actual `tel:` or `mailto:` destination and visible fallback.
- Download: real file, correct type, readable content, and honest delivery wording.

Use synthetic local data. A direct thank-you visit, refresh, rejected action, or denied consent must not create a conversion. Do not submit a production lead without explicit permission.

Exercise outcomes, not proxies: include whitespace-only required text and malformed contact input; inspect failure visibility at the real submit position before any test-driven focus or scroll. Then restore the local test adapter, retry the same filled form, and observe success with values preserved. A visible error string or disabled button alone does not prove retry or duplicate prevention. Keep simulation results explicitly separate from backend delivery evidence.

For source forms, confirm that no public production endpoint was reused without authorization, success waits for a confirmed selected destination, and raw contact data is absent from analytics and data-layer events.

## 5. Accessibility and performance gate

Run an automated accessibility scan when available, then manually test keyboard order, visible focus, modal containment, zoom, labels, errors, reduced motion, and contrast. Automated tools do not replace these checks.

Run one local Lighthouse pass when available. Target:

- Performance at least 90;
- LCP at most 2.5 seconds;
- CLS at most 0.1;
- TBT at most 200 milliseconds.

Repeat failing or marginal measurements after fixes. Do not delete needed proof or content merely to improve a score.

When a required local audit package is absent, use a supported project-local installation if execution and package access are available. Record its version and run once; do not turn tool discovery into repeated audit runs. If installation is unavailable, disclose the missing test. Unthrottled local PerformanceObserver timings are diagnostics, not a Lighthouse score, mobile loading budget pass, or equivalent TBT measurement.

## 6. Fresh acceptance gate

After all fixes, review the final outputs from the beginning without relying on earlier pass labels. Use a separate agent or reviewer when available. Otherwise use an isolated second pass and reopen every artifact.

The acceptance report must include:

- exact files and URLs reviewed;
- viewport and state coverage;
- specific findings tied to screenshots or pages;
- design provenance and the visual-age checkpoint;
- conversion parity against the source conversion contract;
- typography provenance: verified guide, official site, applied choice, and substitutions;
- fixes made and retested;
- unresolved limits;
- final result: `blocked`, `local final`, `publish-ready`, or `live and verified`.

A selected optional module can be incomplete without blocking the base page only when it is clearly excluded from the delivered claim. Never call the whole result complete while presenting that module as working.

Block typography acceptance when the applied heading or body stack differs from the supplied production page without a documented permitted reason and a close visual match.
