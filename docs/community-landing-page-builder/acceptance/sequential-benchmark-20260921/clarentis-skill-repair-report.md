# Clarentis Community Landing Page Skill Repair

## Scope

Repaired the canonical `community-landing-page-builder` skill only. The frozen Clarentis project, completed run, other skills, and Luke originals were not edited. No deployment, commit, or push was performed.

The backend agent's completed publisher and owner-handoff edits were left intact and are not claimed here.

## Root causes and repairs

1. Customer copy and brochure copy had no reliable boundary between buyer-facing persuasion and owner QA instructions. The old editorial pass could approve declarations about copy quality without reviewing canonical rendered copy. The revised guidance keeps concise uncommissioned-demo and routing disclosure, moves CRM, consent, receipt verification, and synthetic-contact cleanup into owner handoff, and requires semantic review of actual rendered customer copy. Mechanical checks are deliberately narrow to explicit builder or QA contamination, so legitimate GTM, CRM support, or testing services remain valid.

2. First-screen compliance could be achieved by hiding the hero image at narrower breakpoints. Both page and funnel measurement now require meaningful primary hero media to be painted at every tested breakpoint. Marked CSS background media and video are supported, while an unmarked hero still falls back to checking all hero media so relabeling the only illustration as decorative does not bypass the gate.

3. The image minimum counted asset records rather than independent source originals. Image-plan schema 2 now requires explicit source lineage and count role, counts unique source originals, rejects conflicting lineage for the same source hash, and keeps the full-page minimum at four. A PDF crop, screenshot, responsive derivative, or composite cannot earn another original. A lower minimum needs a documented, project-local, hash-verified exception. Legacy schema 1 remains accepted for existing plans.

4. Rendered-copy parity encouraged submission failure text to exist in the normal form document before submit. Baseline and every pre-submit step now reject exact failure or uncertain-state messages. Read-only capture blocks the submission route, then records the actual visible error state after submit, preserving real error handling without exposing it early. Regression coverage includes the later step 2 state that reproduced the Clarentis defect.

5. Visual acceptance could be recorded as self-review without enough evidence to establish who reviewed which source. The existing visual quality artifact now carries compact provenance: review mode, reviewer and builder identities, task IDs, reviewed source fingerprint, findings, retests, and limitations. Independent mode requires a distinct reviewer task; self-review must say so truthfully. Fixed findings require a passing evidence-backed retest. No additional review layer was introduced.

## Files changed by this repair

- `skills/community-landing-page-builder/SKILL.md`
- `skills/community-landing-page-builder/assets/cloudflare/scripts/capture-rendered-copy.mjs`
- `skills/community-landing-page-builder/assets/cloudflare/tests/rendered-copy.test.mjs`
- `skills/community-landing-page-builder/assets/cloudflare/tests/workflow.test.mjs`
- `skills/community-landing-page-builder/assets/image-plan.example.json`
- `skills/community-landing-page-builder/references/catalogue-workflow.md`
- `skills/community-landing-page-builder/references/copy-acceptance.md`
- `skills/community-landing-page-builder/references/copy-and-structure.md`
- `skills/community-landing-page-builder/references/image-research-and-generation.md`
- `skills/community-landing-page-builder/references/image-workflow.md`
- `skills/community-landing-page-builder/references/quality-gates.md`
- `skills/community-landing-page-builder/references/rendered-copy.md`
- `skills/community-landing-page-builder/scripts/check_gates.py`
- `skills/community-landing-page-builder/scripts/copy_acceptance.py`
- `skills/community-landing-page-builder/scripts/copy_parity.py`
- `skills/community-landing-page-builder/scripts/image_workflow.py`
- `skills/community-landing-page-builder/scripts/measure_funnel.mjs`
- `skills/community-landing-page-builder/scripts/measure_page.mjs`
- `skills/community-landing-page-builder/scripts/test_gates.py`
- `skills/community-landing-page-builder/tests/qa/test_page_hero.py`
- `skills/community-landing-page-builder/tests/test_copy_acceptance.py`
- `skills/community-landing-page-builder/tests/test_image_workflow.py`
- `skills/community-landing-page-builder/tests/test_copy_parity_states.py` (new)

Concurrent backend-owned changes currently visible in the same skill, including publishing, owner-handoff, release, and owner-handoff tests, are outside this repair's file list.

## Verification

- `python3 -m unittest tests.test_copy_acceptance tests.test_copy_parity_states tests.test_image_workflow`
  Result: 66 tests passed.
- `python3 scripts/test_gates.py`
  Result: 21 tests passed.
- `python3 tests/qa/test_page_hero.py --node <bundled-node-24> --playwright-module <playwright-core> --browser-executable <chromium>`
  Result: 15 hero, text, font, image-ratio, modal, phone, and narrow-breakpoint fixtures passed. This includes hidden-primary-media rejection and visible CSS-background primary media in both page and funnel measurement.
- `<bundled-node-24> --test tests/rendered-copy.test.mjs tests/workflow.test.mjs`
  Result: 22 tests passed.
- Python compile checks and Node syntax checks for changed scripts passed.
- `git diff --check -- skills/community-landing-page-builder`
  Result: passed with no whitespace errors.

## Residual limitations

- The system skill-creator `quick_validate.py` could not run because neither available Python environment contains PyYAML (`ModuleNotFoundError: yaml`). No dependency was installed because the skill's focused regressions and syntax checks already passed and expanding the environment was outside scope.
- Media originality remains intentionally provenance-based, with source hashes and explicit lineage. It detects the evidenced duplicate-source bypass without adding a perceptual-similarity pipeline. Incorrect lineage supplied dishonestly still requires human review.
- This repair validates the reusable skill and fixtures. It does not alter or rerun the frozen Clarentis build.
