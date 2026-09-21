# Compare the finished funnel with approved wording

For complete Worker funnels, the required `rendered_copy` gate compares the canonical `build/page-copy.json` with actual desktop/mobile DOM text and the served brochure. This is separate from copy approval, editorial judgment and visual review. It never grants a user approval or replaces those reviews.

## Before approving copy

Include all marketing wording in the master: hero, sections and FAQ answers, modal prompts/follow-up, thank-you delivery/next steps and the **complete brochure text**. A new brochure needs `brochure.cover_promise`, `brochure.delivery` (the delivery contract) and `brochure.text` (strings, lists or objects containing all printed wording). Delivery describes the contract; it need not literally appear inside the PDF. Include short custom interface labels/disclosures in `interface_text` so they are visible in the same review. Preserve qualifiers and avoid hiding substantive claims in metadata.

When a client actually supplies an existing final PDF, inspect it and use `brochure.approved_asset` with `origin: "supplied"`, a project-relative `path` and its real `sha256`, instead of `brochure.text`. Approval then covers that exact unchanged asset, which must also be the served PDF. Never classify a newly generated brochure as a supplied asset to bypass full-copy review. Render every page and inspect it even in supplied-asset mode.

`copy_library.py render` includes brochure text and interface wording in the user review. A material addition or copy edit changes the approved revision. Rerunning comparison against unchanged wording does not itself require a new user approval.

## Capture and compare

Use the actual running generated app, a current source snapshot and a reviewed `test-fixture.json`. The fixture must set `synthetic: true` and supply working paths, selectors and fictional form values. Install Poppler (`pdftotext`) using the supported local setup. From the generated project:

```bash
python3 scripts/check_gates.py snapshot . --mode handoff
node scripts/capture-rendered-copy.mjs --url http://127.0.0.1:8787 --fixture test-fixture.json --project-root .
python3 scripts/copy_parity.py .
python3 scripts/check_gates.py record . --gate rendered_copy --report build/rendered-copy/result.json
```

Capture visits 1440px desktop and 390px mobile layouts, opens visible native FAQ disclosures, reads each form step, exercises a blocked read-only submission, and loads the thank-you page. It preserves inline emphasis and excludes hidden/clipped substitutes. Authored input placeholders and dropdown option labels are included; entered form values are excluded. Failure and uncertain messages are state copy: neither may appear in the initial form, and the capture must observe one after the blocked submission. Do not render error help permanently to make aggregate parity pass. Custom accordions/tabs need exact CSS selectors in the fixture's `copy_interactions` list; review the selectors before running them. The default capture blocks mutating requests and submits no lead. The required local journey separately proves actual submission and CRM persistence.

If the thank-you page requires a real receipt, use `--allow-test-lead` only within an already authorized synthetic test. It may submit once per viewport and affect notifications/metrics; the report counts attempted submissions, not verified saved leads. On a live site also require `--allow-remote` and the approved live-test scope. Use the journey verifier for stored receipt proof. Do not weaken receipt protection to make a read-only capture pass.

The thank-you page must visibly link to the reviewed brochure at each width. The downloaded brochure must be byte-identical to the checked local public PDF. Extracted text is compared with its complete approved wording, or the PDF hash must match the genuine supplied asset. Unknown added wording, missing qualifiers, viewport-specific omissions, changed promises and changed PDF bytes block the gate. The checker tolerates whitespace, case and common typographic punctuation, known neutral controls, actual page-number lines and explicit standalone `Page N` navigation labels bounded by the real PDF page count. It does not broadly strip numbers, currencies or percentages.

## Resolve failures

Inspect `build/rendered-copy/result.json` for the surface, width and master field. Correct assembly when it drifted; revise the canonical master and obtain the applicable copy approval only if the intended wording changed. If words are behind a custom disclosure, add its real interaction to the fixture. Do not copy extracted output back into the master just to obtain a pass or whitelist a marketing claim as neutral UI. Missing tooling, failed capture and stale fingerprints are blockers, not exceptions to waive.

Take a fresh snapshot and rerun affected checks after source changes. The gate re-computes the comparison from the saved capture/current master and checks their hashes and source identity; a hand-written green flag is insufficient. Reports are project-local evidence, not cryptographic proof of who ran or approved the work.

## Limits

This is text coverage at two explicit widths and recorded interaction states. It cannot prove every dynamic variant, contrast, image-baked text, semantic entailment, proof adjacency or conversion quality. Keep the separate nine-size layout check, actual screenshot inspection and complete PDF-page visual review. Audit unexercised variants explicitly. Copy-only/page-only work does not require this full-funnel capture.
