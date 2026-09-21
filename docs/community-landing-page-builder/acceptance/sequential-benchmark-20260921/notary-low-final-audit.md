# Notary Low: Final Independent Build Audit

## Result

Published to https://netbean-notary-demo-20260922.shevabody.workers.dev/ with the maintained CRM at `/login.html`. Requested `go.netbean.com` and `crm.netbean.com` remain unconfigured. Verdict: working demonstration with verified core CRM attribution, but not fully accepted or fully configured.

Builder: fresh-context GPT-5.6 Sol Low, agent `01a0c5e2-0f91-7ac3-afe6-0fe0df00033f`, finished 2026-09-21T23:24:29Z. Parent audit began after completion. No parent instructions or corrections were injected during the run. Frozen source f334e43 stayed unchanged. This demonstrates conversation-context independence in a shared local environment, not operating-system isolation or an actual new ChatGPT account.

## Remaining Findings

1. **Buyer copy still contains research narration.** Live examples: "Published professional signals", "Company assertion on the official site", "Current status not independently checked", "The official site describes", and "This demo does not invent a price range". PDF pages 4 and 5 still discuss what the official source publishes. Keep genuine disclosure and qualification, but do not present the research process as the customer's value proposition. The new gate reduced some contamination without eliminating it.
2. **Full-page visual evidence is incomplete.** `public/styles.css:11` applies `content-visibility:auto` with intrinsic placeholder heights to lower sections. Saved full-page images, including the exact reviewed `build/image-review-desktop.png`, contain blank lower sections. Parent scrolling proves the actual content renders and images decode. This is a capture/acceptance failure, not proof that the live page is blank. The report's self-review status is honest, but matching hashes cannot establish that every section was actually inspected.
3. **Mobile submit control needs polish.** At 390px, "Send appointment request" wraps to three lines beside Back. It remains usable but is disproportionately tall. The modal also says "Nothing was sent" before an attempted submission, which can be mistaken for an error state.
4. **Required attribution is not pinned.** Current `attribution_mode: lead` works and the guarded live journey checks all 16 fields in request plus stored first/latest touches. However, configuration omits `analytics.required_attribution_mode`, so the optional drift guard cannot enforce that owner requirement on a later rebuild. This is not a current CRM data-loss finding. See the backend audit for exact paths and remediation scope.
5. **Automatic Free-usage monitoring remains unconnected.** The module is reused, but an actual read-only provider connection/query is not evidenced and is absent from the owner's blocker list. Without it the UI honestly reports unavailable monitoring. It must not be described as an active quota checker.
6. **Phase accounting is not clean enough.** Page completion was recorded at 22:19:02Z, but later work reran image, copy, browser and performance gates. Report 47m00s as the first page checkpoint and 65m18s as external setup plus revalidation, not pure deployment time. Total to completion: 112m27s.

## Verified Improvements

- Four distinct content originals: official proprietor portrait plus three generated, labelled illustrative home/office/care-facility scenes. Logos and certification badges were not needed to reach four.
- Hero image visible at 320, 390, 768 and 1440px; no observed horizontal overflow; all content images decoded after scrolling.
- Cormorant Garamond and Inter match the recorded brand/font evidence and are present locally.
- Pre-submission error messages are hidden. Clicking the backdrop closes the modal.
- Login renders on mobile; its return link targets `https://netbean-notary-demo-20260922.shevabody.workers.dev/index.html`, not the unconfigured domain.
- Five-page PDF exists and all pages were visually inspected. It is legible and no longer tells prospective customers to test or clean CRM records.
- All 210 frozen input files, 37 shared-backend entries and 289 sealed release files match their recorded hashes. Checked verification scripts are unchanged.
- Sealed live journey establishes receipt correlation, 16-field first/latest-touch persistence, authenticated CRM mutation, logout rejection and exact-ID synthetic-lead soft removal. Soft removal does not erase historical test metrics, which the handoff states.

## External Actions Still Required

Custom domains require authorized netbean.com zone onboarding and DNS review. Nameservers suggest Namecheap DNS, not a verified registrar. Follow the builder's DNS/DNSSEC inventory and mail-preservation instructions before any nameserver switch. No CNAME to workers.dev or account upgrade was performed.

Google tracking needs genuine GTM/Ads IDs and label plus the selected consent integration. No ready-to-import container or actual enhanced-conversion delivery is claimed without them. Email invitations/resets need the authorized sending domain and verified receiving inboxes; real inbox workflows have not been exercised. Usage monitoring needs its separate least-privilege read-only connection or an explicit manual-dashboard fallback in the handoff.

## Evidence And Limits

`notary-low-parent-audit/observations.json` and viewport/section/modal/login PNGs record the parent's read-only browser review. The first login attempt timed out waiting for `networkidle`; the second reached the rendered inputs using DOM/content readiness. This alone is not counted as a login defect. Parent browser intercepted non-read requests and submitted no leads. All owned browser processes were closed.

`notary-low-backend-audit.md` records the separate bounded backend review. It read retained release evidence without new network mutations, secrets or a broad retest. `notary-low-token-usage.json` contains measured token/milestone data. Image-provider usage without token events and parent audit/repair work are excluded.

No edits were made from this final audit to the completed notary page or the canonical skill. These findings are a pending source-improvement backlog, not silently repaired evidence.
