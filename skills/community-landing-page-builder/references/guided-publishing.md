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

Reuse the user's existing connection and project choices. If Cloudflare is not connected, guide sign-in once. Use the intended client account; if several accounts are available and the project does not identify one, ask for the missing account choice. Preserve the domain and hostnames already supplied. A workers.dev fallback is temporary and must be labeled as such; it never replaces the requested destination in the completion criteria.

A completely new account or external DNS ownership may need a human step. Describe the result honestly: one guided publishing flow, with one publishing action after initial sign-in/site setup; do not promise that an unconnected account can publish literally without setup.

## First-time Cloudflare authorization

Treat first-time authorization as part of the guided publishing action. A beginner should not have to discover Wrangler OAuth, callback ports, or account IDs.

1. Run `wrangler whoami` before any remote setup. A currently authenticated account is only a local session, not proof that it is the user's intended destination. When the user explicitly chooses the connected account, reuse that verified connection and proceed to step 7; do not require another login or repeat the account question. Confirm required Worker and D1 permissions first.
2. If the session is unrelated, guide switching to the user's selected account. Never deploy to the account that happened to be logged in or sign out an unrelated session without the user's account-switch instruction.
3. Only if disconnected or switching accounts, start `wrangler login` and keep its callback process running until authorization completes.
4. Open the generated authorization URL in the user's computer browser (the system browser on macOS), not the Codex in-app browser. The in-app browser has failed this flow with callback/CSRF errors and may not reach the local `http://localhost:8976/oauth/callback` listener. If opening the system browser fails, provide the current URL for the user to open there manually while the listener remains active.
5. Let the user sign in and approve access manually. Do not enter their password, one-time code, or Cloudflare credentials.
6. After Wrangler reports success, run `wrangler whoami` again. Record the returned account name, account ID, and required Worker and D1 permissions before changing project configuration.
7. Pass that exact verified account ID to setup. Never infer it from a previous login, repository content, email address, or browser session.

Known failed paths and their meaning:

- Opening the OAuth URL in the Codex in-app browser can end at `localhost refused to connect`. The authorization page may have succeeded, but the isolated browser cannot deliver the callback to Wrangler on the Mac.
- Reusing an expired authorization URL produces a CSRF or state mismatch. Stop the stale Wrangler login process, start one fresh process, and use only its newly generated URL.
- Starting several Wrangler login processes or opening several generated URLs makes it easy to approve the wrong state. Keep one callback process and one current authorization URL.
- Changing the callback port does not change Cloudflare's registered redirect URL for Wrangler. Do not use an alternate port as a workaround unless the environment has explicit port forwarding for the registered callback.
- Treating `wrangler whoami` success as publication approval is incorrect. It proves identity and permissions only; the user's actual publish instruction still controls setup and release scope.

Do not install unrelated global Cloudflare agent skills during this flow. The community skill and generated project already contain the required publishing instructions and pinned dependencies.

The agent handles these internal steps, in order:

1. Inspect the existing project and Cloudflare account. Do not introduce other services or require a GitHub repository.
2. After the complete local final, save the user's existing explicit setup/publishing instruction in a private message file. Reuse the initial request when it included publication; otherwise ask once. Decide the domain path from [domain-and-owner-handoff.md](domain-and-owner-handoff.md) before configuring routes. Run `npm run setup -- --cloudflare --site <unique-worker-name> --account-id <account-id> --admin-username <owner> --authorization-file <private-message-file> --authorization-message-id <conversation/message-reference>`. Add `--domain` only for an active-zone Worker Custom Domain that the owner explicitly selected. For external-DNS subdomains, keep the Worker route unset and use the Pages gateway after the backend hosts are configured. The setup command checks the copy and build gates and records the existing authorization before any Cloudflare call. It creates/binds the per-site D1 database and generates production admin credentials. An existing same-name database requires its explicitly verified `--database-id`; never silently attach another client's database.
3. Complete the final local checks and visual review against the configured source. First-time infrastructure provisioning precedes the final snapshot and publication approval. Setup changes deployment configuration, so refresh affected evidence rather than relabeling stale reports. Preserve the user’s already authorized scope and account/domain choices.
4. After destination configuration and refreshed QA, record the real publication instruction with `workflow.py authorize-publish`; reuse the initial publication request rather than requesting design approval. Then run `npm run publish`. It validates current credentials, fixture/selectors, an actual Chromium launch, complete non-skipped tests and the pinned toolchain before first-release remote changes. It freezes the reviewed source/evidence, applies D1 migrations and uploads the Worker/assets with initial secrets in the same version. Subsequent releases retain remote secrets. The existing `npm run deploy` is an equivalent alias.
5. Verify the deployed page, admin access, lead receipt and reporting. For CRM builds, follow [usage monitoring](usage-monitoring.md): preserve the all-role warning, offer the optional read-only connection, and report unavailable coverage honestly. Return the real URL and securely hand over admin access.

Do not repeatedly ask permission for work the user already authorized. Ask only for genuinely missing choices, a required sign-in/ownership action, or an action outside the authorized scope. Do not create a paid plan or buy a domain merely to finish a build.

## Build and test before publication

Scaffold with `scripts/scaffold_project.py <project> --client <name> --website <url> --reference <url>`. Node 22.19+ is required; use the bundled runtime if the system Node is older. Internally run `npm ci`, `npm run setup`, and `npm run dev` for the local database and preview. Source lives in `public/`, `src/` and `migrations/`.

Set the approved client brand, form schema, offer, privacy policy and brochure, and run `npm run configure` to materialize `funnel.json` in the backend. Replace all starter content. Serve through Wrangler so tests exercise the Worker and D1, not a static-only preview.

Run the skill's source/evidence gates, desktop/mobile measurement and actual visual review. Use `npm run verify:live -- --url <local-url> --fixture test-fixture.json --allow-test-lead --password-file .secrets/local-admin-password.txt --project-root .`, with `ADMIN_USERNAME` set to the owner selected during setup. It tests the actual form-to-CRM journey against the isolated local database. See `performance-and-browser-qa.md` for the fixture format, snapshot and browser setup. Never paste passwords into logs or include them in a source handoff.

`npm run deploy:check` verifies readiness: real project configuration, protected admin routes, no simulated delivery, no public credential leaks and current handoff evidence. Passing this check is not proof of a live deployment.

## Domain and final verification

For a requested custom domain, first read [domain-and-owner-handoff.md](domain-and-owner-handoff.md). Identify the registrar and authoritative DNS provider separately, prepare the Cloudflare side, and give the owner only the precise external changes that cannot be completed with the available authorization. Do not guess CNAME targets or assume the demonstration business owns a domain the user can change.

Run that reference's blocker-handoff checkpoint as soon as local final is ready, not after repeated deployment attempts. Send the owner the researched, numbered instructions yourself. If a prerequisite prevents obtaining exact values, send the prerequisite steps now, mark the dependent step as waiting, and obtain the values after it is resolved. Never end with only "connect your domain" or a list of alternatives without explaining the next action. Verify the final `build/owner-handoff.json` with `scripts/validate_owner_handoff.py <project>`; this checks completeness, not live DNS or the truth of the evidence.

Worker Custom Domains need an active Cloudflare zone, but this is not a universal requirement for Cloudflare-hosted subdomains. Preserve external DNS by using the Pages gateway path in [external-dns-gateway.md](external-dns-gateway.md): associate the requested hosts in Pages, provide their exact CNAME target, and verify after the owner saves those records at the existing provider. Do not ask for a nameserver change just because the backend is a Worker. Keep the existing CRM, database and guarded backend release. Domain registration, authoritative DNS and email remain separate decisions, and a pending association does not prove DNS/TLS is ready.

After publication, verify `/api/health`, the public page, responsive layouts, brochure and links, admin login, and unauthorized-access rejection. With an authorized controlled test lead, correlate the response receipt with its stored CRM record, move its stage, add a note, and check the selected visitor/source/device/conversion reporting. Verify optional webhooks or advertising tags separately if enabled.

Record the actual URL, account/database identity, revision, receipt correlation and redacted screenshots in live evidence. Name any genuine login, DNS/TLS or external-verification blocker. Never call the funnel live simply because local tests or an upload passed.

## Retained releases and interrupted publishing

The supported beta profile uses one explicit Cloudflare account, Worker and D1 binding, with a `CF_VERSION_METADATA` binding. The pinned adapter inspects actual Wrangler deployment/version output and requires one fully active version. It checks running version/source/release markers before sending admin credentials and after the controlled journey. Environment overrides, split rollouts and custom build commands need a separately validated adapter.

Each release has a UUID under `build/releases/`. Its sealed package retains reviewed source, copy, hashed approval-message provenance, handoff evidence and linked artifacts. A separate live snapshot and attempt reports record the deployed journey; handoff screenshots are never relabeled as live screenshots. Release directories are ignored by Git. They are an evidence/recovery mechanism, not the finished portable distribution format tracked in B07.

- `npm run publish -- --resume` inspects the saved release. After an uncertain upload it checks the provider marker and retained origin instead of uploading again. It reuses completed journey evidence and reconstructs missing derived reports after an interrupted evidence write. A verified resume compares the active version with the version covered by those reports.
- `npm run publish -- --new-release` starts a newly reviewed revision only after the previous release has validated completed evidence. The new revision needs its own actual final approval and QA.
- Supply current credentials with `--credentials-file /private/path/current-owner.json` (JSON with `username` and `password`) or `--password-file /private/path/current-password.txt`. The helper retains a private file reference. Confirmed CLI recovery updates this reference automatically. After a browser password change, supply its current private file; the bootstrap password is not assumed current. Owner username changes use the guarded account helper and persist in D1. Existing deployments receive a real login/session check before migration/upload. Passwords and session cookies must stay out of command arguments, source, reports and screenshots.
- An active publishing process holds an OS lock inherited by child commands. A saved stage is not proof of a running process. Do not delete the lock file while that process is running.
- `public-checks-only` is incomplete. A full release needs the already authorized controlled synthetic lead. The frozen `allow_test_lead: true` approval is the documented bounded scope for the bundled release sequence: submit one reviewed synthetic contact, complete acceptance, then soft-remove only that contact and read it back as absent. This is not complete erasure; historical visit/conversion metrics retain the explicitly reported test impact. Do not set that approval unless the actual user instruction authorizes this bundled scope. The helper does not expand a frozen read-only approval, and a resumed journey keeps the cleanup scope recorded in its original journal.
- A read-only check against a production URL still requires `--allow-remote`; omitting it is correctly blocked before any request. Pair it with `--read-only`, never `--allow-test-lead`, when the user authorized deployment but did not authorize a synthetic live submission.

Partial synthetic journeys now resume automatically when their version-2 journal and original private request are intact. The journal binds the source, fixture, snapshot, origin, deployed identity and cleanup scope. It retains fixed reporting dates and completed browser evidence. If an acknowledgement was lost, recovery retries the **same request and idempotency key**; it does not create a new contact or measured visit. Completed CRM status changes are reconciled by version, and the verification note has a stable request ID. Cleanup can confirm an already-removed test contact using the verified evidence saved before removal. Actual source is checked before and after each full run.

Do not make a separate D1 deletion or describe a retained contact as cleaned up. Use the handoff's structured `cleanup.disposition`: `pending`, `retained`, or `verified_soft_removed`. The verified disposition must cite the retained guarded `result.json`, whose `cleanup` is `synthetic-contact-soft-removed` and whose post-cleanup readback passed. Its owner note must say plainly that historical test metrics remain and that soft-removal is not complete erasure; keep internal lead IDs and QA detail in the report, not the CRM setup UI. Validate the handoff with `scripts/validate_owner_handoff.py`; an absent, failed or `retained-synthetic-contact` report cannot support `verified_soft_removed`.

The original synthetic form/visit requests are stored with private file permissions under `.secrets/journeys/`. Public reports contain IDs, hashes, redacted HTTP paths and aggregate metrics, not contact fields or credentials. Preserve those private files for unfinished recovery; do not include them in Git or a source handoff. Recovery does not persist browser cookies or owner passwords in its journal. Each logical journey permits at most three runs, with individual reports retained under its `runs/` directory.

Known boundaries remain: legacy journals, missing/changed private payloads, changed source/version, concurrent CRM edits, exhausted retries, an unconfirmed migration, missing upload origin or failed release needing a corrected replacement require diagnosis/reconciliation. An unfinished submission crossing a reporting-day boundary may no longer correlate with its original visit and must not be treated as verified. Do not delete the release pointer, reset request IDs, fabricate reports or reupload as a workaround. Explicit superseding/reconciliation and a real Cloudflare pilot remain B03/B18/B19 acceptance work.

## Optional source backup and CI

Only offer GitHub if the user wants off-device source backup, collaboration or Git-based automatic updates. It is not part of the default publishing sequence. `npm run github -- --repo <owner/repository>` is an optional private source-backup helper. Use `--with-github` when scaffolding only if the user wants the optional GitHub Actions template.

For a requested Git integration, Cloudflare remains the host and D1 remains the database. Protect the production branch and push reviewed source only. Avoid storing real lead exports, credentials or local D1 files in a repository.

## Handoff and recovery

Provide the project source/archive and its publishing guide, plus admin access through a separate secure handover. Cloudflare holds the deployed application, data and secrets; local files or an optional repository hold source history. A code rollback does not undo a database migration. Prefer additive migrations and take an appropriate D1 backup/export before any authorized destructive schema change. Document client account ownership and retention/recovery arrangements.
