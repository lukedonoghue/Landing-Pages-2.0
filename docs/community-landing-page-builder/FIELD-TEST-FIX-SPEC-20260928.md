# Field test fixes, 28 September 2026 (Bear Plumbing, two runs)

Source: the consolidated report "LP skill test Sep 28" (report A: delivered preview and audit; report B: actual-run postmortem), baseline `d0fe049`. Each finding keeps its report attribution. This records what changed in the skill and the test that pins it.

## Images and proof (B, P0)

| ID | Finding | Fix | Test |
|---|---|---|---|
| C07 | Four real gallery photos found in research were replaced by created illustrations | Proof-candidate ledger in `image-plan.json` (`image_workflow.py candidate`). Every candidate needs a disposition: `used`, `unsuitable`, `reuse-not-authorized`, `acquisition-failed` or `no-download-tool`. Research attempts and client-site image URLs in `docs/IMAGE-RESEARCH.md` must be candidates, and a `used` photo must be served on the page | `test_first_party_candidate_needs_disposition`, `test_used_proof_must_be_on_the_page` |
| C08 | "Environment blocks retaining" asserted with no attempt record | `acquire` writes a receipt in `research/acquisition-receipts/` (URL, method, time, error class) and marks the candidate `acquisition-failed` itself. A narrative status is rejected, `host-not-allowed` is not accepted as a failure, and `no-download-tool` is a separate, unresolved capability state that blocks handoff and becomes an owner request to attach the photos | `test_unavailable_candidate_needs_attempt_receipt` |
| C09 | Agent-made graphics recorded as client-supplied and client-authorized | `inventory-file --authority user_attachment|owner_instruction|agent_created`; a local path never implies client supply. Client-supplied needs a typed record listing the file's hash; `client-provided`, `client-authorized` and `licensed` rights need typed owner or licence records, not prose. Agent-created files get `agent-created` rights and can never be proof | `test_agent_created_file_not_client_supplied`, `test_client_authorized_requires_owner_receipt` |
| C10 | A four-image count passed while proof was unresolved | The images gate reports `proof_role` (candidates, used, unresolved, status) separately from the count; illustrations cannot resolve a candidate, and a `used` candidate must be a `client-proof` asset | `test_image_count_does_not_close_proof_gap` |
| C11 | Four image reviews reused one full-page screenshot pair | Reviews need the element's selector, bounding box, served-file hash and an element capture; the gate refuses shared captures. New `capture-image-reviews.mjs` records all of it per image and placement | `test_image_reviews_require_asset_specific_capture`, `test_review_needs_element_evidence_not_just_a_page_screenshot` |
| C12 | Visual and control reviews missed a plumbing page that read as SaaS | `category_fit` in the visual review (would it read as this business without its name?) and `media_strategy` in the control comparison, required under contract 4 and for every `local_trade`. A local trade that uses none of its own photos with a self-review needs the owner's visual sign-off. New discoverable `business_type` question sets `business.archetype` | `test_local_trade_category_fit_required`, `test_comparison_records_media_strategy_separately` |
| B §7 | Proposal: realistic support imagery for physical services | Added as a clearly labeled new preference in SKILL.md; generated scenes stay illustrative and never proof | Documentation |

## Copy, delivery and markup

| ID | Finding | Fix | Test |
|---|---|---|---|
| C13 | Prohibited dashes found only after copy approval (B) | The surface scan runs on the exact copy before approval is recorded and on every later approval check | `test_copy_surface_scan_precedes_approval` |
| C05 | Download label and a hidden sentence disagreed with the master (A) | The thank-you build refuses a `download_label` that differs from the approved copy; hidden master text was already reported missing by the rendered-copy gate | `test_confirmation_download_label_must_match_the_approved_copy` |
| C14 | Raw relative-resource HTML failed in the chat viewer (B) | `self_contained_preview.py build` makes a single-file preview (inlined CSS, scripts, images, fonts; forms disabled with a notice); `check` refuses a file with relative resources | `test_chat_preview_isolated_assets` |
| C06 | Two `<!DOCTYPE html>` declarations per exported page (A) | Static validation requires exactly one declaration and at most one html/head/body per page | `test_repeated_document_declaration_fails_static_validation` |

## Form, confirmation and runtime (A)

| ID | Finding | Fix | Test |
|---|---|---|---|
| C02 | Phone pattern counted characters, not digits | The bundled form script applies the Worker's rule (allowed characters, at least 7 digits) with a field error; static validation fails a pattern that accepts punctuation only | `punctuation-only and short phone numbers...` (Node, real browser), `test_phone_pattern_must_count_digits` |
| C03 | Required reason select preselected "New project" | Static validation fails a required select without an empty prompt unless `funnel.json` declares the default | `test_required_select_default_must_be_declared` |
| C01 | Confirmation kept enquiry buttons and the form | Static validation fails a thank-you page that keeps the form, the modal or any enquiry opener | `test_confirmation_does_not_reopen_the_enquiry` |
| C15 | Pages never loaded `funnel.js`, so no attribution or receipt | Static validation requires `funnel.js` before `script.js` on CRM pages, and `funnel.js` plus `confirmation.js` on a confirmation with confirmed-only content | `test_runtime_loads_before_the_form_script` |
| C04 | 12px phone at 320/360px; wrong test viewports | `displayed_phone_readable` checks every visible telephone link at every viewport; the browser gate requires 320x700 evidence | Browser gate fixture updated; demo verification |

## Records and interpretation (A, section 5)

| Concern | Fix |
|---|---|
| Guide voice (F10) | The guide build rejects source-reporting and page-disclaimer narration ("X lists...", "is promised by this page"); `test_guide_research_narration_is_rejected` |
| Guided copy checkpoint (F11) | Guided mode always requires the complete-copy approval; the config flag cannot switch it off (`copy_approval_required`); `test_guided_mode_always_requires_copy_approval` |
| Sentence grounding (F09) | copy-acceptance.md classifies factual assertions, reader questions/instructions and disclosures; each declarative factual sentence needs a judgment |
| Task, comparison, guide and dependency records (F12-F14, F18) | `quickstart.py verify` in preview mode now lists `handoff_readiness` blockers (missing dependency manifest, question log, comparison and guide lineage) instead of surfacing them only at export. No historical records are fabricated |
