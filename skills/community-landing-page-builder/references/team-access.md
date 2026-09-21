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

Admin adds a username, registered email and role inside Users. The invitation stays inactive until its recipient confirms the single-use emailed link and sets a password. Never show plaintext passwords or reset tokens to another administrator. Resend is explicit if delivery fails. Disabled accounts cannot be activated with an old link.

Forgot password records a request for Admin approval. Known and unknown emails receive the same public acknowledgement. Only after approval is the reset link sent to the registered verified email, never an address supplied with the reset approval. Self-approval of a public reset request is prohibited; another Admin or the Cloudflare-owner backstop handles a locked-out sole administrator. Current-password-verified own-password changes do not need someone else's approval.

The original owner registers an email in Users using their current password and confirms that email before it can receive reset links or be used for login. Account confirmation links use a URL fragment, are cleared from browser history by the action page, are submitted in a same-origin POST, and are stored in D1 only as keyed hashes. Invite/email confirmation expires in 24 hours; approved reset links expire in one hour. A transactional consume operation prevents reuse and binds mutations to the account version. Mail-provider acceptance is recorded honestly, not labelled inbox delivery.

## Email connection

Use Cloudflare Free only, with its native `EMAIL` send binding. Set `CRM_EMAIL_FROM`, `CRM_PUBLIC_ORIGIN` and `CRM_VERIFIED_RECIPIENTS` to the verified sender, exact HTTPS CRM origin and JSON array of actual Cloudflare-verified recipient addresses. No external email API key is required. The site can remain on workers.dev, but the sender still needs an owned domain onboarded to Email Service. Ask for the owner's real email and authorized sender; do not substitute a Cloudflare account email or test address without approval. For every new teammate, guide the account owner through Cloudflare destination verification first, have the teammate confirm the Cloudflare email, then add the confirmed address to both the binding allowlist and runtime recipient list. CRM invitation/approval remains inside Users; do not claim Cloudflare's prerequisite is eliminated.

Example configuration, only after the actual sender is authorized and verified:

```json
{
  "send_email": [{"name": "EMAIL", "allowed_sender_addresses": ["crm@mail.example.com"], "allowed_destination_addresses": ["owner@example.com"]}],
  "vars": {
    "CRM_EMAIL_FROM": "crm@mail.example.com",
    "CRM_PUBLIC_ORIGIN": "https://the-actual-worker.workers.dev",
    "CRM_VERIFIED_RECIPIENTS": "[\"owner@example.com\"]"
  }
}
```

Do not copy these example destinations. Preserve existing vars/bindings. Do not add an unconfigured send binding to every page build. Without the connection, the owner can still log in, but email-dependent invitation/reset actions must report setup required. Do not generate manual reset URLs as a substitute for email possession.

Cloudflare permits free sending to verified destination addresses; arbitrary recipients require Workers Paid and are outside this skill's configuration. The application refuses recipients missing from its explicit verified list before calling the provider, even if hosted in an account that has paid products. This list is deployment configuration, not a checkbox an Admin can use to bypass Cloudflare verification. Never upgrade automatically. If free quotas are reached, report the limit and wait instead of enabling billing. Do not downgrade an existing shared account either. Keep the user's existing website and mail DNS intact, and obtain authorization for sender DNS setup. Send to an approved verified test recipient and have the owner confirm inbox receipt before claiming end-to-end delivery. Without an owned sender domain or recipient verification, keep email-dependent functions explicitly pending; do not invent a free unrestricted sender.

Workers and D1 also have free daily/resource quotas. Check the selected account's tier and current official limits before publication; a successful deploy alone does not establish its billing tier. Do not promise unlimited free traffic/storage or weaken password hashing to fit an unverified CPU claim. If the account is already paid, make that visible and do not assert zero account charges. Avoid paid-only bindings and services. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 free quotas](https://developers.cloudflare.com/d1/platform/pricing/) are the current references.

Official sources checked 2026-09-21: [Workers email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [send bindings and sender restrictions](https://developers.cloudflare.com/email-service/configuration/send-bindings/), [email pricing and recipient restrictions](https://developers.cloudflare.com/email-service/platform/pricing/).

## Verification and handoff

Apply all bundled additive migrations, including 0007 account delivery recovery, before the new Worker. Preserve the current owner/password and existing leads. Test each role with separate sessions: direct API denials, stage/note management, denied viewer export/settings, invitation confirmation, expiry/reuse, disabled accounts, admin approval and old-session rejection. Include concurrent approvals, failed-send retry and abandoned-send recovery; a retry must not create two usable reset actions. An Admin can correct a never-activated invitation address before explicitly resending, but cannot silently replace an active user's verified identity. Use a synthetic mail sink for automated regression, clearly distinguished from a real inbox test. Keep the existing live login-attempt budget; do not disable throttling for tests.

Handoff must state exact login URL and username, private password location, role, sender configuration, and which email actions were actually delivered/confirmed. Do not describe a local mock mailbox as live delivery. Keep credentials and confirmation tokens out of Git, screenshots, public reports and the shared skill ZIP.
