# Garden Room attempt 6: parent review and reserve checkpoint

Reviewed 2026-09-20. **Not accepted as a clean first-run pass.** The independent builder completed its local final; parent targeted checks found a narrow-phone violation. Full fresh visual/editorial acceptance remains pending. Do not promote the builder's self-review to independent acceptance.

## Fixes preceded launch

Source `2bf9090` was committed and pushed before dispatch; launch record `53c4b39` is on `community/pro-review-handoff-20260918`, not remote main. Builder Herschel `01a0c061-08ee-70b3-8c38-ca9b13631454`, Sol 5.6 xhigh, `fork_context=false`, launched 2026-09-20 19:52:59 UTC. It received the same plain owner request, business/reference URLs, blank project and frozen skill. No earlier audit, page or parent conversation was supplied and no repair coaching was sent.

All 175 frozen files still match the original manifest after completion: SHA-256 `d395ed5ab8b81211593d847f82b79a8f0c4a875db0a82b013e129efe7ba0d70a`. Included rules cover minimum four different images, no repeated content placements, image relevance, native image output handling, source conversion parity, popup entry, visible close/title after validation, actual brand fonts, complete offer/process copy, early geography, direct FAQ answers and 14px phone text.

Isolation is fresh conversation context and instructed filesystem boundaries on a shared host, not an OS sandbox or new account. No Cloudflare, CRM, private accounts or live leads were authorized.

## Findings

| ID | Evidence | Cause and disposition |
| --- | --- | --- |
| R6-P01 / P2 | `project/styles.css:320` overrides the phone to 13px below 360px. Parent measures 13px at 320px and 14px at the other five widths. | Confirmed violation of an existing clear rule, not a missing instruction. Builder's narrow test checked presence/overflow, not computed text size, and self-approved it. Existing `measure_page.mjs` now measures displayed telephone digits at five standard sizes plus the already-required 320x700 spot capture. Two browser fixtures distinguish narrow-only 13px failure from 14px success. No generated page was repaired. |
| R6-P02 / unresolved test discrepancy | After validation, parent Tab trace reaches `body#top` once after Submit, then returns to Close, at all six sizes. Builder's pristine-modal helper reports containment passing. | Preserve for focused calibration. Native browser-chrome focus can expose body as activeElement; this is not yet proof that an outside page control is reachable. Check document focus and actual outside-control reachability before changing the skill. No speculative focus trap was added. |
| R6-P03 / P3 | Success retains an invitation paragraph and preview notice above another local-receipt explanation. Height is about 542px at 390x844. | Visually redundant but readable; close/result are not clipped. Parent's raw 500px threshold is arbitrary, not an existing skill rule. Do not treat it as a blocking height requirement. Existing compact-result guidance suffices; no new quota added. |
| R6-P04 / evidence wording | Builder acceptance says grouped error-summary links, but only ordinary fields and an optional checkbox exist. | Ordinary links pass. Required radio/checkbox groups remain not exercised. Do not count the wording as grouped-field proof. |

## Verified and limited

Parent `parent-checks.mjs` and JSON retain **73 assertions, eight raw failures**, not 73 passes: one confirmed phone failure, six keyboard-state discrepancies and one unjustified success-height threshold. Tests did not alter the page or frozen skill.

- At 320x568, 390x844, 768x1024, 1024x800, 1280x600 and 1440x900, every visible enquiry CTA opens the same modal without hash/scroll jumps; Escape restores the opener. The extra 320x568 stress size is not a new community full-matrix requirement.
- Title and close remain visible after empty validation at all six sizes. Click-close works. Parent inspected mobile and short-height screenshots. The prior clipped-close regression passes for this form.
- Summary link focuses email. Whitespace name, malformed email and alphabetic phone junk fail validation. Pending/confirmed duplicate dispatch guards, close/reopen snapshot locking, confirmation while closed, deliberate reset, value-preserving failure/retry, real eight-second timeout and actual local-receiver retry pass. Only synthetic details were sent; receiver discards data, so this is not saved-lead proof.
- Seven separately placed content images decode at all six sizes. Source mapping and original contact sheet show genuinely different building/interior compositions, not renamed crops. Responsive variants count once. First-party photo publication rights remain unconfirmed.
- No horizontal overflow measured. Parent inspected narrow/desktop first screens, mobile/short-height validation, success, and source contact sheet. Full fresh lower-section/crop/editorial review is unfinished.
- Final HTML now states the concrete lower-like-for-like price benefit, continues the process through the finished room, includes early North Wales fit, and uses direct FAQ answers. Broad fresh public-source revalidation is pending.
- Saved browser report contains ten actual source/output glyph matches for Reem Kufi/Poppins. Parent read the records, not merely CSS declarations, but did not rerun source extraction.
- Saved raw Lighthouse: performance 97, accessibility/best practices/SEO 100; LCP 2252.432ms, CLS 0.0000935195, TBT 119ms. Parent verified these raw values, not an independent Lighthouse rerun.

Final SHA-256: index.html `5de4c760e19952ec0428a61ca93aca5a54945949944c5f82a9058077d9c47665`; styles.css `fad5a9d6af25f77a451b8d5d659a341559642d60f0bd66784ec79c96a7a91408`; script.js `415269fd23bf955f18dc75a963d87ad7accfb8ec915b7ce6b7a20f14acdc0bd4`.

## Source validation

All 71 package tests pass. All twelve browser fixtures pass, including narrow-only 13px rejection and 14px acceptance, existing hero/copy/font/image-ratio/modal regressions and no-phone cases. Node syntax check passes. This validates the new measurement, not a fresh build using it. The generated artifact and frozen skill remain unchanged.

## Resume order

Usage reached 69% used; user cap is 70%, preserving 30% for later deployment/CRM. No further full build is launched. Save evidence and stop before consuming the reserve.

1. Calibrate R6-P02 and finish a fresh read-only visual/editorial review of the unchanged artifact. Do not call a coached repair an independent run.
2. After renewed budget authorization, freeze the new source including the phone measurement, then rerun the same plain owner prompt with Sol 5.6 xhigh, an empty project and no context fork. Audit before acceptance.
3. Required grouped fields and shared inline/modal variants remain untested because these actual businesses do not require them. Do not add artificial client fields just for test coverage.
4. PDF scope remains unresolved: making brochures optional was our fork's scope decision, not Luke's original requirement. Settle visitor brochure versus page-capture PDF before claiming that requirement passed.
5. Stayclean remains unaccepted. Clarentis R7 retains recorded phone/copy warnings despite later source corrections. No universal perfect-page, clean-machine, production CRM, ad-delivery or Cloudflare acceptance is claimed.

Luke's original README-BOHDAN.md is unchanged against 1693490. Only our community skill and separate audit/evidence folders are modified or pushed.
