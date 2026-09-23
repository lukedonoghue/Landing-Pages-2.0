# Landing Pages 2.0 - start here for tester pilots

Updated: 23 September 2026.

## Scope and release status

This is the entry point for people testing the reusable community builder in a fresh local project. NetBean was a test deployment and is explicitly outside this release's acceptance criteria. Nobody needs to repair, connect to or deploy NetBean to test this project.

The candidate fixes both defects in `SECURITY-POST-PUSH-REVIEW-20260923.md`: account edits use one authorized/version-checked snapshot, and only public guide PDFs receive a same-origin framing exception. Login, CRM, API and account-action pages retain framing restrictions. The example is regenerated from the maintained template. Eight new regressions cover the permission race, normal edits, response policy and static-header rule. The reader browser test now uses the actual security response wrapper and verifies the visible PDF-download fallback.

Release status for this candidate: **awaiting the required GitHub checks**. The final tested commit, workflow results and tester-release decision will be recorded here after those checks finish. Historical security review files describe their own earlier snapshots; this file is the current tester-release entry point.

## What to share

Share access to this private repository's current validated `main` with authorized testers. Do not share an old security patch ZIP or a copied client project. The repository remains private; this document does not grant public redistribution rights or change access. Testers need a complete checkout so the bundled build resources are present.

Use a fresh folder and fictional lead/contact data. Do not import client databases, production passwords or advertising-account credentials. Google Sheets, cloud hosting, real email, custom domains and paid integrations are optional later tests, not prerequisites for the local builder pilot.

## Start with an AI coding session

Open the complete checkout in a file-capable ChatGPT/Codex coding session or Claude Code session. A plain chat without filesystem, command execution or browser capability cannot run this workflow. Use the provider you already have; do not add a second model provider just to test the project.

Paste this, replacing the business description:

> I am testing Landing Pages 2.0 from this checkout. Read TESTING-START-HERE.md, the project instructions and skills/community-landing-page-builder/SKILL.md. Check the documented local prerequisites and guide me through any genuinely missing setup. Build a local landing page for [BUSINESS WEBSITE OR DESCRIPTION] in guided mode. Ask for missing business facts rather than inventing them. Use the current community workflow, including review research where available, benefit-focused copy, honest imagery, a useful illustrated PDF, the complete thank-you page and the local D1-backed CRM when the conversion uses a form. Use only this session's actual tools and my existing provider; report unavailable capabilities instead of simulating them. Run the quality checks, compare against the reference control and repair confirmed problems. Do not publish, connect external lead destinations, submit real leads, read production secrets or enable paid services. Finish with the local preview instructions, actual verification results and any reproducible blocker.

The real-business pilot checks research and native-agent behavior that a fictional CI fixture cannot certify. Existing instructions and approvals must be preserved; never discard another project's files to make installation succeed.

## Deterministic local smoke test

The initial quickstart supports macOS and Linux. Use Node 24 (the CI runtime) and Python 3.12 or a compatible documented version. The doctor reports missing prerequisites; Windows needs a separately tested adapter and is not certified by this release.

From the repository root:

```sh
python3 scripts/dev.py doctor
python3 scripts/dev.py bootstrap
python3 scripts/dev.py doctor
python3 scripts/dev.py demo
python3 scripts/dev.py verify-demo --full
python3 scripts/dev.py serve
```

The first doctor may exit nonzero because dependencies are not installed yet. Bootstrap downloads the locked Python/Node/browser dependencies but does not sign in, deploy or enable a paid service. Follow any remaining doctor instructions for system utilities. Supply `--node /absolute/path/to/node` when Node 24 is not on PATH.

The demo writes a fictional project under `.development/demo`. The local server defaults to `http://127.0.0.1:8787`; the CRM login is `/login.html`. The demo prints where its local-only owner password is stored. Open that file yourself on your machine; do not paste its contents into feedback or commit it. Stop the server with Ctrl+C. Keep the server bound to loopback.

## What testers should verify

- Open the page on a narrow mobile viewport and desktop. Confirm readable headlines, no horizontal overflow, working keyboard focus and a usable modal without title/control collisions.
- Submit a clearly fictional enquiry to the local form. Confirm one accepted lead, a truthful thank-you page, and the matching record in the local CRM. Refresh/retry without creating duplicate leads. A direct thank-you visit must not claim an enquiry was received.
- Download and open the guide, inspect every page and compare the copy/images with the supplied facts. Open the on-page reader. Native PDF rendering varies across browsers and headless captures; the visible download fallback must always deliver the same real PDF. Report a blank native preview with browser/version and screenshot rather than treating an iframe's presence as proof of rendering.
- Exercise CRM editing, roles and logout using synthetic accounts. Owner-only administrator changes and sensitive-action password confirmations should remain enforced. Normal manager/viewer behavior must still work.
- Pause and resume the guided build and check that answers, context and the next step are preserved. Inspect the actual PDF, image provenance and reference comparison rather than trusting a generated 'passed' label.

## Feedback format

Record the checkout SHA (`git rev-parse HEAD`), operating system, Node/Python versions, AI host and actually available tools, browser/version, exact steps, expected result, actual result and a screenshot or redacted error log. Use fictional addresses such as `tester@example.invalid`. Never attach `.secrets`, `.dev.vars`, databases, tokens, session cookies, raw lead exports or unredacted authentication logs.

## Optional production work - not a blocker for this local pilot

`SECURITY-RELEASE-HANDOFF.md` remains the checklist before using a deployment for real customer data: cloud-account ownership/MFA, scoped publishing credentials, deployment-specific migrations and domain controls, backup/retention, and optional signed Google Sheets setup with a synthetic create/delete check. Do not mark those controls complete just because local/CI tests pass. No production deployment, external account configuration or NetBean validation is performed by this tester release.

A passed tester release means the checked-in code and reproducible local journey are ready for controlled pilots. It is not a guarantee that every future generated page, host/model combination or production deployment has no issues.
