# Image Research and Generation

## Plan by role, not quota

Use imagery where it explains the offer, proves something real, shows the people or product, clarifies a process, or improves the reading rhythm. Do not add images merely to reach a count.

For each selected asset, record in `build/image-plan.md` or `build/image-plan.json`:

- section and persuasive purpose;
- role: `decorative`, `proof`, `portrait`, `diagram`, `screenshot`, or `illustrative`;
- whether its pixels contain labels or information that must remain readable;
- source URL or supplied-file reference and retrieval date;
- rights basis for publication, or `local preview only` while rights remain unresolved;
- intended desktop and mobile treatment; for a hero, name the proof-bearing feature and the copy-safe area in that same note;
- alt text, or empty alt for decoration;
- final local path and review screenshot.

Use a compact table for a few ordinary first-party assets. Use a structured manifest when the build has several images, proof-sensitive assets, generated images, or many derivatives.

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

## Native generation

Use the available native image-generation tool when generation materially improves a non-proof visual role. No API key or exact model selection is required. Record the actual tool and any model identity the tool reports; never invent one.

Follow the tool's declared result/display format; do not assume every tool returns an MCP `content` array. For the Codex code-mode `image_url` / `output_hint` result, use `generatedImage(result)` and read `result.output_hint`; never print the base64 payload as text. If response handling fails after a successful call, recover and inspect the returned asset or saved path before generating again. Save selected originals inside the run's research assets, outside published assets. In the existing image plan, retain each exact submitted prompt verbatim (not a summary), returned original filename, local original and final derivatives. Do not leave provenance dependent on private conversation history or a tool-managed temporary directory. Regenerate for a concrete visual defect, not merely a missing display.

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

For each image confirm:

- the intended file loaded;
- the subject and all labels remain visible;
- the crop is deliberate at every tested viewport;
- no text collision or false implication exists;
- alt text matches the actual role;
- generated artifacts, malformed text, or misleading details are absent;
- file size and dimensions are reasonable.

If a suitable image cannot be sourced or generated honestly, redesign the section. Do not silently remove a needed proof role or fill it with fabricated evidence.
