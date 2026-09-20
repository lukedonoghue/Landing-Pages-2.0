# Clarentis landing page

Status: local final. The page has been built and checked locally. Cloudflare has not been connected or used.

## Files to publish

Use the `dist/` directory as the Cloudflare Pages upload or output folder. It contains only `index.html`, `styles.css` and the required `assets/` images. The project root contains the editable originals; `build/` contains research, screenshots and QA evidence and should not be published.

## Local preview

Current preview: http://127.0.0.1:43192/

The page can also be opened directly from `dist/index.html` in a browser. If the preview server has stopped, run `python3 -m http.server 43192 --bind 127.0.0.1 --directory dist` from this project directory.

## Contact behaviour

"Request your fixed-fee quote" opens the visitor's email application with `info@clarentis.co.uk` and a prepared enquiry. The call links use `07467 474356`. The page does not collect form data, run analytics, or show a success message; delivery depends on the visitor sending the email in their own application. No live enquiry was sent during QA.

## Evidence

See `build/acceptance.md` for the visual and technical review, `build/strategy-brief.md` and `build/claim-ledger.md` for sourced decisions, `build/image-plan.md` for imagery provenance, and `build/screenshots/` for viewport captures. Generated originals and the public source snapshot are retained in the sibling run-level `research/` directory.
