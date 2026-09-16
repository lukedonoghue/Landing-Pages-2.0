# Two approvals, exact revisions

The builder pauses twice: after the complete copy draft/review, and before publishing the finished funnel. Routine research, design, image optimization, testing and repairs proceed autonomously between these points. Missing business facts or account access can still require a specific question; do not ask generic permission repeatedly.

## Copy checkpoint

Create the structured master, client brief, selected reference context and actual editorial review using `copy-workflow.md`. Present the full wording in a readable document, including the offer, modal, brochure promise and thank-you copy. Run the copy audit. Once the user explicitly approves, save their real approval message privately under `build/` and reference its conversation/message ID:

```sh
python3 scripts/workflow.py approve-copy PROJECT --message-file PROJECT/build/user-copy-approval.txt --message-id ACTUAL_MESSAGE_REFERENCE
python3 scripts/workflow.py check-copy PROJECT
```

This records the copy/offer revision, not just a boolean. Changes to the draft or shared offer/form contract invalidate approval. Research and editorial checks remain independently fresh. An unchanged customer-facing draft does not need another user approval merely because its supporting review was refreshed.

## Final publishing checkpoint

Show the actual rendered page, brochure and user journey, explain relevant test results, and provide the intended destination. Ask for final publishing approval only when the build is concrete and reviewable. Include the controlled synthetic lead needed for live receipt and analytics verification in the requested scope. Honor approval already given for that exact result.

```sh
python3 scripts/workflow.py approve-publish PROJECT --message-file PROJECT/build/user-publish-approval.txt --message-id ACTUAL_MESSAGE_REFERENCE --allow-test-lead
python3 scripts/workflow.py check-publish PROJECT
```

Omit `--allow-test-lead` if the user did not authorize that step. Publishing then performs read-only verification and must report incomplete live assurance instead of claiming a complete working lead journey. Never interpret an absent response or elapsed time as approval.

The publish approval is bound to the source fingerprint used by the current handoff QA. Later source edits require renewed review and approval. Deployment metadata must be prepared before the final snapshot; do not relabel old screenshots as current evidence.

## Evidence helpers

After a current `check_gates.py snapshot`, run `workflow.py record-copy-evidence` and `record-image-evidence`, then record their generated reports with the gate checker. Complete-workflow projects require copy, image, browser, visual, performance, compatibility and applicable brochure evidence. Complete Worker funnels additionally require [rendered_copy evidence](rendered-copy.md) comparing the canonical approved wording with the actual page/modal/thank-you/PDF, and recorded local_journey evidence from the actual browser-to-D1-backed-CRM verifier before final publication approval; a read-only check cannot satisfy it.

## Limits and tests

These records are an audit trail, not identity authentication. An agent must only record an approval the user actually supplied. Tests can use `approve-copy --fixture`; it is visibly marked and never authorizes publication. Do not put synthetic approvals in real projects or describe test fixtures as user-approved client work.
