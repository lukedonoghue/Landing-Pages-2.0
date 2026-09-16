# Named owner access, lead operations and recovery

Each generated site has **one named owner account**, configured by `ADMIN_USERNAME` (username or email, 3–80 characters). This is not a multi-user team/roles system. The password is randomly generated during setup, stored in a private `.secrets/` file for handoff, and saved to the Worker only as a salted PBKDF2 hash. Authentication requires both fields; password-only access is not supported. Save the login in the client's password manager and remove unnecessary plaintext handoff copies afterward.

## Client experience

- `/login.html` opens the protected `/admin/` workspace after a successful sign-in. The session is a secure, HttpOnly, SameSite=Strict cookie; it is not kept in JavaScript storage.
- Account & security shows the owner name, supports current-password-verified password changes, and signs out all devices. Every password change invalidates existing sessions, including the current one.
- Password changes write a salted hash and credential version to D1. This **overrides the initial Worker password-hash secret**: ordinary redeployments do not reset the client's password.
- New enquiries create an in-app unread indicator. It refreshes once a minute while the tab is visible. “Mark as seen” acknowledges only the displayed watermark; enquiries arriving during that action stay unread. Removed contacts are excluded.
- Contact export uses the contact list's search, stage and traffic-source filters (plus traffic/device when supplied). It exports all matching pages up to 10,000 contacts and displays a truncation warning if the limit is reached. It never exports removed contacts, session tokens, password hashes or arbitrary form payloads. Spreadsheet formula prefixes are escaped. Downloaded CSVs contain customer information and should be handled accordingly.
- Baseline notifications are in-app, not email. The existing optional signed webhook/outbox can connect an approved alert destination; delivery retries are independent of committed lead storage. Do not claim email delivery without configuring and testing an actual destination.

## Lost password / rotation

Recovery belongs to the Cloudflare account owner. There is deliberately no fake “email me a reset link” that depends on an unconfigured mail service. First confirm the intended generated project and Cloudflare account/database. `--dry-run` makes no remote changes.

```bash
node scripts/admin-account.mjs rotate-password --remote --dry-run
node scripts/admin-account.mjs rotate-password --remote --out .secrets/recovery-2026-09-16.txt
node scripts/admin-account.mjs revoke-sessions --remote
```

Use `--local` instead when testing. Rotation generates a new password, stores it only in the specified private file (0600), writes a new salted hash into D1 and invalidates all sessions. It never prints passwords or SQL containing credential hashes. Existing output files are not overwritten. The username stays unchanged. A failed/uncertain command retains the proposed password file: verify status before deciding whether it took effect. Username changes require changing `ADMIN_USERNAME` in the Cloudflare Worker; existing sessions using the former name then fail closed.

## Backup and restoration

D1 manages the runtime database on Cloudflare. These commands additionally create an explicit portable SQL backup. The SQL includes customer data, authentication hashes and other operational data; keep it in `.secrets/` or another private location outside the published project. Never commit or put it in `public/`.

```bash
node scripts/backup.mjs export --remote --out .secrets/crm-2026-09-16.sql --dry-run
node scripts/backup.mjs export --remote --out .secrets/crm-2026-09-16.sql
node scripts/backup.mjs verify --file .secrets/crm-2026-09-16.sql
node scripts/backup.mjs restore-plan --file .secrets/crm-2026-09-16.sql
```

`export` requires explicit local/remote selection, refuses to overwrite an existing backup and sets file mode 0600. It places table schema before row inserts so foreign keys to later tables remain restorable; triggers stay after data. `verify` actually imports into an isolated temporary **local** D1 database and checks required tables/counts and foreign-key integrity. It removes only its own temporary copy. A successful SQL check is not a tested production cutover.

Restore into a **new empty recovery D1 database**, never directly over the current live database. Use the same client/account, import the verified SQL with Wrangler, revoke restored sessions and rotate credentials, attach a separate preview Worker, and verify counts, leads, login and metrics. Obtain the owner's explicit confirmation of the exact production binding cutover before replacing the binding; retain the original database for rollback. `restore-plan` only prints those steps and never mutates a remote database. Follow the current official D1 recovery guidance if using Time Travel instead of a SQL backup.

## API contract for extensions

- `GET /api/admin/account` → `{username,password_changed_at}`.
- `POST /api/admin/account/password` with `{current_password,new_password}` → clears sessions/cookie; new password minimum 16 characters.
- `POST /api/admin/account/revoke-sessions` → clears sessions/cookie.
- `GET /api/admin/notifications` → `{unread_count,through}`.
- `POST /api/admin/notifications/acknowledge` with `{through}` → current unread state.
- `GET /api/admin/leads/export.csv` with `q,status,source,traffic,device` → CSV. Headers `X-Export-Count`, `X-Export-Total`, `X-Export-Truncated` describe the bounded result.

All routes require a valid server session; writes additionally require same-origin requests. The Account panel module is `initAccountPanel(host,{onSessionEnded?,onNotifications?})`; its return value provides `refreshNotifications()`, `setExportParams(URLSearchParams)`, and `dispose()`.

Official D1 guidance: [Import/export ordering and foreign keys](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [D1 foreign-key enforcement](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
