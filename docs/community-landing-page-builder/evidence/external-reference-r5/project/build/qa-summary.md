# Local QA and handoff

Status: **local final**, reviewed 2026-09-20. This is a complete local landing-page experience, not a published or lead-delivering site.

## Files and preview

- Page: `index.html`, `styles.css`, `script.js`, and local `assets/`.
- Local URL: http://127.0.0.1:8787/ served by `../work/preview_server.py`.
- Research and implementation record: `build/strategy-brief.md`, `build/claim-ledger.md`, `build/page-copy.md`, `build/image-plan.md`.
- Machine evidence: `build/surface-scan.json`, `build/static-review.json`, `build/browser-review.json`, `build/lighthouse-final.json`.
- Representative visual evidence: `qa/320x568-top.png`, `qa/390x844-top.png`, `qa/768x1024-top.png`, `qa/1024x800-top.png`, `qa/1280x600-top.png`, `qa/1440x900-top.png`, their full-page captures, section captures at 390 and 1440, and popup, validation, failure, and success captures.

## Acceptance review

This was a fresh **self-review** of the final raw captures; no independent reviewer was available in the active toolset. Reviewed top and full-page renders at 320x568, 390x844, 768x1024, 1024x800, 1280x600, and 1440x900. Reopened the 390 and 1440 section captures, plus `qa/320x568-modal.png`, `qa/390x844-modal.png`, `qa/390x844-validation.png`, `qa/390x844-failure.png`, `qa/390x844-success.png`, and `qa/1280x600-modal.png` at readable size.

- The first viewport visibly presents the official white-and-lime logo, a first-party garden room photo with its building and glazing unobscured, the published phone number, and an enquiry action. At 320x568, the trust strip starts in the first viewport. At 1280x600, the next content is hinted below the hero.
- The Walthamstow and Moreton photographs are identifiable, unoverlaid project proof. Their captions, adjacent copy, and links remain readable at 390 and 1440. No people, product detail, or information-bearing text is covered by copy.
- The page varies image, case-study, specification, process, quote, testimonial, FAQ, and final-action layouts without repeated floating cards. Heading and body text wrap cleanly. The footer retains separate, legible links.
- The popup stays within the short mobile and laptop viewports, keeps the submit action visible, and scrolls fields into view as keyboard focus advances. Validation, failure, and success copy are visibly distinct. The success state explicitly says the enquiry was not delivered to the business.
- The initial section captures exposed the translated skip link over scrolled content; clipping its resting state removed that artifact. A keyboard test still focused it at the top and activated `#main`.
- A Lighthouse contrast failure on small section numbers was corrected by using the existing darker green. The final accessibility audit has no failing checks.

The design retains the official logo, lime accent, project imagery, and the official rendered heading/body families, Reem Kufi and Poppins. It updates the older source site's composition with unframed space, restrained color proportions, and larger photographic proof. The supplied Green Retreats example informed image rhythm and buyer-question breadth, not claims, branding, or copied layout.

The page answers the material consultation questions: possible uses; a real multi-use project; site-specific structure, finish, services and foundations; the free initial discussion, survey, CAD proposal and no-obligation quote; planning and geographic uncertainty; and real customer feedback. Exact service availability, planning position, and price still need project-specific assessment. There is no unsupported price, deadline, showroom, environmental promise, or fabricated rating.

## Test results

- Surface scan: pass, zero prohibited long dashes or unresolved placeholders.
- Static validation: pass, no missing assets, dead local links, image/form issues, or primary section jumps.
- Browser matrix: six viewports with zero horizontal overflow, missing images, or uncaught page errors; phone visible; every visible `Enquire online` control opened the same dialog without changing scroll position, and closing returned focus.
- Synthetic form test at 390 and 1440: empty and whitespace-only required fields, malformed email and optional phone, inline and summary error correction, summary-link focus, 503 failure with values retained, confirmed local receipt, retained success state, new enquiry reset, one request under duplicate submit, pending lock on reopen, and eight-second timeout recovery all passed. The receiver does not save or forward data. No live lead was submitted.
- Final Lighthouse mobile: Performance **98**, Accessibility **100**, LCP **2.481 s**, CLS **0.00002**, TBT **0 ms**. Earlier repeat performance runs after hero optimization were also 98 with LCP about 2.48 s. These are local synthetic measurements, not a live-host guarantee.

## Launch boundary

The form currently calls `/__preview/enquiry`, which exists only in the local preview server. Uploading the static page unchanged to Cloudflare would not deliver enquiries, so this build must not be presented as live lead capture yet. Before publication:

1. Connect a real server-side enquiry destination with validation and a confirmed receipt. Update the `fetch` URL and receipt check in `script.js`; do not show success until that destination confirms it. Replace the preview-only submit, failure, and success wording in `index.html` and `script.js`.
2. Verify the deployed form's success and failure behavior with an authorized test, check spam protection and privacy handling, then remove `noindex,nofollow` from `index.html` when the public page is ready.
3. Confirm The Garden Room Co. may republish the first-party photos and logo, and verify the phone and external policy/project links in the final domain context.

No Cloudflare connection, publication, private account access, live form submission, analytics, CRM, or brochure was performed. The current page is suitable for local review and production wiring, not a claim of live delivery.
