# Local acceptance

Status: **local final preview**, self-reviewed on 2026-09-20. Production lead delivery and publishing are not configured.

## Files and URL reviewed

- Local URL: http://127.0.0.1:52843/
- Page: `index.html`, `styles.css`, `script.js`, `assets/`
- Source branding: `brand.json`, `brand-390x844.png`, `brand-1440x900.png`
- Automated results: `surface-scan.json`, `static-review.json`, `browser-review.json`, `form-review.json`, `lighthouse.json`
- Full-page screenshots: `screenshots/390x844-landing.png`, `screenshots/768x1024-landing.png`, `screenshots/1024x800-landing.png`, `screenshots/1280x600-landing.png`, `screenshots/1440x900-landing.png`
- First viewport crops: matching `*-first.png` files. Form states: `screenshots/form-mobile.png`, `screenshots/form-errors-mobile.png`, `screenshots/form-failure-mobile.png`, `screenshots/form-success-mobile.png`, `screenshots/form-failure-short-laptop.png`.

## Visual review

- 390 x 844: official logo, room, heading, action and 96 pixels of the next band are visible. The mobile-specific first-party crop retains the room's roof, cladding and glazing above the text. CTA and trust claims fit without overlap.
- 768 x 1024: copy sits over the decking area. The main building remains inspectable above it, with the trust band and start of the projects section visible below.
- 1024 x 800 and 1440 x 900: text stays on the right side of the full-bleed room image; the built room is visible to its left. Header navigation and first action are unobscured. The next section appears in the first viewport.
- 1280 x 600: header, hero action and a 47-pixel hint of the next band remain visible. No clipping or horizontal overflow.
- Full pages: project imagery, dark process band, practical materials section, customer quote and FAQs, enquiry form, and footer have distinct composition. No fake review card, competing filled action, blank asset, information-bearing crop, or observed text collision. The design preserves the real logo, green accent and source type without reproducing the source site's older layout.
- Asset-specific rendered crops inspected: `screenshots/gallery-desktop.png`, `screenshots/walthamstow-mobile.png`, `screenshots/dyserth-mobile.png`, `screenshots/moreton-mobile.png`, `screenshots/trefnant-desktop.png`, `screenshots/trefnant-mobile.png`. Each named project remains visible with its matching caption; no text covers a building. The header and footer logo remain legible on charcoal.

## Behavior and checks

- Source conversion parity: original offer is a free design consultation and no-obligation quote by online enquiry. The local form keeps name and email required, phone and marketing consent optional, and adds optional project context. It does not submit to the source site.
- `form-review.json`: 20 passing synthetic checks, including whitespace-only fields, malformed email and phone, correction and error-summary links, visible failure at the submit position, retained values, confirmed local preview receipt, deliberate reset, duplicate prevention, request deadline, and short-height keyboard focus order. No live lead was sent.
- Surface scan: pass, no prohibited long dashes or template text. Static validator: pass, no missing assets, dead local links, image contract issues, or form relationship issues.
- Five-viewport browser helper: zero failures, zero horizontal overflow, no broken images or small link targets. Its 10 remaining warnings are only source typography sample availability: the official site's entrance animation hid the first-viewport heading when `extract_brand` captured it. A separate browser check after 2.5 seconds found official H1 and headings in Reem Kufi and meaningful paragraphs in Poppins. The final browser report confirms actual painted glyphs in those same locally loaded fonts on the new page. No formal brand guide was found.
- Lighthouse 12.8.2 mobile: Performance 97, Accessibility 100, Best Practices 100, SEO 100; LCP 2.6 s, CLS 0, TBT 60 ms. LCP is 0.1 s above the skill's 2.5 s aim. Repeated audits stayed at 2.6 s; the breakdown assigns 79% to rendering the real project hero after a fast image download. Accepted for local preview because the meaningful photo remains sharp and the overall score is strong. No severe finding remains.

## External limits

- The loopback receiver confirms synthetic preview submissions only. A static upload without a real `/api/enquiry` route will show a recoverable failure, not a false success.
- Cloudflare, a production form destination, and live testing were excluded by the execution boundary.
- Public first-party image reuse is suitable for this local preview; publication rights need the business's confirmation. The linked business privacy policy should be checked and updated for any new live data destination.
- Fresh acceptance was a self-review of final screenshots and behavior. No separate reviewer was available in the current tools.
