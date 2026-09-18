# Byrider Independent Acceptance Run 1

## Purpose

This was a context-free forward test of `community-landing-page-builder` using a new Codex task on `gpt-5.6-sol` with `ultra` reasoning. The task received the skill path and a plain request to build a landing page for `https://go.byriderfranchise.com/`. It was forbidden from reading prior Byrider builds, sibling skills, audits, or the development conversation.

Task ID: `01a0b4bf-b4c5-73b2-8497-a826709bae38`

## Result

Final classification: **technical-layout pass, conversion-intent failure, typography-provenance failure, and visual-age failure**.

The independent agent and its fresh reviewer found no remaining layout or browser blockers. The user then identified two major behavioral and design defects that the review missed: the supplied source form was replaced by a phone call, and the applied fonts had no Byrider provenance. The user also confirmed that placement, image, overlap, and completeness fixes worked, but rejected the design as visually outdated. These findings override the run's broad `local final` label.

## What passed

- Correct page-only mode with brochure, CRM, tracking, deployment, and live submission excluded.
- A verified phone number was used as a working secondary-capable destination, but it was incorrectly promoted to the primary action.
- Verified first-party imagery with an image ledger and publication-rights limitation.
- Material claim ledger and FDD qualifications.
- Static checks and five required viewport classes.
- No-JavaScript mobile navigation.
- Full keyboard-cycle evidence, menu focus restoration, reduced motion, and FAQ behavior.
- Asset-specific visual review.
- Lighthouse Performance 99, Accessibility 100, and Best Practices 100 in the final run.
- No live call, lead, deployment, or analytics event.

## What failed

The supplied Byrider landing page contains a lead form and offers a franchise overview with financial, investment, and territory information. The run instead selected `Call Franchise Development` because its strategy brief said no backend or downloadable guide had been supplied. That was a research and instruction failure: the supplied source itself showed the intended conversion journey. Missing credentials did not justify changing its conversion type.

The supplied landing page declared Barlow for headings and Source Sans 3 for body copy. Byrider's broader franchise site declared Montserrat and Open Sans. The run documented neither source and applied Avenir Next, Arial Narrow, Avenir Next Condensed, and Georgia without provenance. The condensed headings and negative letter spacing also contributed to the dated result.

The visual system looked like an older automotive franchise prospectus instead of a current, appropriately premium franchise-investment page.

The exact Byrider logo colors were correctly used:

- blue `#215EAC`;
- orange `#FF8200`.

The problem was how the page extended those colors and combined them with invented design choices:

- midnight `#081C2B` and warm cream reading surfaces;
- generic condensed system headings;
- negative letter spacing;
- clipped corners and hard-edged shadows;
- road-line rules and rule-heavy numbered rails;
- broad saturated blue and orange bands;
- a sequence of visual motifs associated with printed franchise or automotive sales material.

Each choice could be defensible alone. Together they reproduced the visual age of Byrider's existing owned sites too closely.

## Instruction defect exposed

- The active default workflow said to start from the observed brand but did not distinguish brand truth from legacy presentation.
- It did not require source and applied palettes or an explanation of color proportions.
- It did not contain a blocking visual-age or audience-fit checkpoint.
- Blue Mountain was present in the copy library and named in a dormant case study, but the default workflow did not load it.
- Blue Mountain is useful for persuasive structure but is itself visually old.
- Clean Slate was not established as the execution-quality benchmark.
- The fresh reviewer could therefore pass objective layout and accessibility checks without detecting the outdated art direction.
- The workflow allowed any honest destination without requiring parity with the supplied page's dominant conversion mechanism.
- The form backend was treated as inseparable from the form experience, so missing credentials led to replacing the form instead of leaving production wiring pending.
- The strategy brief did not require a source conversion contract or typography provenance.
- The conversion gate tested only the action the run had selected, so it proved the phone link worked without asking whether phone was the correct action.

## Correction made after this run

`references/design-direction.md` now defines:

- client sources as brand and factual truth;
- Blue Mountain as the default conversion-architecture benchmark only;
- Clean Slate as the execution-quality benchmark only;
- separate source and applied palettes;
- current audience-fit direction and legacy-pattern warnings;
- a blocking final visual-age checkpoint.

The skill now also requires source conversion parity, separates form UX from backend wiring, treats public endpoints as evidence rather than authorization, and requires the supplied production page's actual heading and body fonts by default. Any substitution needs a concrete reason and a close visual match.

This first run remains evidence for the fixed layout and image workflow and for the exposed conversion and design gaps. It is not acceptance evidence for the revised instructions. A new context-free run is required.

## Included evidence

- `strategy-brief.md`: the independent run's design rationale.
- `qa-summary.md`: the independent run's final technical acceptance report.
- `1440x900-landing.png`: complete desktop page.
- `390x844-landing.png`: complete mobile page.
