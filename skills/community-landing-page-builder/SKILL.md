---
name: community-landing-page-builder
description: Build or refresh a researched, branded, conversion-focused landing page from a business website, with responsive implementation, honest imagery, an appropriate lead action, and visual QA. Use for one-prompt landing-page work by nontechnical business owners. Brochures, tracking, CRM, deployment, and other infrastructure are optional modules, not default requirements.
---

# Community Landing Page Builder

## Product promise

Treat the user as a business owner who may have no website, AI, hosting, analytics, or development experience. A business name or existing website URL is enough to begin. Keywords, a reference page, audience notes, extra images, analytics IDs, hosting access, and code repositories are useful but optional.

Complete the research, strategy, copy, design, implementation, and local QA without asking the user to make technical decisions. Ask only when an unresolved fact would materially change the offer, legal claim, primary action, required form field, or external destination. Do not stop for copy or design approval unless the user requested an approval checkpoint.

The default result is a polished local landing page with a real conversion path and concise QA evidence. It is not automatically a brochure, CRM, analytics stack, database, reporting product, deployment, or maintenance system.

## Absolute rules

These rules override examples and optional modules.

1. **No Unicode long dashes.** Never use U+2014, U+2013, or their named or numeric HTML equivalents in generated customer-facing content. Rewrite the sentence or use an ASCII hyphen. Run `scripts/scan_surfaces.py` before delivery and after any copy change.
2. **No invented proof.** Use only supported claims, numbers, ratings, awards, guarantees, testimonials, people, locations, credentials, and proof imagery. Preserve qualifiers. Omit unsupported proof.
3. **Generated imagery is illustrative.** Never present a generated person, place, project, document, dashboard, result, review, employee, customer, or franchisee as real evidence. Do not generate official marks or readable proof documents.
4. **One honest primary action.** A download must deliver a real file. A booking promise must reach a real booking path. A form must show success only after the selected destination confirms success. Phone and email may remain secondary.
5. **No fake completeness.** A page with visible sample content, dead required links, missing assets, stub destinations, unresolved severe QA findings, or an untested conversion path is not final. Label an endpoint-free build honestly as a local preview.
6. **Accessible by default.** Target WCAG 2.2 AA where applicable. Use semantic structure, a skip link, labels, described field errors, useful alt text, visible focus, keyboard access, sufficient contrast, zoom support, reduced motion, and unobscured focused controls.
7. **No secret or private-service prerequisite.** Do not ask for API keys, MCP servers, private ad accounts, GitHub access, or hosting credentials to produce the local final. Request only the access needed for a user-selected external action, and only when that action is ready.
8. **Publishing and live tests need authorization.** A request that explicitly says to publish is authorization for that publication. Otherwise stop at the local final and ask once. Never submit a live lead without permission and clear test labeling.

## Choose the smallest valid mode

- **Default landing page:** researched copy, custom responsive design, purposeful imagery, one real conversion path, local preview, and QA.
- **Refresh:** preserve working behavior, then re-audit claims, brand, imagery, conversion behavior, accessibility, and QA.
- **Copy-only or audit-only:** produce only the requested analysis or copy. Do not scaffold a site or infrastructure.
- **Optional brochure:** activate only when the offer genuinely includes a guide, catalogue, menu, or document, or when the user asks for one.
- **Optional form backend or CRM:** activate only when lead collection is selected and a real destination is requested.
- **Optional tracking:** activate only when requested or supplied. Local page quality does not depend on GTM or ad-account access.
- **Optional deployment or handoff:** activate only when requested. Use the user's chosen provider when stated; otherwise propose one simple supported route after the local final.

Do not expand a normal landing-page request into every optional module.

## Default workflow

### 1. Research autonomously

Read [references/research-and-claims.md](references/research-and-claims.md).

- Inspect the official website and the most relevant service, process, FAQ, testimonial, contact, legal, and media pages.
- When useful, inspect verified official social accounts and credible editorial coverage. Use them to verify facts or discover first-party assets, not as automatic reuse permission.
- If a reference or existing landing page is supplied, map its useful buyer questions, proof roles, media rhythm, CTA logic, and pacing. Preserve the persuasive jobs, not its wording, assets, or literal section order.
- When direct competitors are readily discoverable and differentiation is unclear, inspect two or three official competitor pages. Record only the message gap the client can credibly occupy.
- Record material claims and their sources. Do not turn competitor claims into client facts.

Create one compact `build/strategy-brief.md` containing: buyer situation, likely decision stage, desired action, offer or result, real delivery mechanism, primary objection, strongest trust anchor, traffic intent, and visual direction. Create `build/claim-ledger.md` for material claims that will appear. Do not create extra reports merely to prove activity.

### 2. Write the conversion argument

Read [references/copy-and-structure.md](references/copy-and-structure.md).

Create one implementation-ready copy master at `build/page-copy.md` or `build/page-copy.json`. Cover the buyer jobs supported by evidence: relevance, offer, proof, mechanism or fit, objections, process, conversion, and legal close. Merge related jobs and omit unsupported filler. No fixed section count applies.

Use one exact primary CTA label. Explain the real operational reason the offer works. Map important benefits to actual capability or proof. Use truthful urgency only when a sourced deadline, capacity limit, or availability constraint exists. Replace generic hype such as `world-class`, `game-changing`, `seamless`, `robust`, or `innovative` with the specific action, limit, mechanism, or evidence unless the term is genuinely necessary and made concrete.

Every heading, CTA, and bullet must make sense to a first-time visitor. Keep technical terms that the real buyer uses, but simplify sentence structure. Treat word count as an editing signal, not a target.

### 3. Design for this business

Read [references/design-direction.md](references/design-direction.md).

Record the design decisions in the strategy brief: type character and hierarchy, color roles and contrast, spacing rhythm, shape and surface language, composition pattern, image roles, and motion behavior.

Start from supplied assets and the business's observed identity. Supplied assets outrank scraped alternatives. Verify the correct logo variant against its rendered background and make the brand visible in the first viewport. Separate verified source colors from the applied interface palette, explain the role of each important applied color, and do not inherit the source website's visual age by default.

When the user supplies no design reference, use Blue Mountain as the built-in conversion-architecture benchmark and Clean Slate Land Solutions as the execution-quality benchmark described in the design reference. Do not clone either page. The first controls persuasive completeness; the second sets a minimum bar for current hierarchy, spacing, proof presentation, and finish.

Avoid an AI-template or legacy-brochure appearance. Do not default to violet or blue-purple gradients, repeated gray card grids, emoji icons, fake initial-avatar proof, all-centered sections, oversized headings inside compact panels, generic condensed display type, negative letter spacing, broad alternating saturated color bands, or three consecutive sections with the same composition. Vary scale, density, media, and layout according to each section's job while keeping one coherent system.

### 4. Research and create imagery

Read [references/image-research-and-generation.md](references/image-research-and-generation.md). Use real first-party imagery for proof. Image search is discovery, not permission. Native image generation may fill a non-proof visual gap without an API key, but generation is never mandatory when a sourced asset or a stronger layout solves the need.

Classify each used image as `decorative`, `proof`, `portrait`, `diagram`, `screenshot`, or `illustrative`. Also mark whether its pixels contain information that must remain readable. Diagrams, screenshots, infographics, and text-bearing images must not use destructive `cover` crops and must not sit behind overlapping copy. Text must not cover a person's face or the subject needed to understand the image.

### 5. Build the smallest honest conversion path

Read [references/build-contract.md](references/build-contract.md).

Default to semantic HTML, CSS, and JavaScript unless an existing project requires another stack. The selected conversion may be an accessible form, booking link, phone call, email, download, or another real action. Choose modal or inline form from the journey; do not create hidden duplicate forms. Use only fields needed for response or routing.

Create a thank-you page or success state when a form or gated delivery requires it. If no backend is configured, keep submissions local or disabled, state the limitation clearly, and do not emit a production conversion event.

### 6. Verify the actual output

Read [references/quality-gates.md](references/quality-gates.md). The page is not final until all selected gates pass after the last source change.

At minimum:

1. Run `scripts/scan_surfaces.py` against the project.
2. Run `scripts/validate_page.py` against the project.
3. Serve the page locally and test representative mobile, tablet, laptop, short-height laptop, and desktop viewports.
4. Capture and inspect the actual rendered pixels. Measurements and file presence are not visual approval.
5. Test the real selected conversion path, including validation, failure, success, and destination behavior. Use synthetic data locally. Do not create a live lead without permission.
6. Run one local Lighthouse pass when available. Fix failures and repeat marginal results. Aim for Performance 90 or better, LCP at most 2.5 seconds, CLS at most 0.1, and TBT at most 200 milliseconds without deleting necessary proof.
7. Perform a fresh acceptance pass after the build. Use a separate reviewer or agent when available. Otherwise reopen the final artifacts in an isolated second pass without trusting earlier self-authored pass booleans.

Every severe finding blocks delivery. Resolve each warning or record a specific, evidence-based acceptance decision. A generic `looks good` or a screenshot path without observations is not review evidence.

### 7. Deliver locally before external setup

Present the local page, conversion behavior, representative screenshots, and concise QA result first. Then request only the values needed by selected optional modules. Missing Cloudflare, GitHub, GTM, an ad account, an image API key, a CRM, or a brochure must not block a good local page when that module was not selected.

Use status language that matches reality:

- `local final` means the selected local experience passed its gates but external delivery may be unconfigured;
- `publish-ready` means the selected external configuration is present and preflight passed;
- `live and verified` means the actual destination and selected conversion path were tested after publication.

## Required visual acceptance

The final review must explicitly answer these questions:

- Is the primary action visible and usable at 1280 x 600 and on the smallest tested mobile viewport?
- Does any consent, chat, sticky, or fixed UI cover the H1, primary CTA, form action, legal links, or final content?
- Are all labels in diagrams, screenshots, roadmaps, and infographics visible at every viewport?
- Does any copy cover image text, a face, a product detail, or the subject needed for comprehension?
- Do footer utilities have real layout gaps and adequate touch targets?
- Does each reviewed image have asset-specific evidence rather than a reused generic screenshot?
- Are official proof and generated illustration clearly separated in role and visual hierarchy?
- Do consecutive sections vary with their content, or does the page fall into repeated headline-card-grid bands?
- Does a downloadable guide preview use the actual guide cover or verified page spread?
- Are duplicate facts, oversized proof images, clipped text, unfinished sentences, and thin thank-you states removed?
- Does the page feel current and audience-fit rather than like a cleaned-up copy of an old source site or printed sales brochure?
- Are exact brand colors used with intentional proportions, with source colors separated from applied interface colors?
- Is the visual execution at least as intentional as the built-in Clean Slate benchmark without copying its style?

When a brochure is selected, read [references/catalogue-workflow.md](references/catalogue-workflow.md), render every page, inspect each at readable size, and run `scripts/validate_catalogue_review.py`. Any clipping, truncation, unreadable copy, text-on-information collision, or text covering a person blocks the brochure and the final result.

## Optional modules

Load these only when selected:

- **Advertising and GTM:** [references/advertising-tracking.md](references/advertising-tracking.md). Keep raw contact data out of analytics. The optional contract uses `customer_data_ready` for consented provider-normalized hashes and `lead_accepted` for the confirmed conversion receipt. Google is primary; Meta and Microsoft require destination-specific verification.
- **Lead backend and CRM:** [references/lead-and-tracking-contract.md](references/lead-and-tracking-contract.md) and [references/cloudflare-crm.md](references/cloudflare-crm.md).
- **Cloudflare publishing:** [references/guided-publishing.md](references/guided-publishing.md). Deployment is not implied by a local build.
- **Long-lived handoff, retention, backup, or recovery:** load the matching existing references only when requested.

No optional module may weaken the absolute rules or change a stored lead into an apparent failure because analytics failed.

## Default deliverables

- responsive landing page and local assets;
- the selected conversion behavior and a thank-you state when applicable;
- compact strategy, claim, copy, and image notes;
- representative mobile, tablet, laptop, short-height laptop, and desktop screenshots;
- concise QA summary with fixed findings and honest external limits.

Optional modules add only their own necessary artifacts. Do not create infrastructure as proof that the page was built.
