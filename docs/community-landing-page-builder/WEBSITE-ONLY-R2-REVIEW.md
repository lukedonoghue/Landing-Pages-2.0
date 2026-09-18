# Website-only attempt 2: functional improvement, not accepted

Reviewed 2026-09-18. Fresh builder: 01a0b5b0-3001-7880-ad83-d9dee02c601c (Raman), gpt-5.6-sol xhigh, fork_context=false. It received the same owner request and amended skill, with no earlier page, audit or corrective messages. The source page was not repaired by the parent.

## What worked

- The parent rejected whitespace-only required fields and unusable phone input through the actual modal.
- A mocked destination failed, its message was visible and focused without test-assisted scrolling (mobile bounds 739.6 to 772 within an 844px viewport), and entered values remained.
- Repeated submit events during each pending request produced one intercepted POST per attempt. Retry reached success after a mocked acceptance. No data left the local interception; this is not live backend evidence.
- All five viewport measurements showed no horizontal overflow and loaded Roboto typography. The original hidden failure, blank-name success, duplicate hero preload and nested report-path defects did not recur.
- The builder installed and ran Lighthouse itself. Its final report records Performance 99, Accessibility 100, LCP about 2.3s, TBT 0 and CLS 0. This is local lab evidence, not production performance or complete accessibility certification.
- It independently found and fixed hidden-state CSS, retained modal scroll, and keyboard focus issues during its own review. These were not coached corrections and are valid within a fresh build.

## Remaining findings

1. The final QA summary claims the next proof band appears in the mobile first screen, but it does not. Parent measurements: next section top 851.5px in a 390x844 viewport, and 1086.9px in a 768x1024 viewport. It is visible at the other three widths. This is a modest layout miss, not a broken conversion, but also a concrete false acceptance statement. Root cause: the browser helper had no continuation measurement; a scaled full-page image was treated as enough evidence for a first-screen assertion. Added a small geometric check to the existing helper and a passing/failing local fixture regression across the same five viewports. No additional audit phase was introduced.

2. The split hero composition does not follow the shared frontend requirement for an immersive photo-backed landing-page hero. The skill's design reference left that decision implicit, so the portable instruction set did not reinforce it. Added one concise hero-composition paragraph, including subject protection and responsive continuation. This is instruction compliance, not a claim that every split layout is intrinsically bad design.

3. The hero caption says 'First-party Stayclean work in Bristol'. That is research terminology, not natural visitor-facing context. The image reference now keeps provenance terminology in research notes and asks captions to describe the subject. Necessary generated-image disclosure remains required.

## Evidence and limits

Portable evidence is retained in evidence/website-only-r2/: first-screen captures, the parent form result, and the amended browser-helper result. Full working evidence remains under work/community-acceptance-20260918/audit/website-only-r2 in the orchestration workspace. All POST requests in the parent form test were intercepted and fulfilled locally.

The builder's duplicate-prevention test counted zero outbound POSTs while using a no-network adapter, which alone would not prove deduplication. The parent independently verified actual intercepted request counts and confirmed that the implementation works. Do not label that test proxy as a page defect.

An offscreen skip-link appeared in a tall element screenshot. Direct viewport geometry showed it remained above the visible screen and unfocused; it was a capture artifact, not evidence of a real overlay. A parent footer selector initially selected a testimonial footer; that cropped image was not treated as a site-footer review. These audit limitations are kept distinct from product failures.

Start attempt 3 with another empty project and frozen amended skill. The second attempt is not proof that the full skill already passes unaided.
