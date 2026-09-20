# Strategy brief

Retrieved 20 September 2026. This is a local landing-page preview for The Garden Room Co.

## Buyer and action

- Buyer: a UK homeowner or small business owner considering a made-to-measure garden room for work, leisure, or a specific use. They are comparing options and want to understand fit, build quality, and the next step.
- Inferred traffic intent: searches for bespoke garden rooms, garden offices, garden studios, and related local terms. No ad or keyword data was supplied.
- Primary action: request a free design consultation. The company says this leads to a no-obligation site survey and design consultation, with a quote before financial commitment.
- Offer mechanism: an in-house team and dedicated project manager handle design, manufacture, and delivery; CAD visualisations and site assessment shape a bespoke design.
- Primary objection: uncertainty about whether the room will fit the garden, purpose, budget, and planning requirements.
- Strongest trust anchor: real named projects on the official portfolio, supported by company-written specifications and one customer review from the official About page.

## Source conversion contract

The homepage says "Book your free design consultation and quote" and sends "Enquire Online" to the contact page. The contact form requires name, email, and message; phone and discovery source are optional. It has a separate optional marketing consent. It promises contact from the team. The public form endpoint is not reused. This build uses one inline enquiry form with the same required contact and message fields, optional phone, and optional separate marketing consent. All primary CTA controls say "Request a free design consultation". Local synthetic submissions receive a local confirmation. No live lead is created; production integration remains for the owner's Cloudflare work.

## Design direction

- Reference role: Green Retreats is a presentation benchmark for confident photography, clear browsing, and repeated next steps, not a source of claims, pricing, styling, or assets.
- Visual adjectives: considered (ample calm space and concise type), crafted (real project photography and material detail), approachable (plain next-step copy and visible contact options).
- Verified source palette: charcoal `#3c3c3b`, lime `#a3bc1a`, white `#ffffff` from the official page and logo. Applied palette: charcoal `#262d29` for header and text, lime `#a3bc1a` for the main action and small accents, white and cool pale gray `#eef2f1` for reading surfaces, and subtle warm wood color only in the photography. The dark tone and lime retain brand recognition while white space keeps the page current.
- Typography provenance: no formal brand guide found. The official rendered homepage H1 uses `Reem Kufi`, Helvetica Neue, Helvetica, sans-serif; the rendered body paragraph uses Poppins, Helvetica, Arial, sans-serif (Playwright measurement, 20 September 2026). Both are applied here with local copies of the exact public Google Fonts files referenced by the official page. Their SIL Open Font License texts are bundled in `assets/`. Fallbacks are declared.
- Composition: full-width first-party hero photo with unframed overlaid copy, a compact evidence rail, a varied project gallery, plain process content, one review, FAQs, and an inline form. No repeated card stacks. The building remains visible in the hero at desktop and mobile, with the darkest overlay reserved for copy.
- Image roles: the hero and gallery use first-party work photos. The hero is a project image but its specific location is not claimed. The gallery names projects only when their portfolio pages identify them.
- Motion: restrained hover and scroll behavior, disabled where reduced motion is requested.
- Visual-age checkpoint: keep the official logo, brand colors, typography, and real work. Leave behind the source site's blurred hero treatment and dense navigation. Use space, clear contrast, and fewer stronger images for a current high-consideration purchase.

## Module scope

Included: static landing page, local test receiver, local QA, and a documented same-origin production form contract. Excluded: live lead backend, CRM, analytics, brochure, Cloudflare connection, and publication. The source does offer a brochure, but the primary journey is consultation and the user did not ask for a brochure.
