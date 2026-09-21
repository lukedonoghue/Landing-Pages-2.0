# Project Resume Memory

Updated 2026-09-21. This is durable local/Git project memory, not account-wide ChatGPT memory.

## Boundaries

- Modify only the community fork. Never overwrite Luke's original skill or README-BOHDAN.md.
- Push only HEAD:refs/heads/community/pro-review-handoff-20260918 to origin, https://github.com/lukedonoghue/Landing-Pages-2.0.git. Local branch main is not permission to push remote main.
- Preserve unrelated dirty files. Stage only skills/community-landing-page-builder and docs/community-landing-page-builder.
- Remaining implementation, testing and Cloudflare work: GPT-5.6 Sol extra-high. Astra orchestrates/reviews. Existing Sol agent ID: 01a0c2b8-aa54-7dc0-abcd-e1fbf6c9545c.
- Workers Free confirmed by user. No paid upgrades, no DNS changes; keep demo on workers.dev. No real-business mail or synthetic claims of inbox delivery.
- Browser tests use managed Chromium, never personal Chrome profiles. If Cloudflare OAuth expires, use the computer's system browser with one live callback listener.
- Check usage periodically; save source, evidence, remaining tests and this memory, then push before 5% remaining. Latest checkpoint read 10% remaining. Never redeem a reset without permission.

## Paths And Live State

- Workspace: /Users/mac/Documents/Codex/2026-09-17/co
- Repository: work/Landing-Pages-2.0
- Canonical template: skills/community-landing-page-builder/assets/cloudflare inside repository.
- Runtime: work/community-acceptance-20260921/runs/full-funnel-r1/project inside workspace.
- Frozen independent-run skill: sibling skill directory. Do not rewrite it or mislabel assisted fixes as an independent first-pass success.
- Live page: https://clarentis-demo-20260921-r1.shevabody.workers.dev/
- Login: /login. CRM: /admin/. Owner username test-demo-operator.
- Private password: runtime .secrets/production-admin-password.txt. User copy: outputs/clarentis-full-funnel-r1/PRIVATE-CRM-PASSWORD.txt. Never commit or print either.
- Selected Cloudflare account 5b93d5e3c469e05d9bd13672e7887c4a; Worker clarentis-demo-20260921-r1; D1 ff4b75ac-adea-4384-ae59-32b1b99743c9. Other resources untouched.
- Last verified live version 37bb6b61-e96a-4bd4-9d19-3bc8f729d016, release 59a1278c-4fbe-4232-9c88-0c1f87bf30ac. This is the old single-owner release, not new team roles.

## Current Priority And Evidence

User reports attribution completely missing from a tagged live submission. Exact URL and submission identity requested. Sol is tracing live URL -> privacy/capture -> request -> Worker -> D1 -> CRM. Do not infer the cause before evidence. Preserve privacy choices and never silently disable consent protections to make a test pass.

Team role implementation is paused behind this incident. Canonical changes include admin/manager/viewer, native email invitations and admin-approved reset flow with Free recipient restrictions. Not integrated/deployed. Real sender domain and verified recipient inputs missing. See CRM-TEAM-ACCESS-FREE-PLAN-20260921.md for implementation/test details.

Latest full Node suite: 214 pass, 3 fail. Failures in tests/data-lifecycle.test.mjs login selector matches two submit buttons after reset UI addition. TAP report at workspace work/crm-team-final-regression.tap. Sol assigned narrow fixture fix after attribution diagnosis. Focused backend 45 pass, team 9 pass, free guard 3 pass, UI 18 pass, screenshot capture 1 pass, canonical Python 82 pass. Focused passes do not supersede red full suite.

Next: reproduce attribution, patch its actual source in both canonical and runtime without accidentally deploying team changes, run regressions, deploy isolated demo only through a fresh source-bound release workflow, verify a synthetic submission end to end. Record exact evidence and any unresolved user-specific reproduction. Then resume team integration and live role tests. Invitations/password-reset inbox delivery remain unverified until legitimate sender/recipient setup.
