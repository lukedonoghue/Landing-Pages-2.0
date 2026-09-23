# Google Sheets: signed, minimal, one-way CRM connector

The maintained connector is in `assets/cloudflare/google-apps-script/` and `src/sheets-protocol.js`. It is a new signed protocol, not a drop-in enablement of the old `?token=` example. CRM remains the system of record. A Sheet is another personal-data store; CRM roles do not govern people who can open it.

## Operator setup (outside the agent sandbox)

1. Use a dedicated, client-owned Google automation account with 2-Step Verification and recovery configured. Create the spreadsheet with named-user sharing only, no public or anyone-with-link access. Human recipients are Viewers by default.
2. Run `npm run sheets:prepare`. Create a **standalone** Apps Script project owned by the automation account, not a container-bound spreadsheet script. Copy the static `google-apps-script/Code.gs` and `appsscript.json`. The code contains no connection secret. Script editors can read Script Properties: do not give spreadsheet readers/editors access to the standalone script.
3. Deploy a versioned web app: execute as the deploying account, access Anyone. Use only `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`, never `/dev`, queries, fragments or credentials. Public access is required for Worker delivery; the signed message authenticates writes.
4. In the trusted operator terminal run `npm run sheets:connect -- --web-app-url CLEAN_EXEC_URL --out /PRIVATE/OUTSIDE/PROJECT/sheets-properties.json`. The helper creates a 256-bit master under `.secrets/production.json` if necessary and an external, mode-0600 per-destination key handoff. It never prints the key. Copy the handoff values into Script Properties, replacing `CRM_SPREADSHEET_ID` with the intended sheet ID. Do not paste secret values into chat, evidence, source code or tickets.
5. Upload `GOOGLE_SHEETS_SIGNING_SECRET` as a Worker secret through the trusted operator's `wrangler secret put GOOGLE_SHEETS_SIGNING_SECRET` prompt. Initial guarded publishing also includes it in the secrets file; **a repeat code-only deployment does not upload new secrets**. This helper prepares, but does not deploy, create the connection or update Script Properties.
6. In CRM Connections, add the clean `/exec` URL and confirm the current admin password. The runtime refuses Sheets delivery without a configured master secret. Secrets do not enter D1, webhook URLs or the admin UI.
7. With explicit permission, submit a clearly labelled synthetic lead, confirm its normal outbox delivery and the corresponding row in the intended Sheet, then erase it and confirm downstream deletion. `sheets:status` is only an endpoint reachability check and expressly does **not** certify signed delivery or row persistence. Live verification is an operator release gate, not silently performed by an AI agent.

## Protocol and data minimisation

Body: the normal event envelope plus integer `timestamp`, `key_version`, and hex `signature`. Signature is HMAC-SHA256 over `timestamp + "." + canonical(envelope without signature)`. Canonical JSON recursively sorts object keys and preserves array order. The per-endpoint key is derived from the Worker master using `sheets:v1:VERSION:CLEAN_EXEC_URL`; it is never transmitted. Apps Script verifies its Script Property key, a five-minute freshness window and event identity, then uses a script lock and event-ID deduplication.

The Worker follows only a 302/303 ContentService redirect to the exact `script.googleusercontent.com` host and `/macros/` path, after public-DNS validation. It forwards no original body or credential header to that host. The streamed acknowledgement is capped at 16 KB and must echo the event ID. Explicit non-retryable rejections stop automatic retries; network/transient failures have bounded retry and visible failure state.

By default Sheets receives lead ID, creation time, name, email, phone, stage and service only. `site-config.json.googleSheets.columns` can select these allowed columns. `formFields` can opt in known non-textarea fields from the form schema; sensitive categories suppress all custom fields. No full lead JSON, raw attribution blobs, campaign IDs, identity linkage keys or free-text answers are exported. Existing Sheets may contain older copies: minimisation is not retrospective deletion.

## Erasure, retention and failures

A delivery receipt is recorded before sending, so even a lost acknowledgement counts as a possible external copy. Receipts survive connection removal and normal webhook history cleanup. CRM erasure and retention atomically enqueue signed `lead.erased` jobs before removing CRM records. Each job retains only the clean endpoint and opaque IDs, not lead contact data, and survives source-lead and connection deletion.

The script records a deletion tombstone before removing all matching Lead ID rows from both `Leads` and legacy `Attribution` tabs. A late `lead.created` for an erased lead is acknowledged without recreating it. The erasure worker retries bounded batches and exposes pending/failed counts. CRM erasure completion is **not** proof of Sheet deletion: the operation exposes `crm_complete`, downstream status counts and `all_managed_copies_erased`. Use Recent security activity to retry repaired failures. Disabled/deleted scripts, removed Google permissions or uncorrected legacy layouts require operator repair. Queue size and provider quotas determine completion time; there is no guaranteed five-minute deletion SLA.

Historical copies whose delivery records were already purged, exports, duplicated tabs, offline copies and backups cannot be discovered automatically. Record and purge these separately. The `_CRM Erased` tab contains only opaque anti-resurrection IDs; retain it for the lifetime of the endpoint, review its size/retention with the client, and retire the endpoint before removing tombstones.

## Rotation and legacy upgrade

Run `npm run sheets:rotate -- --web-app-url CLEAN_EXEC_URL --version NEXT_INTEGER --out /PRIVATE/OUTSIDE/PROJECT/new-sheets-properties.json`. Update the standalone Script Properties first, then activate that prepared version in CRM Connections (current-password confirmation required). Versions can only increase and persist across removing/re-adding connections. One endpoint uses one version across all historical receipts and deletion jobs. Rotating can temporarily reject an in-flight message; the activation requeues eligible failed deliveries and failed erasures. Monitor both queues to completion. Never roll back to an older key version. Rotating the **master** is a separate all-endpoints operation: prepare/reissue every endpoint property and update the Worker master together during a controlled maintenance window.

Migration 0011 invalidates old reset links/sessions, strips legacy URL tokens and disables legacy query-token Sheets connections. It preserves possible historical delivery receipts still present in the outbox. Upgrade the standalone script and use the expected minimal `Leads` layout before re-enabling. Old full-JSON columns and untracked old copies require a deliberate purge/reconciliation; the script fails closed on incompatible headers. Keep the deployment ID stable with Manage deployments / Edit / New version. Do not remove the old endpoint until recorded erasure obligations are resolved.

## Handoff checklist

Record named sharing, automation-account ownership, 2SV/recovery, script-editor access, successful authorized synthetic create/erase evidence, empty failure queues, key version, master-secret upload and the separate legacy-copy purge. Include Google Sheets as personal-data storage in the client's privacy notice and retention schedule. Review sharing at handoff and quarterly. No Sheets-to-CRM writeback exists.
