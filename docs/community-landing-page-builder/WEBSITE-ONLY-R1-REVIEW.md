# Website-only attempt 1: rejected

Reviewed 2026-09-18. Business: https://www.stayclean.co.uk/ . Builder: gpt-5.6-sol xhigh, agent 01a0b584-2c94-7c43-bda0-1ed9aadc0b87, fork_context=false. No corrective messages or parent audit were supplied. Its final page was not edited by the orchestrator.

Local evidence root: work/community-acceptance-20260918/ relative to the orchestration workspace. Builder artifacts are in runs/website-only-r1/project; parent evidence is in audit/website-only-r1. Evidence paths below refer to those directories, not deployed pages. No live lead, CRM or Cloudflare operation was performed.

Portable copies of the two form-failure screenshots, final mobile hero, and full Lighthouse report are retained beside this document in evidence/website-only-r1/ so the central findings can be reviewed from the repository without access to this Mac.

## Findings and traced causes

1. Failed submission can leave the visitor without a visible error. In project/script.js, showFailure calls focus on #form-failure, an ordinary div without tabindex. At the real mobile submit position its bounding rectangle was entirely above the viewport (top -422, bottom -315 in an 844px viewport), and focus fell to BODY. Parent screenshot: failure-without-test-scroll.png. The builder's verify-local.mjs manually scrolled to the error before capturing it, masking the failure. The skill required accessible errors but did not distinguish natural behavior from test-assisted scrolling. Correction: specify visible/announced failure from the actual submit position, with focusable summary or nearby message, preserved values and no test intervention before assessment.

2. Required junk values reached success. validateForm relied on browser checkValidity; required text accepts whitespace and type=tel accepts arbitrary text. The parent submitted whitespace-only name/address/postcode and phone 'not a number' with a synthetic valid-format email. The local success greeting had an empty name. Evidence: blank-fields-accepted.png. Correction: trim required text, reject obvious invalid contact values without an unnecessarily restrictive international phone mask, and test those outcomes.

3. Retry was asserted but not exercised. The builder helper checked that failure text included 'try again', then closed the page. That does not prove retry with preserved values. A disabled submit button alone also does not prove duplicate prevention. Correction: require outcome-based local failure, restoration and successful retry of the same filled form. This is page behavior evidence, not backend acceptance.

4. Hero proof was visually compromised. The mobile hero uses a heavily shaded, tightly cropped team/fleet image behind copy and CTA controls. The essential subjects are difficult to inspect and controls occupy their area. The builder dismissed the crop warning because the image was not marked content-bearing, treating a text-label classification as permission to obscure photographic proof. Evidence: project/build/screenshots/asset-hero-mobile.png and parent provisional-hero-390.png, plus original source-image inspection. Correction: keep essential subjects inspectable across all image classes, including CTA and scrim obstruction, not just text-bearing images. The builder's repaired lower service-image crops are not counted as still-open defects.

5. QA report links pointed to files that did not exist. scan_surfaces.py and validate_page.py resolved relative --report paths against the project root, unlike the browser helper and normal invocation expectations. Passing project/build/report.json while targeting project produced project/project/build/report.json. Correction: both scripts resolve report paths against invocation cwd; absolute paths still work. A regression covers both scripts, a project path containing spaces, and absolute paths. Five focused tests passed.

6. Performance acceptance was missing, not equivalent to the reported unthrottled timings. The builder disclosed no Lighthouse but used local PerformanceObserver timings instead. Parent Lighthouse 13.5.0 on supported Node 24.19.0 measured mobile Performance 84, Accessibility 100, LCP 4.4s, CLS 0 and TBT 40ms. Evidence: lighthouse.json. This is one local lab measurement, not production performance or complete accessibility proof. The fixed 1400px hero preload and responsive 1000px candidate were both fetched, wasting a desktop download on mobile. Correction: attempt an available supported local audit installation, do not substitute unthrottled timing for a loading-budget pass, and match responsive preload selection or omit the redundant preload. Local Python-server compression/cache limitations remain distinct from page defects. The first parent Lighthouse attempt was invalid because the completed agent's preview server had stopped; it is not a page measurement.

## Scope of the correction

Updated existing build, imagery and quality references, plus two report writers and one focused regression. No new workflow phase, API key, account, scorecard or long audit document was added to the builder's reading path. This review stays outside the skill snapshot. Existing Luke files and README-BOHDAN remain untouched.

Regression result: all 66 installed-skill Python tests passed using the bundled Python runtime. The initial system-Python run could not import the optional catalogue tests because ReportLab was absent; switching to the available bundled runtime resolved that environment limitation. This is not a browser or backend acceptance result.

Start attempt 2 from an empty project and the amended frozen skill, with the same plain business request and no findings supplied. Passing the helper scripts is not sufficient to accept it.

## Orchestration failure

The parent ended a turn after arranging a 15-minute reminder instead of continuing the acceptance review. The builder finished while parent acceptance stayed idle. The reminder was configured active but no delivery was visible to the user; its cause is not established. The parent acknowledged this at 20:55 Kyiv and resumed the actual audit. Maintain timestamped progress during active work rather than treating a configured reminder as proof that an update was delivered.
