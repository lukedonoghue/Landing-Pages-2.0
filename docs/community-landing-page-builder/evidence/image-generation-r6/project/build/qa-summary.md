# Local acceptance report

Date: 2026-09-20. Result: **local final**. This was a fresh self-review of the final artifacts; no independent reviewer tool was available. No Cloudflare account, private account, live email submission or live call was used.

## Artifacts reviewed

- Page: `project/index.html` at `http://127.0.0.1:59628/` during QA, with `project/styles.css`, `project/script.js` and `project/assets/`.
- Clean upload copy: `project/publish/` was also served at `http://127.0.0.1:59628/publish/`; `project/clarentis-landing.zip` contains that copy with `index.html` at archive root. Matching hashes for HTML, CSS and JavaScript and a directory diff for all assets confirmed parity before a second interaction pass against the clean copy.
- Source evidence: `project/build/brand.json`, `brand-390x844.png`, `brand-1440x900.png`, plus official https://clarentis.co.uk/ homepage HTML, CSS and logo retrieved on 2026-09-20.
- Full-page final captures: `project/build/screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, `1440x900-landing.png`.
- Readable first-screen and image-specific crops in `project/build/screenshots/`, including `320x700-first.png`, `desktop-bookkeeping.png`, `desktop-tax.png`, `desktop-process.png`, `mobile-bookkeeping.png`, `mobile-tax.png`, `mobile-process.png`, `tablet-tax-final.png` and `tablet-fees-final.png`.
- Machine reports: `project/build/surface-scan.json`, `static-review.json`, `browser-review.json`, `interaction-review.json`, `lighthouse.json`.

## Visual findings

| Viewport / state | Observation |
| --- | --- |
| 320 x 700 phone | Official logo, published phone, full quote action and email-app explanation are visible. The illustrative hero person remains recognisable, and the first consultation fact starts in view. No horizontal overflow. |
| 390 x 844 phone | Stacked copy and photo keep the face and hands free of text. The first fact heading and supporting sentence are readable below the image. Menu and FAQ states were exercised. |
| 768 x 1024 tablet | Hero copy is separate from the photo. All three decision cues are readable in the first viewport. Tax, fit, fees and process sections use comfortable single-column reading widths; the full fee table is inspectable. |
| 1024 x 800 laptop | Hero text stays in left photographic negative space without crossing the face or records. CTA and the complete first information strip are visible. |
| 1280 x 600 short laptop | Main CTA is fully visible and the first information strip includes readable body text. The hero image loses about 50% of its source height; the visible crop retains the face, both hands and a receipt, so the automated crop warning is accepted for this placement only. |
| 1440 x 900 desktop | Logo, quote action, secondary phone and the complete first information strip read clearly. The subject remains unobstructed and the page moves from editorial imagery to service detail, fee table, process and FAQ without repeated card grids. |

All four distinct generated content photographs were inspected in desktop and mobile placements. Bookkeeping hands/receipts, tax paperwork, and both consultation faces remain visible with adjacent service context and legible illustrative captions. No photograph is presented as proof of Clarentis people, customers, work or outcomes. The official logo is used on white. Image roles, alt text and responsive derivatives are documented in `image-plan.md`.

Design provenance: the official navy/teal logo and CSS colors are retained; saturated teal is restricted to action and accent roles. The applied heading and body stack matches the official site's declared stack and the measured rendered macOS system sans glyphs in `brand.json`. No formal brand guide was found. The old site's large pill/card motif was not carried over. The final page is current, restrained and appropriate for owners comparing scope and fees. Blue Mountain's live page was inaccessible, so the attached skill's structural criteria were used; Clean Slate's public site was inspected for execution quality without copying its design or assets.

## Conversion and technical checks

- Source contract: Clarentis's public site uses direct `mailto:info@clarentis.co.uk` actions for its consultation and fixed-fee quote. The final has four primary quote actions with the same label and mailto destination, plus two visible `tel:+447467474356` links. It retains the free consultation and scoped fixed-fee proposal. No form, booking promise or synthetic success state was added.
- Browser smoke: 10/10 checks passed for 320px first screen, quote/phone destinations, keyboard menu, FAQ expansion, visible keyboard focus, image loading, distinct image count and captions. No actual email application was launched and no message was sent, by request.
- The clean upload folder passed the surface scan, page validator and the same 10/10 browser interaction checks.
- Opening `project/publish/index.html` directly from disk also passed 10/10 checks after below-fold lazy images were scrolled into view and decoded. Relative CSS, JavaScript and image paths work without a local server.
- Static: surface scan passed with no prohibited long dashes or unresolved template text; page validator passed with one H1, no missing local assets, image-contract failures, dead links or form errors.
- Responsive browser: required 390, 768, 1024, 1280 short and 1440 viewports passed with zero blocking failures, no overflow, missing images, console/network errors or content collisions. Only the reviewed 1280px hero crop warning remains.
- Mobile Lighthouse 12.8.2: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.80 s, CLS 0, TBT 0. Temporary Python-server cache/compression suggestions are hosting behavior, not page failures.

Fixes made and retested: classified the official logo image, enlarged the footer link target, separated the tablet hero from its subject, constrained laptop hero copy, shortened the narrow-phone hero, darkened image captions for contrast, and widened tablet tax/fee reading layouts.

## External limits

Cloudflare was not connected or published. The mailto action opens the visitor's configured email app and still requires the visitor to press Send; local QA verifies the address and subject only. Inbox receipt and production contact behavior must be checked after the owner connects hosting, without using real customer data for tests. No client review, accreditation, employee identity or outcome proof was invented. The published fee guide and contact details should be rechecked before going live because they can change.
