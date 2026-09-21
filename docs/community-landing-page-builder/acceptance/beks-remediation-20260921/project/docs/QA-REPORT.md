# QA Report

## Current Repair Status

The independent audit rejected the previous acceptance verdict. Repairs now include explicit first-party campaign capture, responsive image frames, self-hosted Lora, clearer modal spacing, early contact information, working-origin login return, recoverable account email actions and shared CRM interface corrections. The final copy revision passed a separate GPT-5.6 Sol high review against the source brief, with eight acceptance areas checked. Previous screenshots, hashes and pass counts do not certify this revision.

The repair is targeted remediation, not a fresh independent skill build. Current automated evidence is bound to `build/gate-snapshot.json` through `build/gates.json`; the guarded deployment has its own frozen source and live verification record under `build/releases/`. A source repair is not live until that release record confirms it. Do not reuse historical pass counts as the current result.

The current Worker, repositories, migrations, attribution client, authentication scripts and CRM JS/CSS are reused from the maintained community module. `build/backend-reuse.json` checks their identity. Business configuration, public marketing copy and compact demo labels remain project-specific. Do not reconstruct a CRM for the next business.

| Area | Current acceptance requirement |
| --- | --- |
| Copy | Final copy checked against source facts and buyer questions, with fresh reviewer identity |
| Images/fonts/modal | Rendered geometry, actual glyph fonts, clear close target and readable first screen across required viewports |
| Attribution | Every supported UTM/click ID compared from browser request to persisted first/latest touch; opt-out remains separate |
| Accounts | Concurrent reset approval and invitation recovery regressions; actual email delivery separately verified |
| CRM interface | Backdrop click closes details; interior clicks and selection drags do not; focus returns; user inputs align even with an injected password-manager sibling |
| Live release | Current source identity, deployment revision, accepted synthetic receipt, CRM read-back and login/logout |
| Documentation | Working CLI examples, actual five-minute scheduled retry cadence and actionable provider blockers |

## External Limits

- Temporary destination: `https://bookkeeping-by-beks-demo-20260921-r1.shevabody.workers.dev/`.
- Requested `go.netbean.com` and `crm.netbean.com` are pending verified domain setup. A workers.dev test is not custom-domain verification.
- Optional analytics and advertising remain disabled until selected and configured. First-party lead attribution is a separate feature and does not require an ad-platform ID.
- Account email requires a verified sender and verified recipient on the free setup. A local mail sink is not an inbox delivery test.
- A synthetic offline GTM import is only a draft. Real account import and enhanced-conversion delivery require real IDs and provider verification.

Historical artifacts are retained for comparison, not overwritten as proof that old defects never occurred. The final owner handoff must state which repaired features were observed live and which are still blocked.
