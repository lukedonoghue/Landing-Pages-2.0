# ChatGPT Pro review handoff

Repository: https://github.com/lukedonoghue/Landing-Pages-2.0

Use regular ChatGPT Chat with Pro selected, not a Work or Codex task. The user requested this to use Chat's separate model allowance. No Pro review has been launched by the Codex orchestrator. Account/model selection must be confirmed in Chat.

## Request for the reviewer

Review and improve the portable community landing-page skill for a nontechnical business owner who supplies only an existing website and optionally keywords, reference URLs or images. Aim for a good, credible, conversion-focused page without a technical onboarding burden. Keep instructions compact. Do not solve failures by adding repeated scorecards, extra approvals, paid API prerequisites or mandatory external services.

Read these in order:

1. `README-BOHDAN.md`, unchanged original, for Luke's intent.
2. `docs/community-landing-page-builder/SEQUENTIAL-ACCEPTANCE-2026-09-18.md` for current user scope and history.
3. `skills/community-landing-page-builder/SKILL.md` and the references/helpers it actually invokes.
4. `docs/community-landing-page-builder/WEBSITE-ONLY-R1-REVIEW.md` through `WEBSITE-ONLY-R4-REVIEW.md` and associated evidence.

Trace each proposed change to a concrete instruction conflict, missing implementation default, ignored rule or inadequate test. Distinguish those causes. Verify reviewer claims against evidence rather than assuming every criticism is correct. Preserve effective copy, research, brand-font extraction, verified image sourcing, real image generation when needed, responsive visual review and Google-first tracking with Meta/Microsoft adaptations.

Current phase is local page-only acceptance. A truthful local form simulation is allowed; CRM/backend integration and Cloudflare authentication come later. Do not publish, connect accounts, send leads, access credentials or modify the existing CRM. Do not describe simulation as real lead delivery. Do not use em or en dashes in authored copy.

Modify only `skills/community-landing-page-builder/` and `docs/community-landing-page-builder/`. Leave Luke's original skills and `README-BOHDAN.md` unchanged. Prefer a review branch and PR, with no automatic merge, when authorized write tools are actually available.

Before claiming direct GitHub edits, verify this Chat session exposes write tools and has repository authorization. OpenAI's standard Chat GitHub app is documented as read-only. If read-only, return an exact unified diff or complete replacement files with a short change manifest for Codex to apply and test. Do not claim changes were pushed when only proposed.

Do not start acceptance builds with this audit context. Subsequent builders must receive only the revised frozen skill, a blank project and plain business request, in a separate fresh context without these audit notes. Report what was actually executed and what remains untested. The last four attempts covered Stayclean website-only; the external-reference and image-generation cases have not yet run.

## Product capability references

- Chat Pro has its own allowance: https://help.openai.com/en/articles/20001354-gpt-56-and-gpt-6-pro-in-chatgpt
- Standard Chat GitHub app is documented as read-only: https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt

Checked 2026-09-18. Codex's GitHub write tools do not establish write availability in regular Chat.
