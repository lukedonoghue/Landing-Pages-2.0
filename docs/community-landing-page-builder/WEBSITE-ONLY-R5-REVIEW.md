# Website-only attempt 5

Date: 2026-09-18. Verdict: rejected, despite the builder's `local final` label. Page and local form quality improved; this is not yet an accepted cold-start result.

## Run identity

Builder `01a0b61f-0ff1-77a3-b553-d3b53fa084c0` (Dirac), gpt-5.6-sol xhigh, fork_context=false, started about 23:05 Kyiv and completed about 23:35. It received the same plain Stayclean request, frozen skill and empty project. Frozen source: 54ca1e6, 172 files, manifest hash `2b5a01ca4847853675536ff93852e65729779d316488eec1ea89e295bf83a0c0`. No parent corrections were sent to the builder.

Independent visual reviewer `01a0b639-ee24-71a2-9a1a-a2a17b7381a7` (Bohr), same model/effort, fork_context=false, received skill and final artifacts only. Both agents completed and were closed. Filesystem isolation remains instructed rather than enforced by a separate OS/account.

## Confirmed cause and source correction

| Finding | Evidence and cause | Smallest source correction |
| --- | --- | --- |
| Body-font substitution reported as unchanged | Builder's own rendered source report identifies Arial on actual hero prose. Parent also inspected below-fold source prose, confirming Arial. Applied body is Roboto; the strategy incorrectly claims rendered body is Roboto. The rule already prohibited relying on global declarations, but no helper compared research observations against output. | Save rendered source data once as `build/brand.json`; the existing five-viewport helper now compares heading/prose families and exposes source and applied selectors/text. Differences require correction or an existing permitted exception, not a new research round. |
| Downloaded font licence is a 404 response | `assets/Roboto-LICENSE.txt` contains exactly `404: Not Found`. The download used curl without HTTP failure handling, and a file-type check only established ASCII text. | Require HTTP-success handling and content inspection for asset/licence downloads. Static validation now rejects empty or obvious failed licence downloads. |
| Short-height hero cuts away intended proof | At 1280x600, the fixed 440px hero crops most of the team and vans. The image plan says those subjects provide proof; the builder accepted building context instead. | Validate the hero with actual copy at both mobile and short-height sizes before committing; do not satisfy the next-section peek by removing the proof subject. |
| Inconsistent action promise | `Check your postcode` opens the seven-required-group quote form. This violates the exact-label/real-next-step rule, though it is not equivalent in severity to duplicate lead submission. | Clarify that all openers for the same journey use the exact CTA label, not a narrower checker label. |
| Narrow testimonial columns at 1024px | Parent recaptured the section: nested review columns, 36px padding and unreset browser blockquote margins leave ordinary copy in one-to-three-word lines. No overflow does not mean readable prose. | Clarify the existing intermediate-width check to consider usable text width and blockquote margins; collapse columns sooner. |
| Internal verification wording appears as customer proof | The page labels embedded customer feedback as verified; the ledger establishes source-site attribution, not independent verified-review status. | Keep verification activity in notes; use plain customer-review language unless verification status itself is supported. |

The screenshot's heavier hero body was a reason to investigate, not proof of a corrupt font file. Confirmed issue is the source/applied-family mismatch; no claim is made that the WOFF2 binary is broken.

## Findings not escalated into more gates

- Reviewer also called the 1024px FAQ heading too narrow. Parent recapture showed a readable three-line heading with a clear adjacent FAQ column, not a blocking defect. No rule added for that preference.
- Photos are mentioned as useful without a form upload. Source has the same input pattern and real secondary contact routes; no upload was promised. Clarifying a later photo handoff is useful polish, not grounds to invent attachment infrastructure.
- The local success state retains the enquiry context heading above a clear success title. This is a minor editorial improvement, not an inaccessible or false success state. No new blanket gate added.
- Parent's initial image-load check incorrectly tested below-fold lazy images before scrolling. The test was corrected to load them, then passed. This was a parent test bug, not a page defect.
- Section-only screenshot captures can include displaced sticky headers/skip links. Do not treat capture artifacts as live-page collisions without reproducing them through ordinary navigation.

## Verified progress

Parent independently tested synthetic localhost behavior with all non-GET/HEAD requests blocked:

- Whitespace-only name/address/postcode and malformed phone rejected: four field errors.
- One pending submit plus `requestSubmit()` caused exactly one local adapter call.
- Failure focused `submit-error`, visible and unobscured at y=591.84 to 668.63 at 390x844; name preserved.
- Retry plus another submit event caused one additional adapter call and honest local success. No transmission attempted.
- All five widths passed no-overflow, loaded-image, next-section, modal-submit visibility and focus-containment checks; Escape restored the opener.

Builder Lighthouse 12.8.2: Performance 94, Accessibility 100, Best Practices 100, SEO 100; LCP 3.008s, CLS 0, TBT 30ms. The LCP target was not achieved and is disclosed, not called passed. Its breakdown attributes about 56% to render delay and 4% to image transfer; further compression alone is not a demonstrated solution. This is not the principal rejection reason.

## Source regression evidence

- 67 Python tests pass, including empty/404/403 versus valid licence fixtures.
- Browser fixtures pass at all five viewports for visible/hidden hero continuation, positioned-text collisions and matching/mismatching body fonts.
- Running the amended helper against the unchanged attempt-5 page reports matching heading font and mismatching body font at every size.
- Running amended static validation against that unchanged page rejects the failed licence file.
- No new model review loops, account requirements, API keys or optional infrastructure were added. Source-font comparison runs inside the existing browser pass.

Portable parent evidence: `evidence/website-only-r5/`. The generated page is not repaired. Freeze the revised skill and start attempt 6 with no audit context. External-reference and image-generation cases remain pending.
