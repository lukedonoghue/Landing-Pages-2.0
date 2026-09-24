# Persistent guide and native execution

For guided builds, use `guide.py` and the actual `workflow_runner.py` loop described in [guided-workflow.md](guided-workflow.md). They share the native router's persistent task database, while the existing workflow/evidence helpers remain readiness and approval authorities. `workflow.py resume` alone is still an inspector; do not mistake its next-action report for executed work. The runner dispatches, validates, checkpoints and continues until a genuine human action, reconciliation, bounded failure or evidence-backed completion.

The mandatory first-build comparison and improvement loop is described in [control-comparison.md](control-comparison.md). Route a real independent reviewer where supported; otherwise label a separate self-review truthfully. Never omit this stage just because the first draft builds.

# Native orchestration: ChatGPT/Codex and Claude

Version 1.0.0, 22 September 2026. This reference changes execution, not the community skill's scope, quality bar or approval policy. The coordinator must read the full SKILL.md first. The existing copy, image, browser, PDF, backend and release helpers are authoritative.

## Runtime and billing boundary

Use native host delegation, not a Python API orchestrator. ChatGPT desktop/Work or Codex sessions with native subagent tools use OpenAI workers; Claude Code sessions use Claude workers. Both have subscription sign-in routes. An eligible signed-in subscription does not guarantee every model, tool or an unlimited allowance. Respect the actual account's model availability, organization rules and usage caps. Do not switch authentication, buy credits, change plans, configure an API key, install a model gateway, call Jev, or make cross-provider model calls.

A regular chat session with no native agent-spawn tool cannot gain that tool by reading a skill or creating a TOML file. Use the same logical roles sequentially in the current session and disclose the actual limitations. A session with subagents but no model picker can delegate using inherited settings. If shell/filesystem/browser/image tools are absent, state which outputs are unverified; do not label missing functionality as completed. Claude's native image capabilities need not match ChatGPT's: prefer real supplied/source assets or a supported illustration route, and report a genuine asset blocker rather than demanding another API key or inventing image generation.

No credentials belong in capability JSON, task packets, receipts, source control or the generated site. Existing hosting/account access is requested only for selected external actions at the point the skill already requires it.

## Start in the latest project

This repository's main entrypoint is the community skill. The older branded skill and its historical notes are retained, not overwritten. For an existing checkout the committed `.codex/agents/` and `.claude/agents/` profiles are ready to discover on a fresh host session. `AGENTS.md` and `CLAUDE.md` point to this skill.

For a new project, run from the repository checkout (the target must exist):

```sh
python3 scripts/install_community.py --project /absolute/path/to/project --runtime codex --copy-skill
# Or select --runtime claude or --runtime both.
```

The self-contained skill also supplies `scripts/install_native.py` with the same options. It copies only the selected skill and generated native profiles, not the repository's acceptance archives. No dependency installation, model call or sign-in is performed. It preserves owner configuration and checks all overwrite conflicts before making changes. Native profiles may need a fresh session or `/agents` refresh, depending on the host. Do not claim that writing files hot-loaded them.

```sh
python3 scripts/install_community.py --project . --runtime both --check
```

`--check` verifies installation/profile drift without rewriting files. `--inherit-models` is an explicit compatibility option for hosts that cannot accept the preferred model/effort definitions. Existing customized profile conflicts are reported, not silently overwritten. The installer records managed file hashes under `build/orchestration/install-manifest.json`; keep that local file for subsequent safe updates. User settings outside managed instruction blocks are preserved. Existing `.codex/config.toml` is never merged by appending a duplicate table.

## Capability preflight: observe, never assume

Inspect the actual native tool schema and, when available, the account's model picker/status. Do not infer availability from installed CLI binaries, the names in this policy, an API catalog, a subscription label, or a previous chat. Determine whether this session can spawn agents, select a model and effort per task, pass a bounded fresh-context packet, and collect/close workers.

The coordinator writes a redacted capabilities file under `build/` and records it with the local helper. Example shape (replace fixture values with observations; an empty model map is valid):

```json
{
  "provider": "codex",
  "native_subagents": true,
  "model_selection": true,
  "models": {
    "gpt-5.6-luna": ["low", "medium"],
    "gpt-5.6-terra": ["medium", "high"],
    "gpt-5.6": ["high", "xhigh"]
  },
  "max_workers": 4,
  "evidence": "Describe the observed tool schema/model picker; never include credentials"
}
```

Use `provider: claude` with observed aliases/IDs and effort support in Claude Code. Haiku has no effort override in our preferred profile; represent its support as `[]`. Claude's Sonnet and Opus aliases follow the account/runtime version. Record the resolved version only when the host reports it. If native tools are unavailable, set provider `chat`, both capability flags false, models `{}`, and max_workers 1.

```sh
python3 "$SKILL_ROOT/scripts/native_routing.py" configure "$PROJECT_ROOT" "$PROJECT_ROOT/build/runtime-capabilities.json"
python3 "$SKILL_ROOT/scripts/native_routing.py" route frontend --provider codex --capabilities "$PROJECT_ROOT/build/runtime-capabilities.json"
```

`SKILL_ROOT` and `PROJECT_ROOT` are the actual absolute directories resolved by the coordinator. The local helper routes and records; it never starts model sessions. The coordinator uses the returned native profile with the host's actual spawn/Agent tool. Prefer separate context for bounded tasks; never copy a whole investigation into every worker.

## Routing policy

`config/routing.json` is the single mapping source. Native profiles are generated by `scripts/install_native.py`; do not hand-edit generated model names in many files. Mechanical work stays in existing scripts. Research extraction uses fast compute; brand/assets/frontend/PDF use standard; and difficult cross-component/security diagnosis uses critical. Copy and copy review use explicit active-provider routes: Codex drafts with GPT-6 Astra and reviews with GPT-5.6 Sol, while Claude uses separate Sonnet contexts for both. Final review uses a separate reviewer context and never changes provider solely for independence.

Preferred OpenAI profiles use Luna low, Terra medium, GPT-5.6 high and GPT-5.6 xhigh. Preferred Claude profiles use Haiku with no effort override, Sonnet medium and Opus high. These are starting policies, not a benchmark claim or an entitlement guarantee. Critical Claude work starts on Opus high and is distinguished by task scope; this version does not pretend an OpenAI xhigh value equals a Claude effort value.

A native profile's model fields can override a spawn request. Therefore the router returns a matching **agent profile**, not merely a suggested model name: default specialists for normal work, compute profiles for escalation, and truly inherited profiles for unavailable choices. The inheritance profiles omit both OpenAI model/effort fields or use Claude `model: inherit` with no effort. Reviewer fallbacks retain read-only configuration. Never invoke the old smaller specialist while merely writing a larger model name into a task report.

Make one original attempt and at most one targeted correction at the initial tier. The third and final attempt escalates one class (or uses the existing critical tier). Ambiguous/high-impact work starts at critical directly. Authentication, missing tools, rate limits, unsupported models or absent owner information are capability/blocker problems, not reasons for an endless reasoning loop. Close/stop a failed native worker before retrying and releasing its files. Respect allowance stops; do not use fallback models to circumvent organization or billing limits.

## Dependency graph

Keep the selected scope minimal. Copy-only and audit-only requests stop at their requested deliverable; never generate a page, PDF, CRM or hosting to demonstrate parallelism. On ordinary complete-page builds use these dependency barriers:

| Stage | Parallel work | Required barrier before proceeding |
| --- | --- | --- |
| Evidence | Business/conversion research; review intelligence/testimonial provenance when feedback is available; brand extraction; reference/asset investigation when useful | Source-linked compact evidence, review-source identity/rights status and material unknowns reconciled |
| Argument | One owner of strategy and the complete copy master | Real editorial acceptance plus the existing copy checker before layout |
| Production inputs | Final design direction and image preparation after copy acceptance | Source-bound production contract; existing acquired/optimized image prerequisites before gated assembly |
| Production | Frontend; useful PDF; selected integration configuration | Disjoint owned files and fixed shared inputs |
| Integration | Coordinator merges results | Coherent source and requested conversion behavior |
| Verification | Static checks; isolated functional tests; PDF capture/review | Actual observations, current source; exclusive Lighthouse measurement slot |
| Acceptance | One fresh reviewer, after all writers stop | Frozen integrated source, readable page/PDF captures and real functional evidence |
| Optional external work | Coordinator only | Existing selected-scope authorization and guarded publisher/live verifier |

Research can collect source imagery before copy acceptance, but do not design HTML or finish section-specific compositions ahead of the accepted argument. For the guarded CRM scaffold, `workflow.py check-build` still requires acquired/optimized images: do not spoof its image evidence to start sooner. Run checks using their documented CLI, not guessed arguments. Final publication is outside the scheduler and never authorized by a task receipt.

## Shared production contract

The coordinator writes `build/production-contract.json` once copy is accepted and production inputs are ready. Include a version, selected scope/modules, the exact primary CTA and conversion semantics, required form fields, source destinations, design tokens/image roles and paths plus SHA-256 hashes for the current strategy brief, claim ledger, copy master, brand report and image plan. Record any unresolved external connection explicitly; do not replace a form with telephone/email because credentials are missing.

The contract references existing artifacts rather than creating a second copy master. Every production task lists both the contract and the actual input files in `inputs`, so real-byte changes invalidate downstream work. A hash written into a JSON document is not enough on its own. Only the coordinator may revise the shared contract. Close affected workers, record why, increment its version and rerun affected work. Existing source-bound quality evidence must still be refreshed; never re-label an old gate with a new fingerprint.

## Task reservations and native dispatch

Use `native_routing.py add PROJECT tasks.json` to add the selected graph. No hidden tasks are inferred from missing credentials. Each task has a unique ID, bounded brief, role, phase (`research`, `copy`, `build`, `qa`, `acceptance`), dependencies, exact input paths and exact write paths or directory prefixes. Globs, traversal, symlinks, secrets, native configuration and scheduler-owned paths are rejected. Example **production task**, after upstream copy/image gates have genuinely passed:

```json
[
  {
    "id": "page",
    "role": "frontend",
    "phase": "build",
    "brief": "Implement only the accepted page and accessible form UX; preserve all shared content and backend contracts.",
    "depends_on": [],
    "inputs": ["build/production-contract.json", "build/page-copy.json", "build/claim-ledger.md", "build/brand.json", "image-plan.json"],
    "writes": ["public/index.html", "public/styles.css", "public/script.js"],
    "resources": []
  }
]
```

This short example starts at the production barrier. In the full graph, page depends on the real recorded copy/image prerequisites, not an empty upstream placeholder. Use the actual project's filenames; the lightweight skill may use Markdown copy while the guarded Worker route requires structured JSON. Read-only researchers/reviewers return results; the coordinator persists their structured output if their host tool permissions prevent writing their assigned evidence.

```sh
python3 "$SKILL_ROOT/scripts/native_routing.py" add "$PROJECT_ROOT" "$PROJECT_ROOT/build/tasks.json"
python3 "$SKILL_ROOT/scripts/native_routing.py" status "$PROJECT_ROOT"
python3 "$SKILL_ROOT/scripts/native_routing.py" claim "$PROJECT_ROOT" page --worker page-attempt-1
```

The atomic claim returns a task packet, selected route and opaque claim token. Reserve before native dispatch, then record the actual native task ID when known. Dispatch only ready tasks, with no more than four cooperating workers. Give each native worker the two absolute roots, required core rules, its specialization from routing.json, inputs, permitted writes, expected outputs and concrete checks. Do not spawn another Python/CLI model process as a substitute for native delegation.

The SQLite transaction prevents cooperating workers from reserving overlapping write/write or read/write paths. Named `resources` (for example `lighthouse`, `browser-fixture`, `integration`) provide exclusive slots. This is a coordination protocol, not filesystem access control. Workers with broad shell permissions could ignore it; keep the host sandbox and use isolated workspaces/worktrees where needed. Keep one final frontend owner rather than letting several agents edit one HTML/CSS pair.

When using worktrees, pin the exact accepted source commit and copy/hash any uncommitted production inputs. Do not assume a default-branch worktree includes the coordinator's current changes. Import disjoint outputs into the integration tree before completing their task; verify the imported bytes there. Reviewer profiles inspect supplied readable captures and source. The coordinator runs capture commands and functional tests where read-only reviewer tools cannot.

Completion uses the active token and an actual receipt:

```sh
python3 "$SKILL_ROOT/scripts/native_routing.py" finish "$PROJECT_ROOT" page --token CLAIM_TOKEN --receipt "$PROJECT_ROOT/build/page-task-receipt.json"
```

Receipt shape: `status` (`done`, `failed`, `blocked`), concrete `summary`, `outputs` (existing owned relative paths), actual checks/findings, and optionally `host_task_id`, `effective_model`, `effective_effort`, `runtime_evidence`. Unknown model/effort stays null. An effective model/effort claim requires a runtime observation, not copying requested configuration. The host may substitute models or clamp effort. Record it; do not hide a substitution. Task completion checks claims, paths, hashes and dependency freshness. It **does not judge copy/design quality or authenticate reported tool output**; existing acceptance and release gates still apply.

```sh
python3 "$SKILL_ROOT/scripts/native_routing.py" retry "$PROJECT_ROOT" page --reason "Specific failed check and bounded repair"
# For an interrupted running task, first stop its actual native worker, then:
python3 "$SKILL_ROOT/scripts/native_routing.py" retry "$PROJECT_ROOT" page --reason "Worker stopped after timeout" --worker-stopped
```

No automatic stale-lease expiry: elapsed time is not proof that a worker stopped editing. Cancel/close native workers, clean up only their owned browser processes and record failure/blockers. Do not kill a user's personal browser. Namespace local databases/ports for mutating browser tests. Pause other browser/CPU-heavy work for Lighthouse; a resource name only coordinates tasks that declare that resource.

## Freeze, review and delivery

Once all non-acceptance tasks are done and fresh, freeze actual product source plus relevant build evidence explicitly:

```sh
python3 "$SKILL_ROOT/scripts/native_routing.py" freeze "$PROJECT_ROOT" --input build/production-contract.json --input build/page-copy.json --input build/visual-review.json
```

Use the actual existing evidence paths; missing paths block freezing. A final acceptance task uses role `review`, phase `acceptance`, no writes and dependencies on completed production/QA tasks. It cannot run before the current freeze, alongside another worker, or under a recorded builder identity when native independence is available. Record distinct host task provenance; naming the same agent differently is not independence. In a sequential host, use a fresh isolated reread and `review_mode: self_review`.

Any source/evidence change invalidates the freeze. The coordinator uses `thaw PROJECT --reason ...`, then bounded targeted repairs, current evidence and another final review. Acceptance receipts and scheduler status always state `release_approved: false`: use the existing guarded authorization/publishing flow separately. The scheduler never deploys, changes DNS or submits live leads.

Keep local/page-ready, publish-ready and live-verified distinct. Return actual unresolved selected integrations to the owner. Historical acceptance failures do not disappear because orchestration was installed. No synthetic lead, deployment or cloud mutation is part of installing or testing this routing layer.

## Testing and measurement

Run `python3 skills/community-landing-page-builder/tests/test_native_routing.py` for offline routing/state/installation regressions (Python 3.11+ for TOML parsing in the tests). The helpers themselves use the Python standard library and support Python 3.10+. `python3 scripts/install_community.py --check --runtime both` verifies the committed native profiles. These checks do not launch real provider models or certify a complete landing page.

Test in a fresh ChatGPT/Codex session and separately in Claude Code. Start with:

> Use the community landing-page-builder from this main checkout for [BUSINESS URL]. Apply native routing and parallel workers when this session actually supports them. Use my existing signed-in account only; no Jev, model API key or new provider. Research, build and verify the local page and useful PDF. Preserve the source conversion type. Do not deploy or submit a live lead. Report actual worker models/efforts, fallback modes, elapsed page-build time and unresolved findings.

Repeat on the same saved business inputs with native_subagents false for a sequential baseline. Compare time to independent accepted quality, not first HTML. Separate raw input, cached input, output, retries, parent work, image-provider work and external waiting. Do not add cached-input subsets to input totals or turn subscription percentages into token costs. No speed/cost improvement is claimed before this end-to-end test.

## Primary documentation checked

- OpenAI native subagents/configuration: https://developers.openai.com/codex/subagents
- OpenAI subscription/API sign-in distinction: https://developers.openai.com/codex/auth
- Claude native subagent files, model and effort fields: https://code.claude.com/docs/en/sub-agents
- Claude model aliases, effort and managed limitations: https://code.claude.com/docs/en/model-config
- Claude subscription authentication: https://code.claude.com/docs/en/authentication

Provider formats and account features can change. Prefer observed capabilities and compatible inherited profiles over assuming the policy examples are universally available. The implementation does not install an SDK, a background model daemon or another model provider.

## Completion evidence repair

Follow `completion-integrity.md` for canonical research/document inputs, split image preflight/final acceptance, genuine host-result linkage, current local QA and export. The integrator owns the aggregate result. A specialist pass never overrides a missing/stale mandatory gate. Only the supported exporter can issue a verified local-final package.
