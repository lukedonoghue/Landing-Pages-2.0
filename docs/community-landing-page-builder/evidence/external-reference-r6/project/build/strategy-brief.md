# The Garden Room Co. landing page strategy

Research date: 2026-09-20. Client: https://gardenroomco.com/. Presentation reference: https://www.greenretreats.co.uk/.

## Decision

- Buyer: a homeowner or home-based worker considering a custom garden room and comparing design, specification, cost, site fit, and trust. Likely in active research rather than ready to buy a fixed model.
- Inferred traffic intent: searches for bespoke garden rooms, garden offices, studios, gyms, and local garden room builders. No keyword or campaign data was supplied.
- Desired action: request the source offer, a free design consultation and no-obligation quote, through one shared enquiry form. Exact page CTA: `Get a free design consultation & quote`.
- Delivery mechanism: an initial consultation leads to a free site survey and design consultation, then a CAD visualisation and quote before financial commitment; the in-house team manages the agreed build. Source: https://gardenroomco.com/about-us/.
- Main objection: uncertainty about site suitability, what is included, price comparison, permissions, and contractor coordination. Address with real projects, specification factors, the price promise, process, and qualified FAQ answers.
- Strongest trust: first-party project portfolio; 20+ years' experience and single point of contact stated on the official home page; attributed customer feedback on the about page.
- Early fit cue: based in St Asaph, North Wales. Official site lists North Wales, Chester, London, Manchester, Merseyside, and Shropshire; the form asks for a project postcode without promising coverage at every address.
- Public enquiry number: 07803 362187, shown for Alex on https://gardenroomco.com/contact-us/ and in official home-page Organization markup. Visitor label is `Call the team` because the site does not explain Alex's role. 07850 775413 is also published for Carl but omitted to keep one clear secondary contact route.

## Source conversion contract

The home page says `Book your free design consultation and quote` with `ENQUIRE ONLINE`; the contact page uses a contact form. Name, email, and message are required; phone and discovery source are optional. Marketing consent is a separate optional checkbox. Source form submits to Contact Form 7 on the production site. This build keeps the form and offer, trims the discovery question, adds an optional project postcode for fit, and uses a local-only test receiver. No public production endpoint is reused. The local receiver confirms only that it accepted a synthetic preview request and discards the data. Production lead delivery remains unconfigured.

## Brand and design

- Source logo: https://gardenroomco.com/wp-content/uploads/2021/09/garden_room_co_logo.png, white mark with lime lines, intended for dark charcoal. Source colors measured on the official first viewport: charcoal `#3c3c3b`, lime near `#a4bd15`, white `#ffffff`.
- Verified brand-guide typography: none supplied or found.
- Official-site typography: the attached skill's `extract_brand.mjs` measured the rendered home-page H1 `Stunning Garden Rooms` as Reem Kufi (custom glyph font) and the visible project paragraph as Poppins (custom glyph font), at both 390 and 1440 widths. Evidence: `build/brand.json` and its screenshots.
- Applied typography: locally bundled, publicly licensed Reem Kufi for headings and Poppins for prose and controls. No substitution. License texts are in `assets/fonts/`.
- Applied palette: exact logo colors retained in the logo; charcoal `#303331` for header, text and one price band; lime `#a4bd15` for the primary action and small emphasis; clean white `#ffffff` and cool pale gray-green `#f1f4f1` for readable space; muted pine `#3f6254` for secondary details. Lime is an accent, not a full-page wash.
- Three visual adjectives: crafted (large honest project photography), calm (open space and quiet neutrals), assured (specific specifications and modest typographic hierarchy). Shape language: square to 4px corners, thin rules, no decorative card grid. Motion: small hover transitions only, disabled for reduced motion.
- Hero: source photograph is a completed garden room with visible glazing and deck. The copy sits in a separate unframed field so it does not cover the building. Responsive stacking preserves the whole image at narrow widths.
- Visual-age checkpoint: preserve the identifiable logo, colors and fonts while replacing the source's dated centered image overlay, sales strip and dense navigation with larger inspectable photographs, a concise header and a deliberate editorial rhythm. The reference informs media confidence and buyer-question depth, not wording, price claims, palette, photos or geometry.

## Reference and source coverage

| Buyer question or media beat | Source | Specific client answer or proof | Final section | Disposition |
| --- | --- | --- | --- | --- |
| Immersive first impression and clear action | Green Retreats home; client home | Actual client garden room photo, bespoke offer, free consultation and quote | Hero | Adapted to protect building details from text |
| Options for different uses | Both sites | Dyserth relaxing room, Walthamstow office/guest suite/storage, Moreton salon | Real projects | Replaced range shopping with verified bespoke examples |
| Price and comparison | Green Retreats ranges; client contact and specifications | No verified client list price; official like-for-like price promise and specification factors | Compare with confidence | Adapted because this client quotes bespoke work |
| See the built result | Both portfolios | First-party project photos and direct project links | Projects, design, review | Preserved with client work |
| Visit/showroom or tactile proof | Green Retreats | No client showroom verified; detailed portfolio and survey process are documented | Projects, process | Replaced; showroom claim unsupported |
| Video, ambassador and large-scale ratings | Green Retreats | No equivalent endorsement required; client project details and attributed feedback | Reviews and project proof | Replaced; competitor proof cannot transfer |
| Design configurator | Green Retreats | Client consults, surveys and creates CAD visualisations | Design and process | Adapted to actual bespoke mechanism |
| Brochure | Both sites | Client has a brochure on its current website; it is not the main conversion offer here | Omitted | The complete consultation form and project examples answer this page's decision; no document fulfilment promised |
| Build specification and practical constraints | Client garden rooms and FAQ | SIPs, roofing, cladding, foundations, optional electrical connection, conditional planning | Details and FAQ | Preserved with qualifiers |
| Customer experience | Client about page | Short attributed excerpts about communication and finish | Reviews | Preserved without rating inflation |
| Final action and contact | Both sites | Shared form, public phone, official privacy policy | Final contact and modal | Preserved |

Completeness comparison: content depth `equal_or_stronger` for the bespoke consultation decision; media cadence `justified_difference` because the reference is a large catalogue site while this page uses seven distinct first-party pictures; proof density `justified_difference` because only client-supported projects and feedback are used; visual variety `equal_or_stronger` for a focused landing page; CTA journey `equal_or_stronger` because all enquiry CTAs share the same form in place.

Optional modules: no brochure, CRM, tracking or deployment selected. A local test receiver is included solely to verify the form journey; Cloudflare connection and real lead delivery are outside this run.
