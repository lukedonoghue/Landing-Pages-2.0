# Stayclean local acceptance report

Reviewed: 2026-09-19

Final result: **local final**

## Scope and provenance

- Final files reviewed: `index.html`, `styles.css`, `script.js`, `local-server.mjs`, and all referenced files in `assets/`.
- Local URL reviewed: `http://127.0.0.1:4187/`.
- Public source reviewed: `https://www.stayclean.co.uk/` and the service, gutter, about, FAQ, contact, and privacy pages listed in `strategy-brief.md`.
- Design provenance: official Stayclean logo, teal and yellow palette, first-party work photography, and source conversion contract. The new composition is custom and uses restrained service-page patterns rather than reproducing the older CMS layout.
- Visual-age checkpoint: capable, local, and direct. Large proof imagery, open spacing, limited radii, quiet borders, and one yellow primary action produce a current trade-service page without decorative template effects.
- Typography provenance: no public brand guide was found. Browser extraction in `brand.json` verified Roboto Regular for the official homepage H1 and Arial for body prose. The final uses locally hosted Roboto for headings and Arial for body copy with no substitution.

## Viewports and states

- Full pages and quote modals: `390x844`, `768x1024`, `1024x800`, `1280x600`, and `1440x900` in `build/screenshots/`.
- Form states: empty validation, corrected-field validation, local failure, local preview success, and simulated production success at `390x844`.
- Keyboard states: modal containment, complete tab order, visible focused controls, close behavior, and focus return to the opening quote button.
- Automated browser result: zero failures. One warning records a 48 percent crop on the narrow mobile hero.

## Pixel findings

- `390x844-first-screen.png`: logo and menu are clear, the H1 and CTA fit, and the selected crop shows the commercial building, pole, and branded van without text covering a person.
- `1280x600-first-screen.png`: the full desktop navigation, headline, CTA, team, vehicles, and next-section cue remain visible in the short viewport.
- `1440x900-services.png`, `1440x900-methods.png`, and `1440x900-proof.png`: each image supports its adjacent claim; operators, poles, fleet, and building context remain readable and unobscured.
- `1440x900-reviews.png`, `1440x900-faq.png`, and `1440x900-footer.png`: review attribution, coverage limits, FAQ controls, contact routes, and company details have no clipping or collisions.
- `390x844-modal.png` and `1280x600-modal.png`: the modal fits the viewport, fields scroll independently, and submit and cancel actions stay visible.
- `390x844-validation.png`, `390x844-failure.png`, `390x844-success.png`, and `390x844-production-success.png`: each final state is readable and contains no stale form content or covered controls.

The narrow hero crop warning is accepted because the inspected pixels preserve the content-bearing building, cleaning pole, and branded van, while excluding the operator from the text area. It does not hide a person or essential service evidence.

## Conversion parity

- Preserved source action: `Get a free quote`.
- Preserved required inputs: service, frequency, name, email, phone, address, and postcode.
- Preserved optional inputs: company and message.
- Preserved source promise: Stayclean normally replies within one working day.
- The local receiver never sends details and returns an explicit preview response.
- A simulated production `{ "ok": true }` response selects the real sent confirmation.
- Validation summary focus, live error clearing, failure focus, value preservation, success focus, opener focus restoration, and the in-flight duplicate guard all pass in `form-flow-review.json`.

## Automated evidence

- `surface-scan.json`: pass, no prohibited marks or placeholders.
- `static-review.json`: pass, one H1, no missing assets, form issues, dead local links, or license-download problems.
- `browser-review.json`: pass with the accepted mobile crop warning; zero failures across five viewports.
- `form-flow-review.json`: pass, including one request under a rapid double-submit attempt.
- `lighthouse.json`: Lighthouse 13.5.0 mobile scores are Performance 98, Accessibility 100, Best Practices 100, and SEO 100. FCP is 1.2 s, LCP is 2.4 s, TBT is 10 ms, CLS is 0, and Speed Index is 1.2 s.

## Fixes retested

- Reframed the mobile hero so copy does not cover an operator.
- Split desktop and mobile hero preloads and added high-priority discovery.
- Right-sized the logo and recompressed the mobile hero candidate.
- Kept modal actions visible at short heights and trapped keyboard focus.
- Added a global hidden-state rule so form and success views cannot overlap.
- Verified local and production-response confirmation copy separately.
- Added validation focus, live correction, failure recovery, and duplicate-submit protection.

## Limits

- Cloudflare deployment and the production `/api/quote` handler are intentionally not connected.
- No live lead was submitted, and no private account or credential was accessed.
- Analytics, CRM, advertising conversion tracking, and consent tooling were not selected.
- Image files came from Stayclean's public first-party site; the business should confirm reuse rights before publication.
- External links were source-checked during research but must be rechecked on the final published domain.
- Lighthouse is a local lab result, not field performance data.
- No independent reviewer was available in the current toolset. Final acceptance used a fresh self-review of the raw viewport, section, modal, validation, failure, and success captures at readable size.
