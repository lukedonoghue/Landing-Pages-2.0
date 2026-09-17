# Named owner access, lead operations and recovery

Each generated site has **one named owner account**, initially configured by `ADMIN_USERNAME` (username or email, 3–80 characters), with subsequent owner identity changes retained in D1. This is not a multi-user team/roles system. The password is randomly generated during setup, stored in a private `.secrets/` file for handoff, and saved to the Worker only as a salted PBKDF2 hash. Authentication requires both fields; password-only access is not supported. Save the login in the client's password manager and remove unnecessary plaintext handoff copies afterward.

## Client experience

- `/login.html` opens the protected `/admin/` workspace after a successful sign-in. The session is a secure, HttpOnly, SameSite=Strict cookie; it is not kept in JavaScript storage.
- Account & security shows the owner name, supports current-password-verified password changes, and signs out all devices. Every password change invalidates existing sessions, including the current one.
- Password changes write a salted hash and credential version to D1. This **overrides the initial Worker password-hash secret**: ordinary redeployments do not reset the client's password.
- New enquiries create an in-app unread indicator. It refreshes once a minute while the tab is visible. “Mark as seen” acknowledges only the displayed watermark; enquiries arriving during that action stay unread. Removed contacts are excluded.
- Contact export uses the contact list's search, stage and traffic-source filters (plus traffic/device when supplied). It exports all matching pages up to 10,000 contacts and displays a truncation warning if the limit is reached. It never exports removed contacts, session tokens, password hashes or arbitrary form payloads. Spreadsheet formula prefixes are escaped. Downloaded CSVs contain customer information and should be handled accordingly.
- Baseline notifications are in-app, not email. The existing optional signed webhook/outbox can connect an approved alert destination; delivery retries are independent of committed lead storage. Do not claim email delivery without configuring and testing an actual destination.

## Lost password / rotation

Recovery belongs to the Cloudflare account owner. There is no reset-email flow dependent on an unconfigured mail service. Confirm the intended project/account/database and use the existing authorized maintenance scope. The agent handles these commands; the user should not need to edit secrets manually. `--dry-run` makes no changes.

The current Worker and owner-maintenance helper require migration `0004_owner_identity.sql`. For an existing generated site, install the current helpers and apply the additive migration through its reviewed update procedure before using the new authentication code. Deploy the current Worker through that reviewed update before using username changes: older Workers do not read the D1 owner-identity override. Existing owner records keep their original bootstrap identity until changed; migration does not rename or reset anyone.

```bash
node scripts/admin-account.mjs rotate-password --remote --dry-run
node scripts/admin-account.mjs rotate-password --remote
node scripts/admin-account.mjs change-username --remote --username new-owner
node scripts/admin-account.mjs revoke-sessions --remote
```

Use `--local` for the isolated local database. A password reset generates one random password and saves a private operation before any database change. `--out .secrets/recovery-password.txt` optionally selects a handoff copy; existing files are never overwritten. The private operation includes the generated password, salted hash and intended credential version, so **all of `.secrets/account-recovery/` is sensitive**. It is excluded from Git, public assets and source handoffs. Provider output, hashes and passwords are never printed.

A username change preserves the password and stores the normalized new identity in D1. Password/account changes advance the credential version, invalidating old sessions and in-flight old logins. A later deployment with the original valid bootstrap username/password secrets does not override the changed D1 identity/password. Keep the bootstrap configuration; do not edit `ADMIN_USERNAME` directly as a rename procedure.

After an operation, the tool reads D1 back and checks the exact operation ID, version, username and password hash. Only then does it update the private current-access reference used by publishing. It checks an available password against the authoritative hash before carrying it into the renamed identity. Supply an already-current private `--credentials-file` or `--password-file` when necessary. The original credential-file reference is retained with a rename operation, so resume does not need the same option repeated. A missing or malformed old credential file does not prevent a password reset when the owner identity is known. If the current password is unavailable, the username change still completes but the reference explicitly requires a current private password; the publisher will not silently use the original bootstrap password. A browser password change cannot write local files: supply its new private credentials file for subsequent publishing/maintenance.

The production pointer is `.secrets/current-admin-access.json`; local maintenance uses `.secrets/current-local-admin-access.json`. References are bound to the intended database/Worker/account. Local demo verification follows its current local reference. Resetting an owned fictional demo archives its old database and recovery/reference files privately, then returns to the initial demo account; historical operations are not reused against the reset database.

## Interrupted owner maintenance

Keep the saved operation UUID shown by the tool. Resume that operation on the same target:

```bash
node scripts/admin-account.mjs resume --remote --operation <saved-UUID>
```

The helper inspects before acting. If the change committed but its response or local credential handoff was lost, it completes the handoff without changing the password/version again. If the original write did not commit, a retry uses the same private intent and a compare-and-swap on its expected version. A newer UI/CLI account change blocks the old operation instead of overwriting it. Attempts are bounded at three; unavailable migrations/account access, missing/changed private state, changed destinations and exhausted attempts need the specific private diagnostic resolved.

Owner maintenance shares the publishing process lock, inherited by child commands. Do not delete it while a holder is running. This local serialization and the D1 version guard address different concurrency cases; a state file alone is not evidence of a running process. Preserve unfinished private operations and current credential files until recovery/handoff is resolved. Remove unnecessary private copies later through the owner's normal secure credential handling, without leaving publishing references pointing to deleted files.

## Backup and restoration

D1 manages the runtime database on Cloudflare. These commands additionally create an explicit portable SQL backup. The SQL includes customer data, authentication hashes and other operational data; keep it in `.secrets/` or another private location outside the published project. Never commit or put it in `public/`.

```bash
node scripts/backup.mjs export --remote --out .secrets/crm-2026-09-16.sql --dry-run
node scripts/backup.mjs export --remote --out .secrets/crm-2026-09-16.sql
node scripts/backup.mjs verify --file .secrets/crm-2026-09-16.sql
node scripts/backup.mjs restore-plan --file .secrets/crm-2026-09-16.sql
```

`export` requires explicit local/remote selection, refuses to overwrite an existing backup and sets file mode 0600. It places table schema before row inserts so foreign keys to later tables remain restorable; triggers stay after data. `verify` actually imports into an isolated temporary **local** D1 database and checks required tables/counts and foreign-key integrity. It removes only its own temporary copy. A successful SQL check is not a tested production cutover.

Before any restore intended for use, obtain the latest complete source-bound erasure record from Account → Data retention & erasure. Use `backup.mjs verify --file <old.sql> --erasure-records <private-record.json> --clean-output <new-private.sql>` to prepare a separate cleaned copy inside an isolated local D1. The helper verifies source identity and both directions of the enquiry-ID/submission-key relationship, suppresses erased enquiries, revokes sessions, disables automatic retention and connections, and pauses old delivery jobs. The original remains unchanged. A pre-feature backup needs its provenance established before using `--confirm-legacy-source`; this cannot override a modern source mismatch. Use the **cleaned** SQL for recovery. See [data-lifecycle.md](data-lifecycle.md) for scope, retention and backup-copy limits. Ordinary `verify` alone checks SQL integrity and does not clear a backup against current erasure records.

Restore into a **new empty recovery D1 database**, never directly over the current live database. Use the same client/account, import the verified cleaned SQL with Wrangler, apply current application migrations missing from that backup, revoke restored sessions and rotate credentials, attach a separate preview Worker, and verify suppression, counts, leads, login and metrics. Review retention and destinations; explicitly enable new deliveries only for approved connections, without restarting old failed jobs. Obtain the owner's explicit confirmation of the exact production binding cutover before replacing the binding; retain the original database for rollback. `restore-plan` only prints those steps and never mutates a remote database. Follow the current official D1 recovery guidance if using Time Travel instead of a SQL backup.

## API contract for extensions

- `GET /api/admin/account` → `{username,password_changed_at}`.
- `POST /api/admin/account/password` with `{current_password,new_password}` → clears sessions/cookie; new password minimum 16 characters.
- `POST /api/admin/account/revoke-sessions` → clears sessions/cookie.
- `GET /api/admin/notifications` → `{unread_count,through}`.
- `POST /api/admin/notifications/acknowledge` with `{through}` → current unread state.
- `GET /api/admin/leads/export.csv` with `q,status,source,traffic,device` → CSV. Headers `X-Export-Count`, `X-Export-Total`, `X-Export-Truncated` describe the bounded result.

All routes require a valid server session; writes additionally require same-origin requests. The Account panel module is `initAccountPanel(host,{onSessionEnded?,onNotifications?})`; its return value provides `refreshNotifications()`, `setExportParams(URLSearchParams)`, and `dispose()`.

Official D1 guidance: [Import/export ordering and foreign keys](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [D1 foreign-key enforcement](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
