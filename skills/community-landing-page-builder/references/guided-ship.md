# Guided publishing controller

## What the owner does

Build and review the page through the normal community workflow. Ask the coding
assistant to prepare publishing. On the owner's computer, open one trusted local
terminal in the generated project and run:

```sh
python3 scripts/ship.py --operator --ui
```

From the reusable repository, the equivalent is:

```sh
python3 scripts/dev.py ship --project /path/to/generated-page --operator --ui
```

The page asks for a domain and CRM owner email. It derives a site name; advanced
destination settings can override it. Google Sheets is unchecked by default.
Sign in to Cloudflare when asked, choose an account only when it is ambiguous,
allow hosting preparation, and approve the displayed publish/test/cleanup scope.
Account facts that cannot be verified automatically are clearly owner-confirmed.
The browser form never accepts a password or token.

Keep this local window private. Close and reopen the same command to resume. The
wizard does not keep working on a remote service when its operator process has
stopped; its journal enables reconciliation in the next actual run. Closing only
the browser does not cancel an operation already running in the terminal.

## Supported profile

The standard adapter targets **one explicit custom domain in the selected
Cloudflare account, one Worker with static assets, and one D1 binding named DB**.
Use the locked dependency set and supported Node runtime (CI uses Node 24).
The initial operator UI supports macOS and Linux. Staging uses a separate site
and database; changing a label is not isolation. Advanced two-host, Pages-gateway,
external-DNS, static-only and workers.dev-only profiles retain their existing
publisher and return a named action rather than being silently rewritten.
The historical NetBean deployment is unrelated and is never a required test.

This is implementation guidance, not evidence that this candidate has passed a
real Cloudflare/Google deployment. See the root implementation-status file for
actual validation and remaining release gates.

## Coding-agent boundary

The coding assistant may read this non-secret status:

```sh
python3 scripts/ship.py --json
```

Status does not authenticate, read credential files or call a provider. The agent
can finish local research, build work and source-bound QA. When the wizard pauses
for quality or prerequisites, it writes `build/ship/agent-task.json`; the normal
guide exposes a local-repair action. Run the actual checks and repair their real
failures. Never manufacture reports, waive earlier reviews or mark a checklist
item passed because it exists.

Only the human-operated publisher uses Cloudflare authentication, owner access,
Google signing material or private diagnostics. Private owner/Google handoffs are
under `~/.landing-pages-publishing/`, outside the source tree and included in the
generated Codex/Claude deny policy. Existing externally stored owner references
are preserved. Policy text alone is not proof of host enforcement. Keep production
credentials out of an untrusted coding process even when a host ignores project
configuration.

## Execution and persistence

`ship.py` maintains a revisioned non-secret journal under `build/ship/`. Its
exclusive OS lock and HTTP revision compare prevent simultaneous/double-click
execution. File replacement uses the existing atomic, symlink-rejecting storage.
The local web server binds only `127.0.0.1`, uses a random bearer token delivered
in the URL fragment, checks Host/Origin/fetch-site, rejects CORS/chunked/oversized
requests and serves only its own three static assets. It never serves project or
credential files. Actual operations run on one operator thread; refresh does not
spawn a duplicate.

The sequence is:

```text
inputs → prerequisites → Cloudflare identity → hosting consent → configure
→ current QA → optional Sheets → owner confirmations → target preflight
→ source-bound publish consent → recovery point/edge protection
→ guarded publisher → permanent synthetic cleanup → final identity check → receipt
```

AUTO requirements are machine-evaluated from real adapter results. CONFIRM items
retain their owner-attested provenance. AUTO_OR_CONFIRM is used for edge rules
when the available provider authorization cannot inspect/configure them. Empty or
unknown success objects cannot produce a Ready receipt. The machine-readable
policy is `assets/ship/requirements.json`.

The existing `release_state.py` lock, immutable frozen package, migration ledger,
provider version inspection, bounded journey retries and approval checks remain
authoritative. The controller never implements a second raw upload path. A lost
upload response is reconciled against the owned release pointer; no new upload is
assumed. A changed source or destination invalidates consent before deployment.
Once a mutation may have reached the provider, changing source is blocked until
the saved release is reconciled. A new release is possible only from a verified
predecessor, with the previous receipt archived and fresh authorization.

## What is automated

Preparation checks the intended Cloudflare account, detects same-name database
conflicts, invokes the reviewed setup command, synchronizes configuration and
moves the owner-password handoff outside the project. Existing databases require
an explicit identity choice; they are never adopted by name alone. Existing users
and connections are summarized for review, not removed automatically.

Quality runs the current handoff gate, preflight, high-severity dependency audit,
complete no-skip application suite and dry bundle. Failures route back to native
local repair. No UI click turns a failed build into a successful one. The final
publisher repeats its own preconditions on the frozen source.

Recovery records a real D1 Time Travel bookmark and current deployment metadata.
A fresh bookmark is taken immediately before migrations. This is a recovery point,
**not** an encrypted export or a tested restore; automatic destructive database
rollback is not authorized. Restore/reconcile is a separate trusted operation.

Where a suitably scoped API token is already available to the trusted operator,
edge configuration reads the existing rate-limit entrypoint and appends the
supported rule without replacing other rules. Conflicts, insufficient permissions
or plan limits produce one action card. OAuth-only sessions do not expose their
cached token to the bridge. No paid upgrade, new service or broader privilege is
silently enabled. The owner-confirmed fallback is never labelled API-verified.

The guarded live verifier checks the actual deployed page/form/thank-you/PDF/CRM
journey. It now receives the private release-health proof internally, without
making public health responses disclose release metadata. Cleanup then uses the
**exact original synthetic lead ID and stable erasure operation ID**, verifies
full CRM/managed-copy erasure and rechecks deployment identity. Expired previews
are refreshed only after authoritative absence of that same erasure operation;
unknown network outcomes never select another contact. Historical aggregate
analytics can retain the documented test contribution.

## Optional Google Sheets

When selected, the wizard asks only for the spreadsheet ID and clean, versioned
standalone Apps Script `/exec` URL. It creates a private Script Properties handoff
with the per-destination key, preserved key version and spreadsheet ID. The owner
uses Google's own editor/deployment confirmation; no Google password or secret is
pasted into chat or the UI. The supplied `Code.gs` and manifest are named in the
card. A signed read-only probe verifies the actual connection before acceptance.

The probe returns only protocol/key version, event ID and presence/erasure flags
for a UUID supplied by the authorized operator. It never returns contact data and
never creates tabs/rows. HMAC/time/version checks and the Google-only redirect
boundary remain enforced.

After deployment, the existing CRM connection is reconciled by its exact URL and
key version before adding one. A signed probe must prove that the original test
lead arrived **before** normal soft-cleanup can cancel pending jobs. The proof is
retained for interruption recovery. Permanent cleanup verifies absence and the
anti-resurrection tombstone in the actual Sheet. The operator process polls pending delivery/erasure with a bounded budget, including
the scheduled downstream cleanup. Closing and reopening preserves the same operation.
Missing delivery/erasure remains a resumable blocker; it is not silently skipped. Existing arbitrary webhooks may
need their own managed-erasure process and are not certified by a Sheets probe.

## Output and failure handling

`build/ship/release-receipt.json` records the source, destination, exact release,
executed checks, synthetic cleanup, recovery-point type and owner confirmations.
It is produced only after successful final verification. The current guide does
not report publication complete just because the underlying upload verifier has
finished; permanent cleanup and the coordinator's final proof must finish too.

Private diagnostics, credential references, signed previews and connection keys
remain in `.secrets/ship/` or the external private handoff directory. Do not attach
them to feedback, source archives or Git. Native inline PDF rendering remains
browser-dependent; successful download is not evidence of visible preview pixels.
The receipt states this limitation instead of claiming every browser was tested.

## Engineering validation

The Python suite covers journal/resume, revision races, approval expiry, provider
boundary, optional modules, incomplete evidence, cleanup and loopback HTTP guards.
The Node provider suite uses synthetic inputs and an Apps Script VM to check
signed probes and create/erase/anti-resurrection behavior. The Playwright suite
runs the real local UI/controller with an **explicitly stubbed provider fixture**
in Chromium and WebKit; it is not a substitute for a real provider pilot.

Before release: regenerate the maintained CRM example; run the full supported
Python/Node/browser suites and the three existing CI workflows on this exact
candidate; then run an authorized isolated Cloudflare pilot, including interruption
recovery and (separately) real optional Sheets create/delete. Preserve failures and
do not use earlier tester-release results as proof for this new implementation.

## Provider documentation used during implementation

- Cloudflare D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Rate-limit creation API: https://developers.cloudflare.com/waf/rate-limiting-rules/create-api/
- Rate-limit plan availability: https://developers.cloudflare.com/waf/rate-limiting-rules/

These are implementation references, not evidence that a user's account has the
permissions, quotas or configuration required by this specific candidate.
