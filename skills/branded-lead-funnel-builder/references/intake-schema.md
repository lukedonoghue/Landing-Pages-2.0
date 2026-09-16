# Intake Schema

## Discover before asking

From the client site and supplied files, try to recover:

- legal/brand name, logo, colors, typography, imagery, phone, URLs, geography;
- services, service-fit distinctions, process, FAQ, proof, testimonials;
- desired page audience and likely search intent;
- reference-page offer, CTA, section order, proof placement, form behavior;
- existing brochure/catalogue and source assets;
- existing CRM, webhook, analytics, privacy, and hosting configuration.

Do not ask the user to repeat information that is available from those sources.

## Choices that require confirmation if genuinely missing

- the single primary conversion and deliverable;
- the exact CTA wording when several offers are equally plausible;
- the exact form fields and qualification choices;
- the operational follow-up promise;
- whether the brochure is gated or public;
- whether publishing, CRM connection, analytics, or a real test lead is in scope;
- any claim that cannot be verified but the user wants to make.

Proceed with an explicit, reversible assumption when the answer will not materially change the funnel.

## Project configuration

Create `funnel.json` near the project root:

```json
{
  "client": {
    "name": "",
    "website": "",
    "phone_display": "",
    "phone_uri": "",
    "region": "",
    "privacy_url": ""
  },
  "reference_urls": [],
  "audience": "",
  "search_intent": "",
  "offer": "",
  "cta": "",
  "follow_up_promise": "",
  "brochure_gated": true,
  "form_fields": [],
  "webhook_url": "",
  "tracking": {
    "gtm": "",
    "ga4": "",
    "google_ads": "",
    "meta": ""
  },
  "publish_target": "local-only"
}
```

Empty external-integration values are valid for a local build. They must surface as launch warnings.

## Recommended project tree

```text
project/
├── index.html
├── thank-you.html
├── styles.css
├── script.js
├── funnel.json
├── assets/
│   ├── brochure/
│   ├── fonts/
│   ├── images/
│   │   └── optimized/
│   └── reviews/
├── docs/
├── build/
└── screenshots/
```

Use `scripts/scaffold_project.py` to create the directories and starter evidence files without overwriting existing work.

## Workers/CRM extension

The default generated structure now puts marketing files in `public/` and includes `src/`, `migrations/`, `tests/`, and guided `scripts/`. The earlier static tree applies only to `--static-only`. `funnel.json` has schema_version 3 (complete workflow with copy, image, performance and browser gates), backend provider `cloudflare-d1`, receipt response contract, analytics mode/timezone, and the exact `form_fields`. Run `npm run configure` to materialize shared client/form/analytics settings into `src/site-config.json`; update the page labels/options and `funnel.js` analytics mode to agree, then run static and functional checks. The default metric is measured daily browsers who submit accepted leads; all leads are a separate count. Configure a real privacy URL/policy before publishing.
