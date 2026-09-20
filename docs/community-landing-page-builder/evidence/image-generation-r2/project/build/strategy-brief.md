# Clarentis landing page strategy

Research date: 2026-09-20. Primary source: https://clarentis.co.uk/ (homepage, stylesheet and first-party logo). The supplied site is a single-page service and contact journey. No formal brand guide, team portraits, testimonials, accreditations or project photography were found on that page.

## Buyer and action

- Buyer: a UK startup, sole trader or small limited company looking for help with records, tax, payroll or setup. Likely comparing scope and fees before making contact.
- Desired action: email Clarentis to request a fixed-fee quote and arrange a free initial consultation.
- Offer: accounting, tax and bookkeeping support; free initial consultation; a fixed-fee proposal after a scope review.
- Mechanism: Clarentis reviews the business, deadlines, records, transaction volume and complexity, then agrees a scope and fee before work begins. Ongoing support can include bookkeeping, payroll, VAT and tax deadlines.
- Main objection: uncertainty about fit and final cost. Show the six published indicative fee ranges with their qualifiers and explain how the quote is set.
- Strongest available trust anchor: specific published service scope, indicative pricing and a four-step onboarding process. There is no sourced customer or credential proof to publish.
- Traffic intent: inferred search and direct visitors seeking a small business accountant, bookkeeping, VAT, payroll or tax help. No keywords were supplied.
- Geographic cue: the source explicitly serves UK startups, sole traders and small limited companies. It does not publish a narrower service area, so the page invites a location check rather than promising nationwide coverage.

## Source conversion contract

The dominant hero CTA is "Request your fixed-fee quote", linking to `mailto:info@clarentis.co.uk`. The header offers a free consultation by email and the contact block says to identify business type and needed support. There are no form fields, consent checkbox, backend receipt or on-site success state. The public phone `07467 474356` is secondary. The new page keeps the exact primary CTA label and email destination, with a prepared subject/body to make the enquiry easier. An email client, rather than this page, controls sending and confirmation. No production lead is submitted during QA.

## Brand and visual direction

- Verified source palette: navy `#08294a`, ink `#092946`, teal `#159aaa`, dark teal `#0b7185`, pale background `#f6f8fb`. These are in the official stylesheet; logo pixels are navy and teal.
- Applied palette: original logo colors remain exact. Deep ink `#132c3b` grounds the hero and final action; teal `#0b7185` is the action color; near-white `#f7f9f8` is the reading surface; muted sage `#e4ece5` adds a quiet second temperature for the process. Saturated brand color is limited to action and detail rather than full-page bands.
- Verified brand-guide typography: none found.
- Official-site typography: `h1` and visible `p.lead` both compute to `Inter, ui-sans-serif, system-ui, -apple-system, ...`; Chromium actually painted both in `.SF NS` because Inter was declared but not loaded. Evidence: `build/brand.json` and source screenshots.
- Applied typography: the same declared stack and native system glyph rendering. Heading sizes, line spacing and weight are adjusted for readability; there is no font substitution.
- Three direction words: clear (short headings and visible fee qualifications), capable (specific service details and a direct process), calm (ample reading space, restrained teal, realistic context photography).
- Shape/composition: modest corners on repeated items, fine dividers, full-width unframed sections, one image-led hero, one supporting photo, an open service list, an accessible fee table and compact process steps. No fake review or credential area.
- Motion: no required animation. Anchor navigation respects reduced motion.
- Visual-age checkpoint: retain the recognizable logo and navy/teal identity. Omit the source's oversized hero typography, large floating offer card and repeated rounded card grid. Use documentary illustrative images without presenting them as Clarentis premises or customer proof.

## Coverage map

| Buyer question or media beat | Source | Specific answer or proof | Final section | Disposition |
| --- | --- | --- | --- | --- |
| Is this for my kind of business? | Official hero | UK startups, sole traders, small limited companies | Hero, FAQ | Preserved |
| What can they do? | Official services | Six named service lines and concrete tasks | Services | Preserved |
| What might it cost? | Official fees | Six indicative ranges with final quote limits | Fees | Preserved |
| How do I begin? | Official hero/contact | Email enquiry and free initial consultation | Hero, final contact | Preserved |
| How does the quote become definite? | Official fees/onboarding | Scope, transaction volume, complexity and fixed-fee proposal | Fees, process, FAQ | Preserved |
| What happens after agreeing? | Official onboarding | HMRC/software setup then monthly support | Process | Preserved |
| Can I call? | Official contact | 07467 474356 | Header, hero, final contact | Preserved and made easier to find |
| Real photo or testimonial proof? | Official page | None published | No proof section | Omitted because there is no supportable evidence; illustrative photos are disclosed |
| Does the page offer location-specific coverage? | Official hero | UK business audience only | Hero, FAQ | Adapted with an honest location enquiry |
| Conversion rhythm | Blue Mountain guidance in attached skill; Clean Slate public page | Early action, concrete service/fees, process, repeated action | Hero, fees, final contact | Adapted to an email-led accounting enquiry |

The result covers the source's relevant buyer decisions and adds a clearer early phone route and FAQ. It has stronger media rhythm than the photo-free source, while proof density remains intentionally limited to sourced operational detail. Blue Mountain was inaccessible during this run; its distilled structural guidance in the attached skill informed the coverage. Clean Slate informed hierarchy and pacing only, not style or claims.

Optional modules: none. Cloudflare publishing, tracking, CRM, form backend and brochure are outside this local build.
