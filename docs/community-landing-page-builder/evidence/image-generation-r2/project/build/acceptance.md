# Clarentis local acceptance

Review date: 2026-09-20. Result: **local final**. This was a fresh self-review of the rendered page; no independent subagent reviewer was available in the current tools. Cloudflare and live email delivery remain untested.

## Reviewed sources and output

- Official source: https://clarentis.co.uk/; saved source HTML/CSS/logo in the run-level `research/` folder; rendered source captures `build/brand-390x844.png` and `build/brand-1440x900.png`.
- Local page: http://127.0.0.1:43192/; source `index.html`, `styles.css`, and `assets/`.
- Full-page browser captures: `build/screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, `1440x900-landing.png`.
- Readable review crops: `build/screenshots/1280x600-first.png`, `1440-services-fit.png`, `1440-fees-process.png`, `1440-faq-contact.png`, `390-fit.png`, `390-fees.png`, `390-contact.png`, and `390x844-faq-open.png`.

## Pixel findings

- 390 x 844: the first screen shows the full logo, quote CTA, phone, the relevant hero copy, illustrative photo and the first assurance item. The illustration caption remains readable under the photo. No horizontal overflow was found at 390 or 320px.
- 768 x 1024 and 1024 x 800: the logo and contact number remain visible; the hero photo's notebook, papers and calculator stay unobstructed. Assurance and service content begin within the first viewport.
- 1280 x 600: after reducing the hero's bottom space, all three assurance headings and their supporting text begin within the viewport. The primary CTA is fully visible and unobscured.
- 1440 x 900: the full assurance strip and start of the services section are visible. The hero reads as current and calm, not as the source site's oversized card-based design.
- Full-page desktop/mobile: six service lines, the illustrated fit section, all six fee ranges, four onboarding steps, FAQ, and final contact are complete and readable. The fee table wraps without clipping on mobile. The supporting studio image has a normal-flow disclosure and no copy overlap. Footer links and contact details are distinct.
- FAQ open state: keyboard focus is visible on the summary; answer and remaining questions stay legible.

## Provenance and coverage

The official logo uses the source navy/teal colors. The applied system keeps the same declared font stack as the source; both source and output render with system `.SF NS` in the checked Chromium environment. There is no verified formal brand guide. Source colors and applied roles are recorded in `strategy-brief.md`. The new page uses realistic images only as labelled illustrations, without manufactured staff, customers or results.

The page preserves the source's audience, free consultation, fixed-fee proposal, six services, six qualified indicative fee ranges, four onboarding stages, email enquiry and public phone. The original site supplied no testimonial, accreditation or team photo, so none appears. The buyer-question coverage map is in `strategy-brief.md`. Blue Mountain was inaccessible; the attached skill's structural guidance was used. Clean Slate's public page informed hierarchy and pacing only.

## Conversion and technical checks

- `build/surface-scan.json`: no prohibited dash characters or unresolved template markers.
- `build/static-review.json`: no missing assets, dead local links, image-role errors or structural warnings.
- `build/browser-review.json`: five required viewport pass, zero failures and zero warnings after the final hero crop.
- `build/conversion-review.json`: all three quote CTAs keyboard-activate the same addressed `mailto:` destination, including prepared business-type, support and deadline prompts; phone links resolve to `tel:+447467474356`; navigation, FAQ keyboard operation, skip link and 320px reflow passed. The external mail application was deliberately not opened and no email was sent.
- Lighthouse 12.8.2 mobile at the local URL: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.4 s, CLS 0, TBT 0 ms. Report: `build/lighthouse.json`.

The browser report initially flagged the 1280 x 600 fold, so the hero price qualifier moved to the assurance strip and the hero height was tightened. A later crop warning was resolved with a desktop-specific derivative preserving the notebook, papers and calculator. Both fixes were recaptured and rechecked at all viewports.

Lighthouse's remaining advisory opportunities are local-server cache/compression policy, about 2 KiB of CSS minification, and the 47 KiB first-party logo PNG. The scores and core loading metrics are already at target; these are accepted for this local static build. No backend or tracking is configured because the selected source journey is an email link. This is not a claim of live delivery or a Cloudflare deployment.
