# QA and Handoff

## Evidence gates

| Gate | Required evidence |
|---|---|
| Research | Source files/URLs, retrieval dates, reference matrix |
| Claims | Approved ledger with qualifiers and locations |
| Copy | Passed checklist and one CTA/follow-up promise |
| Catalogue | Full render/contact sheet, metadata/page count, cover derivatives |
| Build | Source files, optimized assets, no unresolved local references |
| Interaction | Browser-completed form path plus error path |
| Responsive | Screenshots at 1440, 1280, 768, 390 |
| Delivery | Confirmed CRM receipt or explicit pending warning |
| Tracking | Confirmed IDs/events or explicit pending warning |
| Handoff | Archive integrity, file matches, START-HERE instructions |

Use `pass_with_warnings` only when the remaining issue is genuinely non-blocking for the stated deliverable. Missing CRM receipt is non-blocking for a local preview and blocking for launch readiness.

## Browser test matrix

At minimum:

- page loads with no console/runtime error;
- phone, privacy, and brochure links resolve;
- every CTA opens the same modal;
- modal heading and step counter are announced;
- empty required fields block progress;
- all radio/select choices are reachable by keyboard;
- Back retains values;
- Escape and backdrop close;
- focus returns to the trigger;
- mobile modal remains usable with the virtual-keyboard viewport;
- successful endpoint response reaches thank-you;
- failed/non-2xx endpoint response does not claim success;
- thank-you page exposes the correct brochure and promise;
- screenshots show loaded lazy images after scrolling.

## Static validation

Run `scripts/validate_funnel.py`. Treat its result as one input, not a replacement for browser and visual QA.

Check the generated report for:

- required files;
- exactly one modal form by default;
- missing local assets;
- inconsistent CTA text;
- unresolvable brochure link;
- images missing dimensions;
- raw-PII-shaped analytics keys;
- external font hosts;
- missing webhook warning.

## Handoff

Run:

```bash
python3 scripts/package_handoff.py \
  <project-root> \
  --output <archive.zip> \
  --client "<client name>"
```

The generated `START-HERE.txt` must distinguish:

- what is included;
- how to preview;
- how to publish while preserving paths;
- whether a build step exists;
- CRM/webhook status;
- GTM/GA4/Ads/Meta status;
- required final-domain tests;
- whether deployment or a real test lead occurred.

By default the package helper requires and includes the canonical research/copy/claim/form/QA documents, final audit JSON files, and six canonical QA screenshots under `evidence/`. It intentionally excludes mutable state, stub research, prompts, and intermediate logs that may contradict final evidence. If canonical names are not appropriate, pass `--evidence-manifest <json>` with exact project-relative paths. Missing evidence blocks packaging unless the user explicitly accepts `--allow-missing-evidence` or requests `--site-only` and receives the evidence separately.

Verify archive integrity and compare packaged source hashes with the project files. Do not call the archive live, deployed, or production-ready without current external proof.
