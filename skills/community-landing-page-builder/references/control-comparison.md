# Blue Mountain Mesh: automatic first-build comparison and improvement

This is a required post-build loop, not another optional scorecard. The first draft is not the final deliverable. Execute after initial implementation, before final owner presentation, in guided and automatic new builds. Reuse existing claim/copy/image/visual gates.

## The control and what transfers

Control: `https://bluemountain1.pagedemo.co/`. The bundled copy library contains its captured text; `control_review.py prepare` exports the exact hash-checked reference into the project. `references/control-layout.json` records the layout of the actual archived screenshot visually reviewed on 22 September 2026, captured on 18 December 2024. Its source is the named Drive screenshot in that map. Retrieve that screenshot, a fresh live capture or an owner-supplied equivalent for direct pixel comparison when available. The offline map is a reviewed fallback, not a fabricated fresh browser visit. Disclose which evidence was used.

Transfer the persuasive discipline: a clear customer outcome, an immediately identifiable service/offer, concrete reasons to choose it, meaningful benefit headlines, mechanisms that explain benefits, proof close to claims, a simple action repeated when useful, understandable steps and objections addressed before the close. Transfer readable hierarchy, restrained design, simple section rhythm and clear visual emphasis. Do not transfer the control's actual wording, customers, review claims, statistics, warranty, badges, logo/colors or photographs into another business. The client's facts, conversion contract and verified brand typography remain authoritative.

Clarity outranks decoration. A generic outcome slogan is not a useful headline. A feature without explaining its customer consequence is not a benefit. A short sentence that omits its subject or meaning is not punchy. Do not fabricate a differentiator when research supports none; ask or use a narrower supported advantage.

## Required sequence

1. **Preserve the first build.** Serve only `public/` locally. Run `node scripts/capture-control.mjs --project . --url http://127.0.0.1:PORT --phase initial` and `python3 scripts/control_review.py prepare . --builder ACTUAL_TASK_OR_SESSION_ID`. This retains the rendered first-draft text, headings, screenshots, source/copy hashes and reference. Do not overwrite it to erase weak output.
2. **Compare before editing.** A separate reviewer, when genuinely available, reads the source/copy/claim ledger and opens the actual mobile/desktop screenshots. Write `build/control-review/comparison.json`. Otherwise do a deliberately separate self-review and label it honestly. Do not emit a pass based on files existing or earlier author booleans.
3. **Make and execute the checklist.** Each improvement needs the actual section/selector, exact weak wording, problem, customer consequence, concrete proposed edit and a testable acceptance condition. Work through it automatically, starting with offer/headline/USP/benefit clarity, then structure and layout. Update the canonical copy and rendered page together, preserving supported qualifications, conversion behavior and image truth. Write `resolutions.json` tied to this checklist.
4. **Recapture and challenge the result.** Run the capture helper with `--phase final`. Inspect the complete actual mobile/desktop output, not only the hero. Write `acceptance.json`, with a fresh nine-criterion review, a headline-only sales argument and a cold-reader explanation of the service, benefit, reason to choose and next step. Every improvement must be fixed in rendered output. Reopen unresolved items; do not wave them through as polish.
5. **Revalidate and deliver the improved page.** Refresh copy acceptance, any materially stale owner approval and all affected technical gates. Run `python3 scripts/control_review.py check .`. After the final source change, create the existing current handoff snapshot and run `python3 scripts/control_review.py record .`. Existing gate validation rechecks this evidence; it cannot be bypassed by a standalone “pass”. Only then present the improved page and concise before/after changes.

The controller dispatches `control_comparison`, `control_repair` and `control_retest` automatically. A no-change result is allowed only with concrete evidence for every criterion, an explicit empty checklist and a fresh final capture; do not manufacture cosmetic edits to satisfy an arbitrary quota. Stop repeated identical repairs at the runner budget and expose the exact unresolved problem, never an imaginary final.

## Nine mandatory comparisons

| Criterion | Reviewer must establish |
|---|---|
| `first_screen_offer` | A stranger immediately knows the actual service, audience, useful result and next action. |
| `headline_story` | Reading only the real headlines conveys the selling argument; key ideas are not buried in paragraphs or generic labels. |
| `customer_benefits` | Important capabilities are translated into specific, plausible customer outcomes in plain language. |
| `reason_to_choose` | The strongest supported difference is prominent and understandable, not an interchangeable adjective. |
| `mechanism_and_proof` | The page explains why the benefit is credible, with actual evidence and intact qualifications. |
| `plain_direct_copy` | Sentences are clear, direct, complete and economical; no vague hype, researcher narration or operator instructions. |
| `objections_and_process` | The buyer's material doubts, fit questions and next-step process are answered concretely. |
| `cta_and_conversion` | The repeated action has a consistent useful label, correct promise and functioning selected journey. |
| `layout_and_mobile` | The section rhythm, emphasis, media and mobile hierarchy make the argument easier to scan; no hidden media, collisions or needless decoration. |

## Artifact contracts

`comparison.json` contains `baseline_sha256` (the entire baseline file), `layout_reference_sha256` (from the exported reference's layout map), a concrete `layout_observation`, `reviewer: {mode: independent|self_review, task_id: ...}`, `checks` and `issues`.

Each of the nine `checks` contains `criterion`, `verdict: pass|improve`, `draft_excerpt` exactly present in the initial capture, `control_excerpt` exactly present in the reference, and a substantive `observation`. The reviewer must actually inspect the images for layout; text excerpts alone do not establish visual quality. The layout observation compares the recorded layout reference, not an invented contemporary screenshot.

Each issue contains `id`, `priority: P1|P2|P3`, `criterion`, `selector`, `before` (exact initial text), `problem`, `why_it_matters`, `proposed_change`, and `acceptance_test`. Every improve verdict must have at least one issue. Keep IDs stable across repairs.

`resolutions.json` contains `comparison_sha256`, actual repairer `builder_task_id`, and `items`. Every issue appears exactly once with `id`, `status: fixed`, exact final rendered `after`, and `verification` describing the check actually performed. Copy changes must change the wording. A layout repair may retain wording but must explain pixel-based verification. Do not discard a valid item or change its initial evidence to pretend it was fixed.

`acceptance.json` contains `capture_sha256` (the entire final-capture file), `resolutions_sha256`, truthful `reviewer`, fresh nine `checks` with all verdicts pass, `headline_only_story`, `cold_reader_summary`, and `unresolved_findings: []`. Do not call the builder/repairer an independent final reviewer. A missing artifact, stale source, unchanged weak copy, incomplete issue list, runtime error or overflow blocks readiness.

The controlled browser helper records actual 390- and 1440-pixel viewports, rendered copy/headings, page errors, screenshot hashes and source identity. It blocks non-read-only requests and only opens loopback URLs. It does not test a live lead, external booking or purchase. Existing functional tests still cover those flows to their actual authorized scope.

## Revisions and scope

Preserve the immutable initial baseline and comparison within a build. Later source changes invalidate final capture/acceptance and the normal gates. Repair against that preserved checklist and rerun the final review; a wholly new design/business build should use a new project/round rather than silently replacing the original evidence. The helper validates integrity and workflow completeness; semantic copy/pixel judgments remain the responsibility of the actual reviewer. No automatic conversion-uplift percentage is inferred.
