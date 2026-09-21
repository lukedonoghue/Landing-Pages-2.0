# Cloudflare CRM API contract

One Worker and one D1 database serve one client/site. `src/site-config.json` supplies the business name, brand, timezone, allowed landing paths, form schema and stage labels. The runtime requires the `DB` D1 binding and `ASSETS` static-assets binding. Set `assets.run_worker_first: true`: asset-first routing must not bypass protection for encoded or extensionless `/admin` URLs.

## Secrets and authentication

- `ADMIN_PASSWORD_HASH`: `pbkdf2_sha256$100000$<salt hex>$<hash hex>`. Salt is at least 16 random bytes encoded in lowercase hex. Hash is the 32-byte PBKDF2-HMAC-SHA256 result encoded in lowercase hex. The bundled setup generates a strong random password; do not ship a default password or store the plaintext in the repository. The 100,000 iteration format is verified against the Workers runtime in Miniflare.
- `SESSION_SECRET`: at least 32 random characters. Used for domain-separated HMACs of session tokens, daily visitor identifiers and rate-limit buckets. Rotating it invalidates sessions and changes analytics identifiers; preserve it across deploys.
- Optional `WEBHOOK_SIGNING_SECRET`: at least 32 random characters, shared only with an authorized webhook receiver. Never share `SESSION_SECRET` with receivers.

`POST /api/auth/login` accepts `{ "password": "..." }` and returns `{ "authenticated": true }` with a random 256-bit session in an HttpOnly, SameSite=Strict cookie. Production cookies are Secure, host-only and expire after 12 hours. Localhost HTTP is supported for local checks. D1 stores only a keyed hash of the token. Successful login rotates the caller's old session. A maximum of 8 login attempts per IP and 80 total attempts per 15-minute window is enforced in D1.

`GET /api/auth/session` returns `{ "authenticated": true }` or 401. `POST /api/auth/logout` revokes the session and clears the cookie. Browser requests use same-origin cookies; there are no frontend auth tokens and no localStorage authentication. All `/api/admin/*` routes require the session, including unknown admin endpoints. `/admin`, its assets and encoded aliases redirect unauthenticated visitors to public `/login.html`.

All unsafe API requests require an `Origin` header equal to the Worker request origin, and reject cross-site Fetch Metadata. Send `Content-Type: application/json` whenever the endpoint accepts a body. Empty DELETE/logout requests need no body. JSON reads have streaming byte limits, not only Content-Length checks. No cross-origin CORS access is granted. Errors are `{ "error": "Readable message" }`, with no database details or submitted PII. Relevant statuses are 400, 401, 403, 404, 409, 413, 415, 429 and 503. A 429 includes `Retry-After`.

## Public submission

`POST /api/leads` accepts a maximum 32 KiB object:

```json
{
  "idempotency_key": "f0214ec7-78fc-463f-9a4e-de06210e64f3",
  "form_name": "enquiry",
  "website": "",
  "form_data": {
    "first_name": "Alex",
    "last_name": "Example",
    "email": "alex@example.com",
    "phone": "+44 7700 900123",
    "service": "Service one",
    "contact_method": "Email"
  },
  "visitor_id": "47ca7916-c763-4b9c-bec0-e41f817b1b91",
  "analytics_consent": true,
  "attribution": {
    "first_touch": { "utm_source": "google", "gclid": "click-id" },
    "latest_touch": { "utm_source": "email", "utm_campaign": "spring" }
  },
  "landing_page": "/",
  "referrer": "https://example.org/article"
}
```

The idempotency key must be 16-128 letters, digits, underscores or hyphens; `crypto.randomUUID()` is suitable. Keep the same key and same details through retries after a timeout. Required fields, email, phone, checkbox booleans and configured select choices are validated on the server. Unknown form fields are rejected. An optional empty `form_data.website` honeypot is tolerated but never saved; a populated honeypot is rejected. Only declared form fields are stored. Update the form and `site-config.formFields` together.

Attribution accepts `source`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`, `utm_source_platform`, `utm_creative_format`, `utm_marketing_tactic`, `gclid`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`, `landing_page` and `referrer` in first/latest touch. Arbitrary query parameters are not admitted. Landing URLs must be same-origin configured paths. Referrer query strings and fragments are stripped. Raw IPs are never saved. Lead payloads and response bodies are never logged. Public leads are limited to 12 requests per IP per 10-minute fixed window. This is a basic abuse control, not a claim of bot-free traffic; add an optional managed challenge for a site under attack.

On acceptance, D1 atomically commits the lead, creation history and webhook outbox records. Only then does the endpoint return HTTP 201:

```json
{ "ok": true, "lead_id": "...", "receipt_id": "...", "duplicate": false }
```

A retry with the same key and normalized details returns the same IDs, HTTP 200 and `duplicate: true`. Reusing that key for different details returns 409. There is no local-only success fallback. The public page must check the HTTP result, `ok === true`, `lead_id` and `receipt_id` before showing a successful thank-you state. A webhook failure never changes CRM success to failure or causes a false retry submission. Receipt IDs are acknowledgments, not credentials, and do not provide public access to contact information.

## Visits and conversion reporting

`POST /api/visits` accepts `{ "event_id": "UUID per page navigation", "visitor_id": "consented browser UUID", "path": "/", "analytics_consent": true, "attribution": {"utm_source":"google","utm_medium":"cpc"}, "referrer":"https://referrer.example/" }`, maximum 8 KiB. It returns `{ "ok": true, "measured": true|false, "event_id":"accepted UUID", "duplicate":false }` for a measured visit. Add that confirmed ID as `visit_event_id` on the lead submission; never invent a measurement confirmation. Only configured paths are measured; `/index.html` aliases `/` when both exist in configuration. Visits are limited to 240 requests per IP per hour. Analytics mode is `consent` by default; measurement requires an explicit boolean consent. `essential` permits measurement without that flag; use it only when the site's configured privacy approach calls for it. `disabled` (also legacy `off`) disables measurement. DNT and GPC always disable measurement and conversion attribution, even with an explicit consent flag. The contact itself can still be saved.

Lead attribution and optional visitor/ad tracking are separate settings. `analytics.attribution_mode: "lead"` attaches first-party campaign/referrer context to the submitted enquiry without enabling `/api/visits`, GTM or advertising matching. `privacy.consent_ui` is `external`, `disabled` or the compatibility-only `internal` control. New builds should explicitly select `external` when a jurisdiction-appropriate CMP will be integrated, or `disabled` when optional tracking is off. External providers must call `LeadFunnel.setConsent(true|false)` from their current-page consent signal; a saved value from an earlier internal control is deliberately not trusted as that signal. Never call the adapter merely to fabricate consent. `disabled` keeps optional measurement and advertising matching off even when an old stored allow value exists. Missing legacy configuration retains the internal control for compatibility, not as the default for newly scaffolded projects.

The database records a daily HMAC of the random browser UUID, reporting day and path, never the raw browser UUID. The hash rotates by the configured timezone's calendar day. Each accepted navigation is stored once by event ID; Unique mode deduplicates by browser/day, while All mode includes repeat visits. Only normalized source/device/traffic categories are stored with analytics. The analytics table contains no names, contact details, referrer, query strings or IPs. Lead attribution is separate CRM data.

`GET /api/admin/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` returns:

```json
{
  "days": [{ "date": "2026-09-16", "visitors": 20, "conversions": 3, "leads": 5, "conversion_rate": 15 }],
  "totals": { "visitors": 20, "conversions": 3, "leads": 5, "conversion_rate": 15 },
  "timezone": "UTC",
  "definition": "...",
  "analytics_mode": "consent"
}
```

Dates are inclusive, zero-filled and interpreted in the configured timezone; default range is 30 days, maximum 100 calendar years. Optional `path=/...` narrows to a configured landing page. By default visitors are distinct measured browsers per day. With `visitor_mode=all`, visitors count measured page visits and conversions count visits producing at least one lead. Both modes use the same selected visit cohort for numerator and denominator; repeat lead submissions cannot inflate conversions. Leads counts every accepted distinct submission, including unmeasured leads and contacts later removed from the CRM. Conversion rate is a 0-100 percentage, computed from converted visitors / measured visitors, never all leads / visitors. Totals sum daily unique counts and calculate a weighted rate, not an average of daily rates. The numeric zero when the denominator is zero should render as `-` or “No measured visitors” in the dashboard. Consent choices, blockers, cross-device browsing and midnight boundaries mean this is measured-browser reporting, not a census of people or advertising-platform attribution.

## Admin contact APIs

- `GET /api/admin/config` → `{ brand: { name, color, logo }, stages: [{ id, label }], timezone, analytics_mode }`.
- `GET /api/admin/leads?q=&status=&source=all&page=1&limit=50` → `{ leads, total, page, limit }`. Search matches name/email/phone literally; limit is 1-500. All and an omitted status show all visible stages. Pagination is required for a complete export.
- `GET /api/admin/leads/:id` → `{ lead, notes, activity }`.
- `PATCH /api/admin/leads/:id` with `{ status, version }` → `{ lead }`. The version must match current state; a stale edit returns 409. The fixed IDs are `new`, `qualified`, `engaged`, `follow_up`, `won`, `lost`; only their display labels should be customized.
- `POST /api/admin/leads/:id/notes` with `{ body }`, up to 4,000 characters → `{ note: { id, body, created_at } }`.
- `DELETE /api/admin/leads/:id` → `{ ok: true }`. This is **soft removal**, hides the contact from list/detail and cancels pending webhook jobs. It preserves historic reporting and the underlying record. It is not a data-erasure endpoint. Apply the site's separate retention/deletion policy for permanent removal, including any receiver copies.

Lead objects include `id`, `receipt_id`, `created_at`, `updated_at`, `reporting_day`, `name`, `email`, `phone`, `status`, `version`, `form_name`, `form_data`, full first/latest `attribution`, `landing_page`, `referrer` and flattened source/click/UTM fields. Internal idempotency keys, payload hashes and visitor hashes are never returned. Source falls back from latest touch to first touch, then referral/direct. Notes have `id`, `body`, `created_at`. Activity has `id`, `event_type`, `from_status`, `to_status`, `description`, `created_at`.

## Account email delivery

Account-action email delivery is at-least-once across reset-approval lease recovery. If a provider call outlives its 90-second claim, an administrator may retry and the provider may deliver both messages. An action becomes usable only when its post-send database transition still owns the current request claim; a superseded action remains failed, so only the latest approved reset token can be used. Operators should tell recipients to use the latest message and should not treat provider acceptance as proof of inbox delivery.

## Webhooks and recovery

- `GET /api/admin/webhooks` → `{ webhooks: [{ id, name, url, enabled, created_at, pending_count, failed_count, last_delivered_at }] }`.
- `POST /api/admin/webhooks` with `{ name, url, enabled: true }` → `{ webhook }`. Up to ten destinations. This configures future submissions; it does not export historical contacts.
- `DELETE /api/admin/webhooks/:id` → `{ ok: true }`, including cancellation of queued deliveries to that receiver.

Destinations require a public HTTPS hostname, default HTTPS port, no embedded credentials or fragments. IP literals, private/reserved DNS answers and local names are rejected. Public DNS is checked on creation and again before every delivery. Redirects are never followed, including DNS redirects. Only configured authenticated-admin destinations receive contact PII; payloads are not sent to a generic analytics endpoint.

The outbox sends `{ event: "lead.created", event_id, created_at, lead }` with a stable `X-CRM-Event-ID`. A receiver must deduplicate by `event_id`: delivery is at-least-once, since an interrupted acknowledgment can cause a retry. When `WEBHOOK_SIGNING_SECRET` is configured, `X-CRM-Signature: sha256=<hex>` authenticates the exact `${timestamp}.${rawBody}` using HMAC-SHA256; the timestamp is in `X-CRM-Timestamp`. Receivers should check freshness and compare signatures in constant time. No session secret is sent or reused for this purpose.

Each pass handles at most five jobs to bound Workers work. A claim token and 90-second lease prevent overlapping workers from claiming the same live job. Failed requests become eligible after one minute and then back off exponentially, with five total attempts; the configured five-minute cron processes due work on its next tick, so actual retry latency is rounded up to that cadence. The same scheduled pass performs expired session and rate-bucket cleanup. Do not remove it just because an immediate local request delivered successfully. A crash on the final attempt becomes terminal after its lease expires. Failed-job retry/replay is an operator database action, not a hidden frontend success state.

`GET /api/health` returns only `{ ok: true, database: "connected" }` after a D1 schema query. It does not disclose leads, secrets or account metadata.

## Verification boundary

`tests/backend.test.mjs` bundles the real Worker and uses Miniflare's actual Workers runtime and SQLite-backed D1. It verifies authentication, protected aliases, CSRF, bounded/validated submissions, concurrency/idempotency, stage conflict handling, notes, measured conversion math, consent/DNT/GPC, public-destination filtering, durable webhook jobs and logout. Network webhook receivers are controlled mocks. These local tests are not proof of a deployed Cloudflare account, a connected custom domain, real lead delivery, a production DNS destination or browser rendering; the guided deployment must verify those separately.

The authenticated configuration includes `earliest_date`, the first reporting date recorded in visits or accepted leads. The All time picker uses this bound through today in the configured reporting timezone.

## Traffic and device filters

Metrics accepts `visitor_mode=unique|all`, `device=all|desktop|mobile|unknown`, `traffic=blended|paid|organic|other|unknown`, and `source=all|google|facebook|instagram|microsoft|direct|other|unknown`, combined with dates/path. Invalid or repeated filter parameters are rejected. Leads accept the same source/device/traffic dimensions independently of the overview UI. Returned leads expose normalized `traffic_source`, `traffic_type`, and `device` while retaining original CRM attribution.

Metrics also returns `lifetime_totals` for the same filter combination, normalized `filters`, and `coverage`/`warnings`. Count and Rate change only chart presentation. Daily conversion rate is conversions divided by selected visitors; period/lifetime rates use their aggregate counts, never an average of rates.

Google ad click IDs identify Google paid traffic; Microsoft click IDs identify Microsoft paid traffic. TikTok click IDs are retained and classified in the schema-compatible Other/Paid bucket, while the CRM renders a human TikTok Paid label from the raw touch. Facebook click IDs identify a Meta source but do not alone establish paid traffic. Explicit paid UTM media classify paid traffic. Recognized Google/Bing referrers with no paid evidence use an organic-search inference; unknown or stripped attribution cannot be reconstructed. Social clicks without paid/organic evidence remain unknown traffic type. Mobile includes tablets; absent/unrecognized/headless user agents remain Unknown.

Migration 0002 preserves original daily-unique visit records as historical Unknown events and retains their existing conversion links. Historical repeat page visits cannot be recovered, and source/device filters must not retroactively guess them. Where original lead UTMs/click IDs exist, the lead source can be classified separately from historical visitor data. The dashboard displays this coverage limitation. Always apply all migrations on upgrades.
