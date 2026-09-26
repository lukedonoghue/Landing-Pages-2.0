# Image Research and Generation

## Plan coverage and distinct roles

For a complete landing page, include at least four distinct, relevant content originals, normally five to ten placements when research supports useful roles. Choose the final number from the offer, buyer questions and page structure. Spread images through the relevant sections rather than collecting them in a filler gallery. Logos, icons, decorative textures, duplicate placements and alternate crops of one picture do not count toward the minimum. A useful diagram or screenshot can count only when its independent source content explains researched information; a PDF cover screenshot or composite that reuses a page photograph remains that photograph and does not add an original.

Do not display the same content picture twice on the page, even after cropping, mirroring, recoloring, renaming or adding an overlay. Each content placement needs its own genuinely different picture, not a near-duplicate of the same composition. Responsive resolutions/crops used interchangeably at one placement are allowed and count as one image. Repeated brand logos and interface icons are exempt from the reuse ban but never count as content images. Check visual identity and source-to-derivative mappings in the existing image review, not just filenames.

For each selected asset, record in `build/image-plan.md` or `build/image-plan.json`:

- section and persuasive purpose, including the visible subject/action that supports its adjacent message;
- role: `decorative`, `proof`, `portrait`, `diagram`, `screenshot`, or `illustrative`;
- whether its pixels contain labels or information that must remain readable;
- source URL or supplied-file reference and retrieval date;
- rights basis for publication, or `local preview only` while rights remain unresolved;
- intended desktop and mobile treatment; for a hero, name the proof-bearing feature and the copy-safe area in that same note;
- alt text, or empty alt for decoration;
- final local path and review screenshot.
- `source_original_ids` for every independent original represented in the pixels, plus whether the placement counts toward the four-original page minimum. Responsive variants share one ID. A preview/composite lists the source IDs it reuses and normally does not count.

Use a compact table for a few ordinary first-party assets. Use a structured manifest when the build has several images, proof-sensitive assets, generated images, or many derivatives.

Relevance is separate from realism, provenance and disclosure. Before sourcing or generating, name what the visitor should understand from the picture. A generic workspace or an arbitrary customer's trade is not enough merely because the business serves small businesses. Use a customer-industry scene only when the researched audience and adjacent copy explain that specific connection. Otherwise show the actual service, a truthful illustrative service activity, or useful process information. Do not invent a client relationship. Meeting the count does not prove adequate visual coverage or relevance.

## Research order

1. Inspect the official website, including lazy-loaded galleries, media pages, team pages, brochures, and video posters.
2. Inspect verified official social accounts when useful for identity or discovery.
3. Inspect credible editorial coverage when it can verify a public event, person, location, or product.
4. Use broader image search to discover candidates or source pages.
5. Generate only a remaining non-proof visual gap.

Search results, social posts, and editorial pages do not automatically grant reuse rights. Prefer user-supplied or clearly first-party assets. Record uncertainty instead of presenting local preview use as publication permission.

## Truth classes

- **Proof:** actual client work, result, location, product, team member, customer, testimonial source, credential, or official document. Must be verified first-party or user-supplied evidence.
- **Portrait:** a verified real person tied to the client and used with an appropriate rights basis.
- **Diagram or screenshot:** information-bearing pixels. Preserve every label and detail with `contain`, a separate figure, or native HTML.
- **Illustrative:** sourced or generated atmosphere, hypothetical process, or generic context. It cannot support a factual claim by appearance.
- **Decorative:** visual texture with no information. Use empty alt text.

Do not relabel proof as illustration to bypass provenance. Do not use an initials avatar as if it were a customer photograph.

Reviewer/customer avatars follow [review-intelligence-and-testimonials.md](review-intelligence-and-testimonials.md). Treat them as proof-bearing identity media: never generate them, never source a different person's portrait, never enrich a reviewer from unrelated social profiles, and render an avatar only when that exact review is `publishable_full` with matching avatar provenance. A testimonial remains valid without a portrait when text publication is allowed but avatar publication is not.

## Native generation

Use the available native image-generation tool when generation materially improves a non-proof visual role. No API key or exact model selection is required. Record the actual tool and any model identity the tool reports; never invent one.

For the native default, omit `generation.requested_model` or set it to null. An unreported model is a disclosed metadata limitation, not an image-quality failure or an extra approval checkpoint. Retain actual tool/output evidence and complete the same provenance, relevance, crop and rendered-review checks. If the user explicitly requested an exact model, preserve that requirement and report inability to verify it; do not silently downgrade or erase the request to pass the gate.

Follow the tool's declared result/display format; do not assume every tool returns an MCP `content` array. For the Codex code-mode `image_url` / `output_hint` result, use `generatedImage(result)` and read `result.output_hint`; never print the base64 payload as text. If response handling fails after a successful call, recover and inspect the returned asset or saved path before generating again. Save selected originals inside the run's research assets, outside published assets. In the existing image plan, retain each exact submitted prompt verbatim (not a summary), returned original filename, local original and final derivatives. Do not leave provenance dependent on private conversation history or a tool-managed temporary directory. Regenerate for a concrete visual defect, not merely a missing display.

For that Codex tool contract, use this result handling, including inside a loop over different prompts. Do not replace it with `text(JSON.stringify(result))`; image bytes inflate output and can truncate the useful file reference.

```js
const result = await tools.image_gen__imagegen({ prompt });
generatedImage(result);
if (result.output_hint) text(result.output_hint);
```

Generated real-world images should use plausible settings, natural light, realistic materials, coherent anatomy, and restrained post-processing. Avoid glossy generic stock staging when official documentary imagery is present.

Do not request or rely on:

- readable logos, awards, certificates, contracts, dashboards, reviews, financial figures, license plates, or official documents;
- a generated person presented as a real customer, employee, franchisee, patient, founder, or testimonial source;
- invented client locations, projects, before-and-after evidence, or measurable results.

Add an adjacent disclosure when a reasonable viewer could mistake the image for a real client, place, project, or product state. The alt text should also identify it as illustrative. Prefer a normal-flow `figcaption` in the image's own figure. If overlaid, explicitly preserve its paint order when the image changes from background to stacked content at responsive breakpoints. Verify that the caption is actually readable in the rendered pixels at each tested width, not merely present in the DOM, alt text or image plan.

## Placement rules

- Inspect the original at full size before cropping.
- Protect faces, hands, product details, text, and evidence-bearing regions.
- Never crop a diagram, screenshot, roadmap, document, or infographic with `cover`.
- Never put headings or body copy over information-bearing pixels.
- Keep the essential subject inspectable. Text, CTA buttons, panels and heavy scrims must not obscure faces, equipment or the proof the image is meant to show. `content-bearing=false` does not exempt a photograph from this rule. If the subject cannot coexist with hero copy at mobile width, choose a better asset or composition instead of darkening or cropping it into background texture.
- Validate a hero candidate with its actual copy and all primary/secondary action footprints at every required width, including 1024px laptop and 1280 x 600 short-height, before committing to that image. Check the named proof-bearing feature, not merely whether the object is recognizable: copy across glazing, a finished surface or equipment can hide the very detail the photograph is meant to prove. Reserve genuine copy space with crop/position, choose another verified asset, or place the proof unobstructed nearby. Endpoint mobile/desktop approval does not clear intermediate collisions. Revealing the next section must not cut away the proof subject. A group photo that cannot preserve its people outside the overlay belongs in an unobstructed supporting proof block, not behind the hero controls.
- Keep the mobile hero focused on the headline, concise lead and primary action. Move secondary contact controls and proof strips directly below it when they consume the subject's clear space; do not darken the subject to make every desktop overlay fit.
- Use official images for proof and keep illustrative imagery visually subordinate to sourced proof.
- Keep sourcing terms such as `first-party`, `proof asset`, and `verified media` in the research notes. Visitor-facing captions should describe the actual subject or useful context, while retaining any necessary generation disclosure.
- A downloadable guide preview must show the actual cover or a verified page spread.

## Review evidence

Review every used image in its actual desktop and mobile placement. Evidence must identify the asset and its rendered element or use an asset-specific crop. Reusing the same generic full-page screenshot for every image is not sufficient.

In this existing review, count distinct qualifying source originals and check their distribution against the image plan. Count source identity, not asset rows, filenames, crops, responsive variants, composites or document previews. Fewer than four on a complete page is an unmet requirement, not a final pass. If research, available generation and truthful diagrams cannot supply four suitable originals, report the specific missing roles and asset/tool limitation instead of padding the page or silently waiving the minimum. Do not add a separate review round for the count.

For each image confirm:

- the intended file loaded;
- its dominant visible subject/action supports the adjacent offer or message without needing a vague caption to explain the connection; inspect the pixels, not only the prompt. A realistic, correctly disclosed image can still fail relevance. Replace or redesign it when it suggests a different service or adds only generic atmosphere to a service-explanation section;
- the subject and all labels remain visible;
- the crop is deliberate at every tested viewport;
- no text collision or false implication exists;
- alt text matches the actual role;
- generated artifacts, malformed text, or misleading details are absent;
- file size and dimensions are reasonable.

If a suitable image cannot be sourced or generated honestly, redesign the section. Do not silently remove a needed proof role or fill it with fabricated evidence.

## Rights, classes and slots (field-tested, September 2026)

* Use `--rights local-preview-only` when reuse is not yet authorised (for example an uncommissioned demonstration). It is honest for local previews and blocked for handoff and live gates until replaced with a real basis.
* `trust_class` accepts the SKILL.md role words as aliases (`proof` = `client-proof`; `portrait`, `diagram`, `screenshot` = `illustrative`). The rendered `<img>` still needs `data-image-role` with the role word.
* Add a placement to an existing plan with `image_workflow.py add-asset --spec slot.json`, then acquire and optimise it. Inventory reads lazy-loading attributes (`data-src`, `data-lazy-src`, `bv-orig-srcset`, `data-srcset`). Optimisation converts CMYK and other modes to sRGB before encoding; the original stays hash-locked.
* Treat portfolio photos labelled with suburbs outside the service area, or manufacturer "lifestyle" shots, as illustrative product imagery, never as the client's own job.
