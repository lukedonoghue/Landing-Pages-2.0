# Beks Backend Fix Verification

Date: 2026-09-21  
Scope: targeted remediation of the reviewed community CRM backend and its reusable Cloudflare source. No deployment, commit, browser session, secret read, external email, or external network delivery was performed.

## Outcome

The bounded account, login-link, scheduler-contract, and reusable host-routing findings were fixed in both:

- Current project: `/Users/mac/Documents/Codex/2026-09-17/co/work/community-run-20260921-us-r1/project`
- Reusable community source: `/Users/mac/Documents/Codex/2026-09-17/co/work/Landing-Pages-2.0/skills/community-landing-page-builder/assets/cloudflare`

The manager policy remains unchanged: managers retain operational access, including settings, webhook, retention, erasure, and export surfaces, but cannot administer users or approve resets through user-management routes. Added route-level checks prove that intended boundary.

## Implemented fixes

### Atomic reset approval and bounded recovery

- Added migration `0007_account_delivery_recovery.sql` with reset delivery state, a unique claim token, a 90-second claim lease, attempt accounting, reset/action correlation, and one-live-action enforcement.
- Approval now atomically claims a pending request before creating an action or entering the mail provider.
- A concurrent approval receives `409` while the first send is in progress and cannot create an action or message.
- Provider/configuration failures return the request to retryable `failed` delivery state and clear the lease.
- A stale claim can be reclaimed after its bounded lease.
- The post-provider `sending` to `ready` transition is conditional on the reset request still being pending and owned by the same claim token. A delayed sender whose lease was reclaimed can finish provider delivery, but its database action is left failed and its token cannot be used.
- A ready action from an interrupted post-send finalization is reconciled without sending again.
- An expired or abandoned action is failed before a replacement is issued.
- Existing account version checks, single-use token claims, session revocation, and self-approval denial are preserved.

### Invitation recovery

- The verified-recipient restriction is checked before inserting a new invited identity, so a disallowed address leaves no user row.
- A provider-rejected invitation remains inactive and can be retried.
- Administrators can correct the email only for a never-activated invited user. The corrected address must be in the verified-recipient allowlist, conflicts are rejected, the credential version advances, and prior unused actions are invalidated.
- The correction update compares the previously read credential version and requires the row still to be invited, unverified, and without a password. A concurrent activation makes the correction return `409`; session cleanup and audit insertion occur only after a successful compare.
- The existing Users panel exposes the bounded correction through the existing PATCH route; active, verified, owner, and self identities remain protected.

### Login return and scheduler contract

- The login return link is now `/index.html`. It serves the landing page on a unified `workers.dev` host and is redirected by the existing dual-host Worker to the configured public host when custom domains are active.
- `API-CONTRACT.md` now states the configured five-minute cron behavior: jobs become eligible according to backoff, then execute on the next five-minute tick.

### Reusable host-routing drift

- Ported the reviewed `requestHostRole` / `routeHostSurface` implementation from the current project into the reusable community Cloudflare source.
- Added neutral empty `publicHost` and `crmHost` template fields; no Bookkeeping by Beks or `netbean.com` values were copied into the reusable source.
- Added generic host-routing tests using `go.example.com` and `crm.example.com` fixtures.
- Coordinated parent-owned `sync-config` work is present and tested: it maps `requested_hosts.public` and `.crm`, validates hostnames, and requires distinct both-or-neither configuration. This task did not edit that parent-owned file.
- This was reusable-source drift, not an attribution cause. `public/funnel.js` and `src/repository.js` remain identical between current and reusable copies (SHA-1 `a193bce2...` and `66ae4f24...`) and were not edited.

## Files changed by this remediation

Both copies:

- `src/team-accounts.js`
- `migrations/0007_account_delivery_recovery.sql`
- `public/admin/users.js`
- `public/login.html`
- `API-CONTRACT.md`
- `tests/team-accounts.test.mjs`
- `tests/team-accounts-ui.test.mjs`
- `tests/runtime-contract.test.mjs`

Reusable source additionally:

- `src/worker.js`
- `src/site-config.json` (neutral host keys only)
- `tests/host-routing.test.mjs`

Current project additionally:

- `tests/host-routing.test.mjs`

No branded-lead-funnel-builder source, frozen snapshot, landing-page index/styles/copy, tracking configuration, funnel/repository attribution logic, secrets, or deployment state was changed.

## Regression evidence

The reset concurrency regression uses a local D1 mail sink and a deterministic gate. It pauses the first provider call after the database claim, dispatches a second approval, then releases the first call. The immediate-race result is one `200`, one `409`, one ready account action, and one stored mail message. Under the audited pre-fix read-before-send ordering, both requests could enter the provider before either request state changed and the regression would observe two accepted messages.

A second reclaim regression expires the first claim while its sender is still paused, completes a replacement approval, and then lets the original sender finish. Two provider deliveries are intentionally possible at this at-least-once boundary, but the delayed original returns `409`, its action remains failed, and its token returns `400`; exactly one replacement action is ready and its token completes successfully.

The invitation correction race pauses the PATCH after its initial identity read, completes the invitation, and establishes a session before resuming the PATCH. The stale correction returns `409`, preserves the activated email/manager role/session, and creates no correction audit event.

Additional regressions prove:

- provider failure leaves a retryable pending reset with no claim;
- retry succeeds after provider recovery;
- an already-ready action finalizes without another message;
- an expired ready action is replaced safely;
- a reclaimed slow sender cannot ready or complete its stale token;
- an unallowlisted invitation creates no identity;
- a failed invited identity can be corrected and resent;
- invitation activation wins over a stale email correction with no session or audit side effects;
- managers retain operational APIs but remain denied user management;
- `/index.html` works for unified and separate hosts;
- the contract and selected `*/5 * * * *` scheduler agree.

## Test results

Bundled Node used: `/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

- Current changed-surface suites: 16 passed, 0 failed.
- Reusable changed-surface suites: 16 passed, 0 failed.
- Current verification-tools suite: 20 passed, 0 failed.
- Reusable verification-tools suite: 20 passed, 0 failed.
- Current free-plan suite: 3 passed, 0 failed.
- Reusable free-plan suite: 3 passed, 0 failed.
- Syntax checks passed for both account modules, both Users modules, and the reusable Worker.
- All migrations, including `0007`, were applied to local Miniflare D1 by each team-account suite.

The Miniflare/loopback suites required local-process permission; restricted runs could not bind `127.0.0.1`. All reported passing runs were local and used controlled fixtures only.

The broader unchanged `tests/backend.test.mjs` run passed 24/25. Its persistent failure is at line 260 in the traffic-cohort test: an earlier retained test lead has a Google click ID, so the later assertion expecting zero Google leads observes one. No account, host-routing, scheduler, login-link, funnel, or repository change causes that existing cross-test state. It was not edited under this bounded scope.

`tests/team-accounts-ui.test.mjs` was not executed because the request prohibited starting browsers. Its modified module passed Node syntax checks; browser UI verification remains intentionally outstanding.

## Real email and release blockers

- The current `wrangler.jsonc` has no `send_email` binding and no `CRM_EMAIL_FROM`, `CRM_PUBLIC_ORIGIN`, or `CRM_VERIFIED_RECIPIENTS` variables. Real invitation/reset delivery remains unconfigured.
- Cloudflare Email Routing must have a verified sender and every allowed recipient must be present in the restricted destination configuration and CRM allowlist.
- `CRM_PUBLIC_ORIGIN` must be HTTPS and exactly match the request origin used for CRM account actions. Use the dedicated `workers.dev` origin while unified there, or the CRM custom host only after that domain is live.
- Custom domains remain external DNS/zone configuration work. No deployment or live DNS/email verification was attempted.
- Migration `0007_account_delivery_recovery.sql` must be applied before deploying the updated account code.

The audit's separate GTM `--out` versus `--output` documentation finding was outside the exclusive write scope and was not changed here.
