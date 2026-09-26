# Optional copy review and required publication authorization

The default builder does not pause between copy and design. It autonomously creates and tests a complete local final. Copy approval remains available only when the user explicitly requests an approval-gated workflow. Publication requires real authorization because it changes an external account, but the original request satisfies that requirement when it explicitly included publication. Missing business facts, launch IDs or account access can still require a specific question; do not ask generic permission repeatedly.

## Optional copy checkpoint

Create the structured master, client brief, selected reference context and actual editorial review using `copy-workflow.md`. Run `workflow.py check-copy`; a passing default project continues directly to design. Only when `funnel.json` sets `approvals.copy_before_design` to true should the agent present the full wording, stop, and save the user's real approval message:

```sh
python3 scripts/workflow.py approve-copy PROJECT --message-file PROJECT/build/user-copy-approval.txt --message-id ACTUAL_MESSAGE_REFERENCE
python3 scripts/workflow.py check-copy PROJECT
```

This records the copy/offer revision, not just a boolean, plus a hash of each passage (hero, each section by id, modal, thank-you, brochure, interface text and the offer/form contract). After an edit, `check-copy` lists only the changed passages in `changed_passages`; show the owner those passages (the guide's "Show what changed" view) and record their approval the same way. The first approval always covers the complete copy. Metadata such as claim ids, notes and review ids is not approvable text, so editing it never asks the owner again. Research and editorial checks remain independently fresh.

After the copy gate (and optional approval when configured), complete the substantive design system and image plan. Before creating or editing client HTML or generating the brochure PDF, run:

```sh
python3 scripts/workflow.py check-build PROJECT
```

This blocks missing or scaffold-level documents, any configured stale approval, an absent/invalid image plan, unresolved image requests, and required images that have not been acquired and optimized. It does not replace the later rendered desktop/mobile image review.

## Publication authorization after the local final

Show the actual rendered page, brochure and user journey with test results before launch setup. Collect the Cloudflare account/domain, enabled GTM/provider IDs, customer-data/consent choices, and controlled-test-lead permission. If the original request explicitly said to publish, reuse that exact message after QA; do not ask for a second design approval. If it requested only a build, ask once whether to publish.

```sh
python3 scripts/workflow.py authorize-publish PROJECT --message-file PROJECT/build/user-publish-instruction.txt --message-id ACTUAL_MESSAGE_REFERENCE --allow-test-lead
python3 scripts/workflow.py check-publish PROJECT
```

Omit `--allow-test-lead` if the actual instruction did not authorize that step. Publishing then performs read-only verification and must report incomplete live assurance instead of claiming a complete working lead journey. Never infer external-action authorization from silence.

The publication authorization record is bound to the source fingerprint used by the current handoff QA. Later source edits require refreshed QA and re-recording the same still-applicable user instruction. Deployment metadata must be prepared before the final snapshot; do not relabel old screenshots as current evidence.

## Evidence helpers

After a current `check_gates.py snapshot`, run `workflow.py record-copy-evidence` and `record-image-evidence`, then record their generated reports with the gate checker. Complete-workflow projects require copy, image, browser, visual, performance, compatibility and applicable brochure evidence. Complete Worker funnels additionally require [rendered_copy evidence](rendered-copy.md) comparing the canonical wording with the actual page/modal/thank-you/PDF, and recorded local_journey evidence from the actual browser-to-D1-backed-CRM verifier before publication authorization is recorded; a read-only check cannot satisfy it.

## Resuming

Use [resuming-work.md](resuming-work.md) at the start of a resumed task. It derives current stages and preserves optional copy approval and exact-revision publication authorization. Material source changes invalidate publication eligibility. Operator checkpoints and a local status view cannot create external-action authorization.

## Limits and tests

These records are an audit trail, not identity authentication. An agent must only record instructions the user actually supplied. Tests can use `approve-copy --fixture`; it is visibly marked and never authorizes publication. Do not put synthetic approvals in real projects or describe test fixtures as user-authorized client work.
