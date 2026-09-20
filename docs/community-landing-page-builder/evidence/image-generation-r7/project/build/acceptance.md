# Clarentis local acceptance

Status: **local final** (2026-09-20). Review type: **self-review**. No independent reviewer tool was available in this session.

## Exact output reviewed

- Local page: `http://127.0.0.1:4189/publish/` (HTTP 200).
- Upload-ready directory: `publish/`, containing `index.html`, `styles.css` and `assets/` only.
- Source and research: root `index.html`, `styles.css`, `assets/`, and `build/` notes. `publish/` files match their root counterparts byte for byte.
- Official source: https://clarentis.co.uk/ , retrieved 2026-09-20. Brand extraction: `build/brand.json` and `build/brand-390x844.png`, `build/brand-1440x900.png`.

## Coverage and visual review

The source's buyer questions remain: audience fit, six service areas, free initial consultation, all six indicative fee ranges with their scope qualification, fixed-fee proposal, four onboarding stages, and direct contact. No unsupported testimonial, rating, credential, response time or named adviser was added. Blue Mountain was inaccessible, so its skill-supplied structural guidance was used. The Clean Slate public page informed finish and media pacing, with no copied design or assets. The final page has stronger fee and process clarity than the source; its absence of customer proof is a justified difference because none was found on the official page.

Reviewed full-page captures: `build/screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, and `1440x900-landing.png`. Reviewed first-screen crops for the same five sizes plus `build/screenshots/320x700-first.png`. Reviewed `390x844-menu.png` and `390x844-faq.png`. Image-specific desktop/mobile figures are `build/screenshots/image-{hero,bookkeeping,tax,consultation}-{390,1440}.png`.

Observed: the official logo is visible at every tested width; navy and teal remain recognisable without dominating the page. Text stays within its containers, the headline and email CTA are clear, and a readable part of the following decision strip appears in each first screen including 320px. The four content images support their adjacent accounting, records and consultation messages; captions identify them as illustrative, and the consultation caption explicitly says the people are not Clarentis staff or a client. No text covers a person or essential subject. Desktop has varied image/text rhythm, a compact fee table, process steps and a quiet FAQ. Mobile menu, fee rows, FAQ, final contact and footer remain readable and operable.

The browser helper reported one warning: the hero photo is cropped by about 48% at 1280 x 600. The actual short-height capture shows the laptop, calculator, papers, cup and caption unobscured, so this crop is accepted. No other crop warning, collision, missing image, console error or horizontal overflow remained.

## Conversion and accessibility

The official page uses direct email for `Request your fixed-fee quote`. The local page preserves that exact label and `mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20request` in every primary placement. The published phone number, 07467 474356, is visible near the top and in the final contact section, with `tel:+447467474356` links. The page explains beside the CTA that the visitor's email app opens and the visitor must press Send. There is no on-site form, fake confirmation or production conversion event. `build/interaction-review.json` records 19 passing local checks across 320px, 390px and 1440px, including the CTA/phone destinations, mobile menu, FAQ disclosure, first keyboard focus and four image loads. No private email application was opened and no live enquiry was sent.

No formal brand typography guide was found. The official page declares Inter but actually rendered `.SF NS` in Chromium. The applied page keeps the official declared system stack without loading a different glyph face; the final browser comparison matched the source on this host. The visual system avoids the source's oversized tightly tracked heading and pill-heavy controls. The darkened teal action and deep terracotta indices preserve contrast.

Final gates after the last page change: `build/surface-scan.json` pass, `build/static-review.json` pass, `build/browser-review.json` pass with the accepted crop warning, and `build/interaction-review.json` pass. The upload-ready `publish/` also passed `build/publish-surface-scan.json` and `build/publish-static-review.json`. Lighthouse 12.8.2 mobile on the identical root page: Performance 100, Accessibility 100, LCP 1.50 s, CLS 0, TBT 0 (`build/lighthouse.json`). Automated scores supplement, rather than replace, the screenshot and interaction review.

## External limits

Cloudflare was not connected and the page was not published. Email delivery depends on the visitor's configured email app and their separate Send action. The email destination and phone number were verified against the public site on 2026-09-20; no live lead or phone call was placed. The generated scenes are illustrative and must not be reused as factual client or team evidence.
