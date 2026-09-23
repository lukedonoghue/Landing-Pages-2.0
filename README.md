# Landing Pages 2.0: Community Builder

> **Testing this release? Start with [TESTING-START-HERE.md](TESTING-START-HERE.md).** It contains the validated release record, a copy-paste tester prompt, local setup commands, the feedback checklist and the disclosed native-PDF-preview limitation. NetBean and production deployment are not prerequisites for the local pilot.

The **community landing-page builder is now the main workflow**. Start from `main` and use `skills/community-landing-page-builder/SKILL.md`. The previous branded builder is retained under `skills/branded-lead-funnel-builder/`; its earlier README is preserved as [README-LEGACY.md](README-LEGACY.md).

The community builder turns business research into a branded responsive landing page, purposeful imagery, a useful PDF, an honest conversion path and actual visual/functional QA. Form-led pages include the built-in local Cloudflare Workers and D1 CRM by default; external CRM/Sheets connections, advertising tracking and hosting remain optional later-stage modules. It does not require copy/design approval unless you ask for that checkpoint. Publishing and live test leads still require the authorization described in the skill.

## Step one install local dependencies

From a fresh checkout, run the repository setup entry point before building or testing:

```sh
python3 scripts/dev.py doctor
python3 scripts/dev.py bootstrap
python3 scripts/dev.py doctor
```

Bootstrap installs the locked Python, Node and Playwright browser dependencies in project-local locations. It does not use sudo, alter the system Python, sign into an account, deploy, or include dependency folders in source handoffs. Use `--node /absolute/path/to/node` when the supported Node 24 runtime is not already on PATH; Node 22.19 is the minimum.

## Guided build, automatic repairs and recovery

Start a fresh active ChatGPT/Codex or Claude session with:

> Use the community skill on main to build a landing page for [business website or description] in guided mode. Remember supplied answers, confirm the business and conversion brief, and ask only for genuinely missing decisions. After the first build, compare the rendered page and copy with the Blue Mountain Mesh control, make a concrete improvement checklist, implement the repairs and recapture mobile/desktop output before showing the improved page. Continue toward publication, but obtain the actual scoped setup/publication and live-test permissions when needed.

The guide exposes **Start → Business → Conversion → Copy → Design → Preview → Connections → Publish → Complete**. This is not nine permission screens: routine implementation, comparison, repairs and tests continue automatically. Guided mode adds brief/copy review; automatic mode retains the no-routine-approval behavior. Both modes require fresh control comparison and preserve real publishing authority.

The active agent uses `guide.py` and the persistent `workflow_runner.py`; an optional authenticated loopback wizard uses the same controller and an actual runner bridge. Stable answer/event IDs prevent repeats, task ownership prevents duplicate execution, and bounded repair attempts expose a precise blocker rather than silently stopping or skipping a gate. Unknown external results must be reconciled before retry. A session or local process must remain active to execute; a saved checkpoint is not a background service.

Fresh generated projects keep the complete skill context under `.community-builder/`, outside `public/`. This preserves instructions, templates and the Blue Mountain reference after moving the project or resuming through copied helpers. It contains no client credentials. Existing bundles are not silently overwritten; reconcile a modified runtime explicitly. Do not upload the project root as public assets.

See [guided workflow](skills/community-landing-page-builder/references/guided-workflow.md) and [control comparison](skills/community-landing-page-builder/references/control-comparison.md). Source/test verification does not substitute for a real signed-in native-agent pilot or authorized cloud/domain/email acceptance.

## Reader guides and full confirmation pages

New builds now require a researched, illustrated buyer guide, not merely a generated PDF. The reader-review gate checks actual source/image evidence, all rendered pages, specific findings and their repaired output. The full thank-you page is derived from the main page: shared header/phone/brand and supporting sections, with a confirmation-focused hero, real guide-cover preview, download and reader fallback. Direct visits never manufacture a received enquiry or conversion.

See [the complete reader-guide and confirmation contract](skills/community-landing-page-builder/references/reader-guide-quality.md). These changes update the builder; existing generated client folders need an intentional update and rebuild. Do not overwrite a customized client thank-you page without reviewing it first.

## Agent GitHub access

AI agents working on this repository must verify GitHub permissions through the connected GitHub action layer before claiming that writes are blocked. **Do not use web search/browser access as evidence that the repository is read-only.** If live repository metadata reports `permissions.push: true` or `permissions.admin: true`, proceed with requested GitHub writes. If write actions are absent from the current session, describe that as a session/tool limitation; if a write call fails, report the exact operation and error. See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) for the required preflight.

## Start testing in ChatGPT or Claude

Open this checkout in a fresh ChatGPT/Codex work session or Claude Code session, signed in with your existing eligible subscription. Native agent profiles are committed in `.codex/agents/` and `.claude/agents/`; project instructions load the same community skill. No Jev, additional model API key, gateway or cross-provider bridge is installed.

> Use the community landing-page-builder from this main checkout for [BUSINESS URL]. Apply native routing and parallel workers when this session actually supports them. Use my existing signed-in account only; no Jev, model API key or new provider. Research, build and verify the local page and useful PDF. Preserve the source conversion type. Do not deploy or submit a live lead. Report actual worker models/efforts, fallback modes, elapsed page-build time and unresolved findings.

In a session without native subagent/model-selection tools, the same workflow runs sequentially with the current model. A skill does not add missing tools to a chat session. Native model availability and usage limits depend on the signed-in account. OpenAI workers run inside ChatGPT/Codex; Claude workers run inside Claude Code. Supporting both does not mean that one subscription can call the other provider's models. Image/browser/PDF capabilities are checked independently; unavailable tools are reported, not simulated.

## Install into another project

From this repository checkout, with the target project directory already created:

```sh
python3 scripts/install_community.py --project /absolute/path/to/project --runtime codex --copy-skill
# Claude Code:
python3 scripts/install_community.py --project /absolute/path/to/project --runtime claude --copy-skill
# Both sets of native profiles:
python3 scripts/install_community.py --project /absolute/path/to/project --runtime both --copy-skill
```

Reload the host after installation so it discovers the native profiles. Existing owner settings and instructions are preserved. Customized/unmanaged file conflicts stop the installation before changes. The self-contained skill includes the same installer at `scripts/install_native.py`. To use inherited host models instead of preferred profiles, add `--inherit-models`; model availability remains a runtime preflight check.

The old `scripts/install_skill.py` is retained for the **legacy branded skill**. Use `scripts/install_community.py` for the current main workflow.

## What routing changes

The coordinator routes narrow research to fast workers, ordinary implementation to standard workers, strategy/copy/review to deeper workers, and difficult diagnosis to critical workers. Mechanical checks stay in scripts. A maximum of four cooperating workers can reserve disjoint tasks. A shared production contract, dependency/input hashes, bounded retries and a frozen independent review keep parallel work coherent. Requested and actually reported models are separate fields.

The default OpenAI policy uses Luna and Terra for narrow or implementation work, GPT-6 Astra for the primary copy draft, and GPT-5.6 Sol for the fresh copy review. The Claude policy uses Sonnet for both copy passes in separate contexts; it does not route copy or copy review to Opus. Other non-copy roles retain their task-appropriate same-provider profiles. Missing choices use an ordered same-provider fallback or explicit inherited/sequential fallback, without new API credentials. Profiles are generated from one policy; fallback profile/model consistency is regression-tested.

Read [native orchestration](skills/community-landing-page-builder/references/orchestration.md) for the exact dependency graph, capability preflight, native dispatch protocol, private-data boundaries and measurement plan. The local routing helper records/schedules work but does not call any model API or launch an external agent service. Existing copy-before-layout, imagery, PDF, backend, source-fingerprint and publishing gates remain authoritative.

## Offline verification

```sh
python3 skills/community-landing-page-builder/tests/test_native_routing.py
python3 scripts/install_community.py --project . --runtime both --check
```

The test suite uses fictional temporary projects and the standard library; it does not submit leads, call model providers or deploy anything. Use Python 3.11+ for the suite's TOML parser; the routing/install helpers support Python 3.10+. Existing page generation still needs its documented browser, image/PDF and Node dependencies. See the skill's references for the selected workflow and [CONTRIBUTING.md](CONTRIBUTING.md) for the preserved legacy development commands.

Routing changes are **ready for end-to-end testing**, not a claim that every account/model has been exercised or that previously recorded page/deployment issues are resolved. See [implementation and verification record](docs/community-landing-page-builder/NATIVE-ROUTING-20260922.md).

## History and ownership

The community baseline is `dcbafa918c1f2a73e66e5e8b6e1de5221eaba2fc` (22 September 2026). Main was previously `6962338ff5d8233f6301bfbc4cb460b695e6421e`. Promotion preserves Git history rather than force-pushing a replacement repository.

This remains a private collaboration repository. Reference/client material retains its original rights and provenance; the word community is not an open-source license grant. No client credentials or live lead data are added by native routing.
