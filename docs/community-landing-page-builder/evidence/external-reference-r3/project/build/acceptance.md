# Final acceptance

Result: **local final**, self-reviewed after the final source change on 2026-09-20. No separate reviewer or agent was available. No publication or live lead submission occurred.

## Files and states reviewed

- Page: `index.html`, `styles.css`, `script.js`, `assets/`; served at http://127.0.0.1:4175/ .
- Full pages and first screens: `screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, `1440x900-landing.png`, and matching `mobile-first.png`, `tablet-first.png`, `laptop-first.png`, `short-laptop-first.png`, `desktop-first.png`.
- Additional 320x700 first screen: `screenshots/narrow-first.png`.
- Asset-specific placements: `screenshots/mobile-hero.png`, `desktop-hero.png`, `mobile-design.png`, `desktop-design.png`, `mobile-projects.png`, `desktop-projects.png`.
- Form states: `screenshots/mobile-enquiry.png`, `mobile-validation.png`, `mobile-failure.png`, `mobile-success.png`, `desktop-validation.png`.

## Visual observations

- The exact white and lime official logo stays legible on charcoal in the header and footer. Reem Kufi paints headings and Poppins paints prose, matching the measured production families in `brand.json`. No formal brand guide was supplied.
- At 390x844, 768x1024, 1024x800, 1280x600 and 1440x900, the brand, offer and primary action fit the first screen. The next strip begins at about 706, 710, 640, 524 and 700 CSS pixels respectively, leaving visible continuation. At 320x700 it begins at 681px. No horizontal overflow was measured.
- The real hero room is unobscured by text. Its roof, cedar facade and glazing are visible in the reviewed first-screen captures. The short-height crop omits some lower decking and door base; that is accepted because the proof-bearing room and glazing remain legible. The helper reported 62% and 48% crop warnings at 1280x600 and 1440x900. These are accepted on the named pixel evidence above, not treated as generic passes.
- The office image shows the room and covered seating area without overlay. All three project photos load in their own cards, their room fronts and doors remain visible, and captions match the linked company project pages. The mobile portfolio stacks cleanly; no empty grid tracks or clipped captions are visible.
- The form, footer and success state fit without collisions. The mobile validation screenshot shows the complete focused summary, labels and linked field errors; failure appears beside the action with values retained. The compact success state is readable. A 320px click-and-Tab run kept the name, email, phone, message, consent, privacy link and submit control fully inside the viewport after focus settled.
- The page has an image-led, current commercial rhythm with restrained exact brand lime. It does not reuse the reference site's claims or assets, nor the source site's centred text-over-room treatment. The reference contributed image scale, project discovery and repeated action. A normal-scrolling screenshot confirmed the skip link is offscreen until focused; an element-only capture had shown a screenshot artifact.

## Gate results

- `surface-scan.json`: pass, no prohibited dashes or template markers.
- `static-review.json`: pass, no missing local assets, dead links, image-role faults or form-label faults.
- `browser-review.json`: zero failures; only the two accepted hero-crop warnings. Images loaded at all five sizes, official and applied font families matched, and no measured overlap or overflow was found.
- `conversion-review.json`: 18 synthetic checks passed. Covered empty and whitespace-only fields, alphabetic phone rejection, linked errors and correction, local receiver failure, retry, confirmed preview success, refresh, duplicate-event guard and timeout uncertainty. No live endpoint was contacted.
- Lighthouse 12.8.2, final mobile pass in `lighthouse-final.json`: Performance 99, Accessibility 100, LCP 2.18s, CLS 0, TBT 0ms. The initial 90 score and 3.68s LCP improved after responsive image delivery and contrast adjustments.

## Source parity and limits

The official home and contact pages lead to a free design consultation and quote by enquiry form. This page retains that conversion type and offer, with required name, email and message, optional phone and separate optional marketing choice. The current local receiver discards test details and confirms only preview completion. Cloudflare publication, production lead delivery, image publication rights and any live conversion test remain outside this local result. The official privacy and project links were checked as public source pages during research; no private account or saved authorization was used.
