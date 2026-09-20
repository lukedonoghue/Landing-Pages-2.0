# External-reference attempt 1: parent audit

Business: The Garden Room Co., https://gardenroomco.com/ . Supplied presentation reference: https://www.greenretreats.co.uk/ . Reviewed 2026-09-20. Status: **not accepted for this skill test; source corrections followed by a fresh attempt**. The page itself is preserved without parent repairs.

## Independence and scope

- Builder Plato, `01a0be81-a80c-7420-935a-05832a41470b`, gpt-5.6-sol xhigh, fork_context=false. Source 9182397; frozen 174-file manifest SHA-256 `7165587aee0cf4b84f932f97a7a3378f04be43b7eed838b0f52a5a8d13fb91fa`.
- Fresh reviewer Ohm, `01a0be96-10fe-7b12-a840-58158cfb8732`, same model/effort and no inherited context. Received skill, page, business/reference URLs, not builder verdicts or parent findings.
- These are fresh contexts and instructed directory boundaries on a shared machine, not separate OS/account sandboxes.
- Local page only. All parent form requests intercepted with synthetic responses. Builder additionally tested a loopback receiver. Neither proves production storage or delivery. No CRM, cloud authorization or deployment selected.

## Confirmed findings and source causes

### R1-01: protected hero detail still obscured

At 1024x800, copy crosses much of the room's glazed front; at 1280x600 it crosses the right glazing. The room is recognizable, but this proof-bearing feature is harder to inspect. Fresh reviewer identified it, and parent inspected both viewport captures. Source: generated `styles.css` hero-copy width/position, gradients, and short-height rules; screenshots `reviewer/1024x800-first.png` and `reviewer/1280x600-first.png`.

The previous instruction already prohibited obscuring proof. The builder nevertheless wrote that the building was visible to the left, treating whole-object recognition as sufficient clearance. This is a failed interpretation/self-review, not a missing image-generation tool. Source clarification now asks the existing image-plan note to name the protected feature and copy-safe area, and explicitly checks all intermediate widths against that feature. No additional review round or image quota added.

### R1-02: mobile trust proof uses fine-print sizing

At 390px, three columns use 10px support text. It fits but is unnecessarily hard to scan. Fresh reviewer and parent agree. Source: generated mobile `.trust-inner span` rule; `reviewer/390x844-first.png`.

Existing general readability language did not prevent shrinking evidence to preserve the desktop row. Design guidance now favors normal readable UI sizing, concise wording or reflow instead. This is not a ban on all compact legal text or three-column layouts.

### R1-03: automated source typography evidence was incomplete

`extract_brand` captured before animated H1 visibility, and only sampled paragraphs in the first viewport. The source's meaningful prose is below the fold. The builder manually recovered font identity, but its saved source report caused ten availability warnings. The builder's explanation that animation accounts for all warnings was incomplete: body sampling needed scrolling too.

The helper now waits a bounded time for the heading and seeks only missing typography samples, saving actual rendered-font evidence and a viewport screenshot for below-fold samples. Original first-viewport surface measurements stay separate. `measure_page` consumes these explicit samples with backward-compatible fallback. Corrected extraction on the real source confirms Reem Kufi heading glyphs and Poppins body glyphs at 390px and 1440px. The new page renders the same fonts. This is a QA-helper reliability fix, not a brand mismatch in this build.

## Separate carryover result

Authoritative matrix remains `CASE2-CARRYOVER-AUDIT.md`; this result does not retroactively accept Stayclean.

- C01: inline equivalent passes. One request, disabled edits, pending state retained when navigating away/back; late response after abort does not confirm. No modal exists, so exact modal reopen variant remains unproven.
- C02: confirmed state retained after returning via CTA; only deliberate New enquiry resets. No accidental repeat request.
- C03: 8-second deadline produces recoverable uncertainty; values retained; no auto retry; same-filled deliberate retry works.
- C04: no secondary-action/team collision in this case, but related hero proof occlusion persists at laptop widths (R1-01).
- C05: actual error-summary link reaches phone input. Required grouped field absent: group-specific case N/A, not passed.
- C06: `garbage1234567` rejected without a request; international number plus extension accepted and submitted in validated representation.
- C07: plain preview confirmation and compact result panel pass.
- C08: responsive WebP sources used in all proof placements, including below-fold materials. Mobile loads the 640 variants instead of full source JPEGs. No prior oversized-original repeat found.
- C09: mobile roof/cladding remain recognizable; no darkened team photo. Full proof-feature clearance remains open because of R1-01.
- C10: all image placements decode at five widths; delayed/broken helper fixtures previously passed. No actual lazy-image failure here.
- C11: parent tested raw output independently; rejected the builder's broad no-collision claim. Captures match the unchanged page. Source-typography report reliability corrected by R1-03.

Parent behavioral reproduction: 13 assertions, all pass. See `parent/carryover.json` and its runnable script. Exact modal/group cases are explicitly not covered by this inline form.

## What passed and accepted limits

- Client identity, verified original project photography and enquiry offer retained. No Green Retreats price, range, celebrity endorsement or image imported as client fact.
- Actual heading/body fonts match source, independently confirmed with corrected source extraction and Chromium glyph evidence.
- Five viewport page and section captures; readable form validation/failure/success; no confirmed overflow or missing media.
- Builder: 20 synthetic form checks. Parent: 13 focused carryover assertions. Simulations are not live conversion verification.
- Builder mobile Lighthouse 12.8.2: Performance 97, Accessibility 100, Best Practices 100, SEO 100; LCP 2.6s, CLS 0, TBT 60ms. Repeated 2.6s is a disclosed marginal miss of the 2.5s aim, not the reason for rejection. Retain useful proof rather than chase 0.1s alone.
- At short laptop height the viewport ends partway through the following band. That is normal scrolling and a valid hint of continuation, not page clipping; no new rule added.
- Publication rights, real endpoint, privacy-policy update for live destination, CRM and deployment remain external limits, not failed page-only requirements.

## Next attempt

Correct only community skill source. Preserve this page and audit as evidence. Start a fresh gpt-5.6-sol xhigh agent with the same plain owner prompt and new empty directory. Give it no audit, previous design, parent conversation, reviewer conclusions or suggested layout. Keep the carryover and case-2-specific findings separate in the next audit. Stop by 50% total usage.
