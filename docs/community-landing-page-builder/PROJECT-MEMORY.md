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

User reports attribution completely missing from a tagged live submission. Exact URL now supplied: nine UTM keys and gclid/gbraid/wbraid/fbclid/msclkid/ttclid. Original submission identity remains unknown. Live reproduction completed: no-choice sends/stores no fields due attributionMode=consent; allowed choice preserves all 15 previously supported fields through CRM display. ttclid is unsupported and being added. See ATTRIBUTION-INCIDENT-20260921.md. User reports never seeing a prompt; do not blame user or claim that exact cause known.

Latest user direction: no custom built-in consent manager; use an external tool where needed. Demo authorized policy is lead attribution independent of optional measurement, with analytics and advertising matching disabled and browser opt-outs respected. Canonical skill should support external consent explicitly, not imply all US deployments are exempt or absence of banner equals consent. Sol implementing narrow source fixes and tests before isolated demo deployment. Parent review identified stale saved consent potentially loading GTM despite disabled tracking/external provider not ready; Sol assigned fail-closed gates and regressions.

Team role implementation is paused behind this incident. Canonical changes include admin/manager/viewer, native email invitations and admin-approved reset flow with Free recipient restrictions. Not integrated/deployed. Real sender domain and verified recipient inputs missing. See CRM-TEAM-ACCESS-FREE-PLAN-20260921.md for implementation/test details.

Latest full Node suite: 214 pass, 3 fail. Failures in tests/data-lifecycle.test.mjs login selector matches two submit buttons after reset UI addition. TAP report at workspace work/crm-team-final-regression.tap. Sol assigned narrow fixture fix after attribution diagnosis. Focused backend 45 pass, team 9 pass, free guard 3 pass, UI 18 pass, screenshot capture 1 pass, canonical Python 82 pass. Focused passes do not supersede red full suite.

Next: reproduce attribution, patch its actual source in both canonical and runtime without accidentally deploying team changes, run regressions, deploy isolated demo only through a fresh source-bound release workflow, verify a synthetic submission end to end. Record exact evidence and any unresolved user-specific reproduction. Then resume team integration and live role tests. Invitations/password-reset inbox delivery remain unverified until legitimate sender/recipient setup.

## Attribution Implementation Checkpoint

Latest account usage check: 7% remaining. Save before 5%, not after exhaustion. Source changes now implement ttclid capture/storage/display, banner-disabled and external consent modes, stale-consent tag-load protection and an empty-referrer normalization fix. The runtime is configured for lead attribution, disabled analytics/advertising matching and disabled built-in consent UI. No new corrected live release is confirmed yet.

Sol reports canonical backend 25/25, targeted client 3/3, targeted traffic 2/2; generated backend 25/25, targeted attribution 5/5, targeted CRM UI 1/1. These are focused checks, not a fresh complete regression pass. Full canonical suite previously had three ambiguous login selectors; selector fix is now in source, full rerun remains unconfirmed. Progress file: runtime build/attribution-fix-progress.json. Its initially hand-entered updated_at timestamp was future-dated; parent asked Sol to correct it using actual clock time. Do not use that timestamp as precise chronology.

Sol is refreshing rendered-copy and guarded release evidence for deployment. Still required: exact-URL live no-choice submission with all 15 supplied keys; CRM detail confirmation; browser opt-out and no third-party requests; reusable instruction updates and final Git/runtime backup. New team roles remain undeployed. Parent checkpoint commits are separate from Cloudflare publication.

Next checkpoint at 6% remaining: reusable SKILL/build/tracking/browser-QA instructions now include external consent management and ttclid. Parent found the generated funnel.json still had old consent-dependent attribution while site-config was modified; Sol aligned funnel.json and sync-config so a rebuild does not restore the bug. Runtime source backup in acceptance/clarentis-full-funnel-r1/project has been refreshed with allowlisted source/config only, excluding credentials, dependencies and local databases. Browser compatibility checks now distinguish internal UI from disabled/external modes and account for internal mode with optional data disabled. Static validation report passed, fingerprint 65bbdfb614916596ce16a081b3796244668d222307e1754f35b1e6672eca3533 at that check, but later source-bound reports may supersede it. Updated live deployment is still not confirmed. Resume Sol and inspect its progress/current release before claiming publication.

## Required 5% Checkpoint

Account usage reached 95% used. No reset redeemed. Source, generated runtime and this handoff are being committed/pushed again. Parent inspected three current-source reports under runtime build/: live-verification-attribution-final/result.json is pass_with_warnings with no failures (synthetic history warning); performance-attribution-fix/result.json and browser-compat-attribution-fix/result.json pass with no failures. All three identify c47f9354d46734602901f1614cc58b1236abc2a5802aca5091d3a33f0d794bea and localhost:8899, not the public site. Redacted result copies are in acceptance/attribution-incident-20260921; referenced detailed artifacts remain local unless copied separately.

Journey verification now supports explicitly disabled analytics: it requires no measured visitor/conversion linkage while still proving a stored lead, and metrics must not gain visitor/conversion counts. This fixes the former verifier's assumption that every valid CRM submission must be measured. Source changes and focused verifier tests are saved; a complete canonical suite rerun is still unconfirmed. Sol is finishing current-source release gates/authorization and then needs publication plus exact supplied URL live verification. As of this checkpoint, public attribution fix is NOT confirmed deployed. Existing single-owner credentials remain unchanged and the team/email feature is still not live. Preserve this distinction if usage ends mid-deployment.

## Latest Interruption: Browser Cleanup

User reported Mac lag and requested closing unused test browsers. Parent interrupted Sol and paused further browser testing. Two abandoned image-review Node scripts (PIDs 7745 and 7811, over 2 hours old) were confirmed to own isolated managed Chromium trees (7747-7750 and 7813-7816) using temporary Playwright profiles and localhost:8899. All ten processes received SIGTERM. A subsequent process check found no remaining Playwright/managed Chromium/WebKit/Lighthouse test browser or matching test runner. Personal Chrome PID 4601, Codex PID 7550, other apps, profiles and tabs were not touched. Do not assume all system lag was caused by these two browsers.

The abandoned scripts used unbounded Promise.all waiting for every image load; offscreen lazy images can leave that wait unresolved and prevent finally cleanup from running. Required follow-up before another test run: bound image loading and total run time; record/close owned processes on failure, timeout and interruption; never kill personal browser processes. This root-cause inference and follow-up are recorded, not yet implemented. Do not restart browser tests until the user is ready. Deployment/live exact-URL verification remain unconfirmed; inspect current release and Sol's final state before continuing. Source checkpoint 205180d was pushed at 5% remaining before this interruption.

Sol's final pause report confirms: no Cloudflare upload occurred; public site remains release 59a1278c-4fbe-4232-9c88-0c1f87bf30ac. Latest local source fingerprint is 45081849448aaad4386ccae1ce267ed023ac37043f3a8f920951e8049ec8d5c3 with all nine local gates registered pass/pass-with-warnings. Mandatory full regression session 78679 was interrupted before publication, so its result is not a pass. Wrangler local preview session 66072 was stopped too; localhost:8899 will require a deliberate restart. No new-source exact-URL live proof exists. Resume only after addressing bounded browser cleanup and user readiness.

## User Authorized Resumption

User said "please continue". Sol resumed with serial browser tests and a bounded command wrapper in runtime build/run-bounded-command.mjs. Parent separately checked managed-browser processes after the first suite and found none remaining. One full generated-project run passed 186/203, exposing 17 legacy consent fixture expectations. Fixtures now explicitly select internal UI for those test cases rather than inheriting the generated demo's disabled/external UI; unavailable-policy tests still require real form delivery and no optional attribution. Canonical and generated fixture corrections are saved, focused verification/full rerun still pending at this checkpoint. No new live release is claimed.

Remaining usage at this checkpoint: 3%. Prior mandatory 5% push was completed. Do not redeem reset credit without explicit user confirmation. Finish only existing attribution publication/live proof, not team roles or new features. Recheck progress and latest full regression outcome before resuming. Retain current browser-process inventory and close only owned automation processes at completion or timeout. Parent noted that a process-group timeout alone may not catch separately detached browsers, so a post-run owned-process check is still required.

Latest checkpoint: 2% remaining. Source is frozen at 2248ccf8d5c8624730f82a4043447fe4f504c5dc82515fb1f556bc94c1f28613. Focused recovery fixtures passed 9/9; privacy fixtures passed 9/10 followed by the corrected last case 1/1. These are not a full-suite pass. Sol is running the complete generated suite serially with a 720-second overall timeout, then must refresh all nine source-bound gates before guarded publication. Earlier gate reports are stale for this revision and must not be reused as current passes. No external authorization blocker and no new live deployment at this checkpoint. Do not edit runtime source during the frozen release run. Browser timeout and cleanup guidance is now in the community skill; retain explicit post-run owned-process verification.

## Publisher Timeout Found During Resumption

Source 2248ccf8d passed all 203 generated regression tests and all nine gates, with three existing heading-wrap warnings retained. Persistent full TAP: runtime build/full-regression-2248.tap, 203 pass, zero fail/skipped/cancelled, 285909 ms. Guarded publisher then failed before release creation/upload: scripts/release-tools.mjs localRunner hard-coded a 180000 ms command timeout, shorter than the serial suite's observed 240189-285909 ms. Parent authorized a narrow source-freeze exception for Sol to correct this bounded regression timeout in canonical and runtime source, refresh source-bound gates, publish and verify the exact user URL. This is a real release-tool defect, not failed CRM assertions or an external Cloudflare blocker. Usage now 1% remaining; no reset redeemed. Current confirmed live release remains 59a1278c-4fbe-4232-9c88-0c1f87bf30ac; no live attribution-fix claim until new release and synthetic CRM evidence are checked. Check current progress before resuming; newer source invalidates the 2248 gates as current acceptance.

## Latest Live State And Copy Work

Supersedes the prior no-deployment checkpoint: parent independently verified live release 9bbcac0f-7461-4388-90fe-3b9627d72319, version d840e468-b5a7-4b4f-a939-a31c879ea435, source b0ddb6b732a20010f99c38e50835a6dfa61795551517e4706cde8a02e91c3654, database connected. Privacy config is lead attribution, analytics disabled, advertising user data disabled, consent UI disabled, blank GTM ID. Runtime build/attribution-exact-url-live.json proves all 15 supplied URL fields in the request and authenticated stored first/latest touch, Google CPC source, zero external requests and logout revocation. Expanded CRM UI proof remains failed (0/15); do not describe complete UI acceptance until distinguishing verifier behavior from a display defect. The Sol agent hit the account usage limit before finishing. Its old progress JSON remains stale; this memory and the newest evidence supersede it. No reset credit redeemed.

User then requested classifier.dev and copy improvements. The free keyless remote MCP is installed as classifier; only six synthetic texts were sent. No paid account or executable package. Read CLASSIFIER-INSTALLATION-REVIEW-20260921.md for public-data-only constraints; it is optional orchestration tooling, not a community-build dependency.

Community copy instructions now require the doctrine on lightweight builds, a selected supported advantage, copy before layout and two bounded editorial passes within the existing review. No customer page or original Luke skill changed. See COPY-SKILL-REVIEW-20260921.md. User confirms Blue Mountain is reachable; our fetch/DNS/browser paths failed, so use the dated bundled capture honestly and keep fresh live review pending. No new independent copy acceptance run has been completed. Next task: isolated copy-only trial with revised skill and source business, no audit context or suggested copy; then evaluate before another expensive full build.
