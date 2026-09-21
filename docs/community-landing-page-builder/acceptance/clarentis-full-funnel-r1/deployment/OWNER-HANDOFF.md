# Clarentis demonstration owner handoff

Recorded: 2026-09-21 coached recovery completion

## Live deployment

- Landing page: https://clarentis-demo-20260921-r1.shevabody.workers.dev
- CRM: https://clarentis-demo-20260921-r1.shevabody.workers.dev/admin/
- Login: https://clarentis-demo-20260921-r1.shevabody.workers.dev/login.html
- Privacy: https://clarentis-demo-20260921-r1.shevabody.workers.dev/privacy.html
- Worker: `clarentis-demo-20260921-r1`
- D1: `clarentis-demo-20260921-r1-crm` (`ff4b75ac-adea-4384-ae59-32b1b99743c9`)
- Account: `Shevabody@gmail.com's Account` (`5b93d5e3c469e05d9bd13672e7887c4a`)
- Release: `59a1278c-4fbe-4232-9c88-0c1f87bf30ac`
- Source fingerprint: `ee193a80e8eb3d0adfc4493cb410282f81a131760fd1aec18166cca402c38e4a`
- Administrator: `test-demo-operator`
- Private password file: `.secrets/production-admin-password.txt` (value intentionally omitted)

This is a disposable demonstration, not the real Clarentis site. No existing Worker, database, site, DNS record or real-client service was reused or changed. Deletion was not performed because it has not been authorized.

## Verification

Local configured verification:

- Supported Node 25.6 regression: 201/201 passed.
- Handoff gates: `pass_with_warnings`; static, browser compatibility, rendered copy and images passed; layout, visual, copy, performance and local journey passed with recorded warnings.
- Local form-to-D1-to-CRM journey passed with lead `aff1c8bc-6ea2-477e-a153-603fc02d1ad3`.
- Rendered copy captured 22 states and parity passed after configured local D1 migrations were applied.

Live verification:

- Guarded release journey: 32/32 checks passed with lead `5ae14c7a-6cdc-4723-b12f-3109a160415c`. It verified receipt correlation, D1 storage, named-owner login, stage and note management, filtered reporting, conversion calculations and logout.
- Full campaign journey: 27/27 checks passed with lead `124f333d-28d3-42e2-ba0c-38037afc04d2`. All nine UTM fields and six click IDs matched their stored values.
- Deployed CRM UI: 20/20 checks passed. The list has exactly `Contact`, `Phone`, `Stage`, `Source`, `Received`; it shows `Google CPC` rather than campaign internals, and expanded details show all attribution values.
- Anonymous admin/API access remains protected. Parent independently confirmed `/` and `/login.html` return 200, `/admin/` redirects to login, unauthenticated API access returns 401, and `/api/health` reports the expected connected D1/release/fingerprint.
- Managed Chromium was closed in `finally` for each custom live journey. Personal Chrome was not controlled.

All enquiries are clearly synthetic. No email or webhook was sent to Clarentis.

## Account recovery

There is no email reset endpoint or interactive forgot-password page. The login page truthfully says recovery is a Cloudflare-owner operation.

One actual version-checked `rotate-password --remote` operation completed against only the pinned demo D1 (`7ff87597-1eac-42e5-b2cd-2fe7e3b66edd`). A retained pre-rotation session returned 401, the old password returned 401, the new password login returned 200, authenticated account access returned 200, logout returned 200 and the logged-out session returned 401. The first immediate credential check was correctly throttled at 429; that report is preserved, the natural fixed-window cooldown was respected, and exactly one post-cooldown retry passed 8/8. No limiter state was changed.

The verified current credential is stored at `.secrets/production-admin-password.txt`. The invalid retired credential and pre-rotation session remain private under `.secrets/` for the audit record. Password values were never printed. Future recovery uses `scripts/admin-account.mjs` and must be run by an authorized Cloudflare owner.

## Remaining actions

- GTM/Google Ads activation is pending user-supplied container ID, conversion ID and conversion label. No populated container was overwritten, no import was published and no synthetic conversion was sent to an ad destination.
- No owned custom domain was supplied. The deployment remains on `workers.dev`; DNS was not changed.
- Client-launch visual quality is not claimed. Hero photographic text legibility and the white footer-logo treatment remain explicitly deferred warnings. The former 320px consent obstruction is resolved.
- The native image model was not reported. No exact model was requested or verified; rendered provenance, crops, disclosure and rights checks passed.

## Evidence

- Guarded deployment: `build/deployment-record.json`
- Frozen live release: `build/releases/59a1278c-4fbe-4232-9c88-0c1f87bf30ac/`
- Live 15-field journey: `build/owner-attribution-live-verification.json`
- Live compact CRM UI: `build/live-crm-ui-verification.json`
- Actual owner recovery: `build/owner-recovery-live-verification.json`
- Preserved expected throttle: `build/owner-recovery-live-verification-rate-limited.json`
- Preliminary recovery dry run: `build/owner-recovery-dry-run.json`
- Configured handoff gates: `build/gates.json`
- Configured regressions: `build/regression-final-configured.tap`
- Helper changes: `build/HELPER-CHANGE-RECORD.md`
- Credentials and private recovery state: `.secrets/` (never publish, log or archive)
