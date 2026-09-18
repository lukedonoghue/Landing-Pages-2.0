# Website-only attempt 10: budget checkpoint

Paused on 2026-09-19 at 02:28 Kyiv after Codex usage reached 32%, the agreed 30-point allowance above the 2% starting baseline. No reset credit was redeemed. Progress heartbeat is paused. Further testing requires user confirmation.

## Status

The independent builder completed the local page and saved its handoff and QA summary. Parent acceptance is NOT complete. Do not count this as the first accepted scenario yet. Cases 2 and 3 have not started. No CRM, Cloudflare, live lead or private account work was performed.

Builder: `01a0b6c1-9b10-76c1-ad74-eac0f515f867` (Gauss), gpt-5.6-sol xhigh, fork_context=false. Started 02:02 Kyiv. Source c2e05d2; frozen skill contains 173 files, manifest SHA-256 `a94918b468d66adaa7fa1b363747e6aadaadfef6d3b2eddc4b21f4422e76b41d`. It received the unchanged owner request, skill and empty project only. No earlier conversation, page or audit was supplied. The only follow-up told it to stop at the user-defined usage threshold and return saved work.

Independence means a fresh conversation and instructed filesystem boundary on a shared host. It is not an isolated OS or new ChatGPT account. The builder independently researched Stayclean and repaired issues discovered by its own checks: modal-action visibility, focus containment, missing favicon, hidden success/form layout conflict and oversized image delivery.

## Saved artifacts

The complete project is preserved in `evidence/website-only-r10/project/`, including source, assets, provenance, QA scripts/reports and screenshots. The exact prompt is `evidence/website-only-r10/prompt.txt`. Its absolute attachment/output paths identify the original run; relocate these two paths when reproducing elsewhere.

The original local project remains at `/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260918/runs/website-only-r10/project`. Reported preview: `http://127.0.0.1:4187/`. To restart the saved project, run `STAYCLEAN_PORT=4187 node local-server.mjs` from its project directory, choosing another free port if occupied. The preview server binds to loopback and simulates responses; it is not a production backend and does not deliver or store leads.

## Builder-reported results

- Static and prohibited-surface checks pass.
- Browser helper has 102 checks, zero failures at five required sizes, and one documented mobile crop warning.
- Synthetic form checks pass, including validation correction, focused failure/success, opener restoration and duplicate pending submission.
- Final Lighthouse 13.5.0 JSON, fetched 23:27:17 UTC: Performance 98, Accessibility/Best Practices/SEO 100; LCP 2403.5605ms, CLS 0, TBT 13ms (displayed as 10ms).
- Final full-page and modal captures were saved. The budget interruption stopped only a refresh of derivative section crops, according to the builder. Older section captures must not silently be treated as final-artifact evidence.

Parent read the final Lighthouse JSON and earlier browser/form reports and viewed desktop/mobile first-fold images. Parent has NOT independently exercised the final form or finished all final pixel/provenance checks. Builder self-review is not equivalent to parent acceptance. The simulated production-success state is not evidence of real delivery.

## Resume here

1. Ask for or receive continuation authorization before consuming more testing usage. Do not launch a new build automatically.
2. Review this saved attempt, unchanged: final source/provenance and conversion parity, actual fonts/image boxes, final five-size pixels, and synthetic form correction/focus/pending/failure/retry/success. Intercept or use local synthetic requests only. Verify exact final-report correspondence, refreshing only stale evidence as needed.
3. Record either bounded local acceptance or concrete reproducible failures. Calibrate reviewers and do not reject merely for subjective style preferences.
4. If a real failure remains, trace it to the skill and make the smallest justified source correction. Test it, freeze a new snapshot, then start a new blank Sol xhigh agent without earlier context. Do not manually repair this page and call it an independent pass.
5. Only after case 1 passes, proceed sequentially to the external-reference and image-generation cases in SEQUENTIAL-ACCEPTANCE-2026-09-18.md. CRM and Cloudflare remain deferred.

Keep all changes in the community skill/docs folders and push only to `community/pro-review-handoff-20260918`. Luke's original skill and README-BOHDAN.md must remain unchanged. The repo's local branch is named main, so use the explicit separate-branch refspec; never push remote main.
