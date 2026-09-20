# Local acceptance

**Result: local final.** Reviewed 20 September 2026 against `http://127.0.0.1:4199/`. This was a self-review; no independent reviewer was available in the current tools.

## Coverage and evidence

- `build/surface-scan.json`: pass, no prohibited long dashes, entities, or unresolved markers.
- `build/static-review.json`: pass, one H1, no missing local assets, form-label issues, dead local links, or raw contact analytics fields.
- `build/browser-review.json`: pass, zero failures and zero warnings at 390x844, 768x1024, 1024x800, 1280x600, and 1440x900. Source and applied rendered fonts match.
- `build/conversion-review.json`: 41 passing synthetic checks covering required and malformed fields, partial error correction, summary-link focus, failure visibility and value retention, success after receipt, reset, duplicate submission, timeout recovery, menu, FAQ, and the future live-mode switch.
- `build/lighthouse.json`: Lighthouse 12.8.2 mobile performance 98, accessibility 100, LCP 2405 ms, CLS 0, TBT 0, contrast pass.

## Fresh pixel review

- `build/screenshots/390x844-first-screen.png`: official logo and full room visible in the upper hero; heading and main action fit beneath the photograph; evidence rail starts within the viewport. Text does not cover the glazed opening.
- `build/screenshots/768x1024-first-screen.png`: room and doors are inspectable, copy sits in the dark lower hero, and both the evidence rail and start of projects remain visible.
- `build/screenshots/1024x800-first-screen.png`: product and CTA remain readable; image and copy do not collide with the glazed opening.
- `build/screenshots/1280x600-first-screen.png`: CTA is fully visible at short height; room stays visible; the next band begins below the hero.
- `build/screenshots/1440x900-first-screen.png`: the first-party photo blends into the dark copy area without a hard edge; logo, action, project subject, and evidence rail are legible.
- `build/screenshots/390-projects.png` and `build/screenshots/1440-projects.png`: Walthamstow, Dyserth, and Moreton photos load in their named placements, with full subjects, readable captions, no crop of information, and no copy over the photos.
- `build/screenshots/390-enquiry.png` and `build/screenshots/1440-enquiry.png`: fields, optional marketing checkbox, privacy link, action, and alternative phone link are legible and separate. Mobile form does not overlap the footer.
- `build/screenshots/390x844-form-validation.png`, `390x844-form-failure.png`, and `390x844-form-success.png`: error text, retry result, and compact confirmation are readable. Failure is visible beside the action; the confirmation fits the mobile viewport.

The page uses the company's actual dark logo, lime accent, Reem Kufi heading font, Poppins body font, and official project photos. Green Retreats informed the photographic rhythm and browsing clarity, not the wording or assets. The result reads as a current garden-room service page rather than the original site's blurred hero treatment.

## Source conversion parity

The source offer is a free design consultation and quote through an enquiry form. The local page retains that form journey, requires name, email, and a project message, keeps phone optional, and separates optional marketing consent. The primary CTA label is consistent. No public production form endpoint was reused and no live lead was submitted.

## Fixes and limits

Fixed mobile and tablet hero cropping, desktop image/copy collision and hard photo edge, one process-label contrast failure, oversized mobile hero delivery, and technical wording in the preview success state. All affected views and tests were rerun after the changes.

The live lead destination is not configured. The page remains in preview mode until a Cloudflare route confirms acceptance and the mode is switched as described in `build/cloudflare-handoff.md`. Cloudflare was not accessed and nothing was published. The images and logo are public first-party assets; permission to republish them should be confirmed with the business owner before deployment. External links point to the company's public pages; no live form or account test was performed.
