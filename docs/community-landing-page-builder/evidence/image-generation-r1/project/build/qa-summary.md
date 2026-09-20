# Local acceptance: Clarentis landing page

Status: **local final**. Review completed 2026-09-20. This is a self-review, because no independent reviewer tool was available. No live lead, Cloudflare account, private mail account or production endpoint was accessed.

## Reviewed artifacts

- Page: `index.html`, `styles.css`, `assets/` at `http://127.0.0.1:53187/`.
- Source identity and typography: `build/brand.json` and official page https://clarentis.co.uk/ .
- Five full-page browser captures: `build/screenshots/390x844-landing.png`, `768x1024-landing.png`, `1024x800-landing.png`, `1280x600-landing.png`, and `1440x900-landing.png` in the same screenshots directory. First-viewport crops with `-first.png` were reopened at native pixel size.
- Image-specific review: `build/screenshots/390x844-y2080.png` and `1440x900-y1550.png` for the records image; all five first-viewport crops for the hero and logo.
- Open states: `build/screenshots/390x844-menu-open.png` and `390x844-faq-open.png`.
- Machine reports: `build/surface-scan.json`, `build/static-review.json`, `build/browser-review.json`, and `build/lighthouse.json`.

## Findings and checks

| Area | Final observation |
| --- | --- |
| Source conversion | The official site leads with an email request for a fixed-fee quote and free initial consultation. All four page CTAs use exactly "Request your fixed-fee quote" and link to `mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20enquiry`. The published phone is visible near the top and at final contact; all four `tel:` links target `+447467474356`. No on-site form or false success state was added. |
| Buyer argument | UK small-business fit appears in the hero. All six source services, all six fee entries with indicative qualifiers, all four onboarding stages, starting-price eligibility, and what to put in the first email are covered. No testimonial, accreditation, review count or employee identity was invented. |
| Brand | The official logo is legible against white at mobile and desktop sizes. Navy and teal are recognisable from the source, with a darker teal used for white-text contrast. The applied heading and body stack matches the official declared stack, and Chromium reports the same `.SF NS` rendered font family on this host. No formal brand guide was found. |
| Visual age and rhythm | The hero is unframed, with actual clear wall behind its text and the notebook, folders and laptop visible at 1024, 1280 and 1440px. At 390 and 768px the headline precedes the unobstructed photo. The following trust content is visible in the first viewport at all five sizes. Service rows, record photo, fee table, process, FAQs and contact vary the page rhythm without a repeating card grid. |
| Image truth | The two generated workspace images are disclosed as illustrative in visible captions and alt text. They do not suggest Clarentis people, premises, customer records, certifications or results. The record image is fully inspectable on mobile and desktop; no text overlays it. |
| Responsive/accessibility | Browser helper: pass, zero failures and zero warnings across 390x844, 768x1024, 1024x800, 1280x600, 1440x900. No horizontal overflow, missing images or broken primary destinations were reported. At 320px there is no horizontal overflow. Native mobile menu and FAQ opened with Enter, visible focus remained on the controls, and reduced-motion CSS disabled smooth scrolling. The skip link, semantic landmarks, labels/captions and footer targets were checked. |
| Static quality | Surface scan: pass, no prohibited dashes or unresolved sample markers. Static validator: pass, no missing assets, image-role failures or dead links. |
| Mobile Lighthouse | Lighthouse 12.8.2: Performance 100, Accessibility 100, Best Practices 100, SEO 100. LCP 1.58 s, CLS 0, TBT 0 ms. Cache-policy suggestions reflect the temporary Python server without production cache headers. |

## Fixes and limits

The first pass found a missing logo role, a favicon 404, footer links below the 24px target, and a 1024px hero that hid the next section and cropped its image. These were fixed and retested. The focused FAQ answer was given extra space below its outline and visually rechecked.

The email links were checked in the browser DOM but not activated into a private mail app; no email was sent, so receipt by Clarentis is unverified. Calls were not placed. The page is static and needs no form backend for its current source-faithful email action. Cloudflare connection, publication, production caching and destination verification remain for the owner. The official logo was used for the requested local preview; publication rights should be confirmed by the business owner. Build notes and QA screenshots are local review material, not customer-facing page content.
