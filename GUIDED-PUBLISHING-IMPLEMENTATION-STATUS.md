# Guided publishing - implementation and acceptance status

Updated: 24 September 2026.

## Decision

**Installed on `main` and accepted for the supported guided-publishing profile.**
The validated runtime commit is `b7fbd7e8d15288779daa1f6eb94e6c1e5c0f6be1`.
All three required GitHub workflows passed on that exact commit. This document may
be updated afterward with `[skip ci]`; such documentation-only changes do not alter
the validated runtime tree.

This is code/release acceptance for the guided workflow, not evidence that a
particular customer's Cloudflare or Google account has already been configured.
No production site, real customer lead, Cloudflare account setting or Google Sheet
was changed during this release validation.

## What is now built into main

- `scripts/dev.py ship --project ...` from the repository and
  `scripts/ship.py --operator --ui` inside fresh generated projects.
- A private loopback publishing wizard that asks for the domain and CRM owner
  email, keeps Google Sheets off by default, guides Cloudflare authentication and
  account selection, runs routine checks automatically, requests only the owner
  confirmations it cannot establish through APIs, and requires explicit publish
  approval.
- A persistent revisioned state machine with resume after interruption, process
  locking, duplicate-click protection, source/destination-bound approval and
  reconciliation of uncertain external operations before retry.
- Reuse of the existing guarded publisher rather than a second deployment engine:
  hosting preparation, D1 recovery bookmark, migration/version checks, publication,
  release identity verification, one labelled synthetic enquiry and permanent
  cleanup verification.
- AUTO / CONFIRM / AUTO_OR_CONFIRM readiness requirements so routine engineering
  checks remain internal and owner attestations never masquerade as API evidence.
- Existing-account review without silently deleting users, rules or connections.
- Optional Google Sheets setup only when selected: standalone Apps Script/property
  handoff, signed probes, delivery proof before cleanup, erasure verification and
  anti-resurrection checks.
- Credential isolation: production passwords/tokens are not browser fields or
  coding-agent inputs; the trusted operator path owns authenticated commands and
  private handoffs.
- Native guided-builder integration: local quality failures return a non-secret
  repair task to the coding assistant instead of exposing an engineering checklist
  to the normal user.
- Fresh scaffold support and regenerated CRM example parity.
- Regression coverage for coordinator state, interruption/retry behavior, browser
  wizard behavior, provider protocol, signed release verification and existing
  security controls.

## Release evidence on the validated runtime commit

| Check | Result |
|---|---|
| Community release - run `35992151500` | **PASS.** 360 Python tests. 351 Node/application tests, 0 failed, 0 skipped. Generated CRM example parity, high-severity dependency audit, Chromium/WebKit launch and Worker dry bundle passed. |
| Native routing - run `35992151538` | **PASS.** Routing, reservations, fallback/safe installation and provider-profile checks passed. |
| Current community skill and fresh demo - run `35992151531` | **PASS.** 351 Node/application tests, 0 failed/skipped; fresh fictional project; 78 browser checks; 102 journey checks; 3 PDF pages rendered; local D1/CRM journey; layout/performance checks; portable archive roundtrip. |
| Focused guided-publishing validation before push | **PASS.** 56 coordinator/HTTP/scaffold checks and 55 provider/security checks. |

The application suite runs in more than one workflow and routing overlaps the
Python discovery suite. Do not add these figures into an inflated unique-test
total.

One compatibility assertion failed on the first pushed candidate because generated
`START-HERE.md` no longer mentioned the legacy workers.dev fallback. That wording
was restored without changing the standard wizard's custom-domain behavior. The
fresh full run above is on the corrected commit and is green.

## Supported standard profile

The self-guided adapter currently certifies **one custom domain, one Cloudflare
Worker and one D1 CRM on macOS/Linux**. Google Sheets is optional and absent from
the default flow. Split public/CRM domains, Pages gateways, external-DNS profiles,
static-only and workers.dev-only destinations retain the advanced publishing path;
the wizard does not silently rewrite them.

A D1 Time Travel bookmark is captured before migrations. It is a recovery point,
not a claim that a restore has been rehearsed. Cloudflare account MFA and some
ownership/privacy choices remain explicit owner confirmations where APIs cannot
establish them. If an edge setting cannot be configured with the operator's scoped
authorization, the wizard shows one guided action rather than pretending it was
automated.

Google still requires its own standalone Apps Script approval when that optional
integration is enabled. The wizard prepares the files/properties and verifies the
signed create/delete lifecycle; it does not claim a nonexistent one-click Google
authorization flow.

Native inline-PDF pixels remain browser-dependent. The verified download fallback
is independent of the preview, so a browser-specific blank native preview should be
reported rather than treated as proof that the PDF itself is missing.

## How to test it

From a fresh generated project, in the operator's own trusted terminal:

```sh
python3 scripts/ship.py --operator --ui
```

From this repository:

```sh
python3 scripts/dev.py ship --project /absolute/path/to/generated-project --operator --ui
```

The coding assistant may prepare the project and inspect non-secret status, but the
operator owns provider authentication and the final publication approval. Closing
and reopening the wizard resumes the same saved release.

## Completion record

- Guided publishing installed in repository: **YES**
- Validated runtime commit: `b7fbd7e8d15288779daa1f6eb94e6c1e5c0f6be1`
- Generated CRM example parity: **PASS**
- Community release workflow `35992151500`: **PASS**
- Native routing workflow `35992151538`: **PASS**
- End-to-end workflow `35992151531`: **PASS**
- Chromium/WebKit application execution: **PASS, zero skipped application tests**
- Worker dry bundle: **PASS**
- Fresh fictional D1/CRM/PDF journey: **PASS**
- Authorized real Cloudflare single-domain pilot: **NOT PERFORMED BY CI; run through the wizard with a test site/account**
- Optional real Google lifecycle pilot: **NOT REQUIRED WHEN SHEETS IS OFF; wizard guides it when selected**
- NetBean: **OUT OF SCOPE**
- Supported-profile code release decision: **READY FOR GUIDED TESTING**
