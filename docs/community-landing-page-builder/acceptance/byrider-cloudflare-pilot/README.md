# Byrider Cloudflare pilot checkpoint

This folder preserves the newest deployable Byrider funnel produced by the independent community-skill acceptance run. It is separate from Luke's original skill and client files.

## Preserved state

- Landing page, responsive assets, verified Byrider fonts, three-step lead form, thank-you page, brochure, Worker backend, D1 migrations, CRM, reporting, tracking, tests, and publishing scripts.
- Cloudflare account verified as `shevabody@gmail.com` with account ID `5b93d5e3c469e05d9bd13672e7887c4a`.
- Production D1 was provisioned by setup. No password, session secret, webhook secret, `.dev.vars`, local D1 data, or private journey record is committed.
- Production D1 migrations `0001` through `0005`, Worker secrets, page assets, API, and CRM were deployed successfully.
- Live page: `https://byrider-franchise-community-pilot.shevabody.workers.dev`
- CRM login: `https://byrider-franchise-community-pilot.shevabody.workers.dev/login.html`
- D1 database ID: `f9fe304e-45bd-433e-8338-5b99b9ec7e6c`
- Worker version ID: `704a65c8-b25c-4f91-b3cd-98b0f3aa0c4b`

## Current verification state

- Rendered-copy parity: pass.
- Chromium and WebKit compatibility: pass on the current page source before the final evidence timestamp refresh.
- Performance after responsive hero conversion: 100 score, 1,875 ms median LCP, 0.0068 CLS, 0 ms TBT.
- Visual review: page and form passed desktop and mobile inspection.
- Final evidence refresh was interrupted after a long-lived local Wrangler preview exited. The failed report correctly recorded `ECONNREFUSED`; it is not a page failure.
- Production read-only verification passed with no public-route, asset, brochure, health, or anonymous-access failures. No synthetic lead was submitted.

## Correct resume order

1. Copy `project/` to a clean working directory and run `npm ci`.
2. Recreate private production secrets through `npm run setup`; never invent or commit them.
3. Start one fresh `npm run dev` process.
4. Create the handoff snapshot before audits.
5. Run rendered-copy, responsive, browser-compatibility, and performance audits sequentially.
6. Record each current report through `scripts/check_gates.py`.
7. Record explicit publish authorization from the user.
8. Run the guarded publisher, apply D1 migrations, upload secrets, deploy the Worker, and perform live verification.
9. Return the public page URL, CRM login URL, and private credential handoff location.

## Authorization lesson

Wrangler OAuth must be completed in the normal system browser while the single active `wrangler login --browser=false` process is listening on its default callback port. The Codex in-app browser cannot complete the host callback. Reusing an expired URL, running multiple login processes, or changing only the local callback port causes refusal or CSRF/state mismatch errors.
