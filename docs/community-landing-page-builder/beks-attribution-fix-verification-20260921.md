# Attribution and GTM Remediation Verification

Date: 2026-09-21

## Outcome

The synthetic demonstration now explicitly requests and enables first-party lead attribution while analytics measurement and advertising customer-data handling remain disabled. GPC/DNT handling remains active. The existing project CRM/backend contract is reused; this work does not introduce a second lead backend or claim that the configuration removes privacy obligations.

The live verifier now requires the fixture to state the expected policy and feature contract. It verifies every allowlisted attribution field in the submitted lead and CRM-stored first/latest touch data, rejects excluded query data, and cannot declare requested attribution successful when runtime capture is disabled. The parent integration run still owns the final live-browser proof.

## Root Cause

F01 was a configuration/test-contract failure rather than an absent transport implementation:

- The shared client and backend already carried allowlisted attribution fields.
- The project selected `attribution_mode: disabled`, so the client correctly submitted no attribution and backend enforcement correctly stored none.
- The prior fixture/verifier treated that absence as the expected negative path. It did not declare whether first-party attribution was required, so a requested lead-attribution experience could silently pass while disabled.
- The prior query allowlist also omitted the extended UTM fields and `dclid`, and the assertions sampled attribution instead of checking the complete first/latest contract.

F10 was a documentation/CLI mismatch: the project documentation used `--out`, while `build_gtm_container.py` accepts `--output`.

## Policy and Configuration

Project policy is now:

| Setting | Value |
| --- | --- |
| Analytics measurement | `disabled` |
| First-party attribution | `lead` |
| Required attribution contract | `lead` |
| Advertising user data | `disabled` |
| Consent UI | `disabled` |
| Browser opt-out handling | GPC/DNT honored |

`sync-config.mjs` and `preflight.mjs` enforce an explicitly supplied `required_attribution_mode` without changing the reusable default. A funnel that does not select or require attribution is not globally forced to `lead`.

Host validation now accepts unified mode with both public and CRM hosts blank, rejects a one-sided host, rejects equal nonblank hosts, and accepts distinct nonblank hosts. The reusable template supports generic `requested_hosts.public` and `requested_hosts.crm` values without embedding project business hostnames.

## Attribution Acceptance

The fixture and verifier cover these 16 known fields individually:

1. `utm_source`
2. `utm_medium`
3. `utm_campaign`
4. `utm_id`
5. `utm_term`
6. `utm_content`
7. `utm_source_platform`
8. `utm_creative_format`
9. `utm_marketing_tactic`
10. `gclid`
11. `dclid`
12. `gbraid`
13. `wbraid`
14. `fbclid`
15. `msclkid`
16. `ttclid`

For each field the verifier checks four positive surfaces: submitted first touch, submitted latest touch, CRM-stored first touch, and CRM-stored latest touch. This is 64 explicit field assertions, plus exclusion checks. The positive client and server tests use one session with two navigations and one submission: first and latest values are nonidentical, first remains unchanged, latest updates, and direct CRM fields expose latest touch.

`email`, `token`, `utm_private`, and unknown campaign/query keys are exercised as excluded data in the shared tests. The project live fixture explicitly excludes `email`, `token`, and `unknown_campaign`.

When analytics is disabled, the verifier reports an unmeasured policy check rather than a measured visit pass. The project fixture therefore expects `first_party_attribution: true` and `measured_visit: false`.

## Files Changed

Project:

- `funnel.json`
- `src/site-config.json`
- `public/privacy.html`
- `test-fixture.json`
- `docs/TRACKING-SETUP.md`
- `scripts/live-verify.mjs`
- `scripts/sync-config.mjs`
- `scripts/preflight.mjs`
- `tests/client.test.mjs`
- `tests/backend.test.mjs`
- `tests/traffic.test.mjs`
- `tests/verification-tools.test.mjs`
- `tests/journey-recovery.test.mjs`
- `tests/release.test.mjs`
- `build/gtm-container.synthetic-draft-not-live.json`

Reusable community builder:

- `assets/demo.json`
- `assets/cloudflare/scripts/live-verify.mjs`
- `assets/cloudflare/scripts/sync-config.mjs`
- `assets/cloudflare/scripts/preflight.mjs`
- `assets/cloudflare/tests/client.test.mjs`
- `assets/cloudflare/tests/backend.test.mjs`
- `assets/cloudflare/tests/traffic.test.mjs`
- `assets/cloudflare/tests/verification-tools.test.mjs`
- `assets/cloudflare/tests/journey-recovery.test.mjs`
- `assets/cloudflare/tests/release.test.mjs`
- `tests/test_gtm_builder.py`

The project and reusable copies of the live verifier, sync/preflight scripts, and shared attribution tests were byte-compared after editing. Branded/frozen snapshots, page UI, team-account files, skill references, and the established backend architecture were not changed by this remediation.

## GTM Draft Evidence

The documented command now uses `--output`. It was run offline with explicit synthetic identifiers only:

- Container public ID: `GTM-SYNTHETIC`
- Google Ads account: `0000000000`
- Hostname: `attribution-verification.example.invalid`
- Container label: `SYNTHETIC DRAFT - NOT LIVE`
- Output: `build/gtm-container.synthetic-draft-not-live.json`

The artifact is a draft and is not evidence of a live GTM destination or deployment. A reusable CLI regression test executes the same supported `--output` interface without fabricated real destination IDs.

## Verification Evidence

Passed serial/offline checks:

- Supplied primary runtime: Node `v24.19.0`.
- Full project Miniflare backend suite: 25 passed, including the complete attribution persistence case and the unchanged source/device cohort assertions.
- Reusable Miniflare login prerequisite plus attribution case: 2 passed.
- Project release suite: 24 passed.
- Reusable release suite: 24 passed.
- Project browser-free recovery journey fixture contract: 1 passed.
- Reusable browser-free recovery journey fixture contract: 1 passed.
- Reusable isolated browser recovery case `concurrent CRM edits are retained and private payload tampering cannot resubmit`: 1 passed after changing a schema-valid 16-field fixture value and asserting the `binding_mismatch` recovery code.
- Project verification-tool targeted suite: 7 passed.
- Reusable verification-tool targeted suite: 7 passed.
- Project client full-16-field, two-navigation unit test: 1 passed.
- Reusable client full-16-field, two-navigation unit test: 1 passed.
- Project traffic/CRM serializer suite: 6 passed.
- Reusable traffic/CRM serializer suite: 6 passed.
- Reusable GTM builder CLI suite: 4 passed.
- Generated reusable demo fixture contract validation: passed with 16 first-touch fields and explicit expected policy/features.
- Project config sync: passed.
- Relevant JavaScript syntax checks and Python compilation: passed.
- Host validation covers paired empty, one only, equal nonblank, and distinct nonblank cases.
- Preflight tests cover explicit required-attribution mismatch and absence of a global attribution default.

The earlier Miniflare and release-runtime limitations were resolved by running with `/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` first on `PATH` and allowing only ephemeral localhost sockets for Miniflare. The attribution probe originally left a Google-classified lead in the shared backend fixture database, causing the later cohort test to observe one Google lead instead of zero. The test now deletes the full-16-field attribution probe after its CRM assertions and creates a separate email-attributed baseline lead for the downstream CRM workflow. The cohort assertion was not weakened and the full backend suite passes 25/25.

The full journey-recovery file was not rerun. After explicit authorization, only the changed `concurrent CRM edits...` case launched Chromium; it passed 1/1 and its test-owned cleanup closed the isolated browser/server resources. The recovery fixture is also covered by a dedicated no-browser test that validates the real `testRunOptions` contract, all 16 fields, explicit expected policy/features, and excluded-query keys. No persistent server, deployment, Git mutation, secret, real email, or real destination identifier was used.

## Parent Integration Handoff

The remaining acceptance step is one live browser journey using the project fixture: open the initial 16-field URL, navigate in the same session to the distinct latest-touch URL, submit one synthetic lead, then verify all submitted and CRM-stored first/latest fields plus exclusions. No additional attribution verification round is required if that journey passes.
