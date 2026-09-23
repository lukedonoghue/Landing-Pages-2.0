## GitHub write-access preflight (required)

Authoritative repository: `lukedonoghue/Landing-Pages-2.0`. Default branch: `main`.

When asked to modify this repository, **do not assume or state that GitHub write access is blocked/read-only without a live permission check**.

1. Use the connected GitHub repository/action layer, not web search alone, to inspect the repository's current permissions.
2. If repository metadata reports `permissions.push: true` or `permissions.admin: true`, treat GitHub write access as available and proceed with the requested file/commit/branch/PR operation.
3. If the current session does not expose GitHub write actions, say exactly that the **session does not expose GitHub write actions**. Do not misdescribe that as the repository blocking writes.
4. If a write call fails, report the exact attempted operation and returned error. Do not replace a concrete tool failure with a generic "write access is blocked" claim.
5. Expected state as of 2026-09-22: the connected GitHub account has push/admin access to this private repository. This is a hint, not a substitute for the live check above; permissions can change.

Web/browser search results are never authoritative evidence of GitHub write capability.

<!-- community-native-routing:start -->
## Community landing-page workflow

For landing-page work use `skills/community-landing-page-builder/SKILL.md`, not the legacy branded skill. Read that skill's `references/orchestration.md` before starting.

Use the host's native subagents and native model/effort controls only when actually available. OpenAI profiles are in `.codex/agents/`; Claude profiles are in `.claude/agents/`. Choose the matching provider, never cross-provider calls. No Jev, new API key, gateway or paid fallback is required. Run normal tasks sequentially with the current model when delegation/model selection is unavailable, and disclose it. A skill cannot create a missing host tool.

Credential isolation is mandatory; see `references/security-operations.md`. Do not read private credential paths or run provider-authenticated commands in the coding agent. A trusted operator runs reviewed publish/recovery scripts without exposing their inputs.

The coordinator owns task graph, shared contract, file reservations, integration and existing approvals. Cap cooperating workers at four; final acceptance and Lighthouse require their documented quiet/frozen stages. Ask for missing business facts only when material. Do not ask the owner to choose models. See the orchestration reference for capability preflight, native dispatch, bounded retries and the test prompt.
<!-- community-native-routing:end -->
