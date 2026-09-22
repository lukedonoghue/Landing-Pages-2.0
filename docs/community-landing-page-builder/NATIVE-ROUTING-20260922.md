# Native routing implementation and verification

22 September 2026. Baseline: community-skill at dcbafa918c1f2a73e66e5e8b6e1de5221eaba2fc. Requested promotion preserves main history; previous main is retained as archive/main-before-community-20260922 at 6962338ff5d8233f6301bfbc4cb460b695e6421e.

## Implemented

- Provider-neutral role/tier policy; OpenAI and Claude native profiles generated from it.
- Specialist defaults, matching escalation profiles and genuinely inherited fallback profiles. A fallback never selects a hard-coded smaller specialist merely because the reported model changed.
- Capability-aware routing, four-worker ceiling, no model API client, no Jev, no credentials or global sign-in changes.
- Project-local task DAG with atomic SQLite reservations, dependency checks, input/output hashes, read/write exclusion, named resource slots, three-attempt budget and explicit stopped-worker recovery.
- Source/evidence freeze, distinct reviewer provenance and truthful self-review fallback. Scheduler status cannot approve a release.
- Safe project installer: selected skill copying, secret/runtime exclusions, symlink checks, owner-config preservation, preflight conflicts, generated-profile consistency checks and inherited-model installation mode.
- Community-first README and AGENTS/CLAUDE entrypoints. Original branded skill and legacy README retained. Core community SKILL.md differs only by the native execution section; existing page/backend/release implementations and quality requirements were not rewritten.
- Offline regression suite and repository unittest integration, plus a dedicated read-only GitHub verification workflow for main and community-skill.

## Executed verification

Environment: Python 3.13.5 on Linux. No provider account, API key, browser login, live lead or deployment was used.

- 68 offline tests passed. Coverage includes both model policies, capability absence, unsupported effort, inherited fallback, escalation/profile consistency, path traversal/symlink rejection, graph cycles, dependency freshness, concurrent claims, read/write conflicts, worker/resource limits, bounded retry, claim replay, truthful model receipts, source freeze, reviewer identities, self-review fallback, TOML parsing, installer conflicts/idempotence, owner settings and excluded private files.
- The same 68 tests pass through the repository unittest discovery shim.
- Generated Codex TOML parses with the standard-library TOML parser. Claude frontmatter/model/effort shapes are asserted, including omission of an unsupported Haiku effort override.
- `install_community.py --runtime both --check` passes with no generated-profile/instruction drift.
- Python compile checks passed for the added helpers.
- The unedited community SKILL.md was reconstructed locally and its Git blob hash matched f1e99fcb9059912179751531a08567167be824d6 before adding the orchestration section. Its existing instructions were retained.

## Not established by these tests

No real Codex or Claude Code subagent session was launched in this editing environment. Native profile discovery, actual entitlement/model resolution, achieved reasoning effort, allowance use, image/browser availability and cross-host page quality still require a fresh account-backed end-to-end run. Requested settings are never recorded as observed settings without runtime evidence.

This did not execute the complete pre-existing community page/CRM/browser suite or redeploy a prior demonstration. Existing recorded copy, visual, custom-domain, usage-monitor and optional-integration findings remain separate. Promotion to main is the user's requested testing baseline, not a production-readiness certification. GitHub workflow results must be checked independently; adding a workflow is not proof that it passed.

## Acceptance run

Use the exact starter prompt in the main README in a fresh ChatGPT/Codex session, then in Claude Code, with a new project and the same business/requirements. Verify at least one concurrent pair, role/model/effort receipts, an unavailable-profile fallback, a bounded escalation and independent final acceptance. Run a sequential baseline on equivalent inputs and report time to accepted output, rework and usage rather than first-HTML timing.

No speedup percentage or cost saving is claimed before that controlled measurement. Existing subscription sign-in can avoid another model API key, but does not promise free/unlimited use or OpenAI-to-Claude access from a single subscription.
