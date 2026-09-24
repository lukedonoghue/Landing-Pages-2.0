# Guided publishing — implementation and acceptance status

Updated: 24 September 2026.

## Decision

**Implementation candidate built locally; NOT installed on GitHub and NOT release-approved.**
The latest independently read GitHub `main` remains
`5020270c51c41b576c64d5db92106b16a18b3fc2`. The connected account has push/admin
permission, but this session exposes only GitHub read actions. The installed
GitHub integration and its full action catalog were checked. A normal local Git
read also failed with `Could not resolve host: github.com`. No source-write action,
commit, push, workflow dispatch, deployment, real lead, or external account change
was performed. This is not a repository permission denial.

This file travels with the candidate so its status is not confused with the older,
validated tester release. After installation, update the completion record below
with actual commit and CI evidence. Do not reuse the historical 333-test result as
proof for this new implementation.

## Built

- A single `scripts/dev.py ship --project ...` repository entry point and a
  generated-project `scripts/ship.py --operator --ui` launcher.
- A private loopback browser wizard: domain and owner email, optional Sheets,
  account login/selection, preparation consent, automated checks, a small group
  of owner confirmations, explicit publish approval, progress and a release receipt.
- A persistent revisioned state machine, OS lock, double-click protection,
  source/destination-bound consent, interrupted-operation reconciliation, a
  verified-predecessor rule for subsequent releases, and archived receipts.
- A real trusted-operator adapter around the existing guarded publisher. It
  prepares the selected Cloudflare account/Worker/D1, synchronizes configuration,
  checks quality, captures D1 recovery bookmarks, preserves migration/version
  verification, performs the synthetic journey, permanently erases only its
  saved test contact, and checks the final deployment identity.
- Machine-readable AUTO / CONFIRM / AUTO_OR_CONFIRM requirements. Attestations
  never become API-verified facts. Empty or incomplete evidence cannot become Ready.
- Existing-account review without automatically removing users or connections;
  scoped edge-rule inspection/configuration when the operator already has the
  needed API authorization, with a guided owner-confirmed fallback otherwise.
- Private owner and Google handoffs outside the build tree; denial-policy updates;
  no secret fields or private-file serving in the UI; read-only agent status.
- An optional signed Google probe, standalone-script/property handoff, retained
  key versions, connection reconciliation, and create-before-cleanup proof followed
  by verified erasure/tombstone. Pending work is polled with bounded budgets.
- Native guide integration: local failures return to the coding assistant as a
  non-secret repair task. The guide cannot report completion from an upload alone.
- Fresh scaffolds copy the controller, UI, adapter, policies and references.
  Existing project copies are not silently overwritten.
- A repair to the existing live verifier's private release-health proof handoff.
  Release fingerprints remain hidden from anonymous health responses.
- New Python, HTTP, provider/protocol and browser tests. The existing CI workflows
  automatically discover them; their artifacts now include the new UI evidence.

## Actual validation in this session

| Check | Observed result | Scope |
|---|---|---|
| New coordinator, HTTP and scaffold/guide integration | **56 passed** | Actual coordinator and loopback HTTP, synthetic provider fixtures, real fresh scaffold and copied read-only CLI |
| Existing guided controller, authorization, agent security and workflow runner | **42 passed** | Pre-existing regression tests on the modified source |
| Existing native routing/profile tests | **69 passed** | Pre-existing regression tests on the modified source |
| New provider/protocol plus existing focused security/UI tests | **55 passed; 0 failed/skipped** | 16 new offline provider/protocol tests plus 39 existing focused regressions; includes Apps Script VM create/probe/erase/anti-resurrection |
| Existing publisher/release protocol suites | **26 passed / 1 failed** | The failing browser-prerequisite expectation encountered the unsupported local Node runtime first; this is not a passing suite |
| Full community Python discovery | **Incomplete / timed out** | The source artifact omits exact bundled font binaries; failures/errors were recorded before the bounded run stopped. No final full-suite result |
| Actual new browser attempt | **Blocked** | `agent-browser` executable absent; installed Chromium navigation failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. No policy workaround, screenshot-based acceptance, or browser pass claimed |
| New Chromium/WebKit CI test | **Written, not executed here** | Real UI/controller with explicitly stubbed provider calls, not a real deployment |
| Full Node/Miniflare, Worker bundle, fresh full demo and dependency audit | **Not verified for this candidate** | Locked project dependencies/browser runtime unavailable here; no historical result substituted |
| Full generated-example parity | **Pending complete checkout** | The review artifact omits the generated example and font binaries. The installation helper regenerates it from a complete checkout |
| Cloudflare and optional Google pilot | **Not run** | Requires an authorized isolated account/site and the real provider environment |

Local runtime: Node 22.16.0, Python 3.13.5. The release CI uses Node 24 and Python
3.12. The minimum publisher runtime is Node 22.19; it was not weakened to make a
local test pass. Counts are reported by suite; do not combine historical runs,
retries or overlapping focused tests into an inflated total.

The package also includes syntax, baseline-manifest and clean patch-application
checks. Those checks validate the candidate's integrity, not provider behavior.

## Scope and deliberate boundaries

The standard adapter currently covers **one custom domain, one Worker and one D1
CRM on macOS/Linux**. Staging requires a separately bound site/database. Split
public/CRM domains, Pages gateways, external-DNS profiles, static-only and
workers.dev-only profiles keep their advanced publishing path; they are not
silently collapsed or claimed as wizard-certified. NetBean is unrelated.

A D1 Time Travel bookmark is captured before migrations. This is a recovery point,
not an encrypted SQL export or proof of a successful restore. Automatic destructive
rollback is intentionally not performed.

Cloudflare account MFA, privacy/retention choices, trusted-host enforcement and
Google sharing/ownership are owner confirmations where the APIs cannot establish
them. A scoped API token is not extracted from Wrangler's OAuth cache. If edge
configuration cannot be automated, the UI shows one guided action and records its
confirmation provenance. Other existing account rules and paid plans are untouched.

Google still requires its own standalone Apps Script editor/deployment approval.
This optional path provides the files, private properties and signed verification;
it does not claim a nonexistent one-click Google authorization integration.

Native PDF preview pixels remain browser-dependent. The receipt does not equate a
successful PDF download with universal inline preview rendering. Historical
aggregate analytics may retain the explicitly disclosed synthetic-test contribution.

## Installation and remaining acceptance

The supplied `install.py` verifies the exact base and file hashes, applies the
candidate without resetting work, and regenerates the CRM example from the full
checkout. Its explicit validation option runs the supported local release checks;
its explicit commit/push option stops unless validation passed. It cannot turn
missing credentials, an unavailable runtime or failed tests into success.

After repository installation, all three existing CI workflows must pass on the
actual new commit. The new UI tests must execute in both browser engines with zero
skips. Then use an isolated authorized Cloudflare project to exercise the real
wizard, including interruption/resume and an optional separate Sheets lifecycle
pilot. Existing production account safety conditions remain in force, but ordinary
users interact with guided cards rather than the engineering checklist.

## Completion record — update only from evidence

- Candidate installed in repository: **NOT INSTALLED IN THIS SESSION**
- New commit / branch: **PENDING**
- Complete-checkout generated example: **PENDING**
- New community-release workflow: **PENDING**
- New native-routing workflow: **PENDING**
- New end-to-end-demo workflow: **PENDING**
- Chromium / WebKit wizard execution and visual review: **PENDING**
- Authorized single-domain Cloudflare wizard pilot: **PENDING**
- Optional real Google create/delete pilot: **PENDING / NOT REQUIRED WHEN DISABLED**
- Supported-profile release decision: **CANDIDATE, NOT YET ACCEPTED**
