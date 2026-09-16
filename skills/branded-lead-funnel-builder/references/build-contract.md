# Build Contract

## Static funnel output

```text
index.html
thank-you.html
styles.css
script.js
assets/
  brochure/catalogue.pdf
  brochure/cover-320.webp
  brochure/cover-600.webp
  fonts/
  images/optimized/
  reviews/
```

Use a framework only when the existing project or user requires it.

## Hero and CTA

- Keep the client-specific visual subject visible; do not cover it with an oversized white card.
- On desktop, match the reference's information hierarchy, not its exact geometry.
- On mobile, keep the phone and CTA reachable without crowding the H1.
- Use the real brochure cover beside or within the CTA.
- A compact CTA may contain only cover, headline, and button when clarity improves.

## Form

- Use one modal form when modal-only was requested.
- Render no hidden duplicate inline form for convenience.
- Use only approved fields and option values.
- Divide steps by mental task: contact, project/service fit, scope/timing, authority/preference.
- Validate the current step before advancing.
- Support Back, Escape, backdrop close, focus trap, and focus restoration.
- Preserve entered values when moving backward.
- On submission, wait for the lead-delivery response. Redirect only on confirmed success when a real endpoint is configured.
- Commit delivery success before analytics. A tracking failure after webhook success must not show “lead not sent” or re-enable submission, because that invites duplicate leads.
- Local-preview submissions must not emit a production `lead_form_submit` event.
- Show a useful phone fallback on failure.

`assets/multistep-lightbox.js` expects:

- modal `#lead-modal` with `aria-hidden`;
- persistent visible title referenced by the dialog's `aria-labelledby` on every step;
- form `.wizard[data-lead-form]`;
- fieldsets `.wizard__step`;
- controls `[data-next]`, `[data-back]`, `[data-submit]`;
- `[data-step-current]` and `[data-progress]`;
- step counter inside a polite live/status region;
- CTA triggers `[data-open-modal]`;
- form `data-webhook`, `data-thank-you`, `data-storage-prefix`, and `data-fallback-phone` as needed.
- optional `data-webhook-timeout` in milliseconds; default is 15000.
- visible error region `[data-form-error]` with `role="alert"` and `tabindex="-1"`.

Start from `assets/multistep-lightbox.example.html` when creating new markup; replace its placeholder fields and labels only after `FORM-SCHEMA.md` is approved. Remove `data-local-preview="true"` when a real webhook is configured.

## Tracking and privacy

- Persist UTM parameters and `gclid`, `gbraid`, `wbraid`, and `fbclid` through submission.
- Never push raw name, email, phone, free text, address, or uploaded data into `dataLayer`.
- Built-in reporting sends no contact values. If an approved advertising adapter requires contact hashes, normalize/hash only the specified fields and verify the provider configuration separately.
- Keep lead payload delivery separate from analytics payloads.
- Do not include session state or test data in the handoff package.

## Performance

- Prefer responsive WebP/AVIF plus a source fallback.
- Add image width and height attributes.
- Eager-load only the hero/LCP asset; lazy-load below-fold imagery.
- Use a cover image instead of embedding/loading the PDF in the page.
- Self-host WOFF2 fonts when licensing and source permit; keep weight count small.
- Avoid large libraries for modal/form behavior that needs only plain JavaScript.
- Check the actual network waterfall; file sizes alone do not prove good LCP.

## Accessibility

- Semantic headings, labels, fieldsets, legends, button types, and alt text.
- Keyboard-visible focus and logical tab order.
- Modal `role="dialog"`, `aria-modal="true"`, labelled title, and restored focus.
- Required-state and error communication cannot depend on color alone.
- Respect reduced motion.

## Cloudflare output and current lead helper

With the default scaffold, the static files above live in `public/`. Load `funnel.js` before `script.js`, both deferred. Use `data-endpoint="/api/leads"`; the response must follow `lead-and-tracking-contract.md`. `data-webhook` remains a URL alias only and must implement the same receipt contract; arbitrary legacy webhook responses are not accepted. `data-local-preview="true"` is only for an explicitly simulated, endpoint-free static preview and is prohibited by production preflight.

Do not hash or transmit contact data for built-in reporting: its event contains only a receipt ID. Current helpers contain delivery errors separately from analytics; preserve them. The UI locks the pending request's fields and replays exactly the same body/key when the response is uncertain, then unlocks only after a definite validation rejection. The accessible error explains the uncertainty.
