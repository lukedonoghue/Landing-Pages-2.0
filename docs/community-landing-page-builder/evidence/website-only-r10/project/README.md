# Stayclean landing page

This is a complete local landing-page preview for Stayclean. It has not been published and the quote form does not send customer details yet.

## Open the local preview

The current preview is running at:

`http://127.0.0.1:4187/`

To start it again later, open a terminal in this folder and run:

```bash
STAYCLEAN_PORT=4187 node local-server.mjs
```

Then open `http://127.0.0.1:4187/` in a browser. If port 4187 is busy, replace it with another port in both places.

## Publishable site files

These are the files Cloudflare should serve:

- `index.html`
- `styles.css`
- `script.js`
- `assets/`

Do not publish `build/` or `local-server.mjs`. They are local QA and preview tools.

## Cloudflare form connection

The form is already configured to send JSON to `POST /api/quote`. A later Cloudflare Pages Function or Worker should:

1. Validate the fields again on the server.
2. Deliver or store the enquiry securely.
3. Return HTTP 200 with `{ "ok": true }` only after delivery or storage succeeds.
4. Return a non-2xx response when delivery fails.
5. Add spam protection, rate limiting, and any required privacy controls.

The page automatically shows the real sent confirmation for `{ "ok": true }`. Failed responses keep the visitor's entries in place and show a retry message.

Before launch, submit one clearly labelled test enquiry on the final domain and confirm it reaches the intended inbox or CRM. Also recheck the privacy link, phone links, WhatsApp link, and all responsive layouts on that domain.

## Evidence

Research, claim sources, screenshots, browser checks, form-flow checks, and Lighthouse results are in `build/`. See `build/qa-summary.md` for the final verdict and known limits.
