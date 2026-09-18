# Website-only attempt 6

Date: 2026-09-18 to 2026-09-19 Kyiv. Verdict: rejected. Source fonts and form behavior improved, but local-final acceptance is not supported.

## Run identity

Builder `01a0b643-f43b-7453-88e0-861838558555` (Euclid), gpt-5.6-sol xhigh, fork_context=false. Started at 23:45 Kyiv and finished about 00:09. Same plain Stayclean request, blank project and frozen source a310376. Snapshot: 172 files, sorted path/hash manifest SHA-256 `87e5e3df2e15c204c1f31757a990aa7e080ce3d2d8d5925ac0f1182bdb76b969`. No prior findings or parent conversation supplied.

Fresh reviewer `01a0b65a-9985-7d11-af65-ff0319a0c1ef` (Confucius), same model and effort, fork_context=false, received only the frozen skill and final artifacts. Completed around 00:17. Both agents closed. Independence is fresh conversation plus instructed filesystem boundaries, not a separate OS/account.

## Findings and upstream corrections

| Finding | Trace and cause | Source correction |
| --- | --- | --- |
| Required performance audit skipped | Builder tried executable/package lookups for Lighthouse, then recorded it as unavailable. No package-install attempt appears in its execution trace. The entrypoint said `when available`, while a deeper reference allowed local installation. An unthrottled PerformanceObserver probe was not equivalent evidence. | Remove the ambiguous entrypoint exception. Give the short run-local npm/CLI path, supported-runtime/browser guidance and an actual-failure exception. No API key, account or external service required. |
| Loading below the existing target | Parent Lighthouse 12.8.2 scored Performance 80 twice: LCP 5405.75ms and 5412.90ms, CLS 0, TBT 0 and 60ms. About 832KiB of responsive-image savings were identified. The hero serves one 2558x1440 JPEG to phones. | Strengthen the existing image-delivery instruction from optional responsive sources to appropriately sized, efficiently encoded variants. Inspect LCP delay before choosing a fix; do not equate compression with all performance work. |
| Mobile hero obscures the proof subject | Copy, two contact controls and three proof statistics cover the van, with a heavy scrim. The image plan treats the photograph as proof, not abstract decoration. Parent and fresh reviewer confirmed the mobile pixels. | Keep the mobile hero focused on headline, concise lead and primary action. Put secondary contacts/proof strips immediately below when they consume the subject's clear space. |
| Gallery has unintended empty tracks | `styles.css:643` uses a 12-column grid. Two wide items span seven columns; the third tall item spans five columns and two rows without an explicit start. Auto-placement leaves large top-right and bottom-left holes. Parent inspected the full gallery screenshot, not just individual crops. | Check the complete spanning grid and explicitly place tall items where necessary; prefer a simple intact grid. No fixed gallery template imposed. |
| Visitor form contains owner setup instructions | `index.html:333` names Cloudflare in the notice; `script.js:282` tells the visitor to connect the destination. Existing owner/visitor separation was not followed consistently across states. | Give one plain disconnected-preview example and explicitly include error/success states in the visitor-facing boundary. Provider setup remains in the owner handoff. |
| Error summary becomes stale | Input handlers clear individual errors but leave obsolete summary entries until the next submission. Fresh reviewer reproduced it. | Keep field errors and summary synchronized as fields are corrected. This is a consistency correction, not a new review round. |

The parent installed Lighthouse 13.5.0 run-locally in seven seconds using the supported bundled Node runtime. Installation required no account or API key. That proves installation was available here; the recorded score came from Lighthouse 12.8.2, not the newly installed version. Do not conflate the versions.

## Improvements verified

- Source and applied typography agree at all five viewports: Roboto headings, Arial body. Ten comparisons match. The downloaded Roboto OFL contains an actual licence, not an HTTP error body.
- Primary CTA labels consistently open the quote form. Review columns are readable and internal verification wording is gone.
- Parent local test rejected whitespace/junk inputs, held a request pending, dispatched another submit event and observed exactly one adapter call. Retry plus another event produced one additional call, not two.
- Failure was visible, focused `form-action-message`, and preserved the entered name. Local success hid the form and focused `quote-success`. Escape restored the opener. All non-GET/HEAD requests were blocked; no transmission was attempted.
- Five-viewport browser report contains 82 passes and one hero-crop warning. No horizontal overflow was observed. This does not override the visual or performance findings above.
- The saved failure screenshot appeared cropped, but ordinary live interaction showed the state correctly. That capture artifact was not counted as a product bug.

No page was manually repaired. The changes are skill instructions only, with no extra model review layer, paid prerequisite, CRM or deployment. The existing helper test suite is retained. Portable evidence is under `evidence/website-only-r6/`; full local reports remain in the run/audit directories. Attempt 7 must start from another blank project and frozen revised skill. External-reference and image-generation cases have not started.
