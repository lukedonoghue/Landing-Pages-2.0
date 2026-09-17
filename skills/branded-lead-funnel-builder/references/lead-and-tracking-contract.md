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

The field schema is client-specific. The server validates required fields, allowed names/options, sizes, email/phone shapes, honeypot, origin, and rate limits. Never accept client-supplied CRM status or timestamps. Store first/latest UTM parameters, GCLID, GBRAID, WBRAID, FBCLID and MSCLKID only when the configured attribution policy permits (see [cloudflare-crm.md](cloudflare-crm.md#visitor-privacy-and-attribution)). The default requires consent; DNT/GPC overrides both measurement and lead-origin capture. Strip query strings from landing/referrer URLs. Do not store raw IP addresses in CRM/analytics by default.

Only a committed lead returns `{ "ok": true, "lead_id": "...", "receipt_id": "...", "duplicate": false }`. An idempotent retry returns the same receipt with `duplicate: true`. A changed payload with the same idempotency key is rejected. Timeouts are uncertain results: retry with the same key, not a new contact.

The form waits for this body and HTTP success before redirecting. Empty/malformed JSON, `ok:false`, missing receipts, network errors, and non-2xx responses do not show success. The helper validates every step and prevents concurrent submits. A browser/session-storage failure must not stop delivery.

The helper sends no contact fields to analytics. After confirmed storage it queues only `lead_accepted` and a receipt ID when analytics is enabled and consented. Provider adapters must deduplicate by receipt and avoid counting the thank-you page load as a second lead. Direct thank-you visits, refreshes and local simulated submits produce no conversion event. Any receipt in sessionStorage is only UI state; the server database is authoritative.

Optional outbound webhooks are server-side integrations. They must not replace the D1 write or delay the public success response. Analytics errors after storage must not re-enable the form or say the request failed.

Acceptance tests cover valid/invalid fields, unknown fields, application errors, non-2xx, timeouts, retries, changed retry payloads, double clicks, denied/disabled measurement, blocked browser storage, unauthorized API access, status conflicts, and webhook failure after CRM success.
