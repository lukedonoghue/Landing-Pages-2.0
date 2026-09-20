# The Garden Room Co. landing page

This is a **local final preview** of the landing page. It has not been published or connected to a live lead destination.

## Preview

The preview is running at http://127.0.0.1:52843/ during this session. To restart it later, open a terminal in the run directory (the folder containing `preview-server.mjs`) and run:

```bash
PORT=52843 node preview-server.mjs
```

The local server returns a synthetic confirmation for test entries. It does not save or send contact details. The page's form says this plainly. The source website's live form was not used or tested.

## When Cloudflare is connected

Publish `index.html`, `styles.css`, `script.js`, and `assets/`. Keep `build/`, `qa-tools/`, `qa-form.mjs`, and `preview-server.mjs` out of the public site.

Before calling the form live, connect `POST /api/enquiry` to a real lead destination. The page sends JSON with `name`, `email`, `phone`, `postcode`, `use`, `message`, and `marketing`. Return HTTP 2xx with `{"accepted":true,"receipt":"a unique confirmation id","preview":false}` only after the destination has accepted the enquiry. Return a non-2xx result on failure. The page preserves entries and shows a retry message on an unconfirmed result. Update the local-preview note in the form and review the linked privacy policy for the new data path before publishing.

The logo and project photos came from The Garden Room Co.'s public website. Confirm the business has the right to republish them. Check the public phone number, listed areas, and offer at launch. No tracking, CRM, or Cloudflare account connection is included.

Research, claim sources, image provenance, and QA evidence are in `build/`.
