# Beks Targeted Remediation

This is a repair of an existing independent-build result, not another independent acceptance run. The frozen original skill and Luke's original files remain untouched. The maintained source is `skills/community-landing-page-builder` on the community branch.

## Source And Reuse

`project/` preserves the reviewed generated source. It deliberately excludes credentials, local D1 data, runtime dependencies and historical CRM records. Its original source fingerprint is `65753341a8a942b19f4d9492be6ac570a03fdeb34a4f69d320f30763889f6069`.

The maintained CRM is the module at `skills/community-landing-page-builder/assets/cloudflare`. Reuse its Worker, storage, authentication, accounts, attribution client and admin JS/CSS. Configure business identity, form schema, stages, hosts and selected privacy settings. Do not recreate these files for each landing page, and never copy customers' credentials, users or leads. The reuse verifier compares 34 shared source/migration files; live behavior is tested separately.

The invitation field mismatch was caused by grid layout around the username control when a password manager added an empty sibling. The shared label layout now preserves aligned controls. Lead-detail backdrop closure requires a pointer gesture starting and ending outside the panel, preserving interior interactions and text-selection drags. Escape and focus restoration remain supported.

## Important Evidence Boundaries

- Attribution was disabled by generated configuration, not lost by the CRM repository. Both the selected feature expectation and actual stored first/latest values now have to pass independently.
- All 16 supported campaign parameters are asserted individually. GPC/DNT are separate negative cases. Advertising and optional analytics are not silently enabled.
- The page now self-hosts verified Lora. Cleanup, dashboard and guide frames have responsive dimensions; tablet dashboard cropping and mobile disclosure overlap were corrected.
- The first rewritten copy failed an independent review. The revised copy passed a separate GPT-5.6 Sol high review, then rendered-copy parity caught one stale eyebrow. The implementation was changed to the approved wording, not exempted from comparison.
- A WebKit image check failed once without asset-level diagnostics. The added check visits real image positions, waits for resource completion and reports failed assets. A delayed/offscreen valid image and a broken image are tested. The original transient cause was not conclusively reproduced.
- Real email inbox delivery remains unverified. Local mail-sink and concurrency tests are not a substitute. No authorized recipient was supplied during this repair.
- Real GTM import/enhanced-conversion delivery and custom-domain DNS remain separate configuration work.

## Deployment Safety

The existing destination is `bookkeeping-by-beks-demo-20260921-r1.shevabody.workers.dev`, with the existing Worker and D1 retained. Do not provision a replacement CRM or rotate its owner credentials as part of copying this source. Owner credentials remain only in the original local project's `.secrets/` directory.

This source archive is not an authorized deployable handoff. A different task or computer must establish current account/destination authorization, restore its private prerequisites, generate fresh gates and use the guarded publisher. Never use a raw Wrangler upload to bypass unresolved release state. See the final remediation report for the actual observed release outcome and remaining work.
