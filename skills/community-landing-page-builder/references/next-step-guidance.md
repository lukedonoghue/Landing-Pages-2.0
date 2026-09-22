# Owner next-step guidance

Use this when the owner asks “what next?”, “how do I finish?”, “can this go live?”, or a similar progress question. Inspect the current project and run its workflow status/resume helper when present. Answer from the actual stage, not from a generic integration checklist.

## Product defaults

For a form-led page, the bundled Cloudflare Workers + D1 CRM is the selected destination unless the user explicitly chose static-only or another system. It includes lead storage, owner login, pipeline, notes, attribution, reporting and account controls. Do not ask which CRM the user uses or require a Google Sheet. Do not make GTM, Google Ads IDs, a custom domain, GitHub or an external analytics account prerequisites.

External CRM synchronization, Google Sheets, GTM, advertising conversions, email notifications and custom domains are optional connections after the built-in page-to-CRM journey works. Offer them only when relevant or requested.

## Choose the one current action

1. **PDF guide is missing, placeholder, unrendered or undelivered:** finish `build/guide.json`, run `python3 scripts/build_guide.py .`, inspect every page and confirm the thank-you `data-guide-embed` preview plus `data-guide-download` fallback. This is agent work, not a request for the owner to supply a PDF.
2. **Form-led project is static or has no backend:** explain that the built-in CRM should have been included. Preserve the finished page and integrate the maintained `assets/cloudflare/` module; do not discard the design or ask the owner to choose another CRM. Test locally before proposing publication.
3. **CRM is scaffolded but local setup is incomplete:** install locked dependencies, run local setup, open the page and admin, and complete one synthetic local form -> receipt -> D1 -> CRM -> reporting journey. This is agent work and does not need Cloudflare login.
4. **Local journey or QA is incomplete:** fix and rerun the failing local gate. Tell the owner what is being checked; do not ask for production integrations yet.
5. **Local page, guide and CRM are verified, but publication was not requested:** show the finished page, PDF and CRM result, explain that the built-in system is ready, and ask one plain question: “Would you like me to publish this to Cloudflare?” A workers.dev address is the default, so a custom domain can wait.
6. **Publication is already authorized:** connect or reuse the intended Cloudflare account, use workers.dev unless the owner already chose a custom domain, provision one Worker and one D1 database, configure owner access, publish and run public checks. Submit a controlled live test enquiry only when the authorization includes it; otherwise report that as the remaining verification step.
7. **Published and verified:** hand over the public URL, guide download, private admin access route and recovery instructions. Then offer optional integrations such as GTM/ad conversions, Sheets or another CRM without implying they are required for lead capture.

## Response shape

Lead with what is already included and the one next action. Distinguish work the agent can do now from the one user action genuinely needed, such as Cloudflare sign-in or publication approval. Do not ask for information that can be defaulted safely or deferred.

Example for a verified local form-led build:

> The page already includes its own CRM, so you do not need to choose a CRM or Google Sheet. The next step is publishing the page and CRM together to Cloudflare. I can start on a workers.dev address and connect a custom domain later. Would you like me to publish it now?

Do not promise live lead delivery, ad-platform conversion tracking or custom-domain readiness until those exact paths have been tested.
