# Google Sheets connection

Load this reference only when the owner selects Google Sheets alongside the Cloudflare CRM. No Google Sheets API key is required. The owner creates a Sheet and deploys its bound Apps Script once; the agent prepares the code, connects the private URL in the CRM, and performs the technical verification.

## Architecture

The page sends one request to same-origin `POST /api/leads`. D1 validates and commits the lead first. The existing outbox then sends `lead.created` to Apps Script. Apps Script writes:

- `Leads`: identity, current CRM fields, every current form field as a named column, normalized traffic fields, and complete lead JSON;
- `Attribution`: every supported first-touch and latest-touch field, including all UTM values and Google, Meta, Microsoft and TikTok click IDs.

The stable outbox event ID is the Sheet deduplication key. Retries are safe. A Sheets outage never changes a saved CRM lead into a failed public submission. Removing a CRM contact does not erase the separate Sheet copy; include that receiver in the owner's retention and deletion procedure.

## Builder preparation

From the generated Cloudflare project, run:

```bash
node scripts/google-sheets-connector.mjs prepare
```

This creates `.secrets/google-sheets/Code.gs` and `.secrets/google-sheets/connection.json` with mode 0600. They are excluded from Git. The command never prints the token. Do not replace the private file with the public template because the template contains only a marker.

## Exact owner message

Send these steps in the conversation, adapted only for the business name:

1. Open Google Sheets and create a blank spreadsheet named `[Business] Landing Page Leads`.
2. In that spreadsheet choose `Extensions`, then `Apps Script`. Delete the starter code. The agent will open the prepared private `Code.gs`; paste its complete contents and click `Save`.
3. Choose `Deploy`, `New deployment`, then the gear icon and `Web app`. Set `Execute as` to `Me` and `Who has access` to `Anyone`. Click `Deploy`, approve Google's prompt, and copy the URL ending in `/exec`.
4. Paste only that `/exec` URL into the chat. Do not edit it or add the private token. The agent will connect and test it.

If an existing deployment is updated, use `Deploy`, `Manage deployments`, the edit icon, `New version`, then `Deploy`. Keep the same `/exec` URL.

## Agent connection

Validate the returned URL and combine it with the private token:

```bash
node scripts/google-sheets-connector.mjs connect --web-app-url 'https://script.google.com/macros/s/.../exec'
```

Read `webhook_url` only from `.secrets/google-sheets/connection.json`. Sign in to the CRM as Admin, open Connections, and add it as `Google Sheets`. Never paste the token into chat, Git, screenshots, logs, or a public handoff.

The Worker allows one special response path for this receiver: the valid Apps Script endpoint may redirect to Google's exact `script.googleusercontent.com/macros/` response host. The Worker follows that redirect with a body-free GET and requires an acknowledgment containing the same outbox event ID. It never forwards lead data to the redirect. All other webhook redirects remain blocked.

## Live acceptance

The user's publication request authorizes configuration, but a live synthetic submission still follows the project's live-test authorization rule. Once authorized:

1. Open the page with distinct values for every supported campaign field.
2. Submit a clearly labeled synthetic lead through the real browser form.
3. Confirm the CRM receipt and stored lead.
4. Confirm one `Leads` row and one `Attribution` row with the same event ID.
5. Compare every form field and every supported first/latest attribution value. Confirm formula-like input is stored as text.
6. Wait for, or trigger through the existing test process, one retry and confirm no duplicate Sheet row.
7. Remove the synthetic CRM and Sheet rows only when the owner asked for cleanup. Record the connection as verified only after both destinations match.

An Apps Script health response, successful deployment, CRM `delivered` status, or row presence alone is incomplete evidence. The final check compares the same event and values across the browser submission, CRM record and both Sheet tabs.
