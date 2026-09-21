# Chrome recovery and domain follow-up

## Confirmed browser incident

The user reported personal Chrome profiles would not open. All browser tests were paused. Read-only process inspection found three headless automation roots, each parented to PID 1 and using temporary profiles:

- PID 774, started September 18, working directory `community-acceptance-20260918/runs/website-only-r1`.
- PID 3367, started September 18, working directory `community-acceptance-20260918/runs/website-only-r2`.
- PID 20038, started September 19, working directory `community-acceptance-20260918/runs/website-only-r7`.

No ordinary main Chrome process was running. No Singleton locks were present in the normal Chrome data directory. Only the three proven abandoned test roots received TERM; 774 and 3367 ignored it and received KILL. Normal Chrome then launched as PID 4601 without automation flags. The user confirmed: "Yes, it opens now". No personal profile data, cookies, history, preferences or lock files were changed.

The evidence strongly connects the launch problem to abandoned test instances of the installed Chrome app. It does not establish the exact internal macOS/Chrome launch-dispatch mechanism. The canonical browser guide now prefers managed test browsers, isolated profiles, finally-close and run-owned process cleanup. The active builder was told to resume only with a managed test binary. Installed managed runtimes include Chromium/headless-shell 1243 and WebKit 2359.

## Domain and CRM follow-up

The user requested automatic Cloudflare setup where authorized, registrar/DNS-specific owner instructions, paid-page and CRM subdomains, login/logout/recovery tests, and full campaign attribution. No owned custom domain was supplied; `clearance.com` was an example, not an authorized DNS destination. The present demo remains workers.dev scoped.

The canonical domain handoff documents registrar versus authoritative DNS, current Workers custom-domain requirements, nameserver versus eligible CNAME setup, preservation of existing website/mail records, and actual-host verification. Two-host routing is not yet implemented or validated by the single-origin publisher and must not be claimed complete. The existing forgot-password feature is owner-assisted recovery, not self-service email reset. These distinctions are implementation gaps, not user mistakes.

Privacy controls still apply to click IDs and UTMs. Sharing a parent domain does not share browser storage automatically. CRM attribution should be proven by matching form-captured first/latest touches with the database-backed lead.

## Source changes and verification

The canonical tracker, lead normalizer/serializer, visit normalizer and CRM detail display now retain `utm_id`, `utm_source_platform`, `utm_creative_format`, `utm_marketing_tactic` and `dclid`, alongside the previously supported campaign fields. The detail display also explicitly includes GBRAID and WBRAID. Unknown URL fields remain excluded; consent and opt-out behavior is unchanged. Attribution is stored in the existing JSON field, so no destructive database migration is required.

Four UI test suites no longer select the installed personal Chrome application automatically. They use the managed Playwright binary or an explicit CHROME_BIN override. Pinned dependencies were installed locally after the first run exposed missing esbuild and skipped browser tests; that first attempt is not a pass. The complete focused rerun passed 72 tests, zero failures and zero skips, covering Worker/D1 persistence, deduplication, privacy, hashed events, form UI, CRM filters, date picker and performance charts. A subsequent focused traffic test adds DCLID classification and normalization-bound checks.

These canonical changes apply to future builds. The frozen Clarentis build does not inherit them silently. Its deployment evidence must identify its own source revision and any assisted recovery changes.

## Requested compact CRM layout

The user's next explicit request adds the expanded attribution fields and compact source-only display to the current assisted CRM build as well as the reusable skill. The lead table now contains Contact, Phone, Stage, Source and Received. Campaign names, landing paths and custom form-answer snippets are removed from the list. The enquiry detail retains all form answers, source context and collapsed First touch / Latest touch groups with exact field names and values. Legacy flattened records use Recorded campaign instead. No data is discarded merely to simplify the interface.

Source labels distinguish Google CPC, Google Paid, Google Organic, Meta Paid Social and Microsoft CPC. A bare FBCLID does not become a paid claim. Six managed-browser interface tests passed without skips, including source semantics, exact campaign values, keyboard expansion, modal dismissal and long-ID containment at 1440, 390 and 320 pixels. The parent inspected the actual desktop table and desktop/mobile expanded-detail screenshots. The synthetic fixture uses reserved contact data only; screenshots contain no real leads. Evidence is in `acceptance/crm-attribution-layout-20260921/`.

The parent handed the canonical source changes to the active builder as an explicit assisted integration before its final snapshot. This is not represented as part of the initial independent success.
