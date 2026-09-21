# Clarentis demonstration strategy brief

Retrieved: 2026-09-21

## Decision summary

- Buyer situation: A UK startup, sole trader or small limited company needs help bringing business records, tax work and recurring filing tasks under control.
- Likely decision stage: Problem-aware and comparing scope, price and approach. The published price guide means many visitors are beyond general education and want to check fit.
- Desired action: Request a fixed-fee quote through a short enquiry form.
- Offer: A free initial consultation followed by a scoped fixed-fee proposal.
- Delivery mechanism: Clarentis first reviews the business type, deadlines, current records, transaction volume and complexity, then proposes a clear scope and fee before setup and ongoing support.
- Strongest trust anchor: Specific published services, a concrete four-step onboarding process and indicative fee ranges on the official site.
- Primary objection: Uncertainty about cost, the state of existing records, and whether support covers the required tax or payroll work.
- Traffic intent: Inferred from the offer and audience, not from ad-account data: small business accountant UK, fixed-fee accounting, sole trader bookkeeping, startup accountant, VAT support and payroll support.
- Geography: The official page addresses UK startups, sole traders and small limited companies. No narrower service area is published.
- Public enquiry phone: 07467 474356, displayed on https://clarentis.co.uk/.

## Source conversion contract

| Item | Source behavior | Demonstration behavior |
| --- | --- | --- |
| CTA | Request your fixed-fee quote / Free consultation | Request your fixed-fee quote |
| Offer | Free initial consultation, then scope-dependent fixed fee | Preserved |
| Conversion type | Email link to info@clarentis.co.uk | User-requested same-page modal form to an isolated D1 CRM |
| Required information | Email copy asks for business type and support needed | First name, email, phone, business type, service and preferred contact method |
| Consent | No source form consent | Explicit synthetic-test confirmation; optional analytics consent is separate |
| Follow-up | Arrange a free initial consultation | Demo receipt only; no message goes to Clarentis |
| Destination | Real Clarentis email | Separate demonstration Worker and D1 database |
| Success | Email app / manual send | Confirmed CRM receipt, then demo thank-you page |

The user explicitly requested the form and CRM, so replacing the source mailto action is authorized. The offer and practical next step remain intact.

## Brand and design direction

- Visual adjectives: clear, capable, calm. Clear through direct headings and open layouts; capable through specific service and process detail; calm through quiet neutral surfaces and restrained teal accents.
- Verified source palette: navy `#08294a`, teal `#159aaa`, pale teal `#eaf7f8`, off-white `#f6f8fb`, muted blue-grey body text around `#5e6f82`.
- Applied palette: exact navy and teal for brand/action roles, near-white and cool grey surfaces for reading, deep ink for text, and a small coral accent for pricing emphasis. Saturated brand colors remain restrained.
- Official-site typography: declared `Inter, ui-sans-serif, system-ui, -apple-system, system-ui, Segoe UI, sans-serif`; rendered glyphs were macOS system sans because no custom Inter face was loaded. The new page uses a stable system sans stack to match actual rendering and avoid an unnecessary remote font dependency.
- Logo: first-party `https://clarentis.co.uk/clarentis-logo.png`, downloaded successfully as a 475 x 275 PNG and retained in research assets.
- What remains recognizably on brand: logo, navy/teal identity, practical language, fee transparency and friendly small-business focus.
- Legacy choices not inherited: extreme 92px heading, negative letter spacing, rounded pill-heavy controls, radial-gradient hero and a large offer card beside the headline.
- Motifs: a fine ledger-line grid used only as subtle section structure, plus narrow teal rules that resemble tidy account columns.
- Composition: immersive photographic hero with protected copy space; unframed service list; price rows; image-led decision blocks; simple process rail; FAQ; final action band.
- Shape and surface language: 6px corners for tools and repeated items, thin cool-grey borders, restrained shadows only on the modal.
- Motion: small navigation and disclosure transitions, disabled under reduced-motion preferences.

## Image approach

The official site provides only the logo, so no first-party proof photography is available. Four new realistic images will fill non-proof roles. Each is explicitly illustrative in alt text and an adjacent caption, and none depicts a named Clarentis employee, client, office, project, document or result.

## Privacy and infrastructure

- Selected modules: Cloudflare Worker/D1 CRM, consent-gated measurement, GTM import, Google Ads enhanced conversions, Cloudflare publication.
- D1 remains the source of record. No webhook is configured.
- Raw name, email, phone and free text remain in the CRM only. Analytics receives a receipt and permitted campaign data; enhanced conversion matching uses browser-normalized SHA-256 email and E.164 phone only after explicit optional-data consent.
- Live publication still requires the intended Cloudflare account, manual sign-in, unique Worker name choice or approval, and a demonstration privacy contact.
- GTM import still requires a user-supplied GTM container ID, Google Ads conversion ID and conversion label. It will be imported into a new or explicitly chosen test container only.

## Coverage map

| Buyer question or media beat | Source | Specific Clarentis answer/proof | Final section | Disposition |
| --- | --- | --- | --- | --- |
| Is this for a business like mine? | Official hero | UK startups, sole traders and small limited companies | Hero and fit strip | Preserved |
| What help is available? | Official services | Registration, bookkeeping, Self-Assessment, VAT, payroll and Corporation Tax | Services | Preserved |
| What will it cost? | Official fee guide | Six indicative fee ranges with scope qualifiers | Fee guide | Preserved |
| How does the relationship start? | Official onboarding | Consultation, proposal, setup and monthly support | Process | Preserved |
| What affects the quote? | Official fee copy | Volume, complexity and scope review | Fee guide and FAQ | Preserved |
| Can you help with digital records? | Official service copy and GOV.UK MTD guidance | MTD-ready records and MTD setup are published services | Digital records section | Adapted with current authoritative context |
| What happens after I enquire? | Official contact copy | Free initial consultation and fixed-fee proposal | Hero, process, form, final action | Preserved |
| Where is the proof? | Official site | No testimonials, ratings, credentials or case studies published | Specific services, process and fee transparency used instead | Justified difference; no proof invented |
| Can I call? | Official footer | 07467 474356 | Header, hero and final contact | Preserved |
| Is this the real business site? | User instruction | This is a separate demonstration deployment | Demo notice, form, privacy and thank-you | Added for safety and clarity |

## Benchmark check

- Content depth: equal or stronger than the official source because it retains all services, fee guidance, process, objections and next-step detail.
- Media cadence: stronger through four disclosed illustrative images; none is used as proof.
- Proof density: justified difference because the source supplies no customer proof. Specific scope, process and fees remain the honest trust mechanism.
- Visual variety: stronger through photo, list, table, process and FAQ compositions.
- CTA journey: stronger for this demonstration because every enquiry CTA opens one accessible form and success waits for D1 confirmation.

