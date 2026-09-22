# Platform-native copy model update

The maintained community skill now keeps copywriting and copy review on the provider hosting the current task.

- Codex/ChatGPT: prefer GPT-6 Astra for the primary draft and GPT-5.6 Sol for a fresh editorial review.
- Claude: use Sonnet for the primary draft and a separate Sonnet review.
- Other providers: use the strongest suitable native model available, with a fresh same-provider review context.
- If the preferred model is unavailable, fall back within the same provider and record what actually ran.

This removes cross-provider copy dependencies. It does not make another API key, subscription, CLI login or connector part of the landing-page workflow. Existing benchmark reports retain the models that actually ran and were not rewritten.

## Latest main compatibility

The current main branch later introduced generated native Codex and Claude agent profiles. The integration handoff now applies the same rule to that executable routing layer: `config/routing.json` contains ordered role-specific provider routes, the installer generates matching profiles, and the router keeps copy and copy review on those routes during retries. Generic deep/critical profiles remain available for non-copy engineering work; they are no longer used to send Claude copy or copy review to Opus.

## Verification

- Canonical community skill: 117/117 Python tests passed, including 16 focused core tests.
- Installed community skill: 16/16 focused core tests passed after synchronization, and the changed source files match byte for byte.
- Skill Creator validation passed for both canonical and installed community copies.
- The active page-builder CLI's provider-routing suite passed 4/4 tests, covering Codex/OpenAI, Claude/Anthropic, legacy Opus-config migration and generated prompt naming/content.
- Both existing `.pagebuilder/config.json` files now select OpenAI with Astra writing and Sol 5.6 review; JSON validation and CLI status passed.
- No model call, API-key request, provider login, copy generation, deployment or live account mutation was performed during this update.
