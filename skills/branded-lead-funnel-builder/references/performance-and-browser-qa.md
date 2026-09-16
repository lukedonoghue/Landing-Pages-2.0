# Measured performance, browser compatibility, and publishing verification

Run these stages after approved copy, design and image work. Keep design quality, accuracy and readability intact while fixing asset size, loading, layout shifts, and JavaScript overhead. An automated check never stands in for the user's copy approval or final publishing approval.

## Project tools and evidence

The generated Cloudflare project includes:

- `npm run qa:performance -- --url http://127.0.0.1:8787 --project-root .`: real Lighthouse mobile runs, raw JSON and measured budgets.
- `npm run qa:browsers -- --url http://127.0.0.1:8787 --fixture test-fixture.json --project-root .`: Chromium and WebKit public-page, dialog, keyboard and responsive checks.
- `npm run verify:live -- --url http://127.0.0.1:8787 --fixture test-fixture.json --read-only --project-root .`: health, anonymous access boundaries, public resources and brochure checks only.
- `npm run verify:live -- --url http://127.0.0.1:8787 --fixture test-fixture.json --allow-test-lead --credentials-file .secrets/admin.json --project-root .`: the actual local public form, thank-you page, receipt, CRM and reporting journey.

Use the project Node version (Node 22.19+ or a supported later release; Node 24 recommended), `npm ci`, then `npx playwright-core install chromium webkit`. Missing binaries or unsupported browser runtimes produce **blocked** evidence, never an automatic pass. The browser scripts use Playwright because portable WebKit coverage and a reproducible test runner are required. Interactive exploration can use agent-browser or computer use separately.

Create a fresh evidence snapshot with `python3 scripts/check_gates.py snapshot . --mode handoff` before these commands. Each report takes its `source_fingerprint` and `target.mode` from `build/gate-snapshot.json`. After source changes, create a new snapshot and rerun the affected checks. Do not copy a successful report from another build. `--out` sets a project-local evidence directory. Reports identify execution time, tool/version, checks, failures, limitations, and hashes for inspectable artifacts. Record them through the evidence checker.

Default destinations:

- `build/performance/result.json`, with `lighthouse-mobile-1.json` through `-3.json`.
- `build/browser-compat/result.json`, with public-page and dialog screenshots for both engines.
- `build/live-verification/result.json`, with redacted HTTP/event traces, stored receipt, and aggregate dashboard results.

## Site-specific fixture

The builder must generate and inspect `test-fixture.json` against the finished page and configured form. Do not guess a service option, selector, brochure path, or required field. Use synthetic identities and a reserved `example.invalid` email. Never place real lead details or admin credentials in this fixture. Match the site's actual selectors and form schema; omit fields the page does not contain.

```json
{
  "synthetic": true,
  "path": "/",
  "thank_you_path": "/thank-you.html",
  "pdf_path": "/assets/services-guide.pdf",
  "required_resources": ["/styles.css", "/script.js", "/funnel.js"],
  "fields": {
    "first_name": "Launch verification",
    "last_name": "Synthetic test",
    "email": "launch-test@example.invalid",
    "phone": "+15555550123",
    "service": "Replace with an actual offered option",
    "contact_method": "Email"
  },
  "query": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "synthetic-launch-verification"
  },
  "expected_dimensions": {"source": "google", "traffic": "paid", "device": "desktop"},
  "selectors": {
    "openModal": "[data-open-modal]",
    "modal": "#lead-modal",
    "step": ".wizard__step",
    "next": "[data-next]",
    "submit": "[data-submit]",
    "closeModal": "[data-close-modal]",
    "error": "[data-form-error]",
    "consentAccept": "[data-analytics-consent=accept]"
  }
}
```

If the production page is a different path, configure it in `allowedPaths` and the fixture. Fixture resources must stay on the checked origin. For a mobile source check use `device: "mobile"`; for Facebook use an actual supported attribution combination (for example `utm_source: "facebook", utm_medium: "paid_social"`). The expected source and traffic type must agree with classification rules. The real tracking script supplies consent, browser ID and visit event ID; the verifier does not invent a matching analytics record after submission.

## Performance pass

The quickstart's generated synthetic demo uses an explicit --isolated-ci-fixture browser profile when running under CI. Hosted Linux runners may restrict Chromium's user-namespace sandbox; this profile uses the isolated fixture runner's container-compatible flags. It is rejected for remote URLs, ordinary client projects, or a missing CI environment. Normal client audits retain the launcher's default sandbox behavior. Reports record the selected profile and a redacted failure stage/code; missing numerical measurements still block the gate.

Lighthouse performs three mobile lab runs with simulated mobile network conditions and 4x CPU slowdown. The median must meet these defaults:

| Measurement | Budget |
| --- | --- |
| Performance score | At least 90 |
| Largest Contentful Paint | At most 2,500 ms |
| Cumulative Layout Shift | At most 0.1 |
| Total Blocking Time | At most 200 ms |

Optional settings are `--performance-min`, `--lcp-max`, `--cls-max`, `--tbt-max`, and `--runs` (1–5). Change a budget only when the project requirements justify it; never lower it merely to turn a failing result green. Single-run or variable results are identified as warnings. Every raw Lighthouse result is retained, including a result that lacks usable measurements. TBT is a **lab responsiveness proxy**, not field INP. A laboratory pass does not establish actual visitor speed or Core Web Vitals field results.

The default target is local. Remote measurement requires an HTTPS URL plus `--allow-remote`; credentials and query strings are rejected. Lighthouse blocks `/api/` routes to avoid visitor and lead writes during the audit. This is the public page-loading test, not the submission test.

Fix the largest bottleneck, then repeat the measurements. Typical fixes: correctly sized AVIF/WebP, responsive `srcset`, explicit image dimensions, preload only the real above-fold hero, lazy-load below-fold images, local subset fonts with sensible fallbacks, and defer nonessential scripts. Do not hide content or remove features from the tested build to improve the score.

## Browser and visual pass

Both Chromium and WebKit run at 1440×1000, 390×844, and 320×568. They check:

- Public loading, image decoding, horizontal overflow, and uncaught JavaScript errors.
- Keyboard activation of the CTA; modal focus entry, trapping, Escape, and returned focus.
- Background scroll locking and restoration.
- The actual configured fields and form steps, including keyboard Continue actions.
- Reachability of every field and the final action in a shortened mobile viewport; readable mobile input text.

The test blocks mutating network requests and does **not** submit a lead. Use the end-to-end verifier for delivery. The reduced height models available space while a keyboard is open; it does not prove the behavior of an actual iOS keyboard. WebKit provides Safari-engine coverage but is not a real Safari/iPhone device. If a physical-device issue remains uncertain, record that limit rather than inventing coverage.

Inspect the saved screenshots with ChatGPT/computer use: complete page rhythm, heading wraps, image crops, proof visibility, contrast, awkward gaps, modal boundaries and final CTA. Use the separate full viewport regression matrix and PDF page review as well. Visual review must record specific observations and fixes; screenshot existence alone is insufficient. Revisit both engines after a browser-dependent layout or interaction fix.

## Full local form and CRM pass

Store the admin credential in a private `.secrets/admin.json` with `{ "username": "...", "password": "..." }` and file permission 0600. Alternatively use `ADMIN_USERNAME`/`ADMIN_PASSWORD` environment variables, or `ADMIN_USERNAME` with `--password-file`. Never put a password in command arguments or a tracked fixture.

The full verifier checks unauthenticated routes, signs into the admin panel, then submits through the **actual anonymous public form** in a separate browser context. It accepts analytics consent, completes every form step, records the accepted receipt, follows the thank-you navigation, and verifies the advertised PDF download. It retrieves the same lead through the authenticated Worker API, requires the identical receipt and visit event ID, verifies source/device/traffic classification, changes its stage, adds a synthetic-test note, re-reads it, and checks the filtered reporting totals and conversion calculation. It verifies session revocation on logout.

The saved proof includes receipt IDs and aggregate metrics only, not submitted contact fields, session cookies, passwords or existing CRM records. Administrator screenshots are deliberately avoided. API-backed D1 persistence is identified accurately; this is not an independent direct SQL inspection.

Full verification creates a synthetic contact and visit. Use `--allow-test-lead` only within the user's approved testing/publishing scope. A live test can also activate configured lead notifications/webhooks. The fixture identifies a test identity, and the CRM note identifies the run. `--cleanup-test-lead` removes **only that run's contact**, after successful verification; it never mass-deletes leads and it does not erase historical conversion totals. The report explicitly records this metric impact. If a journey fails after acceptance, use its saved lead ID to inspect the incomplete test rather than rerunning blindly.

## Guided Cloudflare publishing completion

Only continue after the user's final publishing approval and the current local checks have passed. A request to prepare this reusable skill does not authorize publishing a client page.

After the publishing driver provisions/deploys the approved site, capture the actual destination and database binding in a local deployment record:

```json
{"url":"https://actual-worker.account.workers.dev","database_id":"actual-D1-UUID","worker":"actual-worker","version_id":"actual-deployed-version-if-returned"}
```

Create a **live** snapshot, then run:

```sh
npm run verify:live -- --url https://actual-worker.account.workers.dev --allow-remote --allow-test-lead --fixture test-fixture.json --credentials-file .secrets/admin.json --deployment-record build/deployment-record.json --project-root .
```

When the journey and identity checks succeed, the tool emits `crm.json`, `tracking.json`, and `deployment.json` for their evidence gates. The main result also requires `fully_verified: true`. A read-only result is `pass_with_warnings`, `fully_verified: false`, and `readiness: "public-checks-only"`; it never emits successful CRM/tracking/deployment subgate files. An upload alone is not a completed launch. A missing account login, DNS/certificate problem, unavailable target URL, broken resource, or failed receipt must be stated as an exact incomplete step.

If a custom domain is connected after testing workers.dev, repeat the live checks on that domain. Cross-origin cookies, paths, TLS, and redirects must be checked on the destination visitors will actually use. Keep GitHub optional for the deployed application; the site, API, lead database, analytics and admin panel remain on Cloudflare.
