# PDF Default and Paid-Ad Funnel Containment

## User Direction

Received during the Clarentis full-funnel independent run on 2026-09-21. Correct the canonical community skill now, but test these changes on the next fresh run. Continue the current frozen run through audit, Cloudflare deployment and CRM verification; do not retrospectively call it compliant with these new requirements.

The open browser at port 4187 was the older preview, not the running build. The new run is Clarentis, business 3, with newly generated imagery. Its local Worker at port 8899 was verified to serve the Clarentis title and report a connected database. A request to open it in Codex returned queued. This UI mismatch is an orchestration/handoff failure, not evidence that the agent selected Stayclean.

## Traced Causes and Corrections

| Requirement | Prior source and failure mechanism | Correction |
| --- | --- | --- |
| Useful PDF by default | SKILL.md explicitly called brochures optional and catalogue-workflow.md activated only on request or a pre-existing document offer. The static gate did not require a PDF. Omission was therefore permitted by the instructions, not prevented by prior image/PDF layout fixes. | Default to a researched guide, service overview, options summary, checklist, catalogue or verified price list. Omit only for a concrete source-supported buyer reason in the existing strategy brief. No fabricated prices or forced download-led CTA. |
| No main-site exits | reference-fidelity.md permitted a verified external route for options or research; build-contract.md permitted real external destinations without separating browsing from conversion. | Ban visitor-facing main-business-site/subdomain links in the page, logo, footer, privacy, success page and PDF. Bring useful verified information into the funnel. Keep research citations in owner notes. Phone/email and genuinely required third-party conversion destinations retain their separate role. |
| Cheap enforcement | Existing static checks found broken links but not this funnel-level escape or absent linked brochure. | Extend the existing validate_page.py command with repeatable --source-site, source-host link checks, and linked local PDF signature checking. An explicit --omit-brochure-reason is recorded as a review warning, not accepted as proven research. No extra model review round. |

## Tests and Limits

- 75 package tests passed on 2026-09-21 using the bundled Python runtime.
- Added regressions for missing/unlinked/remote/non-PDF files, explicit omission evidence, main-host/www/subdomain/protocol-relative links, lookalike domains, phone/email preservation, thank-you links and HTML base destinations.
- A file signature is not a full PDF integrity or visual check. Actual download, full PDF render review and useful-content review remain required.
- HTML checks do not prove absence of JavaScript navigation, redirect destinations or PDF annotations. These belong to the existing browser/PDF review, now explicitly stated.
- Main-site host checking depends on supplying actual official domains. Missing source-site input yields a visible warning, not a false claim of verification.
- These changes are not evidence of a fresh behavioral pass. The active run's frozen package remains unchanged.

Luke's README and original skill remain untouched. Save only in the community skill/docs and push to the separate review branch.
