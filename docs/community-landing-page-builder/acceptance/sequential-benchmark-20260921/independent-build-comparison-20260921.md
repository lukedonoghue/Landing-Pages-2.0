# Independent build comparison

Requested 21 September 2026. Initial account reading: 38% used, 62% remaining at 19:58 UTC. Provisional stop: 40% remaining, following the preceding reserve-limit requests; the user has been asked to clarify if they meant 40% used instead.

| Run | Business | Model | Destination | State |
| --- | --- | --- | --- | --- |
| 1 | Clarentis, clarentis.co.uk | GPT-5.6 Sol Medium | New demo Worker and CRM in the connected account | Finished and live; parent audit found material page defects |
| 2 | 1st Class Mobile Notary Services, Cleveland, Ohio | GPT-5.6 Sol Low, closest supported setting to light | Requested go.netbean.com and crm.netbean.com; live workers.dev fallback | Finished at 23:24:29 UTC; parent audit complete; external setup still action_required |

Each builder receives a fresh project, a hashed frozen skill copy and a normal owner request. No previous project, audit, conversation history or coaching is provided. This is context independence in the same local environment, not a separate machine or Cloudflare account. Parent review begins after the builder completes its output or returns a concrete blocker.

## Measurements

Record UTC start, local page completion, infrastructure/deployment start, and final completion or blocker. Report page-build and full-build elapsed time separately, plus the deployment interval. A blocker is not a completed deployment.

Use Codex run-log token events for the builder and its own child agents. Report input, cached input, output and total separately. Cached input and reasoning output are subsets, not extra tokens. Phase values use the last reported usage event before the milestone and may have one in-flight response spanning the boundary. Keep parent orchestration, monitor repair work, provider image-generation usage and account-wide allowance changes separate. Do not convert a subscription percentage into a token count.

The usage-checker repair is a separate agent task. It is not a third simultaneous page build.

## Run 1 Input

Frozen from verified commit `9c530b7`, 202 files, manifest `18a6a0c3a6368b15e25bd4490b720329ce1e99df86537cad3eb5aaead4d4f568`. This contains the completed copy, attribution, CRM and beginner email-guide corrections. The in-progress usage checker is intentionally excluded until verified. The new builder was spawned with `fork_context=false`, model `gpt-5.6-sol`, effort `medium`, into an empty project. The saved owner request contains no previous audit findings or page implementation.

The initial run log confirms Sol Medium and two initial user-message records: normal runtime environment context and the saved owner request. No parent conversation was copied. Agent start: 2026-09-21T20:01:18Z. The shared local filesystem still exists; the run is explicitly restricted from reading other builds, audit reports or conversations. This is not an OS sandbox isolation claim.

## Run 2 Selection

[1st Class Mobile Notary Services](https://1stclassmobilenotary.com/) is a non-accounting local service business in Cleveland. Read-only inspection of the homepage, About, Services and Contact HTML found one unique proprietor portrait, plus the logo, a notary-stamp asset and two certification/seal assets. The About page repeats the same portrait. That is limited first-party photography, not a rich project-photo library. The builder will independently verify usable imagery and research the business; it will not receive the parent's inventory or page directions. No business contact was made and no form was submitted during selection.

## Run 1 Measurements And Delivery

Live page: https://clarentis-demo-20260921-2057.shevabody.workers.dev/
CRM: https://clarentis-demo-20260921-2057.shevabody.workers.dev/login.html
Owner username: `demo-owner`. Password delivered separately in `clarentis-demo-crm-password.txt`, not in this report or Git.

| Phase | Elapsed | Uncached input | Cached input | Output |
| --- | ---: | ---: | ---: | ---: |
| Page build and local checks | 56m 04s | 518,866 | 40,476,288 | 138,443 |
| External setup, deployment and verification | 12m 32s | 97,803 | 6,657,024 | 20,543 |
| Full run to completion milestone | 68m 46s | 619,475 | 47,246,464 | 159,392 |
| Final run-log total including handoff responses | N/A | 622,257 | 47,690,368 | 160,342 |

Page phase includes local CRM/form plumbing and verification, not solely graphic design and copy. There is a 10-second transition between page completion and external setup. Cached input is repeated context served from cache, not new authored content. Provider image-generation billing and parent audit/repair work are excluded. Token quantities do not establish subscription allowance consumed. Full machine-readable evidence: `clarentis-medium-token-usage.json`.

UTC milestones: agent start 20:01:18.450; page complete 20:57:22; external setup 20:57:32; CRM complete 21:08:27; finished 21:10:04, all 21 September 2026. The final handoff response follows the finished milestone.

## Run 1 Parent Audit

The builder completed its own checks and publication before the parent began this audit. The completed project and frozen skill input remain unchanged. Repairs apply to the canonical skill, then will be tested in run 2.

Confirmed defects:

1. Customer copy still narrates research and implementation. Examples include `The page adds no unsupported timing or outcome promise` and a marketing FAQ explaining disabled GTM tags. The editorial self-review claimed research provenance stayed internal, contrary to the actual page.
2. Hero imagery is hidden below 900px. Verified on the live page at 320, 390 and 768px. The image plan instead says the image follows the copy. The fold gate passed after necessary content was removed.
3. Four distinct content pictures were not delivered. Three original generated photos plus a PDF-cover image reusing the hero photograph were counted as four. A different file or overlay is not another independent original. Hiding the hero reduces mobile coverage further.
4. Before any submission, step 3 displays both failure and uncertain-result messages. Verified with an unsubmitted synthetic form. Error copy should appear only in its actual state, not as permanent help text to satisfy copy parity.
5. The brochure is present and legible across all six rendered pages, but its final page tells the reader how to verify and clean up a synthetic CRM submission. These are owner testing instructions, not useful brochure content. The demo disclosure itself is necessary and should remain.

Live read-only parent screenshots and observations are in `clarentis-medium-parent-audit/`. Below-fold lazy images marked `loaded: false` in the initial-viewport observation are not evidence of broken images; the audit did not scroll those images into view. The builder's scrolled checks reported successful decoding.

Observed positives: no horizontal overflow in the parent 320/390/768/1440 checks; modal Escape closes; PDF exists; actual source and applied glyph-font reports both show SF NS fallback from the Inter stack, so this run does not establish a brand-font substitution defect.

The separate backend audit completed after the build. It confirms all 34 maintained CRM files match the frozen skill, all 16 supported campaign fields persisted through the live receipt/CRM journey, and a fresh read-only D1 query returned zero leads and zero seeded team users. Focused backend tests passed 102/102 and GTM-generator tests passed 4/4. The retained pre-publication suite passed 245/245.

Additional findings: independent acceptance is not evidenced and must be treated as self-review; cleanup happened after the retained live journey, but no release-linked cleanup proof was saved; owner email setup instructions are too generic. These are assigned to bounded source repairs before run 2.

External blockers are real: the requested GTM import was not generated without actual GTM/Ads IDs and label; enhanced conversions are not active. Email invitations and resets have no verified sender/recipient setup or actual inbox test. Live multi-role invitation/reset testing therefore remains incomplete. A live page and owner login do not make these modules passed. See `clarentis-medium-backend-audit.md` for exact file references and limitations.

## Revised Skill And Run 2 Input

Targeted repairs passed 124 page/copy/image/browser checks and 63 backend/handoff checks. Parent reran the combined 72 Python tests successfully. The optional skill-creator validator could not run because PyYAML is absent; it is not reported as passing. Details are in `clarentis-skill-repair-report.md` and `clarentis-backend-skill-repair-report.md`.

Source committed as `f334e43` and pushed only to `community/pro-review-handoff-20260918` in Luke's repository. The run 2 skill includes the verified quota-warning implementation from `b2491b7`; a real read-only analytics connection remains owner-controlled, not supplied in the skill.

Run 2 was created with `fork_context=false`, model `gpt-5.6-sol`, effort `low`, in a fresh empty project. Frozen input: 210 files; manifest SHA256 `fe60c9f4a4c25dd85b6a0aee986349fe6ae89b51c537e0dbdbeba601dd2b2fd4`. Its saved prompt gives only the business URL, ordinary demo/CRM/deployment request, requested hostnames, isolation boundary and milestone measurement instructions. It does not include this report, prior findings, the first page or parent's image inventory. The frozen input and completed Clarentis run will not be changed while the builder works.

Allowance at launch: 48% used, 52% remaining. Continue only to the provisional 40%-remaining boundary.

The recorded initial run 2 input has exactly two user-message records: the exact saved owner request and normal runtime plugin/environment context. Model and effort are `gpt-5.6-sol` and `low`. See `notary-low-input-proof.json`. No parent coaching has been sent after launch.

These are practical benchmark runs, not a controlled model comparison: the business, imagery, domain setup and skill revision differ. Timing or token differences alone cannot establish that one reasoning level is better or cheaper for the same task.

## Run 2 Timing Caveat

The builder recorded its first local-page completion at 22:19:02Z, 47m00s after launch, and external setup at 22:19:11Z. At that first checkpoint the reported counters were 422753 uncached input, 39166976 cached input and 98277 output tokens. Later progress returned to a design/image gate and commands repeated image evidence, rendered-copy capture, browser checks, performance and live verification during the external-setup interval. Therefore the first checkpoint is not evidence of a clean, exclusive total for all page-related work. The later interval includes publication preparation and revalidation, not just Cloudflare upload time. Preserve the raw builder milestones and disclose this overlap rather than inventing an exact attribution of interleaved work.

## Run 2 Final Delivery And Measurement

Live page: https://netbean-notary-demo-20260922.shevabody.workers.dev/
CRM: https://netbean-notary-demo-20260922.shevabody.workers.dev/login.html
Owner username: `demo-owner`. Password is in the private local `notary-demo-crm-password.txt`, never this report or Git. Brochure: `mobile-notary-preparation-guide.pdf`. Owner setup instructions: `notary-demo-owner-handoff.json`.

| Phase | Elapsed | Uncached input | Cached input | Output |
| --- | ---: | ---: | ---: | ---: |
| First page/local completion checkpoint | 47m 00s | 422,753 | 39,166,976 | 98,277 |
| External setup, deployment and revalidation | 65m 18s | 320,505 | 51,469,568 | 82,567 |
| Full run to completion milestone | 112m 27s | 746,433 | 91,000,960 | 181,250 |
| Final run-log total including handoff responses | N/A | 749,808 | 91,097,600 | 182,301 |

UTC milestones on 21 September: start 21:32:01.903; first page checkpoint 22:19:02; deployment stage 22:19:11; CRM complete 23:22:45; finished 23:24:29. Exact counters are in `notary-low-token-usage.json`. Final reported input plus output is 92,029,709 tokens, including 91,097,600 cached input. Clarentis final reported total is 48,472,967, including 47,690,368 cached input. These are not fresh-token or subscription-cost totals. Neither run has an independently measurable pure Cloudflare-upload token interval. The external intervals above include setup, checks and handoff. The second also includes repeated page checks after its initial completion checkpoint.

## Run 2 Audit And Decision

The builder was finished before the parent opened the page for review. No coaching or parent corrections were supplied during the build. The frozen 210 files still match their input hashes. All 37 maintained backend identity entries match; checked guard/test scripts are unchanged. The current release has 289/289 matching sealed files, source fingerprint linked to the deployed Worker/D1, and truthful self-review provenance. These are reusable-core and release-integrity passes, not a guarantee of copy or visual quality.

Improvements observed: four different content originals (the proprietor portrait and three generated illustrative settings); hero imagery visible at 320/390/768/1440; no horizontal overflow; error messages hidden before submission; backdrop dismisses the modal; correct local brand fonts; five-page readable brochure without CRM-testing instructions; login return link uses the working workers.dev origin. The guarded live CRM journey proves all 16 campaign fields in submitted and stored first/latest touches, receipt correlation, mutation, logout rejection, and exact-ID synthetic-lead soft removal. Historical test metrics are retained and disclosed.

Not accepted as fully ready:

1. Research narration remains in buyer copy and parts of the PDF: "Published professional signals", "Company assertion on the official site", and "This demo does not invent a price range". Necessary demo disclosure and honest claim qualification should remain; internal research narration should not.
2. Full-page review captures contain blank lower sections because of CSS `content-visibility: auto`. Actual scrolling reveals the live sections. The defect is incomplete visual-review evidence, not a blank live page. The self-review nevertheless accepted those captures.
3. At 390px the final submit label wraps to three lines and creates an oversized button. Modal introductory "Nothing was sent" wording also reads like a past failure before any attempt.
4. Attribution works now, but `analytics.required_attribution_mode` is absent. The optional guard therefore does not pin the owner's required lead-attribution mode against later configuration drift. This is a recurrence-prevention gap, not another failed live capture.
5. Usage monitoring is not connected or live-verified, and its setup requirement is omitted from the owner blocker list. An honest unavailable state is better than a false safe reading, but does not meet automatic monitoring readiness.
6. The first page-complete milestone does not cleanly separate later page revalidation from deployment. The full run took longer and consumed more reported tokens than Clarentis; business and skill differences prevent attributing that solely to Low effort.

External blockers: the netbean.com zone is not in the connected Cloudflare account, DNS authorization is read-only, and both requested custom hosts are unconfigured. Registrar is unverified; Namecheap-like nameservers alone do not prove registrar identity. The owner's handoff explains DNS inventory, preserving mail, Free zone onboarding and review before nameserver changes. Real GTM/Ads IDs and label, authorized sender/verified receiving inboxes, and the read-only usage-monitor connection are still missing. No real GTM import/advertising delivery or invitation/reset inbox workflow is claimed. Existing sites, DNS, mail and billing were not changed.

Full findings: `notary-low-final-audit.md` and `notary-low-backend-audit.md`. No second-run audit fixes were applied to its page or the canonical skill; source remains `f334e43` for a clean benchmark. All builder/audit agents and parent-owned test browsers are closed. Final allowance reading: 58% used, 42% remaining. Stop here, preserving the requested reserve.
