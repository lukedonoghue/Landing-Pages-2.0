# Cloudflare handoff

This project is a **local final** preview. The enquiry form is deliberately in `preview` mode and sends only synthetic entries to the loopback test receiver. Uploading the static files alone will not create a live lead path.

## Connect the lead destination

1. Create a same-origin Cloudflare route at `POST /api/enquiry`. It must accept JSON with `name`, `email`, `phone`, `message`, and `marketing` (a boolean). Validate required fields server-side. Keep marketing consent separate from the enquiry response.
2. Deliver or store the enquiry in an owner-approved destination. Return HTTP 2xx with JSON `{"ok":true,"receipt":"a-unique-confirmation-id"}` **only after** the destination confirms acceptance. Return a non-2xx response on rejection. Do not treat analytics completion as lead acceptance.
3. Once that route has been configured and tested with explicit authorization, change `data-form-mode="preview"` to `data-form-mode="live"` on the single form in `index.html`. The preview notice then disappears, and the success state changes only after the confirmed receipt.
4. Recheck the published form with an authorized, clearly labelled test lead. This local run did not submit a live lead or publish anything.

The client script keeps entered values on failure, waits up to eight seconds, and does not retry automatically. The success state is tied to the server receipt. The same-origin form endpoint can be implemented as a Cloudflare Pages Function or Worker route; no Cloudflare account was accessed here.

## Publishable files

Upload `index.html`, `styles.css`, `script.js`, and `assets/`, including the bundled font licence files. Keep `build/` out of the public deployment; it contains QA scripts and reports. Confirm permission to publish the company's public-site images and logo before uploading them.

## Local preview

From this project directory, run `PREVIEW_PORT=4199 python3 -B build/preview_server.py`, then open `http://127.0.0.1:4199/`. The receiver validates synthetic entries and discards them; it does not contact the business.
