# Byrider Franchise landing page acceptance report

## Result

Final result: `local final`

The local landing page is complete and passes the static, browser, interaction, visual, accessibility, performance, claim, and conversion-path checks described below. It has not been deployed and no live call or lead was placed.

## Exact files and URLs reviewed

Page source:

- `/Users/mac/Documents/Codex/2026-09-18/independent-community-byrider-acceptance/outputs/byrider-franchise-landing/index.html`
- `/Users/mac/Documents/Codex/2026-09-18/independent-community-byrider-acceptance/outputs/byrider-franchise-landing/styles.css`
- `/Users/mac/Documents/Codex/2026-09-18/independent-community-byrider-acceptance/outputs/byrider-franchise-landing/script.js`
- `http://127.0.0.1:4173/`

Research and content controls:

- `build/strategy-brief.md`
- `build/claim-ledger.md`
- `build/page-copy.md`
- `build/image-plan.md`

Automated evidence:

- `build/surface-scan.json`
- `build/static-review.json`
- `build/browser-review.json`
- `build/interaction-review.json`
- `build/lighthouse.json`

Pixel evidence reviewed at the captured viewport size:

- `build/screenshots/390x844-landing.png`
- `build/screenshots/768x1024-landing.png`
- `build/screenshots/1024x800-landing.png`
- `build/screenshots/1280x600-landing.png`
- `build/screenshots/1440x900-landing.png`
- `build/screenshots/390x844-menu-open.png`
- `build/screenshots/390x844-faq-open.png`
- `build/screenshots/390x844-nojs.png`
- all mobile and desktop files in `build/image-review/`, including the dedicated model-rail screenshots

External destinations checked on 2026-09-18 and returned HTTP 200:

- `https://byriderfranchise.com/`
- `https://byriderfranchise.com/the-investment/`
- `https://byriderfranchise.com/available-markets/`
- `https://byriderfranchise.com/privacy-policy/`
- `https://byriderfranchise.com/learn-more/`
- `https://byriderfranchise.com/byrider-franchisees-partner-to-acquire-franchising-assets/`

## Viewport and state coverage

| Viewport or state | Specific visual observations | Result |
| --- | --- | --- |
| 390 x 844 mobile | White logo remains clear on the navy header. The primary call action is visible in the first view. The hero copy, facts, and dealership image stack in a clear order. Long headings wrap without clipping. The model numbers no longer overlap the headings. Every proof image keeps its full subject and caption. Section changes remain distinct across the long page. Footer links remain separated and operable. | Pass |
| 768 x 1024 tablet | The compact header and menu preserve CTA priority. Hero, support, ownership, and closing media use the available width without subject loss. Type density stays readable, repeated layouts vary enough to preserve rhythm, and no horizontal overflow or dead strip appears. | Pass |
| 1024 x 800 laptop | The full navigation is available, the two-column hero is balanced, and image captions remain legible. The operating-model rail, investment ledger, proof section, and FAQ maintain clean alignment and spacing. | Pass |
| 1280 x 600 short laptop | Header and hero call actions are both visible and unobscured in the first view. The H1 and dealership subject remain visible despite the short height. No fixed, consent, chat, or sticky element covers conversion content. | Pass |
| 1440 x 900 desktop | Brand colors, logo, editorial type scale, orange action hierarchy, and blue structural fields remain consistent. The hero has balanced copy and image weight. All later sections alternate cleanly, image subjects stay intact, and the legal footer is visually separate from the final CTA. | Pass |
| Mobile menu open | Keyboard activation opens the menu, moves focus into navigation, shows every destination and the phone action, and does not permanently obstruct content. Escape closes it and restores focus to the menu button. | Pass |
| First FAQ open | Enter opens the native disclosure and leaves a visible orange focus ring contained inside the summary control. Answer copy stays below the control without collision. | Pass |
| Mobile without JavaScript | The script-dependent menu button is hidden and a complete fallback navigation is visible with the four section links and the phone CTA. The page remains navigable. | Pass |
| Reduced motion | The reduced-motion media query is honored and computed smooth scrolling resolves to `auto`. | Pass |

No form, modal, consent banner, chat widget, brochure, download, booking flow, or thank-you state is part of this landing page. Those state checks are not applicable. The selected conversion is a direct phone action.

## Brand, typography, rhythm, and proof integrity

- Brand fidelity: official Byrider logo assets, navy, blue, orange, and white are consistent from header through footer.
- Hero priority: H1, one orange call action, phone fallback, three proof facts, and a first-party dealership image establish a clear reading order.
- Typography and contrast: headings remain distinct at every breakpoint; body widths and line heights remain readable; automated accessibility score is 100.
- Section rhythm: dark hero, light model rail, cream support, blue investment, white ownership, orange testimonial, and dark closing action create clear changes without repeating one card pattern.
- Image crop and proof: all content-bearing images render with zero measured crop fraction. No copy overlaps an information-bearing image.
- Footer and final conversion: the final CTA is distinct from the legal footer. Footer controls retain spacing and readable labels.
- Completion check: no clipped text, unresolved template marker, prohibited dash character, empty block, broken image, accidental horizontal scroll, or unfinished state remains.

Asset-specific visual review:

| Asset | Evidence | Observation |
| --- | --- | --- |
| White and color logos | `header-logo-mobile.png`, `header-logo-desktop.png`, full-page captures | Marks remain sharp, proportionate, and visible on their respective backgrounds. |
| Dealership hero | `hero-dealership-mobile.png`, `hero-dealership-desktop.png` | Building signage and vehicle context remain fully visible; no cover crop is used. |
| Support team | `support-team-mobile.png`, `support-team-desktop.png` | The complete group remains visible. The blue accent stops before the caption and does not cover faces or text. |
| Franchisee owners | `franchisee-owners-mobile.png`, `franchisee-owners-desktop.png` | All six people and the Byrider wall mark remain visible. No decorative badge covers the proof image. |
| Dale Boone portrait | `dale-boone-mobile.png`, `dale-boone-desktop.png` | Face remains centered and uncropped next to the attributed quotation. |
| Closing dealership | `dealership-exterior-mobile.png`, `dealership-exterior-desktop.png` | Building, vehicles, signage, and caption remain intact. |
| Operating model | `model-rail-mobile.png`, `model-rail-desktop.png` | All three labels, icons, descriptions, and numbers remain separate; the former mobile number-heading collision is resolved. |

All photographic assets are first-party files retrieved from Byrider's official franchise site. Their use here is limited to this local preview. Publication and redistribution rights were not established.

## Static and browser gates

- Surface scan: pass, 14 files scanned, 0 findings.
- Static page validation: pass, 1 H1, valid viewport, 0 missing assets, 0 image issues, 0 form issues, 0 dead local links, and 0 raw analytics fields.
- Browser measurement: pass at all 5 required viewports, 0 failures, 0 warnings.
- Every rendered image decoded at each viewport.
- No serious console or network error was observed.
- No horizontal overflow, image-text collision, overlay conflict, undersized primary target, or footer gap issue was reported.

## Interaction, accessibility, and conversion

- All primary actions use the same exact label: `Call Franchise Development`.
- All phone actions resolve to `tel:800-947-4532`, and `800-947-4532` is shown as a visible fallback.
- The full keyboard cycle contains 21 interactive stops on mobile and 25 on desktop, then returns to the first stop.
- The call action has a visible 3 px solid orange focus outline.
- Mobile menu focus entry, Escape close, and focus restoration pass.
- Native FAQ keyboard opening passes.
- One H1 and a logical H1, H2, H3 hierarchy are present.
- Narrow reflow is covered by the 390 px layout, with no horizontal overflow; it represents the effective CSS width reached when a roughly 780 px presentation is enlarged to 200 percent.
- No live call was initiated. This confirms the configured destination contract without creating an external conversion.

## Lighthouse

One uncontended local Lighthouse run produced:

- Performance: 99
- Accessibility: 100
- Best Practices: 100
- First Contentful Paint: 1.18 seconds
- Largest Contentful Paint: 1.38 seconds
- Cumulative Layout Shift: 0
- Total Blocking Time: 20 milliseconds

The page exceeds the local performance targets. Lighthouse still notes CSS minification, text compression, cache lifetime, and responsive image opportunities. The Python preview server intentionally provides no production compression or cache policy, so those hosting diagnostics are not production evidence and do not block a local final. Responsive image variants can be added during an authorized publishing pass.

## Fixes made and retested

- Added a no-JavaScript mobile navigation and limited the menu button to script-enabled pages.
- Removed the decorative ownership-image badge so the image plan and rendered proof agree.
- Added mobile heading clearance so the gray model numbers cannot collide with labels.
- Shortened the support-image accent so it ends before the caption.
- Contained the FAQ focus outline inside its summary control so it cannot cross the answer copy.
- Completed the copy master with the rendered third hero proof line and removed unrendered header utility and number-fallback entries.
- Added ledger entries for automotive newcomers, the Carmel headquarters caption, and the qualified governance inference.
- Extended keyboard evidence from a partial sample to a complete tab cycle.
- Re-ran static validation, five-viewport browser measurement, interaction capture, asset capture, link checks, pixel review, and Lighthouse after the fixes.

## Unresolved limits

- This is a local preview only. No deployment, analytics, form backend, CRM connection, or live lead path was requested or created.
- The phone link was inspected but no real call was placed.
- Current FDD Item 7 and Item 19 remain the controlling sources for investment and financial performance information.
- Market availability, qualification, fees, and operating requirements can change and must be confirmed with Byrider Franchise Development.
- Image publication and redistribution rights remain unresolved beyond this local preview.
- Production compression, cache headers, and responsive image delivery require an authorized hosting pass.
