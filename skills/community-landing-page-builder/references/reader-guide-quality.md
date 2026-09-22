# Researched reader guide and full thank-you page

A valid PDF is not a useful guide. New builds (`quality.reader_guide_version: 1`) must pass a separate content, image, delivery and actual reader-review contract. Keep existing source, copy, image, privacy and publication gates. The scripts never generate facts, fetch images, call a model, declare semantic quality, or authorize publication.

## What to make

Start with the buyer's unanswered questions, not a six-page services template. Choose the questions using the supplied website, current official product/service/process/FAQ material and actual owner information. Use authoritative industry sources for general education only when they add useful explanation. Capture the exact source, title, date and excerpt in `research/`; distinguish an industry fact from a claim about this business. Never infer prices, guarantees, certifications, customer results or maintenance-free performance. Explain uncertainty rather than fill it with boilerplate.

For a gutter-protection buyer, useful questions might be: which debris and roof details change the recommendation; how to compare material/opening/fixing choices; what preparation and covered areas to ask about; what ongoing maintenance remains; and how to compare a written quote. Research those answers before writing them. Do not claim that a generic illustration proves suitability, fire compliance or a specific installation method. Technical/safety details need the relevant primary source and intact qualifications; do not give unsupported roof-climbing instructions.

Write a concrete benefit headline, explain the mechanism/trade-off in plain language, then give the reader a practical action or question. For example, “Know what is included before comparing quotes” is clearer than “The right service for what comes next.” Short copy must still say something. Make the guide useful even without a sales call: meaningful explanations, comparisons, decisions and a checklist, not repeated instructions to book. A reader who has just submitted a form should not be told to submit the same request again.

The adaptive PDF renderer uses readable body text, ordinary white space, measured flowing paragraphs and actual images. Do not pad to a fixed page count, leave enormous empty panels, overlay a dark logo on a dark background, or shrink away useful detail to fit a page. Reuse verified brand fonts and colours with legible contrast. Refresh canonical page/form/thank-you/PDF promises after material copy changes and repeat the relevant copy approval only when that checkpoint is selected.

## Images are required content, not decoration

Use at least one meaningful cover image and one distinct explanatory interior image. Logos, blank colour rectangles and tiny thumbnails do not satisfy this. Reuse appropriate website or owner-supplied images first, with an actual reuse basis. Capture acquisition provenance and the downloaded bytes. Website discovery alone does not confer reuse rights.

When real imagery cannot explain a concept, use an actual available ChatGPT/native image tool to create an illustration. Record the real tool result and output hash. Do not write a generation receipt for an image that was never generated, and do not silently add an API-key dependency. Generated imagery is captioned as illustration, never as an employee, customer, installation, result, certification or testimonial. An accurate labelled concept diagram can be useful; a generic stock-like image that adds no information is not. Open the actual images and check their relevance. Reuse the existing image-plan lineage so a derived PDF cover does not count as another original photograph.

Every image in `build/guide.json` records `id`, `placement` (`cover` or chapter ID), project-relative `path` under `public/assets/`, `sha256`, `source_type` (`website`, `supplied`, `generated`), `role`, reader-facing `caption`, `purpose`, `rights_basis`, `evidence_path` under `research/`, and `evidence_sha256`. Website images also record the actual `source_url` present in the acquisition evidence. Generated images require `role: illustration` and an illustration disclosure in the caption. Keep readable diagrams uncropped; never place text over important labels or subjects.

## Author the guide, then build it

The scaffold provides an unfinished `build/guide.json`, deliberately blocked until authored. The new format is `document_type: buyer_guide`, `workflow_ready: true` only after real writing, and:

- `title`, `subtitle`, `audience`, `reader_promise`, actual `author_task_ids` and `brand` (name, optional project-relative logo, verified phone and colours/fonts).
- `sources`: unique `id`, truthful `kind` (`business`, `industry`, `user`), `title`, `retrieved_at`, local captured `path`, `sha256`, and actual HTTPS `url` for web sources. Supplied user evidence retains its origin; it is not an independent certification.
- `chapters`: at least two real buyer decisions with `id`, `headline`, `reader_question`, `why_it_matters`, substantive `paragraphs`, useful `takeaways`, and `evidence`. Each evidence row has `source_id`, exact captured `excerpt`, and exact authored `claim`. The excerpt anchors a claim; the reviewer must still judge whether it supports it. Word-count guards are a floor against empty output, not a writing target.
- `images` as above; `checklist_title`, actionable `checklist`, coherent `next_step`, and concise `scope_note`.
- `delivery.output`: the actual PDF under `public/assets/brochure/`. The main page's useful guide links and all confirmation download/reader links must point to this same file.

The agent runs:

```sh
python3 scripts/build_guide.py .
```

This produces the PDF, an actual first-page `*-cover.png`, extracted text, every rendered page and a schema-2 `build/guide-build.json` binding source/copy/image/output hashes. This is **mechanical evidence only**. It does not pass the reader-review gate. A bare `image_mode: none` catalogue cannot satisfy a new reader-guide build.

## Full thank-you page, not another success card

Author `build/thank-you.json`: `main_page`, `output`, optional `hero_id`, `confirmed_headline`, exact approved `follow_up`, `download_label`, optional `guide_title`, and a useful `guide_summary`. Keep generated pages at the same directory level, normally `public/index.html` and `public/thank-you.html`, so shared relative URLs continue working. Mark the original hero `data-page-hero` or use its explicit ID.

```sh
python3 scripts/thank_you_page.py .
```

The helper reuses the actual main-page header, styles, phone contact, brand, approved testimonials/proof, benefit/process/FAQ sections and footer. Only the first-screen purpose changes: accepted request, what actually happens next, what the guide helps with, its download action and its real cover preview. The full on-page reader is available below with a download fallback. Preserve existing factual qualifications; do not invent testimonials because a template has a proof slot.

Original enquiry buttons become guide-download actions and the submission form is removed. Do not accidentally fire a new lead or conversion. Make shared custom scripts tolerate the absent form while retaining useful accordions/navigation. The browser check, not a file-exists test, must prove this. If the original hero is unusually nested or page structure is malformed, mark/fix that source structure; do not substitute an unrelated box. If the saved main page changes, regenerate the thank-you page before the final capture.

The confirmation script displays the success message only when this session has a recent receipt saved by the existing accepted-submission handler. A direct visit, expired/malformed receipt or unavailable storage shows an honest neutral guide state instead. That client-side cue is not server authentication and never grants access to private content. Public guides remain downloadable; a genuinely access-controlled offer requires its separately verified delivery mechanism. Confirmation text, email delivery and callback timing must match actual operational promises. A promise such as “immediate callback” must not be copied out of a pre-submit CTA.

Existing customized thank-you pages are never silently overwritten. The agent first inspects the original, then records its exact `replace_existing_sha256` for that intentional migration. Rebuilding a previously generated page preserves unrelated main-page content. Existing client folders must be deliberately upgraded from the installed skill; changing this repository does not modify files on an owner's computer.

## Automatic reader review, repair and retest

After building, open **every actual rendered PDF page at readable size**. Inspect the complete thank-you page at 320/390/1440 pixel widths, with and without a valid session receipt. Check logo/contrast, white space, headings, body readability, diagrams, photo placement, links, phone number, guide preview, download, reader fallback, full below-fold sections and console/network errors. A successful render, minimum word count or image hash never establishes these qualities.

A fresh reviewer is preferred; otherwise disclose separate self-review. Write `build/guide-review.json` with current `build_sha256`, truthful `reviewer: {mode, task_id}`, ordered `pages: [{page, render_sha256, observation}]`, and seven `checks: [{criterion, verdict, excerpt, observation}]`. Criteria are `reader_value`, `benefit_clarity`, `source_fidelity`, `practical_detail`, `imagery_relevance`, `readability`, and `coherent_next_step`. Excerpts must be exact extracted PDF words; observations must explain the actual judgment, not just say pass.

Failures use `verdict: improve` and `unresolved_findings: [{id, problem, before, acceptance_test}]`, with actual weak wording in `before`. The controller dispatches `guide_repair` automatically, not another owner approval. Fix the content/images/layout, rebuild the PDF, regenerate the shared confirmation and review fresh renders. Before overwriting a reviewed PDF, the builder preserves the failed review and extracted wording under `build/guide-review-history/`. Do not alter this history to hide a defect.

A passing fresh review has all seven checks `pass`, no unresolved findings, and `improvements` documenting actual changes. Each prior finding needs `id`, `review_sha256` (history filename stem), `problem`, exact original `before`, exact final `after` and `verification`. A layout-only repair can retain wording with `kind: layout` and concrete visual verification; it still requires new rendered evidence. Do not manufacture edits merely to claim improvement.

```sh
python3 scripts/build_guide.py . --check
```

The controller advances through **guide_build → thank_you_build → guide_review**, or routes failed review to **guide_repair**. It then performs the mandatory Blue Mountain comparison and affected final gates. Changes to the main page during that comparison trigger confirmation regeneration; stale evidence blocks acceptance. The existing catalogue gate also independently checks the reader guide and confirmation. The native runner allows these artifacts but not edits to business authority, approvals or controller code.

The original catalogue renderer remains for explicit catalogue/legacy work; it is not the default substitute for a newly requested reader guide. A genuine researched omission must be recorded with `catalogue.omission_reason` and `omission_evidence` entries (`path`, `sha256`, exact `excerpt` from captured `research/` sources); missing images, limited time or absent supplied content are not omission reasons. Source/visual judgments remain the actual reviewer's responsibility. Unit tests use explicitly synthetic evidence and do not prove model-generated copy quality, native subscription availability, live customer enquiries or production deployment.


## Explicit native guide-image handoff

Use [guide-image-handoff.md](guide-image-handoff.md) when a PDF needs an explanatory image not available from permitted sources. The persisted `image_handoff` action returns the actual native request once; an unavailable tool is a precise handoff, not a repeated model run or new API-key requirement. Resume after registering and linking the real output, or explicitly reconcile a permitted source fallback.
