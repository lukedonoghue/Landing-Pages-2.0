# Clarentis landing page strategy

Research date: 2026-09-20. Primary source: https://clarentis.co.uk/ (official single-page site, viewed in text and rendered at 390 x 844 and 1440 x 900). The supplied project was blank.

## Decision

- Buyer: UK startup founder, sole trader or owner of a small limited company whose records, tax submissions or payroll need dependable attention. Likely comparing providers and assessing fit, scope and price. Traffic intent is inferred from the official offer; no keywords or campaign data were supplied.
- Desired action: email Clarentis to request a fixed-fee quote and arrange a free initial consultation. The page does not collect lead data itself.
- Offer: practical accounting, tax and bookkeeping support, with an initial consultation and a scoped fixed-fee proposal before work begins.
- Mechanism: discuss business needs and deadlines, agree scope and fee, organise HMRC/software access and records, then provide the selected ongoing support. This follows the official onboarding sequence.
- Main objection: uncertainty about cost and exactly what will be handled. Show the official indicative ranges and place their volume/complexity qualification beside them.
- Trust anchor: public fee guide and a stated fixed-fee proposal before work starts. No ratings, named people, professional credentials or testimonials were verified. None are used.
- Geographic fit: the official page says UK startups, sole traders and small limited companies. It does not publish a narrower service area.

## Source conversion contract

The source's dominant action is `Request your fixed-fee quote`, an ordinary `mailto:info@clarentis.co.uk` link. A secondary free consultation CTA also emails the same address. No required fields, consent checkbox, form success state, booking calendar or response-time promise were present. The contact section invites the visitor to mention their business type and support needed. The public enquiry phone is `07467 474356`. The new page uses the exact quote CTA label at every main entry point and a direct email destination; the visitor sends from their own email application. No live enquiry was sent during QA.

## Visual direction

Three adjectives: **clear** (legible type and explicit fees), **assured** (generous spacing and restrained contrast), **human** (natural illustrative scenes instead of abstract finance graphics).

The official logo is a navy and teal mark on white, retrieved from https://clarentis.co.uk/clarentis-logo.png. Source first-screen colors observed in `brand.json`: navy text `rgb(8,41,74)`, teal action `rgb(21,154,170)`, pale page `rgb(246,248,251)`, white surfaces. Applied colors: navy `#102d45` for ink and the closing band, teal `#137f8c` for actions with AA contrast, white `#fff` for most space, cool `#f2f7f7` and warm paper `#f7f4ed` for limited section contrast. The exact logo pixels remain untouched. A ruled fee ledger and small teal keys are motifs tied to accounting work.

No formal brand guide was found. The official rendered H1 and visible lead both declare `Inter, ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif` and render with `.SF NS` on the inspected Mac because Inter is not loaded. The applied stack preserves that declaration; no font substitution is intended. Letter spacing is reset to zero for readability. The old oversized, tightly tracked H1, gradient wash and offer card are not carried over.

The hero uses a generated still life with a genuinely clear left side for copy and accounting objects on the right. Three further generated scenes support bookkeeping, deadlines and the initial conversation. They are illustrative, never client or team proof. The logo is the only usable official image. Motion is minimal and respects reduced-motion preferences.

## Coverage map

| Buyer question or source beat | Source | Specific answer in final page | Final section | Disposition |
| --- | --- | --- | --- | --- |
| Is this for my business? | Official hero | UK startups, sole traders and small limited companies | Hero, fit strip | Preserved |
| What is the first step? | Official startup offer and contact | Free initial consultation reached by email | Hero, process, close | Preserved |
| What will it cost? | Official indicative fee guide | Six published ranges, with scope, transaction volume and complexity caveat | Fit strip, fees | Preserved |
| What work can you do? | Official six-service list | Bookkeeping, Self-Assessment, VAT, Corporation Tax, company registration and payroll with sourced task detail | Service sections | Preserved |
| How do you start and continue? | Official onboarding | Consultation, proposal, setup, then selected monthly support | Process | Preserved |
| Can I contact a person? | Official contact | Public phone and email visible near top and at close | Header, close | Preserved |
| Is there external proof? | Official site | No testimonial, named team or credential published; fee and process transparency are the available decision aids | Fees, process | Omitted unsupported proof |
| What about legal/tax advice from this page? | Official footer | General information disclaimer | Footer | Preserved |

Benchmark comparison: Blue Mountain was unavailable in the browser research tool; the attached skill's distilled conversion guidance was used for coverage. Clean Slate's publicly visible page was inspected for confident hierarchy and media pacing, not for its claims or styling. The Clarentis result uses fewer images and proof items because the client publishes no customer evidence, while retaining the relevant offer, scope, fee and process questions.

Optional modules: none. No brochure, backend, analytics, CRM or deployment was requested. Cloudflare connection remains with the user after local delivery.
