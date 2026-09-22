# CRM team access

Load this only for the optional CRM module, not a page-only build. Keep business-owner setup guided; never ship a community author's credentials or email keys.

## Roles

| Capability | Admin | Manager | View-only |
| --- | --- | --- | --- |
| Read leads, submission details and reports | Yes | Yes | Yes |
| Edit stages/notes, remove leads, export contacts | Yes | Yes | No |
| Manage operational settings and integrations | Yes | Yes | No |
| Invite users, change roles, disable accounts | Yes | No | No |
| Approve or initiate another user's password reset | Yes | No | No |
| Change own password with current password | Yes | Yes | Yes |
| Revoke own sessions | Yes | Yes | Yes |

The original owner remains an Admin and cannot be demoted/disabled. Additional administrators cannot change their own role/status. The backend checks current account state for every protected request; UI hiding is not authorization. Role/status/password changes invalidate affected sessions. Managers and viewers cannot bypass permissions with direct API requests. View-only notifications are not acknowledged automatically.

## Invitations and recovery

Admin adds a username, registered email and role inside Users. The invitation stays inactive until its recipient opens the single-use link and sets a password. In the default manual mode, show that link only to the authenticated Admin who created it; the Admin sends it to the stated inbox through their normal email account. In optional automatic mode, Cloudflare sends it. Never show plaintext passwords or account links to an unauthenticated visitor. Resend is explicit if delivery fails. Disabled accounts cannot be activated with an old link.

Forgot password records a request for Admin approval. Known and unknown emails receive the same public acknowledgement. Only after approval is the reset link created for the registered account email, never an address supplied with the reset approval. Manual mode returns it to the approving Admin for deliberate delivery; automatic mode sends it through Cloudflare. Self-approval of a public reset request is prohibited; another Admin or the Cloudflare-owner backstop handles a locked-out sole administrator. Current-password-verified own-password changes do not need someone else's approval.

The original owner registers an email in Users using their current password and confirms the one-use link before that address can receive recovery actions or be used for login. Account confirmation links use a URL fragment, are cleared from browser history by the action page, are submitted in a same-origin POST, and are stored in D1 only as keyed hashes. Invite/email confirmation expires in 24 hours; approved reset links expire in one hour. A transactional consume operation prevents reuse and binds mutations to the account version. When automatic email is enabled, provider acceptance is recorded honestly and is not labelled inbox delivery.

## Email connection

### One-time security setup

Use this title in CRM Users and in the owner handoff. The default Free workflow is sender-free manual delivery: the CRM creates an expiring, single-use account link that an administrator copies or opens in their normal email app. Gmail and other inboxes are valid; no owned sending domain is required for this mode. Automatic Cloudflare delivery is optional and has a separate sender-domain requirement. Keep the customer-facing explanation short and keep builder-only configuration and tests out of the CRM.

1. **Configure the exact CRM origin:** set `CRM_PUBLIC_ORIGIN` to the final HTTPS CRM origin. For a requested CRM custom host, `npm run configure` materializes it from `requested_hosts.crm`. Account actions stay disabled when the origin is absent or does not match the request.
2. **Use manual secure links by default:** an Admin enters the recipient inbox, username and role. The CRM returns the one-use link only to that authenticated Admin; it stores only a keyed hash. The UI offers Copy link and Open email app. The Admin sends it through their normal email account. The recipient sets their password on the CRM origin. Reuse and expired links fail.
3. **Register the owner email:** while logged in as owner, enter the inbox and current CRM password. In manual mode, the owner receives the one-use confirmation link in the authenticated CRM and sends/opens it deliberately. A receiving inbox can be Gmail or any valid domain.
4. **Approve reset requests safely:** public reset requests do not enumerate accounts. A different Admin must approve a request; the approving Admin receives a new one-use link to send to the registered inbox. A sole owner cannot approve their own forgotten-password request and must use the Cloudflare-owner recovery backstop. An authenticated password change with the current password is separate.
5. **Treat automatic email as optional:** only when the owner wants it, follow the Cloudflare sender-domain and recipient-verification path. Confirm an authorized onboarded routing domain, preserve existing MX/SPF/DKIM/DMARC, add a sender-restricted `EMAIL` binding, and use a narrowly scoped `Email Routing Addresses Write` secret for dynamic recipients. Never upgrade billing automatically.
6. **Verify the selected mode:** for manual mode, activate one authorized synthetic invitation, confirm the old/reused link fails, exercise an approved reset with another Admin when available, and remove the temporary account. For automatic mode, additionally prove provider acceptance and real inbox receipt. Do not require a customer to create a test account when they did not authorize one.

If blocked, state the next specific owner action and what Codex will do immediately afterward. Manual mode is complete when the correct Admin receives the link in the CRM and the intended user successfully consumes it once. Automatic mode is complete only after the actual authorized inbox receives the message and the corresponding link works.

Dashboard paths checked 2026-09-22: [recipient verification](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/), [routing onboarding](https://developers.cloudflare.com/email-service/get-started/route-emails/), [domain records](https://developers.cloudflare.com/email-service/configuration/domains/), [subdomain options](https://developers.cloudflare.com/email-service/configuration/subdomains/). Check current official docs when labels differ; do not guess DNS values.

Use Cloudflare Free only. Manual secure-link mode requires `CRM_PUBLIC_ORIGIN` and no email binding, sender domain, recipient token or external provider key. Automatic Cloudflare email is an optional enhancement; only then set `CRM_EMAIL_FROM` and `CF_EMAIL_ROUTING_ACCOUNT_ID`, add the `EMAIL` binding, and store `CF_EMAIL_ROUTING_TOKEN` as a Worker secret.

Example configuration, only after the actual sender is authorized and verified:

```json
{
  "send_email": [{"name": "EMAIL", "allowed_sender_addresses": ["crm@mail.example.com"]}],
  "vars": {
    "CRM_EMAIL_FROM": "crm@mail.example.com",
    "CRM_PUBLIC_ORIGIN": "https://the-actual-worker.workers.dev",
    "CF_EMAIL_ROUTING_ACCOUNT_ID": "the-selected-32-character-account-id"
  }
}
```

Do not copy the example values. This example is for optional automatic delivery only. Add `CF_EMAIL_ROUTING_TOKEN` separately with the secret-setting workflow. Preserve existing vars/bindings. Existing static `CRM_VERIFIED_RECIPIENTS` plus matching destination restrictions remain supported for already deployed sites, but dynamic and static binding modes must not be mixed accidentally. Do not add an unconfigured send binding to every page build. Without automatic delivery, keep manual secure links available instead of disabling invitation/reset actions.

Cloudflare permits free automatic sending to verified destination addresses; arbitrary automatic recipients require Workers Paid and are outside this skill's configuration. Dynamic automatic mode records Cloudflare's recipient ID in D1 and re-fetches that exact record before each account email. A non-null provider `verified` timestamp and matching email are required for provider sending; cached UI state alone cannot authorize it. The sender remains restricted at the binding. Never upgrade automatically. If free quotas are reached, retain manual secure links and report the limit instead of enabling billing. Keep the user's existing website and mail DNS intact, and obtain authorization for any optional sender DNS setup.

Workers and D1 also have free daily/resource quotas. Check the selected account's tier and current official limits before publication; a successful deploy alone does not establish its billing tier. Do not promise unlimited free traffic/storage or weaken password hashing to fit an unverified CPU claim. If the account is already paid, make that visible and do not assert zero account charges. Avoid paid-only bindings and services. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 free quotas](https://developers.cloudflare.com/d1/platform/pricing/) are the current references.

Official sources checked 2026-09-22: [create recipient](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/create/), [get recipient](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/get/), [list recipients](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/list/), [Workers email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [send bindings and sender restrictions](https://developers.cloudflare.com/email-service/configuration/send-bindings/), [email pricing and recipient restrictions](https://developers.cloudflare.com/email-service/platform/pricing/).

## Verification and handoff

Apply all bundled additive migrations, including 0007 account delivery recovery and 0008 email recipients, before the new Worker. Preserve the current owner/password and existing leads. Test each role with separate sessions: direct API denials, stage/note management, denied viewer export/settings, invitation confirmation, expiry/reuse, disabled accounts, admin approval and old-session rejection. Include concurrent approvals, failed-send retry and abandoned-send recovery; a retry must not create two usable reset actions. An Admin can correct a never-activated invitation address before explicitly resending, but cannot silently replace an active user's verified identity. Use a synthetic mail sink for automated regression, clearly distinguished from a real inbox test. Keep the existing live login-attempt budget; do not disable throttling for tests.

Handoff must state exact login URL and username, private password location, role, sender configuration, and which email actions were actually delivered/confirmed. Do not describe a local mock mailbox as live delivery. Keep credentials and confirmation tokens out of Git, screenshots, public reports and the shared skill ZIP.
