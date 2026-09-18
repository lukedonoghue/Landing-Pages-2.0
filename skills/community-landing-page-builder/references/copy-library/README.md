# Copy reference library

This is a local retrieval and instruction database derived from the user's [Instapage Links workbook](https://docs.google.com/spreadsheets/d/1tp0H540Gqwor-oLOAv9YFztCQL7dWqHGr9-M1YvtHaI/edit). It does not change model weights. The curated instructions and a few selected examples are loaded when writing; the full archive is not placed into every prompt.

## Files

- `library.sqlite3`: SQLite tables plus FTS5 text search, requiring no server or paid database.
- `sources.jsonl`: portable source records, text, hashes, provenance, quality status and split assignment.
- `sections.jsonl`: extracted heading/content blocks. Roles are heuristic and explicitly unreviewed; these are not all editorially annotated sections.
- `annotations.json`: agent-authored lessons, cautions and exact evidence anchors for reviewed selections.
- `patterns.json`: reusable instruction cards with source anchors, applicability and evidence requirements.
- `source-index.json`: original sheet-row provenance and supplied Before/After figures.
- `manifest.json`: current capture, annotation and integrity counts. Use these rather than hard-coded totals.

The workspace's `copywriting-library/` folder holds reproducible inventory/build scripts and acquisition reports. Original captures and screenshot/OCR files are under `.firecrawl/copy-training/` in that workspace; they are research artifacts, not website assets. The installed skill works from the portable normalized records without the original workspace. Its snapshot paths are provenance locators and may not resolve on another machine.

## Quality levels

`curated` means selected passages have an editorial lesson and caution, not that every claim on the source page is endorsed. `reviewed_support` identifies reviewed variants and contrast examples that are deliberately excluded from default retrieval. `candidate` is captured readable content awaiting annotation or reserved for evaluation. `support_only` includes other funnel stages or homepages. `comparison_only` is a supplied before-page. `excluded` means error, unavailable or unusable content. Screenshot text remains `ocr_candidate` in quarantine until visually checked. OCR confidence cannot validate meaning, identity, layout order or truth.

Source labels are preserved as provided, even where they conflict with live content. Curated annotations use inspected page content. Repeated screenshot links are flagged so one file is not silently assigned to several clients. The workbook's reported conversion figures retain their original values; units, dates, traffic, denominators and causal attribution are not established.

## Retrieval

`copy_library.py prepare` selects only curated training sources, ranks offer and intent heavily, and limits repeated brands and near-duplicate families. The default limit is three. `search` also defaults to curated training sources. `search --include-unreviewed` exposes explicitly labelled candidates for research only; holdout sources stay excluded.

Audience-only matches are insufficient. The selector requires a relevant buying situation, offer or sector as well. Core reference annotations receive a small tie-break preference over shorter supplemental reviews. Pattern cards expose source excerpts only from the selected examples. All reviewed variants remain available for deliberate inspection without inflating default example selection.

Five initial brand families are reserved for evaluation: Quality Hoops, Supreme Buildings, Francis Law, Home Archive and Palmercare. Brand variants and sufficiently similar text are grouped before partitioning. This is leakage control, not a completed blind editorial experiment. Do not tune instructions against held-out answers and then report their results as unseen validation. Keep future genuinely new clients for ongoing evaluation.

## Adding or refreshing examples

1. Capture the exact supplied page and record date, source row, entity and content hash. Preserve old observations if the page changes materially.
2. Identify its actual funnel stage and remove error/blocked content from writing candidates.
3. Read the relevant copy in context. For images, visually verify the OCR against the original before promotion.
4. Annotate the buyer, offer, intent, section job, transferable lesson and specific cautions. Save exact supporting anchors and the reviewed content hash.
5. Group variants and duplicates with existing families. Assign the split before using the material to change instructions.
6. Rebuild the database and run the retrieval/integrity tests. Changed text invalidates the old annotation until re-reviewed.

Never automatically learn every correction as a universal rule. Distinguish a reusable writing lesson from a client-specific exception. Add paired weak/revised examples only when the revision has evidence and the reason is explicit.

## Evaluation standard

Measure separate outcomes: source fidelity, offer accuracy, complete copy, reference-appropriate structure, brand voice, reviewer correction effort and rendered readability. A blocker cannot be averaged away by a high total score. Record failures and the denominator. Automated regression tests check retrieval and review integrity; they do not measure writing persuasiveness or conversion rate. No 99.9% success claim has been established.
