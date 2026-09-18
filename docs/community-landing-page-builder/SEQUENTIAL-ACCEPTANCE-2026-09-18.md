# Sequential community acceptance

Status: running. Started 2026-09-18, Codex weekly usage 2% used. Pause for user confirmation at 32% used (30 additional percentage points). Check at run boundaries and during long runs. No automatic credit redemption.

## Scope

Orchestrator: Astra. Builders: gpt-5.6-sol, reasoning xhigh, one active builder at a time. Fresh agents use fork_context=false. Each receives only a frozen skill folder, a new empty project, a short owner request, and filesystem isolation instructions. They must not read previous attempts, parent conversation, private accounts, or other client projects. These are fresh-context tests with instructed filesystem boundaries, not isolated operating-system containers or new ChatGPT accounts.

Stop at the local build before Cloudflare authentication, provisioning, publishing, live form submissions, or external account connection. Earlier session permission to deploy Byrider does not apply to these businesses.

User clarification: this phase tests the page build itself from no conversation context, no Codex history and no technical knowledge. It is not a complete CRM acceptance phase. Defer new CRM/database creation and cloud setup. A truthful isolated local form simulation is permitted for page behavior; do not count it as saved-lead or production-backend proof. Keep the existing CRM unchanged for later integration, without exposing its source, credentials or previous business context to cold-start builders. Review research, copy, branding, images, responsive rendering, accessibility and page-side conversion behavior. Do not reintroduce full-funnel infrastructure requirements under the name of rereading Luke's plan.

## Cases

1. Website only: Stayclean, https://www.stayclean.co.uk/ . Local window-cleaning quote funnel. No supplied keywords, reference, or assets.
2. External reference: The Garden Room Co., https://gardenroomco.com/ . Reference https://www.greenretreats.co.uk/ as an example of presentation, not a source of client claims or media. Verified reachable and absent from the bundled copy-library text. Clean Slate was rejected for this test because it is already a built-in reference and would not exercise B09's new-reference case.
3. Image generation: Clarentis, https://clarentis.co.uk/ . Public accounting/bookkeeping business site with one logo image (475 x 275) and no CSS background-image URLs, verified in rendered Chrome and HTML on 2026-09-18. No service/team/project photographs are present on the inspected page. A plain owner request for realistic new imagery exercises a genuine visual gap. Use illustration, not invented staff, offices, clients, financial results, documents or software proof. Builder must research independently and generate an actual suitable asset. Replaces The Organised Space, whose existing real project gallery made it a poorly justified generation case. Secondary business listings corroborate Clarentis Ltd; the Companies House page was inaccessible through web tooling, so no direct registry verification is claimed.

Official websites were opened and verified during selection. Builders repeat their own source research without receiving this audit document.

## Evaluation and iteration

- Freeze the exact skill files for each attempt. Preserve prompts and model settings outside builder scope.
- Review the actual code, research provenance, rendered page at the skill's five viewports, imagery, form behavior, and any claimed performance evidence.
- For each error record symptom, exact artifact/line, upstream rule or implementation cause, smallest skill fix, and focused regression.
- A correction to a finished page alone is not a skill fix. Start a new empty build with a new independent agent after a source fix.
- No added blanket gates, repeated scorecards, or paid API prerequisites. Prefer clearer defaults and reusable deterministic checks.
- Final claim is bounded acceptance on these cases, never a guarantee of perfection on every future business.

## Progress

- Baseline source: f87d152 in Luke's Landing-Pages-2.0 repository, skills/community-landing-page-builder only.
- website-only-r1: completed agent `01a0b584-2c94-7c43-bda0-1ed9aadc0b87` (Ampere), gpt-5.6-sol xhigh, fork_context=false. No audit feedback supplied. Parent review rejected the self-reported local final; see WEBSITE-ONLY-R1-REVIEW.md. This page-first run is valid for the clarified scope, not CRM acceptance. Snapshot: 171 files, sorted relative-path/SHA-256 manifest hash `658335e8eef6f02caabaf88b10e4e77fc8b0c289bc440a0fa2998d3554e6fe63` (excluding __pycache__ and .DS_Store).

Attempt 2 ran 2026-09-18 from approximately 21:03 to 21:27 Kyiv: agent `01a0b5b0-3001-7880-ad83-d9dee02c601c` (Raman), gpt-5.6-sol xhigh, fork_context=false. Same owner request, new empty project, no audit feedback. Frozen skill: 171 files; JSON-serialized sorted path/hash pairs SHA-256 `3aef69233b2035008eabdaa51be10847dc7efb693253bae3e60a9b8210cd64a4`. Usage at launch: 7% consumed. Completed, parent reviewed and agent closed. Form and performance improvements verified; remaining composition/reporting issues described in WEBSITE-ONLY-R2-REVIEW.md.

Attempt 3 ran 2026-09-18 from 21:30 to approximately 21:58 Kyiv: agent `01a0b5c8-953d-75b2-a549-7792cf0899c5` (Tesla), gpt-5.6-sol xhigh, fork_context=false. Same plain request, another empty project, no previous findings or output supplied. Frozen skill: 172 files; JSON path/hash manifest SHA-256 `6848d4443c0698ec1127874b823203a05975d4151e2e157c5b3f4f70e8938eac`. Parent form tests passed; an uncoached fresh visual reviewer rejected text collisions and mobile hero obstruction. Both completed agents are closed. See WEBSITE-ONLY-R3-REVIEW.md.

Attempt 4 started 2026-09-18 at 22:05 Kyiv: agent `01a0b5e8-9d11-7da2-b5f5-5c4a344382c9` (Ramanujan), gpt-5.6-sol xhigh, fork_context=false. Same plain request and empty project. Frozen skill: 172 files; JSON path/hash manifest SHA-256 `89da9b8249d302df1bad42383312c0ef63974b014c9a66cb40827dd52f6d2159`. Latest checked usage: 12% consumed; pause at 32%. Only this builder is active. External-reference and image-generation cases have not started.

## README and local-history reconciliation

Reread Luke's README-BOHDAN, SELF-GUIDED-BETA-PLAN (especially M5 and its scorecard), development progress, the separate Bohdan tracker, community decisions/handoff, relevant Git commits, and this task's earlier recorded results. These remain orchestrator-only material.

- Luke's independent scenarios test an unaided user journey, not just screenshots. B02 covers real local form-to-D1-to-CRM/reporting behavior, B09 a previously unbundled reference, B10 rendered copy parity, B11 actual generation provenance, B12 brochure integrity, B17 environment setup, and B18 interruption/resumption.
- The user's later instruction removed default copy/design approval stops. Reading Luke's earlier baseline does not reinstate those stops or authorize any cloud mutation.
- Commit d417c90 introduced the community page-first default and optional backend/CRM/brochure. After the orchestrator raised its difference from Luke's full-funnel plan, the user explicitly confirmed page-build testing now and CRM testing later. The page-first default remains appropriate for this phase.
- The earlier Molly Maid exercise tested workflow movement with the wrong target. Subsequent quotas produced formulaic outputs, and were removed. Neither test is evidence for the current package.
- Byrider's technical pass missed source-form parity, typography provenance, and visual quality. Do not equate a validator or reviewer approval with evidence that these are correct.
- The live Byrider pilot used orchestrator intervention and manual publication after the guarded path failed. Public read-only checks passed, but this is not proof of an unaided full release journey.
- Never count a coached continuation or manually repaired project as a fresh first-run success. Freeze the amended skill and start another empty project with a new agent.
- These agents share the installed tool environment and host. No conversation is forked, and filesystem boundaries are explicit instructions, not a separate account or hard isolation. Do not claim clean-machine, physical-device, or ordinary ChatGPT compatibility from these runs.
- Record blockers, retries, setup effort, external requirements and intervention alongside output quality. No live Cloudflare, provider delivery, remote recovery or physical-device acceptance is claimed in this pre-connection exercise.

## Known earlier process failures to verify

- Publishing evidence was repeatedly regenerated and invalidated by snapshot timestamps. Do not reproduce that ceremony for ordinary local pages.
- Earlier code recorded a generic deploy request as copy approval; deployment authorization and evidence of editorial review must be represented accurately.
- Earlier manual publishing bypassed guarded QA. A deployed pilot with public checks only is not proof that the complete skill passes.
- OAuth in-app callback failure was observed on this machine. Do not claim all Codex browsers universally lack callback support.
- A SQLite lock and later preview exits were observed; concurrency and Node version were suspected, not isolated causes. Do not present either as a proven root cause without evidence.
