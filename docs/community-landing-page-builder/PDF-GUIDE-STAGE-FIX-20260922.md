# PDF guide generation and thank-you delivery stage

## Problem

The skill described a useful PDF as a default deliverable and later validators expected a real linked PDF, but generated projects had no explicit stage that created it. An agent could build the page and form, reach QA, and only then discover that the promised guide was missing or linked to a placeholder path.

## Plan

1. Give every generated project a project-local guide content/delivery contract.
2. Ship the PDF builder, fonts and a deterministic guide runner with the project.
3. Make the runner build the PDF, verify its signature/text, render every page and prove the thank-you preview and download fallback point to the exact served output.
4. Add a distinct workflow stage that blocks snapshot/final QA when generation or delivery is incomplete.
5. Retain only a researched, source-supported omission path.
6. Add end-to-end regressions for incomplete templates, successful PDF generation, page rendering and thank-you delivery.

## Implemented design

- `build/guide.json` is created from `assets/catalogue.example.json` with `workflow_ready: false` and an explicit `delivery` block.
- `scripts/build_guide.py` accepts only a completed `workflow_ready: true` contract, invokes the portable catalogue builder, requires `%PDF-`, runs Poppler rendering and text extraction, verifies a matching `data-guide-download` link, and writes `build/guide-build.json`.
- New projects copy `build_catalogue.py`, `build_guide.py`, `render_catalogue_cover.py` and the licensed PDF fonts, including static-only projects.
- The default thank-you template embeds `/assets/brochure/service-guide.pdf` through a marked `data-guide-embed` preview and retains a marked `data-guide-download` fallback.
- `workflow_progress.py` exposes `guide_build` before snapshot/final QA and detects missing or changed guide inputs, outputs, thank-you pages and rendered pages.
- The entrypoint, catalogue workflow, quality gates, owner next-step guidance and UI prompt all name the stage.

## Verification

- The source skill passed all 120 automated tests and its skill-package validator.
- The installed skill was refreshed from source, matched the changed source files, and passed the same 120-test suite.
- A fresh scaffold regression proved the unfinished template blocks before creating a PDF, then succeeds after the guide contract is completed.
- The active Aussie Gutter Protection project passed the new runner with its real guide: six pages were generated, text-extracted, rendered for visual review and matched to the marked thank-you-page preview and download fallback.
