# Lead receipt and tracking contract

The form sends JSON to same-origin `POST /api/leads`:

```json
{
  "idempotency_key": "client-generated UUID, retained across uncertain retries",
  "form_name": "lead_form",
  "form_data": {"first_name":"Example","email":"example@example.test"},
  "website": "",
  "visitor_id": "consented pseudonymous UUID or empty string",
  "visit_event_id": "confirmed measured navigation UUID, otherwise omitted",
  "analytics_consent": false,
  "attribution_consent": false,
  "landing_page": "https://client.example/",
  "referrer": "https://referrer.example/",
  "attribution": {"first_touch":{},"latest_touch":{}}
}
```

The field schema is client-specific. The server validates required fields, allowed names/options, sizes, email/phone shapes, honeypot, origin, and rate limits. Never accept client-supplied CRM status or timestamps. Store first/latest UTM parameters, GCLID, GBRAID, WBRAID, FBCLID and MSCLKID only when the configured attribution policy permits (see [cloudflare-crm.md](cloudflare-crm.md#visitor-privacy-and-attribution)). New CRM funnels default to `lead` attribution, independently of optional analytics and advertising; use consent-gated or disabled attribution only for an actual client policy requirement. DNT/GPC overrides both measurement and lead-origin capture. Strip query strings from landing/referrer URLs. Do not store raw IP addresses in CRM/analytics by default.

Only a committed lead returns `{ "ok": true, "lead_id": "...", "receipt_id": "...", "duplicate": false }`. An idempotent retry returns the same receipt with `duplicate: true`. A changed payload with the same idempotency key is rejected. Timeouts are uncertain results: retry with the same key, not a new contact.

The form waits for this body and HTTP success before redirecting. Empty/malformed JSON, `ok:false`, missing receipts, network errors, and non-2xx responses do not show success. The helper validates every step and prevents concurrent submits. A browser/session-storage failure must not stop delivery.

The helper sends no raw contact fields to analytics. After confirmed storage it queues `customer_data_ready` first only when separately configured, explicitly consented and eligible, then queues `lead_accepted` with the receipt ID when analytics is enabled. The customer event contains provider-specific SHA-256 email/phone maps; see [advertising-tracking.md](advertising-tracking.md). Provider adapters must deduplicate by receipt and avoid counting the thank-you page load as a second lead. Direct thank-you visits, refreshes and local simulated submits produce no conversion event. Any receipt in sessionStorage is only UI state; the server database is authoritative.

Optional outbound webhooks are server-side integrations. They must not replace the D1 write or delay the public success response. Analytics errors after storage must not re-enable the form or say the request failed.

Acceptance tests cover valid/invalid fields, unknown fields, application errors, non-2xx, timeouts, retries, changed retry payloads, double clicks, denied/disabled measurement, blocked browser storage, unauthorized API access, status conflicts, and webhook failure after CRM success.

Supported campaign fields are `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`, `utm_source_platform`, `utm_creative_format`, `utm_marketing_tactic`, `gclid`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid` and `ttclid`. Keep the browser capture, server normalization, database-backed lead serialization and CRM display aligned. Unknown query parameters are deliberately excluded; adding another platform requires its explicit field contract and tests, not copying the entire URL. Verify first/latest values at the stored lead and consent withdrawal, not only a single source label.

Every new CRM configuration explicitly pins `analytics.required_attribution_mode`, including an intentional `disabled` choice. The community scaffold defaults both the required and active mode to `lead`, so approved campaign context is stored with the submitted enquiry even when optional analytics and advertising are off. Update it only from an actual owner or researched policy requirement. Configuration and publishing reject omission, including removal of the entire analytics block. Do not derive the requirement automatically from a changed runtime mode, since that would conceal drift.

When campaign capture was requested, record the selected requirement as `analytics.required_attribution_mode` (`lead` or `consent`) independently of the active `attribution_mode`. Configuration and preflight must reject a conflicting mode or an out-of-sync server configuration. Do not change the requirement merely to clear a check; a changed requirement must reflect an actual owner decision or researched policy constraint. Missing GTM/ad IDs do not require disabling first-party lead attribution. If the selected disclosed policy permits it, configure `analytics.attribution_mode: lead` independently of optional measurement and advertising; otherwise report the specific unresolved policy/provider blocker. In the existing synthetic journey, send distinct values for all supported campaign fields, inspect the request, then compare every first/latest value in the persisted CRM record. Include a later changed campaign to distinguish first from latest. Keep opt-out/disabled tests as separate negative tests. Neither an `Unknown` source label nor a successful test asserting empty attribution proves the requested capture works.
