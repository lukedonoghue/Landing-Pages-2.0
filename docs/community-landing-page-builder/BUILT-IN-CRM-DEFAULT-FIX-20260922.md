# Built-in CRM default and owner-guidance fix

## Observed failure

When the owner asked for the next step, the system asked which CRM they used, requested a Google Sheet, GTM or ad-conversion identifiers, and required a desired page URL before offering publication. That answer treated unrelated external integrations as prerequisites and failed to explain that the project already contains a complete Cloudflare Workers + D1 CRM.

## Root cause

The infrastructure was present and the non-static scaffold already defaulted to `cloudflare-d1`, `/api/leads`, an authenticated admin CRM and one Cloudflare Worker/D1 deployment. The maintained community skill contradicted that implementation: its product promise said the result was not automatically a CRM, its mode router called the form backend/CRM optional, and its publishing status asked for domain and GTM values together. A capable agent following those instructions reasonably produced the wrong integration checklist.

Historical community work had deliberately made CRM optional for an earlier page-first acceptance phase. The owner has now explicitly changed the product requirement for future form-led pages. Historical benchmarks remain evidence of their original scope; they are not current routing instructions.

## Plan

1. Make the bundled CRM the default for form-led/enquiry pages while retaining explicit static-only and genuine non-form paths.
2. Route new form-led builds through the existing non-static scaffold and verify the real local form -> receipt -> D1 -> CRM -> reporting journey.
3. Add state-based owner guidance that names one current action and never asks for an external CRM, Sheet, GTM, ad ID or custom domain as a prerequisite.
4. Make workers.dev the publishing default; custom domains and external integrations can follow.
5. Add regressions for the generated scaffold, explicit static opt-out, next-step wording and installed-copy synchronization.

## Implemented scope

- Updated the skill discovery description, product promise, absolute rules, mode router, build workflow and generated UI prompt.
- Added `references/next-step-guidance.md` with stage-specific guidance and a corrected owner-facing example.
- Updated the build contract, CRM reference, scaffold metadata/START-HERE and workflow progress instructions.
- Updated active project memory and handoff docs; marked the older optional-CRM decision as superseded without rewriting historical acceptance artifacts.
- Updated the installed legacy `pb` compatibility workflow so new form projects default to `built-in-cloudflare-d1`, `/api/leads`, and block its unsafe static builder/ship pass until the maintained community CRM workflow is used.
- Corrected the active Aussie Gutter Protection project state: the outside CRM/Sheets placeholder is replaced by the built-in CRM decision, the unsupported static ship pass is invalidated, and its preserved next action is recorded in `docs/NEXT-STEP.md`.

## Verification

- Canonical community skill: 119/119 Python tests passed.
- Installed community skill: 119/119 Python tests passed from its supported working directory.
- Skill Creator validation passed for canonical and installed copies.
- Exact file comparisons passed for the entrypoint, UI prompt, next-step/build/CRM/team references, scaffold, progress logic and regressions.
- A fresh default scaffold is regression-checked as `product_mode: form-crm`, `backend.provider: cloudflare-d1`, `/api/leads`, with the admin CRM present and owner guidance explaining that external CRM/Sheets/GTM are unnecessary.
- A fresh `--static-only` scaffold is regression-checked as the explicit CRM opt-out.
- The legacy compatibility routing suite passes 5/5 tests, including the built-in CRM default and refusal to use its old static form builder for that mode.
- The active Aussie project status now reports `built-in-cloudflare-d1`, build blocked, tracking/visual QA pending and ship failed until the real local CRM journey is completed.
- No Cloudflare account, live lead, deployment, DNS, GTM, advertising account, Google Sheet or external CRM was accessed or changed.
