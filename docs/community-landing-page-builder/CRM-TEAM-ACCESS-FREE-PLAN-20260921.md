# CRM Team Access and Free-Plan Update

## User request and scope

The user requested Admin, Manager and View-only roles, adding users and approving password resets inside CRM, and confirmation emails to registered addresses. The user then confirmed that all skill infrastructure must remain within Cloudflare Free; paid configurations may be considered only on a later explicit request. The site remains on workers.dev. No billing, DNS or account-tier change is authorized by this implementation.

Current live credentials remain username `test-demo-operator` and the separately handed-off private password. This feature update must preserve that owner identity, password and all stored leads. Credentials never enter Git. Luke's original skill and README remain untouched; only the community fork is modified.

## Implementation

- Additive migration 0006 creates team users, owner-email profile, one-time account actions, pending reset requests and access audit records, and adds a nullable user ID to sessions. Existing owner sessions remain compatible.
- Admin manages identities and approval decisions. Manager can operate CRM but cannot administer users or other users' recovery. View-only is blocked from mutations, exports and integration settings by the Worker, not merely hidden controls.
- Every role can change its own password with current-password confirmation and revoke its own sessions. Role/status/password changes invalidate the affected account's sessions. The protected original owner cannot be demoted/disabled; current-owner CLI recovery remains available.
- Invitations do not activate accounts until the registered recipient confirms and sets a password. Public reset requests have an enumeration-resistant acknowledgement; an administrator approves before an email link is issued. The approval uses the stored registered email, not a caller-supplied replacement.
- Account links use fragments and keyed token hashes. D1 transactional consumption protects expiry, account version, single use, disabled-account restrictions and session revocation. No password or raw token is returned to another administrator.
- Native Cloudflare EMAIL binding avoids a third-party API-key prerequisite. Runtime recipient restrictions and matching deployment binding restrictions prevent unrestricted sending. A provider acceptance is not claimed as verified inbox delivery.

## Cloudflare Free boundary

Cloudflare Free can send to Cloudflare-verified destination addresses. Each teammate needs that provider verification before invitation/reset mail can be sent. The sender still needs an owned onboarded domain even though the website is on workers.dev. There is no honest configuration that removes these platform prerequisites while promising arbitrary-recipient free sending.

The reusable skill guides recipient verification and retains invitations as inactive when not ready. It does not enable Workers Paid, use a private shared sender/API key, buy a domain or alter the account plan. The user has not yet supplied the real administrator email or authorized sender domain. Real delivery cannot be marked tested until setup and actual inbox confirmation occur.

Official references: https://developers.cloudflare.com/email-service/platform/pricing/ , https://developers.cloudflare.com/email-service/configuration/send-bindings/ , https://developers.cloudflare.com/email-service/api/send-emails/workers-api/ . Workers/D1 also have free quotas; deployment success does not independently verify the account's billing tier. No zero-billing claim is made for a shared account already subscribed to paid products.

## Verification checkpoint

- Initial focused Worker/backend/account regression: 45 passed, zero skips/failures.
- Updated team suite with explicit free-recipient rejection: 9 passed.
- Free-only deployment-configuration checks: 3 passed.
- Full regression caught UI fixture servers not yet serving the added Users module. These failures are real integration failures, not successful acceptance. The UI owner is updating fixture routes and role/session data, then rerunning existing assertions and new role tests.
- Current status at this checkpoint: canonical source implementation and UI verification in progress. New role/email feature is NOT yet a verified live deployment. The prior single-owner CRM release remains the last verified live version.

## Remaining work

Finish UI role/confirmation tests and inspect desktop/mobile screenshots. Rerun the full regression after all writers finish. Integrate reviewed files into the generated Clarentis project, preserving client configuration and credentials. Apply additive migration and publish only through the reviewed release workflow, with exact new revision evidence. Verify live original-owner access and server permissions without seeding weak shared credentials. Real invite/reset delivery remains pending authorized sender/recipient setup, not a reason to silently activate accounts or upgrade billing.

## Subsequent checkpoint, 2026-09-21

- User confirmed the connected account is Workers Free. API billing inspection was forbidden (403); the user confirmation is the source of the plan assertion. No account plan changed.
- Sol completed 18 focused role/UI tests and one desktop/mobile screenshot capture test. Its visual review noted that the mobile People table needs horizontal scrolling without an obvious cue. Screenshots are local in outputs/crm-team-access. Parent visual inspection remains pending.
- Canonical Python regression passed 82 tests. The final full Node regression passed 214 of 217 tests. Three data-lifecycle browser tests fail because their broad login submit selector now matches both Sign in and Request reset. This is a red regression suite, not full acceptance. Report: work/crm-team-final-regression.tap in the orchestration workspace.
- New roles and email features remain canonical-source-only, not integrated or deployed. Live remains the single-owner release. Email delivery has not been tested against a real inbox and sender/recipient prerequisites remain unresolved.
- Model accounting: Sol extra-high handled page build and recent CRM UI/browser tests; Astra handled backend role implementation and integration review. User now requires remaining implementation/testing/deployment on Sol, with Astra orchestrating/reviewing.
- New priority: user reports all attribution missing on a live test. Attribution acceptance is reopened. Sol is tracing URL capture, privacy policy, POST payload, Worker persistence and CRM rendering. Exact user URL and submission identifier requested, not yet provided. Do not claim prior synthetic passes resolve this report.
