# Website-only attempt 9

Date: 2026-09-19 Kyiv. Verdict: rejected. The first website-only scenario is not accepted yet.

## Run identity

Builder `01a0b6a2-5eea-7ce3-87ce-c81c39f95136` (Darwin), gpt-5.6-sol xhigh, fork_context=false. Ran 01:28 to approximately 01:49 Kyiv. Same plain Stayclean request, blank project, no earlier findings or parent conversation. Frozen source 1590a9c: 173 files, manifest SHA-256 `32050a01da86a943e8b5dc5e4001903dd52035819d0772c8586f15b336c53f1b`.

Fresh reviewer `01a0b6b5-a6df-71e1-8fe3-d217063c67a4` (Mendel), same model/effort and fork_context=false, received only the frozen skill, final artifacts and local preview. It returned a bounded pass with no findings and independently confirmed form behavior. Parent does not adopt that verdict: the measured service-image ratio conflict and readable desktop crop remain confirmed. The reviewer ruled out a stopped-preview lazy-image false positive and a misleading saved failure capture. It did not finish every post-restart large-viewport recapture, zoom or reduced-motion interaction. Both agents are closed.

## Confirmed failure and cause

The three service photographs retain HTML `width="800" height="600"`. Their desktop CSS at `styles.css:468` sets `width:100%`, `aspect-ratio:4/3` and `object-fit:cover`, but does not release the fixed height. At 1440px viewport width they render at 382x600, not 4:3. At 1024px they render at approximately 307x600. The resulting 52-62% crops cut the commercial worker at the right edge. Mobile CSS supplies `height:auto`, so this defect is breakpoint-specific.

The builder's acceptance report claims corrected ratios and treats crop warnings as hero-only. The old helper used the generic selector `img` for every unnamed image. Its warning de-duplication merged different service-image findings, making the report ambiguous. A declared CSS ratio was never compared with the actual box.

Source correction:
- The existing browser measurement pass compares explicit numeric image ratios with rendered geometry, with 5% rounding tolerance. A mismatch is blocked.
- Crop warnings identify each image's index, asset URL and crop percentage, so unrelated placements cannot collapse into one warning.
- Build guidance explains intrinsic dimensions versus responsive CSS. QA guidance requires placement-specific crop review.
- Two focused fixtures exercise the broken fixed-height case and corrected responsive case across all five sizes.

The amended helper rejects the unchanged page at laptop, short-laptop and desktop sizes. It reports ten distinct crop warnings: the mobile hero plus nine service-image placements. The page itself was not repaired by the orchestrator.

## Verified progress

- Actual rendered source/build font comparisons pass all ten samples: Roboto-Regular headings and Arial body text. This is glyph evidence, not just matching CSS names.
- Actual keyboard traversal passes all five viewports. The form's action row no longer covers focused fields.
- Parent synthetic form review passes: seven empty errors become six after correcting service; summary clears after corrections; validation/failure/success focus is visible after ordinary scrolling settles; values survive failure.
- Two pending submit events cause one adapter invocation. A same-filled-form retry adds exactly one invocation and can resolve successfully through the held local adapter. Escape restores the opener; refresh causes no automatic submission. No live writes were sent.
- Local result clearly states `Preview complete. Nothing was sent.` This is not a production-backend claim.
- Lighthouse 12.8.2: Performance 99, Accessibility/Best Practices/SEO 100, LCP 2034.0021ms, CLS 0, TBT 38ms (displayed as 40ms). No unnecessary repeat of a clear pass.
- Reviewed first-party provenance supports the principal service, founding-year, insured-status, response-time and testimonial claims.

The hero's short-height crop is a composition consideration under existing guidance, not grounds for adding a universal full-body portrait requirement. The clearly unintended service-image sizing conflict is sufficient to reject this attempt.

## Verification and limits

67 package tests and skill metadata validation passed before the checkpoint. All ten browser fixtures pass their expected outcomes across all five viewports, including broken versus responsive image sizing. `git diff --check` passes; Luke's README is unchanged from the baseline. Evidence is in `evidence/website-only-r9/`. No Cloudflare, CRM, private account connection, production delivery or physical-device testing is claimed. External-reference and image-generation cases remain unstarted.
