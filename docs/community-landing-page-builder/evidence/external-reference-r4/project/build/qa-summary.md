# Local acceptance

Date: 2026-09-20. Result: **local final, endpoint-free preview**. This was a fresh self-review of the final artifacts; no independent reviewer was available in the current tools.

## Files and URLs reviewed

- Local page: `http://127.0.0.1:43871/`, served from `project/index.html` with `styles.css`, `script.js` and `assets/`.
- Reference: `https://www.greenretreats.co.uk/`; public client pages and assets are listed in `strategy-brief.md`, `claim-ledger.md` and `image-plan.md`.
- Evidence: `surface-scan.json`, `static-review.json`, `browser-review.json`, `lighthouse.json`; screenshots in `build/screenshots/`.
- Five required full-page captures: `390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, `1440x900-landing.png`. Corresponding `-modal.png` files capture the open form. Additional mobile `-validation.png`, `-failure.png`, `-success.png` and narrow `320x700-landing.png` captures cover key states.

## Visual and content review

- 390 x 844: official logo and full phone number are visible at the top. The mobile hero shows the finished room without copy over its glazing. The consultation CTA and start of the trust band fit in the first screen. Project images stack with readable captions; interior image, final CTA and legal links are unobscured.
- 768 x 1024: the hero, CTA and following section share the first viewport. The two-column portfolio retains each building's main facade and caption. The Walthamstow interior is separate from copy and shows seating, desk and roof light.
- 1024 x 800: navigation, phone and CTA fit without overlap. The hero room remains identifiable, and the gallery and design text have comfortable line lengths.
- 1280 x 600: the hero CTA stays visible with the next section beginning below. The dialog action remains inside the viewport while fields scroll in their own region.
- 1440 x 900: the photo-led hero, real-project gallery, interior feature, process, questions and final action have distinct composition. The footer separates phone, privacy and back-to-top links.
- Image-specific review: the mobile hero serves `hero-mobile.webp` (56 KB) and shows the full glazed frontage; desktop uses the official source JPG. Walthamstow, Dyserth, Moreton and office seating images all loaded and retained their named subject at desktop and mobile sizes. The interior photo has no overlapping copy. No image is presented as an invented result.
- Reference coverage: the page answers use, bespoke choices, site fit, quote factors, process before commitment, practical limits and contact. Green Retreats' price ranges, showroom, celebrity endorsement and scale claims were excluded because they are not claims for The Garden Room Co. The client-specific portfolio and interior keep a photo-led rhythm. The page feels current and architectural while retaining the official logo, yellow-green accent and actual fonts.
- Typography: no formal brand guide was found. The official production H1 painted in Reem Kufi and meaningful prose painted in Poppins at 390 and 1440 pixels. The applied page paints in those same bundled font families, confirmed by `browser-review.json`.

## Functional and technical checks

- `scan_surfaces.py`: pass, zero prohibited dashes or unresolved customer-facing markers.
- `validate_page.py`: pass, one H1, all local assets and required destinations present, no form or image contract failures.
- `measure_page.mjs`: pass at all five required sizes, zero failures and zero warnings. No horizontal overflow, missing images, focus escape or covered modal action was reported.
- Four distinct consultation CTA placements open the same dialog without changing scroll position or URL fragment. Closing restores focus to the opener.
- Synthetic form tests: whitespace-only required text, malformed email and alphabetic phone junk are rejected; error links focus usable fields; correcting one field updates the summary; values survive a failed preview; pending duplicate dispatches are ignored; a changed snapshot cannot be confirmed by an old response; timeout becomes a recoverable uncertainty; synthetic confirmation is explicitly labelled a preview. The default path makes no POST request. Keyboard Tab and programmatic focus stay inside the dialog, and ordinary-motion validation focuses a visible control.
- Public portfolio and privacy URLs returned HTTP 200. The phone URI uses the publicly listed 07803 362187.
- Lighthouse 12.8.2 mobile: Performance 98, Accessibility 100, Best Practices 100, SEO 100. LCP 2.33 s, CLS 0.00003, TBT 0 ms.

## Fixes and limits

The first pass exposed an overly cropped mobile hero, small footer targets, a clipped short-screen dialog action, low-contrast small labels, and an LCP near 4 seconds. The final mobile composition protects the building, footer links have larger targets, the dialog uses a bounded scrolling field region, labels are darker, and a 56 KB mobile image variant brought LCP below 2.5 seconds. These changes were recaptured and retested.

The form has no production lead destination, and no live lead was submitted. Cloudflare was not connected or published. Image rights for public reuse were not independently established. The page is complete as a local preview, not a live lead collection page.
