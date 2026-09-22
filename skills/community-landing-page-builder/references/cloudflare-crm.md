# Cloudflare CRM module

The reusable module is in `assets/cloudflare/`. Scaffold it with `scripts/scaffold_project.py <destination> --client <name>`. This copies source, never credentials, local databases, node_modules, or existing client leads. Re-running the scaffold preserves existing files.

**Reuse the CRM, do not rebuild it for each business.** Treat the bundled Worker, database repository, authentication, account workflows, attribution client and admin UI as one maintained implementation. Customize the business identity, hostnames, form schema, stages, timezone and selected privacy/tracking settings through configuration; build the marketing page around the existing form/API contract. Do not hand-write replacement UTM capture, lead storage or login code. A genuine shared bug is fixed in this module with regression tests, then deliberately propagated to the affected project. Never copy another customer's credentials, database, users or leads. For an existing deployment, preserve its identity and data and apply additive reviewed migrations rather than provisioning a replacement CRM.

During the existing static/configuration pass, run `python3 <skill>/scripts/verify_backend_reuse.py <project> --report <project>/build/backend-reuse.json`. It compares the shared code and migrations with this skill version while excluding per-business configuration. Resolve drift by inspecting the diff; never overwrite newer or client-specific code blindly. A permitted core change requires its reason and regression coverage, not simply refreshing expected hashes. Passing identity checks do not prove attribution settings or delivery: the positive stored-field test in `lead-and-tracking-contract.md` is still required.

## Architecture

Public HTML/CSS/JS and the brochure live in `public/`. A Worker serves those static assets and handles `/api/leads`, `/api/visits`, and authenticated `/api/admin/*`. `assets.run_worker_first: true` ensures even encoded admin aliases reach authentication. The admin UI has its own assets under `public/admin/`; the marketing page does not load them.

Each client/site gets one Worker and one D1 database in the chosen Cloudflare account. The public page, brochure, admin interface, lead APIs, authentication sessions, CRM records and built-in reporting are all served or stored there. GitHub is optional source storage only; neither it nor Supabase, Netlify, GA4 or GTM is required for this stack. `src/repository.js` isolates lead storage from HTTP and UI concerns. The schema stores arbitrary approved form answers in JSON so new custom fields require configuration, not a table migration. Do not add another hosting/database platform unless the user specifically requests it.

## Configure a new client

Use `funnel.json` for the approved brief, offer, CTA, form schema, tracking mode, and publishing choice. Materialize backend settings in `src/site-config.json`: name, logo, accent, reporting timezone, allowed marketing paths, stages, and `formFields`. The frontend names/options must exactly match the server-side schema. Validate their agreement before release.

Default stages are New contact, Qualified, Engaged, Follow-up, Won, and Lost. The CRM supports drag-and-drop and a keyboard/mobile stage selector, table search/filtering/pagination, full form/attribution details, notes, activity, and removing a contact from the active CRM. Remove contact is a soft delete and preserves historical accepted-lead metrics. Account → Data retention & erasure provides the separate permanent operation and configurable cleanup; read [data-lifecycle.md](data-lifecycle.md) before using them.

## Lead list and submission detail

Keep the leads table and pipeline cards focused on contact, stage, received time and one concise source label, such as Google CPC, Meta Paid Social or Microsoft CPC. Do not display campaign IDs, UTMs, click IDs, landing URLs or extra form answers as table columns or subtitle clutter. Derive the source label from recorded source/medium/type without treating an unclassified Meta click as paid or a Google click as necessarily CPC.

Opening an enquiry exposes its submitted form answers and an Attribution section. Keep first-touch and latest-touch campaign fields in separate, keyboard-accessible collapsed groups; preserve exact field names and values, including GBRAID/WBRAID. Long IDs wrap without changing the dialog width. Keep a legacy recorded-campaign group for old flattened records and an honest empty state for missing/denied attribution. Use the existing restrained CRM typography, dividers and spacing, not landing-page hero treatments. Check the table and expanded details at desktop and narrow mobile widths with synthetic data.

Lead details close with the close control, Escape or a click on the backdrop, returning focus to the opener. Interior clicks and text-selection drags ending outside must not dismiss them. Reuse the existing form controls and spacing in user management; desktop invitation inputs, selects and submit actions align, and narrow layouts stack without overflow. Password-manager decorations must not introduce extra layout rows or move one input above its peers. Keep these cases in shared UI regression tests rather than asking every new business build to rediscover them.

## Admin authentication

The initial named owner uses a generated strong password and a salted PBKDF2 hash. D1 stores subsequent owner changes and additional team accounts. Expiring random sessions are stored only as HMAC hashes and are bound to each account's version. Cookies are HttpOnly, SameSite Strict, and Secure outside localhost. There are no shared demo credentials and no localStorage authentication. Mutations require a matching Origin. Login and submission endpoints have server-side rate limits. Setup creates separate local and production credentials and never prints them into tool logs.

The CRM supports Admin, Manager and View-only roles, enforced in the Worker as well as the UI. Admin manages users and approved reset requests. Manager has operational access but cannot administer identities. View-only can read leads/reports but cannot mutate operational data, export contacts or access integration settings. Every user can change their own password with the current password and revoke their own sessions. See [team-access.md](team-access.md) for invitations, registered-email confirmation, deployment prerequisites and the focused role matrix. Password changes, disabling accounts and role changes invalidate affected sessions. The original owner cannot be disabled or demoted in the CRM.

## Metric definitions

Keep Cloudflare hosting usage separate from lead/visitor reporting. Retain the shared all-role usage banner and follow [usage-monitoring.md](usage-monitoring.md) for optional read-only setup, threshold warnings and unavailable coverage. Never infer account quota consumption from lead counts.

- Visitors: Unique mode counts measured browsers once per reporting day; All mode counts every measured page visit. Repeat page refreshes count once in Unique mode and separately in All mode; bots, non-consenting visitors, blocked requests, and cross-device identity cannot be perfectly measured.
- Conversions: measured browsers (Unique) or visits (All) linked to at least one accepted lead in the selected source/device/traffic cohort. A second accepted enquiry within the same browser/day or visit does not inflate the corresponding count. Rate mode and Count mode are chart presentations of these same selected counts.
- Conversion rate: conversions divided by visitors, multiplied by 100. Zero visitors displays no rate. The period rate uses the summed numerator and denominator, not an average of daily rates.
- Leads: every accepted, deduplicated CRM submission, including visitors who opted out of measurement. This can exceed measured conversions.
- Period visitors sum daily unique browsers, not globally unique people across the period. The interface names this distinction.

Dates use the configured IANA timezone (default UTC). The first-party client excludes thank-you/admin routes from visits.

## Visitor privacy and attribution

Configure `funnel.json` once, then run `npm run configure`. The public `/api/privacy-config` endpoint and server enforcement share the resulting configuration; do not edit a separate frontend mode. Keep `funnel.js`, `privacy-controls.js` and `privacy-controls.css` in every generated funnel. Load `funnel.js` on the landing, thank-you and privacy pages, with `data-measure="false"` on the latter two. When `privacy.consent_ui` is `internal`, the script adds a persistent Privacy choices button to the footer (or uses an existing `[data-privacy-choices]` control), and browser QA must reopen it, use the keyboard and return focus. When the mode is `disabled` or `external`, browser QA instead verifies that the built-in control/dialog stays hidden; an external provider is tested separately when configured.

- `analytics.mode`: `disabled` is the new-project default, so optional visit measurement stays off until deliberately configured. `consent` gates measurement with a consent signal; `essential` enables measurement by default but still allows withdrawal. The name `essential` is a compatibility setting, not a legal classification.
- `analytics.attribution_mode`: `lead` is the new-project default and stores approved campaign/referrer details with the submitted enquiry independently of optional measurement. `consent` gates that capture with the visitor's choice; `disabled` discards it. Select a different policy only for the actual client requirement; do not infer legal applicability from a mode name.
- DNT/GPC takes priority over both measurement and attribution, including `lead` mode. The public wording reflects the active modes. Client-specific privacy information remains required before publication.

Withdrawal clears measurement identifiers and consent-gated first/latest touches, stops future optional requests/events and updates other open tabs. A functional choice cookie contains only allow/deny so the server can reject stale optional data; it contains no visitor identifier. Regrant starts new measurement identifiers. Session-scoped first touch and latest tagged/external-referrer touch are retained only when the attribution policy permits; direct/internal navigation does not overwrite the latest campaign touch. Unknown origin is reported as Unknown, not Direct.

A blocked policy endpoint fails closed for optional data; forms can still submit. Storage restrictions preserve choices in memory for the current page, with a visible persistence limitation. Previously accepted lead data is not erased by changing this choice. CRM removal is still a soft delete; use the separate [data lifecycle controls](data-lifecycle.md) for permanent enquiry erasure and configured retention. Keep contact receipt identity stable during uncertain retries even if optional metadata is withdrawn, and never rewrite previously stored metadata from a retry.

## Webhooks

Built-in D1 is the source of record. An accepted lead atomically queues enabled webhook deliveries. Background/scheduled retries are bounded; errors remain visible in CRM settings. Endpoints must use public HTTPS; private/loopback hosts and redirects are refused. Webhook delivery failure never rejects an already saved lead. Payloads include a delivery/receipt identity so receivers can deduplicate retries. Treat delivery as at-least-once, not exactly-once. Configure `WEBHOOK_SIGNING_SECRET` for HMAC signatures and verify them at the destination.

## Verified platform references

Reviewed 2026-09-16: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [D1 Worker binding API](https://developers.cloudflare.com/d1/worker-api/), [D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/), and [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Check these again when changing platform behavior. The module pins its tested runtime tooling in package-lock.json; do not claim a newer tool release was tested.

## Source and device reporting

The overview has Visitors All/Unique, Device All/Desktop/Mobile, Traffic Blended/Paid/Organic and a source selector for Google, Facebook, Instagram, Microsoft/Bing, Direct, Other and Unknown. All-time comparison values follow the same filters. The CRM board/table has its own source filter, independent of performance filters. Count/Rate line charts expose exact-day details on hover, touch and keyboard.

Use current navigation attribution for visits, not a retained previous paid touch; CRM retains first/latest touches separately. Send the confirmed `visit_event_id` with the lead to correlate it to the exact measured visit. Use `utm_source=facebook&utm_medium=paid_social` (or equivalent verified campaign tagging) for paid Meta traffic; fbclid alone does not prove an ad click. Keep missing historical dimensions Unknown and expose the warning, because old daily-unique records cannot recreate total visits or source/device cohorts.
