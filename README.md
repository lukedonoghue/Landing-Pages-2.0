# Landing Pages 2.0: Community Builder

The **community landing-page builder is now the main workflow**. Start from `main` and use `skills/community-landing-page-builder/SKILL.md`. The previous branded builder is retained under `skills/branded-lead-funnel-builder/`; its earlier README is preserved as [README-LEGACY.md](README-LEGACY.md).

The community builder turns business research into a branded responsive landing page, purposeful imagery, a useful PDF, an honest conversion path and actual visual/functional QA. CRM, advertising tracking and hosting are selected modules, not prerequisites for a local page. It does not require copy/design approval unless you ask for that checkpoint. Publishing and live test leads still require the authorization described in the skill.

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

The default OpenAI policy uses Luna, Terra and GPT-5.6 with task-appropriate effort. The Claude policy uses Haiku, Sonnet and Opus aliases, with supported effort settings. Missing choices use explicit inherited profiles or sequential fallback, without new API credentials. Profiles are generated from one policy; fallback profile/model consistency is regression-tested.

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
