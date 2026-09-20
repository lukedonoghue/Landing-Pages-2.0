# Image plan

Four distinct generated content images support four separate buyer questions. The official logo is first-party brand identity and does not count toward this four-image total. Generated scenes are illustrative, never proof of Clarentis clients, staff, work, documents or outcomes. The generation tool reported no model identity.

| Placement | Purpose | Role | Readable information | Source / rights | Treatment and protected detail | Alt text | Original in run | Final asset | Returned filename |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hero | Shows the accounting workspace; provides real negative space for the offer. | illustrative | No | Native image_gen on 2026-09-20; local preview use | Full-width desktop, stacked image on mobile. Notebook and calculator on right; left navy wall is copy-safe. | Illustrative accounting workspace with notebook, calculator and receipts. | research-assets/hero-workspace-original.png | assets/hero-workspace-600.webp, assets/hero-workspace-900.webp, assets/hero-workspace.webp | exec-51877521-b994-45d6-8693-601a33b9900c.png |
| Initial consultation | Makes the conversation step tangible without identifying either person as real. | illustrative | No | Native image_gen on 2026-09-20; local preview use | Unobstructed figure; preserve both faces and hands at all widths. | Illustrative consultation between two people reviewing a paper checklist. | research-assets/consultation-original.png | assets/consultation-500.webp, assets/consultation-800.webp, assets/consultation.webp | exec-09920aaa-6f92-4e37-8f6c-c005aaddc6ed.png |
| Bookkeeping | Shows record sorting and reconciliation as an activity. | illustrative | No | Native image_gen on 2026-09-20; local preview use | Unobstructed figure; retain hands, receipts and notebook. Any faux text is indistinct and never treated as evidence. | Illustrative bookkeeping scene with hands sorting receipts beside a notebook and laptop. | research-assets/bookkeeping-original.png | assets/bookkeeping-500.webp, assets/bookkeeping-800.webp, assets/bookkeeping.webp | exec-953faec5-f1d2-443e-a59e-e092b0fe1648.png |
| Process | Shows organised preparation around deadlines. | illustrative | No | Native image_gen on 2026-09-20; local preview use | Unobstructed figure; retain blank calendar and folders. | Illustrative desk with a blank calendar and organised document folders. | research-assets/deadline-original.png | assets/deadline-500.webp, assets/deadline-800.webp, assets/deadline.webp | exec-7840994c-243c-41e0-afe1-76704bf8663a.png |

Official logo: https://clarentis.co.uk/clarentis-logo.png, retrieved 2026-09-20 into `research-assets/clarentis-logo-source.png`, trimmed and losslessly resized without changing the mark to `assets/clarentis-logo.webp`. The favicon is a crop of that official mark. Publication rights remain for the site owner to confirm. The source site contains no other content photos. All image use here is a local preview pending owner review before publication.

## Exact native generation prompts

### Image 1

```text
Use case: photorealistic-natural
Asset type: full-width accounting landing-page hero photograph
Primary request: a realistic, contemporary UK small-business accounting workspace, seen at a slight angle. On the right half, an open plain ledger notebook, a neat stack of unbranded receipts, a simple calculator and a closed pen on a solid oak desk; the left half is a genuinely clear, dark navy painted wall and desk area for HTML headline and buttons.
Style/medium: editorial photography, not stock-ad staging
Composition/framing: wide horizontal scene, subject entirely on right, calm clean negative space on left, no people; no crop-critical detail at outer edges
Lighting/mood: bright natural window light, credible and focused
Color palette: navy, white, subdued teal details, natural oak
Constraints: physically plausible objects and shadows; no logos, no readable words, no numbers, no graph, no certificate, no watermark, no UI mockup; no text on the image.
```

### Image 2

```text
Use case: photorealistic-natural
Asset type: landing-page section photograph about free initial consultation
Primary request: a candid, illustrative UK small-business consultation at a shared desk: two adults in ordinary contemporary clothing discussing a simple paper checklist, relaxed and attentive, photographed from a respectful side angle. This is a hypothetical scene, not actual Clarentis staff or customers.
Style/medium: natural editorial documentary-style photo, authentic skin texture, no glossy corporate posing
Composition/framing: horizontal medium-wide shot, both faces and hands clear, table and context visible; no copy overlay area required
Lighting/mood: soft daylight in a modest, current office
Color palette: neutral whites, blue-grey, restrained teal accessory
Constraints: coherent anatomy and hands; no branding, no readable documents or screens, no visible financial figures, no watermark, no posed handshake.
```

### Image 3

```text
Use case: photorealistic-natural
Asset type: landing-page section photograph about bookkeeping and record organisation
Primary request: close, natural view of an adult's hands sorting a small set of unbranded purchase receipts beside an open plain notebook, a bank card face down, and a laptop showing an intentionally indistinct, unreadable spreadsheet. A realistic illustrative bookkeeping task for a UK small business.
Style/medium: current editorial photography, tactile paper texture, unforced composition
Composition/framing: horizontal overhead three-quarter view; hands, receipts and notebook visibly distinct; no text overlay
Lighting/mood: soft natural daylight, orderly and reassuring
Color palette: light neutral desk, navy stationery, muted teal accent
Constraints: no readable words, amounts, account data, logos, dashboard claims, awards, watermark, or implausible props.
```

### Image 4

```text
Use case: photorealistic-natural
Asset type: landing-page section photograph about tax and payroll deadline preparation
Primary request: a believable, well-organised small-business desk with a paper calendar turned to a blank month grid, closed document folders with plain colored tabs, a pen and calculator; one adult hand placing a neutral folder beside the calendar. Visualise preparation and order, not a specific filing or result.
Style/medium: realistic editorial photography, understated and contemporary
Composition/framing: horizontal close-medium view, calendar grid and folders clearly inspectable but without readable dates or words; no copy overlay
Lighting/mood: crisp daylight, calm and precise
Color palette: off-white, deep navy, slate, subtle teal
Constraints: no readable figures, names, company documents, certificates, logos, watermarks, invented HMRC marks, or financial dashboard.
```

## Review evidence

- Hero: `build/screenshots/390x844-first.png`, `1024x800-first.png`, `1280x600-first.png`, `1440x900-first.png`. The notebook and calculator remain visible; desktop copy stays on the navy wall. At 1024px the image is stacked and bottom-aligned so the notebook remains inspectable. The illustrative label is visible in each capture.
- Consultation: `build/screenshots/review-consultation-desktop.png` and `review-consultation-mobile.png`. Both faces, hands and the checklist remain visible without overlapping copy. The adjacent caption discloses illustration.
- Bookkeeping: `build/screenshots/review-bookkeeping-desktop.png` and `review-bookkeeping-mobile.png`. Hands, receipts, notebook and laptop remain visible; generated receipt marks are not used as proof or copied into text. The adjacent caption discloses illustration.
- Process: `build/screenshots/review-deadline-desktop.png` and `review-deadline-mobile.png`. Calendar, folders and hand remain visible without a destructive crop or text overlay. The adjacent caption discloses illustration.

All four scenes are distinct, relevant to their adjacent accounting message and loaded in the final browser pass. The logo is the only real first-party visual and is not counted as one of the four content scenes.
