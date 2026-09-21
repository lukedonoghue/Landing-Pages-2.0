# Bookkeeping by Beks: Independent Page and CRM Audit

Date: 21 September 2026. Reviewer: parent audit, after the independent builder completed. Backend review: separate fresh-context GPT-5.6 Sol high-effort reviewer.

## Verdict

**A working demonstration, but not a passed community-skill acceptance run or a paid-traffic-ready funnel.** The live form and basic CRM journey work. The PDF exists and is readable. The remaining problems are substantive: attribution is disabled, brand typography diverges, responsive image sizing is broken, copy still reads like research narration, and custom-domain/email/tracking setup remains incomplete.

This report does not change the page, CRM, copy, or frozen skill used for this run. The only reusable-skill changes in this task are the specifically requested blocker/domain handoff process. No audit-driven creative or backend fix was applied. One clearly synthetic audit lead and one note were added; no real business received enquiries, calls or email.

Live page: https://bookkeeping-by-beks-demo-20260921-r1.shevabody.workers.dev/

CRM: https://bookkeeping-by-beks-demo-20260921-r1.shevabody.workers.dev/login

Requested destinations, still pending: go.netbean.com and crm.netbean.com.

## Highest-Priority Findings

### F01 / P1: Campaign attribution is not delivered in this release

**Independently reproduced, not just inferred from the code.** I opened the live page with nine UTM fields and six click IDs, submitted the popup form, received HTTP 201, logged into the CRM, and read the stored record back. Every supplied tracking value was absent. Both attribution touches were empty, source/device were Unknown, and the details dialog said no campaign attribution was recorded.

Test values covered utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, utm_source_platform, utm_creative_format, utm_marketing_tactic, gclid, gbraid, wbraid, fbclid, msclkid and ttclid. Dclid is supported in code but was not part of this live URL.

**Root cause:** `src/site-config.json:6` disables analytics and `:72` disables attribution. The page's `LeadFunnel` constructs an empty tracking payload before submission; the backend also enforces that policy. This is not the CRM losing values after receiving them. It is a configuration/acceptance failure against the requested outcome. Missing Google Ads credentials need not imply disabling the separate first-party lead-attribution mode already supported by the code. The appropriate privacy configuration still needs an explicit decision; this audit did not override it.

**Acceptance gap:** the release verifier accepts the expected absence of tracking in disabled mode. That can be a correct negative test, but it is not a positive test of the requested attribution feature. The initial builder lead also has empty tracking. The dashboard shows 2 enquiries and 0 measured conversions, which matches this configuration rather than a failed count calculation.

Evidence: `beks-audit-evidence/observations.json`, `crm-detail-check.json`, `crm-detail-1440.png`.

### F02 / P1: Responsive images retain their source-pixel heights

**Visually and geometrically reproduced on the live page.** The cleanup picture is 346 x 1086 CSS pixels at 390px viewport width. The guide cover occupies 304 x 1584 pixels. At 1440px, those boxes are 567 x 1086 and 442 x 1584. A small brochure preview creates nearly two mobile screens of mostly white space.

**Root cause:** HTML gives the images explicit source dimensions (`public/index.html:56`, `:98`). CSS changes width and sets aspect-ratio without clearing the presentational height (`public/styles.css:80`, `:107`). With both width and height fixed, aspect-ratio does not provide the intended responsive height. The cleanup image uses cover and loses much of the horizontal scene; the guide uses contain and acquires extreme blank letterboxing.

**Required outcome:** preserve intended ratios using an appropriate automatic height or a deliberately sized frame; inspect the loaded images at actual mobile and desktop sizes. This is not a request to shorten substantive content.

The builder's own layout report recorded severe crop warnings, including 76-78% on mobile, but visual acceptance still passed. That warning was not meaningfully resolved.

Evidence: `followup.json`, `section-services-1440.png`, `section-guide-390.png`, `section-guide-1440.png`.

### F03 / P1 for copy acceptance: The copy is still research narration, not a strong sales argument

The opening identifies the service and there is a legitimate potential advantage: bookkeeping plus optional KPI/dashboard support. However, much of the page describes what the researcher found instead of making that advantage clear to the buyer.

Examples from the built page:

- The hero promises a "clearer view of what deserves attention", which remains abstract.
- The first explanation says "Those published roles support a practical combination".
- A benefit starts with "Work begins with the accounting platform the business publicly identifies as its preference."
- The dashboard section says the business "also publishes" services and describes "framing the operating questions".
- The mechanism section repeats the platform preference instead of adding a concrete buyer consequence.

These violate the skill's own `voice_and_density` rejection of researcher narration and weaken `outcome_and_mechanism` and `headline_story`. Several sections repeat clarity, questions, attention, and conversations without adding much persuasive detail. The page is not simply too short; its argument is repetitive and its visual height is inflated.

**Required outcome:** retain verified facts and honest scope, but explain concrete buyer situations and the value of the service mix in normal customer language. Do not invent results, deadlines, included dashboards, reviews, guarantees, or exclusivity. The independent-demo warning is necessary, but it does not require every paragraph to sound like a source inventory.

The official source supports the bookkeeping service mix, conditional cleanup discount and service area. That is enough to build a clearer argument without inventing outcomes. Source: https://bookkeepingbybeks.com/ (checked 21 September).

The builder recorded self-review, not independent editorial review. The evidence validator can check quotations and freshness; it cannot establish that the explanation is persuasive. The saved pass therefore does not settle this finding.

### F04 / P2: The rendered fonts are not the researched brand fonts

The source extraction actually identified Lora, including rendered font evidence. The strategy said Lora would be used for headings and body. The built CSS uses Georgia for headings and `Inter, system-ui` for body (`public/styles.css:15`, `:31`). No Inter font file is shipped, so the body falls back where Inter is not installed.

There is a documented reason in `docs/DESIGN-SYSTEM.md:23`: avoiding a third-party font request. Thus the substitution was not completely undocumented. But no evidence shows that a permitted self-hosted Lora implementation was unavailable. The strategy and `build/reference-fidelity.json:32` still claim the source font direction was preserved. Those records contradict the actual result.

**Required outcome:** use the researched fonts, or substantiate and consistently document an allowed exception. Do not label a generic serif as the brand font.

### F05 / P2: Small-screen modal close button overlaps its eyebrow

At 320 x 740, the X overlaps the last word of "Synthetic demonstration form". The close button is absolutely positioned; the eyebrow does not reserve its space. The title reserves right padding, but the preceding label does not (`public/styles.css:135`, `:137`).

The modal still opens, scrolls, validates and closes. This is a visible fit defect, not a total form failure. A zero-horizontal-overflow check did not catch it.

Evidence: `modal-320.png`. At 390px the same first step is readable.

### F06 / P2: Mobile hero spends nearly the whole first screen on a long headline

At 390px, the large headline wraps into seven lines; the body, main CTA and secondary link consume the remainder. The next section is not visible in the first viewport. At 1440 x 900, only a thin sliver of the next band appears, not useful next-section content.

The burgundy is grounded in the source brand. My visual judgment is that the dated feeling comes more from very heavy oversized Georgia, pale washed-out imagery, dusty surfaces and loose spacing than from the brand hue itself. This is an editorial/design finding, not a claim about measured conversion rate.

The font and image-sizing fixes above should precede any attempt to fix this by changing the brand palette.

### F07 / P2: Phone coverage misses the header/hero requirement

The verified public number appears only near the final CTA. It is absent from the header/hero and there are no tel links (`public/index.html:120`). The demo explicitly must not initiate real calls, so non-clickability is a legitimate safety choice for this run. It does not explain why a clearly labeled, non-actionable published number could not be shown early. Do not count the normal early-contact requirement as passed.

### F08 / P2: CRM login's return link points to an unavailable hostname

The working workers.dev login has a "Visit the landing page" link hardcoded to `https://go.netbean.com/` (`public/login.html:13`). That host is still pending setup. This is a broken fallback navigation choice, separate from the legitimate DNS blocker. The live fallback needs working navigation until the requested public hostname is verified.

### F09 / P2: Account workflow reliability gaps

The separate code audit found two code-derived defects that were not exercised with real email:

- Concurrent administrators can approve one reset request and dispatch more than one reset email before the request is claimed (`src/team-accounts.js:134`). Version checks limit token use, so this is primarily reliability/confusion risk, not a demonstrated authentication bypass.
- A failed invitation can leave an invited user with a unique email/username but no supported correction or removal path for an address typo (`src/team-accounts.js:89`). The local tests confirm the retained row; delivery failure and recovery are separate concerns.

These need targeted tests before enabling email. No real emails were sent by this audit.

### F10 / P2: GTM activation instructions contain a broken command

`docs/TRACKING-SETUP.md:19` uses `--out`; the actual helper accepts `--output`. A beginner following the supplied command will fail before generating an import. No import was delivered in this run because real IDs are missing. Provider activation is pending, but the documented command is independently wrong.

### F11 / P2: Handoff does not meet the beginner workflow

The builder named domain/email/GTM blockers but did not deliver registrar-specific numbered setup instructions. The owner's password was pointed to a hidden local file without an in-app delivery method. The final handoff did not provide a usable activation sequence for a nontechnical owner. `docs/QA-REPORT.md` also retains pre-deployment status and an older 220-test count despite the later 224-test/live release evidence.

The blocker/domain process is the one item corrected in the reusable skill during this task. The frozen builder output remains unchanged so the acceptance evidence is preserved.

### F12 / P3: Scheduler documentation disagrees with implementation

The API contract says one-minute retry/cleanup scheduling; Wrangler runs every five minutes. Initial lead processing still executes immediately. Resolve the contract mismatch before promising retry timing.

## Configuration Limits, Not Proven Broken Features

- **Custom domains:** not attached; local host-routing tests do not prove live DNS, TLS, cookies or redirects across go/crm.netbean.com.
- **Advertising:** no real GTM/Google Ads IDs or live provider verification. Enhanced conversion hashing/event logic exists in tests, but real Google/Meta/Microsoft delivery was not tested.
- **Email:** invitations, owner email verification and email reset cannot complete until the sender/recipient configuration exists. The owner currently has no registered email. The reset screen accepts a request and returns a generic response, which is appropriate to avoid account disclosure, but is not proof of delivery.
- **Roles:** admin, manager and viewer exist in code/tests. Only owner/admin was tested live because new email-based accounts cannot be onboarded yet. The user's requested manager definition was full access except user administration and other-user resets, so broad manager settings access is not automatically a spec violation. Permanent erasure and outgoing-webhook powers deserve an explicit policy decision.
- **Free plan:** architecture and static tests are compatible with the intended free-only setup. This audit does not independently certify billing state or guarantee that future traffic remains within quotas.

## What Passed Independently

| Area | Result and evidence boundary |
| --- | --- |
| Page widths | Live captures at 320, 390, 768, 1366, 1440 and 1920px; no document-wide horizontal overflow |
| CTA behavior | All five enquiry buttons opened the same modal at each width; zero scroll movement on opening; Escape returned focus |
| Empty validation | Step 1 did not advance with required values absent at all six widths |
| Submission | One synthetic lead accepted with HTTP 201 and correlated receipt/database record |
| Images | Three different generated photographs plus one distinct guide-cover screenshot; all loaded after proper lazy-load/decode waits; no duplicate content image |
| Image relevance | Desk, receipt organization and financial discussion relate to bookkeeping; they are disclosed as illustrative, not business proof |
| PDF | Live HTTP 200 application/pdf; all four downloaded pages rendered and visually reviewed; no clipping or text-over-text collision |
| PDF usefulness | Relevant month-end checklist and notes; spacious but usable, no fabricated price or outcome |
| Link isolation | Public landing links remain internal/download/login; no link to the business's original website |
| Typography prohibition | No U+2014 em dash found in public source files |
| Authentication | Wrong password rejected; owner login succeeded; anonymous admin API returned 401; logout returned to login and revoked access |
| Cookies | Secure, HttpOnly, host-only, SameSite=Strict observed |
| CRM read/update | Lead list/details usable; own synthetic stage change HTTP 200 and persisted; note HTTP 201 and read back |
| CRM information density | Main table uses one compact Source column; full attribution belongs in detail; current values are Unknown due to disabled capture |
| CRM responsive | Desktop and 390px detail views readable; mobile table uses an intentional scroll region |
| Backend regression | Separate reviewer ran 75 relevant non-browser tests, all passed; this does not replace missing concurrent-email/provider tests |

## Evidence Corrections and Remaining Test Gaps

Early full-page captures occasionally showed unloaded lazy images. Explicit per-section decoding confirmed the files load; these were not recorded as missing-image bugs. The severe fixed-height geometry remains after loading.

Early CRM screenshots caught transient loading states. Waiting for initialized application state and the actual lead control produced the working list and details. There is no supported finding of a permanently empty CRM.

The parent harness initially expected `/thank-you.html`; Cloudflare canonicalized it to `/thank-you`. That timeout was an audit-harness mistake, not a site failure. Subsequent checks reused the same synthetic lead, not a duplicate. A note-button label mismatch was also corrected in the harness before testing the real `Save note` control.

I did not change the real owner password, trigger emergency CLI recovery, create email-backed manager/viewer accounts, test actual provider email, migrate DNS, send advertising events, configure external webhooks, execute destructive erasure, or rehearse disaster recovery. Those remain unverified live. Builder-reported Lighthouse 100 and WebKit passes are preserved as builder evidence; I did not repeat those expensive suites. The independent audit used Chromium.

The original run was fresh-context but received earlier operational resource-safety interventions. It is not evidence of fully unassisted orchestration on a clean account.

## Process Changes Applied Now

Only the community fork was changed:

1. The main skill now requires the builder itself to send blockers and numbered instructions at local final, without an orchestrator prompt.
2. Domain handling preserves supplied hostnames, distinguishes registrar from DNS provider, and follows verified provider instructions.
3. The Free-plan path protects existing website/mail DNS, requires approval for nameserver migration, and never invents assigned nameservers or a workers.dev CNAME shortcut.
4. A compact owner-handoff artifact/check rejects missing steps, omitted requested hostnames, unsupported verified/deferred states, and a claimed complete status with unresolved blockers.
5. The checker explicitly validates structure only. It does not prove DNS, instruction accuracy, message delivery, or guarantee LLM compliance.

Validation: 10 new focused tests passed; existing 96 community Python tests passed; standard skill validation passed; diff whitespace checks passed. No new full independent build has yet tested the handoff behavior. That is the next acceptance proof, not something this report claims.

Luke's original skill and README-BOHDAN.md were not edited. Audit findings F01-F10/F12 have not been applied to the page or skill in this task.
