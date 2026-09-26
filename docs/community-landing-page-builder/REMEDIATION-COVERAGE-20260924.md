# Remediation coverage: F01–F48

Basis: the owner-supplied “Landing Pages 2.0 – Critical Remediation Blueprint”, 24 September 2026. Baseline: main a84e619.

## What this matrix certifies

This is a framework implementation/test map, not an acceptance certificate for a generated client page. A row points to executable enforcement and regression coverage; it does not claim that a real business was researched, native imagery generated, a separate reviewer spawned, or a live site published in this repair.

The implementation extends the existing gate/owner/export authorities. Equivalent canonical names are retained where renaming would create competing mutable sources: `build/research-acceptance.json` contains the research dimensions and positioning; `build/claim-review.json` and `build/copy-quality-review.json` cover semantic copy; `build/final-review.json` links final visual/cold-reader evidence. `build/release-inputs.json` is an immutable acceptance packet referenced by owner/archive; `build/release-status.json` is the generated current projection. The archive hash stays in the external export result, avoiding a circular self-hash.

## Fix-by-fix map

| Fix | Implementation | Regression coverage | Scope and boundary |
| --- | --- | --- | --- |
| **F01** — P0 - Add one authoritative release verdict | release_acceptance.py; completion_contract.write_summary | test_remediation_blueprint: rt01, rt02, publication; test_final_handoff | Facade recomputes existing authorities, including workflow, owner, export and selected publication mode. No second gate engine. |
| **F02** — P0 - Make the final conversational status derive from the release verdict | SKILL.md; guide.next_action; release_acceptance --require | test_remediation_blueprint: f48; test_final_handoff | Final conversational class is a current command result. Code cannot prevent an external model from ignoring its instructions. |
| **F03** — P0 - Unify copy authority | copy_contract.py; workflow.copy_state; copy_acceptance.verify; copy_library.audit | test_remediation_blueprint: rt13; test_copy_acceptance | Structured and explicit markdown modes share one contract; narrow editorial review remains labeled as a component check. |
| **F04** — P0 - Stop shipping unfinished scaffold documents | validate_required_records.py; process_contract; completion_contract.document_source_errors | test_remediation_blueprint: rt03; test_completion_integrity: canonical_documents | Required canonical records and retained document views cannot be empty/template. Generated views retain source hashes. |
| **F05** — P0 - Separate product source identity from installed tool runtime | dependency_state.runtime_identity; check_gates.source_snapshot; portable_handoff | test_remediation_blueprint: rt09; test_completion_integrity: runtime_examples, canonical_inputs | Installed runtime identity is separate from product identity. The exporter preserves the version record. |
| **F06** — P0 - Make supported packaging mandatory for reviewed completion | package_handoff.py; portable_handoff; completion_contract.export_status | test_final_handoff; test_completion_integrity: legacy_site_only_export | Only a supported, verified reviewed archive can complete a ZIP handoff. |
| **F07** — P0 - Bind guide, thank-you, page, and copy freshness into one dependency graph | dependency_state.py; build_guide.py; thank_you_page.py; guide_quality | test_remediation_blueprint: f39; test_reader_guide; test_thank_you | Named dependency records plus existing whole-source rejection; material changes cannot inherit old acceptance. |
| **F08** — P0 - Make local CRM journey proof mandatory for form-led local-final | check_gates; live-verify.mjs; journey-state.mjs | journey-recovery.test.mjs; privacy-browser.test.mjs; full synthetic demo | Real local receipt, persistence, authenticated CRM and retry proof remains distinct from simulated error screenshots. |
| **F09** — P1 - Require the full viewport matrix with metadata | measure_funnel.mjs; browser_evidence_errors; capture-final-states.mjs | test_completion_integrity: browser_cannot_infer_viewport; test_remediation_blueprint: f28 | Explicit dimensions/DPR/engine/version/URL/hash/state; required tablet, laptop and short-height views. |
| **F10** — P1 - Require browser-engine compatibility evidence | browser-compat.mjs; check_gates | workflow/browser compatibility tests; full synthetic demo | Selected Chromium/WebKit engines execute the core interaction contract; unavailable binaries block. |
| **F11** — P1 - Make mobile performance evidence source-bound and mandatory | performance-audit.mjs; performance_errors | test_completion_integrity: raw_lighthouse_metrics; full synthetic demo | Three distinct raw mobile audits, real target/server command, configured budgets and raw-median comparison. |
| **F12** — P1 - Make research completeness an explicit contract | research_contract.py; completion_contract.research | test_remediation_blueprint: f12 | Thirteen dimensions in canonical research-acceptance.json. Missing/unknown is not an implicit not-applicable. |
| **F13** — P1 - Enforce research-before-questioning UX | question_log.py; guide.present; workflow_runner.drive | test_remediation_blueprint: rt24, rt25; test_workflow_runner | Actual displayed questions log unresolved material category and prior discovery; automatic mode keeps moving. |
| **F14** — P1 - Make review intelligence mandatory as an explicit state, not optional-by-file | research_contract.py; completion_contract.research; validate_reviews.py | test_remediation_blueprint: rt04; test_review_intelligence | Manifest always required; researched/unavailable/identity_unresolved/not_applicable needs discovery and identity evidence. |
| **F15** — P1 - Separate review intelligence from publishable testimonials | review_workflow.aggregate; copy_quality.inspect | test_remediation_blueprint: rt23; test_review_intelligence | Strategy themes persist independently of publication rights; copy records which themes it used or deliberately omitted. |
| **F16** — P1 - Require positioning-angle comparison before choosing the lead reason to choose | completion_contract.research; research_contract.inspect | test_completion_integrity: missing_research; test_remediation_blueprint: research cases | One to three evidence-linked positioning alternatives, selected rationale, relevance, specificity, differentiation, support and risk. |
| **F17** — P1 - Add a semantic claim firewall | copy_quality.py; build/claim-review.json contract | test_remediation_blueprint: f17 | Current exact claim ledger and semantic reviewer observations. Deterministic risk spotting is not an automatic truth oracle. |
| **F18** — P1 - Split preview implementation disclosure from business follow-up promise | copy_quality.py; guide.py; scaffold_project.py | test_remediation_blueprint: f18 | Separate business_follow_up_promise, preview_disclosure and local_test_behavior. Legacy alias must match the business field. |
| **F19** — P1 - Add an anti-generic copy repair pass | copy_quality.py; completion_contract.inspect; final_review.py | test_remediation_blueprint: f19, f17_current_copy_change | Stable repeated-phrase findings plus seven semantic review domains; current review required after repairs. |
| **F20** — P1 - Make first-party image acquisition a real workflow, not a research note | image_workflow.acquire; research_contract.inspect | test_remediation_blueprint: f20; test_image_workflow | Acquisition metadata binds actual local image bytes, dimensions, MIME, rights and source records; concrete fallback outcomes retained. |
| **F21** — P1 - Make image-plan lineage mandatory and enforce independent-original count | image_workflow.gate; deployed_image_errors | test_completion_integrity: second_filename, composite, deployed_images; test_image_workflow | Four independent originals, lineage, truth role, rendered variants and actual use; crops/logos cannot pad count. |
| **F22** — P1 - Authenticate independent reviewer provenance | execution_receipts.py; native_routing; workflow_runner; guide/control/final/visual reviewers | test_remediation_blueprint: rt08, exact_validated_json; test_control_review | Coordinator host dispatch, packet/current source and exact returned report required. Offline validation is consistency, not provider cryptographic authentication. |
| **F23** — P1 - Authenticate native image-generation provenance | image_evidence.py; image_workflow.register_native; native dispatch/result records | test_completion_integrity: native_note, native_receipt, native_model | Actual result/output hash/time linkage, no note-only generation. No native generation was executed during this framework repair. |
| **F24** — P1 - Make brand evidence mandatory for complete builds | research_contract.inspect; completion_contract.research; extract_brand.mjs | test_remediation_blueprint: f24; test_demo_snapshot_order | Actual rendered brand measurements plus source-linked selected typography/colors/logo and justified fallbacks. |
| **F25** — P1 - Make reference-fidelity and page-structure records non-empty or explicitly not applicable | completion_contract.coverage; process_contract.validate_reference_fidelity | test_completion_integrity: missing_research_and_empty_section_maps | Nonempty final section roles and buyer questions, real coverage targets and reasoned omissions. |
| **F26** — P1 - Strengthen modal architecture for short-height and mobile keyboard states | shared modal header/body CSS; capture-final-states.mjs | admin-operations.test.mjs; full demo final-state capture | Stable header/title/close with scrolling body. Reduced viewport simulates keyboard space, not a physical handset keyboard test. |
| **F27** — P1 - Replace native-only field errors with explicit accessible inline errors | multistep-lightbox.js; shared admin error handling | admin-operations.test.mjs; full demo final-state capture | Persistent stable inline errors, aria-invalid and described-by associations; preserve original hint IDs. |
| **F28** — P1 - Require final visual acceptance after the last material change | final_review.py; capture-final-states.mjs; live-verify.mjs | test_remediation_blueprint: f28; test_final_handoff: visual states | Final review links executed captures and every rendered PDF page. Confirmed state only from the registered receipt-correlated journey. |
| **F29** — P1 - Expand the control comparison from narrow copy/layout repair into affected-gate invalidation | dependency_state.affected; control_review; check_gates | test_remediation_blueprint: f39; test_control_review: changed_source | Control is a component gate, not release approval; affected domains are exposed and whole-source checks remain conservative. |
| **F30** — P1 - Rebuild the PDF around a genuine buyer job | guide_quality.py; build_guide.py; final_review cold reader | test_reader_guide; test_remediation_blueprint: f42 | Buyer-job/content quality enforced in framework. The old Bear Plumbing PDF itself has not been rewritten or accepted in this pass. |
| **F31** — P1 - Strengthen PDF claim-to-evidence mapping | guide_quality.inspect_config | test_reader_guide; test_remediation_blueprint final-review fixtures | Exact authored claim/excerpt with direct/qualified/general_context and reviewer judgment; semantic support still requires actual review. |
| **F32** — P2 - Resolve admin warnings before handoff | shared admin app.js/index.html; static validation | admin-operations.test.mjs; test_completion_integrity | Explicit button types and real field-error relationships; warning dispositions cannot be empty. |
| **F33** — P0 - Make owner handoff mandatory for local-final delivery | completion_contract.write_summary; validate_owner_handoff | test_final_handoff; publication summary regressions | Owner references immutable release-inputs hash to avoid owner/verdict/archive self-hash cycles; current class derives from aggregate. |
| **F34** — P0 - Make portable restore verification part of handoff acceptance | portable_handoff.verify_archive/extract_archive; export_status | test_final_handoff; test_portable_handoff; full synthetic demo | Fresh extraction and hash/quality verification; original absolute archive location is not required for a restored handoff. |
| **F35** — P1 - Fix surface-scanner scope | scan_surfaces.py; completion_contract.inspect | test_completion_integrity: scanner cases | Customer/canonical/required documents remain in scope; installed implementation, fixtures and caches do not masquerade as visitor content. |
| **F36** — P1 - Add package hygiene checks | portable_handoff inventory filtering | test_completion_integrity: packaging_rejects_caches_and_locks; test_portable_handoff | Reject private paths/databases/caches and unreferenced runtime debris; preserve actual linked QA evidence. |
| **F37** — P1 - Add a mandatory "evidence exists because the stage ran" rule | workflow_progress; workflow_runner; completion_contract | test_workflow_runner; test_workflow_progress; test_remediation_blueprint rt01/rt04 | Stage validators require source-bound records; an HTML file cannot imply research/image/copy completion. |
| **F38** — P1 - Harden resume so user-visible state cannot contradict orchestration state | workflow_progress; release_acceptance; guide.present | test_workflow_progress; test_final_handoff; test_remediation_blueprint rt25 | Resume reports actual missing/stale dependency, current next action and saved decisions. No reset/republication merely to repair a summary. |
| **F39** — P1 - Add a machine-readable stale-evidence dependency invalidator | dependency_state.py; check_gates.source_snapshot | test_remediation_blueprint f39; test_control_review | Machine-readable input/output hashes and named invalidation domains; conservative full-source fallback for unknown material changes. |
| **F40** — P1 - Separate "pass", "warning", "accepted limit", and "not run" | warning_errors; release_acceptance; workflow_progress | test_remediation_blueprint f40; test_completion_integrity warning cases | Not-run/stale remain blockers; accepted limits require scope, owner impact, evidence and retest trigger. Existing pass_with_warnings vocabulary is retained internally. |
| **F41** — P1 - Strengthen automatic copy/layout repair after control review | final_review.py; workflow_runner final_review stage | test_remediation_blueprint f41; test_workflow_runner | Post-control nine-domain critical review mandatory. Separate host reviewer only when actually available, otherwise explicit self-review. |
| **F42** — P1 - Add cold-reader output tests for copy and PDF | final_review cold_reader | test_remediation_blueprint f42 | Eight cold-reader answers cite exact final rendered/PDF text, not source drafts or invented excerpts. |
| **F43** — P1 - Protect source offer/conversion intent with an explicit conversion contract | research_contract.conversion_errors; validate_page; browser/local journey | test_remediation_blueprint f43; existing browser/journey tests | Source conversion/offer/required fields and selected destination need evidence-linked changes; no easier substitute CTA. |
| **F44** — P1 - Add proof-source selection logic for imagery and testimonials | image_workflow truth-role validation; review provenance gate | test_image_workflow; test_review_intelligence; test_completion_integrity deployed images | Illustration is not business/customer proof; acquired first-party/supplied rights and identity remain mandatory. |
| **F45** — P1 - Make completion report semantically complete, not file-existence complete | release_acceptance; package_handoff; portable_handoff | test_final_handoff; test_completion_integrity legacy export | Static and Worker handoffs share release classes/mandatory structure; only applicability differs. |
| **F46** — P1 - Add exact final-package revalidation, not just pre-package checks | portable_handoff staging, verify and extract before final rename | test_final_handoff corruption/changed source cases; test_portable_handoff | Final archive bytes/inventory/source and retained report hashes are verified, not just pre-package working files. |
| **F47** — P1 - Make QA report generation automatic and source-bound | completion_contract.write_summary | test_completion_integrity: summary cases; test_final_handoff; live summary tests | QA, owner and README generated together with current gate paths/hashes, class, warnings/blockers and publication scope. |
| **F48** — P2 - Clarify status command exit semantics | release_acceptance --require; workflow assert-release | test_remediation_blueprint f48 | Inspector exit zero means inspection ran. Exact class assertion exits nonzero when acceptance is missing. |

## Required failure-class regressions RT01–RT26

Each original failure class is mapped below. Unit fixtures are explicitly synthetic and do not count as client QA. Browser/application CI and the generated local Worker/D1 demo provide executed integration coverage; real-business quality acceptance remains per project.

| Regression | Coverage |
| --- | --- |
| RT01 | rt01 + missing_manifest_lists_all_required_gates |
| RT02 | rt02 + forged_quality_pass_is_recomputed + workflow_errors |
| RT03 | rt03 + renderer_does_not_erase_template_markers |
| RT04 | rt04 manifest/discovery tests |
| RT05 | missing_manifest_lists_all_required_gates + image_workflow tests |
| RT06 | second_filename + composite original-count tests |
| RT07 | native_note + native_receipt tests |
| RT08 | rt08 coordinator packet/capability/output tests |
| RT09 | rt09 runtime identity + canonical_inputs_survive_archive_source_exclusion |
| RT10 | test_final_handoff real archive/restore + portable demo |
| RT11 | test_control_review changed_source/missing_final_capture |
| RT12 | test_reader_guide / test_thank_you stale dependency cases |
| RT13 | rt13 structured/markdown canonical deletion matrix |
| RT14 | browser_cannot_infer_viewport + final-review missing_short_view |
| RT15 | selected-engine browser contract + required real binaries in CI |
| RT16 | raw_lighthouse_metrics_not_a_self_asserted_score + missing gates |
| RT17 | full demo read-only final-state capture + browser/admin tests |
| RT18 | full demo invalid described-by capture + admin error tests |
| RT19 | journey-recovery.test.mjs + form/receipt/direct thank-you tests |
| RT20 | legacy_site_only_export + export_of_missing_copy_and_gates |
| RT21 | packaging_rejects_caches_and_locks + portable archive inventory tests |
| RT22 | f40 + warning_errors tests |
| RT23 | rt23 + review intelligence tests |
| RT24 | rt24 qualification/discovery tests |
| RT25 | workflow_progress interrupted/stale fixtures + rt25 question dedupe |
| RT26 | test_final_handoff static export + full Worker/D1 portable demo |

## Verification boundary

This matrix is checked into the same change as the tests. The pull request records actual CI run IDs and totals; do not treat this static file as proof that a later commit passed. The reference checkout used for local tests excludes original font binaries and legacy-only sources. Full GitHub checkout CI must pass before merge; font checksum assertions are not weakened.

The old Bear Plumbing archive was not silently repaired or re-certified. Blueprint section 11 requires real first-party/review acquisition, copy/PDF/image changes and fresh rendered acceptance for that client. No framework test substitutes for those tasks. The full generated demo is fictional; physical phone keyboard behavior and third-party production delivery remain outside its test scope.

Independent reviewer and native-image records are constrained to actual coordinator/tool output linkage. Offline hashes prove consistency and detect tampering/omission; they cannot cryptographically authenticate a provider or prove a semantic judgment is true. No reviewer/provider execution is claimed when it did not occur.
