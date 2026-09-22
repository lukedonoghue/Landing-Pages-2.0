<!-- community-native-routing:start -->
## Community landing-page workflow

For landing-page work use `skills/community-landing-page-builder/SKILL.md`, not the legacy branded skill. Read that skill's `references/orchestration.md` before starting.

Use the host's native subagents and native model/effort controls only when actually available. OpenAI profiles are in `.codex/agents/`; Claude profiles are in `.claude/agents/`. Choose the matching provider, never cross-provider calls. No Jev, new API key, gateway or paid fallback is required. Run normal tasks sequentially with the current model when delegation/model selection is unavailable, and disclose it. A skill cannot create a missing host tool.

The coordinator owns task graph, shared contract, file reservations, integration and existing approvals. Cap cooperating workers at four; final acceptance and Lighthouse require their documented quiet/frozen stages. Ask for missing business facts only when material. Do not ask the owner to choose models. See the orchestration reference for capability preflight, native dispatch, bounded retries and the test prompt.
<!-- community-native-routing:end -->
