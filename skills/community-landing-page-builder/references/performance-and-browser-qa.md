# Measured performance, browser compatibility, and publishing verification

Run these stages after the copy/editorial gate, design and image work. Keep design quality, accuracy and readability intact while fixing asset size, loading, layout shifts, and JavaScript overhead. Automated checks do not authorize external publication or a controlled live test lead.

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

Optional settings are `--performance-min`, `--lcp-max`, `--cls-max`, `--tbt-max`, and `--runs` (1-5). Change a budget only when the project requirements justify it; never lower it merely to turn a failing result green. Single-run or variable results are identified as warnings. Every raw Lighthouse result is retained, including a result that lacks usable measurements. TBT is a **lab responsiveness proxy**, not field INP. A laboratory pass does not establish actual visitor speed or Core Web Vitals field results.

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

Complete Worker funnels require a local_journey gate before launch setup. A successful local run emits build/live-verification/local-journey.json; record it against the current preview/handoff snapshot:

~~~sh
python3 scripts/check_gates.py record . --gate local_journey --report build/live-verification/local-journey.json
~~~

The checker compares the stored receipt, measured visit, request trace and dashboard cohort, and requires executed login/redirect/download/CRM-update/logout assertions. Read-only checks do not qualify. Valid new verifier attempts clear old derived gate files in the chosen output directory; use distinct --out directories to retain separate attempts, and always respect a failed command's exit status. The quickstart demo records this gate automatically but remains explicitly ineligible for publication. Static-only projects with backend.provider set to none do not require a CRM journey.

Store the admin credential in a private `.secrets/admin.json` with `{ "username": "...", "password": "..." }` and file permission 0600. Alternatively use `ADMIN_USERNAME`/`ADMIN_PASSWORD` environment variables, or `ADMIN_USERNAME` with `--password-file`. Never put a password in command arguments or a tracked fixture.

The full verifier checks unauthenticated routes, signs into the admin panel, then submits through the **actual anonymous public form** in a separate browser context. It accepts analytics consent, completes every form step, records the accepted receipt, follows the thank-you navigation, and verifies the advertised PDF download. It retrieves the same lead through the authenticated Worker API, requires the identical receipt and visit event ID, verifies source/device/traffic classification, changes its stage, adds a synthetic-test note, re-reads it, and checks the filtered reporting totals and conversion calculation. It verifies session revocation on logout.

Public proof includes receipt IDs and aggregate metrics only, not submitted contact fields, session cookies, passwords or existing CRM records. Version-2 recovery keeps the exact authorized synthetic request separately under private `.secrets/journeys/` files; never publish those files or substitute a new request when they are missing. Administrator screenshots are deliberately avoided. API-backed D1 persistence is identified accurately; this is not an independent direct SQL inspection.

Full verification creates a synthetic contact and visit. Use `--allow-test-lead` only within the user's approved testing/publishing scope. A live test can also activate configured lead notifications/webhooks. The fixture identifies a test identity, and the CRM note identifies the run. `--cleanup-test-lead` removes **only that run's contact**, after successful verification; it never mass-deletes leads and it does not erase historical conversion totals. The report explicitly records this metric impact. If a journey fails after acceptance, use its saved lead ID to inspect the incomplete test rather than rerunning blindly.

## Resume an interrupted local journey

Keep the original source snapshot, fixture, output directory and `.secrets/journeys/` request files. Repeat the original local verification arguments with `--resume-journey`, including `--cleanup-test-lead` only if it was part of that original scope. Do not recreate the snapshot merely to resume it. A changed source requires reviewed new evidence rather than adopting the previous result.

For example, retain the original local server origin/port and run:

```sh
npm run verify:live -- --url http://127.0.0.1:8787 --fixture test-fixture.json --allow-test-lead --credentials-file .secrets/admin.json --project-root . --out build/live-verification --resume-journey
```

This is for a local interrupted verification. Use guarded `npm run publish -- --resume` for a published release; it supplies the correct frozen package, identity, snapshot and attempt automatically. A fresh independent QA run uses a new output directory. The fictional quickstart allocates one automatically so repeated demo checks preserve previous journals.

## Guided Cloudflare publishing completion

Only continue after the current local checks pass and a real user instruction authorizes publication. Reuse an original request that explicitly included publishing. A request to prepare this reusable skill does not authorize publishing a client page.

Use the [guarded publishing flow](guided-publishing.md#retained-releases-and-interrupted-publishing). `npm run publish` freezes the reviewed handoff evidence before mutation, inspects the actual Cloudflare deployment/version and D1 binding, then invokes live verification with a separate release snapshot and identity artifact. Do not construct a success/identity record manually or replace the root handoff snapshot with a live one.

For an interrupted guarded release, use:

```sh
npm run publish -- --resume --credentials-file /private/path/current-owner.json
```

The publisher correlates the running version with its inspected identity before sending credentials and after the journey. It validates the emitted CRM/tracking/deployment artifact set and commits final release proof only when all three pass with `fully_verified: true`. A read-only outcome remains `public-checks-only`; an upload alone is incomplete. `workflow.py status .` validates saved proof locally and states that it has not queried the current provider.

Supported interrupted journeys retain source-bound request/receipt checkpoints. The guarded publisher resumes them with the same request key, reuses completed browser proof, and reconciles idempotent CRM operations and cleanup. Legacy or missing private state, source/identity changes, concurrent contact edits, day-boundary correlation failures and exhausted retry budgets remain explicit blocks. Uncertain migrations/origins and replacement of unresolved releases still need reconciliation. Never bypass these checks by starting a fresh remote test request. Low-level verifier flags are for diagnosed, already-authorized work, not an alternative publishing path.

Configure the intended custom domain before final QA/approval when possible. Adding it later changes the reviewed destination/configuration and requires a newly reviewed release, including tests on the address visitors will actually use. Domain verification does not inherit a workers.dev result. Keep GitHub optional; the site, API, lead database, analytics and admin remain on Cloudflare.

## Rendered wording

Run the required [rendered-copy capture and comparison](rendered-copy.md) against the same snapshot for complete Worker funnels. It is read-only by default and complements the actual submission journey. The synthetic quickstart demo captures, compares and records this gate automatically.
