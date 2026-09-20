# Clarentis image-generation attempt 1

Reviewed 2026-09-20. **Blocked: generated hero disclosure is painted behind the image on mobile/tablet.** Technical checks and source-copy carryovers pass; those do not override this visual truth failure. Generated page is unchanged.

## Independence and execution

Bernoulli `01a0bf74-8593-7a33-8204-a3afdeb19e56`, Sol 5.6 xhigh, no context fork, plain owner request and new empty project. Source 95665e6; 175-file frozen manifest unchanged before/after: `1cd8a17415c595ec8ae8c4bc00e20fc1d7de7bd5dba8890a53c796393fcf1c19`. Started 18:34 Kyiv, completed about 18:51. No coaching, prior page or audit was supplied. Shared-host filesystem boundary was instructed, not an OS isolation guarantee.

Fresh reviewer Averroes `01a0bf85-889b-7152-b3f4-a4ad18cc5a0e`, Sol 5.6 xhigh, no context fork. Raw findings and readable captures are under `evidence/image-generation-r1/reviewer/`. Parent tested interaction and generation evidence separately, then reproduced the reported disclosure failure. Both agents are closed.

Preview: http://127.0.0.1:53187/ . Static page preserved under `evidence/image-generation-r1/project/`; any loopback static HTTP server can preview it. All email/call tests intercepted intent before opening an OS handler. No message, call, lead, hosting or CRM action occurred.

## Findings and cause

| ID | Finding | Trace and source correction |
| --- | --- | --- |
| I1-P01 / P1 | Hero illustration disclosure exists but is invisible at 320, 390 and 768px. | `styles.css:159` gives the stacked mobile picture `order:2; z-index:0`; the separately absolutely positioned caption at line 57 paints underneath. Parent hit tests return IMG over the caption at all three widths, versus P at 1024. Existing rules required adjacent disclosure but lacked a concrete responsive placement default, and self-review mistook markup presence for painted text. Image guidance now prefers same-figure normal-flow captions and explicitly checks paint order after responsive layout changes in the existing pixel review. |
| I1-P02 / P2 | At 320x700 the hero text takes about 665px, leaving only a photo sliver and no following content in the first screen. | The narrow layout reuses the broader mobile copy volume and type scale. The builder tested 320px only for overflow. Design guidance now says to shorten/move supporting copy before sacrificing the useful image; no new universal viewport matrix or micro-type rule. |
| I1-P03 / efficiency | Three successful native generation calls produced two used assets; the first successful result was not surfaced because its response was treated as an MCP content array. | Exact tool-call record confirms the result shape handling mismatch, followed by a new hero call. It does not prove regeneration was solely caused by that mismatch. Image guidance now follows declared tool return/display formats and recovers successful saved output before regenerating for a visual reason. |
| I1-P04 / handoff | Builder notes identify the native tool but omit prompts/original-file mapping; originals remain only in the tool-managed directory. | Provenance depended on the private run trace. Parent extracted only generation calls and asset conversion evidence, copied originals and recorded hashes without exporting unrelated conversation. The existing image-plan instructions now retain selected originals in run research assets and map prompt, returned file and final derivative. |

No manual page repair or coached continuation counts as skill acceptance. The source patch changes two existing reference files and adds no helper, paid dependency or review round. Clarentis must rerun independently to test the correction.

## Proven evidence

- Parent interaction suite: **75 assertions pass** at 320x568 plus all five standard sizes. Correct email intent from each visible primary CTA, public phone near the top, keyboard menu/FAQ behavior, loaded images, no horizontal overflow and no third-party resource requests. Mail-app delivery and phone connection were not exercised.
- Parent rerun of bundled browser helper: **77 checks, zero failures/warnings**, including all ten source/applied actual glyph comparisons. The source declares Inter but actually renders the system family on this Mac; the build faithfully preserves that behavior and does not falsely claim a loaded Inter font. No cross-platform font guarantee.
- Parent static and prohibited-surface checks pass. Builder's raw Lighthouse 12.8.2 report, inspected by parent: 100 performance/accessibility/best-practices/SEO, LCP 1577.0408ms, CLS 0, TBT 0. This is a saved local synthetic report, not a production claim.
- Native generation is independently verified from the exact builder's tool invocation/output records, not merely its image-plan assertion. Three successful calls, no returned model identity; two selected originals mapped to WebP derivatives through the recorded cwebp commands. Parent inspected the selected originals: plausible generic desk scenes, no real staff/customer identity, readable financial results or official proof. Public disclosure nevertheless fails at narrow breakpoints.
- R5-P01 process endpoint passes: consultation, proposal, setup, ongoing support. R5-P02 offer preservation passes: six source fee entries and material scope/volume/complexity qualifiers. R5-P03 geographic fit passes: UK target audience visible early. R5-P04 helper/glyph evidence passes: builder used the supplied extractor and browser comparison without parent rescue.
- Prior modal C01/C02/C03/C05/C06/C07 are N/A on this correctly email-led page, not globally solved. C08 responsive hero and efficient supporting WebP are present; C10 image decode passes. Reviewer correctly rechecked lazy assets instead of reporting a missing image from an early capture. C11 withholds overall acceptance despite green technical results.

## Limits

The public source has no verified team/review/accreditation proof; none was invented. Its service list, fee guide and actual email conversion are retained. No CRM, deployment, provider tracking, physical-device mail handling or real delivery acceptance. Original Luke README remains untouched. Parent generation evidence extraction is audit work after completion, not assistance during the build.

Next: freeze the amended source and launch image-generation attempt 2 with the same owner request and an empty project. Current ceiling remains 70% weekly used / 30% remaining. Garden Room and Stayclean remain unaccepted separately.
