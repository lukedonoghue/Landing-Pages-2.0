# Landing Pages 2.0 — final local security review

Review date: 23 September 2026 (Europe/Warsaw).
Repository: `lukedonoghue/Landing-Pages-2.0`.
Pinned main: `76285ea8408556cacb4d94d5db9f66000cf452e6`.

## Actual status

The remediation and follow-up fixes are implemented locally, not installed in GitHub and not deployed. The connected repository reports push/admin permission. Creation of `security/final-hardening-review` succeeded. A direct `GitHub.create_tree` call containing ordinary, unencoded source was blocked with: “This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.” No source tree, commit or pull request was created. Main and the new branch remain at the pinned commit. The blocked request was not rerouted through encoded transport or a CI bootstrap.

This package replaces the earlier security package; apply only the final patch, not both. It includes the earlier 80-file remediation plus this review's additional source/test changes. The generated example must be rebuilt from the complete repository, not copied from an old example branch or this incomplete source snapshot.

## Scope and limits

The review follows the maintained community workflow through generated agent configuration, project scaffolding/routing, publish prerequisites and verification, CRM authentication/permissions, sensitive UI actions, lead admission, outbound delivery, Google Sheets deletion and backup recovery. It is a sequential self-review with executable local regression checks, not an independent penetration test or a claim that every repository file has been audited.

The working source snapshot matches the pinned main source, but omits the bundled font binaries and the full legacy/client-example trees. No live CRM, Cloudflare account configuration, Google account or real customer dataset was inspected or changed. No live synthetic lead was sent. Changes to external sharing, MFA, Access/WAF and production secrets require the operator's authorized deployment flow.

## Additional findings corrected in this review

### R1 — Rejected callers could consume shared admission budgets

The earlier global counters ran before per-IP rejection. Repeated calls from an already-blocked IP could consume the entire site's allowance. The revised public limiter checks whether global buckets are already exhausted, admits the IP, and only then consumes global capacity. Once global capacity is exhausted, rotating IPs do not allocate new per-IP buckets. Login and reset-request paths use the same ordering. Tests cover both failure patterns. This is bounded application protection, not a substitute for edge filtering or a guarantee of D1 availability under a distributed attack.

Files: `src/security.js`, `src/worker.js`, `tests/security-hardening.test.mjs`.

### R2 — Human password entry could trigger the network deadline

The lifecycle UI's previous timeout surrounded the complete request, including password entry. A user could enter the right password after the deadline and still receive a failed action. Timeout handling now surrounds each fetch attempt, not the human prompt. Cancellation does not retry, cross-origin requests fail before fetching, caller aborts are retained, and password fields are cleared. Four dependency-free DOM-mock tests cover those cases; they are not a replacement for browser integration tests.

Files: `public/admin/secure-fetch.js`, `public/admin/data-lifecycle.js`, `tests/secure-fetch.test.mjs`.

### R3 — Later downstream deletion jobs could start with old leases

Sequential Sheets jobs previously shared a timestamp captured before the batch. Earlier slow deliveries could leave later claims with stale leases. Each job now obtains a fresh claim time, renews its own unexpired claim immediately before dispatch and fences the success update on its claim and sending state. Retry scheduling uses the current completion time. A simulated-clock regression advances time across three sequential deliveries.

Files: `src/webhooks.js`, `tests/security-hardening.test.mjs`.

### R4 — A field named “service” could bypass free-text minimisation

A string was previously trusted merely because the field was named service. Service now crosses the minimal Sheets boundary only when declared as a select/radio field and equal to a configured option. Undeclared, text, textarea and unlisted values are excluded. Sensitive-category filtering remains in place.

Files: `src/sheets-protocol.js`, `tests/security-hardening.test.mjs`.

### R5 — Restoring a database could resurrect account links or resume obsolete deletion jobs

Local backup reconciliation now invalidates unused account-action links and pauses restored downstream deletion jobs, clearing their leases. It checks for optional tables so older backups remain supported. Documentation explicitly distinguishes CRM suppression records from the complete Sheets receipt/deletion history: the operator must reconcile current downstream state before resuming anything. A real SQLite migration/reconciliation test exercises the restored rows.

Files: `scripts/erasure-backup.mjs`, `scripts/backup.mjs`, `tests/security-hardening.test.mjs`.

### R6 — Path restrictions did not close inherited environment credentials

Generated and root Codex policies now restrict environment inheritance and exclude relevant credential variables, in addition to existing file/sandbox restrictions. Claude's environment deny list also covers the administrator password hash. Four Python tests parse and compare generated/root policy files. Parsing is not proof that a particular installed host enforces the restrictions: use a synthetic denied-path/environment probe, a credential-free agent process and a separate trusted operator context.

Files: `.codex/config.toml`, `.claude/settings.json`, `scripts/agent_security.py`, `tests/test_agent_security.py` (skill-relative scripts/tests).

### R7 — Generated example advertised tests it did not contain

The example generator now copies the test directory alongside the maintained runtime. The example parity check passes against this source snapshot. Because the snapshot lacks the repository's exact font assets, no generated example tree is distributed in this patch. Regenerate it from the complete checkout and commit that generated output with the source changes.

File: repository-root `scripts/sync_crm_example.py`.

### R8 — A double-slash security probe was interpreted as a new hostname

The publishing verifier treated the intended `//admin/index.html` same-host probe as a protocol-relative URL. That caused its own origin guard to stop legitimate verification. Hardcoded security probes now set the pathname on the existing target URL. The general same-origin restriction and cross-origin redirect rejection are unchanged. Tests verify the raw paths are requested and an exposed alias is detected.

Files: `scripts/live-verify.mjs`, `tests/verification-tools.test.mjs`. Six focused verifier checks pass.

### R9 — User controls and browser fixtures still described the old authority model

The Users screen no longer offers non-owner administrators a role-escalation option or edits to another administrator's access. Manual privileged resets are withheld with the verified-email/operator-recovery explanation, including reset-request review. Ordinary-manager editing remains available without export or data-administration controls. Three executable pure-policy tests cover the controls. Existing browser fixtures now use the real permissions; lifecycle browser tests explicitly complete each current-password prompt rather than bypassing reauthentication. Those browser integration tests were edited and syntax-checked, but could not execute in this environment.

Files: `public/admin/users.js`, `src/team-accounts.js`, `tests/user-permissions.test.mjs`, `tests/team-accounts-ui.test.mjs`, `tests/crm-ui-behavior.test.mjs`, `tests/data-lifecycle.test.mjs`.

## Verification evidence

| Check | Observed result | Qualification |
|---|---|---|
| Security, password-prompt and Users display-policy regressions | 31 passed; zero failures/skips | Production modules, local SQLite adapter, Apps Script mocks and DOM mocks; not workerd/browser execution |
| Focused publish-verifier regressions | 6 passed; zero failures/skips | Local HTTP fixtures, no live site |
| Focused Python workflow/routing/review/security tests | 122 passed; zero failures/errors/skips | Includes 69 native-routing and 4 agent-policy tests; do not add those counts again |
| Full available Node test command | 142 reported: 117 passed, 25 failed, zero skipped | Not a green release suite; dependency-load failures collapse entire unexecuted files into single failures |
| Full Python discovery | Attempted; stopped at the 120-second execution limit | Incomplete output with failures/errors; no final total or passing claim |
| JavaScript and Apps Script syntax | 80 files parsed | Includes edited browser test source, not browser execution |
| Python syntax | 68 files parsed | Codex TOML also parsed |
| Example parity | Passed for the provided source snapshot | Regenerate against the full checkout with its real fonts before release |

The 25 Node failures comprise 20 test-file import failures plus one dynamic browser import failure caused by missing locked packages, and four expectations reached after the unsupported Node version guard fired. Node here is 22.16.0; the project requires >=22.19 and its normal CI uses Node 24. No lockfile or runtime guard was weakened to obtain a pass. The isolated verifier defect found by the broader run was fixed and rechecked.

Dependency installation could not be completed because container DNS/network access is unavailable. The Python discovery snapshot also lacks exact bundled font files; those assets were not substituted. The available browser attempt failed on loopback navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`; no screenshots or browser pass are claimed, and the restriction was not bypassed. The synthetic local server was stopped.

Final logs are included in `verification/`. The targeted counts overlap with the broader Node run and must not be summed into an invented overall total. A clean-copy patch application and regression rerun are recorded separately in `verification/clean-copy-verification.json`.

## Release work still required

1. Apply the final patch to a clean complete checkout at the pinned commit (or reconcile newer work first). Regenerate and check the example. Review all modified and new files before committing.
2. Run the complete Python, locked-dependency Node, Miniflare/workerd and Chromium/WebKit suites on the supported runtime; run the existing release/native-routing/demo CI workflows and dependency audit. Resolve any real failures before merge.
3. Review migration 0011: it signs users out, invalidates unused reset links and disables legacy URL-token Sheets connections. Manager permissions and current-password prompts change immediately after application/deployment.
4. Use the authorized operator flow for Worker secrets, migration and deployment. Deploy the standalone Apps Script and reconcile historical full-JSON Sheet copies and downstream deletion state before enabling the connection.
5. Verify MFA, named-account sharing, edge rate limiting/Access rules, backup retention, actual host sandbox enforcement and an authorized synthetic CRM-to-Sheets create/delete journey. No repository patch can certify those external controls.

CRM erasure completion is not proof that every spreadsheet/export/backup copy is erased. Optional Turnstile, proactive owner-email alerts and external monitoring remain outside this implementation. The legacy branded skill and older deployed client copies have not been upgraded by this local work.
