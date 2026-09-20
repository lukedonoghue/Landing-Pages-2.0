# The Garden Room Co. landing page

This is a local preview for The Garden Room Co. Open `http://127.0.0.1:43871/` while the local server is running. The page files are `index.html`, `styles.css`, `script.js` and `assets/`.

The page is intentionally not published. Its enquiry form validates details and demonstrates the full popup flow, but it does not transmit or store visitor information. The notice inside the form and the result state say this plainly. The public phone and portfolio links work independently of the form.

## Before connecting Cloudflare

1. Confirm that The Garden Room Co. may reuse the first-party project photographs and logo from its current website.
2. Connect a real enquiry destination. `script.js` reads `window.GRC_LEAD_ADAPTER` at submission and passes it a validated snapshot of name, email, optional phone, message and optional marketing choice. Return `{ ok: true }` only after the selected destination confirms receipt. Failure should return a non-success status or reject. The current default returns `preview-disabled` and sends nothing.
3. Replace the preview-only notices only after a labelled test enquiry reaches the intended inbox or store and the success state is confirmed against that receipt. Do not send a live test from this build without permission.
4. Deploy the `project/` page files and `assets/` together. The `build/` folder contains research and QA evidence, not public page dependencies.

The source research, claim ledger, copy master, image sources, screenshots and QA summary are in `build/`.
