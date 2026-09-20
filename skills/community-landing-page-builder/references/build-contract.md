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
- In spanning image grids, place tall items explicitly when needed; inspect the whole gallery for unintended empty tracks, not only each image crop. Prefer a simpler grid over a broken collage.
- Keep variable-length labels and adjacent headings in normal flow, grid or flex tracks sized for their actual text. Do not reserve a guessed fixed gutter and absolutely position a longer category label into it.
- Do not scale font size with viewport-width units, including inside `clamp()`. Use fixed rem/px sizes with deliberate responsive breakpoints.
- Avoid fixed minimum widths inside responsive grid tracks and emergency word breaking on short UI labels.
- Inspect the 1024 to 1199 pixel range for readable prose, not just overflow. Stack testimonial columns before padding and default `blockquote` margins squeeze ordinary copy into one-to-three-word lines; reset those margins when defining a grid.
- Use at most one persistent mobile CTA. Fixed UI must not cover focused controls, legal links, the final section, or the form action.
- Footer links must use a real list or flex layout with explicit gaps. Do not rely on source whitespace for separation.

## Images and media

For every downloaded asset or font licence, require a successful HTTP response (for example, `curl --fail --location`) and inspect its actual content/type. A saved filename or `file` reporting ASCII text does not establish that it contains a licence rather than a server error.

Mark each meaningful image with `data-image-role="proof|portrait|diagram|screenshot|illustrative"`. Decorative images use `data-image-role="decorative"` and `alt=""`. Add `data-content-bearing="true"` to diagrams, screenshots, infographics, documents, maps, and any image whose internal text or labels must remain visible.

- Meaningful images need factual alt text. Decorative images need empty alt text.
- Add explicit dimensions and serve appropriately sized, efficiently encoded photo variants at every placement, including repeated and below-fold proof. Do not send an untouched full-resolution source photograph to phones by default; retain the original as research and check the rendered crop and sharpness after optimization. A good Lighthouse score from an optimized hero does not clear the gallery. Compare source bytes and an appropriate derivative once per asset; a non-multi-megabyte JPG is not automatically optimized.
- Intrinsic HTML dimensions are not responsive CSS. For a natural-ratio image, use `width: 100%; height: auto`; for a crop, size the actual image box deliberately. An explicit CSS `aspect-ratio` does not override a fixed HTML/CSS height. Verify the rendered ratio at each layout breakpoint.
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

Mark the main CTA controls with `data-primary-action`. Every form-entry CTA also uses `data-open-modal` and opens the same accessible dialog at the visitor's current page position, not an anchor jump to a form section. Prefer `button type="button"` for openers. A fragment-link fallback must prevent navigation when opening the dialog. Normal navigation, call, email and genuine external booking/purchase/download controls retain their roles.

Default to one modal form. If research supports an inline form as well, reuse the same form component, field definitions, values, errors, pending/confirmed state and submit handler. Moving one form node into the dialog and restoring it on close is one lightweight option; preserve the inline slot's height and page position while it is moved. Never duplicate IDs, independent submissions or reset the form just because its presentation changes. Its own submit button submits; it is not another modal opener.

For local/service businesses, a verified public enquiry phone number is visible and clickable in the header or hero and final contact area at mobile and desktop sizes. Keep it subordinate in styling, not footer-only. Do not hide all visible digits behind an icon or an unexplained person's name. Verify the number from the business source; if no suitable number is public, record that limit rather than inventing one.

For forms:

- collect only fields needed for response or routing;
- use explicit labels and appropriate autocomplete/inputmode values;
- allow paste and autofill;
- trim required text before checking for emptiness; native `required` alone accepts spaces, and `type="tel"` does not validate a phone number. Reject blank-after-trim values and obviously unusable phone input without requiring a narrow national format;
- preserve an entered international phone country code and avoid cursor-jumping masks;
- reject arbitrary alphabetic junk in phone input, not just values with too few digits after stripping characters; allow normal international separators and a deliberate extension format, and submit the validated representation;
- associate every custom error with its field using `aria-describedby` or a native validation relationship;
- show errors near the field and in an announced summary when useful;
- keep the primary action visible at short viewport heights;
- show success only after the configured destination confirms success;
- provide a useful failure and retry path;
- keep field errors and the error summary consistent as fields are corrected;
- guard the submit handler against re-entry with an in-flight flag set before the first asynchronous operation and cleared in `finally`; disabling the button is additional UI feedback, not the guard.

Treat submission as a small state machine: editing, pending, failed/uncertain, and confirmed. Bind each response to its submitted snapshot and request/session identity. Closing and reopening must not turn an old response into confirmation of newly edited values. A simple default is to retain the pending or confirmed view on reopen and offer an explicit `New enquiry` reset after confirmation. Disable conflicting edits while pending or keep them separate from the submitted snapshot. Use a bounded request wait and recoverable uncertainty message; cancelling a browser request does not prove that server-side processing stopped, so never retry automatically or promise that nothing arrived without evidence.

In a scrolling form or modal, a submission failure must become visible and announced without visitor exploration: place it beside the action or move focus to a focusable error summary and reveal it. Keep entered values for retry. Calling `.focus()` on an ordinary non-focusable element is not sufficient. Test failure from the actual submit position, not after the test script scrolls to the message.

Choose one visible focus destination for each validation or result state. For validation, keep focus on a useful linked summary or reveal and focus the first invalid field; do not focus the summary and then redirect focus elsewhere with `preventScroll`. Check the focused target after layout and any scrolling settle, including ordinary motion as well as reduced-motion behavior.

Reveal validation context, not just the input rectangle: the field's label, focus outline and inline error must remain visible. Native focus scrolling can align an input to the top edge and hide its label when submission starts farther down the page. Reveal its containing field group with sensible scroll spacing, or focus and reveal the error summary; keep one focus destination.

Each summary link must reveal and focus its usable control. For a radio group, focus the selected or first radio, not a non-focusable error span after the group.

Persistent form actions must not cover fields reached by keyboard. Prefer a separate action row outside the scrolling field region; if using an overlapping sticky bar, reserve its actual height in the scroll layout and scroll padding. Tab through the form normally at mobile and short-height sizes. A visible submit button and a visible failure message do not prove the intervening inputs remain visible.

When production form wiring is pending, still build and test the complete form-first experience. Use an isolated local receiver or test adapter for synthetic QA when available, or keep production submission disabled and label the result `local preview`. Never submit to an existing live endpoint without authorization. Never show a production success state merely because a local timer, navigation, or ignored network response completed.

For a disconnected preview, use plain visitor wording such as `This preview does not send details. Your entries are still here.` The error and success states remain visitor-facing even when the owner is testing them. Put provider names, endpoints and instructions to connect, configure or replace anything only in the owner handoff, never in those states.

A synthetic success can simply say `Preview complete. Nothing was sent.` Keep explanations of adapters, receivers, QA, form journeys and future production behavior in the owner handoff. Let the result panel fit its content within the viewport; do not retain the tall scrolling form's empty shell after its fields disappear.

A separate preview thank-you page is still part of the visitor experience, not a second owner setup guide.

A modal may be single-step or multi-step. Use native `dialog` or an equivalent document-level focus guard, restore focus to the opener, support Escape, and test programmatic focus escape. Internal scrolling is acceptable only when the action remains obvious and reachable.

Keep the dialog title and visible close control inside the viewport throughout validation, field focus, scrolling and result states. Prefer a non-scrolling header and a separately scrolling form body; any sticky header must remain unobscured and must not cover focused labels or errors. Scrolling an invalid field into view must not scroll the dialog's exit off-screen. Escape support does not substitute for a visible pointer/touch exit.

For a phone, email, booking, or download action, verify the actual `tel:`, `mailto:`, URL, or file. Do not use `href="#"` or a fake success screen as the primary destination.

For an email-led source journey, prefer its direct email action over inserting a mandatory data-entry form. If researched visitor needs justify a draft-preparation form, disclose beside the entry CTA, before opening it, that an email app and a separate Send step are required; retain a direct email fallback. Do not require fields merely to generate a mailto link when an ordinary email already serves the offer. A prepared draft is not a submitted enquiry.

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
