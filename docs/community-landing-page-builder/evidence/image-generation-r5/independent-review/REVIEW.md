# Clarentis R5: Independent Visual and Editorial Review

**Verdict:** Visual/editorial acceptance with two non-blocking advisories. No severe pixel, image-truth, or source-coverage defect was observed. This is not an end-to-end release or lead-delivery certification.

**Reviewed:** The publishable `project/dist/` output at `http://127.0.0.1:56845/` (the supplied `:53621` preview was unavailable), its four image originals in `project/research-assets/`, the supplied skill and relevant quality/image/copy/design references, and the public [Clarentis site](https://clarentis.co.uk/). I did not read builder acceptance files, other attempts, parent history, or other audits. No page or skill files were edited.

## Prioritized findings

1. **P2, narrow-phone quote action loses its email explanation.** At 320 x 700 the primary button reads “Request your fixed-fee quote,” but the adjacent “Opens your email app” note is absent in [320 x 700 first screen](320x700-first.png). `dist/styles.css:222` hides `.action-note` below 371px; the same note is visible in [390 x 844](390x844-first.png). All four primary CTAs are `mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20enquiry` (`dist/index.html:28,49,141,199`), consistent with the public site's email-led journey. The missing explanation may leave a narrow-phone visitor uncertain why no web form appears, especially without a configured mail app. Keep a short email-app cue or the readable address near that first CTA. **Acceptance decision:** advisory, since the action and final visible email address are genuine; no false success or substituted form is shown.

2. **P3, one FAQ answer exposes research language.** The open answer says, “The published service list includes company formation support...” in [mobile FAQ](390x844-faq-open.png) and [desktop FAQ](1440x900-faq-open.png) (`dist/index.html:185`). The services are supported by the [public site](https://clarentis.co.uk/), but “published service list” sounds like a reviewer describing Clarentis, rather than Clarentis answering a buyer. A direct sentence about the help offered would read more naturally. **Acceptance decision:** copy polish only; no factual mismatch.

## Pixel and source evidence

| Viewport | Observed first-screen result |
| --- | --- |
| [1440 x 900](1440x900-first.png) | Logo, offer, phone and filled quote CTA are legible. The book, calculator and laptop remain visible to the right of the hero copy; the full three-part strip appears before the fold. |
| [1280 x 600](1280x600-first.png) | CTA and image subject remain in view. The strip begins at y=509 with headings and some supporting copy visible; the rest continues below the viewport. |
| [1024 x 800](1024x800-first.png) | Hero copy and subject do not collide. Header CTA wraps within its button. The following strip is readable. |
| [768 x 1024](768x1024-first.png) | Hero switches to an unframed copy-then-image layout. Phone, CTA, photo and all three strip items are visible. |
| [390 x 844](390x844-first.png) | CTA and its email explanation are visible; the 210px photo retains the accounting objects and the first strip item is readable. |
| [320 x 700](320x700-first.png) | H1, CTA, 165px image and next-section heading fit without clipping or horizontal overflow. The email note is hidden, as noted above. |

The [desktop full page](1440x900-full.png), [mobile full page](390x844-full.png), [tablet](768x1024-full.png), [laptop](1024x800-full.png), and [short-height laptop](1280x600-full.png) show a consistent hierarchy and varied section density. Service, tax, fee, process and contact text is readable in the [desktop](1440x900-bookkeeping.png) and [mobile](390x844-bookkeeping.png) section captures. The six fee amounts and units remain legible in [desktop fees](1440x900-fees.png) and [mobile fees](390x844-fees.png). No horizontal document overflow, zero-width image, or page script error was recorded at the six local viewports in [measurements.json](measurements.json); the visual conclusions above come from the pixels, not those counts.

I inspected all four original PNGs. The hero's left wall is a genuine copy-safe area, and its ledger/calculator stay visible after the desktop `cover` crop and in the mobile strip. The bookkeeping, blank-calendar/deadlines and consultation originals are distinct scenes and remain intact in the [bookkeeping](390x844-bookkeeping.png), [tax](390x844-tax.png), and [process](390x844-process.png) placements. The 4:3 service images use `contain`, with no text or face covered. Captions and alt text identify them as illustrative; the consultation caption explicitly says the people are not Clarentis staff or clients. These images explain service context but provide no evidence of real staff, clients, work or results. The public page itself offers a logo and no comparable photographic proof, so I do not treat the absence of first-party proof imagery as a fabrication or visual defect.

The public site's [rendered desktop](source-1440x900-first.png) and [mobile](source-390x844-first.png) pages use navy and teal. Its [CSS](https://clarentis.co.uk/styles.css) declares an Inter/system stack without a loaded web font; Chromium painted the source H1 and prose with system SF. The local page declares the same leading stack and also painted system SF. Its restrained navy/teal variants, smaller hero type, real logo, direct fee table and less card-heavy composition are a coherent refresh rather than a source clone.

Editorial coverage is substantial: the final has all six published service areas, all six indicative fee rows with units and quote qualifiers, four onboarding steps, a free initial consultation, an email-led quote CTA, the published phone number, FAQ and final contact. The first post-hero strip repeats the audience and consultation already stated in the hero, but adds the useful “From £60 per month” qualification. The public source provides no named team, credentials, testimonials or case work to carry over; none was invented in the final.

## Limits

This pass reviewed appearance, copy, image placement and public-source fidelity. It did not send an enquiry, verify an email client's handling of `mailto:`, test interaction edge cases, audit generated-image provenance, run Lighthouse, use private accounts, or publish. The original preview port was closed, so captures came from a temporary read-only server serving the unchanged `dist/` folder. Overall `local final` or `publish-ready` status depends on the parent team's separate interaction and provenance checks.
