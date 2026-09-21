# Clarentis backend skill repair

## Result

Implemented the minimal reusable F2/F3 repairs in the canonical `community-landing-page-builder` skill. No Clarentis/frozen input was changed, and no publish, deploy, account, email, lead, commit, or push action was performed.

## Changed files

- `assets/cloudflare/scripts/publish-driver.mjs`
  - A newly authorized full live journey now passes the existing guarded `cleanup-test-lead` scope by default.
  - A resumed journey preserves the cleanup scope sealed in its version-2 journal, so an older retained-contact attempt is not silently expanded.
- `assets/cloudflare/tests/release.test.mjs`
  - Covers new-journey cleanup default, cleanup-enabled recovery, and retained-contact recovery.
- `scripts/validate_owner_handoff.py`
  - Uses a structured `pending`, `retained`, or `verified_soft_removed` disposition; explicitly negative/pending owner wording is not mistaken for success.
  - Rejects affirmative cleanup prose without a structured disposition and rejects complete-erasure/zero-trace claims.
  - For verified soft-removal, requires a relative report under `build/`, successful full verification, `synthetic-contact-soft-removed`, the successful post-delete readback check, and an internally identified synthetic contact.
  - Does not claim the report proves unrelated delivery, DNS, or provider state.
- `tests/test_owner_handoff.py`
  - Covers unsupported cleanup prose, valid retained evidence, retained evidence presented as removed, negative/pending wording, false complete-erasure wording, and malformed evidence.
- `references/guided-publishing.md`
  - Defines the frozen `allow_test_lead` approval as the bounded submit/accept/soft-remove scope, documents retained historical metric impact and resume-scope preservation, and states the evidence required before claiming cleanup.
- `references/domain-and-owner-handoff.md`
  - Reuses `team-access.md` for the brief novice-facing Cloudflare Free email path.
  - Separates workers.dev page/CRM operation from owned sender-domain setup; recipients may use any Cloudflare-verified email domain.
  - Documents the optional structured cleanup disposition, the plain soft-removal/retained-metrics owner note, and the proof required for a verified claim.

`references/team-access.md` was not changed because it already contains the required exact Free-tier UI paths, sender-versus-app-domain distinction, any-domain recipient rule, and no-paid/no-arbitrary-recipient limits.

## Verification

- `python3 -m unittest tests.test_owner_handoff`: **6 passed**.
- Supported Node `v24.19.0`, `node --test assets/cloudflare/tests/release.test.mjs`: **26 passed**.
- Supported Node, `node --test assets/cloudflare/tests/verification-tools.test.mjs assets/cloudflare/tests/journey-recovery.test.mjs assets/cloudflare/tests/publish-regression.test.mjs`: **31 passed**. The local-only listener tests required narrow sandbox elevation for ephemeral `127.0.0.1` ports; no external URL was contacted by this run.
- `py_compile` for the changed validator and test: **passed** with its cache redirected to `/private/tmp`.
- `git diff --check` for owned changed files: **passed**.

The optional skill-creator `quick_validate.py` could not start because `yaml`/PyYAML is absent from both available Python runtimes (`ModuleNotFoundError`). No dependency was installed. This is a tooling dependency gap, not a failure reported by the focused repair tests.

## Boundaries

Concurrent agent edits were present in `SKILL.md`, quality/copy/image files, their validators, measurement files, and related tests. They were not modified or reverted by this repair. F1 independent-review provenance remains outside this scope.
