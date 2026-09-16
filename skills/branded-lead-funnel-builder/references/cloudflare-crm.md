# Cloudflare CRM module

The reusable module is in `assets/cloudflare/`. Scaffold it with `scripts/scaffold_project.py <destination> --client <name>`. This copies source, never credentials, local databases, node_modules, or existing client leads. Re-running the scaffold preserves existing files.

## Architecture

Public HTML/CSS/JS and the brochure live in `public/`. A Worker serves those static assets and handles `/api/leads`, `/api/visits`, and authenticated `/api/admin/*`. `assets.run_worker_first: true` ensures even encoded admin aliases reach authentication. The admin UI has its own assets under `public/admin/`; the marketing page does not load them.

Each client/site gets one Worker and one D1 database in the chosen Cloudflare account. The public page, brochure, admin interface, lead APIs, authentication sessions, CRM records and built-in reporting are all served or stored there. GitHub is optional source storage only; neither it nor Supabase, Netlify, GA4 or GTM is required for this stack. `src/repository.js` isolates lead storage from HTTP and UI concerns. The schema stores arbitrary approved form answers in JSON so new custom fields require configuration, not a table migration. Do not add another hosting/database platform unless the user specifically requests it.

## Configure a new client

Use `funnel.json` for the approved brief, offer, CTA, form schema, tracking mode, and publishing choice. Materialize backend settings in `src/site-config.json`: name, logo, accent, reporting timezone, allowed marketing paths, stages, and `formFields`. The frontend names/options must exactly match the server-side schema. Validate their agreement before release.

Default stages are New contact, Qualified, Engaged, Follow-up, Won, and Lost. The CRM supports drag-and-drop and a keyboard/mobile stage selector, table search/filtering/pagination, full form/attribution details, notes, activity, and removing a contact from the active CRM. Removal is a soft delete; it is not a privacy-erasure endpoint. Historical accepted-lead metrics remain stable.

## Admin authentication

Single-team-admin login uses a generated strong password, a salted PBKDF2 hash stored as a Worker secret, and expiring random sessions whose HMAC hashes live in D1. Cookies are HttpOnly, SameSite Strict, and Secure outside localhost. There are no demo credentials and no localStorage authentication. Mutations require a matching Origin. Login and submission endpoints have server-side rate limits. Setup creates separate local and production credentials and never prints them into tool logs.

This is intentionally a small-team CRM, not a multi-user roles system. Password rotation must also revoke current sessions. Use Cloudflare Access as an optional additional gate if the client needs identity-provider login. Do not assume an Access app is already configured.

## Metric definitions

- Visitors: Unique mode counts measured browsers once per reporting day; All mode counts every measured page visit. Repeat page refreshes count once in Unique mode and separately in All mode; bots, non-consenting visitors, blocked requests, and cross-device identity cannot be perfectly measured.
- Conversions: measured browsers (Unique) or visits (All) linked to at least one accepted lead in the selected source/device/traffic cohort. A second accepted enquiry within the same browser/day or visit does not inflate the corresponding count. Rate mode and Count mode are chart presentations of these same selected counts.
- Conversion rate: conversions divided by visitors, multiplied by 100. Zero visitors displays no rate. The period rate uses the summed numerator and denominator, not an average of daily rates.
- Leads: every accepted, deduplicated CRM submission, including visitors who opted out of measurement. This can exceed measured conversions.
- Period visitors sum daily unique browsers, not globally unique people across the period. The interface names this distinction.

Dates use the configured IANA timezone (default UTC). The first-party client defaults to explicit analytics consent, honors DNT/GPC, and excludes thank-you/admin routes from visits. Connect `LeadFunnel.setConsent(true|false)` to the site's consent UI. Mode `essential` is an explicit client deployment choice, not a universal legal classification; verify the client's requirements. `disabled` turns measurement off while lead delivery remains available.

## Webhooks

Built-in D1 is the source of record. An accepted lead atomically queues enabled webhook deliveries. Background/scheduled retries are bounded; errors remain visible in CRM settings. Endpoints must use public HTTPS; private/loopback hosts and redirects are refused. Webhook delivery failure never rejects an already saved lead. Payloads include a delivery/receipt identity so receivers can deduplicate retries. Treat delivery as at-least-once, not exactly-once. Configure `WEBHOOK_SIGNING_SECRET` for HMAC signatures and verify them at the destination.

## Verified platform references

Reviewed 2026-09-16: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [D1 Worker binding API](https://developers.cloudflare.com/d1/worker-api/), [D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/), and [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Check these again when changing platform behavior. The module pins its tested runtime tooling in package-lock.json; do not claim a newer tool release was tested.

## Source and device reporting

The overview has Visitors All/Unique, Device All/Desktop/Mobile, Traffic Blended/Paid/Organic and a source selector for Google, Facebook, Instagram, Microsoft/Bing, Direct, Other and Unknown. All-time comparison values follow the same filters. The CRM board/table has its own source filter, independent of performance filters. Count/Rate line charts expose exact-day details on hover, touch and keyboard.

Use current navigation attribution for visits, not a retained previous paid touch; CRM retains first/latest touches separately. Send the confirmed `visit_event_id` with the lead to correlate it to the exact measured visit. Use `utm_source=facebook&utm_medium=paid_social` (or equivalent verified campaign tagging) for paid Meta traffic; fbclid alone does not prove an ad click. Keep missing historical dimensions Unknown and expose the warning, because old daily-unique records cannot recreate total visits or source/device cohorts.
