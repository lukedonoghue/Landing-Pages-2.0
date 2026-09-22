---
name: community-landing-page-builder
description: Build or refresh a researched, branded, conversion-focused landing page from a business website, with responsive implementation, honest imagery, a useful PDF, an appropriate lead action, visual QA, and the built-in Cloudflare Free CRM for form-led pages. Use for one-prompt landing-page work by nontechnical business owners. External integrations and non-form infrastructure remain optional.
---

# Community Landing Page Builder

## Guided execution and automatic improvement

When the user asks for a guided, step-by-step or paint-by-numbers build, read [references/guided-workflow.md](references/guided-workflow.md). Start or resume the persistent guide and use its actual execution loop. Preserve automatic mode for requests without routine approvals. The guide reuses the existing native router, evidence gates and authorization records; no separate model API key or hosted orchestration service is a default prerequisite. Capability-probe the real host and report unsupported native UI or CLI execution honestly.

After the **first actual page build**, automatically execute [references/control-comparison.md](references/control-comparison.md): preserve it, compare the rendered page against the Blue Mountain Mesh copy and layout control, identify a prioritized concrete improvement checklist, apply the improvements, and perform a fresh mobile/desktop copy and pixel review. This is required before final presentation, not an optional audit the owner must request. Emphasize clear, punchy, direct, meaningful benefit/outcome headlines, a supported reason to choose, customer-oriented copy and simple hierarchy. Never substitute generic scorecards or self-authored pass booleans for actual comparison, edits and retests. New scaffolds enforce this through the control-review gate.

## Reader guide and shared confirmation page

For new complete builds, read [references/reader-guide-quality.md](references/reader-guide-quality.md). The PDF must answer researched buyer questions with concrete benefits, useful context, a decision checklist and relevant imagery from permitted website/supplied sources or a real native image-generation result. Require a meaningful cover and distinct interior image, preserve provenance and disclose illustrations. A valid but bare or generic PDF is not finished. Build, inspect every rendered page, record specific improvements, repair and re-review before passing the reader gate.

Derive the thank-you page from the current main landing page, not an isolated success card. Preserve the brand/header, verified phone, benefits, actual proof/testimonials, process and FAQ content. Change the hero to truthful confirmation, the real follow-up, guide benefits, a download and the actual rendered cover. Preserve the on-page PDF reader/download fallback below. Remove repeat enquiry forms/actions and never fire a conversion on a direct thank-you visit. Use the maintained helper and verify both receipt and direct-visit states on mobile/desktop. Rebuild if the main page or PDF changes.

## Product promise

Treat the user as a business owner who may have no website, AI, hosting, analytics, or development experience. A business name or existing website URL is enough to begin. Keywords, a reference page, audience notes, extra images, analytics IDs, hosting access, and code repositories are useful but optional.

Complete the research, strategy, copy, design, implementation, and local QA without asking the user to make technical decisions. Ask only when an unresolved fact would materially change the offer, legal claim, primary action, required form field, or external destination. Do not stop for copy or design approval unless the user requested an approval checkpoint.

All supplied hosting, CRM and account-access workflows must fit Cloudflare Free. Never enable paid plans, metered add-ons or arbitrary-recipient automatic email to complete a build. The default Free account workflow creates expiring one-use links for an authenticated Admin to copy or send through any normal inbox, including Gmail; it does not require an owned sending domain. Automatic Cloudflare email is optional and requires its separate verified-sender and verified-recipient setup. Stop and explain only a real quota or setup blocker; only a later explicit user decision may authorize a separate paid configuration. For form-led pages, use the bundled Cloudflare Workers + D1 CRM by default; the user does not need to choose a CRM or spreadsheet. See the CRM's team-access reference when needed. CRM builds must retain the shared usage warning for every role; follow [usage monitoring](references/usage-monitoring.md) for its optional read-only connection and honest coverage limits.

The default result is a polished local landing page, a useful downloadable PDF, a real conversion path and concise QA evidence. When that path collects enquiries through a form, the default result also includes the bundled local CRM, D1-backed lead storage, owner login, pipeline, notes, attribution and reporting. External CRMs, Google Sheets, GTM, ad-platform conversion IDs, custom domains and deployment remain optional or later-stage connections. A phone-, email-, booking-, purchase- or download-led page does not add a CRM unless the journey needs one or the user requests it.

## Absolute rules

These rules override examples and optional modules.

1. **No Unicode long dashes.** Never use U+2014, U+2013, or their named or numeric HTML equivalents in generated customer-facing content. Rewrite the sentence or use an ASCII hyphen. Run `scripts/scan_surfaces.py` before delivery and after any copy change.
2. **No invented proof.** Use only supported claims, numbers, ratings, awards, guarantees, testimonials, people, locations, credentials, and proof imagery. Preserve qualifiers. Omit unsupported proof.
3. **Generated imagery is illustrative.** Never present a generated person, place, project, document, dashboard, result, review, employee, customer, or franchisee as real evidence. Do not generate official marks or readable proof documents.
4. **Preserve the source conversion intent.** When the supplied business page uses a dominant form, booking, quote, purchase, or download journey, keep that conversion type and offer unless the user explicitly changes it or evidence shows it is dead or unsafe. Missing credentials may delay production wiring, but never justify replacing a form with a phone call or email. A download must deliver a real file. A booking promise must reach a real booking path. A form must show success only after the selected destination confirms success. Phone and email may remain secondary.
5. **No fake completeness.** A page with visible sample content, dead required links, missing assets, stub destinations, unresolved severe QA findings, or an untested conversion path is not final. Label an endpoint-free build honestly as a local preview.
6. **Accessible by default.** Target WCAG 2.2 AA where applicable. Use semantic structure, a skip link, labels, described field errors, useful alt text, visible focus, keyboard access, sufficient contrast, zoom support, reduced motion, and unobscured focused controls.
7. **No secret or private-service prerequisite.** Do not ask for API keys, MCP servers, private ad accounts, GitHub access, or hosting credentials to produce the local final. Request only the access needed for a user-selected external action, and only when that action is ready.
8. **Publishing and live tests need authorization.** A request that explicitly says to publish is authorization for that publication. Otherwise stop at the local final and ask once. Never submit a live lead without permission and clear test labeling.
9. **Enquiry CTAs open the form in place.** On a form-led page, every enquiry/quote CTA opens the same accessible popup journey without jumping to another page section. A research-supported inline form is additional access, not a substitute for the popup. Preserve one shared form state and submission handler. Phone, navigation, booking, purchase and download controls retain their actual purpose.
10. **Keep paid-ad visitors in the funnel.** No visitor-facing links back to the business's main website or its subdomains, including logo, navigation, service details, footer, privacy, thank-you and PDF links. Bring verified decision information and relevant legal content into the funnel; keep research citations in owner notes. Call/email actions and a genuinely required third-party booking or payment destination are distinct from main-site browsing. If the only conversion destination is on the main site, resolve that conflict before promising a working path; do not silently break either rule. Verify redirects and scripted navigation as well as HTML links.
11. **A useful PDF is a required build stage.** Create a concise, researched guide, service overview, options summary, checklist, catalogue or verified price list appropriate to the buyer. Complete `build/guide.json`, run `python3 scripts/build_guide.py .`, inspect every rendered page and keep the matching `data-guide-embed` preview plus `data-guide-download` fallback on the thank-you page. A placeholder, missing, unrendered or undelivered PDF blocks final QA. Omit it only when research establishes a concrete reason it would not help this buyer, recorded with supporting sources in the strategy brief and `funnel.json`. Lack of a supplied PDF, no explicit request, limited time or a page-only default is not a reason. Keep it secondary unless research supports a download-led offer; do not force an enquiry just to access it.
12. **Keep text work on the active AI provider.** Never require, install, authenticate, or invoke a second provider merely to write or review copy. Follow [platform-native model routing](references/model-routing.md): in Codex/ChatGPT prefer `gpt-6-astra` for the primary copy draft and `gpt-5.6-sol` for a separate review; in Claude use Sonnet for the draft and a separate Sonnet review. If a preferred model is unavailable, use the strongest suitable model already available from that same provider and record the actual model. Reviewer independence means a fresh context, not a different vendor.
13. **The built-in CRM is the form default.** For an enquiry, quote, consultation, assessment or other first-party form journey, scaffold and use the bundled Cloudflare Workers + D1 CRM unless the user explicitly asks for a static-only page or a different destination. Do not ask which CRM they use, request a Google Sheet, or make GTM/ad IDs/custom-domain selection prerequisites. Those are optional integrations after the page-to-CRM journey works. Read [owner next-step guidance](references/next-step-guidance.md) before answering “what next?” or preparing publication.

## Choose the smallest valid mode

- **Default landing page:** researched copy, custom responsive design, purposeful imagery, a useful PDF unless a researched exception applies, one real conversion path, local preview, and QA. A form-led path automatically uses the bundled Cloudflare/D1 CRM; use the default scaffold without `--static-only`.
- **Refresh:** preserve working behavior, then re-audit claims, brand, imagery, conversion behavior, accessibility, and QA.
- **Copy-only or audit-only:** produce only the requested analysis or copy. Do not scaffold a site or infrastructure.
- **Brochure/PDF:** select its useful content and delivery from research; read [references/catalogue-workflow.md](references/catalogue-workflow.md). A copy-only or audit-only request does not trigger PDF creation.
- **Built-in form backend and CRM:** a source form or newly selected enquiry form means lead collection is selected. Use the bundled same-origin `/api/leads` receipt path, D1 storage and authenticated CRM locally from the start. Omit it only for an explicit static-only request or a genuinely non-form conversion. A third-party CRM or spreadsheet is an optional downstream connection, not the default destination.
- **Optional tracking:** activate only when requested or supplied. Local page quality does not depend on GTM or ad-account access.
- **Attribution and consent UI are separate choices:** a new CRM build defaults to first-party campaign attribution stored with the submitted enquiry in `lead` mode. Optional analytics, advertising tags and customer-data matching remain disabled, so the default page has no consent UI. Do not disable lead attribution merely because GTM, advertising IDs or a consent provider are absent. Change the attribution policy only for a recorded owner or researched policy requirement. When optional tracking is enabled, use an external consent provider where required; do not generate a custom consent banner or treat an earlier stored choice as the provider's current signal. Continue to honor GPC/DNT.
- **Optional deployment or handoff:** activate only when requested. Use the user's chosen provider when stated; otherwise propose one simple supported route after the local final.

Do not expand a normal landing-page request into every optional module.

## Native execution and model routing

Before starting, read [references/orchestration.md](references/orchestration.md). Prefer the host's native parallel subagents with task-appropriate model and effort settings. Use the OpenAI profiles in ChatGPT/Codex or the Claude profiles in Claude Code, according to actual session capabilities. No Jev, external model API, new API key, proxy or cross-provider bridge is part of this workflow. When native delegation or model selection is unavailable, execute the same work sequentially with the current model and disclose that limitation instead of simulating subagents.

The coordinator owns the dependency graph, source-bound production contract, artifact reservations and integration. Existing copy-before-layout, imagery, visual/PDF acceptance, optional-module boundaries and publishing authorization remain authoritative. A routing task marked done is not a quality-gate pass or publication permission. Reserve final acceptance for a fresh reviewer when available and truthfully label self-review otherwise. Do not ask the business owner to choose worker models.

## Default workflow

### 1. Research autonomously

Read [references/research-and-claims.md](references/research-and-claims.md), [references/review-intelligence-and-testimonials.md](references/review-intelligence-and-testimonials.md), and [references/reference-fidelity.md](references/reference-fidelity.md). Keep the reference coverage map inside the existing strategy brief, not another report.

- Inspect the official website and the most relevant service, process, FAQ, testimonial, contact, legal, and media pages.
- Research real customer feedback when it is reasonably available. Identity-match the review source to the exact business/location, build `research/reviews/review-manifest.json`, analyse recurring customer problems, desired outcomes, praised capabilities, objections, benefits and voice-of-customer language, then run `review_workflow.py`. Keep aggregate review intelligence separate from publishable testimonial quotations.
- Select only complementary, provenance-safe testimonials. Preserve one reviewer's real quote, displayed identity, rating/date/source and source-authorized avatar together; never enrich, combine, fabricate or generate reviewer identity. Treat Google/restricted providers as optional compliant integrations rather than scrape targets or prerequisites.
- When useful, inspect verified official social accounts and credible editorial coverage. Use them to verify facts or discover first-party assets, not as automatic reuse permission.
- If a reference or existing landing page is supplied, map its useful buyer questions, proof roles, media rhythm, CTA logic, and pacing. Preserve the persuasive jobs, not its wording, assets, or literal section order.
- When direct competitors are readily discoverable and differentiation is unclear, inspect two or three official competitor pages. Record only the message gap the client can credibly occupy.
- Record material claims and their sources. Do not turn competitor claims into client facts.

Create one compact `build/strategy-brief.md` containing: buyer situation, likely decision stage, desired action, offer or result, real delivery mechanism, source conversion contract, primary objection, strongest trust anchor, traffic intent, typography provenance, and visual direction. Create `build/claim-ledger.md` for material claims that will appear. Do not create extra reports merely to prove activity.

### 2. Write the conversion argument

Read [references/model-routing.md](references/model-routing.md), [references/copy-and-structure.md](references/copy-and-structure.md) and [references/copy-doctrine.md](references/copy-doctrine.md) for every build, including static pages without a CRM. The benefit and differentiation review is core work, not an optional publishing check.

Before choosing layout, select an evidence-backed leading advantage in the strategy brief, write the complete copy master, and execute the two short editing passes in `copy-and-structure.md`. The first screen must explain the actual service, buyer benefit and concrete reason to choose this business. A generic outcome slogan or a service catalogue is not a substitute. Complete the copy before composing the page; design may improve its presentation, not silently remove the argument or qualifications.

Execute the second pass using [references/copy-acceptance.md](references/copy-acceptance.md). Save the real reader answers, source-anchored verdict and strongest challenge in the existing editorial review, then run `scripts/copy_acceptance.py verify` before HTML/layout work. The checker validates evidence and freshness; it cannot replace critical editorial judgment. Missing or failing copy acceptance blocks the build, not merely final delivery.

Create one implementation-ready copy master at `build/page-copy.md` or `build/page-copy.json`. Cover the buyer jobs supported by evidence: relevance, offer, proof, mechanism or fit, objections, process, conversion, and legal close. Merge only when the concrete decision help survives; a heading or generic sentence does not establish coverage. Keep the workflow lightweight, not the sales argument thin. No fixed section count applies. Resolve every material question named in the strategy, with sourced detail or an honest explanation of what must be assessed, rather than silently dropping it.

When the selected CRM/publishing scaffold uses the complete guarded Worker workflow, use `build/page-copy.json` from the start and read `references/copy-workflow.md`. Its rendered-copy gate requires the structured master; a Markdown-only capture is not equivalent. Keep the default no-copy-approval setting while preserving real editorial review and publishing authorization.

Use one exact primary CTA label. Explain the real operational reason the offer works. Map important benefits to actual capability or proof. Use truthful urgency only when a sourced deadline, capacity limit, or availability constraint exists. Replace generic hype such as `world-class`, `game-changing`, `seamless`, `robust`, or `innovative` with the specific action, limit, mechanism, or evidence unless the term is genuinely necessary and made concrete.

Every heading, CTA, and bullet must make sense to a first-time visitor. Keep technical terms that the real buyer uses, but simplify sentence structure. Treat word count as an editing signal, not a target.

In an uncommissioned demonstration, keep one clear disclosure near the first action and repeat only the safety boundary where needed: the experience is independent, fictional details only, and nothing is routed to the real business. The rest of the page still speaks to the buyer's decision and desired next step. Do not turn marketing sections, FAQ answers, thank-you copy or the PDF into a QA manual. Research narration, unsupported-claim assurances, GTM/consent setup, receipt verification, CRM cleanup and operator instructions belong in the existing editorial evidence or owner handoff. A demo CTA must name the useful buyer action it simulates, not invite the visitor to test the build.

### 3. Design for this business

Read [references/design-direction.md](references/design-direction.md).

Record the design decisions in the strategy brief: verified brand-guide typography when available, official-site typography, applied typography and any reason for changing it, type character and hierarchy, color roles and contrast, spacing rhythm, shape and surface language, composition pattern, image roles, and motion behavior. Extract the actual heading and body fonts rendered by the supplied official production page and use them by default. A current formal brand standard may override the page. Substitute only for a concrete licensing, loading, language-support, or accessibility reason; use a close visual match and record the reason. Never invent fonts from an industry stereotype.

Use `scripts/extract_brand.mjs <official-url> --out <project>/build/brand.json` for that research, then reuse the report in the existing `measure_page.mjs` pass. A custom browser route must retain equivalent actual glyph-font evidence and source/applied comparison, not just computed CSS family names. Reuse these helpers instead of writing duplicate research checks.

Apply the arbitrary-default font restrictions in `references/design-direction.md`. Verified client typography takes precedence over that list; do not replace a real brand font just because its family appears there. Robust fallback stacks are not new design choices.

Start from supplied assets and the business's observed identity. Supplied assets outrank scraped alternatives. Verify the correct logo variant against its rendered background and make the brand visible in the first viewport. Separate verified source colors from the applied interface palette, explain the role of each important applied color, and do not inherit the source website's visual age by default.

When the user supplies no design reference, use Blue Mountain as the built-in conversion-architecture benchmark and Clean Slate Land Solutions as the execution-quality benchmark described in the design reference. Do not clone either page. The first controls persuasive completeness; the second sets a minimum bar for current hierarchy, spacing, proof presentation, and finish.

Avoid an AI-template or legacy-brochure appearance. Do not default to violet or blue-purple gradients, repeated gray card grids, emoji icons, fake initial-avatar proof, all-centered sections, oversized headings inside compact panels, generic condensed display type, negative letter spacing, broad alternating saturated color bands, or three consecutive sections with the same composition. Vary scale, density, media, and layout according to each section's job while keeping one coherent system.

### 4. Research and create imagery

Read [references/image-research-and-generation.md](references/image-research-and-generation.md). Use real first-party imagery for proof. Image search is discovery, not permission. Native image generation may fill a non-proof visual gap without an API key, but generation is never mandatory when a sourced asset or a stronger layout solves the need.

Include at least four distinct, relevant content originals on a complete landing page. Normally plan five to ten placements, choosing the final number and roles from research and page coverage. Do not reuse a content picture in another section, including a different crop, recolor or overlaid version. Responsive derivatives for the same placement are allowed. A PDF cover preview may be useful, but a cover, screenshot or composite made from a page image does not create another original. Record shared source identities in the existing image plan so the image gate counts independent originals rather than rows or filenames. Logos, icons and decorative textures do not count toward the minimum. Each picture must support its adjacent message; a numerical target never authorizes irrelevant filler or fabricated proof. Follow the image reference if suitable assets cannot be obtained.

Classify each used image as `decorative`, `proof`, `portrait`, `diagram`, `screenshot`, or `illustrative`. Also mark whether its pixels contain information that must remain readable. Diagrams, screenshots, infographics, and text-bearing images must not use destructive `cover` crops and must not sit behind overlapping copy. Text must not cover a person's face or the subject needed to understand the image.

### 5. Build and deliver the PDF guide

Read [references/catalogue-workflow.md](references/catalogue-workflow.md). Adapt `build/guide.json` from the researched strategy, claims and copy master; it is content input, not permission to repeat generic template wording. Set `workflow_ready` to `true` only after every claim, qualifier, phone number, URL and follow-up promise is current.

Run `python3 scripts/build_guide.py .`. The command must generate the configured PDF under `public/assets/brochure/`, render every page into `build/guide-pages/`, extract its text, verify a real PDF signature and prove that the configured thank-you page contains a matching `data-guide-embed` preview and `data-guide-download` fallback. Inspect every rendered page at readable size and complete the existing catalogue review. Do not proceed to final page QA with a placeholder link or a PDF that exists only outside the served project.

### 6. Build the smallest honest conversion path

Read [references/build-contract.md](references/build-contract.md). For a form-led page also read [references/cloudflare-crm.md](references/cloudflare-crm.md) and use `scripts/scaffold_project.py` without `--static-only`. The bundled CRM is maintained shared infrastructure; configure it for the business instead of rebuilding or replacing it.

Default to semantic HTML, CSS, and JavaScript unless an existing project requires another stack. Derive the selected conversion from the source conversion contract, not from which credentials happen to be available. Form-entry CTAs open the same accessible modal without scrolling the page to an inline form. Add an inline placement only when the research supports it; share fields, state and submission logic rather than creating competing forms. Use only fields needed for response or routing. For a local/service business with a verified public enquiry number, show that number as a readable secondary click-to-call in the header or hero and final contact area; do not bury it only in the footer.

Create a thank-you page or success state when a form or gated delivery requires it. If no backend is configured, keep submissions local or disabled, state the limitation clearly, and do not emit a production conversion event.

For the default form-led build, a backend is configured: run the local Worker/D1 setup, submit a synthetic local enquiry, confirm its receipt in the authenticated CRM and verify reporting before presenting the local final. This needs no external CRM, Google Sheet, GTM container or advertising account.

### 7. Verify the actual output

Read [references/quality-gates.md](references/quality-gates.md). The page is not final until all selected gates pass after the last source change.

At minimum:

1. Run `python3 scripts/build_guide.py .` and inspect every rendered PDF page.
2. Run `scripts/scan_surfaces.py` against the project.
3. Run `scripts/validate_page.py` against the project.
4. Serve the page locally and test representative mobile, tablet, laptop, short-height laptop, and desktop viewports.
5. Capture and inspect the actual rendered pixels. Measurements and file presence are not visual approval.
6. Test the real selected conversion path, including validation, failure, success, thank-you redirect and guide download. Use synthetic data locally. Do not create a live lead without permission.
7. Run one local mobile Lighthouse pass. If it is not installed, attempt a run-local installation as described in the quality gates; an unsuccessful package lookup alone is not an unavailable-tool exception. Fix failures and repeat marginal results. Aim for Performance 90 or better, LCP at most 2.5 seconds, CLS at most 0.1, and TBT at most 200 milliseconds without deleting necessary proof.
8. Perform a fresh acceptance pass after the build. Use a separate reviewer or agent when available. Otherwise reopen the final artifacts in an isolated second pass without trusting earlier self-authored pass booleans.

When the user asks what happens next, inspect the actual workflow state and follow [owner next-step guidance](references/next-step-guidance.md). Name one current action. Do not respond with a shopping list of CRM, spreadsheet, GTM, ad-account, domain and hosting choices.

At every measured breakpoint, keep planned hero or primary media visibly rendered. Reorder, resize or reduce hero spacing to preserve both the image and first-screen action/continuation; never satisfy the fold check by hiding the image. In form QA, prove failure and uncertain copy is absent before submission and appears only in the actual matching state.

Record fresh acceptance in the existing visual report with truthful `independent` or `self_review` mode, reviewer and builder task provenance, the exact source fingerprint, concrete findings, fixes and evidence-backed retests, and remaining limits. A builder reread is valid self-review, not independent review.

Every severe finding blocks delivery. Resolve each warning or record a specific, evidence-based acceptance decision. A generic `looks good` or a screenshot path without observations is not review evidence.

Acceptance must compare the delivered behavior with the user's selected features, not just with the current configuration. A deliberately disabled requested feature is an unresolved blocker, not a passing negative test. The complete CRM workflow must retain the same page, copy and brand standards as the lightweight workflow; use the current bundled helpers rather than a frozen older checker. Keep a defect open until the corrected behavior is observed after the last relevant change. A targeted repair is not evidence that a fresh independent build will avoid the defect.

### 8. Deliver locally before external setup

Preserve the customer's current DNS provider by default. External-DNS subdomains use the Pages gateway/CNAME path in the domain reference, not a mandatory nameserver migration. Backend hosting is an implementation choice, not permission to move the customer's DNS. Only an explicitly authorized DNS migration may use the whole-zone setup path.

Present the local page, PDF or researched omission, conversion behavior, representative screenshots, and concise QA result first. Then request only the values needed by selected optional modules. Missing Cloudflare, GitHub, GTM, an ad account, an image API key or an external CRM must not block the local result. For a form-led page, the bundled local CRM is part of that result even before Cloudflare publication.

When publication is selected, use workers.dev by default when no custom domain was supplied or requested. Read `references/domain-and-owner-handoff.md` before external setup and again at handoff for any custom domain. Preserve the user's supplied domain and page/CRM hostnames without asking again. Research the registrar and authoritative DNS provider separately. A missing requirement for a selected module must produce an actionable message in this conversation, not merely a status-file entry. Do not report an optional sender, tracking ID or integration as a blocker when manual account links or disabled tracking satisfy the selected scope. At the local-final checkpoint, send the ready preview plus each real external blocker and its numbered owner steps; continue only unaffected authorized work. A delegated builder must return this handoff itself, without waiting for an orchestrator to ask. Before ending, save `build/owner-handoff.json` and run `scripts/validate_owner_handoff.py <project>` as described in that reference. A workers.dev release does not complete requested custom domains.

Use status language that matches reality:

- `local final` means the selected local experience passed its gates but external delivery may be unconfigured;
- `publish-ready` means the selected external configuration is present and preflight passed;
- `live and verified` means the actual destination and selected conversion path were tested after publication.

## Required visual acceptance

Use the visual and fresh-acceptance gates in [references/quality-gates.md](references/quality-gates.md), with image-specific rules in [references/image-research-and-generation.md](references/image-research-and-generation.md). Inspect actual readable pixels before writing the verdict. A report listing passed checks cannot override a visible collision, obscured person, wrong brand treatment or competing primary actions. Record whether the final review was independent or self-review.

When a brochure is selected, read [references/catalogue-workflow.md](references/catalogue-workflow.md), render every page, inspect each at readable size, and run `scripts/validate_catalogue_review.py`. Any clipping, truncation, unreadable copy, text-on-information collision, or text covering a person blocks the brochure and the final result.

## Optional modules

Load these only when selected:

- **Advertising and GTM:** [references/advertising-tracking.md](references/advertising-tracking.md). Keep raw contact data out of analytics. The optional contract uses `customer_data_ready` for consented provider-normalized hashes and `lead_accepted` for the confirmed conversion receipt. Google is primary; Meta and Microsoft require destination-specific verification.
- **Lead backend and CRM:** [references/lead-and-tracking-contract.md](references/lead-and-tracking-contract.md) and [references/cloudflare-crm.md](references/cloudflare-crm.md). Reuse the bundled tested backend; customize configuration, not the attribution/storage/auth implementation. Verify both shared-code identity and the requested campaign values persisted in the CRM.
- **Cloudflare publishing:** [references/guided-publishing.md](references/guided-publishing.md). Deployment is not implied by a local build.
- **Long-lived handoff, retention, backup, or recovery:** load the matching existing references only when requested.

No optional module may weaken the absolute rules or change a stored lead into an apparent failure because analytics failed.

## Default deliverables

- responsive landing page and local assets;
- a linked, rendered and reviewed useful PDF, or a source-supported omission in the strategy brief;
- the selected conversion behavior and a thank-you state when applicable;
- compact strategy, claim, copy, and image notes;
- representative mobile, tablet, laptop, short-height laptop, and desktop screenshots;
- concise QA summary with fixed findings and honest external limits.

Optional modules add only their own necessary artifacts. Do not create infrastructure as proof that the page was built.


## Explicit native guide-image handoff

Use [references/guide-image-handoff.md](references/guide-image-handoff.md) when a PDF needs an explanatory image not available from permitted sources. The persisted `image_handoff` action returns the actual native request once; an unavailable tool is a precise handoff, not a repeated model run or new API-key requirement. Resume after registering and linking the real output, or explicitly reconcile a permitted source fallback.
