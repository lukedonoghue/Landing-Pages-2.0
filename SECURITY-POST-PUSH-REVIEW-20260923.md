# Post-push security and release review — 23 September 2026

## Decision: fixes installed; two remaining defects; production acceptance on hold

Reviewed GitHub `main`: `f7905179b89c6a19f295fdcef2783a63ef56367b`. Its application code is identical to the tested source commit `274a883c95fdc9a108471fc2540ea318db55e6d5`; the only intervening change is `SECURITY-RELEASE-HANDOFF.md`.

The original remediation is now installed. All three existing release workflows passed on the patched source. This review nevertheless reproduced two remaining defects that the existing tests do not reject. Neither finding demonstrates anonymous access to lead data.

This is a review record, not a production release approval. The proposed three-file correction was tested in an isolated local candidate, not committed to the application or deployed by this review. The current handoff still explicitly records production as not deployed; the user's phrase “pushed live” is not independently verified deployment evidence.

## Verified source and CI evidence

The downloaded `community-source-274a883c95fdc9a108471fc2540ea318db55e6d5` archive (artifact `10751000704`) contained 337 tracked reviewable files. All 337 matched the supplied SHA256 manifest. The archive omits font binaries, generated examples and local credentials; no claim of a complete local checkout is made. Generated-example parity was checked by the full-checkout GitHub workflow.

| Existing workflow | Exact run | Observed result |
|---|---:|---|
| Community release | 35862131068 | All jobs passed. Downloaded logs: 304 Python tests and 325 Node/application tests, zero Node failures/skips. Example parity, high-severity dependency gate, Chromium/WebKit launch and Worker dry bundle passed. |
| Native community routing | 35862131001 | Routing/reservations/fallback/safe installation and provider-profile parity steps passed. |
| Current community skill and end-to-end local demo | 35862131059 | All jobs passed. Artifact reports 78 browser checks, 102 journey checks, three rendered PDF pages, layout/performance checks and portable export/import. Publication is explicitly disabled in this synthetic fixture. |

Artifacts inspected: application `10751326894`, Python `10750752625`, demo `10750584016`. These are the user's patched-push runs, independently read during this review, not newly triggered runs from this session. The same Node suite runs twice and the routing suite overlaps the Python suite; do not sum these into a unique-test total.

The local re-review reran the three existing focused security/UI-policy test files: 31 passed, zero failed/skipped. Four additional contract tests against unchanged current source produced 1 pass / 3 failures / 0 skips. The three failures represent two variants of one permission race and one PDF-framing conflict. They do not mean that the existing 325-test suite failed.

## Finding R1 — Concurrent promotion bypasses the owner-only administrator-change check

**Priority: P2 / medium, authenticated concurrency case. Confirmed with a deterministic in-memory database reproduction.**

Location: `skills/community-landing-page-builder/assets/cloudflare/src/team-accounts.js`, `updateUser()`, lines 171–189 at the reviewed commit.

The method reads `protectedTarget`, checks that a non-owner is not changing an administrator, and then reads the target again into `user`. Its final SQL version condition uses the second read's version. If the owner promotes the target from manager to administrator between those reads, the old authorization decision is combined with the newly promoted row's current version. The write therefore succeeds rather than failing closed.

Two synthetic interleavings reproduced this on the actual unchanged function:

| Non-owner administrator request | Interleaved owner operation | Observed final state |
|---|---|---|
| Disable a manager | Promote that manager to administrator after the first read | Administrator disabled; version 3; request succeeded |
| Demote a manager to viewer | Same promotion | Newly promoted administrator demoted to viewer; version 3; request succeeded |

This requires an existing administrator authorized to call this path, including the current-password confirmation at the router, and a concurrent owner promotion. The reproduction tests the real function and SQL with a synthetic owner-promotion interleaving, not a live REST attack. It does not demonstrate anonymous access, owner-account takeover, or a practical high-frequency exploit.

**Correction:** use the same checked row for authorization and compare-and-swap. Replace the second `await targetUser(env,id)` with the previously checked `protectedTarget`. The existing `WHERE version=?` then rejects an intervening change with 409. An atomic role/version predicate is another valid implementation. Preserve owner/self guards, current-password confirmation and all existing role restrictions.

In the isolated candidate, both repros reject the mutation and preserve an active administrator at version 2. Add both interleavings to the maintained suite; ordinary sequential role tests do not cover this race.

## Finding R2 — Public PDF embedding conflicts with response security policy

**Priority: P2 / medium functional release defect. Header conflict confirmed; interactive PDF rendering not independently reproduced in this environment.**

Locations:

- `skills/community-landing-page-builder/assets/cloudflare/src/security.js`, `secureResponse()`, lines 177–187: unconditional `X-Frame-Options: DENY`.
- `skills/community-landing-page-builder/assets/cloudflare/public/_headers`: the same default DENY.
- The template `public/thank-you.html` and shared `scripts/thank_you_page.py` embed the public guide in an iframe.
- `tests/reader-delivery.test.mjs`, lines 27–38 and 67–76: a separate file server omits production security headers; it checks PDF bytes and iframe visibility rather than successful embedded document display, and closes the reader before screenshots.

Calling the real `secureResponse()` with the public guide path and an `application/pdf` response returns status 200 with `X-Frame-Options: DENY`. DENY prohibits same-origin as well as cross-origin framing. The download may work while the intended on-page preview is blocked.

The actual patched CI screenshot `build/layout/screenshots/390x844-thank-you.png` was inspected and still contains a blank reader rectangle. The header conflict is a concrete problem consistent with that screenshot, but this review did not establish that it is the sole cause of the captured blank area: a separate headless/native-PDF-viewer limitation remains possible.

**Correction:** permit embedding only of the intended public brochure PDFs, only by the same origin; preserve DENY and `frame-ancestors 'none'` for authentication, administrator and API surfaces. The local candidate uses a brochure-path plus PDF-content-type plus successful-response check, SAMEORIGIN on the Worker response, and `frame-ancestors 'self'`. For direct static responses, the proposed `_headers` exception removes inherited X-Frame-Options only for brochure PDFs and applies `frame-ancestors 'self'`. Simply adding a second X-Frame-Options value is wrong because matching Cloudflare header rules combine duplicate values.

The candidate passes checks for inherited DENY replacement, same-origin PDF policy, and continued DENY on private routes, non-PDF responses, errors and unrelated PDFs. This is policy-level verification, not a claim that the native reader works in every browser. Add an integration check using the real Worker/static policy and verify visible document content or an accessible fallback, not merely iframe visibility.

Primary technical references, checked during the review:

- MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options
- Cloudflare Static Assets headers: https://developers.cloudflare.com/workers/static-assets/headers/ (matching-rule combination and `! Header-Name` removal).

## Local proposed correction and test results

The conversation's `post-push-proposed-fixes.patch` changes only the maintained `src/team-accounts.js`, `src/security.js` and `public/_headers`. It is an incremental proposal against the already installed code, NOT the previous 89-file remediation. Do not reapply the old package.

| Check | Unchanged reviewed source | Isolated proposed candidate |
|---|---:|---:|
| Existing focused security/UI-policy tests | 31 passed | 31 passed |
| Four new contract tests | 1 passed, 3 failed | 4 passed |
| Modified JavaScript syntax | — | Passed |
| Incremental patch applicability | Passed check against pinned source | — |

Local Node was 22.16.0, below the repository's stated minimum; GitHub's complete suite used Node 24. Only the stated focused tests were rerun locally. The full supported-runtime suite, generated example and real-header browser validation have NOT been rerun on this new proposal.

The evidence package contains the portable synthetic regression file, baseline/candidate TAP logs, exact three-file proposed patch and this report. It contains no production credentials, databases or font files. No application source, test gate or deployment was changed on GitHub by this review document.

## Review coverage and limitations

The review was grounded in the original CRM/Sheets/publishing analysis and current maintained source, including authentication/session/RBAC routes, SQL-backed lead operations, account recovery, webhook dispatch, signed Sheets payloads and Apps Script, downstream erasure, header/host policy, sensitive-action UI behavior, and security-relevant backup/publishing code. Existing focused tests passed for manual privileged-reset restrictions, manager restrictions, step-up, cookies, path normalization, private health proofs, idle expiry, audit events, admission limits, signing/acknowledgements, key versions and erasure behavior. This is not a certification of every historical branch, the legacy branded skill, third-party services or future generated pages.

Only read-only probes of the previously documented Netbean hosts were attempted: health/login and the double-slash administrator path. All failed DNS resolution from this container before receiving an HTTP response; web retrieval was also unavailable. This does NOT show that the sites are down or insecure, and does not establish their current code version. No login guessing, real lead submission, account change, export, deletion, migration or production deployment was performed.

A local Chromium navigation attempt for the PDF fixture failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. The restriction was not bypassed. Existing CI browser evidence was inspected instead; independent interactive validation of the proposed reader fix remains outstanding.

## Operator closure checklist

- [ ] Apply/review the incremental fixes, add the two concurrency variants and real-header PDF checks to the maintained test suite.
- [ ] Regenerate `examples/crm-demo` from the complete repository using `python scripts/sync_crm_example.py`, then run `--check`. Do not import an old client-specific example over the maintained source.
- [ ] Pass all three workflows on the exact corrected candidate, including supported Node, dependency gate, actual browsers, migration tests, full demo and dry bundle.
- [ ] Inspect the open on-page reader in the real supported browsers with the delivered headers; provide an accessible fallback where native PDF embedding is unsupported.
- [ ] Record the actual production deployment ID, source fingerprint and migration 0011 status. A GitHub push alone is not that evidence.
- [ ] Verify intended public/CRM host separation, rejected fallback aliases and normalized administrator paths on the deployed host.
- [ ] Verify the standalone Apps Script version, signing-secret installation/key version and authorized synthetic Sheets create/delete journey.
- [ ] Reconcile historical Sheet copies and pending erasures; verify Google sharing/MFA, Cloudflare access/edge controls, backup handling and actual agent-host restrictions from the existing handoff.

Reviewed code: `f7905179b89c6a19f295fdcef2783a63ef56367b` (runtime identical to `274a883c95fdc9a108471fc2540ea318db55e6d5`). New fixes installed: NO. New-candidate full CI: NOT RUN. Production acceptance: HOLD. Closure owner/date/evidence: TO BE COMPLETED.
