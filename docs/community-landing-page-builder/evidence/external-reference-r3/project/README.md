# The Garden Room Co. landing page

Status: **local final**. The page is built and tested locally. It is not published or connected to a live lead destination.

## Preview

The current preview is running at http://127.0.0.1:4175/ . To start it again from this directory, run `PORT=4175 node server.mjs` (choose another free port if needed).

`index.html`, `styles.css`, `script.js` and `assets/` are the static page. `server.mjs` is only a local preview server. It confirms test enquiries and discards the details; it does not email or store leads. The visible form result says so. No live lead was submitted during QA.

## Before connecting Cloudflare

1. Confirm that The Garden Room Co. may publish the first-party photographs and logo downloaded from its public site. Sources and rights status are in `build/image-plan.md`.
2. Connect the existing `/api/enquiries` form path to a real, protected lead destination. Keep the same required fields and separate optional marketing consent. Return a confirmed receipt before showing success. A static upload alone will not make the form deliver enquiries.
3. Update the preview note and confirmation copy in `index.html`, the status handling in `script.js`, and the copy master when real delivery has been verified. Then test a clearly labelled live submission with permission.
4. Point Cloudflare at the static page files. Do not publish `build/`, `server.mjs`, `qa-tools/` or local test reports as website assets.

No analytics, CRM, brochure or deployment was added. The page links to the company's public privacy policy and project pages.

## Evidence

- `build/strategy-brief.md`, `build/claim-ledger.md`, `build/page-copy.md`, `build/image-plan.md`
- `build/surface-scan.json`, `build/static-review.json`, `build/browser-review.json`, `build/conversion-review.json`, `build/lighthouse-final.json`
- `build/screenshots/` contains the required full-page views, first-screen captures, image placements and form states.
- `build/acceptance.md` records the final visual review and external limits.
