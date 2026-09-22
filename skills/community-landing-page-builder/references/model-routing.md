# Platform-native model routing

Keep copywriting and editorial review inside the AI provider hosting the current task. Do not route to another vendor merely because an older workflow names that vendor or model. Do not ask the user for another subscription, API key, CLI login, or connector for ordinary copy work.

## Preferred routes

| Active platform | Primary copy draft | Editorial review |
| --- | --- | --- |
| Codex or ChatGPT | `gpt-6-astra` when available | `gpt-5.6-sol` in a fresh review context |
| Claude | Sonnet | Sonnet in a fresh review context |
| Another provider | Strongest suitable native writing/reasoning model available | Same provider, fresh review context |

An explicit user model choice overrides these defaults. Model availability can vary by account and host. If the preferred model is unavailable, choose the strongest suitable model already available from the active provider, continue without a cross-provider detour, and record the actual provider, model and review mode. Do not claim that a preferred model ran when the host did not report it.

The primary writer receives the complete research, strategy, claim and reference context. The reviewer receives the final draft plus the same evidence, but not a prior self-rating or pass verdict. When a second agent or model call is unavailable, reopen the final artifacts in a deliberate second pass using the current provider and mark the review as `self_review`. Independence comes from the fresh context and evidence-first prompt, not from switching vendors.
