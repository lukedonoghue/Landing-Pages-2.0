# External DNS Pages Gateway

Reviewed 2026-09-22. Use this adapter when the owner keeps authoritative DNS at Namecheap or another external provider and wants two subdomain CNAME records. Cloudflare Pages supports external-DNS subdomains after they are associated with the Pages project. This procedure does not support an apex domain and does not require a Cloudflare zone or nameserver migration. [Custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## Prerequisites

- Keep the existing production Worker, its assets, D1 database, secrets and scheduled jobs in place. Confirm its deployed name and account ID; pin both in its existing flat `wrangler.jsonc` configuration.
- Select two distinct owner-approved subdomains, one public and one CRM. Confirm that they are subdomains of a domain the owner controls; syntax validation alone cannot establish domain ownership or identify every public suffix.
- Have a Pages project in the same Cloudflare account, with a known production branch. Use the existing pinned Wrangler installation (tested with 4.115.0). The parent/operator owns Pages project creation and deployment.
- Verify the exact production Pages hostname in the dashboard or Pages project API before building. This narrow adapter accepts only `<project-name>.pages.dev` matching the selected project. Stop on an assigned-hostname mismatch; do not guess or authorize wildcard/preview aliases.
- Configure the backend public/CRM hosts to match the gateway's two custom hosts. Configure any existing backend origin settings, confirmation links and Turnstile hostname permissions for the intended production hosts. The adapter does not rewrite these settings.

## Backend Host Configuration

The maintained `src/worker.js` already accepts the exact `siteConfig.pagesGatewayHost` as a unified production host while preserving public/CRM separation and authentication/CSRF checks. Set `requested_hosts.pages_gateway` to the same lowercase production hostname passed to the generator, then run `npm run configure` and the normal backend gates. Do not patch the Worker for each build and do not add an `endsWith('.pages.dev')` rule. The adapter passes the original request unchanged, so the backend sees the original host and Origin.

## Build and Deploy

Run from the existing Worker project root. Replace the example values with the verified project, account and approved custom hosts. `account-id` must exactly match the existing Worker's `account_id`; the service target is taken from that file's `name`. This repo uses strict JSON in `wrangler.jsonc`.

```sh
node scripts/build-pages-gateway.mjs \
  --project example-gateway \
  --pages-host example-gateway.pages.dev \
  --account-id YOUR_32_CHARACTER_ACCOUNT_ID \
  --public-host go.example.com \
  --crm-host crm.example.com
```

This local command produces exactly:

```text
build/pages-gateway/wrangler.jsonc
build/pages-gateway/public/_worker.js
build/pages-gateway/public/_routes.json
```

The config defines only the project, compatibility date, four non-secret host/project variables, output directory and `FUNNEL` service binding to the existing Worker. It copies no account identifier, runtime secrets, assets, database bindings or scheduled jobs. Unexpected files in the generated output cause a build failure; do not publish extra files there.

After the parent has deployed the backend host change and reviewed the generated config, the exact deployment command sequence is:

```sh
cd build/pages-gateway
CLOUDFLARE_ACCOUNT_ID=YOUR_32_CHARACTER_ACCOUNT_ID \
../../node_modules/.bin/wrangler pages deploy ./public \
  --project-name example-gateway \
  --branch main
```

Use the Pages project's actual production branch in place of `main`. Run from `build/pages-gateway` so Wrangler discovers this Pages config. Pages configuration rejects `account_id`, so keep the verified account ID in `CLOUDFLARE_ACCOUNT_ID` for both project creation and deployment. Wrangler 4.115.0 rejects a custom `--config` path for `pages deploy`; do not run the command from the Worker root. Do not upload the containing directory or invoke `wrangler deploy`.

If the parent needs to create the Pages project first, this is an explicit operator action, from the project root, after selecting the correct account in the CLI environment:

```sh
CLOUDFLARE_ACCOUNT_ID=YOUR_32_CHARACTER_ACCOUNT_ID \
  ./node_modules/.bin/wrangler pages project create example-gateway \
  --production-branch main --force
```

The pinned Wrangler's `--force` retains Pages project creation instead of delegation to Workers for new static projects. Confirm the resulting production hostname before building. CLI credentials remain in the deployment environment; the gateway requires no secret. These commands are instructions, not actions performed by the generator. [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) and [direct upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)

## Namecheap Records

1. Associate both exact custom subdomains with the Pages project under Custom domains first. Creating only DNS records without this association can produce a 522 response.
2. In the existing authoritative Namecheap DNS, create `CNAME go -> example-gateway.pages.dev` and `CNAME crm -> example-gateway.pages.dev` (use the approved labels and verified target). Review and record any existing records at those two names before replacing conflicts.
3. Leave nameservers, apex records, MX and other unrelated records unchanged. Wait for both custom domains and HTTPS certificates to become active in Pages.
4. Set Pages Settings > Runtime > Fail open / closed to **Fail closed**. No static application files are uploaded to the gateway, and all requests must pass through it.
5. Parent verifies public/CRM host separation, a real login and logout, cookie attributes, existing form origin checks, assets, and the exact production Pages host. Preview deployment URLs intentionally return 421 and are not suitable for this smoke check.

## Behavior and Quotas

The advanced-mode module permits exactly the two custom HTTPS hosts and the selected production Pages host. Unknown hosts, preview aliases, non-default ports and HTTP requests receive 421. Invalid config or a missing service binding returns 503; a binding exception returns a generic 502. There is no network-fetch fallback, retry, URL target parameter, storage or cron. `env.FUNNEL.fetch(request)` forwards the original Request, and the backend Response is returned directly. [Service bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings) and [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)

`_routes.json` includes `/*` with no exclusions, so assets also invoke the gateway. Pages Functions share the Workers Free allowance of 100,000 requests per day per account, resetting at midnight UTC; this deployment is not unlimited static hosting. Service bindings have no extra request charge, but backend CPU/subrequest limits and existing D1 quotas still apply. Stay on Free; reaching the quota can make the site unavailable until reset. No paid upgrade or paid fallback is enabled. [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/), [service binding costs](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) and [all-route/fail-closed settings](https://developers.cloudflare.com/pages/functions/routing/)

## Rollback

Record the previous Pages production deployment and the prior two DNS records before rollout. For a gateway code regression, use Pages Deployments to roll back to the previous successful production deployment, or rebuild/redeploy the previous reviewed adapter with the same production branch. Keep the backend's additive exact-host support while the gateway is serving traffic.

For a first-time cutover rollback, restore only the recorded prior records for the two subdomains, or remove the newly added CNAMEs if those names did not previously exist. Then remove their Pages custom-domain associations when traffic has moved away. The existing Worker URL, database and secrets remain available. If there was no previous subdomain service, rollback will not create one; use the existing Worker URL until the parent completes a corrected deployment. Do not migrate nameservers or restore/delete a database for this rollback.

## Local Verification

```sh
node --test tests/pages-gateway.test.mjs
```

Six bounded tests use synthetic data and two local Miniflare Workers. They cover exact-host rejection, missing bindings, no retry, original object pass-through, generator validation/isolation, backend CSRF Origin, binary bodies/assets, redirects and multiple Set-Cookie headers. They perform no remote mutation or email send.
