# Cloudflare usage warnings

Load for CRM setup and hosting handoff only. Reuse the bundled monitor, not a lead-count approximation. Cloudflare quotas are shared across the account, including other sites. A successful deployment does not verify the plan or remaining capacity.

## Owner experience

Show hosting status on the main CRM screen and as a compact desktop-sidebar widget for Admin, Manager and View-only users. The sidebar names the verified Workers plan and shows daily Worker requests, D1 rows read and D1 rows written as three compact percentages. The main notice retains the fuller explanation, reset time, provider lag and unavailable metrics. Warn at 80%, mark 95% urgent, and distinguish a reported exhausted allowance. Tell users to ask the owner to optimize usage or review a paid plan. Only the owner decides on billing; never upgrade automatically or let CRM roles change Cloudflare subscriptions.

Keep the explanation short. Missing access, failed provider queries, stale snapshots and missing metrics must be visible as unavailable or incomplete, never zero usage or a healthy green status. Include the last successful check and explain that provider analytics can lag. An in-app warning cannot be guaranteed after Cloudflare itself stops serving requests.

## Optional read-only connection

This connection is not a prerequisite for building or publishing a CRM. Never distribute a community author's key, reuse a broad deployment token inside the Worker, or ask the owner to paste secrets into chat. Without read-only access, leave an honest setup notice and a Cloudflare dashboard link.

Guide the owner in their computer browser through Cloudflare account API tokens > Create Token > Custom token. Use Account > Account Analytics > Read, limited to the selected hosting account. Check the actual permissions before connecting. Store the token only as a Worker secret through the supported private-input flow, and keep the account ID in server configuration. Do not send the token to the CRM frontend or include it in Git, screenshots, logs or the skill archive. If the account cannot grant access, explain the blocker and retain the dashboard fallback.

Verify the provider query with that connection before claiming automatic monitoring is active. Compare the same account and UTC day with Cloudflare, record which metrics were returned, and disclose unavailable metrics. Never silently widen permissions to make a query work.

Every CRM owner handoff includes `usage_monitoring`: `status` (`verified`, `not_connected`, or `deferred`), `evidence`, `coverage`, and `owner_note` repeated in the handoff message. `not_connected` must link a real setup blocker through `blocker_id`; `deferred` requires the owner's actual `decision`. A missing token is not an implicit decision to skip monitoring. Record an honest manual-dashboard fallback while unconnected, not a claim that the automatic checker works. This uses the existing handoff, not a new report or repeated polling loop.

Builder configuration: the dedicated secret is `CF_ACCOUNT_ANALYTICS_TOKEN`; the selected account variable is `CF_USAGE_ACCOUNT_ID`. After checking the selected account's actual Workers plan in Cloudflare, set `CF_USAGE_PLAN` to `workers-free` or `workers-paid`. This is a verified deployment setting, not an inference from missing subscriptions or usage values. If the plan was not checked, omit the variable and show `Plan not verified`. Preserve existing bindings and variables. The owner can enter the secret directly in their selected Worker's Settings > Variables and Secrets rather than exposing it in chat; confirm current dashboard wording before guiding them. A secret or variable change is a deployment configuration change and needs the normal release identity and functional verification, not an unrecorded hotfix. An empty connection must not add provider requests or block publishing.

## Measurement and verification

- Account-wide Workers requests and D1 rows read/written use the UTC calendar day. D1 query counts are not billable row counts. Do not filter to just this Worker/database and call that the account total.
- Free limits checked 2026-09-21: 100,000 Worker requests/day; 5,000,000 D1 rows read/day; 100,000 rows written/day; 5 GB account D1 storage; 500 MB per database. Recheck official limits when changing the monitor. Storage does not reset at midnight.
- Only display storage percentages when a reliable provider response covers that scope. Missing or truncated storage results are unknown, not zero. Do not claim every Cloudflare limit is monitored: CPU, email and other resource limits can fail independently.
- The initial implementation checks the three daily metrics only. Storage remains explicitly unmonitored until its provider schema and full account coverage are verified. A known daily warning still takes priority when storage or another metric is unavailable; incomplete coverage must never hide a known exhausted allowance.
- Cache bounded provider requests. Do not add a D1 write for every visitor merely to count usage; the monitor must not become a quota problem itself.
- Test threshold boundaries, UTC rollover, unavailable/partial/stale responses, authorization for all three roles, credential redaction, and mobile banner layout. Provider fixtures prove behavior, not a live account connection. Keep QA fixtures and procedures out of the customer UI.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [Workers GraphQL metrics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/), [read-only analytics token](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/).
