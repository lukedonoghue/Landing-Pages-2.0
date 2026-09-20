# Clarentis landing page strategy

Research date: 2026-09-20. Primary source: https://clarentis.co.uk/ . The official page is a single-page site covering services, indicative fees, onboarding and contact. Its only first-party image visible in the rendered page is the logo.

## Decision

- Buyer: a UK startup founder, sole trader or small limited-company owner looking for practical accounting, tax or bookkeeping help. Likely comparing scope and cost before contacting an accountant.
- Traffic intent: inferred searches for small business accounting, bookkeeping, VAT returns, Self-Assessment and fixed-fee accountants. No keyword or campaign data was supplied.
- Desired action: email Clarentis to request a fixed-fee quote and arrange the free initial consultation.
- Offer: practical support across registration, bookkeeping, Self-Assessment, VAT, PAYE/payroll and Corporation Tax. The consultation is free; final price follows a scope, transaction-volume and complexity review.
- Mechanism: initial consultation, scoped fixed-fee proposal, HMRC/software and record setup, then ongoing support in the agreed scope. The source page describes this sequence.
- Primary objection: whether the service fits the business and what it will cost. The page presents the source fee guide with its limitations and explains the proposal process.
- Strongest available trust anchor: transparent published fee guide and concrete service/process detail. No independent review, professional accreditation or team portrait was found on the official page, so none is claimed.
- Geographic cue: the official site explicitly offers support for UK startups, sole traders and small limited companies. No narrower service area is asserted.
- Verified enquiry contacts: info@clarentis.co.uk and 07467 474356, both on the official site's contact area. No named person is used.

## Source conversion contract

| Element | Source | Local build |
| --- | --- | --- |
| Primary offer | Fixed-fee quote after free initial consultation | Preserved |
| Primary CTA | "Request your fixed-fee quote" | Same label throughout |
| Conversion type | `mailto:info@clarentis.co.uk` | Same email destination, with a prefilled subject |
| Required fields | None on the site | None |
| Consent | No site form or consent text | No site data collection |
| Follow-up | Visitor emails to arrange consultation; proposal follows scope review | Explained without timing promise |
| Success behavior | Email client opens; no on-site confirmation | Same; visible address is fallback |
| Secondary action | Published phone number | `tel:+447467474356` near top and final contact |

The site does not collect or transmit enquiry data. No form backend, CRM, analytics, brochure or deployment module is selected. The page can be previewed locally; email and phone handlers depend on the visitor's device.

## Brand and design

`build/brand.json` was produced with the attached skill's `extract_brand.mjs` from the live official page at 390x844 and 1440x900. The first-party logo at https://clarentis.co.uk/clarentis-logo.png is retained.

- Verified brand-guide typography: none found.
- Official-site typography: visible `h1` and lead paragraph both compute to `Inter, ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif`. Chromium actually paints the heading with `.SFNS-Bold` and lead with `.SFNS-Regular` on this Mac; the declared Inter face does not render. The current page uses negative letter spacing, which is a layout treatment rather than font identity.
- Applied typography: the same Inter/system stack without negative letter spacing. On the inspected host it paints the same system glyph family. This avoids loading an unverified external font or claiming Inter is available. Cross-platform glyphs will follow the official site's system fallback behavior.
- Source colors: navy `#08294a` from headings and buttons; teal `#159aaa` from primary CTA; light blue-grey `#f6f8fb` from background; pale cyan `#eaf7f8` from offer treatment.
- Applied colors: navy `#08294a` for headings/trust, deeper navy `#071e36` for final contact, darker teal `#0a8292` for accessible actions, white and `#f6f8fb` for quiet reading surfaces, soft green-grey `#eef3f0` for fee context. The darker teal is a contrast adjustment from the source CTA. Natural wood in the illustrative images adds warmth without changing the brand mark.
- Direction: clear, composed, practical. Clear comes from direct category language and an unframed hero; composed from deliberate spacing, modest shapes and a restrained palette; practical from a complete fee table and service details.
- Composition: full-width photographic hero with genuine copy space, compact proof/process strip, unframed service rows, one photographic explanation, fee table, four-step sequence, FAQs and final contact. This keeps varied scale and density.
- Image roles: official logo for identity; generated generic workspaces for illustration, explicitly disclosed on page. They make no claim about Clarentis's premises, people or clients.
- Motion: only native smooth anchor scrolling, disabled for reduced-motion users. No autoplay or entrance animations.

The source identity stays visible through logo, navy and teal. The source's oversized hero type, pill buttons, gradient background and large offer card are not carried over. Blue Mountain provides a checklist for the buyer argument; Clean Slate is the finish benchmark for hierarchy, spacing and action clarity. Neither is copied.

## Coverage map

| Buyer question or source beat | Source | Client-specific answer | Final section | Disposition |
| --- | --- | --- | --- | --- |
| Is this for my business? | Clarentis hero | UK startups, sole traders, small limited companies | Hero | Preserved, surfaced earlier |
| What is the first step? | Startup offer/contact | Free initial consultation by email | Hero, process, final contact | Preserved |
| What can they do? | Six source service descriptions | Six service rows with concrete tasks | Services | Preserved and reorganised |
| Are fees transparent? | Indicative fee guide | All six ranges and quote qualifiers | Fees, FAQ | Preserved in full |
| What happens after I enquire? | Four source onboarding steps | Consultation, proposal, setup, ongoing support | Process | Preserved |
| Why trust the support? | Why Clarentis | Specific record and deadline tasks, fixed fee before work | Facts, records, process | Adapted; no invented external proof |
| How do I contact them? | Contact area | Email and published phone; business type and needs to mention | Hero, FAQ, final contact | Preserved |
| What is legally promised? | Source footer | General information, not tax advice | Footer | Preserved |
| Photographic proof rhythm | Official page has no service photos | Generic generated workspace images are disclosed illustration | Hero, records | Added for clarity, never used as proof |

Final comparison: content depth is equal or stronger because all six services, six price entries and four onboarding stages remain. Media cadence is stronger with two illustrations, while proof density is a justified difference: no independent proof exists in the source, so the page relies on verifiable offer detail. Composition and CTA journey are stronger through readable rows, table and repeated email action. This comparison will be rechecked in pixel acceptance.
