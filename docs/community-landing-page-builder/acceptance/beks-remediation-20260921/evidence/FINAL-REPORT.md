# Beks Remediation and Verification

This is a targeted repair of the audited release and its reusable community skill, not a fresh independent build. Historical audit evidence remains unchanged. Code/tests and visual evidence must be distinguished from live provider activation.

## Live Result

Deployed and verified on 21 September 2026, 18:59 UTC:

- Page: https://bookkeeping-by-beks-demo-20260921-r1.shevabody.workers.dev/
- CRM login: https://bookkeeping-by-beks-demo-20260921-r1.shevabody.workers.dev/login
- Guarded release: `f7983ff9-32ec-469b-bb7d-cf1bac8374f6`.
- Cloudflare version: `811503a7-9eb7-4f0d-ba27-308fa8a9e5a7`.
- Source fingerprint: `65753341a8a942b19f4d9492be6ac570a03fdeb34a4f69d320f30763889f6069`.
- Existing Worker, D1, owner credentials and prior leads preserved. Additive account-recovery migration applied.
- Final application suite: 246/246 passed, zero skipped. Shared skill suite: 101/101 passed; additional focused release-diagnostic tests passed. Skill validation and ZIP integrity passed.

| Finding | Source correction | Required proof | Status |
| --- | --- | --- | --- |
| F01 attribution | Preserve selected first-party lead attribution separately from advertising; compare every supported field | Synthetic URL -> request -> saved CRM first/latest touch; GPC/DNT negative tests | Verified live |
| F02 image geometry | Responsive cleanup and guide dimensions; stable dashboard 3:2 frame with tablet stacking | 10 viewport measurements and individual rendered-figure inspection | Verified locally |
| F03 copy | Benefit/mechanism rewrite and independent editorial review | Fresh Sol high review: 8/8 areas; 22 rendered documents match approved copy | Verified locally |
| F04 fonts | Self-host verified Lora and block unsupported rendered-font drift | Actual glyph-font evidence and fallback regression | Verified locally |
| F05 modal/hero | Reserve close-control space; mobile disclosure in flow | 320px modal, short-screen controls, phone/disclosure separation | Verified locally |
| F06 phone | Early readable contact information with demo-safe non-clickability | Hero and final contact observed; hidden-phone negative fixture | Verified locally |
| F07 login return | Resolve actual public destination for current host | Working-origin link, named login, session revocation; two-host routing regressions | Verified live; DNS hosts remain unconfigured |
| F08 accounts | Atomic reset claim and recoverable invitations | Deterministic concurrent-email tests | Code verified; real inbox delivery blocked |
| F09 GTM CLI | Correct command to `--output` and exercise it with synthetic IDs | Generated JSON validated offline | Draft verified; real import/delivery not performed |
| F10 handoff/cron | Consistent current state and actual five-minute retry cadence | Documentation/config agreement and explicit provider blockers | Updated |
| F11 lead details | Guarded backdrop close; preserve interior clicks, selection drags, Escape and focus | Live backdrop/interior/focus test; drag and keyboard browser regressions | Verified live |
| F12 user alignment/reuse | Stable labels around controls, including password-manager siblings; maintained shared UI | Live geometry/screenshot, extension-sibling regression; 34 core files match | Verified live |

No custom-domain migration or real business contact is authorized by these repairs. Preserve Luke's originals, the frozen test skill, existing lead records, and unrelated worktree edits. Close owned test browsers and temporary servers after verification.

## Why The Defects Escaped

The attribution implementation already existed. Generated configuration disabled it, and the previous test accepted that disabled state instead of independently requiring the requested feature. The repair adds a separate expectation and asserts every submitted and saved value. The CRM was not discarding values it received.

The primary CRM stylesheet already matched the earlier working CRM. The new user-management component had a layout defect: an extra empty password-manager sibling changed grid spacing. The fix is generic block-label layout, not an extension-specific hack. The lead-details dialog separately lacked guarded backdrop dismissal. Both fixes are in the shared module and the current project, with regression tests.

The old image acceptance was also insufficient. Final inspection found severe tablet dashboard cropping and a mobile disclosure overlapping a wrapped phone number. Both were corrected and the image-review record was replaced with current evidence. One remaining unapproved section label was caught by rendered-copy parity and replaced with the reviewed wording.

## Verification Boundaries

- Community Python suite: 101/101 passed after the packaging regression was added. The system Python attempt lacked ReportLab and was not treated as a code pass.
- Current layout: 10 viewports, zero failures or warnings. Chromium and WebKit interaction checks pass. WebKit is engine coverage, not a physical iPhone test.
- Current single-run Lighthouse: 100 performance, LCP 1,781 ms, CLS 0.00189, TBT 20 ms. This is lab evidence, not field performance. A local Wrangler proxy crash caused an earlier 500; that failed report is retained, and the owned server was restarted before the successful measurement.
- Local full journey: submission, redirect, PDF download, named login, CRM receipt correlation/update, metrics and logout passed. Test records are synthetic and identifiable.
- The exact original transient WebKit image-loading failure was not reproduced. The checker now visits image positions and records unresolved assets; delayed/offscreen and broken-image regressions pass.
- The guarded publisher completed the full application suite, additive migration, upload, release-identity comparison and live synthetic journey. A separate live UI/attribution probe then passed 11 checks. It compared all 16 fields for both first/latest touches in both the request and saved CRM record: 64 value comparisons.
- Verified fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`, `utm_source_platform`, `utm_creative_format`, `utm_marketing_tactic`, `gclid`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`. Unapproved query content was excluded. Direct navigation retained campaign touches; GPC and DNT suppressed optional capture.
- The final live synthetic record is `57d8ceaf-dc8d-47a5-a06e-ccbb420e6c41`, receipt `f7a84494-8c58-407a-88c2-3c1df5ae64ca`. The CRM shows Google CPC with details collapsed. Email, username, role and submit controls all share top 544.3125 and bottom 586.3125 pixels in the 1440px live capture.
- The first guarded attempt passed 246 tests but failed packaging because its copy-review input was omitted. That artifact is now included and the canonical helper is fixed with an export/extract/freeze regression. Another test invocation failed without retained output; its exact cause cannot be recovered retrospectively. The publisher now preserves private failed-run diagnostics. The final diagnostic run passed all 246 tests without weakening or skipping a check.
- Real email invitations/reset messages need an authorized test inbox and verified sender/recipient configuration. Mock transport and concurrency tests do not establish inbox delivery.
- Optional analytics/ad-platform sharing remain unconfigured. First-party lead attribution is enabled independently. Real GTM import and enhanced-conversion delivery require account IDs and provider checks.
- `go.netbean.com` and `crm.netbean.com` remain pending DNS setup. This repair targets the existing workers.dev demo and preserves its database and credentials.

## Backup

Shared fixes were pushed to `community/pro-review-handoff-20260918` in commits `16890b1` and `a743da4`. Remote main was not changed. The latter includes a sanitized source archive, research and regression tests under `docs/community-landing-page-builder/acceptance/beks-remediation-20260921/`. Credentials and existing customer/owner submissions are not included.

Packaging and diagnostic fixes are in `fbb8503` on the same branch. The source archive remains the exact reviewed page/CRM snapshot; future builds must use the maintained skill, not the historical archive. The final skill ZIP is `community-landing-page-builder-crm-repair-final.zip`.

All temporary browsers used for verification were closed. The task-owned preview server was stopped after local QA. No personal Chrome profiles were used for these checks.

### Evidence

- [Live audit and field comparisons](beks-repair-evidence/live-repair-audit.json)
- [Live invitation alignment](beks-repair-evidence/invitation-row.png)
- [Live synthetic lead detail](beks-repair-evidence/crm-attribution-desktop.png)
- [Independent final copy review](beks-independent-copy-final-review-20260921.md)
