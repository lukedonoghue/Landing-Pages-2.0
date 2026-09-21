# Measured QA and evidence gates

Use measurement to locate defects, then inspect the actual rendered pixels. A JSON score does not establish that the page looks good. This implementation is original code informed by the reviewed workflow; no unlicensed upstream code is embedded.

## Repeatable order

1. Finish the source changes, including local asset files and `funnel.json`.
2. Start an isolated local server. Record the actual URL, mode, build identity, and intended form behavior.
3. Snapshot the source; run static, browser, visual, and catalogue checks against that snapshot.
4. Fix failures, take a new snapshot, and rerun affected verification. Source changes invalidate prior evidence, even when old screenshots still look plausible.
5. Record genuine reports and check the requested readiness level. Never replace a failed result with a handwritten PASS.

Run paths below from the skill folder; replace `/path/to/project` with the generated project.

```bash
python3 scripts/check_gates.py snapshot /path/to/project --mode preview
python3 scripts/validate_funnel.py /path/to/project --snapshot build/gate-snapshot.json --report build/static-audit.json
node scripts/measure_funnel.mjs http://127.0.0.1:8787/ --project-root /path/to/project --out /path/to/project/build/layout-audit.json --mode preview
python3 scripts/check_gates.py record /path/to/project --gate static --report build/static-audit.json
python3 scripts/check_gates.py record /path/to/project --gate browser --report build/layout-audit.json
python3 scripts/check_gates.py record /path/to/project --gate visual --report build/visual-review.json
python3 scripts/check_gates.py record /path/to/project --gate catalogue --report build/catalogue-review.json
python3 scripts/check_gates.py check /path/to/project --mode preview
```

The browser harness resolves Playwright or Playwright Core from the generated project's packages. If supplied by a bundled runtime, use `--playwright-module /absolute/path/to/playwright/index.mjs`; optionally use `--browser-executable /absolute/path/to/chromium`. Environment equivalents are `FUNNEL_PLAYWRIGHT_MODULE` and `FUNNEL_CHROMIUM`. No machine-specific browser location is embedded. `--python` selects the Python executable used to match the source fingerprint.

All QA output belongs under project `build/`. Source fingerprinting includes HTML, Worker code, migrations, configuration, lockfiles, documents, and public assets. It excludes `build`, screenshots, `.git`, node_modules, runtime state, `.secrets/`, environment files, and private key files. Symlink inputs are rejected rather than silently omitting their contents. Keep secrets in environment bindings, never in source or evidence. A source fingerprint is an integrity check, not a guarantee that no secret was mistakenly committed.

## Browser coverage

The harness tests widths 360, 390, 768, 1024, 1180, 1280, and 1440 CSS pixels plus 1280×600 and 1440×720. Each uses its own isolated browser context. It scrolls to trigger real lazy loading, waits for fonts/images, measures landing and thank-you pages, and captures full-page and modal screenshots. It records:

- horizontal overflow, image decoding, font loading and HTTP/console errors;
- real text line rectangles, short last lines, plain-background heading contrast estimates, cover-image crop fraction and object position;
- visible CTA positions and whether their centre is obscured;
- every declared `[data-open-modal]` trigger, `#lead-modal`, keyboard entry, forward/reverse focus trapping, Escape, and focus restoration;
- PDF download responses from thank-you links.

Crop, heading-wrap and contrast estimates are review warnings because design intent and image composition matter. Image decoding, page overflow, a rendered ratio conflicting with the explicit CSS ratio, unreadable first-viewport continuation, close-control/text overlap, and unsupported source-font drift are failures. The complete-flow checker reads `build/brand.json`, compares actual rendered heading/prose fonts, checks a configured public number near the top and includes 320px. Do not accept a font substitution just because all declared fonts report loaded. Transparent gradients, image backgrounds, canvas, videos and pseudo-elements still need visual inspection.

The harness blocks all write requests and captures submission events before frontend submission handlers. It never creates live leads. A `--form-fixture /path/to/fixture.json` is permitted only for localhost/loopback and supplies values by field name to check required-field blocking, Continue, and Back. Example: `{"fields":{"name":"QA Test","email":"qa@example.invalid"}}`. It still does not submit. Run the dedicated backend/form contract tests separately for accepted, rejected, malformed, duplicate, timeout, pending, storage-blocked, and analytics-failure paths. A read-only browser sweep cannot certify those paths.

Use `--thank-you /thank-you.html` if the route differs. A direct thank-you visit must not create a conversion. For remote URLs, local source hashes alone do not prove which revision is deployed; tie them to deployment records in the live gate.

## ChatGPT visual review

Open the generated screenshots with image viewing or use computer use in an isolated browser context. Inspect the actual screenshot pixels at their native size and compare with client brand/reference evidence. At minimum review full desktop, low-height laptop, tablet, narrow mobile, modal, and thank-you. Check visual hierarchy, hero subject/crop, font rendering, foreground contrast, reading width, spacing, heading balance, CTA visibility, modal scrollability, clipped content, and any warning from the measured report.

Write `build/visual-review.json` only after looking. Identify the ChatGPT model/reviewer and tool version when available; otherwise state `unknown` rather than inventing it. Include specific observations tied to screenshot paths, unresolved findings, and review limits. Do not report pass just because the screenshot exists. If a source change affects layout, recapture the screenshot and review it again.

For the catalogue, render and inspect every page using the PDF skill. Link the original PDF and each rendered page. Record the page count, pages reviewed, text/link checks, and any issues. Do not substitute PDF text extraction for rendered-page review. `catalogue.enabled: false` in `funnel.json` is the only explicit omission supported by the gate tool; leave the catalogue gate required otherwise.

## Report contract

All reports recorded by `check_gates.py` have this common envelope:

```json
{
  "schema_version": 1,
  "gate": "visual",
  "status": "pass_with_warnings",
  "source_fingerprint": "COPY_FROM_CURRENT_SNAPSHOT",
  "executed_at": "ACTUAL_ISO_UTC_TIME",
  "tool": {"name": "ChatGPT visual review", "version": "ACTUAL_MODEL_OR_UNKNOWN"},
  "target": {"mode": "preview", "url": "ACTUAL_TESTED_URL"},
  "checks": [{"name": "hero crop", "status": "pass", "detail": "ACTUAL_OBSERVATION"}],
  "reviewer": "ACTUAL_REVIEWER",
  "observations": ["SPECIFIC_OBSERVATION_WITH_VIEWPORT_AND_SCREENSHOT"],
  "artifacts": [{"path": "build/screenshots/390x844-landing.png", "type": "screenshot", "sha256": "ACTUAL_FILE_SHA256"}],
  "failures": [],
  "warnings": ["ACTUAL_UNRESOLVED_WARNING"]
}
```

This is a schema example, not valid evidence. Fill it from the executed checks and observed review. Use only `pass`, `pass_with_warnings`, `blocked`, or `not_applicable`. Required gates cannot be bypassed using `not_applicable`. `checks` may be a result object for static analysis or an array with name/status/detail. Passing reports cannot contain failures or blocked checks.

Additional gate evidence requirements:

| Gate | Required content beyond envelope |
|---|---|
| static | Actual nonempty static check results |
| browser | `execution.kind: automated`, `viewports`, screenshot artifacts |
| visual | Reviewer identity, specific observations, screenshot artifacts |
| catalogue | Positive `page_count`, `reviewed_pages: [1,2,...]` covering every page, PDF and rendered_page artifacts |
| crm (live only) | Executed command/exit code; `observations.receipt_id` equals `stored_receipt_id`; `database_id`; redacted http_trace and db_receipt artifacts |
| tracking (live only) | Executed command/exit code; event_trace and dashboard_result artifacts establishing the denominator and numerator |
| deployment (live only) | Executed command/exit code; http_trace and deployment_record artifacts establishing URL, revision, domain and HTTPS |

Live reports also require the actual HTTPS target and `execution: {"kind":"automated","command":["ACTUAL","COMMAND"],"exit_code":0}`. Do not invent a command or receipt to satisfy schema. Store redacted structured response/query output, no tokens or lead PII. Gate checking enforces report/artifact integrity and minimum evidence shape; it does not cryptographically authenticate the report author or independently query Cloudflare. A human or agent still has to execute the named check and tell the truth about its limitations.

Preview and handoff require static, browser, visual, and enabled catalogue evidence. Complete-workflow projects additionally require the copy audit, performance, Chromium/WebKit compatibility and enabled image evidence. Handoff also requires the packaging checks documented in the handoff workflow. Live requires all of these plus deployment, CRM receipt, and tracking evidence against the destination. A package can be ready while external credentials or live verification remain blocked; name the readiness level accurately.

## Regression checks

```bash
python3 scripts/test_gates.py
cd assets/cloudflare
npm ci
npm test
```

Run the commands above from the skill folder. The application regressions use isolated synthetic fixtures, including real browser and local Worker/D1 tests. They do not edit client pages or perform live submissions. Run the generated project's measured browser tools separately against its actual page; see performance-and-browser-qa.md.
