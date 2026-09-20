# Stayclean attempt 10: final parent review

Reviewed 2026-09-20, approximately 14:00 Kyiv. Scope: saved website-only build, before CRM/Cloudflare. The page and skill were not modified. No new build or live submission was started. All submitted values were synthetic and all test quote requests were intercepted locally.

## Decision

Do not mark case 1 accepted yet. Three concrete problems remain in the page-side experience: stale asynchronous submission state, tablet proof-image overlap, and a keyboard error-link defect. These warrant small source-skill corrections, not another wholesale design rewrite or backend project. Under the agreed sequential plan, case 2 follows acceptance of case 1. It has not started.

Case 2 remains The Garden Room Co. (`https://gardenroomco.com/`) with Green Retreats (`https://www.greenretreats.co.uk/`) as an external presentation reference, not a source of claims or copied media. Selecting those examples does not authorize publishing or contacting either business.

## Fix before acceptance

### 1. A previous request can show success over a newly edited form

Reproduction: fill and submit; keep the response pending; close the dialog; reopen it and change the name; resolve the old request. The current form disappears and a success message appears, although the changed details were never submitted. This was reproduced with isolated synthetic responses, not a live lead.

Cause: `script.js:101` resets visible panels on every open without giving each form session/request an identity. The callback at `script.js:249` updates whichever dialog state exists when the response arrives. Fields remain editable during pending submission and closing the dialog does not isolate the pending result.

Required outcome: a response must remain associated with the submitted details. Either preserve an explicit pending state across close/reopen, or separate new edits from the pending request and ignore obsolete UI updates. Do not claim that aborting a browser request necessarily cancels a server-side submission.

Related weaknesses, not separate major blockers:
- After success, reopening hides confirmation but keeps all old fields and immediately re-enables submission. I reproduced a third request for unchanged data. The in-flight guard works, but the completed-state behavior invites accidental duplicate enquiries. Preserve confirmation or provide an explicit new-enquiry/reset action.
- There is no application-level timeout or recovery mechanism for a request that stays pending (`script.js:244`). A held request remained disabled at ten seconds; code inspection confirms no bounded application timeout. Browser/network eventual failure is not a deliberate recovery policy. Add a bounded recoverable state without falsely declaring that the server did not receive the enquiry.

Evidence: [interaction review](interaction-review.json), especially `old request completes in edited reopened form` and request counts; [follow-up](followup-review.json).

### 2. Tablet hero text overlaps people in the proof photograph

At 768x1024, the secondary phone CTA crosses team members in the hero photograph. Mobile uses a different image and the larger desktop composition avoids this collision, so inspecting only those endpoints misses it. The photograph is classified as proof, not decoration.

Cause: shared hero image positioning and copy/action layout (`styles.css:296`, `styles.css:312`, `styles.css:349`) are not adjusted to preserve a clear subject area at the tablet breakpoint. The automated overlap helper cannot recognize people inside a bitmap; it correctly discloses that limitation. The existing skill already prohibits text over a focal subject. This is a visual acceptance miss, not an absent brand rule.

Required outcome: inspect the actual medium-width proof composition, including secondary actions, and reposition the copy/image or choose a suitable source crop. Do not solve it by removing honest proof or covering the image with a heavier tint.

Evidence: [tablet viewport](768-first.png), [readable overlap detail](tablet-photo-collision.png).

### 3. The cleaning-frequency error link skips the control

Submit the empty form, keyboard-activate the Cleaning frequency error link, then press Tab. Focus becomes `BODY`; the next Tab goes to name, skipping the frequency choices that need correction. The dialog remains open. The same result occurred with mouse activation.

Cause: `script.js:192` points the summary link to `#frequency-error`, a non-focusable error span placed after the radio group, instead of a focusable group/control. The general modal Tab test passes because it never activates validation-summary links.

Required outcome: each error-summary link should reveal and focus the corresponding usable input. For a radio group, focus the selected or first radio as appropriate. Extend the existing correction test to activate a group error link; no new full review stage is needed.

Evidence: [interaction review](interaction-review.json), [keyboard confirmation](followup-review.json).

## Smaller corrections and polish

4. **Phone validation accepts obvious mixed garbage.** `garbage1234567` reached the intercepted receiver with no phone error. `script.js:56` counts digits after removing all other characters, but sends the untouched original value. Accept international formatting and legitimate extensions without allowing arbitrary alphabetic junk. This is a local input-quality issue, not a request for paid phone verification or a strict UK-only format.

5. **The success state still looks like a testing interface.** Its body says `The form journey is working locally`, although the skill asks for plain visitor language. It also retains the form's fixed tall shell (`styles.css:897`), leaving roughly the lower half empty at 390x844. Keep the honest preview disclaimer, remove process jargon, and let the success panel fit its content. This is polish, not false delivery or a broken success flow. [Screenshot](success.png).

6. **One below-fold photo bypasses responsive optimization.** The story image at `index.html:185` sends the original 1700x1039 JPEG (234,026 bytes) to mobile, where it renders about 358px wide at DPR 1. Smaller WebP variants already exist. The hero/service assets were optimized, but this placement was missed. It does not invalidate the passing LCP result; it is avoidable transfer cost and an existing build-contract miss.

7. **Mobile hero imagery is weak, though not broken.** The heavily tinted building/van crop excludes the operator, so the first screen shows little readable cleaning action. At 1280x600 the team is cropped to upper bodies. These are composition limitations, not invented evidence, missing photos or a reason to demand full-body portraits everywhere. I would improve the tablet composition and reconsider the mobile treatment together, but would not order a redesign merely because the palette is teal/yellow. [Mobile](390-first.png), [short laptop](1280-first.png).

## QA/process defects

8. **A missing-image check produced a false alarm.** The fresh browser helper reported the below-fold team JPEG as not loaded at mobile size. There was no corresponding broken URL; scrolling that image into view and awaiting decoding rendered it correctly at every required size. The mobile full-page screenshot from that pass had a blank image area, so the diagnostic affected both measurements and evidence. Treat this as a settling/loading-timing failure in the QA process, not a missing production asset. `measure_page.mjs:97` uses a scrolling sweep and a bounded decode wait; the exact browser scheduling cause was not isolated. Retry/verify the named asset before declaring it broken. [Initial report](browser-review.json), [successful per-section checks](visual-state.json), [loaded mobile image](390-why-stayclean.png).

9. **The original acceptance report was broader than its evidence.** The form script did not cover the reopened/pending request case or activate grouped error links. The visual pass missed the tablet overlap. Some derivative section captures were stale when the budget stopped. This parent review adds current screenshots and behavior evidence; it does not retroactively make the original pass complete. Prefer a few targeted state assertions within the existing checks rather than adding more agents, reports or blanket review rounds.

## What is now correct

- Source quote-form intent and required fields are preserved. Phone, email and WhatsApp are secondary, not replacements. The official homepage corroborates the form, principal business claims and quoted customer feedback: https://www.stayclean.co.uk/ . History is also supported by https://www.stayclean.co.uk/about-stayclean/ . No production form was submitted.
- All ten fresh typography comparisons match actual rendered source fonts: Roboto headings and Arial body text. This is not merely a CSS-family declaration check.
- All five fresh image-ratio checks pass. The previous 600px-tall service-photo defect is absent; desktop service subjects are readable. [Service section](1440-window-cleaning.png).
- The ordinary local form path passes: seven empty errors, one corrected field removes its error/summary entry, malformed email/blank name/non-numeric phone rejected, failure visible and focused, values preserved, same-filled-form retry succeeds, success visible and focused.
- Two pending submit events cause one request. Refresh causes no submission. This does not prove completed-state duplicate prevention or real backend idempotency.
- The default modal traversal and focused-action checks pass at all five required sizes. No horizontal overflow was found; an extra 320px check also passed. A 640x450 layout check passed, but is not a substitute for a real browser-zoom or physical-device test.
- Saved final Lighthouse 13.5.0: Performance 98, Accessibility/Best Practices/SEO 100, LCP 2403.5605ms, CLS 0, TBT 13ms. I inspected the saved result rather than spending another run on a clear pass. An accessibility score of 100 did not catch the grouped-error interaction.
- Main section copy, reviews, service images, gutter image, footer and success state were inspected in readable fresh captures. There is substantial content and real first-party imagery; the earlier short/imageless output failure is not present.

## Deliberately not counted as defects

Cloudflare authorization/deployment, CRM/database, real lead delivery, GTM imports, ad-platform enhanced conversions, campaign attribution, live-domain checks and production consent configuration are deferred or unselected in this page-only test. Generated images are not mandatory in the website-only scenario because adequate first-party assets exist. A brochure was not requested. Do not add those modules merely to pass this review.

## Coverage and limits

Reviewed the unchanged project at `/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260918/runs/website-only-r10/project`, served at `http://127.0.0.1:4187/`. Used a separate Chromium session because in-app browser startup failed with a native-module compatibility error. The apparent connection failure from the restricted shell was not proof that the existing preview server was down; it was reachable in the authorized browser session. No page repair or browser-account access was performed.

Fresh sizes: 390x844, 768x1024, 1024x800, 1280x600 and 1440x900. Automated helper: 101/102 checks passed; the sole image-load failure was separately disproved as a persistent page defect. Readable desktop/mobile section captures supplement full-page images; all five first screens were visually inspected. Interaction tests used normal motion; the helper used reduced motion. Native mobile keyboards, real assistive technology, physical devices and every external destination were not exhaustively tested.

This is the list of confirmed remaining defects, observed polish issues and identified test gaps from this review, not a claim that every possible browser or business edge case has been exhausted.
