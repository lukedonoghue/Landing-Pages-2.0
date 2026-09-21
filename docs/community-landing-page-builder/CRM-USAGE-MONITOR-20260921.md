# CRM hosting usage monitor

## Implemented scope

The shared CRM has an authenticated main-screen monitor visible to Admin, Manager and View-only roles, outside individual dashboard panels. It queries Cloudflare account-wide Workers requests and D1 rows read/written for the current UTC day through a dedicated optional Account Analytics Read connection. It does not infer hosting usage from visitor or lead counts.

Warnings begin at 80%, become urgent at 95%, and identify reported 100% exhaustion. Known high usage takes priority even when another metric is missing. Unknown values never become zero or a healthy status. Daily UTC resets, provider delay, last successful check and incomplete coverage are explicit. Storage remains unmonitored until its schema and complete account coverage are verified. CPU/email/resource-specific limits are not covered by the three daily metrics.

Bounded in-memory caching deduplicates requests by account/token/day; failed requests use a short backoff. No per-visitor D1 accounting writes or new paid services were added. Visible tabs refresh at a five-minute interval and pause when hidden. Destroying the component cancels pending work without recreating a timer. The frontend only receives sanitized metric data, never the provider token or raw provider errors.

## Verification

GPT-5.6 Sol high implemented the shared module and mirrored it deliberately into the existing Beks project. The parent reviewed cache concurrency, successful-check timestamps, warning priority with incomplete data and component cleanup; the resulting fixes have regressions.

- Final quota/lifecycle unit suites: 18 passed in canonical and current project.
- Backend integration: 26 passed in each copy.
- Canonical CRM browser checks: 8 passed, including narrow layout and failed business-metrics independence.
- Canonical role browser checks: 8 passed.
- Shared-core identity, syntax, ASCII and whitespace checks passed.
- Current-project final synthetic browser proof passed at 320, 390 and 1440 pixels: unconnected Admin, 99% request warning with unknown storage, and View-only. No overflow; keyboard disclosure and cross-panel visibility passed; failed business metrics did not suppress the monitor. Parent inspected the 320px and 390px actual captures. The bounded harness closed its browser/server; an additional OS-wide process listing was unavailable. No full publication is claimed.

## Owner connection and limits

The optional Worker secret is `CF_ACCOUNT_ANALYTICS_TOKEN`; server account variable is `CF_USAGE_ACCOUNT_ID`. The token must be owner-controlled, account-scoped and read-only. Never store it as a Wrangler public variable or reuse a broad deploy token. Without it the CRM reports not connected. No live provider response has been verified, no credential was requested in chat, and no billing plan was changed.

Instructions are in references/usage-monitoring.md, linked from SKILL.md, cloudflare-crm.md and guided-publishing.md. The monitor is not a prerequisite for building a page/CRM. An in-app warning cannot be guaranteed after Cloudflare itself refuses requests.

## Independent run boundary

The new Clarentis Sol Medium run uses the previously verified frozen skill at 9c530b7. It intentionally does not include this then-in-progress monitor. Do not change that frozen run. Once reviewed, this monitor belongs in the next independent skill snapshot, not an injected correction to the running builder.
