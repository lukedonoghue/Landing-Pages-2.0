# Website-only attempt 3: rejected after fresh visual review

Builder: 01a0b5c8-953d-75b2-a549-7792cf0899c5 (Tesla), gpt-5.6-sol xhigh, fork_context=false. Fresh empty project and the same plain owner request. No earlier artifacts or corrective messages were supplied. Build completed on 2026-09-18 at approximately 21:58 Kyiv.

Fresh visual reviewer: 01a0b5e2-120b-7f33-9835-6f02de1dbef1 (Laplace), gpt-5.6-sol xhigh, fork_context=false. It received only the frozen skill and completed artifacts, with no suspected findings or builder QA conclusions. No build was running during this review. It rejected the result independently in about four minutes. Its review used supplied screenshots and source; it could not access the preview. The parent separately accessed the preview for functional tests and collision reproduction.

## Confirmed failures

1. **Text collision at tablet through desktop widths.** Category labels such as '03 / Specialist access' are absolutely positioned beside headings, while fixed left padding reserves only 72 to 88px. The label is wider and paints across the heading. Code: project/styles.css around .service-item and .service-number (original lines 451 onward); markup: project/index.html service items. The builder's report asserted no overlap. A new narrowly scoped browser-helper check measures actual text ranges for independently positioned labels against other prose. It reproduces the collision at 768, 1024, 1280 and 1440 widths. Passing and intentionally colliding fixtures verify the check. Supporting instruction now uses normal flow/grid/flex for variable-length labels rather than guessed gutters.

2. **Mobile hero covers a face.** The group-photo crop preserves only two people on the right; the green WhatsApp CTA covers one face and the other person is clipped at the edge. Both parent and uncoached reviewer identified it. The builder wrote that no face was covered. The existing face-protection rule was explicit: this was noncompliance followed by incorrect self-certification, not a missing ban. The parent's added immersive-hero direction did not prevent the regression. The image decision rule now requires testing the actual mobile copy/CTA footprint before committing the asset, preferring service-in-action imagery with copy space and keeping unsuitable group photos as unobstructed supporting proof.

3. **Secondary action competes with the primary quote action.** The WhatsApp control has the same width, height, weight and saturation as the quote CTA. The strategy calls it secondary, but the styling does not. The source instruction named one primary action without making its visual hierarchy concrete. The design reference now reserves the strongest filled treatment for the primary action and uses quiet alternatives for secondary contact paths.

4. **Technical preview copy leaks into the visitor experience.** Cloudflare and production-endpoint instructions appear inside form help and the success state. Honest preview limits are necessary, but implementation terminology is not. Keep plain 'does not send details' disclosure on the page and technical setup in the owner handoff.

## Acceptance-process correction

Reopening one's own screenshots did not produce independent acceptance. A fresh reviewer, without the builder's pass labels, caught defects that the builder missed. The existing acceptance gate now explicitly checks reviewer availability once and, when available, supplies only final artifacts and skill instructions to an uncoached reviewer. If unavailable, it records self-review honestly and prioritizes raw readable pixels before acceptance prose. No external reviewer service, account or API key is introduced.

The duplicated question list in SKILL.md was replaced with a short pointer to the maintained visual/image gates. This keeps the source of truth in one place rather than adding another checklist. Review findings are outside the skill snapshot.

## What passed

- Following content is now genuinely visible at all five required first-view sizes.
- Parent form testing rejects whitespace and invalid phone input, exposes a naturally visible focused failure, preserves values and reaches an explicitly local success on retry.
- Instrumentation of the reviewed adapter's 220ms timer counted exactly one adapter call for repeated submits during the first attempt and one for retry. No write requests occurred. This is local page behavior, not backend evidence.
- The builder reports three mobile Lighthouse samples at Performance 97, median LCP 2.48s, TBT 20ms and CLS 0; the report remains distinct from visual acceptance.
- Parent read-only browser measurements confirmed the current official hero uses Roboto while body copy uses Arial. This run used the rendered stacks. Earlier runs relied on weaker generic CSS declarations for their body-font claims. The skill now gives computed element styles precedence over global declarations or loaded font files, with explicit disclosure if rendering is unavailable.

## Evidence and boundaries

Portable evidence in evidence/website-only-r3/ includes a readable service-list crop, mobile first screen, parent form measurements and the amended helper report. Full working evidence remains under work/community-acceptance-20260918/audit/website-only-r3. The parent's first form harness targeted the radio beneath a styled label and timed out; clicking the actual label corrected the harness. That timeout is not reported as a page defect.

No generated page was manually repaired by the parent. No Cloudflare, CRM, live form or private account was accessed. Attempt 4 must be another fresh build from the amended skill, not a continuation of this page.
