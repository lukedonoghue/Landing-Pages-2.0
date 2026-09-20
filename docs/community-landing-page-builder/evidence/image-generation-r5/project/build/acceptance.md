# Local acceptance

Status: **local final** for the selected static email-led experience. Reviewed 2026-09-20 by the builder in a fresh self-review. No independent reviewer tool was available.

## Reviewed artifacts

- Final publishable page: `dist/index.html`, `dist/styles.css`, and all nine files in `dist/assets/`. The packaged HTML and CSS hashes match the reviewed source files.
- Browser preview: `http://127.0.0.1:53621/`.
- Full-page screenshots: `build/screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, `1440x900-landing.png`; extra first-screen `320x700-first.png`.
- Readable first-screen and section crops in `build/screenshots/`, including each illustrative asset at mobile and desktop size, the fee rows, and the final contact area.
- Checks: `surface-scan.json`, `static-review.json`, `browser-review.json`, `local-interaction-qa.json`, `lighthouse.json`.

## Findings and decisions

- The official logo remains legible in every first screen. The navy/teal source palette is present in text and action roles, with white, cool grey and a limited warm paper fee section to avoid an enlarged-logo treatment. The page reads as a current small-business service page rather than the source's oversized gradient-and-card layout.
- The hero's ledger, calculator and laptop are clear at 1024, 1280 x 600 and 1440 widths; copy stays on the clear left side. At 768 and below, copy and photo stack so no object is under text. At 320 and 390, the photo is useful rather than a thin strip, and the first fit-strip text appears within the first screen.
- Bookkeeping, calendar and consultation images load at desktop and mobile, retain their subjects, and have no destructive crop or text on their pixels. The consultation caption explicitly says the people are not Clarentis staff or clients. The other images carry adjacent illustrative captions. Four distinct content images are used once each.
- Fee ranges remain readable at 390px. The quote qualification appears beside the pricing context. FAQ controls, phone, email and final CTA are separated and readable. No serious clipping, overlaps, dead space or missing assets were found in the reviewed captures.
- Main buyer questions in the strategy coverage map are answered: business fit, work scope, consultation, published fees and quote factors, onboarding, ongoing support and contact. No unsupported testimonial or credential was added. The pricing and process provide the strongest available first-party trust detail.
- Source conversion parity holds: all four main CTAs say `Request your fixed-fee quote` and point to the official `mailto:info@clarentis.co.uk` destination with a quote subject. The published phone is visible near the top and at the close. This is a direct email journey, so no form or success state is implied. The visitor must send the email in their own app.
- Typography provenance: no formal brand guide found. The official H1 and lead declare `Inter, ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif` and painted with `.SF NS` in the source measurement. The new heading and lead use that same declared stack and rendered family. Letter spacing is zero for readability.

## Fixes and checks

The first static pass found an unclassified logo; it is now decorative inside a named brand link. The first browser pass found a too-small footer link and a tablet hero text/image collision; both were fixed. The narrow-screen spot check initially placed the next section below 700px; the hero copy was tightened. An unsourced `per filing` billing unit was removed from the Self-Assessment row. All affected states were recaptured and reviewed.

Final gates: surface scan **pass**; static page **pass**; five-viewport browser audit **pass, zero warnings**; 320px interaction/geometry check **pass**. The packaged `dist/` copy also passed its own surface and static checks, returned HTTP 200, and passed the 320px interaction check from the final preview server. Lighthouse 12.8.2 mobile: Performance **100**, Accessibility **100**, LCP **1.65s**, CLS **0**, TBT **0ms**. Browser audit reports no console or network failures. The local interaction check verified skip-link keyboard entry, mobile menu and FAQ operation, exact primary mailto URLs and the published telephone URL. No live lead was sent.

## Limits

Cloudflare was not connected or tested. Actual email-app handoff and delivery depend on the visitor's device and were not used to create a live enquiry. The published fee ranges may change and should be reconfirmed with Clarentis before publishing. Generated-image publication terms should be checked by the owner when hosting is connected. The page has no form, tracking or lead database because the source's dominant conversion is direct email.
