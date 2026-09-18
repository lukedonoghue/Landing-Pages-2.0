# Build Contract

## Output shape

Use the smallest structure appropriate to the project. A normal static build may contain:

```text
index.html
styles.css
script.js
assets/
build/
```

Add `thank-you.html` only when the selected journey needs a separate success page. Add brochure, backend, CRM, tracking, publishing, or handoff files only when that module is active. Use a framework only when the existing project or user requires one.

## Responsive page

- Use semantic landmarks and one clear H1.
- Include a keyboard-visible skip link.
- Make the brand, offer, and primary action clear in the first viewport.
- Use stable layout constraints so text, images, controls, and dynamic states do not shift or overlap.
- Keep variable-length labels and adjacent headings in normal flow, grid or flex tracks sized for their actual text. Do not reserve a guessed fixed gutter and absolutely position a longer category label into it.
- Do not scale body or heading type directly with viewport width. Use deliberate responsive steps or bounded fluid sizing only where needed.
- Avoid fixed minimum widths inside responsive grid tracks and emergency word breaking on short UI labels.
- Inspect the 1024 to 1199 pixel range for readable prose, not just overflow. Stack testimonial columns before padding and default `blockquote` margins squeeze ordinary copy into one-to-three-word lines; reset those margins when defining a grid.
- Use at most one persistent mobile CTA. Fixed UI must not cover focused controls, legal links, the final section, or the form action.
- Footer links must use a real list or flex layout with explicit gaps. Do not rely on source whitespace for separation.

## Images and media

For every downloaded asset or font licence, require a successful HTTP response (for example, `curl --fail --location`) and inspect its actual content/type. A saved filename or `file` reporting ASCII text does not establish that it contains a licence rather than a server error.

Mark each meaningful image with `data-image-role="proof|portrait|diagram|screenshot|illustrative"`. Decorative images use `data-image-role="decorative"` and `alt=""`. Add `data-content-bearing="true"` to diagrams, screenshots, infographics, documents, maps, and any image whose internal text or labels must remain visible.

- Meaningful images need factual alt text. Decorative images need empty alt text.
- Add explicit dimensions and responsive sources where useful.
- Eager-load the single likely LCP image. Lazy-load below-fold imagery.
- If preloading a responsive image, match its `imagesrcset` and `imagesizes` to the rendered image, or omit the redundant preload. Check that mobile does not download both a fixed desktop preload and its selected responsive candidate.
- Never use `object-fit: cover` on content-bearing images.
- Do not overlay copy on content-bearing pixels.
- Do not place copy over a face, essential product detail, or focal subject.
- Generated illustration must not occupy a proof role.
- Video, when materially useful, starts from a meaningful poster and click-to-load controls. Respect reduced motion and provide a fallback.

## Conversion paths

Choose one honest primary path: form, booking, call, email, download, or another real destination.

Preserve the dominant conversion mechanism and offer of a supplied business page unless the user requests a change or the source path is demonstrably dead or unsafe. Missing credentials, backend access, or deployment access affects production wiring only. It does not authorize changing a form journey into a call, email, or unrelated CTA.

Record the source conversion contract before implementation: CTA label and offer, conversion type, required fields, consent text, promised delivery or follow-up, destination type, and success behavior. Treat a public endpoint as evidence of the existing architecture, not permission to reuse it or send data to it.

Mark the main CTA controls with `data-primary-action`. Modal openers also use `data-open-modal`. These attributes make short-height and obstruction checks deterministic; they do not replace clear visible labels.

For forms:

- collect only fields needed for response or routing;
- use explicit labels and appropriate autocomplete/inputmode values;
- allow paste and autofill;
- trim required text before checking for emptiness; native `required` alone accepts spaces, and `type="tel"` does not validate a phone number. Reject blank-after-trim values and obviously unusable phone input without requiring a narrow national format;
- preserve an entered international phone country code and avoid cursor-jumping masks;
- associate every custom error with its field using `aria-describedby` or a native validation relationship;
- show errors near the field and in an announced summary when useful;
- keep the primary action visible at short viewport heights;
- show success only after the configured destination confirms success;
- provide a useful failure and retry path;
- guard the submit handler against re-entry with an in-flight flag set before the first asynchronous operation and cleared in `finally`; disabling the button is additional UI feedback, not the guard.

In a scrolling form or modal, a submission failure must become visible and announced without visitor exploration: place it beside the action or move focus to a focusable error summary and reveal it. Keep entered values for retry. Calling `.focus()` on an ordinary non-focusable element is not sufficient. Test failure from the actual submit position, not after the test script scrolls to the message.

When production form wiring is pending, still build and test the complete form-first experience. Use an isolated local receiver or test adapter for synthetic QA when available, or keep production submission disabled and label the result `local preview`. Never submit to an existing live endpoint without authorization. Never show a production success state merely because a local timer, navigation, or ignored network response completed.

Keep the visible preview notice plain: the form does not send details yet. Put provider names, endpoints and connection instructions in the owner handoff, not in customer field help or success copy.

A separate preview thank-you page is still part of the visitor experience, not a second owner setup guide.

A modal may be single-step or multi-step. Use native `dialog` or an equivalent document-level focus guard, restore focus to the opener, support Escape, and test programmatic focus escape. Internal scrolling is acceptable only when the action remains obvious and reachable.

For a phone, email, booking, or download action, verify the actual `tel:`, `mailto:`, URL, or file. Do not use `href="#"` or a fake success screen as the primary destination.

## Accessibility and behavior

- Target WCAG 2.2 AA contrast.
- Keep browser zoom enabled.
- Use persistent visible focus, not hover-only indication.
- Use at least 24 by 24 CSS pixel targets, with 44 by 44 preferred for primary touch controls.
- Do not use color alone to communicate state or link purpose.
- Respect `prefers-reduced-motion`; content is visible without JavaScript animation.
- Ensure consent and chat controls can be reached and dismissed without obscuring conversion content.
- Preserve a logical heading and tab order.

## Metadata and destinations

Use a descriptive title and meta description. Add structured data only for supported facts. Keep preview/private/thank-you routes out of search where appropriate, while an intended public landing page remains indexable after launch. Privacy and terms links must resolve to real, relevant destinations.

## Tracking and privacy

Tracking is optional. Preserve approved campaign parameters through the selected conversion path when needed. Never put raw name, email, phone, address, free text, or uploaded content in analytics. Hashing is not permission: consent, category restrictions, provider policy, and destination testing still apply.

If no backend or tracking destination is configured, say so in the QA summary. A form-first page without a confirmed production destination may be a complete `local preview`, but it is not a live lead path. A local receiver may support a `local final` when the full synthetic form journey is verified and the external limitation is explicit.
