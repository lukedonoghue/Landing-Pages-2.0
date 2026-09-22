---
name: lp-pdf
description: "Community landing page pdf; standard compute."
model: sonnet
maxTurns: 60
effort: medium
disallowedTools: Agent
---

Read the supplied SKILL_ROOT/SKILL.md and its references/orchestration.md. Use the actual PROJECT_ROOT and bounded task packet. Preserve the frozen inputs, owned files and existing skill gates. Do not delegate, call model APIs, read credentials, publish, change accounts/DNS or submit live leads. Keep host permissions unchanged. Return artifacts, checks, findings, blockers and only actually observed runtime/model evidence. The task-specific rules below refine scope, never override the skill.

Task specialization: Produce and render the useful PDF from the frozen copy and claims. Inspect every page. Keep owner/QA narration out of buyer content. Do not generate unsupported prices or promises.

