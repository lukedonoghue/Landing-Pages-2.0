# CRM and Google Sheets connection update

## Why this branch exists

This branch adds one optional output to the existing Cloudflare CRM without replacing Luke's workflow or changing the public form contract. The browser still submits once to the same-origin CRM. After D1 commits the lead, the existing durable outbox copies it to Google Sheets.

This design prevents a Sheets outage from losing the CRM lead or showing a false failure to the visitor.

## Included changes

- A bound Google Apps Script receiver that creates `Leads` and `Attribution` tabs.
- Dynamic columns for every form-specific field plus complete lead JSON.
- Complete first-touch and latest-touch attribution, including UTMs and supported ad click IDs.
- Stable event-ID deduplication so Worker retries do not create duplicate rows.
- A private setup helper that generates the connection token without printing or committing it.
- One tightly validated Apps Script response redirect; the lead body is never forwarded to the redirected URL.
- Exact four-step instructions for a nontechnical owner.
- Clear Cloudflare usage wording: hosting access is separate from account analytics permission.

## Deliberate non-changes

- D1 remains the source of record.
- The public page does not contain a Google Apps Script URL or secret.
- Existing CRM authentication, roles, form validation, attribution capture and deployment routing are unchanged.
- This branch does not include unrelated local changes from the earlier working directory.

## Review path

Start with `references/google-sheets-connection.md`, then review the Apps Script receiver, `src/webhooks.js`, and the two focused test additions. Merge only after the full Cloudflare test suite and Community skill tests pass.
