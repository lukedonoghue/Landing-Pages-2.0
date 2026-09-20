# Independent Visual Acceptance Review

**Result:** **Blocked for strict visual acceptance by one validation-framing issue at 1440 x 900.** The overall composition and other inspected states pass for a local preview. This review does not establish a live or publish-ready enquiry destination.

## Scope and evidence

Reviewed the final local page at `http://127.0.0.1:4199/` and `index.html`, `styles.css`, `script.js`, and rendered assets under `/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/external-reference-r2/project/`. Compared the public [business homepage](https://gardenroomco.com/), [owner's presentation example](https://www.greenretreats.co.uk/), the business's [Walthamstow](https://gardenroomco.com/portfolio/walthamstow-home-office-guest-suite-and-dual-storage/), [Dyserth](https://gardenroomco.com/portfolio/relaxing-garden-room-dyserth/), and [Moreton](https://gardenroomco.com/portfolio/bespoke-garden-salon-moreton/) projects, [FAQ](https://gardenroomco.com/faq/), [contact](https://gardenroomco.com/contact-us/), [about](https://gardenroomco.com/about-us/), and [privacy](https://gardenroomco.com/privacy-policy/) pages. No prior build QA, audit, or previous acceptance material was used.

Fresh first-viewport captures: [390 x 844](390x844-first.png), [768 x 1024](768x1024-first.png), [1024 x 800](1024x800-first.png), [1280 x 600](1280x600-first.png), and [1440 x 900](1440x900-first.png), plus [mobile full page](390x844-full.png) and [desktop full page](1440x900-full.png). Readable [mobile projects](390-projects.png), [mobile enquiry](390-enquiry.png), [desktop projects](1440-projects.png), and [desktop enquiry](1440-enquiry.png) captures accompany section captures for approach, materials, review, FAQ, and footer at 390 and 1440 px. The form was captured in [validation](390-form-validation.png), [failure](390-form-failure.png), and [success](390-form-success.png) states at 390, 1280, and 1440 px, with settled viewport captures alongside the full form captures. [Open mobile menu](390-menu-open.png) and [open FAQ](390-questions-open.png) states were also inspected.

## Pixel findings

| Viewport | First-screen observation |
| --- | --- |
| 390 x 844 | Logo and room are visible; heading, lead, filled CTA, and the following evidence strip fit without collision. |
| 768 x 1024 | The room remains legible behind the image-led hero; CTA and evidence are visible with the next section beginning at the fold. |
| 1024 x 800 | Hero copy is readable, the room's glazing remains inspectable, and the CTA clears the short laptop fold. |
| 1280 x 600 | CTA is fully visible at y=443-499; the evidence strip begins at y=560. The room remains visible to the right of the copy. |
| 1440 x 900 | Strong room image and CTA hierarchy; the evidence strip and lower-page continuation are visible. |

There was no horizontal overflow, missing local image, or page error observed during these captures. The three project photographs show their buildings and labels without destructive crops; their linked project pages identify the corresponding work. The testimonial uses a short excerpt attributed to David Pert, whose longer review appears on the business's public site. Across the mobile and desktop section captures, headings and body text remain readable; no text/image collision or unfinished content was observed. The enquiry and footer remain distinct and legible.

The live business homepage uses the same logo, lime accent, and room photograph. Its rendered heading stack is `Reem Kufi`; meaningful prose paints in `Poppins`. Those same font families loaded and painted on the local page. No formal brand guide was reviewed. The owner's example supplies an image-led, spacious presentation cue; the local page applies that cue with the business's own identity, offer, and project evidence. Its quieter neutral sections and restrained green action color read as current rather than a copy of the example or a legacy brochure. The example's cookie dialog was left untouched, so comparison of its unobscured hero is limited.

The mobile menu opened, its Projects link navigated and closed it, the primary CTA reached the enquiry form, and the first FAQ opened and closed. Public project, FAQ, and privacy targets were found; the phone link matches the business contact number. The local form's empty-field summary and inline errors were visible. A synthetic 503 response produced a legible failure state with entries preserved; a synthetic 200 receipt produced the clearly labelled **Preview complete** state. Two POSTs per tested viewport were intercepted in Chrome; no live lead or external write was made.

## Decisions and limits

**Necessary fix:** After an empty submission at 1440 x 900, the settled [validation viewport](1440-form-validation-viewport.png) places the focused Name input at y=0 while its label and the error summary are above the viewport. The input remains operable, but its top focus outline is clipped and the visitor loses the summary context. The same state frames correctly at [390 x 844](390-form-validation-viewport.png) and [1280 x 600](1280-form-validation-viewport.png). Scroll the summary and first field group into view after validation, then recheck the settled desktop viewport. This is a focused visual/keyboard-framing issue, not a failure of field error rendering.

**Subjective polish:** At 1440 px, the lead project ends well above the second item in the right column, leaving a large white area under its caption. Tightening that editorial grid could improve rhythm, but the three examples are still readable and the gap is not a blocker.

The source conversion is a free design consultation and quote enquiry; the local page keeps that form journey and states the quote in the enquiry introduction. The local page explicitly labels its form as a preview that does not contact the business. Synthetic success confirms only the browser's response handling, not delivery. Detailed lifecycle, production wiring, publishing, accessibility audit, and Lighthouse were outside this independent visual review; no page or skill files were edited.

Capture data: [viewports and form states](capture-data.json), [control checks](controls.json), [source typography](source-comparison.json). Scripts: [local captures](capture-playwright.mjs), [source comparison](compare-sources.mjs), [controls](controls.mjs).
