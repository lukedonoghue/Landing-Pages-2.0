# E2E field test fix specification (26 September 2026)

Source: a full end-to-end field test of `main` at `a84e619` in Claude Code desktop (Opus 5.5 coordinator, Sonnet workers), building a Google Ads lead page for a real Brisbane security-screen installer and scoring it against the Blue Mountain Mesh control and the lead-gen CRO audit checklist. Result: 10 of 11 gates passed after about 2h10m, ~2.1M tokens, 8 agent workarounds and 7 owner interactions; the local-final export was never reached. The full test report and raw log are kept outside the repository with the test project.

This document lists every fix: the observed defect, its root cause, the exact change, and the acceptance test. The "Status" column records what this change set implements. Deferred items name the reason and the smallest next step.

Status key: **Done** = implemented and covered by a test or verified command in this change set. **Docs** = contract clarified in SKILL.md/references only. **Deferred** = not in this change set.

## 1. Hard blockers (the run stopped until an expert intervened)

| ID | Defect observed | Root cause | Fix | Acceptance test | Status |
|---|---|---|---|---|---|
| B1 | `extract_brand.mjs` crashed: `Cannot find module 'playwright-core'` on a fresh project | `scaffold_project.py` copies `package.json` but never installs dependencies and prints no next step; helpers resolve `playwright-core` without a friendly failure | Scaffold output now names the exact bootstrap command; `extract_brand.mjs` and `measure_funnel.mjs` catch the missing module and print `python3 scripts/quickstart.py bootstrap --project .`; SKILL.md adds the bootstrap step after scaffolding | Missing-module run prints the bootstrap command instead of a stack trace | Done |
| B2 | `guide.py next` returned `kind: local, operation: scaffold` but no command could run it; `workflow_runner.py claim` echoed it; only `run` executed it and defaulted to spawning Codex | `guide.local()` not exposed on the CLI; `claim` only handles `work`; `--provider` defaulted to `codex` | Add `guide.py local PROJECT --operation NAME`; `workflow_runner.py claim` executes pending local operations before returning the next action; `--provider` defaults to the detected host (Claude Code sets `CLAUDECODE`) | Unit test: `claim` on a project whose next action is local advances past it | Done |
| B3 | `image_workflow.py acquire` failed with `CERTIFICATE_VERIFY_FAILED` on python.org macOS Python while `doctor` reported Python OK | TLS context uses `ssl.create_default_context()` without a CA bundle; doctor never probes HTTPS | Use `certifi` when available (added to `requirements-build.txt`); on a certificate failure, raise a message naming the fix; doctor adds an HTTPS certificate probe | Unit test for the context builder; doctor shows the certificate check | Done |
| B4 | `optimize_images.py` failed on a CMYK JPEG (`cwebp: Unsupported color conversion`); no recovery path | Source passed straight to `cwebp` | Normalise CMYK/palette/other modes to RGB(A) with Pillow into a temporary PNG before `cwebp`; the original stays hash-locked | Unit test optimises a CMYK JPEG | Done |
| B5 | `measure_funnel.mjs` crashed with a raw `ENOENT` stack trace when `build/gate-snapshot.json` was missing | Unguarded `readFile` | Actionable error naming `check_gates.py snapshot PROJECT --mode MODE --out build/gate-snapshot.json` | Manual run shows the message | Done |
| B6 | Brand-font check failed for the same typeface ("Montserrat Thin ExtraBold" vs "Montserrat Thin") | Comparison uses the font file's internal family name, which some builds suffix with the weight | Normalise rendered family names by removing weight/width/style words before comparing | Unit test of the normaliser; real run passes with fontsource and Google variable files | Done |
| B7 | `browser-compat.mjs` failed the whole mobile journey with no reason when the first `[data-open-modal]` (a header CTA) was hidden on mobile | `locator(...).first()` then `scrollIntoViewIfNeeded` on a hidden element throws inside a bare `catch` | Use the first visible trigger; include the exception message in the failed check | Node test with a hidden first trigger | Done |
| B8a | Rendered-copy capture only ever saw the unconfirmed thank-you state, and the thank-you page's reused landing sections were flagged as unapproved | Read-only capture visits the thank-you page directly; parity allowed only thank-you fields | Read-only capture also previews the confirmed state with an obviously synthetic receipt held in the browser context (no lead, POST or conversion); the thank-you surface allows the approved landing sections and the reviewed guide wording; running PDF footers are removed at either page edge and checklist numbering is ignored | Unit tests; real capture | Done |
| B8 | Rendered-copy gate unsatisfiable: helper-generated thank-you text, testimonial `review_id`, `thank_you.delivery`, micro UI text and every PDF chapter string flagged | `copy_parity.py` META lacks metadata keys; `thank_you.delivery` treated as visible copy (unlike `brochure.delivery`); helper strings not in `UI_TEXT`; guide chapter strings required by `guide.json` have no home in `brochure.text` | Skip `review_id`, `edit_log`, `delivery`; add thank-you/guide helper strings to neutral UI text; treat the current, reviewed `build/guide.json` buyer-facing text as approved brochure wording when the reader-guide review passes for the current build | Unit tests in `test_copy_parity_states.py` | Done |

## 2. Things that happened that shouldn't

| ID | Defect | Root cause | Fix | Acceptance | Status |
|---|---|---|---|---|---|
| S1 | Visible honeypot field got first focus and both wizard steps showed; automated QA passed it | `measure_funnel.mjs` checks the `hidden` attribute, not rendered visibility, and has no honeypot check | New failures: `honeypot_not_visible`, `honeypot_not_focusable`, `wizard_one_step_visible` using computed style | Fixture page with a visible honeypot fails | Done |
| S2 | Placeholder privacy page ("This is a development template…") passed every gate | No template-text detector in static validation | `validate_funnel.py` fails on known template/placeholder phrases in public HTML | Unit test | Done |
| S3 | Editing an internal `docs/*.md` file invalidated the rendered-page control capture | `check_gates.EXCLUDED_DIRS` does not exclude `docs`, so workflow paperwork is part of the rendered-source fingerprint | Exclude `docs/` from the source fingerprint (workflow documents are validated separately by `process_contract.py`) | Unit test: docs edit keeps the fingerprint | Done |
| S4 | Recording image reviews reopened the research gate | Research acceptance evidence pointed at `image-plan.json`, which changes on every review | Documented: image-attempt evidence must reference the captured source HTML; gate order documented (image reviews before final capture and snapshot) | Docs | Docs |
| S5 | Template shipped a custom consent banner with `data-analytics-mode="consent"` and a public "Team login" link | Template defaults contradict SKILL.md and `funnel.json` | Template defaults to `data-analytics-mode="disabled"`; public header no longer links to the CRM login; example regenerated | `sync_crm_example.py --check`; validate_funnel on a fresh scaffold | Done |
| S6 | After the lead-inbox re-scaffold, START-HERE still said "no CRM" and `funnel.json` kept `product_mode: static-only` | `scaffold_project.py` uses write-if-missing for both | `guide.local('scaffold')` reconciles `product_mode`, `publish_target` and replaces the static START-HERE | Unit test | Done |
| S7 | No-long-dash rule forced dropping a genuine verbatim testimonial | Rule has no quotation exemption | Documented: normalise a reviewer's long dash to a spaced hyphen as typographic normalisation (wording unchanged) and keep the review | Docs | Docs |
| S8 | Control reviewer proposals contained em dashes and re-introduced a claim removed as unsupported | `control_review.py` does not validate `proposed_change` | Reject U+2014/U+2013 in `proposed_change`/`after`; control-comparison.md requires checking proposals against the claim ledger | Unit test | Done |
| S9 | Unsourced sentences shipped (PDF test mechanics passed five review rounds) | Review verifies ledger claims only | copy-acceptance.md requires sentence-level source anchoring for every factual sentence, including `brochure.text` | Docs | Docs |
| S10 | Two validators disagree on the same review file (`context_sha256`) | `copy_acceptance.verify` does not check the structured-copy hashes that `copy_library.audit` requires | Documented in copy-workflow.md; the verify command now reports missing structured hashes | Docs | Docs |
| S11 | Copy audit scanned the writer's `edit_log` as customer copy | Skip list lacks `edit_log` | Add `edit_log`, `review_id` to the audit skip list | Unit test | Done |
| S12 | `setup.mjs --help` ran setup | No argument handling | Print usage for `--help`/`-h` | Manual | Done |
| S13 | macOS: 22 skill tests fail on `main` (paths under `/var` → `/private/var`) and projects under a symlinked parent are rejected | `relative_to()` on unresolved roots in `image_workflow.stored_image` and `build_guide.build_reader`; `ship.safe_project` rejects symlinked system parents | Resolve roots; ignore root-owned system aliases (`/var`, `/tmp`, `/etc`) while still rejecting a symlinked project | Full skill suite passes on macOS | Done |

## 3. Things that didn't happen that should

| ID | Gap | Fix | Acceptance | Status |
|---|---|---|---|---|
| G1 | No Google Ads keyword/ad-copy input (checklist item 1, ad scent) | New guided question `keywords` (field `search_intent`) asked when the conversion is an enquiry; "not sure" allowed and labelled as inferred; copy workflow uses it for the H1 | Guided test answers it | Done |
| G2 | Phone never captured; default form collected name and email only | New catalog question `phone` (discoverable, optional) that also sets `phone_uri`; default enquiry fields are name, phone, email | Unit tests | Done |
| G3 | Default CTA "Send an enquiry" | Offer-led default: "Get my free quote" when the offer mentions a quote, otherwise "Request a call back" | Unit test | Done |
| G4 | No conversion tracking and no offline-conversion path although the CRM stores gclid/gbraid/wbraid | Documented Google Ads path in SKILL.md and advertising-tracking.md (optional GTM/enhanced conversions; offline import from the CRM export) | Docs | Done: the existing CRM CSV export now adds `gclid`, `gbraid`, `wbraid`, `utm_source`, `utm_campaign`, `utm_term`; tracking guidance documented |
| G5 | No single verify command for real projects; no test fixture | `quickstart.py verify --project P` starts the local Worker, snapshots, runs static/browser/performance/compatibility/local-journey/rendered-copy checks, assembles images/copy/catalogue reports, records every gate and prints a scoreboard; generates `test-fixture.json` from `funnel.json` when missing | Manual run on a generated project | Done |
| G6 | No add-asset command | `image_workflow.py add-asset --spec FILE` | Unit test | Done |
| G7 | Inventory missed lazy-loaded images (`bv-orig-srcset`, `data-lazy-src`…) | Parse any attribute ending in `src`/`srcset` | Unit test | Done |
| G8 | Rights value "local preview only" documented but impossible | Add `local-preview-only`; handoff/live image gates block it | Unit test | Done |
| G9 | Image class taxonomy differs between SKILL.md, `image_workflow.py` and `validate_page.py` | `trust_class` accepts the SKILL.md words as aliases and lists allowed values in the error; SKILL.md explains `trust_class` (plan) vs `data-image-role` (HTML) | Unit test | Done |
| G10 | Customer PDF printed "Research notes: [n]" | Chapter citation line removed from the reader PDF; sources stay in the final Sources and scope section | Reader tests | Done |
| G11 | Research and RESEARCH-BRIEF/CLAIM-LEDGER duplicated | `process_contract.py` accepts `build/strategy-brief.md` and `build/claim-ledger.md` for those two documents | Unit test | Done |
| G12 | Hero continuation check ignored fixed bottom bars | Subtract fixed bottom overlays from the usable viewport height | Manual measurement | Done |
| G13 | Owner approves the whole copy each time | Per-passage approval hashes | `test_copy_approval_passages` | Done (X5) |
| G14 | Native `lp-*` routing lost in generated projects | Documented `install_native.py --project` after scaffold; orchestration.md explains recording a Claude Agent-tool review as an `execution_artifact` | Docs | Docs |

## 4. Documentation and consistency

| ID | Inconsistency | Fix | Status |
|---|---|---|---|
| D1 | SKILL.md "one compact brief" vs 10 required docs | SKILL.md lists the exact evidence set and aliases | Docs |
| D2 | `required_sections` matched literally against section IDs | copy-workflow.md states it | Docs |
| D3 | measured-qa.md covered 4 of 11 gates | Complete gate recipe and the new `verify` command | Docs |
| D4 | Hard-coded model names; "Sonnet for copy" downgrades stronger sessions | Rule 12 now prefers the strongest available model on the active provider | Docs |
| D5 | README gives commands without saying where to type them; TESTING counts stale; CONTRIBUTING points at the legacy skill | README non-technical quick start; CONTRIBUTING path fixed | Docs |
| D6 | Rule 11 says do not gate the guide while delivery is thank-you only | Clarified: thank-you delivery is the default lead magnet; an ungated download is optional | Docs |

## 5. Formerly deferred items (implemented in the follow-up change set)

| ID | Item | Implementation | Acceptance |
|---|---|---|---|
| X1 | Google Ads upload file | `funnel.json` `tracking.google_ads.offline_conversions` names the CRM stages that count, each with the exact Google Ads conversion action name and optional value; `npm run configure` validates it. The CRM's admin-only, password-confirmed export offers "Export Google Ads conversions": a `Parameters:TimeZone=` row, then Google Click ID / GBRAID / WBRAID / Conversion Name / Time / Value / Currency, one click ID per row, time = first entry into the stage in the site time zone. Click IDs outside Google's format are dropped (also blocks spreadsheet formulas) | `admin-operations.test.mjs` upload-file test |
| X2 | One content schema for page and PDF | The scaffolded `build/guide.json` sets `content_source: build/page-copy.json#/brochure/text`; the guide's reader text lives only in the copy master and `build_guide.py` derives it deterministically. A drifted `guide.json` is rejected as out of date | `test_reader_guide` copy-master test |
| X3 | Designed PDF | Brand-colour cover band, contents with accent rule, optional `callout` and source-anchored `price_table` chapter blocks; brand colour from `funnel.json` and the site's rendered font (licensed `.ttf` pair) by default, DejaVu when coverage fails | `test_reader_guide` blocks/brand test; layout test still 3 pages |
| X4 | Benchmark hero | Template hero rebuilt on the control structure (compact header with verified phone filled by `npm run configure`, outcome headline, one primary action, optional media column, skip link) and sized so the next section shows in the first screen at every QA viewport, including 1280x600; the demo's CSS patch was removed | Fresh demo: 120 browser checks, no warnings |
| X5 | Diff-only owner approvals | Copy approvals store per-passage hashes (hero, sections, modal, thank-you, brochure, interface text, contract). After an edit only changed passages need approval; metadata edits need none; the guide shows "what changed" | `test_copy_approval_passages` |
| X6 | Benchmark regression | Instead of storing a third-party page, `verify-demo --full` (run in CI) fails if the template hero loses an unobscured action fully above the fold at any viewport; the fold-continuation check was already blocking | CI demo job |

The publish gate still runs the application test suite inside generated projects. Replacing it with a template-integrity check (so projects carry no test code) was prototyped and reverted: it changes a release safeguard and needs an explicit owner decision.

## 5a. Repository cleanup

Removed about 670 MB of past test-run evidence, 60 historical audit notes, the superseded branded skill and its tests, the duplicated CRM example, the committed copy-library database (rebuilt in memory), a dead test script and five unreferenced references. The Python tests are one suite under the skill (two orphan test files that lived in `scripts/` joined it, one had never run), `install --copy-skill` no longer ships them, and three overlapping CI workflows became one `ci.yml`.

## 6. Verification of this change set

* Real project: `python3 scripts/quickstart.py verify --project .` on the field-test project ran every automated gate in 1m44s and correctly flagged the stale visual review, the em dashes in the original control proposals (S8), and the genuinely missing guide introduction.
* Honeypot/wizard: `measure_funnel.mjs` against a copy of the field-test page with the original CSS bug now fails `honeypot_not_visible` and `wizard_one_step_visible`.
* CMYK: the field-test Guardian photo that failed optimisation now converts through its embedded profile to sRGB with correct colours.
* Test suites: see the commit message and CI for the exact counts. New regressions live in `skills/community-landing-page-builder/tests/test_e2e_field_fixes.py`; the CSV export column check is in `assets/cloudflare/tests/admin-operations.test.mjs`.
