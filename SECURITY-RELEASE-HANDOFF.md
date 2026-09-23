# Security release handoff and remaining work

Updated: 23 September 2026. Owner: Luke / an authorized repository and production operator.

## Release decision: HOLD

The security remediation is NOT installed in this repository. Do not interpret this documentation commit, a green baseline workflow, or creation of a security branch as installation of the fixes or production security acceptance.

At the start of this attempt, main was `76285ea8408556cacb4d94d5db9f66000cf452e6`. The connected GitHub account reports push/admin permission. A fresh direct `GitHub.create_tree` attempt to upload the reviewed access-audit source was blocked with: "This tool call was blocked by OpenAI because we couldn't determine the safety status of the request." The source write produced no tree or commit. This is a tool-side block, not a GitHub repository permission denial. No encoded upload, alternate source-write route or CI patch bootstrap was used to bypass the block.

This file is the requested operator-owned record of what is not installed, what must be checked and what remains outside repository automation. No production deployment, migration, credential rotation, account-access change or live lead submission is authorized by this documentation commit or performed by it.

## 1. Prepared remediation, not committed here

Use the final package supplied in the conversation, not the earlier remediation package and not both patches.

- Package: `landing-pages-2.0-security-final-review.zip`
- Package SHA256: `400a4e12d73e8ed4117e4972d87fb76b7f7ff7fee98e18d38da6cc7ea71097c2`
- Patch: `landing-pages-2.0-security-final-review.patch`
- Patch SHA256: `a14fc415e359ee70d52348ce1a8788c0749c54f34526ae4ed83a2fb1ff8425c6`
- Exact patch base: `76285ea8408556cacb4d94d5db9f66000cf452e6`.
- Scope: 89 changed/new text files, including tests and operational references. The generated CRM example must be rebuilt from the complete repository with its real assets.
- The package is not hosted in this repository by this documentation commit. Retrieve it from the conversation and keep the extracted package outside the checkout.

Prepared changes cover privileged manual-reset restrictions, owner-only privilege changes, admin-only sensitive operations, current-password confirmation, idle expiry, normalized routing and fallback-host restrictions, access auditing, bounded public admission limits, signed minimal Google Sheets delivery, persistent downstream erasure, backup reconciliation, agent credential restrictions, browser/UI policies and generated-example parity. These are prepared changes, not claims about the current main runtime.

Prior local evidence in the package is explicitly partial: 31 targeted security/UI-policy checks, six focused publishing checks and 122 focused Python checks passed. The broad Node run did not pass (117 passed / 25 failed); full Python discovery and browser integration were incomplete. Counts overlap. Read `REVIEW.md` and `verification/` in the package; do not turn these figures into full release acceptance.

## 2. Apply and reconcile in an authorized development environment

- [ ] Review the final patch and verify both SHA256 hashes.
- [ ] Use a complete clean checkout. Preserve any current work; never reset or discard it to force application.
- [ ] Create a new local review branch at the exact patch base. The package helper intentionally rejects another base, including a main branch advanced only by this handoff document.
- [ ] Run the package's `apply.py --repo /path/to/checkout` in check-only mode, then rerun with `--apply` after reviewing the result.
- [ ] Reconcile any newer main commits, keeping this handoff file. Do not apply the earlier patch first.
- [ ] Inspect `scripts/sync_crm_example.py` and its generated destination; run `python scripts/sync_crm_example.py`, then `python scripts/sync_crm_example.py --check` using the complete repository and exact bundled assets.
- [ ] Run `git diff --check`, inspect all changed/untracked files, and ensure no credentials, customer data, databases or private handoff files enter the commit.
- [ ] Commit the reviewed source and regenerated example on a review branch, open a PR to current main, and run all required workflows against that precise PR head/merge candidate.
- [ ] Merge only after every required check passes and all release-affecting failures have been fixed. Record the actual merged SHA below.

Do not replace maintained community runtime files with the older client-specific example branch. Migrations 0009/0010 and identity-attribution additions remain a separately reviewed change; migration 0011 deliberately reserves those numbers rather than importing the old runtime.

## 3. Required full repository validation

The repository's three existing workflows are the release baseline; none should be removed, weakened or marked passing without execution:

| Workflow | Required coverage | Latest attempt in this handoff |
|---|---|---|
| `.github/workflows/community-release.yml` | Full community Python tests; Node 24 with locked dependencies; high-severity dependency audit; actual Chromium and WebKit; application tests with zero silent skips; Worker dry bundle | Pending observation |
| `.github/workflows/native-routing.yml` | Native routing, reservations, fallback and safe-installation tests; committed provider-profile parity | Pending observation |
| `.github/workflows/verify.yml` | Repository integration contracts; catalogue and reader layout; application/browser tests; dry bundle; fresh fictional demo; full local demo, PDF, D1, CRM and portability verification | Pending observation |

The documentation commit that first adds this file uses the existing main-push triggers. Any runs on that documentation-only commit validate the UNPATCHED application baseline, not the security package. Patched release validation must be rerun after source installation.

Minimum additional patched-candidate commands, using the repository's supported Node/Python versions and browser prerequisites:

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
- [ ] Complete the fresh demo and portable export/import check; inspect generated page/PDF and CRM evidence, rather than relying on compilation alone.
- [ ] Capture exact commit SHA, workflow run URLs, conclusions, test counts, dependency-audit and dry-bundle results.

## 4. Production handoff that repository CI cannot complete

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

### External controls and remaining exclusions

- [ ] Verify scoped Cloudflare credentials, Cloudflare/Google MFA, CRM-host access controls and edge rate limiting on public lead intake. Application counters alone do not prevent all distributed resource exhaustion.
- [ ] Verify agent host file/environment restrictions with synthetic probes; keep publishing credentials in a separate trusted operator context. Parsed settings do not prove enforcement.
- [ ] Move handoff passwords into a password manager; rotate/remove obsolete plaintext copies; encrypt exports and document retention/recovery.
- [ ] Update the client's privacy notice and retention schedule for Google Sheets and any separately enabled identity-attribution profiling.
- [ ] Decide separately on optional Turnstile, proactive owner-email security alerts and external monitoring. These are not claimed as delivered by the prepared patch.
- [ ] Inventory and upgrade existing deployed client copies separately. This work does not certify the legacy branded skill or every historical branch/deployment.

## 5. Operator completion record

Fill this in with evidence, not assumptions. Do not place passwords, tokens, customer records or private backup locations here.

- Source-install PR and commit: NOT INSTALLED
- Generated-example parity result: NOT VERIFIED ON COMPLETE PATCHED CHECKOUT
- Patched release workflow runs: NOT RUN
- Patched dependency audit and Worker bundle: NOT VERIFIED
- Migration/deployment identity: NOT DEPLOYED
- Google standalone-script version and non-secret key version: NOT VERIFIED
- Authorized synthetic create/delete evidence: NOT RUN
- External account/sharing/edge/backup controls: OPERATOR REVIEW REQUIRED
- Remaining accepted risks and approver: NOT RECORDED
- Final release approval/date: HOLD
