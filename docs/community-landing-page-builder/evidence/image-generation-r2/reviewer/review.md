# Clarentis R2 independent visual review

Reviewed 20 September 2026. Local preview: `http://127.0.0.1:43192/`, serving the supplied `project/dist/`. The editable `index.html` and `styles.css` are byte-identical to the served copies. Official comparison: [clarentis.co.uk](https://clarentis.co.uk/) and [official first screen](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/official-1440x900-viewport.png). This was a read-only pass; no page or skill file was changed.

## Prioritized findings

### P2 - The middle of the page repeats the service list where a buyer needs a reason to choose Clarentis

The six-service grid establishes what is offered. The following "Joined-up support" section then groups those same services into setup, records, and filings without adding a distinct reason to select this firm. Compare [the service list](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/index.html:69) with [the repeated fit list](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/index.html:111) and the [1440px full-page capture](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1440x900-full.png). The official homepage's "Why Clarentis" section does make source-backed promises about clear communication, practical advice without jargon, and keeping HMRC deadlines on track. The local page carries some deadline language, but leaves that selection case mostly implicit.

**Suggested correction:** use the existing fit section to explain how Clarentis communicates and keeps work moving, drawing only on those published promises. If stronger credentials or customer evidence exist, obtain and verify them before adding them. This is a buyer-argument gap, not a claim that the firm lacks such proof.

### P3 - At 320 x 700, the first screen ends inside the hero image

The assurance section begins at about y=746, so no readable next-section content appears in the first 700px. The photo is also cut by the viewport edge; see the [320px viewport](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-320x700-viewport.png). This comes from the stacked mobile hero, fixed 174px image, and narrow-width spacing at [styles.css:211](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/styles.css:211), [styles.css:217](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/styles.css:217), and [styles.css:234](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/styles.css:234). At 390 x 844, the first assurance item is visible, so this is confined to the narrow stress case.

**Suggested correction:** tighten or move part of the mobile lead and reclaim some hero spacing at very narrow widths while preserving a useful image and the primary action. Then recheck 320px and 390px first screens.

### P3 - Location FAQ uses source-research language in visitor copy

The answer begins "The site describes support for UK businesses but does not list a precise service area" at [index.html:175](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/index.html:175), visible in the [open mobile FAQ](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-390x844-faq-location-open.png). It is honest about uncertainty, but sounds like an external audit and gives no more location guidance than "ask us."

**Suggested correction:** speak directly to the visitor: say Clarentis supports UK businesses and ask for their location so availability can be confirmed. Do not assert nationwide coverage; the reviewed official homepage does not specify a service area.

## What held up

- The official logo and the navy/teal identity remain recognizable. The page has a clear filled quote action, subordinate phone option, readable service/fee tables, and no observed overlap or horizontal overflow in the captured widths. [Local desktop first screen](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1440x900-viewport.png), [official first screen](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/official-1440x900-viewport.png).
- The local page preserves the official homepage's UK startup/sole trader/small-company audience, free initial consultation, fixed-fee proposal, six core services, published indicative fee ranges and their volume/complexity qualification, email, and phone. It does not visibly invent ratings, testimonials, qualifications, or guarantees. [Official homepage](https://clarentis.co.uk/); [local offer and fees](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1024x800-full.png).
- Both new scenes look materially plausible at their delivered resolution. The calculator/workspace hero preserves its subject outside the desktop text footprint; the craft-business scene is clearly generic context. Both have visible illustrative captions and illustrative alt text at [index.html:35](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/index.html:35) and [index.html:107](/Users/mac/Documents/Codex/2026-09-17/co/work/community-acceptance-20260920/runs/image-generation-r2/project/index.html:107). Neither should be treated as evidence of a real Clarentis client or office.
- At 768px the hero paragraph approaches the bright paper but remains on the darker table, as shown by this [enlarged screenshot crop](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-768-hero-copy-detail.png). I did not count it as a contrast defect.
- The [settled Fees navigation view](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-390x844-nav-fees-settled.png) and open FAQ remain visually readable. This review did not assess contact delivery or full interaction behavior.

## Viewport evidence

| Size | First screen | Full page |
| --- | --- | --- |
| 390 x 844 | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-390x844-viewport.png) | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-390x844-full.png) |
| 768 x 1024 | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-768x1024-viewport.png) | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-768x1024-full.png) |
| 1024 x 800 | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1024x800-viewport.png) | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1024x800-full.png) |
| 1280 x 600 | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1280x600-viewport.png) | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1280x600-full.png) |
| 1440 x 900 | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1440x900-viewport.png) | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-1440x900-full.png) |
| 320 x 700 | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-320x700-viewport.png) | [PNG](/Users/mac/Documents/Codex/2026-09-17/co/outputs/clarentis-r2-visual-review/local-320x700-full.png) |

## Limits and classification

I consulted the sibling skill's design, copy, imagery, and quality-gate instructions as criteria, without using its builder acceptance findings. Visual judgment here is independent. The official homepage does not present named staff, qualifications, reviews, or precise geographic coverage in the content reviewed; absence of these on that page is a source limitation, not a finding that such evidence does not exist. Image-generation provenance, interaction delivery, exact glyph inspection, and performance remain outside this pass. Automatic approval review rejected a rendered-font/glyph probe because that check was assigned to the parent; it was removed, and the visual-state review completed without it.

Taste only: the craft-workshop scene is an indirect way to illustrate an accounting buyer. Its realistic detail and explicit illustrative caption make that a creative choice, not a truth or visual defect.

**Overall:** no high-severity visual collision, false proof presentation, or offer/price mismatch observed. Address the P2 buyer-argument gap before treating this as the strongest complete landing-page version; the two P3 findings are focused refinements.
