# Security release handoff and remaining work

Updated: 23 September 2026. Owner: Luke / an authorized repository and production operator.

## Release decision: HOLD

**The security remediation is NOT installed in this repository. All three existing workflows passed on the unpatched baseline. These are different facts.** Do not interpret a green baseline workflow, this documentation commit, or creation of a security branch as installation of the fixes or production security acceptance.

At the start of this attempt, main was `76285ea8408556cacb4d94d5db9f66000cf452e6`. The connected GitHub account reports push/admin permission. A fresh direct `GitHub.create_tree` attempt to upload the reviewed access-audit source was blocked with: "This tool call was blocked by OpenAI because we couldn't determine the safety status of the request." The source write produced no tree or commit. This is a tool-side block, not a GitHub repository permission denial. No encoded upload, alternate source-write route or CI patch bootstrap was used to bypass the block.

The initial addition of this file was committed directly to main as `7f885bfe8c7e93c0ff256627a743c3543b0e963a`, which triggered all three existing main-push workflows. Those workflows were observed through completion. The subsequent evidence update changes only this document and skips a redundant documentation-only CI run; all results below remain attributed to that exact tested commit. No runtime, test, workflow or release gate was changed or weakened by these documentation updates.

No production deployment, migration, credential rotation, account-access change or real customer lead submission was performed. Synthetic leads exist only in the isolated local CI fixture.

## 1. Prepared remediation, not committed here

Use the final package supplied in the conversation, not the earlier remediation package and not both patches.

- Package: `landing-pages-2.0-security-final-review.zip`
- Package SHA256: `400a4e12d73e8ed4117e4972d87fb76b7f7ff7fee98e18d38da6cc7ea71097c2`
- Patch: `landing-pages-2.0-security-final-review.patch`
- Patch SHA256: `a14fc415e359ee70d52348ce1a8788c0749c54f34526ae4ed83a2fb1ff8425c6`
- Exact patch base: `76285ea8408556cacb4d94d5db9f66000cf452e6`.
- Scope: 89 changed/new text files, including tests and operational references. The generated CRM example must be rebuilt from the complete repository with its real assets.
- The package is not hosted in this repository. Retrieve it from the conversation and keep the extracted package outside the checkout.

Prepared changes cover privileged manual-reset restrictions, owner-only privilege changes, admin-only sensitive operations, current-password confirmation, idle expiry, normalized routing and fallback-host restrictions, access auditing, bounded public admission limits, signed minimal Google Sheets delivery, persistent downstream erasure, backup reconciliation, agent credential restrictions, browser/UI policies and generated-example parity. These are prepared changes, not claims about the current main runtime.

A fresh local check on 23 September confirmed patch application and exact contents for all 89 supplied files, with zero checksum mismatches. The three targeted security/UI-policy test files ran again: **31 passed, zero failed, zero skipped**. This local environment uses Node 22.16.0 and Python 3.13.5; its source snapshot omits bundled font binaries and its npm registry DNS lookup failed. It is not the supported complete release environment. No full patched CI/browser validation is claimed.

Earlier package evidence remains partial: six focused publishing checks and 122 focused Python checks passed; the broad Node run did not pass (117 passed / 25 failed), and full Python discovery/browser integration were incomplete. Counts overlap. Read `REVIEW.md` and `verification/` in the package; do not turn these figures into full release acceptance.

## 2. Apply and reconcile in an authorized development environment

- [ ] Review the final patch and verify both SHA256 hashes.
- [ ] Use a complete clean checkout. Preserve any current work; never reset or discard it to force application.
- [ ] Create a new local review branch at the exact patch base. The package helper intentionally rejects another base, including a main branch advanced only by this handoff document.
- [ ] Run the package's `apply.py --repo /path/to/checkout` in check-only mode, then rerun with `--apply` after reviewing the result.
- [ ] Reconcile any newer main commits, keeping this handoff file. Do not apply the earlier patch first.
- [ ] Inspect `scripts/sync_crm_example.py` and its generated destination; run `python scripts/sync_crm_example.py`, then `python scripts/sync_crm_example.py --check` using the complete repository and exact bundled assets.
- [ ] Run `git diff --check`, inspect all changed/untracked files, and ensure no credentials, customer data, databases or private handoff files enter the commit.
- [ ] Commit the reviewed source and regenerated example on a review branch, open a PR to current main, and run all required workflows against that precise PR head/merge candidate.
- [ ] Merge only after every required check passes and all release-affecting failures have been fixed. Record the actual merged SHA below. Do not use a CI-skip marker on the source-install commit.

Do not replace maintained community runtime files with the older client-specific example branch. Migrations 0009/0010 and identity-attribution additions remain a separately reviewed change; migration 0011 deliberately reserves those numbers rather than importing the old runtime.

## 3. Completed GitHub baseline validation

**Tested commit: `7f885bfe8c7e93c0ff256627a743c3543b0e963a`. Runtime is unchanged from `76285ea`. All runs below were fresh push runs, not reused results from an earlier PR.**

| Workflow and actual run | Observed result | Evidence and scope |
|---|---|---|
| [Verify community release, 35844466700](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35844466700) | SUCCESS; every job completed | 300 community Python tests; 293 Node/application tests, zero failures and zero skips; Node 24 and locked dependencies; high-severity dependency-audit gate; real Chromium and WebKit installation/launch; Worker dry bundle |
| [Verify native community routing, 35844466728](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35844466728) | SUCCESS; every step completed | 69 routing/reservation/fallback/safe-installation tests; committed OpenAI and Claude profile parity check returned pass and no changes |
| [Verify current community skill and end-to-end local demo, 35844466786](https://github.com/lukedonoghue/Landing-Pages-2.0/actions/runs/35844466786) | SUCCESS; every job completed | Repository integration contracts; catalogue and reader-layout checks; application/browser regression suite; Worker dry bundle; freshly generated fictional project; local page/form/PDF/D1-backed CRM journey; portable archive export/import |

The routing suite overlaps the 300-test Python suite, and the application suite runs in two workflows. Do not add these into an inflated unique-test total. A passed high-severity dependency gate is not a claim that every dependency has no lower-severity issue or future vulnerability.

Downloaded and inspected artifacts:

- `community-python-results`, artifact `10742453887`: actual log ends with `Ran 300 tests` and `OK`.
- `community-application-results`, artifact `10743270837`: actual TAP ends with 293 passed / 0 failed / 0 skipped. Chromium and WebKit wizard/reader reports pass at 320, 390 and 1440 widths, with no recorded JavaScript errors; wizard reports include preserved input, advance, pause/resume and anonymous/cross-origin rejection.
- `current-community-local-evidence`, artifact `10743580252`: synthetic demo verification passes with 78 browser checks, 100 journey checks, three PDF pages rendered, full layout/performance checks and portable handoff roundtrip. Journey assertions include named login, form redirect, brochure download, receipt correlation, CRM update, filtered metrics and logout. CRM persistence evidence comes from authenticated Worker APIs backed by local D1, not an independent production SQL audit.
- Synthetic local Lighthouse result: median performance 100, LCP approximately 1.277 seconds, CLS 0 and TBT 0 across three runs. These are lab-fixture measurements, not real-user performance or a production guarantee.

### Visual caveat and missing real-world coverage

The automated demo report itself says screenshots alone are not visual approval. The three rendered demo PDF pages, a short-desktop modal screenshot and mobile thank-you samples were inspected. The PDF is explicitly a deterministic fictional software-test fixture, not evidence of genuine company research, testimonial sourcing or final client design quality.

**Open visual item:** `.development/demo/build/layout/screenshots/390x844-thank-you.png` shows an empty inline-reader area under "Read your guide now". The same run passes brochure download and PDF rendering. The cause of the empty captured viewer is not established; a headless viewer/capture limitation is possible. Do not mark the on-page reader visually accepted from the automated pass.

- [ ] Reproduce the inline-reader view in the supported interactive browsers; verify the intended document actually appears or an accessible HTML/fallback reader is presented. Fix any confirmed application/capture defect and add a corresponding regression before visual acceptance.
- [ ] Review an actual generated client page, full confirmation page and researched/image-bearing PDF. Synthetic fixture success does not prove native model availability, live review research, image-generation handoff, external providers or publication.

## 4. Required patched-candidate validation: still outstanding

The three existing workflows remain required after source installation. None may be removed, weakened or marked passing without execution on the patched candidate. Baseline success cannot substitute for this step.

Minimum additional commands, using the supported Node/Python versions and actual browser prerequisites:

```sh
python scripts/sync_crm_example.py --check
python -m unittest discover -s skills/community-landing-page-builder/tests -p 'test_*.py' -v
cd skills/community-landing-page-builder/assets/cloudflare
npm ci
npm audit --audit-level=high
node --test tests/security-hardening.test.mjs tests/secure-fetch.test.mjs tests/user-permissions.test.mjs
npm test
npm run deploy:dry
```

- [ ] Confirm the new security tests actually ran, not merely that the old suite passed.
- [ ] Verify migration 0011 on both a fresh synthetic database and a representative sanitized upgrade fixture. Retain failure logs and resolve real failures.
- [ ] Verify Chromium and WebKit launch and their tests execute without skipped tests.
- [ ] Complete the fresh demo and portable export/import check; inspect generated page/PDF and CRM evidence rather than relying on compilation alone.
- [ ] Capture the exact patched commit SHA, workflow run URLs, conclusions, test counts, dependency-audit and dry-bundle results.

## 5. Production and host handoff that repository CI cannot complete

### Migration, accounts and deployment

- [ ] Review migration 0011 with the deployment operator. It signs users out, invalidates unused reset links, narrows manager capabilities and disables legacy query-token Sheets connections.
- [ ] Review current users, roles, active sessions and every outbound connection before rollout.
- [ ] Review rollback and encrypted backup/recovery procedures. Restoring old data must not reactivate account links or resume stale downstream deletion jobs without reconciliation.
- [ ] Apply migrations and deploy through the approved production workflow only when authorized. Record deployment identity and database migration status.
- [ ] Check custom public/CRM host separation, rejected Workers/Pages aliases, normalized admin paths, session/cookie/header behavior and private release verification on the actual deployment.

### Google Sheets and downstream data

- [ ] Deploy the new standalone, versioned Apps Script; use Script Properties and the clean `/exec` endpoint, not a URL bearer token or a spreadsheet-bound secret.
- [ ] Upload `GOOGLE_SHEETS_SIGNING_SECRET` through the trusted operator secret prompt. A code-only redeploy does not install this new secret.
- [ ] Set the correct destination key version, Script Properties and spreadsheet identity without placing secret values in this file, GitHub, chat or CI logs.
- [ ] Verify client-owned automation-account ownership, MFA/recovery, named-account sharing, Viewer-by-default access and restricted standalone-script editors.
- [ ] Reconcile historical full-JSON columns, duplicated tabs, exports, offline copies and missing historical receipts. Minimal new payloads do not erase old copies.
- [ ] Authorize a clearly labelled synthetic create/delete journey; confirm both the actual Sheet row and its deletion, not only endpoint reachability or an acknowledgement.
- [ ] Resolve all failed/pending downstream erasures. CRM deletion completion alone is not proof that every managed or exported copy is erased.

### Agent-host enforcement prerequisites

A JSON/TOML parsing test does not demonstrate enforcement by the installed agent. Verify the effective configuration and synthetic denied-file/denied-environment probes, without exposing real credentials.

- [ ] For Codex, check project trust and the resolved policy: untrusted projects skip project-scoped `.codex` layers. Keep critical restrictions in an operator-controlled policy layer rather than trusting unreviewed content to activate them. Check that explicit environment overrides do not reintroduce secrets. See the current [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
- [ ] For Claude Code, verify the installed version supports `sandbox.credentials` (the current documentation requires 2.1.187 or later), sandbox filesystem isolation is enabled, and the settings source is actually loaded. Its credential rules apply to sandboxed Bash; file-denial rules are not enforced when filesystem isolation is disabled. Verify other tools/subprocesses separately and keep publishing credentials outside the untrusted build context. See the current [official sandbox documentation](https://code.claude.com/docs/en/sandboxing).
- [ ] Check the operator's actual installed host and version rather than assuming all ChatGPT, Codex and Claude environments enforce the same configuration.

### External controls and remaining exclusions

- [ ] Verify scoped Cloudflare credentials, Cloudflare/Google MFA, CRM-host access controls and edge rate limiting on public lead intake. Application counters alone do not prevent all distributed resource exhaustion.
- [ ] Move handoff passwords into a password manager; rotate/remove obsolete plaintext copies; encrypt exports and document retention/recovery.
- [ ] Update the client's privacy notice and retention schedule for Google Sheets and any separately enabled identity-attribution profiling.
- [ ] Decide separately on optional Turnstile, proactive owner-email security alerts and external monitoring. These are not claimed as delivered by the prepared patch.
- [ ] Inventory and upgrade existing deployed client copies separately. This work does not certify the legacy branded skill or every historical branch/deployment.

## 6. Operator completion record

Fill this in with evidence, not assumptions. Do not place passwords, tokens, customer records or private backup locations here.

- Baseline CI: ALL THREE WORKFLOWS PASSED at `7f885bfe8c7e93c0ff256627a743c3543b0e963a`; not a patched-release approval
- Source-install PR and commit: NOT INSTALLED
- Generated-example parity result: NOT VERIFIED ON COMPLETE PATCHED CHECKOUT
- Patched release workflow runs: NOT RUN
- Patched dependency audit and Worker bundle: NOT VERIFIED
- Inline-reader visual caveat: REPRODUCTION AND ACCEPTANCE REQUIRED
- Migration/deployment identity: NOT DEPLOYED
- Google standalone-script version and non-secret key version: NOT VERIFIED
- Authorized production synthetic create/delete evidence: NOT RUN
- External account/sharing/edge/backup/agent-host controls: OPERATOR REVIEW REQUIRED
- Remaining accepted risks and approver: NOT RECORDED
- Final security release approval/date: HOLD
