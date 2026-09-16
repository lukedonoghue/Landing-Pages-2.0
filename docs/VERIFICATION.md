# Verification record

For subsequent development results and the reproducible quickstart demo, see [Development progress](PROGRESS.md). The sections below retain the original release baseline.

This document distinguishes reusable-tool regression tests, an actual local generated funnel, and a live Cloudflare deployment. The integrated local run below completed on **16 September 2026**. The final combined fictional build was subsequently tested with the reviewed copy, responsive generated illustration and regenerated four-page PDF; results are recorded below. It remains a local test fixture, not a user-approved production site.

## Actual integrated local funnel

The generated fictional **Harbor Services** demo ran through Wrangler on `http://127.0.0.1:8802`, with local D1 migrations applied, named owner login and a real brochure PDF. The browser interacted with the generated application; the form/CRM checks were not fabricated API responses.

| Test | Executed coverage | Result |
| --- | --- | --- |
| Full local form and CRM journey | **28 checks**, including authenticated and unauthenticated access, actual form submission, receipt persistence, PDF, attribution, reporting and session revocation | Passed with the explicit synthetic-data warning below |
| Cross-engine interaction journey | **72 checks** across Chromium and WebKit at **1440×1000**, **390×844**, and **320×568** | Passed; zero failed checks |
| Admin interface smoke check | **2 checks**: no horizontal overflow at 390 px and no uncaught JavaScript exceptions | Passed |
| Admin screenshots | **4 captures**: overview desktop/mobile and Account desktop/mobile | Captured; desktop Account was inspected during integration |
| Verification-tool regressions | **13 tests** covering target boundaries, fixtures, measured budgets, missing engines, authorization, redacted evidence and actual local HTTP access checks | Passed |

The full journey explicitly verified:

1. Worker health and D1 connectivity; anonymous rejection by the lead, reporting and session APIs; protected normal and encoded admin routes.
2. Named owner login through the actual login page.
3. A separate anonymous browser accepted analytics consent and completed the configured multistep form using synthetic details.
4. The actual Worker returned an accepted lead ID and receipt; the browser reached the thank-you page and its advertised PDF was downloadable.
5. An authenticated CRM read returned the **same receipt** and the **same measured visit event ID**. The recorded dimensions were Google, paid traffic, desktop.
6. Changing the lead to Qualified and saving a verification note persisted through a fresh CRM read.
7. The filtered dashboard gained the measured visit, conversion and lead; its conversion rate agreed with the selected cohort.
8. Logging out revoked administrator access.

Persistence evidence came from an authenticated Worker API read backed by local D1. It was **not** an independent direct SQL inspection. The report identifies that distinction.

Synthetic local contacts were created across debugging and verification runs. The successful report records that synthetic visits/leads affect historical reporting; removing a contact would not erase those historical totals. No real customer details were used, and no Cloudflare deployment or remote lead mutation was performed.

The local evidence locations are intentionally excluded from Git:

```text
.verification/full-funnel/build/integrated-functional-final/result.json
.verification/full-funnel/build/integrated-browser/result.json
.verification/full-funnel/build/integrated-admin-ui/result.json
.verification/full-funnel/build/integrated-admin-ui/overview-desktop.png
.verification/full-funnel/build/integrated-admin-ui/overview-mobile.png
.verification/full-funnel/build/integrated-admin-ui/account-desktop.png
.verification/full-funnel/build/integrated-admin-ui/account-mobile.png
```

These are working evidence paths on the build machine, not files a new clone is expected to contain. Do not copy local databases, credentials, screenshots of real customers, or the `.verification` directory into a repository handoff.

## Defects found through real execution

The first WebKit pass found that native macOS tab navigation skipped buttons and escaped the modal. The lightbox now explicitly advances or reverses focus through its visible controls. The subsequent Chromium and WebKit checks passed at all three widths.

A rapid thank-you navigation also exposed a race in the verification helper: Chromium could discard an API response body before the checker read it. The helper now captures the actual visit and lead responses before returning them to the page. This retains the real browser-originated submission and real backend response; it does not substitute a simulated acknowledgement.

## Final combined fixture checks

After integrating the reviewed copy, responsive image variants and four-page guide, the source snapshot was `9fc1fc6861e89f9125221f37fdc4b02549f46053d6a3f5afc41aa76870830b07`.

- Chromium and WebKit: **72 checks passed** across the three engine/viewport combinations per browser.
- Final real form-to-D1-to-CRM rerun: **28 checks passed**, with `fully_verified: true` and `readiness: local-journey-verified`. The controlled synthetic lead affects local historical metrics.
- Full responsive measurement: **118 checks passed** across **nine viewports**, covering 360, 390, 768, 1024, 1180, 1280 and 1440 px widths plus short laptop screens. No failures or warnings.
- Three mobile Lighthouse runs: median **100 performance**, **1,059 ms LCP**, **0 CLS**, **0 ms TBT**. These are local lab results; TBT is not field INP and this does not predict a live domain's field scores.
- The agent inspected desktop/mobile page, modal, thank-you and admin captures. A long headline was balanced across lines. Every page of the regenerated PDF was inspected; its CTA, follow-up and three-step process match the master copy.
- The native image tool actually generated the planning illustration. WebP variants at 480/960/1600 px are approximately 16/58/124 KB. The tool did **not** report its exact model, so the strict GPT Image 2.5 identity requirement remains unresolved for this fixture. It was not relabeled as a verified 2.5 generation. The optional exact-model CLI route has offline tests; no billable API generation was executed.
- The copy approval is explicitly a **test fixture approval** and cannot authorize publishing. A real client must approve their own copy and final release. The fictional privacy/client information is not launch-ready content.

Final working evidence lives under `.verification/full-funnel/build/final-browser/`, `final-layout/`, `final-performance/`, `final-functional/`, and `catalogue-review.json`. Generated source and local credentials remain excluded from Git. These observations verify the reusable workflow components and local integration; they do not turn this fictional fixture into a production approval or live Cloudflare verification.

## Packaging and negative-control checks

The installer copied and verified 113 skill files in a fresh temporary location; all nine copy-library files matched their source hashes. Scaffolding from that installed copy generated 78 files with the Worker, CRM, migrations and workflow helpers. A second scaffold preserved an existing manual HTML edit and the client identity. No credentials, runtime dependencies or local database files leaked into the installed package.

The separate layout-regression harness ran two neutral fixtures across nine viewports (308 checks). The valid fixture passed all 154 checks. The intentionally broken fixture correctly reported 36 failures for overflow, missing images and resource errors. These expected failures demonstrate that the checker does not simply accept every page.

## Regression suites and CI

The release contains root copy/research/approval tests, image-workflow tests, evidence-gate tests, and the application's Node test suite. The final local release run passed **188 regression tests**: **43 root Python tests**, **14 evidence-gate tests**, **40 image-workflow tests**, and **91 application tests**. No application tests were skipped. The application count includes the 13 verification-tool tests above. CI repeats these checks on the published checkout.

[The repository workflow](../.github/workflows/verify.yml) runs on pull requests, pushes to `main`, or manual dispatch:

- Python 3.12 runs the root, gate and image checks. Ubuntu's `webp` package supplies `cwebp`, ensuring the real optimization tests execute.
- Node 24 installs the committed dependency lock and Chromium/WebKit binaries plus Linux libraries. Both engines must launch.
- The application tests run against local/mock fixtures. `CHROME_BIN` points to the installed Chromium executable so browser-dependent tests cannot silently skip.
- A nonzero skipped-test count fails the application job. The TAP regression report is retained for 14 days.

CI has read-only repository permissions, no deployment jobs, and no Cloudflare/GitHub account secrets. Installing dependencies and browser binaries requires network access, but tests do not publish an application or contact a production lead database. WebKit installation/launch in CI establishes runtime availability; the generated-funnel interaction matrix still requires its own site-specific fixture and running local server.

To repeat the suites from a fresh clone:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
python3 skills/branded-lead-funnel-builder/scripts/test_gates.py
python3 skills/branded-lead-funnel-builder/tests/test_image_workflow.py
```

Install `cwebp` before the image suite (`webp` through the OS package manager). Then run the application suite from its template directory using Node 24:

```sh
cd skills/branded-lead-funnel-builder/assets/cloudflare
npm ci
npx playwright-core install chromium webkit
```

Set `CHROME_BIN` to the path reported by this command before `npm test`:

```sh
node --input-type=module -e "import {chromium} from 'playwright-core'; console.log(chromium.executablePath())"
npm test
```

On Linux, use `npx playwright-core install --with-deps chromium webkit` to install the required OS libraries as well. A missing browser is a setup problem, not successful browser coverage.

## Repeat the actual generated-funnel journey

Generate a separate fictional project, configure its real form and brochure, run local setup/migrations and start Wrangler. Create a reviewed site-specific fixture following [the performance/browser verification reference](../skills/branded-lead-funnel-builder/references/performance-and-browser-qa.md). Do not run these commands from the reusable template itself or against a real client URL without the applicable authorization.

From the generated project:

```sh
npm run qa:browsers -- --url http://127.0.0.1:8787 --fixture build/form-fixture.json
npm run verify:live -- --url http://127.0.0.1:8787 --fixture build/form-fixture.json --read-only
```

For the actual local submission test, set `ADMIN_USERNAME` to the owner chosen during setup, keep the password in its private file, then run:

```sh
npm run verify:live -- --url http://127.0.0.1:8787 --fixture build/form-fixture.json --allow-test-lead --password-file .secrets/local-admin-password.txt
```

The `verify:live` command name also supports local verification; the report's URL and readiness mode determine what was actually tested. A successful local journey says `local-journey-verified`. A read-only pass always has `fully_verified: false`; it is not proof of working lead delivery.

Before attaching reports to a release gate, make a current handoff snapshot and rerun with `--project-root .`. Reports are bound to the source fingerprint. Changes to the generated source invalidate older evidence; do not relabel the earlier integration screenshots as evidence for a later design.

## Remaining boundaries

- **No live Cloudflare launch is claimed here.** Account setup, deployed Worker/D1 access, workers.dev/custom-domain behavior, TLS, and production receipt/analytics verification require a separate approved publishing run.
- The final fictional fixture received the visual, PDF and measured performance checks recorded above. This is not user approval of a real client site. Its exact native image model remains unverified, and its fixture approval cannot pass the publishing gate.
- WebKit automation covers the Safari engine; it does not replace a physical iPhone/Safari test. Shortened mobile viewports approximate keyboard space rather than emulating an actual iOS keyboard.
- Lighthouse measures laboratory LCP, CLS and TBT. TBT is a responsiveness proxy, not field INP; laboratory results are not proof of real-user Core Web Vitals.
- This integration test did not execute the optional paid image API route, deliver a real email/webhook notification, or prove a remote Cloudflare backup/restore. Those capabilities have their own explicit setup and verification requirements.
- Unit-test approval/review fixtures only test validation rules. They cannot count as a user's approval, a real editorial assessment, or a final visual review.
