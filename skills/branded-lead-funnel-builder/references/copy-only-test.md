# Website-to-copy test mode

Use when the user provides a website and asks to see the landing-page copy, test the copywriter, or run a copy-only pass. This mode produces research and finished wording. Do not scaffold a website, CRM, database backend or publishing workflow. The copy library is already installed and requires no new infrastructure.

## Begin with the supplied website

Use a fresh project directory for each run. Read `copy-doctrine.md` and `copy-workflow.md`. Collect a bounded set of relevant website pages:

```bash
python3 scripts/copy_project.py --website '<supplied URL>' --project '<absolute run directory>'
```

The helper uses Firecrawl and writes source files directly to disk. It inspects the home page and selects service, process, FAQ, reviews, about and other useful pages with category diversity. Use `--page '<observed service-page URL>'` for a specific supplied or discovered service. It collects source text only; it does not infer business facts or call a writing model.

Read the source index and relevant text. Determine the business identity, main service, intended audience, location, actual offer, voice, permitted claims, and important objections. If a choice is unresolved, use a clearly stated reasonable assumption when it does not change the service/offer materially; otherwise ask one focused question while continuing independent research.

Search for relevant public customer reviews where useful. Match the listing to the same business, phone and website. Keep exact words and names tied together. Add only targeted industry or competitor research needed to explain buying criteria, method differences or genuine differentiation. Reference-library claims are not client evidence. Record missing reviews rather than inventing proof.

Record additional sources in `research/sources.json` with a unique ID, URL or supplied-source reference, retrieval date, `status: captured`, a project-relative text path, and the SHA-256 of that text file. A source from an external review page may be added after the agent inspects it; the automated website collector intentionally stays on the client domain.

## Build the brief from evidence

Create `build/client-copy-brief.json` using the fields in `copy-workflow.md`, with:

- `output_mode: copy_only`
- `required_components: ["page"]`, unless the user also wants modal, thank-you or brochure wording.
- `source_manifest: research/sources.json`
- `required_sections`: stable IDs for the sections the page actually needs.
- `primary_reference_url`: Blue Mountain when explicitly requested or established as the main structural reference.

Every approved website fact has a `source_id` and an exact supporting `evidence` excerpt. Facts supplied directly by the user can have `evidence_type: user_instruction`, with the dated instruction recorded as their source. Keep inferred buyer motivations separate from factual claims. The helper checks source existence, hashes and exact excerpts; the reviewer still determines whether the evidence supports the proposed wording.

Use the site's actual next action unless the user provides another offer. Do not invent a downloadable brochure, a free service, guarantee, customer count or response deadline to make the page resemble the examples. `follow_up_promise` can be an empty string in copy-only mode when no operational promise is known; omit that promise from the page.

Prepare a benefit/proof map and a section plan. The usual service-page sequence is hero and CTA → relevant proof → why choose → benefits/mechanism → how it works → FAQ → final CTA. Combine redundant blocks. If there are no verified testimonials, use appropriate factual reassurance or omit that block.

## Write, review and deliver

Prepare selected references with `copy_library.py prepare`, then perform the actual writing task using its context and the source-linked brief. Write complete `build/page-copy.json`. Review and revise with the eight criteria in `copy-workflow.md`. Save the real editorial findings and input hashes; a script-generated pass template does not count as an editorial review.

Run the audit, then create a clean document for the user:

```bash
python3 scripts/copy_library.py render --copy '<run>/build/page-copy.json' --audience client --out '<run>/PAGE-COPY.md'
```

The client document omits evidence IDs and internal notes. Keep the detailed research, source map and review separately. Deliver the actual page copy in a reusable document/writing block or readable file, including all headings, body text, bullets, FAQ answers and button wording. Lead with the copy, not a long explanation of the machinery. Mention material assumptions or missing evidence briefly outside the copy.

Call the result “copy reviewed” when appropriate. A copy-only run does not imply visual QA, a built form, deployment or conversion performance. Ask for the user's critique of specificity, tone, headline strength and section flow; use accepted corrections to refine the style without making every client-specific choice universal.

## Screenshot acquisition

Use existing local captures whenever possible. For Drive images, request `include_base64: false` and download the returned file reference directly to disk with a normal file downloader. Never print or pass encoded image payloads through tool arguments, patches or conversation output. If file access is unavailable, record the exact blocker and continue with usable text sources. OCR is discovery material until visually checked; it is not automatically training-quality copy.
