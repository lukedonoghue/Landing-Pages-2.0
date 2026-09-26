# Working on Landing Pages 2.0

The canonical source is this repository's skills/community-landing-page-builder directory (the older skills/branded-lead-funnel-builder is kept for history). Edit it here, test the change, then run the installer. Installed copies and generated client projects are outputs, not the place to make the only copy of a reusable fix.

## Map

| Location | Purpose |
| --- | --- |
| skills/community-landing-page-builder/SKILL.md | Agent's entry point and workflow requirements |
| skills/community-landing-page-builder/references/ | Stage-specific guidance and portable copy library |
| skills/community-landing-page-builder/scripts/ | Research, copy, evidence, PDF/image, scaffold and onboarding helpers |
| skills/community-landing-page-builder/assets/cloudflare/ | Worker, D1 migrations, public/admin assets and application tests copied into generated projects |
| skills/community-landing-page-builder/assets/demo.json | Fictional demo contract and reviewed form selectors |
| tests/ | Repository-level copy/research/approval/onboarding regressions |
| scripts/dev.py | Convenience wrapper around the portable skill quickstart |
| scripts/install_skill.py | Verified copy into a skill installation, with backup |
| .development/demo/ | Ignored generated local demo and its private runtime state |
| README-BOHDAN.md | Audited engineering backlog; status updates distinguish fixed, mitigated and open |
| docs/SELF-GUIDED-BETA-PLAN.md | User journey, milestones and final acceptance criteria |

## Start

Read the [first-run guide](skills/community-landing-page-builder/references/first-run.md). With Python 3.10+ and Node 24 available:

~~~sh
python3 scripts/dev.py bootstrap
python3 scripts/dev.py doctor
python3 scripts/dev.py check
python3 scripts/dev.py demo
python3 scripts/dev.py verify-demo --full
python3 scripts/dev.py serve
~~~

Community skill tests: `python3 -m unittest discover -s skills/community-landing-page-builder/tests -p 'test_*.py'` and, in `skills/community-landing-page-builder/assets/cloudflare`, `node --test tests/*.test.mjs`. After changing the Cloudflare template run `python3 scripts/sync_crm_example.py` so `examples/crm-demo` stays identical (CI runs `--check`).

The command accepts --node to select a supported executable. This keeps the repository independent of a developer's private runtime path. Required OS packages are WebP and Poppler; doctor reports exact missing tools. The Python requirements are pinned in the skill's requirements-build.txt.

The demo is disposable local test data. Its named login password stays in its .secrets folder. Do not paste it into logs or source files. Stop the server before reset-demo; reset preserves the previous local state privately.

## Making a change

1. Find the reusable source rather than editing only .development or an installed/generated copy.
2. Add a focused regression for a demonstrated defect or fragile boundary. Avoid tests that only repeat the implementation.
3. Keep formatting-only changes separate from behavior fixes.
4. Run the relevant suite. For connected template/flow changes, rebuild into a new demo directory and run its real browser journey.
5. View relevant screenshots and PDF pages for visual changes. Automated report generation is not visual approval.
6. Update the relevant backlog status and limitations. A local test does not close a live-account acceptance item.
7. Run the installer after verified source changes. Updates to already-generated client projects require an explicit migration/update decision; do not overwrite their custom content.

The optional client GitHub deployment workflow is deliberately disabled until reviewed release evidence can be transported safely. This repository's own CI verifies code and local integration only; it has no deployment secrets.

## Contracts to preserve

- Copy and final-publication approvals are actual user instructions bound to the right revision.
- A committed lead is acknowledged by its stored receipt; uncertain retries preserve idempotency.
- Optional analytics/provider failure never changes stored-lead success into a form failure.
- Local fixture approvals/data cannot authorize publishing.
- Admin secrets, real lead records and runtime databases stay outside Git, screenshots and public assets.
- Schema changes use additive migrations where practical and receive an explicit update/recovery plan.
- Generated-project source, evidence, configuration and packaging metadata need deliberate version/identity rules; the remaining portability work is in B07/B08.
