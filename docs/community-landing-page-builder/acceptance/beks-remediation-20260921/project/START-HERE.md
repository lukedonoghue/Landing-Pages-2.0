# Your Cloudflare funnel

Your public page, brochure, admin CRM, API, leads and visitor/conversion records are published together on Cloudflare. Workers serves the application and D1 stores the data. GitHub, Supabase, Netlify and a separate analytics account are not required.

## Resume work

Ask the agent to run `python3 scripts/workflow.py resume .` and continue from the reported evidence and next action. This reuses existing valid local checks; it does not publish or create a new image request. An uncertain external operation must be inspected before any retry.

## Build and preview

Use Node.js 22.19+, run `npm ci`, `npm run setup`, then `npm run dev`. Marketing files live in public/. Finish client configuration, browser testing and visual review before publishing. The local admin password is in .secrets/local-admin-password.txt.

## Publish to Cloudflare

Tell the agent: “Publish this funnel to Cloudflare.” It handles the setup and publishing commands for you. Connect Cloudflare once if needed and provide the intended account/domain; a workers.dev address can be used before a custom domain is ready.

After the complete local final, the agent reuses your existing explicit setup/publishing instruction and runs `npm run setup -- --cloudflare --site <site-name> --account-id <account-id> --admin-username <owner> --authorization-file <private-message-file> --authorization-message-id <conversation/message-reference>` (plus `--domain leads.example.com` if chosen), refreshes evidence for that configuration, records the same real publication instruction with `workflow.py authorize-publish`, then runs `npm run publish`. If the initial request did not include publishing, the agent asks once at this stage. This provisions/binds the D1 database, applies schema migrations, sets up admin access and publishes the page, CRM and API to the same Cloudflare account. Production uses its own generated password. A controlled live test lead is submitted only when separately authorized. The agent then verifies the live page, admin, lead receipt and reporting.

The first account connection and domain ownership cannot be skipped. After those are configured, publication is one guided action; the user does not have to operate several hosting/database products.

## Optional source backup

Use GitHub only if requested. `npm run github -- --repo owner/repository` is an optional source backup and is not a publishing dependency. An optional GitHub Actions workflow is included only when the scaffold uses --with-github.

Never share .secrets/, .dev.vars or local .wrangler data. Production admin access is handed over separately from source files.
