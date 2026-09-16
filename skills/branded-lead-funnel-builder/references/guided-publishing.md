# Publish the complete funnel to Cloudflare

## User-facing experience

The user builds and reviews their funnel, then says **“Publish to Cloudflare.”** Guide that one action and run the internal preparation, deployment and verification steps yourself. The user should not have to connect a database product, a hosting product and an analytics product separately.

Everything required to run the published funnel lives in the chosen Cloudflare account:

| Component | Cloudflare service |
|---|---|
| Landing page, brochure, thank-you page and CRM interface | Workers static assets |
| Lead submission API, admin actions and login | Worker |
| Leads, customer/contact details, notes, pipeline stages and admin sessions | D1 |
| Visitor events, traffic attribution, daily totals and conversion reporting | D1 + Worker APIs |
| Application secrets | Worker secrets |
| Public address | workers.dev or optional custom domain/subdomain |

GitHub, Netlify, Supabase, and separate analytics/authentication accounts are not required. Webhooks and advertising tags are optional integrations, never prerequisites for the built-in CRM/reporting.

Updating this reusable skill or testing a sample is not an instruction to publish the current client page. Keep that work local. Publish a generated funnel only when the user's task includes publishing it.

## First-time setup inside the guided action

Reuse the user's existing connection and project choices. If Cloudflare is not connected, guide sign-in once. Use the intended client account; if several accounts are available and the project does not identify one, ask for the missing account choice. Use the domain the user supplies, or a workers.dev address until a custom domain is ready.

A completely new account or external DNS ownership may need a human step. Describe the result honestly: one guided publishing flow, with one publishing action after initial sign-in/site setup; do not promise that an unconnected account can publish literally without setup.

The agent handles these internal steps, in order:

1. Inspect the existing project and Cloudflare account. Do not introduce other services or require a GitHub repository.
2. After current copy approval, save the user's existing explicit setup/publishing instruction in a private message file (reuse it; do not ask a third permission question). Run `npm run setup -- --cloudflare --site <unique-worker-name> --account-id <account-id> --admin-username <owner> --authorization-file <private-message-file> --authorization-message-id <conversation/message-reference>`, adding `--domain leads.client.com` only if requested. The command checks actual copy approval and records the existing authorization before any Cloudflare call. This creates/binds the per-site D1 database and generates production admin credentials. An existing same-name database requires its explicitly verified `--database-id`; never silently attach another client's database.
3. Complete the final local checks and visual review against the configured source. First-time infrastructure provisioning precedes the final snapshot and publication approval. Setup changes deployment configuration, so refresh affected evidence rather than relabeling stale reports. Preserve the user’s already authorized scope and account/domain choices.
4. Record the real final publish approval against the configured and reviewed build, then run `npm run publish` once the project is ready. It validates the release, runs tests, applies D1 migrations, deploys the Worker/static assets and installs production secrets. The existing `npm run deploy` is an equivalent alias.
5. Verify the deployed page, admin access, lead receipt and reporting. Return the real URL and securely hand over admin access.

Do not repeatedly ask permission for work the user already authorized. Ask only for genuinely missing choices, a required sign-in/ownership action, or an action outside the authorized scope. Do not create a paid plan or buy a domain merely to finish a build.

## Build and test before publication

Scaffold with `scripts/scaffold_project.py <project> --client <name> --website <url> --reference <url>`. Node 22.19+ is required; use the bundled runtime if the system Node is older. Internally run `npm ci`, `npm run setup`, and `npm run dev` for the local database and preview. Source lives in `public/`, `src/` and `migrations/`.

Set the approved client brand, form schema, offer, privacy policy and brochure, and run `npm run configure` to materialize `funnel.json` in the backend. Replace all starter content. Serve through Wrangler so tests exercise the Worker and D1, not a static-only preview.

Run the skill's source/evidence gates, desktop/mobile measurement and actual visual review. The local browser flow helper is `node scripts/test-flow.mjs --url <local-url> --fixture <synthetic-form-values.json> --password-file .secrets/local-admin-password.txt --browser-executable <browser>`. It tests the form-to-CRM route without touching live customer data. Never paste passwords into logs or include them in a source handoff.

`npm run deploy:check` verifies readiness: real project configuration, protected admin routes, no simulated delivery, no public credential leaks and current handoff evidence. Passing this check is not proof of a live deployment.

## Domain and final verification

A custom domain/subdomain needs an active Cloudflare DNS zone in the selected account. Inspect existing DNS before replacing any record; preserve unrelated live services. If the domain uses another provider, guide the owner through Cloudflare zone/nameserver setup, or use workers.dev for now. A custom domain is optional, and a configured route does not prove DNS/TLS is ready.

After publication, verify `/api/health`, the public page, responsive layouts, brochure and links, admin login, and unauthorized-access rejection. With an authorized controlled test lead, correlate the response receipt with its stored CRM record, move its stage, add a note, and check the selected visitor/source/device/conversion reporting. Verify optional webhooks or advertising tags separately if enabled.

Record the actual URL, account/database identity, revision, receipt correlation and redacted screenshots in live evidence. Name any genuine login, DNS/TLS or external-verification blocker. Never call the funnel live simply because local tests or an upload passed.

## Optional source backup and CI

Only offer GitHub if the user wants off-device source backup, collaboration or Git-based automatic updates. It is not part of the default publishing sequence. `npm run github -- --repo <owner/repository>` is an optional private source-backup helper. Use `--with-github` when scaffolding only if the user wants the optional GitHub Actions template.

For a requested Git integration, Cloudflare remains the host and D1 remains the database. Protect the production branch and push reviewed source only. Avoid storing real lead exports, credentials or local D1 files in a repository.

## Handoff and recovery

Provide the project source/archive and its publishing guide, plus admin access through a separate secure handover. Cloudflare holds the deployed application, data and secrets; local files or an optional repository hold source history. A code rollback does not undo a database migration. Prefer additive migrations and take an appropriate D1 backup/export before any authorized destructive schema change. Document client account ownership and retention/recovery arrangements.
