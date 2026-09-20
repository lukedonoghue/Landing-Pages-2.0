# External-reference attempt 2: parent audit

Business: The Garden Room Co. Presentation reference: Green Retreats. Reviewed 2026-09-20. **Blocked by one reproduced desktop validation-framing issue.** Preview: http://127.0.0.1:4199/ . No parent edits to the generated page.

## Independent execution

Builder Jason, `01a0be9f-f959-7ff0-88f4-83c1a2807c9f`, gpt-5.6-sol xhigh, fork_context=false. Started 14:42 Kyiv; completed about 15:02. Frozen source `9e6dbbd`, 175 files, sorted path/hash manifest SHA-256 `7117ccaf16d8ea62864f0339cfa30e3392ea2ef4e0f477a85bd7c59793f141d9`. The after-build manifest is identical. Same owner request, new empty output, no previous page or audit supplied.

Parent inspected the available execution record: 128 command entries, no prior-run/audit/history paths found. The only app tool calls were attempted browser initialization and opening the new preview. Installed runtimes and tool documentation were available. This is fresh context plus instructed filesystem boundaries on a shared machine, not an isolated OS or a new ChatGPT account.

Fresh visual reviewer Helmholtz, `01a0beb3-bb60-7630-9454-c2c1656df379`, same model/effort with fork_context=false. Received skill, final raw page, business/reference URLs, no earlier verdicts or audit. Parent later supplied only a working installed-browser execution path after capture transport failures, not design or acceptance guidance.

## Attempt-1 fixes checked independently

| Finding | Result in this fresh build |
| --- | --- |
| R1-01 hero copy crossing glazed proof | Corrected. Laptop/short-height copy sits left of glazing; mobile/tablet put the room above most copy. Fresh pixels show the opening and interior. |
| R1-02 10px mobile trust text | Corrected. Supporting proof is 13px on mobile and reflows to two columns plus a full-width item. |
| R1-03 missing source font evidence | Corrected by bundled helpers without parent intervention. All ten heading/body comparisons have matching declared and painted fonts; zero availability warnings. |

### R2-01: desktop validation loses field context

The fresh reviewer identified a settled 1440x900 empty-submission state where the Name input starts at the viewport edge and its label and error summary are above it. Parent reproduced: input top 0.19px, label top -28.91px, summary top -172.28px. Starting through the hero CTA instead gives correct framing, so this is scroll-position dependent, not a universal desktop failure. See `parent/validation.json`, `parent/validation-direct.png` and `reviewer/review.md`.

Cause: the generated handler calls only `errors[0].input.focus()`. Browser focus scrolling ensures the input itself is visible, not the label or outer focus outline. Existing instructions and the builder's tests emphasized the focused element and mobile state. The literal element-visibility test missed its context. The source now clarifies label/outline/error visibility and adds one desktop invalid-submit assertion to the existing conversion test, not another review round. Preserve this page and start another fresh attempt after this narrow instruction change.

## Separate Stayclean carryover

| ID | Result and exact limit |
| --- | --- |
| C01 | Pass for inline equivalent: one held request, fields disabled, navigation away/back preserves pending values; late aborted response cannot confirm. Exact modal reopen remains untested. |
| C02 | Pass: returning by CTA retains confirmation; deliberate New enquiry resets. |
| C03 | Pass: actual 8-second deadline, retained values, uncertainty, no automatic retry, deliberate same-filled retry. |
| C04 | Pass for current hero at all five required widths. No secondary action covers proof. Original team-photo variant absent. |
| C05 | Pass for real error link to phone; required radio/group absent, so group-specific case remains N/A. |
| C06 | Pass: mixed letter/digit junk rejected without a request; international number plus extension accepted and submitted unchanged apart from trimming. |
| C07 | Pass: plain preview wording, compact confirmation, no tall empty form shell. |
| C08 | Pass for scope: mobile hero uses 31KB responsive WebP. Gallery uses already-resized 768px source derivatives, about 81-119KB, not untouched full-resolution originals. All placements inspected. Further compression is possible, not a blocker. |
| C09 | Pass for current proof: mobile and laptop retain the essential room/glazing. No forced full-body quota or photographic redesign added. |
| C10 | Pass: all placements load/decode at five widths. Actual helper delayed/broken fixtures remain separately tested. |
| C11 | Still open for attempt 2 acceptance: fresh review found R2-01 after broad self-acceptance. Parent reproduced it and narrowed the source correction. Stayclean itself is still not accepted. |

Parent `carryover.json`: 13 passing assertions with intercepted synthetic requests only. This does not establish real storage, delivery, server-side deduplication or live analytics.

## Remaining observations, not hidden failures

- The wide project gallery has discretionary whitespace under the lead image. All three projects remain visible; no broken grid track hides content. A tighter arrangement is possible, but banning asymmetric galleries would overfit the skill.
- The 1280x600 view naturally ends partway through the next evidence band. This is a scrolling-page boundary, not content clipping by its container.
- Ordinary keyboard tabbing reaches all seven form controls/links through submit at 390x844, 1280x600 and 320x568. On short laptop, the textarea's bottom 24px is below the viewport while its label, entry area, center and focus remain visible; no fixed UI covers it. Recorded as partial visibility, not a claim that every border is visible.
- The builder calls its 41 assertions form checks, but 20 are viewport assertions and others cover menu/FAQ. Correct description: 41 browser/conversion assertions, plus the parent's 13 carryover assertions and separate keyboard checks.
- The claim ledger omits a separate row for the three-week build-window sentence. Parent verified it against https://gardenroomco.com/faq/ (company-stated aim, project-dependent, not a guarantee). This is an evidence-note omission, not an invented claim. No new report/template gate is warranted.
- The prior attempt described the source message field incorrectly as optional. The source contact HTML has `aria-required="true"` on its message field. This independent attempt correctly requires name, email and message, with optional phone and marketing consent. Preserved source HTML supports that correction.
- Parent audit harness needed installed Chrome explicitly, a longer wait for normal smooth scrolling, and line-fragment hit testing for a wrapped privacy link. Those initial failures were harness issues, not page defects. Raw screenshots remain preserved rather than silently discarded.

## Verified measurements

Static/surface reports pass. Five required viewport reports have zero failures and zero warnings. Real source and page glyph families match: Reem Kufi headings, Poppins prose. Lighthouse 12.8.2: Performance 98, Accessibility 100, Best Practices 100, SEO 100; LCP 2405ms, CLS 0, TBT 0. These are local measurements, not physical-mobile or published-origin evidence.

## Scope boundary

The form is local preview only; synthetic receiver discards input. No live lead, CRM, advertising stack, Cloudflare authorization or publication was performed. Production delivery, destination-specific consent, publication rights, live wording/configuration and physical-device testing remain for the later authorized deployment phase. Do not interpret the handoff document or a simulated live-mode switch as deployed infrastructure.

This is bounded acceptance testing for business 2, not proof that the skill is perfect for every business. Attempt 3 must verify R2-01 alongside the separate carryover list. Business 1 remains unaccepted; exact modal/group variants and the separate image-generation business still need their own tests. Usage when deciding the rerun: 40% used, below the 50% stop.
