# Lightweight Quality Gates

Use these gates after the page is implemented and after every material source change. The goal is a good, conversion-capable page, not maximum ceremony.

## 1. Static gate

Run from the skill directory:

```bash
python3 scripts/scan_surfaces.py /path/to/project --report /path/to/project/build/surface-scan.json
python3 scripts/validate_page.py /path/to/project --report /path/to/project/build/static-review.json
```

The first command blocks prohibited dash characters/entities and unresolved template markers across customer-facing surfaces. The second checks local assets, links, headings, viewport settings, image classification and alt behavior, basic form relationships, primary destinations, and common privacy/tracking failures.

Report paths are relative to the shell's working directory, not the project argument; absolute paths also work. Link the actual generated files in the handoff.

Static checks do not prove claim truth, visual quality, or real conversion delivery. Review those separately.

## 2. Browser gate

Serve the project over local HTTP. Test at least:

- 390 x 844 mobile;
- 768 x 1024 tablet;
- 1024 x 800 laptop;
- 1280 x 600 short-height laptop;
- 1440 x 900 desktop.

Use `scripts/measure_page.mjs` when Playwright is available:

```bash
node scripts/measure_page.mjs http://127.0.0.1:4173/ \
  --project-root /path/to/project \
  --out /path/to/project/build/browser-review.json
```

You may instead use an available browser automation tool, but preserve the same viewports and checks. Capture full-page screenshots plus open form/modal and thank-you or success states where applicable.

The helper reads `<project>/build/brand.json` automatically, or an explicit `--brand-report <path>`. Check its heading/body comparison against the source samples; a measured mismatch cannot be described as unchanged brand typography. Resolve it or document the permitted exception from the design reference.

The same browser pass tabs through an open modal and checks the focused control against the pixels on top of it. Do not replace this with `.fill()`, direct focus or test-driven scrolling, which can hide sticky-footer obstruction. Review inline forms and later form steps the same way when they exist.

Block on:

- horizontal overflow, missing images, serious console or network errors;
- primary form action not visible or unobscured at 1280 x 600;
- the hero hiding all following content below the first viewport on mobile, tablet or desktop;
- consent, chat, or fixed UI covering the H1, primary CTA, form action, legal links, or final content;
- a content-bearing image cropped with `cover` or missing labels;
- copy physically overlapping an information-bearing image;
- modal focus escaping, focused controls covered by sticky UI, missing focus restoration, or inaccessible validation;
- dead primary, phone, privacy, booking, or download destinations;
- footer controls visually merged or too small to operate.

## 3. Visual gate

Open and inspect every required screenshot at its actual size. Do not infer approval from a file existing or a broad boolean.

First-screen claims must match viewport geometry and a viewport-sized capture, not a scaled full-page image. If the browser helper cannot identify the hero's following section, check it directly instead of claiming it passed.

For each viewport, record specific observations for:

- brand fidelity and logo visibility;
- source-color provenance, applied color proportions, and audience fit;
- hero balance, subject visibility, and CTA priority;
- typography, contrast, wrapping, density, and visual age;
- section rhythm and repeated layouts;
- image crop, role, and proof integrity;
- consent, sticky, modal, and footer behavior;
- clipping, overlap, duplicate facts, unfinished text, dead space and thin success states;
- final conversion and thank-you state.

Also compare the complete page with the reference hierarchy in `design-direction.md`. Blue Mountain is a structural benchmark, not a style target. Clean Slate is a minimum execution-quality benchmark, not a template to copy. Block a technically sound page when the full composition still reads as a legacy sales brochure, an enlarged logo palette, or an audience-inappropriate design. Fix the underlying type, palette proportions, spacing, imagery treatment, or repeated motifs and then recapture every affected viewport.

Review each used image with asset-specific evidence. Review every modal step and validation state that exists. If a brochure exists, review every rendered page using the catalogue workflow.

Crop warnings name the actual asset and placement. Resolve each one separately; a reviewed hero does not clear unrelated service-image warnings. An explicit image ratio that disagrees with its rendered box indicates a sizing conflict to fix, not proof that the declared ratio took effect.

Before treating an image-load failure as a page defect, scroll the named placement into view and wait for that image to decode within a bounded interval. Check its response and pixels. Report a confirmed broken asset separately from a capture-timing failure; do not repair a valid page to satisfy a premature screenshot. Include tablet overlays and every repeated image placement in the existing pixel review, and inspect both compact success and long form states.

## 4. Conversion gate

Test the selected real action, not a substitute.

Before testing behavior, compare the final action with the source conversion contract. Block the build when a supplied source form, booking, quote, purchase, or download journey was replaced merely because credentials or production access were unavailable. Confirm that the offer, delivery promise, consent, and next step remain materially faithful or that a source-supported change is documented.

- Form: required errors, invalid values, keyboard flow, pending state, success confirmation, failure and retry, duplicate prevention, and real configured destination contract.
- Booking: actual destination, date or next-step clarity, and return path.
- Phone or email: actual `tel:` or `mailto:` destination and visible fallback.
- Download: real file, correct type, readable content, and honest delivery wording.

Use synthetic local data. A direct thank-you visit, refresh, rejected action, or denied consent must not create a conversion. Do not submit a production lead without explicit permission.

Exercise outcomes, not proxies: include whitespace-only required text and malformed contact input; inspect failure visibility at the real submit position before any test-driven focus or scroll. Then restore the local test adapter, retry the same filled form, and observe success with values preserved. To verify duplicate prevention, hold the first local request open, dispatch a second submit event, and assert exactly one receiver/adapter invocation. Clicking an already disabled button is not that test. Keep simulation results explicitly separate from backend delivery evidence.

After an invalid submission, correct one field and verify that both its inline error and its entry in the summary disappear while the other errors remain. Then correct the rest. Merely hiding the summary after every error is cleared does not test consistency during correction.

Within that same form test, keyboard-activate an error-summary link, including a grouped field when present, and verify focus reaches its usable control. Include obvious alphabetic phone junk. Hold a synthetic request, close/reopen the form and attempt to edit; resolve the old response and verify it cannot confirm unsubmitted changes. After success, reopen and confirm the completed state is retained or a deliberate new-enquiry reset is required. Exercise the configured request deadline with a controllable test clock or short test-only timeout; an unresolved response needs recoverable uncertainty, not permanent `Sending...` or an automatic duplicate request. These are assertions in the existing conversion test, not separate review rounds.

For validation and success, confirm that the focused target is actually visible after layout and scrolling settle. Include an ordinary-motion check, not only reduced-motion captures. A transient off-screen position during smooth scrolling is not a persistent defect; focus that finishes off-screen is.

For source forms, confirm that no public production endpoint was reused without authorization, success waits for a confirmed selected destination, and raw contact data is absent from analytics and data-layer events.

## 5. Accessibility and performance gate

Run an automated accessibility scan when available, then manually test keyboard order, visible focus, modal containment, zoom, labels, errors, reduced motion, and contrast. Automated tools do not replace these checks.

Run one local mobile Lighthouse pass before delivery. Target:

- Performance at least 90;
- LCP at most 2.5 seconds;
- CLS at most 0.1;
- TBT at most 200 milliseconds.

Repeat failing or marginal measurements after fixes. Do not delete needed proof or content merely to improve a score.

An absent executable or failed `require.resolve` means not installed, not unavailable. Attempt a run-local installation before skipping. Use a supported Node runtime and keep dependencies/cache outside published assets. For example, from the run workspace:

```bash
npm install --prefix qa-tools --cache qa-tools/npm-cache --no-audit --no-fund lighthouse
node qa-tools/node_modules/lighthouse/cli/index.js <local-url> --chrome-flags="--headless=new" --output=json --output-path=<project>/build/lighthouse.json
```

Use `CHROME_PATH` for an installed browser when discovery needs it. Check package engine requirements against the actual Node runtime, using a compatible version when necessary. Record the audit version and actual install/run failure if execution, package access or browser startup is blocked. Do not ask the owner for an API key or defer an available local audit until publication. See the [official CLI guidance](https://github.com/GoogleChrome/lighthouse#using-the-node-cli).

Unthrottled local PerformanceObserver timings are diagnostics, not a Lighthouse score, mobile loading budget pass, or equivalent TBT measurement. Inspect the failing LCP element and delay breakdown before choosing a fix; do not assume another image compression pass fixes render delay.

## 6. Fresh acceptance gate

After all fixes, review the final outputs from the beginning without relying on earlier pass labels. Check once whether a fresh-context reviewer is available in the current tools. If available, give it only the skill and final page artifacts, not the builder's QA conclusions, and ask for one critical visual review. Verify findings against the current pixels or behavior before changing code; reject stale or unsupported findings. Fix confirmed issues and recapture affected states. A second independent review is needed only after substantial redesign, not for every small correction. This is a short review of the existing build, not another build or research run.

If no independent reviewer is available, reopen the raw viewport captures and full-page sections at readable size, concentrating on subject/CTA collisions and adjacent text before writing acceptance prose. State that this was self-review; a second paragraph by the same builder is not independent evidence. Do not install an external service or require an account to obtain a reviewer.

The acceptance report must include:

- exact files and URLs reviewed;
- viewport and state coverage;
- specific findings tied to screenshots or pages;
- design provenance and the visual-age checkpoint;
- conversion parity against the source conversion contract;
- typography provenance: verified guide, official site, applied choice, and substitutions;
- fixes made and retested;
- unresolved limits;
- final result: `blocked`, `local final`, `publish-ready`, or `live and verified`.

A selected optional module can be incomplete without blocking the base page only when it is clearly excluded from the delivered claim. Never call the whole result complete while presenting that module as working.

Block typography acceptance when the applied heading or body stack differs from the supplied production page without a documented permitted reason and a close visual match.
