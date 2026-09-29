# Final review fixes, 29 September 2026

Source: the final review of `254bcb6` (the 28 September field-test fixes). The review ran eight dimensions and sent every finding to three independent verifiers. It produced 80 findings:

- 60 were confirmed by at least two verifiers.
- 4 were rejected by vote.
- 16 were left unverified when the verifiers hit a session limit. Each of those was then checked against the code: 11 are distinct findings (all real) and 5 duplicate confirmed ones.

This records the fix for every real finding and the test that pins it. Tests named without a path live in `skills/community-landing-page-builder/tests/`. Node tests live in `assets/cloudflare/tests/`.

## Publish gate and guided publishing

| Finding | Problem | Fix | Test |
|---|---|---|---|
| release-security#0 (high) | Template integrity ignored `wrangler.jsonc`, so another `main` or `migrations_dir` deployed unchecked code and SQL | `validateTarget` requires `main: src/worker.js` and the `migrations` directory, and refuses bundling or runtime overrides (`alias`, `define`, `rules`, `no_bundle`, `tail_consumers` and similar). It runs on the working and frozen configuration | `release.test.mjs` "the published Worker is built from the tested entry point and migrations only" |
| release-security#2 | Any `tests/` folder switched the integrity gate off | The bundle decides. A current bundle always runs the integrity check. A legacy bundle that still hashes the template tests runs its suite only when that suite is exactly the locked one | `publish-regression.test.mjs` "a tests folder cannot replace the template check" |
| release-security#3 | CRM shells and nested or `.mjs` admin files were unchecked | Every file under `public/admin/`, plus `login.html` and `account-action.html`, is template-owned. `verify_backend_reuse.py` covers the same files and reports extras | `publish-regression.test.mjs`; `test_backend_reuse.py` |
| Follow-up to release-security#1 | Locking the CRM shells left a `public/_redirects` 200 rewrite as the way to serve other bytes at a CRM URL | Rules may name only literal landing-page paths; wildcards, placeholders, hosts and CRM or API paths are refused | `publish-regression.test.mjs` |
| docs-consistency#4 | `security-operations.md` cited the deleted `sync_crm_example.py` | Now names `templateIntegrity`, `validateTarget` and `verify_backend_reuse.py` | Documentation |
| Found while tracing | `ship.py` rejected the `template-integrity-verified` evidence current projects produce, so the wizard never passed its quality step | Accepts both regression outcomes; unknown values still fail | `test_ship.py` template-integrity and unknown-evidence tests |
| Found while tracing | When a token could list zones but not read rules, the owner's edge-rule confirmation was never accepted | Without rule access, the owner's confirmation is the evidence (never labelled API-verified) | `ship-provider.test.mjs` "owner confirmation settles the edge rule" |

## CRM template and static checks

| Finding | Problem | Fix | Test |
|---|---|---|---|
| release-security#5 | The Google Ads export ran oldest-first with a silent 10,000-row cap, and the CRM sent no `from` | Each stage keeps its newest 10,000 conversions and sets `X-Export-Truncated`; the CRM sends the last 90 site-time-zone days and says when older rows were left out | `admin-operations.test.mjs`, `crm-ui-behavior.test.mjs` |
| release-security#6 | `from` was compared as a UTC date | `from` is a real calendar day in the site time zone; invalid dates return 400 | `admin-operations.test.mjs` |
| release-security#7 | `$` patterns in `phone_display` corrupted the header phone | A replacer function writes it literally | `verification-tools.test.mjs` |
| release-security#8 | The chat preview escaped only lowercase `</script` | `</script` and `</style` are escaped in any case | `test_final_review_template.py` |
| template-static#0 | `npm run configure` rewrote a derived thank-you page | A derived page is skipped, with a prompt to re-derive it; one header phone | `test_final_review_template.py`; `verification-tools.test.mjs` |
| template-static#1, e2e-walkthrough#3 | The documented hero media failed the 320x700 fold check | A narrow short-screen rule in `styles.css`; all ten viewports pass | `verification-tools.test.mjs` (runs `measure_funnel.mjs`) |
| template-static#2, #3, #4 | Static validation misread preselected choices, attribute spelling and comments | Parsed the way browsers do; comments and script text are ignored | FunnelFormBehaviorTests |
| template-static#6 | The derived thank-you download link and guide reader sat left of the column on desktop | Centred link; the reader sits in the content column | `reader-delivery.test.mjs` |
| e2e-walkthrough#6 | The chat preview left iframe, embed and object sources unresolved | Inlined as data URIs and checked | `test_embedded_guide_reader_is_inlined_and_checked` |
| e2e-walkthrough#7 | Approved thank-you and modal wording the helpers cannot show surfaced only at capture | Deriving names that wording; `copy-workflow.md` names the fixed modal strings | `test_approved_thank_you_wording_the_page_cannot_show_is_reported_when_deriving` |
| e2e-walkthrough#9 | `validate_page.py` failed on the helper's own thank-you page | The guide cover carries its image role | `test_guide_cover_satisfies_the_static_image_contract` |
| docs-consistency#13 | `API-CONTRACT.md` gave the wrong analytics default | New builds default to `disabled`; the Worker's consent rule is restated | `runtime-contract.test.mjs` |

## Copy approval and the owner guide

| Finding | Problem | Fix | Test (`test_final_review_copy_guide.py` unless named) |
|---|---|---|---|
| copy-approvals#0 (high) | A long dash in drafted copy produced an owner approval that could never be recorded | Surface-scan findings route to `copy_review` repair work that the runner dispatches; no Approve button is shown | SurfaceScanRoutingTests |
| copy-approvals#1 | Markdown heading text was not in the passage digest | Heading lines belong to their passage | PassageTests |
| copy-approvals#2 | The per-passage delta was computed against a fixture approval | Only the owner's own approval is a baseline | PassageTests; ReviewEndpointTests |
| copy-approvals#3 | Question history re-hashed cited files, so later edits blocked copy | History checks the evidence shape; `qualify()` still hashes at ask time | QuestionHistoryTests |
| copy-approvals#4 | Removed passages were counted but never shown | `/api/review` lists them; the guide labels them "Removed" | ReviewEndpointTests; GuideScreenTests |
| copy-approvals#5 | Old review content stayed beside a newer Approve button | The review pane clears when the pending review changes | GuideScreenTests |
| copy-approvals#7 | Reordering sections skipped re-approval | A `section_order` passage | PassageTests |
| image-proof#10 | The guide never asked `business_type` | Optional questions that research flags as ambiguous are asked; contract 4 visual acceptance needs `business.archetype` | ArchetypeTests |
| e2e-walkthrough#10 | `guide.py local` dropped its bootstrap step; a thank-you overflow was reported as fitting | The step is kept as `setup`; the overflow detail reports the measured width | LocalCommandTests |

## Reader guide PDF

| Finding | Problem | Fix | Test (`test_final_review_copy_guide.py`) |
|---|---|---|---|
| guide-pdf#0 (high) | The first build's `guide.json` sync deadlocked a pending image handoff | The fingerprint and chapter placements use the guide exactly as the build writes it | GuideImageHandoffTests |
| guide-pdf#1 (high) | Invented prices passed the price-table evidence check | Every figure must appear in its cited excerpt; contract 4 price rows need direct or qualified support | PriceTableEvidenceTests |
| guide-pdf#2, e2e-walkthrough#4 | The narration lint read evidence excerpts and reviewer judgement | Only printed reader text is linted | NarrationTests |
| guide-pdf#3 | Unapproved `thank-you.json` hero copy counted as approved | No longer whitelisted; thank-you wording must be approved in the master | ThankYouParityTests |
| guide-pdf#4 | An automatic font was checked against incomplete text and saved permanently | Checked against everything the PDF prints, recorded in `brand.auto_defaults` and re-derived each build | FontDefaultTests |
| guide-pdf#5 | In Markdown-copy projects the guide text was outside copy approval | It is in the fingerprint, the `pdf_guide` passage, the surface scan and the review | MarkdownGuideApprovalTests |
| guide-pdf#6 | Ordinary trade advice was flagged as narration | The lint needs a website reference; first-person advice passes | NarrationTests |
| guide-pdf#7 | An automatic brand colour could make the cover band unreadable | Adopted only at 4.5:1 contrast and re-derived when corrected; the caption falls back to white | BrandColourTests |
| guide-pdf#8 | `-layout` extraction split wrapped price cells | Guide text is extracted with `pdftotext -raw` | GuideTextExtractionTests |

## Images and proof

| Finding | Problem | Fix | Test (`test_final_review_images.py` unless named) |
|---|---|---|---|
| image-proof#0 (high) | Network, DNS, timeout and TLS failures closed a proof candidate | Explicit failure classes. Environment failures record `no-download-tool` with a receipt and stay unresolved for the owner; only failures of the photo itself resolve as `acquisition-failed` | `test_environment_failures_leave_the_photo_for_the_owner` |
| image-proof#1 (high) | A `no-download-tool` candidate could never be closed after the owner attached the photo | `acquire --replaces <candidate>` for an owner-supplied client-proof asset; both links are checked | `test_owner_attachment_replaces_only_a_no_download_candidate` |
| image-proof#2 (high) | Research binding missed CDN, www/apex, http and inventory URLs | Hosts: `client_website` with and without www, its subdomains and the inventory hosts; URLs are normalised; schema-2 plans must record `client_website` (or `null`) | `test_research_binding_covers_cdn_www_http_and_inventory_urls` |
| image-proof#3 | Rights records were not tied to the file | `check_rights` binds the file hash, rechecked after download and in preflight | `test_upload_record_authorises_only_its_files` |
| image-proof#4 | Any page could be inventoried as the client website | The page must be on `client_website` | `test_client_website_origin_needs_a_page_on_the_client_site` |
| image-proof#5 | `reuse-not-authorized` accepted any evidence file | Needs an `owner_refusal` or `license` record | `test_reuse_not_authorized_needs_a_refusal_record` |
| image-proof#6 | The image file itself was accepted as the element capture | The capture may not be any source or variant in the plan | `test_element_capture_cannot_be_an_image_file_from_the_plan` |
| image-proof#7 | A first-party photo in a non-proof slot escaped the ledger | Photos must be registered, and a non-proof placement needs an `unsuitable` disposition | `test_business_photo_in_any_placement_is_in_the_ledger` |
| image-proof#8 | The capture script aborted on the first failure and wrote nothing | Per-asset capture, hidden and missing images reported, reports always written | CaptureScriptTests |
| image-proof#9 | srcset parsing split CDN URLs at commas | A spec-style `srcset_urls` tokenizer | `test_srcset_keeps_commas_inside_cdn_urls` |
| image-proof#11 | Legacy client-supplied entries could not gain an authority | Upgraded in place; true duplicates are still refused | `test_legacy_client_supplied_entry_is_upgraded_in_place` |
| image-proof#12 | The receipt filename used the raw inventory id | Sanitised slug plus hash, placed with `safe_path` | `test_receipt_name_never_carries_the_inventory_id_as_a_path` |
| image-proof#13 | Any mention of a used photo's path counted as rendered | An HTML parser requires a visible `img`/`source` | `test_used_proof_must_be_rendered_by_an_image_element` |
| image-proof#14 | The C09 test did not pin the hash binding | `test_field_test_20260928.py` tests extended | Mutation-checked |
| image-proof#15, docs-consistency#9, e2e-walkthrough#8 | The `owner_instruction` record was undocumented; relative evidence paths failed | Documented records are run through the tool; evidence paths fall back to the project root | `test_documented_owner_records_are_accepted`; CLI test |
| Follow-up | Photos pending for the owner blocked the visual gate even in a preview | Category fit blocks pending candidates in handoff/live only, like the images gate | `test_field_test_20260928.py` "photos waiting for the owner" |

## Docs and verification tooling

| Finding | Problem | Fix | Test (`test_final_review_docs_verify.py`) |
|---|---|---|---|
| docs-consistency#0, verify-tooling-ci#1 (high) | `quickstart.py verify --mode handoff` could never pass the performance gate | Handoff runs at least three Lighthouse audits and passes the actual `--server-command` | Handoff performance tests |
| docs-consistency#1 | Docs required one Lighthouse pass | Three retained runs for handoff; one run is a preview diagnostic | Viewport and run-count test |
| docs-consistency#2, #3, #5, #6, #7 | Nonexistent commands, records and documents in orchestration, completion-integrity, first-run and the start-here guide | Each points at the real tool or is removed | Reference existence test |
| docs-consistency#8 | Copy approval was described as opt-in | Guided mode always requires it | Opt-in wording test |
| docs-consistency#10, #11, #12 | Viewport list, visual-review contract and question categories were out of date | Ten viewports including 320x700; the full visual contract; `search_intent` | Doc consistency tests |
| e2e-walkthrough#0 (high) | The generated `test-fixture.json` could never pass `local_journey` | All 16 attribution keys; `measured_visit` matches live-verify; only the old generated fixture is upgraded | Fixture tests run through live-verify's own checks |
| e2e-walkthrough#1 | The copy stage required QA-report rows | `validate_required_records` checks per stage; the default is handoff | Stage test |
| e2e-walkthrough#2 | The fast path's research-record aliases were ignored under contract 4 | SKILL.md maps them through `build/document-sources.json` | Fast-path test |
| e2e-walkthrough#5 | Repeated risk words shared one finding id | One finding per id | Disposition test |
| verify-tooling-ci#0 | Project `bootstrap` looked for a missing requirements file and re-entered a broken venv | Falls back to the bundle's requirements, removes a failed venv, re-enters only a working one | Bootstrap driver test |
| verify-tooling-ci#2 | Handoff verify never recorded the final review, and reruns made it stale | Current reviews are recorded first and the evidence they cite is kept | Rerun tests |
| verify-tooling-ci#3 | "Get owner photos" was shown for candidates that need a decision | Only `no-download-tool` candidates ask the owner; others show their own error | Proof-photo hint test |
| verify-tooling-ci#4 | Stale-demo detection missed helpers the demo lacked | Missing helpers mark a demo stale | Missing-helper test |

## Rejected by the verifiers

- **copy-approvals#6 (0 of 3):** the pre-approval surface scan reads metadata in `page-copy.json`. This is intended. The whole copy master is the scanned surface, and the handoff gates run the same scan; approval now applies it earlier.
- **release-security#1 (1 of 3):** `public/_redirects` 200 rewrites can serve other bytes at locked paths. The verifiers rejected it because the gate guards against drift, not deliberate tampering, and because the CRM shells were project content then. release-security#3 has since locked those shells, which left rewrites as the remaining way to change the CRM, so the gate now refuses any rule that is not a literal landing-page path (`publish-regression.test.mjs`).
- **release-security#4 (0 of 3):** the manifest is self-attested. The integrity gate catches drift, not deliberate tampering: its checker and manifest both live in the project, and a normally scaffolded bundle hashes every file.
- **template-static#5 (1 of 3):** the phone-pattern check blocks the Worker's own character class. This is intended and documented. A tel pattern must count digits itself; static validation cannot assume the bundled script.

## Behaviour changes after this release

- Owners re-approve once at the next copy change, because of the `section_order` passage, heading lines in Markdown passages and the `pdf_guide` passage.
- Contract 4 guides with price tables need `support_type` and `reviewer_judgment` on price rows. `build/guide.json` gains `brand.auto_defaults`.
- Schema-2 image plans need `client_website` (or `null`). Photos acquired without a proof candidate need `candidate` before the images gate passes.
- `validate_required_records` defaults to the handoff stage. `verify` records current visual and final reviews at the start of a run. The old generated `test-fixture.json` is upgraded once.
- Projects publish only with `main: src/worker.js`, the `migrations` directory and no bundling overrides. A `tests/` folder no longer bypasses the template check.
- `npm run configure` leaves a derived thank-you page alone. After changing `index.html`, re-run `thank_you_page.py`.
- The Google Ads export covers the last 90 days, and each stage keeps its newest 10,000 conversions.
- Static validation fails a required select, radio or checkbox that arrives already chosen, unless `funnel.json` declares that default.
