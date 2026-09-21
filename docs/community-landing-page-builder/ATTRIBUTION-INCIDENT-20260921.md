# Live Attribution Incident

## Report And Actual Test Scope

User reports no attribution stored from the live Clarentis demo, and no visible cookie/optional-data choice. The supplied URL contains nine standard UTM keys plus gclid, gbraid, wbraid, fbclid, msclkid and ttclid. All values are synthetic test strings. The exact original submission has not yet been identified.

The deployed client/server configuration uses attributionMode=consent. Browser capture deliberately sends empty first/latest touches until optional-data choice is true. Server independently enforces the same policy. This must not be described as the user failing to click a button: the reported absence of the choice still needs a fresh-browser and saved-preference investigation.

The prior build/verify-owner-attribution.mjs explicitly waits for a visible fixture.selectors.consentAccept and clicks it before submitting (lines 115-117 at investigation time). Its 27 passing checks proved the opt-in path, not automatic attribution for a new visitor with no choice. Earlier broad acceptance wording was insufficiently qualified.

## Evidence So Far

Sol's initial live synthetic reproduction confirmed no-choice POST 201 with attribution_consent=false and no campaign keys, followed by authenticated CRM detail showing no keys and unknown source. Consent-granted POST included all 15 previously supported keys. At this checkpoint its downstream verification was interrupted by a test harness selecting a hidden lead-search input. That harness failure is not evidence of missing stored attribution. Full stored-record and rendered-detail checks remain pending.

Concrete additional gap: ttclid is absent from the browser and server allowlists. It cannot be stored by the current release even after opting in. This explains one missing field, not why every field was empty. Sol is adding explicit TikTok field coverage to canonical and generated runtime code. Arbitrary URL query parameters must not be copied wholesale into CRM.

## Authorized Correction

The user now requests no cookie prompt. For this isolated disposable demo, use first-party lead attribution independently of optional visitor/ad measurement: attributionMode=lead, analyticsMode=disabled, advertisingUserDataMode=disabled. Keep browser privacy opt-outs, truthful privacy disclosure and no third-party advertising traffic. This is not a claim that all US businesses can disable privacy controls or that session storage is a cookie-free compliance exemption.

Reusable skill must separate CRM source capture from optional advertising and choose policy for the actual deployment, not globally disable consent because clients are mostly US-based. California opt-out obligations can apply: https://www.oag.ca.gov/privacy/ccpa . No blanket legal compliance claim is made.

## Acceptance Required

1. Diagnose absent old prompt without assuming user error; distinguish fresh context, saved choice, browser opt-out and load failure.
2. Exact supplied campaign values preserved through browser payload and authenticated CRM detail, including ttclid, with no choice required in the new demo mode.
3. Compact list source remains Google CPC; all detailed fields visible in expanded submission, not extra list columns.
4. Browser opt-out remains respected. Disabled optional measurement and ad matching do not fire third-party tags.
5. Canonical regression proves the explicit supported-field contract, privacy behavior and UI detail rendering.
6. Publish only the isolated demo via a new source-bound release, without accidentally deploying unfinished team-role work. Record version/release and post-deploy evidence.

Current status: investigation and fixes in progress; no corrected live release claimed. Implementation/testing/deployment assigned to GPT-5.6 Sol extra-high; Astra only orchestration, review and checkpoints for this incident.

## Live Reproduction Completed

Sol's recovered test report completed at 2026-09-21T10:39:56Z with status pass. With consent granted, all 15 previously supported values were present in the POST, authenticated stored detail and rendered CRM. The list displayed Google CPC. No-choice remained empty at all boundaries. This isolates the reproduced all-empty behavior to configured consent-dependent capture, not loss of populated values inside CRM. It does not identify the original user's record or explain their missing prompt.

The user clarified that the skill should not implement a custom on-page consent manager. Required external consent tooling should be integrated separately. The correction must not interpret absence of a banner as permission for optional advertising or auto-grant required consent. A disabled/external consent UI mode should avoid custom UI injection, while provider signals and privacy enforcement remain separate from CRM attribution.

The exact-URL capture report reproduces 0 of the supplied 15 keys without consent and 14 of 15 with consent (ttclid absent). In a fresh managed browser, the old banner and both buttons were visible, with no failed requests or console errors. The user's absence-of-banner report was therefore not reproduced in that fresh context. Saved preference or browser opt-out are possibilities, not established causes for the user's actual browser.

Parent source review caught two issues before release: stored prior consent must not load GTM when tracking is disabled or an external provider has not supplied its current signal; and returning a new tiktok source enum would violate existing D1 CHECK constraints. Sol was asked to test both and preserve schema compatibility for ttclid-only leads. Mixed test links containing gclid must not be the only TikTok coverage.

## Source Checkpoint Before Deployment

At 7% account usage remaining, canonical source is checkpointed with ttclid support, explicit consent UI modes, fail-closed external-provider initialization and disabled-tracking tag protection. TikTok-only leads retain schema-compatible other/paid dimensions and a descriptive UI label, rather than changing old database constraints. Empty referrer values now remain empty instead of resolving to the current URL.

Sol reports passing focused canonical backend 25/25, client 3/3, traffic 2/2; generated backend 25/25, attribution 5/5, CRM UI 1/1. A full new suite and post-deploy acceptance are not claimed. Runtime local configuration is updated; release copy/gate evidence is being refreshed. Reusable narrative instructions and final live proof remain in progress. This checkpoint is not a deployment declaration.
