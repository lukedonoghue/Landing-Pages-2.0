# Local acceptance: The Garden Room Co.

Status: **local final**. Reviewed on 2026-09-20. This was a fresh self-review of final artifacts and rendered pixels; no independent reviewer was available in the current tool set.

## Files and pages reviewed

- Final local page: `http://127.0.0.1:50525/`, served by `server.mjs` from `index.html`, `styles.css`, `script.js`, and `assets/`.
- Official client pages: https://gardenroomco.com/, https://gardenroomco.com/about-us/, https://gardenroomco.com/contact-us/, https://gardenroomco.com/faq/, and the client project pages linked from the finished cards. Claim-by-claim sources are in `claim-ledger.md`.
- Presentation reference: https://www.greenretreats.co.uk/. Its media-led hierarchy, proof pacing, practical buyer questions and repeated action were assessed, without carrying over its images, wording, prices, endorsements, showroom claims or range structure. Coverage is mapped in `strategy-brief.md`.
- Full-page captures: `screenshots/390x844-landing.png`, `screenshots/768x1024-landing.png`, `screenshots/1024x800-landing.png`, `screenshots/1280x600-landing.png`, `screenshots/1440x900-landing.png`. Form captures: corresponding `*-modal.png`, plus `mobile-validation.png`, `desktop-validation.png`, `short-validation.png`, `desktop-failure.png`, `desktop-confirmed.png`, `mobile-confirmed.png`. The 320 x 700 first screen is `screenshots/320x700-first.png`.

## Product and visual verdict

- The logo is visible in the first viewport at all five standard widths. The applied dark charcoal and lime come from the official logo/site; lime stays mainly on actions and small markers, leaving the photography dominant. The page reads as a current bespoke-service page, not a copied catalogue or an enlarged version of the old site.
- Official-site rendered glyphs in `brand.json` are Reem Kufi for headings and Poppins for body text. The final `browser-review.json` confirms those same custom fonts actually render. No typography substitution was made; local licensed font files avoid network dependency.
- At 1440 x 900 the hero's roof, corner glazing, room interior and deck remain inspectable beside the offer and primary CTA; the trust strip is fully readable above the fold. At 1024 x 800 the same subject remains clear without text collision. At 768 x 1024 the hero stacks, retaining the building and deck; the trust strip follows within the viewport. At 390 x 844 the hero image, CTA and the first trust item are on screen. The 320 x 700 spot capture keeps the logo, readable phone, CTA, room image and continuation without horizontal scroll. At 1280 x 600, the compact hero keeps the full copy and image separate, with both lines of the trust strip legible before the fold.
- The seven content photographs are distinct first-party project or finished-space images, each placed once. The hero and completed spaces substantiate the adjacent copy; none is presented as a generated or stock example. The three linked projects retain different use cases. Alternating unframed photo, detail, price, process, review and FAQ compositions avoid a repeated card-grid rhythm. No overlay hides subject detail, no page section or dialog control overlaps, and the footer phone/privacy links remain distinct and operable.

| Proof image | Pixel evidence in final full-page captures | Protected detail confirmed |
| --- | --- | --- |
| Hero | Desktop at y82; mobile at y431 | Complete timber room, corner glazing, roof and deck; only a small caption occupies deck edge |
| Dyserth | Desktop at y981; mobile at y1129 | Glazed front and planted setting remain clear |
| Walthamstow | Desktop at y981; mobile at y1545 | Wide opening and furnished interior remain clear |
| Moreton | Desktop at y981; mobile at y1961 | Cedar facade, glazing and salon-sized footprint remain clear |
| Machynlleth | Desktop at y1608; mobile at y2464 | Whole room and raised site are visible, with no crop over the building |
| Garden gym | Desktop at y2338; mobile at y4272 | Exercise equipment and room finish are visible |
| Hawarden office | Desktop at y3798; mobile at y6198 | Compact building, door and garden boundary remain visible in the wide band |

The page answers the bespoke buyer's material questions with client-supported detail: possible uses, built examples, site/design fit, structure and services, how a quote is compared, the four-step process, planning and ground caveats, maintenance, customer experience, and what happens after an enquiry. The reference's showroom, fixed range pricing, video/ambassador and large-scale rating devices were omitted because equivalent client evidence was not verified. The public number `07803 362187` is readable in the header and final contact area, labeled as the team rather than assigning an unverified role to its named contact.

## Conversion and QA

- The source offer and form intent are preserved: a free design consultation and no-obligation quote, with name, email and project description required, optional phone and optional marketing consent. The project postcode is optional for routing. All four exact-label enquiry CTAs open one shared accessible dialog without a section jump. The phone remains a secondary `tel:` action.
- `conversion-review.json`: 40 passing local browser checks. Each entry point, focus restoration, validation and correction, grouped error-summary links, malformed email and phone, failure/retry, successful **local test receiver** confirmation, duplicate prevention, held response, close/reopen safety, timeout recovery, mobile navigation, and short-height dialog controls were exercised with synthetic data. `desktop-failure.png` retains the filled details and retry action; `mobile-confirmed.png` plainly says no enquiry reached the business.
- `browser-review.json`: 102 passing checks, zero warnings/failures at 390, 768, 1024, 1280 x 600, and 1440 widths. Final screenshots were reopened at readable crop size; the 1280 x 600 fold was tightened after a visual finding and recaptured. No broken assets, overflow, serious browser errors, text collisions or obscured controls remain.
- `surface-scan.json` and `static-review.json`: pass with zero findings, missing assets, dead links or form issues. `accessibility-review.json`: axe on six page/dialog/validation states at mobile and desktop, zero violations; keyboard focus, error framing, reduced motion and modal containment were also checked in the browser suite.
- `lighthouse.json`: Lighthouse 12.8.2 mobile scores Performance 97, Accessibility 100, Best Practices 100, SEO 100. LCP 2.25 s, CLS 0.00009, TBT 119 ms. No run warnings.

## Limits before publication

- The receiver in `server.mjs` is localhost-only, discards submitted data, and is not a production lead destination. The on-page disclosure and success wording say so. A real authorized delivery endpoint must be connected and tested before publishing a working enquiry form; do not silently publish this preview receiver as though it emails the company.
- First-party project photos were taken from the public client website for this local preview. The owner should confirm reuse rights for the new published page.
- Cloudflare, private accounts, analytics, CRM, and any live production form submission were not accessed or configured. This result is not `publish-ready` or `live and verified`.
