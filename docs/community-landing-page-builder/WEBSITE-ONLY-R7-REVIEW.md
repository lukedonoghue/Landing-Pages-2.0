# Website-only attempt 7

Date: 2026-09-19 Kyiv. Verdict: rejected for a confirmed keyboard-accessibility defect. Visual composition, fonts, local conversion behavior and loading performance otherwise improved materially.

## Run identity

Builder `01a0b666-a643-7d83-a28e-af8210f9762e` (Carson), gpt-5.6-sol xhigh, fork_context=false. Started 00:23 and completed 00:47 Kyiv. Same plain Stayclean request, blank project and frozen source 75b2f7e. Snapshot: 172 files; sorted path/hash manifest SHA-256 `8a413a49aa79bd2fddd54e444bccc5cb4a301140c605a15b85df4e786fb7b00c`. No coaching or prior findings supplied.

Fresh reviewer `01a0b67d-7835-7b82-9086-19210d54cdca` (Copernicus), same model/effort, fork_context=false, received only frozen skill and final artifacts, not builder conclusions. Reviewed all five viewports, page sections and intercepted form states. Reported one blocking issue, reproduced by the parent.

## Confirmed defect and cause

The sticky modal action row covers controls reached by ordinary keyboard navigation. At 390x844, the focused email and phone fields sit behind `.form-action`; the privacy link is also obscured. At 1280x600, the focused message textarea lies behind/below the usable modal area. The amended helper reproduced covered controls at every required viewport.

Implementation: `styles.css:976` defines a scrolling field region without compensating scroll padding; `styles.css:1156` overlays a sticky action row inside it. The row grows on mobile. The builder did catch and fix an obscured submission-error message, but that targeted scroll did not protect ordinary field navigation.

Execution trace: `build/qa-browser.mjs` used `.fill()` for fields, checked programmatic focus containment, failure focus and restoration, but contained no Tab traversal. Those operations can scroll fields into view and are not equivalent to normal keyboard progression. The prior bundled helper similarly checked the action and containment, not each Tab stop. The general instruction to check keyboard flow existed, but its concrete test implementation did not cover the failure.

## Source correction

- Prefer a persistent action row outside the scrolling field region. If overlapping sticky actions are used, reserve their actual height in the layout and scroll padding.
- The existing five-viewport helper now traverses the modal with Tab and checks each focused control's center against the topmost rendered element. It records the covered control and overlay. No submissions, new model loop, account or external service are introduced.
- Custom visually hidden checkbox inputs can be evaluated through their visible associated label. The check is bounded to 80 steps and reports incomplete/escaped traversal rather than silently approving it.
- Added covered and clear modal fixtures alongside the existing hero, text-collision and font-parity fixtures. The known broken page remains unchanged and is used as negative evidence.

## Verified progress

- Local Lighthouse 13.5.0 now ran through a run-local installation. Builder: Performance 97, LCP 2483.37ms, CLS 0, TBT 0. Parent repeat: Performance 97, LCP 2482.23ms, CLS 0, TBT 37ms. Both use simulated mobile throttling. Accessibility, best practices and SEO were 100 in the builder report. These scores do not prove manual keyboard accessibility.
- Parent form test: seven empty-field errors; five after correcting service/frequency; four whitespace/junk errors; summary clears as remaining fields are corrected. One pending request, one additional retry, no extra request after refresh. Failure visible and focused, entries preserved; honest local success hides the form; Escape restores focus. All writes intercepted, with no production or CRM claim.
- Roboto headings and Arial body match source samples at all five sizes. The font licence is valid content. Prohibited-surface and static gates pass.
- Photo gallery no longer has empty tracks. Source photos, caption separation, testimonial readability, palette and hierarchy passed the fresh review. The mobile image changes from fleet to a portrait work scene; the independent review did not identify a blocking subject collision.
- The gutter photo is explicitly captioned as gutter-vac equipment on the official source page, including its metadata. The parent's visual uncertainty about the pole alone was not treated as proof that the source attribution was wrong.

Regression evidence: 67 package tests pass; skill metadata validation passes; all six browser fixtures pass their expected results across all five viewports, including rejection of covered modal fields and acceptance of a separate action row. The amended helper rejects the unchanged attempt-7 page at all five sizes with zero unrelated warnings.

The page is not manually repaired. Run a new independent build after the source correction and regression tests. External-reference and image-generation scenarios remain pending. Scope still excludes Cloudflare, CRM and live submissions.
