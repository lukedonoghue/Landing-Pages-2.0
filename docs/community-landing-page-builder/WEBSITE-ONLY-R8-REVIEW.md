# Website-only attempt 8

Date: 2026-09-19 Kyiv. Verdict: rejected. The first website-only case is still not accepted.

## Run identity

Builder `01a0b688-e643-7fb0-ab00-d325cb444ffd` (Aristotle), gpt-5.6-sol xhigh, fork_context=false. Ran 01:00 to approximately 01:17 Kyiv. Same plain Stayclean request and blank project; source d9f46d2, 172 files, manifest SHA-256 `b1eb909e37f228e78fe5d30cac4a39523ce75bd2e7b01c2ac6ba0c34593edcc3`. No parent findings or earlier output supplied. Builder recovered its initial browser-import error without coaching.

Fresh reviewer `01a0b698-ba4e-7cf0-88e0-48ac74a00b0c` (Anscombe), same model/effort, fork_context=false, received skill and final artifacts only. Parent reproduced findings and rejected a timing false positive rather than blindly adopting the review.

## Confirmed failures and source corrections

| Finding | Evidence and actual cause | Source correction |
| --- | --- | --- |
| Declared brand font does not render | Source H1 paints Roboto-Regular from a web font. Local H1 paints `.SF NS`/`.SFNS-Regular`. The CSS stack starts with Roboto but neither HTML nor CSS loads it. Prior helper compared declared family names, so it reported parity without glyph evidence. | Shared read-only `rendered_fonts.mjs` uses Chromium's platform-font evidence for exact text samples. Research and page helpers record actual font families in their existing browser passes. Matching declarations with different rendered families now fail the gate. A missing-font and an actually-loaded-font fixture cover the distinction. |
| Unsupported separate long-form font | `build/site-inspection.json` records an empty prose string from `main p:not([class*=eyebrow])`, then strategy/acceptance calls it proof of Roboto prose. Actual visible source hero and section-lead prose render Arial. | Explicitly reject empty/hidden typography evidence. A distinct body role needs a meaningful visible text sample, not a global or empty element's declaration. |
| Corrected errors remain listed | Empty submit shows seven errors. After selecting service, the inline error disappears but the summary still has seven entries including service. `updateSummary()` only hides the whole summary after every error is cleared. | Make the existing correction test specific: fix one field, assert that only its summary entry disappears, then fix the rest. No new report or model pass added. |
| Validation ends with off-screen keyboard focus | After service/frequency selection and invalid submit, the page focuses the summary, then focuses name with `preventScroll`. After smooth scrolling settles, the summary is visible at y=323..520 but focused name is below the viewport at y=858..908. | Choose one visible focus destination per validation/result state. Check settled geometry with ordinary motion as well as reduced motion. Do not focus the summary then silently redirect focus elsewhere. |
| Technical preview success language | The visible result says `Form behaviour confirmed` and explains future production receipt behavior. This is owner QA language. | Supply a short reusable local-success example: `Preview complete. Nothing was sent.` Technical explanation belongs in the handoff. |

The rendered-font helper resolves the exact recorded text before querying its node, so a broad selector cannot accidentally inspect a different empty paragraph. It handles font-face aliases by comparing actual source and applied families, not by assuming the CSS alias equals the font binary's internal family name. Documented deliberate substitutions still require review; the new failure specifically catches matching declarations that silently render something else.

## Reviewer findings calibrated

- The reviewer initially reported that the success message remained entirely above the viewport. Its test measured immediately after the state changed. Parent normal-motion reproduction showed the message fully visible at y=247..598 after about 400ms and still visible afterwards. This is a capture-timing artifact, not a persistent success-visibility defect.
- The reviewer's claim that both summary and focused field stay hidden also needed correction: the summary becomes visible, but focus finishes below the viewport. The confirmed defect is the split focus/scroll target described above.
- `Start with your postcode` jumps to the full quote form, beginning with service/frequency. It violates the existing exact-label/real-next-step rule. The rule is already explicit; no extra process layer added.
- At 1280x600, the hero cuts the team at upper torsos while the report claims a fully preserved subject. This is a composition/acceptance weakness under an existing explicit rule, not a reason to add a full-body portrait quota. The visible faces are not themselves covered by text.

## Verified progress and limits

- Lighthouse 12.8.2 final JSON: Performance 99, Accessibility 100, LCP 2108.75ms, CLS 0, TBT 15ms (displayed rounded as 20ms). Actual optimization improved the earlier 3.3-second LCP.
- Inline form avoids the previous overlapping modal footer. Parent observed exactly one adapter invocation per pending attempt, one additional retry, preserved fields, visible focused failure, and honest local success on the separate QA-success URL. No writes were transmitted.
- Same-filled-form failure-to-success transition is not testable through the exposed fixed QA mode without a new page load. This is a coverage limit, not proof of a working backend.
- Fresh review found no horizontal overflow, persistent missing images, console errors or section collisions across the five required sizes.
- Parent amended font check rejects the unchanged page at all five sizes: source Roboto versus local system font. Hero prose correctly renders Arial.
- 67 package tests and skill metadata validation pass. Eight browser fixtures pass their expected outcomes across five sizes, including missing versus loaded font, matching versus changed CSS family, covered versus clear keyboard targets, and existing composition checks.

Evidence: `evidence/website-only-r8/`. The page remains unchanged. Freeze the amended skill for another independent build. No Cloudflare, production CRM, private account or live submission is included. The other two scenarios remain pending.
