# Demo CRM and Tracking Code Audit

Date: 2026-09-21  
Scope: independent, read-only review of the Worker/backend, authentication, RBAC, attribution, data layer, GTM builder, account email, migrations, tests, and saved evidence. The project was not edited, deployed, opened in a browser, or allowed to call external endpoints. `.secrets` was not inspected.

## Executive verdict

The core CRM is unusually well defended for a demo. Server-side sessions, origin enforcement, body bounds, idempotent lead creation, optimistic lead updates, role checks, attribution allowlists, safe rendering, and durable webhook delivery are present and substantially tested. An independent non-browser run of six relevant suites passed 75/75 tests.

The audit found one code-derived account-workflow reliability risk, three lower-severity implementation or handoff defects, one scheduler/contract mismatch, and one access-policy risk that requires user confirmation rather than classification as a defect. The expected full UTM and click-ID capture is implemented but deliberately disabled in the current release. The parent live repro confirms that all 15 campaign values reached the page, then policy gating intentionally submitted empty touches with both consent flags false. GTM and account email are also unconfigured rather than broken. The current compact source UI is implemented, but it can only show Unknown while attribution remains disabled.

## Findings

### Policy/security risk for confirmation: Manager accounts can permanently erase CRM data and configure future PII delivery

`permissions()` grants `manage_settings` to every non-viewer at `src/team-accounts.js:7-9`, while `authorize()` returns immediately for every non-viewer at `src/team-accounts.js:10-16`. As a result, a manager can call all retention and permanent-erasure routes at `src/worker.js:88-99` and create, enable, or delete webhook destinations at `src/worker.js:117-124`. The UI exposes the same controls through `public/admin/app.js:553-566`, including permanent erasure and retention configuration implemented at `public/admin/data-lifecycle.js:9-40`.

This authority is consistent with the user-defined brief: managers have full access except adding users and resetting other people's passwords. It is therefore not a confirmed authorization defect. It remains a meaningful security-policy risk because a compromised manager can permanently remove records, enable automatic deletion of active enquiries, or direct future lead PII to a new external receiver. The test suite checks only that a manager may read webhooks at `tests/team-accounts.test.mjs:60-66`; it does not positively test the complete intended manager authority across webhook mutations, retention, erasure, or erasure-ledger export.

Confirm that this broad authority remains intentional, document it explicitly, and add route-level tests proving the intended manager access. If the policy later changes, split destructive lifecycle and data-egress powers into separate permissions.

### P2 code-derived reliability risk: Concurrent reset approval can send multiple valid-looking reset emails

`reviewReset()` reads a pending request at `src/team-accounts.js:134-136`, calls `sendAction()` before claiming that request at `src/team-accounts.js:137-138`, and only afterward conditionally changes its state at `src/team-accounts.js:139`. From code inspection, two administrators approving the same request concurrently could both observe `pending`, each insert an account action, and each send an email before either state update wins. Both links would look valid to the user, although the account-version check means only the first completed link could succeed.

This was not reproduced against live email and is not an authentication bypass. The existing test covers one sequential approval at `tests/team-accounts.test.mjs:112-124`; it does not race two approvals or assert one outbound message. Treat it as a P2 reliability risk until reproduced. The request should be atomically claimed before email dispatch, with a recoverable sending state and an idempotent retry path.

### P2: The live login page hardcodes an unresolved custom-domain destination

The parent evidence identifies the active base as the dedicated `workers.dev` URL at `/Users/mac/Documents/Codex/2026-09-17/co/outputs/beks-audit-evidence/observations.json:3`. The login page nevertheless hardcodes `https://go.netbean.com/` at `public/login.html:13`. The custom hosts are explicitly marked `pending-zone-setup` at `funnel.json:46`.

The missing DNS/zone ownership is a known external configuration blocker, not a code defect. The code defect is that a release intentionally usable on `workers.dev` links to that known-unavailable host without a same-origin fallback or runtime-derived public origin. A relative `/` link would work on the unified preview host; a configured public origin should be injected only after that host is live.

### P2: Failed or disallowed invitations leave an identity that admins cannot correct

`createUser()` inserts the invited user at `src/team-accounts.js:89-100` before `sendAction()` checks whether the recipient is in the free-plan allowlist at `src/team-accounts.js:70-74` or whether the provider accepts the email at `src/team-accounts.js:80-85`. On either failure the API returns an error, but the user row remains. Username and email are unique at `migrations/0006_team_accounts.sql:2-6`, and the API has no delete or email-correction operation for invited users.

The tests explicitly confirm the stranded row after an unverified-recipient failure at `tests/team-accounts.test.mjs:105-110`, but do not test how an administrator recovers from a typo. A later allowlist update permits resend to the same address, so this is not a provider-failure outage. It is an account-management defect when the address itself is wrong. Validate the recipient before insertion or add a safe pending-user correction/removal flow.

### P2: The documented GTM export command cannot run

`docs/TRACKING-SETUP.md:13-20` tells the operator to pass `--out`, while the builder accepts only `--output` at `scripts/build_gtm_container.py:136-151`. Following the documented activation path fails argument parsing before an export is created. No test references the builder or its CLI contract.

This is dormant in the current release because no real GTM or ad IDs exist and no export should have been generated. It becomes a release blocker as soon as tracking is legitimately configured. Add a builder test that generates to a temporary location, validates the JSON, and exercises the exact documented command.

### P3: The retry scheduler does not meet its own one-minute contract

The API contract requires a cron every minute for webhook retries and cleanup at `API-CONTRACT.md:98-100`, but `wrangler.jsonc:20-23` schedules `*/5 * * * *`. The outbox computes a one-minute first retry at `src/webhooks.js:111-114`, yet the cron can defer it until the next five-minute tick. Immediate post-lead processing still runs at `src/worker.js:68-73`, so lead acceptance is not affected.

Either change the schedule to the documented cadence or revise the retry/cleanup contract and tests to state the real five-minute granularity.

## Disabled or unconfigured, not defects

### Attribution and compact source

The capture implementation admits the complete declared set: nine UTM fields plus `gclid`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, and `ttclid` at `public/funnel.js:28-36` and `src/repository.js:5-6,49-60`. The Worker stores first and latest touch, exposes flattened values, and classifies traffic at `src/repository.js:63-69,79-100`. The lead board and table render a compact source label at `public/admin/app.js:85-101,267-275,296-308`; full details remain in the lead dialog at `public/admin/app.js:402-415`.

Current operation is intentionally different. `src/site-config.json:6-10,72` disables analytics, advertising customer data, consent UI, GTM, and attribution. `LeadFunnel` therefore makes `canAttribute()` false at `public/funnel.js:20-25`, returns empty touches at `public/funnel.js:90-99`, and the server independently discards unauthorized attribution at `src/security.js:73-79` and `src/repository.js:79-82`.

The parent repro supplies 15 campaign parameters but records HTTP 201 with `analytics_consent:false`, `attribution_consent:false`, and empty first/latest touches at `/Users/mac/Documents/Codex/2026-09-17/co/outputs/beks-audit-evidence/observations.json:643-676`. That is correct fail-closed behavior for the current policy, not a parser failure. It also means the expected live attribution/source behavior is not currently delivered. Enable `attribution_mode: lead` for first-party lead attribution without optional visit measurement, or configure the intended consent path before claiming live UTM/click capture.

### GTM and data layer

The client gates GTM on a real container ID, active measurement, explicit consent, and browser opt-out at `public/funnel.js:20-27`. Accepted receipts produce deduplicated `customer_data_ready` and `lead_accepted` events at `public/funnel.js:101-126`. Client tests cover hashing, event order, deduplication, consent withdrawal, and blocked storage at `tests/client.test.mjs:97-256`.

The release has no GTM ID and no generated import, as stated at `docs/TRACKING-SETUP.md:3-7`. This is unconfigured by design. Existing tests prove local JavaScript behavior with synthetic IDs; they do not prove a real GTM import, provider destination, consent platform, or ad conversion.

### Account email

Invitation, owner verification, administrator-approved reset, hashed single-use tokens, expiry, version checks, and session revocation are implemented at `src/team-accounts.js:43-185`. The current `wrangler.jsonc` has no `send_email` binding or email variables, and the strategy explicitly records email as unconfigured at `build/strategy-brief.md:80-84`. The UI disables send actions when the binding is unavailable at `public/admin/users.js:60-69`.

The independent tests use a local D1 mail sink at `tests/team-accounts.test.mjs:34-49`; they do not establish real provider delivery. This is an honest configuration gap, subject to the invitation recovery and approval-race defects above.

### Free Cloudflare and custom domains

The checked configuration uses one Worker, static assets, D1, and cron, with no paid add-on binding at `wrangler.jsonc:1-31`. The static free-plan guard passed independently and rejects unreviewed paid services at `scripts/free-plan.mjs:1-20`. That supports architectural compatibility with the intended free-only setup, but it is not an independent billing or quota guarantee.

Saved evidence reports a dedicated `workers.dev` Worker/D1 deployment while custom domains remain blocked by external zone ownership at `build/BUILD-STATUS.md:3-19`. No live Cloudflare query was made in this audit. The unresolved custom domains are configuration state; the broken login back-link on the current host is the separate code finding above.

## Authentication and RBAC confirmation

- Unsafe API methods require an exact same-origin `Origin` and reject cross-site Fetch Metadata at `src/worker.js:37` and `src/security.js:45-49`.
- Sessions use random 256-bit tokens, store only a keyed hash, expire after 12 hours, and bind to account credential versions at `src/security.js:95-113` and `src/team-accounts.js:43-63`.
- Production cookies are host-only, HttpOnly, SameSite=Strict, and Secure at `src/security.js:95-101`.
- Viewer access is read-only and excludes export/settings; user management is admin-only at `src/team-accounts.js:7-17`. Role changes and disabling revoke sessions at `src/team-accounts.js:103-111`.
- Admin UI text is rendered through `textContent`/DOM construction rather than untrusted HTML, including attribution and form details at `public/admin/app.js:23-27,385-415`.

These controls passed the independent local Worker tests. Manager authorization breadth matches the stated brief but remains a high-impact policy choice that should be confirmed and tested explicitly.

## Tests and evidence

Independent command, run without browser suites:

```text
node --test tests/backend.test.mjs tests/team-accounts.test.mjs tests/client.test.mjs tests/traffic.test.mjs tests/free-plan.test.mjs tests/host-routing.test.mjs
```

Result: 75 passed, 0 failed, 0 cancelled, 0 skipped. The first restricted-sandbox attempt could not bind loopback and was not counted; the same command then passed with local-process permission. No external endpoint was contacted.

The saved full-suite claim is 19 files and 224/224 passes at `build/sequential-test-results.json:1-31`. This audit did not rerun browser-dependent files because browsers were expressly out of scope. The earlier `docs/QA-REPORT.md:13` claim of 18 files and 220/220 tests is stale, as are its pending/no-deployment statements at `docs/QA-REPORT.md:14-19`; later build evidence reports completion and a dedicated `workers.dev` release. Treat the timestamped build/release evidence as later state, not the QA report.

One evidence-label caveat matters: `verifyCorrelation()` calls its negative disabled-policy assertion `measured_visit` and `linked_conversion` at `scripts/live-verify.mjs:65-71`. Thus a saved check named `measured_visit: pass` can mean that no visit existed, which is exactly the expected disabled-policy result. It must not be cited as proof that analytics ran.

Missing tests directly tied to findings:

1. Concurrent approval of one reset request must produce one action and one email.
2. Manager access tests must positively cover the brief's intended webhook, retention, erasure, and ledger authority, while continuing to deny user creation and resets for other people.
3. A rejected or mistyped invitation must be removable or correctable without direct D1 access.
4. The exact documented GTM builder command must produce and validate an import.
5. Scheduler configuration must be checked against the outbox retry contract.
6. Login navigation must remain usable on the actual release host while custom DNS is pending.

The parent CRM screenshot captured the leads view during a transient loading state. Investigation is ongoing, so this audit does not classify it as a confirmed UI defect or use it to infer failed lead rendering.

## Evidence boundary

The directory is not a Git repository, so commit provenance and a change diff were unavailable. Current core source, tests, migrations, configuration, and tracking docs match the frozen release package; the only directory-level differences observed were additional public asset folders. Existing deployment and browser artifacts were read as claims, not recreated. No real email, GTM event, webhook, ad conversion, DNS route, or custom-domain behavior was independently exercised.
