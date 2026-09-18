# Byrider Independent Run Visual Audit

## Verdict

The run is not acceptable as a final one-prompt result. It is technically complete, but the visual and editorial acceptance gates produced false passes. The main page is coherent enough to review, yet the brochure has obvious collisions and clipping, the short-height modal hides its primary action, prohibited Unicode dash characters remain throughout the page, and several checks validate file presence instead of design quality.

No client page files were changed during this audit.

## P0 Failures

### 1. The brochure failed basic composition checks

- Page 3 places the title and subtitle over an infographic that already contains labels. The title covers `REVIEW VALIDATION` and competes with `FRANCHISE DISCLOSURE DOCUMENT`.
- Page 4 places the headline directly across the people in the official group photograph. This weakens the proof asset and creates a text-on-subject collision.
- Page 5 enlarges and crops the portrait so aggressively that the top of the subject's head is cut off. The headline and subtitle also sit across the face and torso.
- Page 6 overlays heading and body copy on monitors and wall graphics that already contain text. The image is information-bearing, not a neutral background.
- Page 7 clips the left column at the page edge. The first bullet begins mid-word, proving the `no_clipping` acceptance result is wrong.
- Page 8 again overlays a title on the labeled roadmap, covering existing labels.
- Page 9 truncates the introductory sentence after `candid`, leaving the sentence visibly unfinished.

Required fix: classify every image as decorative or information-bearing before layout. Information-bearing images must receive a protected text-free area or be placed as a separate figure. Every PDF page must be rendered and inspected at readable size, with a clipping and collision checklist that records page-specific evidence.

### 2. The modal action is not visible at 1280 x 600

The first-step modal is taller than the short desktop viewport. The `Continue` action falls below the visible area. The panel technically has internal scrolling, but the screenshot provides no visible cue that scrolling is required. A novice user can reasonably conclude that the form has no action.

Required fix: add short-height breakpoints, reduce modal padding and vertical spacing, keep the action row visible, and test action visibility rather than only modal focus containment.

### 3. A strict prohibited-copy rule was ignored

The generated landing page contains U+2014 and U+2013 characters in the hero, operating thesis, body copy, attribution, disclosure copy, and timeline text. The current copy and visual gates do not scan rendered output for forbidden characters.

Required fix: add a hard preflight and post-render scan across HTML, CSS generated content, JSON copy, PDF source, PDF extracted text, and final rendered copy. Any prohibited character must fail the run.

## P1 Failures

### 4. Consent UI obscures conversion content

At 1280 x 600 the consent panel covers a large part of the hero headline and supporting copy. At 1024 x 800 it overlaps the hero-to-signal-bar boundary. On mobile it occupies a large part of the first viewport and pushes attention away from the primary action.

Required fix: use a compact, bottom-width consent treatment that does not cover the headline or CTA. Test overlap against the hero headline, primary CTA, form actions, and signal bar at every short-height viewport.

### 5. The roadmap image is cropped even though its labels are the content

The landing page uses `object-fit: cover` on the roadmap. The automated audit recorded crop fractions from 36 percent to 46 percent and only issued warnings. On mobile, the right-side `STORE OPENING` label is cut. On tablet, the top `QUALIFICATION CALL` label is cut.

Required fix: render the complete infographic with `contain`, use a responsive figure, or rebuild the information as native HTML. A labeled diagram cannot pass when any label is cropped.

### 6. Footer utility links visually collapse

`Privacy`, `800-947-4532`, and `Team login` appear as one underlined string because the separators have no spacing. This happens across mobile, tablet, and desktop.

Required fix: use a real flex list with explicit gaps and separators that do not depend on whitespace in minified HTML.

### 7. The generated technology image does not function as trustworthy proof

The image is disclosed as illustrative, which is correct, but its invented dashboards and showroom environment look like a generic concept render. It does not verify the Discover platform or show an authentic Byrider workflow. It should not carry the same evidentiary weight as official photography.

Required fix: prefer verified official product or operations imagery. If none exists, use generated imagery only as atmosphere and keep concrete product claims in sourced text, diagrams, or official screenshots.

### 8. The page is long because several sections repeat the same visual grammar

The page repeatedly uses large headline, short paragraph, grid of cards, then another full-width color band. On mobile this produces about 13,500 pixels of scrolling with limited visual or interaction change. The support cards and investment cards become especially repetitive.

Required fix: preserve the necessary decision journey while varying composition by content purpose. Use proof-led media, process visualization, comparison structure, and tighter objection handling instead of adding more card grids.

## P2 Quality Problems

### 9. The hero is oversized at intermediate widths

At 1024 and 1180 pixels the headline dominates most of the visible hero while the consent panel overlaps nearby content. The hierarchy is clear, but the balance is not controlled for laptop widths.

### 10. Mobile proof imagery is visually oversized

The operator group and portrait each consume a large vertical area. The portrait becomes larger than the testimonial content it supports, producing a weak evidence-to-space ratio.

### 11. The same investment information is presented twice

The three investment cards repeat facts that immediately appear again in the official investment graphic. This adds length without adding a new decision layer.

### 12. The guide preview is not a real preview

The final brochure mockup is a styled text panel rather than a view of the actual guide. It does not show the user what they will receive and misses the stronger proof available in the real PDF cover or page spread.

### 13. The visual system is too narrow

Most of the page alternates navy, bright blue, white, and pale blue with limited secondary hierarchy. The result is brand-consistent but template-like, especially compared with the richer media and offer framing of the Clean Slate reference.

### 14. The thank-you page is serviceable but incomplete as a conversion state

The download is clear, but there is no confirmation of the submitted contact details, no expectation-setting beyond a generic follow-up line, and no visually distinct fallback when the download is blocked.

## Viewport Results

| Viewport | Landing | Modal | Thank-you | Result |
| --- | --- | --- | --- | --- |
| 360 x 844 | Fits, but very long and consent-heavy | Fits tightly | Fits | Conditional fail |
| 390 x 844 | Fits, same density issues | Fits tightly | Fits | Conditional fail |
| 768 x 800 | Large vertical spacing, cropped roadmap labels | Fits | Fits | Fail |
| 1024 x 800 | Hero balance and consent overlap issues | Fits | Fits | Fail |
| 1180 x 800 | Oversized hero and cropped roadmap | Fits | Fits | Fail |
| 1280 x 600 | Consent obscures hero content | Primary action below view | Fits | Critical fail |
| 1280 x 900 | Main layout fits, repetitive composition | Fits | Fits | Conditional fail |
| 1440 x 720 | Main layout fits, crop warnings remain | Fits | Fits | Conditional fail |
| 1440 x 900 | Main layout fits, quality issues remain | Fits | Fits | Conditional fail |

## Why The Run Passed Anyway

1. `build/visual-review.json` reviewed only four screenshots: 1440 x 900 landing, 390 x 844 landing, 390 x 844 modal, and 390 x 844 thank-you. It did not inspect every prescribed state and viewport.
2. The visual review used broad booleans such as `hierarchy: true` and `image_context: true` without issue-level evidence or annotated screenshots.
3. `build/catalogue-review.json` set `no_clipping: true` with no page-specific measurements. Page 7 and page 9 disprove that result.
4. The browser gate explicitly states that its measurements are not visual or aesthetic approval, but the final process treated that gate as supporting final approval.
5. The browser gate allows `pass_with_warnings`, including 36 percent to 46 percent image crops, without requiring a human correction decision.
6. The image workflow validates asset count and review-file presence. Each asset review points to the same generic desktop and mobile screenshots, so the evidence is not asset-specific.
7. No gate checks forbidden punctuation in source copy, rendered HTML, CSS generated content, or PDF text.
8. No gate checks whether text overlays information-bearing image regions.
9. No gate checks whether the modal primary action is visible without scrolling at every tested viewport height.
10. The visual and catalogue reviews were self-reported by the same run that created the artifacts. There was no independent acceptance pass.

## Required Process Fixes

### P0

- Add an immutable prohibited-pattern scan. U+2014 must be a hard failure everywhere.
- Add page-specific PDF clipping and text-on-image collision checks.
- Add visible-primary-action checks for every form step and viewport.
- Require an independent visual acceptance pass after build completion.
- Make any P0 finding block final delivery even when technical tests pass.

### P1

- Classify images as decorative, proof, diagram, screenshot, portrait, or generated concept before placement.
- For diagrams and screenshots, block `cover` crops and text overlays.
- Require unique evidence screenshots for every reviewed image.
- Test consent UI overlap with conversion-critical elements.
- Require footer link spacing and touch-target checks.
- Require full viewport coverage for landing, modal steps, validation errors, thank-you, and PDF pages.

### P2

- Add a repetition audit for consecutive card grids and color bands.
- Add a mobile scroll-density review that can recommend tighter composition without arbitrary section or image quotas.
- Require the downloadable guide preview to use the actual guide cover or a verified page spread.
- Separate official proof from illustrative imagery in both labels and visual hierarchy.

## Correction Order For A Future Byrider Rebuild

1. Repair the acceptance gates before rebuilding.
2. Replace prohibited punctuation and add automated blocking.
3. Redesign brochure pages 3 through 9 around protected image regions.
4. Repair the short-height modal and consent overlay behavior.
5. Preserve full labeled diagrams without cover cropping.
6. Fix footer utility layout.
7. Rework page pacing, reduce repeated card patterns, and use authentic proof more effectively.
8. Re-run every viewport and every PDF page through an independent reviewer.
9. Compare the completed run against this report before final approval.

## Plan Reconciliation

- [x] Inventoried all nine tested landing, modal, and thank-you viewport sets.
- [x] Inspected the landing page across mobile, tablet, laptop, and desktop widths.
- [x] Inspected representative modal and thank-you states, including the 1280 x 600 failure.
- [x] Inspected all nine brochure pages.
- [x] Compared the output with the Clean Slate reference and Byrider source capture.
- [x] Recorded page defects separately from acceptance-gate defects.
- [x] Produced a prioritized correction plan without changing the client page.
- [x] Reconcile the separate Claude-to-Landing-Pages-2.0 skill comparison after independent completion.
