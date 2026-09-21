# Clarentis Medium Backend Audit

Read-only focused audit completed at `2026-09-21T21:15:51Z`.

Scope roots:

- `P`: `/Users/mac/Documents/Codex/2026-09-17/co/work/independent-comparison-20260921/clarentis-medium/project`
- `S`: `/Users/mac/Documents/Codex/2026-09-17/co/work/independent-comparison-20260921/clarentis-medium/community-landing-page-builder`

## Verdict

The deployed Worker/D1 release, shared backend reuse, live owner authentication, and first-party CRM attribution are supported by substantive evidence. The requested GTM import and email delivery are honestly blocked by missing owner-controlled inputs and are not active.

Three bounded defects remain in the build/handoff evidence:

1. A fresh independent acceptance pass is not evidenced.
2. The current database is clean, but the claimed cleanup is not preserved in the release evidence and is overstated as part of the verified release.
3. The email blocker is valid, but its owner steps are too generic for the frozen Cloudflare Free workflow.

## Findings

### F1 - Independent acceptance did not occur, or at least is not auditable (medium)

The frozen acceptance contract requires a separate reviewer when available; otherwise it requires an explicitly disclosed self-review. It also requires reviewer provenance, concrete findings, fixes/retests, limits, and a final status (`S/references/quality-gates.md:157-175`).

The copy acceptance explicitly identifies itself as `self_review` by `Codex GPT-5.6` (`P/build/copy-editorial-review.json:6-8`). The visual report names only `Codex GPT-5.6` as both tool and reviewer and contains no independent/self-review mode, separate task or reviewer identifier, isolation statement, received findings, or retest trail (`P/build/visual-review.json:2-6`). No other scoped build artifact records a separate reviewer invocation. Therefore the page may have been freshly re-read, but the asserted independent acceptance is not established and should be treated as self-review.

Small shared fix: require the acceptance artifact schema to include `review_mode: independent|self_review`, reviewer/task provenance, reviewed source fingerprint, findings, and retest disposition. Reject `independent` when the reviewer identity is only the builder identity string.

### F2 - Cleanup state is clean now, but release evidence contradicts the handoff claim (medium)

The sealed live journey was configured with `cleanup_test_lead: false` (`P/build/releases/095b4c49-1e23-419d-b05f-22d7c949e0a2/package/build/live/001/attempt.json:4-18`). Its final report says `cleanup: retained-synthetic-contact`, `leads: 1`, and `historical_metrics_retain_test: true` (`P/build/releases/095b4c49-1e23-419d-b05f-22d7c949e0a2/package/build/live/001/result.json:467-516`). The release verification nevertheless legitimately records the journey as `pass_with_warnings`, not as cleaned (`P/build/releases/095b4c49-1e23-419d-b05f-22d7c949e0a2/verification.json:19-37`).

Later mutable summaries say the test contact was permanently removed and report zero active leads/users (`P/build/owner-handoff.json:2-4`; `P/build/crm-status.json:7-17`), but there is no post-cleanup evidence artifact tied to the release, lead ID, operation, timestamp, and resulting counts.

Auditor read-only D1 query at `2026-09-21T21:13Z` confirmed the current state: `total_leads=0`, `seeded_team_users=0`, owner `email/pending_email/email_verified_at=null`, `erased_submissions=0`, and no `erasure_operations` rows. Thus no test data remains, but the method and time of cleanup are unproven and the phrase "permanently removed" is stronger than the retained release evidence.

This is an evidence/provenance defect, not a residual-data defect. The owner explicitly authorized synthetic submissions with cleanup; the frozen publishing workflow also expects retained cleanup proof (`S/references/guided-publishing.md:92-99`).

Small shared fix: run the guarded live journey with cleanup enabled when authorized, or emit a signed/hash-linked `post-cleanup.json` recording release/version/database/lead IDs, cleanup method, before/after counts, and read-back result. Handoff generation should refuse a cleanup claim unless that artifact exists.

### F3 - Email is correctly blocked, but owner handoff steps are incomplete (low)

Missing owner inputs are real, not a code defect. The deployed binding list has D1/assets/version metadata and application secrets but no `EMAIL` binding or email variables (`P/.secrets/release-095b4c49-1e23-419d-b05f-22d7c949e0a2-upload.log:53-63`). The current D1 owner profile has no registered or verified email. Source correctly reports email ready only when the native send binding, sender, exact origin, and verified-recipient allowlist are all present (`P/src/team-accounts.js:23-34`). The owner handoff also says no email was sent (`P/build/owner-handoff.json:21-30`).

The defect is the handoff wording. It tells the owner only to choose an inbox and an "authorized transactional sender/domain," then authorize a test. The frozen workflow requires Cloudflare Free-specific steps: inspect/onboard the sender domain without disturbing mail DNS, verify the destination address in Cloudflare, add the restricted native `EMAIL` binding and variables, then register and confirm the owner email inside CRM (`S/references/team-access.md:27-47`). It explicitly says an unconfigured-email warning alone is not a complete handoff (`S/references/team-access.md:29-43`).

Small shared fix: generate the Cloudflare Email Service sender-domain, Destination Addresses, restricted binding, CRM owner-email confirmation, sole-admin limitation, and observed-success steps from the frozen handoff template. Keep the mailbox and owned sender domain as owner inputs; do not imply an arbitrary external provider or paid fallback.

## Verified Passes And Blockers

### Shared backend and attribution - pass

- The frozen verifier defines the maintained comparison set and its code-identity limitation (`S/scripts/verify_backend_reuse.py:8-22`), as required by `S/references/cloudflare-crm.md:3-7`.
- Running it against `P` produced `pass`, with all 34 shared source/migration/UI files matching the frozen sibling and zero mismatches. This comparison did not use a current monitored skill version.
- The live release tied account, Worker, D1 database, release ID, source fingerprint, and one 100% active version together (`P/build/releases/095b4c49-1e23-419d-b05f-22d7c949e0a2/state.json:59-77`).
- The live receipt equals the D1-backed stored receipt (`P/build/releases/095b4c49-1e23-419d-b05f-22d7c949e0a2/package/build/live/001/runs/001/stored-receipt.json:1-8`). First-party attribution was unmeasured by policy but preserved all 16 supported first/latest campaign fields; the event trace records matching browser/stored Google paid desktop dimensions and 16 verified fields (`.../runs/001/event-trace.json:1-25`; detailed named checks are in `.../live/001/crm.json:126-379`). This satisfies the positive stored-field requirement in `S/references/lead-and-tracking-contract.md:33-35`.

### GTM import - blocked by missing owner inputs, not falsely completed

- No GTM import artifact exists under `P/build`; `container_import_generated` and enhanced conversions are both `false` (`P/build/tracking-status.json:8-20`). `funnel.json` likewise has empty GTM/Ads IDs and disabled customer data (`P/funnel.json:101-123`).
- This is consistent with the owner request not to invent missing IDs and with the frozen import contract requiring real GTM ID, Ads ID, label, hostname/policy, import, and destination verification (`S/references/advertising-tracking.md:34-85`). The full-build tracking module remains blocked, so the overall result is correctly `action_required`, not fully complete.
- Support code is present and identical to the frozen builder. It validates IDs and raw-contact keys, emits the Google tag, Conversion Linker, receipt transaction ID, ordered `customer_data_ready`/`lead_accepted` triggers, and browser-hashed user data (`P/scripts/build_gtm_container.py:50-91,118-150`; `P/public/funnel.js:111-124`). Four frozen GTM builder tests passed; the current client tests also passed the hash/order/consent cases (`P/tests/client.test.mjs:101-143`). This proves local artifact-generation support only, not a real GTM/Ads destination.

### CRM roles, auth, and email status - implementation pass with live-scope limits

- Roles are enforced server-side: only Admin manages users; View-only is restricted to reads and own-account actions (`P/src/team-accounts.js:5-16`). Login requires a named identity, verified active team account, password verification, D1-backed session insertion, and session rotation (`P/src/team-accounts.js:46-65`).
- Live evidence covers anonymous admin rejection, named owner login, lead update/note, and logout revocation (`P/build/crm-status.json:7-17`; detailed journey assertions at `.../live/001/result.json:470-480`). No live team accounts were left behind. Admin/Manager/View-only behavior is therefore source plus isolated regression evidence, not a live multi-user test.
- Focused audit rerun with the required bundled Node completed `102/102` tests, including backend, client attribution/GTM, account recovery, release, and team-role suites. The frozen GTM builder completed `4/4` tests. The retained pre-publish regression log records `245/245` passing tests (`P/build/full-regression-publish.tap`, final 28 lines).
- Email-dependent invitations and resets are unavailable as expected. The current supported recovery is Cloudflare-owner-assisted, not self-service email recovery (`P/build/crm-status.json:16-17`), matching `S/references/admin-access-and-recovery.md:14-18`.

## Uncertainty

- The read-only D1 query proves current database counts, not who performed cleanup or the exact cleanup command.
- The release evidence proves the recorded Worker version at publication time; this audit did not mutate the deployment or submit another live lead.
- No provider-side GTM import, Preview session, Google Ads diagnostic, sender-domain verification, recipient verification, or inbox delivery exists because the necessary owner-controlled inputs were not supplied.
- Visual/editorial/PDF quality was intentionally left to the parent audit; only acceptance provenance was checked here.
