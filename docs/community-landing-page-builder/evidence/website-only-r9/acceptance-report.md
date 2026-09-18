# StayClean local acceptance report

Acceptance completed 2026-09-19.

## Result

`local final`

The static landing page is complete and passes the selected local quality gates. Hosting, DNS, production form delivery and analytics are not configured because Cloudflare connection was explicitly deferred. The default form therefore reports that nothing was sent; it never presents a false success state.

## Exact review targets

- Local page: `http://127.0.0.1:55080/`
- Synthetic local success state: `http://127.0.0.1:55080/?qa=success`
- Synthetic held-request state: `http://127.0.0.1:55080/?qa=hold`
- Page files: `index.html`, `styles.css`, `script.js`
- Research and provenance: `build/strategy-brief.md`, `build/claim-ledger.md`, `build/page-copy.md`, `build/image-plan.md`, `build/brand.json`
- Automated evidence: `build/static-review.json`, `build/surface-scan.json`, `build/browser-review.json`, `build/local-qa.json`, `build/lighthouse.json`
- First-fold screenshots: `build/screenshots/390x844-first-fold.png`, `768x1024-first-fold.png`, `1024x800-first-fold.png`, `1280x600-first-fold.png`, `1440x900-first-fold.png`
- Full-page screenshots: `build/screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, `1440x900-landing.png`
- Modal screenshots: `build/screenshots/390x844-modal.png`, `768x1024-modal.png`, `1024x800-modal.png`, `1280x600-modal.png`, `1440x900-modal.png`
- Image-placement screenshots: `build/screenshots/mobile-services.png`, `desktop-services.png`, `mobile-method.png`, `desktop-method.png`, `mobile-story.png`, `desktop-story.png`
- Form-state screenshots: `build/screenshots/390x844-validation.png`, `390x844-failure.png`, `390x844-success.png`

## Viewports and states

The rendered page and modal were measured at 390x844, 768x1024, 1024x800, 1280x600 and 1440x900. A separate 320x800 reflow check found no horizontal overflow and kept the H1 and primary action in the first viewport. Reduced-motion behavior was exercised by the browser review. Mobile and desktop anchor navigation landed content below the sticky header.

The form checks covered blank submission, live correction after one field is fixed, whitespace-only values, malformed email and phone values, disconnected failure with retained inputs, one synthetic local success, Escape and close behavior, focus containment, focus restoration, action visibility in the scrolling modal and duplicate-submit prevention.

## Pixel findings

This was a self-review because no independent fresh-context reviewer was available in the current tools. Raw first-fold, full-page, modal and section captures were reopened at readable size after the final fixes.

- The hero keeps the team and fleet visible without placing the H1 or actions over faces. Its intentional `cover` crop triggered four automated crop warnings, but inspection confirmed no lost proof subject or text collision.
- The mobile hero keeps the H1, quote action, telephone action and 115 pixels of the trust rail visible at 390x844. The short-laptop view keeps 41 pixels of the next section visible at 1280x600.
- Residential, commercial and gutter photographs preserve the worker, pole and property context at both widths. The high-reach image retains the brush, pole and windows. The Clifton image keeps both vans and the bridge visible.
- No incoherent overlaps, clipped controls, broken images, horizontal overflow, console errors or failed local resources were found across the five required viewports.
- The modal action row stays visible and unobscured at all five sizes. Validation, failure and success messages are readable and receive programmatic focus as intended.

## Design and visual age

The logo, teal `#073f43`, yellow `#ffcd49`, Bristol language, real fleet and work photography remain recognizably StayClean. Legacy inset hero framing, oversized source typography, mixed pill treatments and repeated saturated bands were not inherited.

The final pixels read as a current local commercial service page: restrained teal surfaces, one clear yellow action role, large first-party proof imagery, stable spacing and direct scannable copy. The yellow clean-edge rule and wide Bristol fleet image make the design specific without relying on decorative effects. The visual system is intentionally distinct from the Clean Slate execution benchmark while meeting its level of hierarchy and image confidence.

## Conversion parity

The exact primary CTA is `Get a free quote`. The modal preserves the source journey and fields: service, one-off or regular frequency, name, optional company, email, phone, address, postcode and optional message. It preserves the source qualifier that StayClean normally replies within one working day and links to the public privacy policy.

The production Contact Form 7 destination was not reused or called. Default local submission fails honestly with retained values. The localhost-only QA modes prove the success focus state and one-request duplicate guard without transmitting contact data.

## Typography provenance

No verified client brand guide was found. Browser measurement of the official StayClean site found Roboto 400 for its H1 and Arial for meaningful hero prose. The page applies a locally bundled Roboto 400 heading font under the SIL Open Font License and Arial for body, navigation and controls. `build/browser-review.json` confirms both applied roles rendered with the expected families at all five viewports; no substitution was needed.

## Fixes and retests

- Corrected tablet footer wrapping and retested all required widths.
- Added explicit modal Tab containment and a programmatic focus guard; retested escape, close and opener restoration.
- Removed an incorrect fixed-height story crop so the Clifton image retains both vans and the bridge.
- Added a local favicon to remove the only failed browser resource.
- Kept modal actions outside the scrolling field region so submit remains available on short screens.
- Retested static structure, surface text, five viewports, 320px reflow, anchor positions, form states and mobile Lighthouse after the final page fixes.

## Gate evidence

- Static validator: pass with one H1, no missing assets, no image or form issues, no dead links and no raw analytics fields.
- Surface scan: pass with no banned placeholders, dash characters or fake completion language.
- Browser review: no failures across five viewports; four accepted hero-cover crop warnings only.
- Local behavior QA: 14 of 14 checks passed; no console errors.
- Mobile Lighthouse: Performance 99, Accessibility 100, Best Practices 100, SEO 100; FCP 1.2s, LCP 2.0s, CLS 0, TBT 40ms.

## Unresolved limits

- Production quote delivery, rate limiting, server-side validation, durable storage, email or CRM notification and receipt-based success are not implemented until the owner connects a Cloudflare backend.
- Cloudflare caching and compression are not represented by the local Python server. Lighthouse notes those deployment opportunities, but the local loading budget passes without them.
- No analytics or advertising conversion destination was requested or configured.
- Public first-party StayClean images were used as local proof assets. The owner should confirm ongoing publication rights before deployment.
- The public source claims and contact details were retrieved on 2026-09-19 and should be rechecked if deployment is delayed materially.
