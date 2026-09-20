# Clarentis landing page strategy

Research date: 2026-09-20. Primary public source: https://clarentis.co.uk/ . The site is a single-page offer with services, fees, onboarding and contact. The official first screen and rendered typography are recorded in `brand.json` and its two screenshots.

## Buyer and action

- Buyer: a UK startup founder, sole trader or small limited company owner who wants accounting admin and filing work handled with a fee they understand before committing.
- Stage: comparing small-business accounting support and deciding whether to enquire. Traffic intent is inferred from the source service language, not ad-account data.
- Offer: free initial consultation followed by a fixed-fee proposal after scope, transaction volume and complexity are reviewed.
- Desired action: request a fixed-fee quote by emailing Clarentis. The published contact is info@clarentis.co.uk and 07467 474356.
- Mechanism: Clarentis discusses the business, deadlines and records; proposes a scope and fee; helps with HMRC/software setup; then provides ongoing support as agreed.
- Main concern: whether the service fits the business and what the monthly or task fee might be. Show indicative fee ranges with their limits and explain what determines a final quote.
- Trust anchor: concrete, published service scope and fee ranges. No third-party rating, testimonial, named staff member, award or accreditation was found on the official page, so none appears.

## Source conversion contract

The source hero CTA says `Request your fixed-fee quote` and opens `mailto:info@clarentis.co.uk`. The page also offers a free initial consultation, asks visitors to say whether they are a sole trader, startup or limited company and what support they need, and lists a public phone as an alternative. There is no source form, consent statement, delivery deadline or thank-you state. This build keeps the quote-by-email destination and exact primary CTA label. An accessible dialog gathers the same essentials and prepares an email draft. It does not claim delivery; the visitor must send the draft in their email app. No production endpoint is reused or tested.

## Brand and design

- Visual adjectives: clear (plain hierarchy and fee table), capable (precise service detail), calm (open white space and restrained colour).
- Verified source palette from rendered official site: navy `#08294a`, teal `#159aaa`, body slate `#5e6f82`, cool page grey `#f6f8fb`, white. The official logo is the sole image on the source page.
- Applied palette: white and cool grey as primary surfaces; deep navy `#08294a` for headings and the hero; darker teal `#087b86` for accessible action contrast; muted teal tint `#e9f5f4` for practical callouts; a small warm amber accent `#d79a49` for fee detail. The exact official logo colours remain untouched.
- Verified brand-guide typography: none found. Official production page declares `Inter, ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif` on the visible H1 and prose. Chromium paints `.SF NS` Bold and Regular on this Mac, because Inter is not loaded. Applied page uses the same declared stack and system rendering, with no negative tracking. The heading sample is `Let us handle the numbers...`; the body sample begins `Friendly, practical accounting...` in `brand.json`.
- Rhythm: full-width photographic hero; narrow trust row; open image/text introduction; service list with rules; focused bookkeeping image; useful fee table; process with a separate image; simple FAQ and closing action. No repeating card grid or saturated band cadence.
- Source identity retained: real logo, navy/teal relationship, small-business language, consultation and fixed-fee offer. Source oversized, tightly tracked type, pill buttons, radial gradient and offer card are not inherited.
- Image roles: four generated illustrative scenes, with visible disclosure. No generated person is identified as a Clarentis staff member or customer. Exact prompts and files are in `image-plan.md`.
- Motion: no entrance animation; only short hover/focus transitions, removed under reduced-motion preference.

## Reference coverage

The built-in Blue Mountain reference was inaccessible on 2026-09-20; its attached-skill guidance supplies the structural benchmark. Clean Slate Land Solutions was inspected as an execution-quality benchmark, not used for client facts or copied styling.

| Buyer question or media beat | Source | Clarentis answer | Final section | Disposition |
| --- | --- | --- | --- | --- |
| Is this for my business? | Clarentis hero | UK startups, sole traders, small limited companies | Hero and intro | Preserved |
| What is the first step? | Clarentis offer/onboarding | Free initial consultation to discuss records, deadlines and needs | Hero and process | Preserved |
| What can they do? | Clarentis services | Formation, bookkeeping, personal tax, VAT, payroll, corporation tax | Services | Preserved |
| How does ongoing work help? | Clarentis onboarding and service detail | Organised records, reconciliations, submissions and deadline tracking | Records and process | Adapted into concrete work |
| What might it cost? | Clarentis fee guide | Six indicative ranges; scope, volume and complexity affect final quote | Fees | Preserved with qualifiers |
| What happens after enquiry? | Clarentis onboarding | Consultation, fixed-fee proposal, setup, monthly support | Process | Preserved |
| How do I act without pressure? | Clarentis contact | Email quote request, public phone alternative | Modal and close | Preserved; email draft form adds structure |
| Who are the people or clients? | No official evidence | No identity or testimonial claim | Illustrative scenes disclosed | Unsupported proof omitted |
| Is the page visually substantive? | Built-in benchmarks | Four relevant images, fee table, service detail and varied section rhythm | Whole page | Adapted to accounting buyer |

Compared with the built-in benchmarks: content depth is equal or stronger for this narrower accounting offer because service, fees, fit and process are concrete; media cadence is different because Clarentis has no first-party work photography; proof density is a justified difference because no reviews or staff credentials are published; visual variety and CTA journey are designed to be equal or stronger through a clear fee table, four image roles and one consistent quote action. These are planning judgments to be checked against final pixels and behaviour.

## Scope

Selected: local static landing page, quote-draft dialog, privacy notice and local QA. Not selected: brochure, tracking, CRM, form backend or Cloudflare publishing. The source uses email and the user will connect Cloudflare later. The email draft path works without a backend, but delivery cannot be confirmed by the page.
