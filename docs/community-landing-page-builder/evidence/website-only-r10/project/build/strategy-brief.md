# Stayclean landing page strategy

Retrieved: 2026-09-19

## Buyer and decision

- Buyer situation: A Bristol homeowner, landlord, managing agent, or business needs reliable window or gutter cleaning and wants to know that the company covers the property, has the right access method, and will communicate clearly.
- Likely decision stage: Local service comparison, with enough intent to request a quote once service fit and trust are clear.
- Inferred traffic intent: `window cleaning Bristol`, `Bristol window cleaners`, `gutter cleaning Bristol`, plus commercial and high-level variants. No ad-account or keyword-volume data was supplied.
- Desired action: Submit a free quote request.
- Offer: A straightforward, no-obligation quote for suitable Bristol window or gutter cleaning.
- Result: Clean exterior or internal windows, or cleared gutters, with method and scope matched to the property.
- Delivery mechanism: Pure-water poles for suitable exterior glazing, traditional methods for internal glass, specialist access for higher or awkward glazing, and ground-based gutter-vac equipment with camera inspection for suitable gutter work.
- Primary objection: Whether Stayclean can safely reach the property, include the right surfaces, avoid disruption, and turn up reliably.
- Strongest trust anchor: A Bristol business established in 1997, supported by real team, vehicle, and work photography plus public customer feedback.

## Source conversion contract

- Primary CTA: `Get a free quote`.
- Conversion type: Quote-request form, opened from the page.
- Required fields: Service, cleaning frequency, name, email, phone, address, and postcode.
- Optional fields: Company and message.
- Consent and privacy: Details are used to respond to the enquiry, with a link to Stayclean's live privacy policy.
- Promise: Stayclean normally replies within one working day.
- Production destination: The source uses its own website form handler. That endpoint is not reused.
- Local success behavior: The isolated local receiver confirms a synthetic preview submission with `Preview complete. Nothing was sent.`
- Local failure behavior: Entries remain in place, a visible error is announced, and retry is available.
- Production limit: Cloudflare form delivery must be connected and verified after handoff before the page can be called a live lead path.

## Message and structure

1. Hero: Service, Bristol relevance, primary quote action, and compact trust.
2. Service fit: Domestic, commercial, and high-level window cleaning.
3. Gutter work: A distinct maintenance need and its actual ground-based method.
4. Mechanism: How Stayclean selects method and scope before attendance.
5. Local proof: Real team and fleet, established 1997, and company clarity.
6. Reviews: Two sourced Google-review excerpts published on the official homepage.
7. Coverage and process: Named areas are examples; postcode confirmation handles availability.
8. Final action and legal close.

## Design direction

- Visual adjectives: capable, local, direct.
- Expression: Large real work photography, restrained geometry, open spacing, practical labels, and one obvious yellow action.
- Source palette: deep teal `#073f43` and `#082f33`; logo and action yellow `#ffcd49`; white.
- Applied palette: deep teal `#073f43` for navigation and high-confidence surfaces; ink `#173239` for text; pale blue-green `#eef5f2` and white for page rhythm; yellow `#ffcd49` only for the primary action and small accents; green is not used as a competing primary action.
- Logo: Official yellow Stayclean logo on deep teal.
- Verified brand-guide typography: No public brand guide was found.
- Official-site typography: Rendered homepage H1 uses Roboto Regular. Rendered body prose uses Arial. Evidence is in `build/brand.json`, including desktop and mobile text samples.
- Applied typography: Locally hosted Roboto for headings using the SIL Open Font License, with Arial for body copy. No substitution is made.
- Hierarchy: Calm Roboto headings, 68px maximum desktop H1, 38px mobile H1, compact body measures, and no negative letter spacing.
- Shape and surface language: 4px to 6px radii, fine borders, quiet shadows only on repeated service items, square image crops with stable ratios.
- Composition: Full-bleed hero image and overlay; an image-led service row; a wide gutter feature; an unframed proof split; review quotes; and a compact dark close.
- Image roles: Official first-party photography only. The hero carries brand and locality; service photos prove real work; the team image remains unobstructed in the proof section as well as carefully framed in the hero.
- Motion: Small hover changes only, removed under `prefers-reduced-motion`.
- Brand fidelity: The exact logo and source teal/yellow remain. Legacy Avada components, heavy modal styling, competing WhatsApp button, and oversized 80px source headline are not inherited.
- Specific motifs: A thin yellow vertical rule on section labels and simple glass-like translucent proof cells in the hero.

## Reference hierarchy checkpoint

- Client truth: Stayclean's current official website controls facts, logo, palette, typography, form contract, and imagery.
- Blue Mountain lesson retained: Early offer clarity, proof near the claim, mechanism, objections, and repeated action.
- Clean Slate quality target: Strong image scale, confident spacing, concise proof presentation, and clear conversion priority.
- The page is intentionally current and operational, not a reproduction of the source site's older photos or CMS component styling.

## Optional modules

- Selected: Local form receiver for synthetic QA because the source conversion is form-first.
- Excluded: Cloudflare publishing and production form wiring, at the user's request.
- Excluded: Tracking, CRM, brochure, and private account integrations because they are not needed for the local final.

## Public sources

- https://www.stayclean.co.uk/
- https://www.stayclean.co.uk/services/
- https://www.stayclean.co.uk/services/domestic-window-cleaning/
- https://www.stayclean.co.uk/services/commercial-window-cleaning/
- https://www.stayclean.co.uk/services/high-rise-window-cleaning/
- https://www.stayclean.co.uk/gutter-cleaning-2/
- https://www.stayclean.co.uk/about-stayclean/
- https://www.stayclean.co.uk/frequently-asked-questions/
- https://www.stayclean.co.uk/contact-us/
- https://www.stayclean.co.uk/privacy-policy/

