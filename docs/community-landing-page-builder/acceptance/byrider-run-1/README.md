# Byrider Independent Acceptance Run 1

## Purpose

This was a context-free forward test of `community-landing-page-builder` using a new Codex task on `gpt-5.6-sol` with `ultra` reasoning. The task received the skill path and a plain request to build a landing page for `https://go.byriderfranchise.com/`. It was forbidden from reading prior Byrider builds, sibling skills, audits, or the development conversation.

Task ID: `01a0b4bf-b4c5-73b2-8497-a826709bae38`

## Result

Final classification: **functional pass, visual-age failure**.

The independent agent and its fresh reviewer found no remaining technical blockers. The user then inspected the actual page and confirmed that the placement, image, overlap, and completeness fixes worked, but rejected the design as visually outdated. That user finding overrides the run's broad `local final` label for design acceptance.

## What passed

- Correct page-only mode with brochure, CRM, tracking, deployment, and live submission excluded.
- One honest phone action using `tel:800-947-4532`.
- Verified first-party imagery with an image ledger and publication-rights limitation.
- Material claim ledger and FDD qualifications.
- Static checks and five required viewport classes.
- No-JavaScript mobile navigation.
- Full keyboard-cycle evidence, menu focus restoration, reduced motion, and FAQ behavior.
- Asset-specific visual review.
- Lighthouse Performance 99, Accessibility 100, and Best Practices 100 in the final run.
- No live call, lead, deployment, or analytics event.

## What failed

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

## Correction made after this run

`references/design-direction.md` now defines:

- client sources as brand and factual truth;
- Blue Mountain as the default conversion-architecture benchmark only;
- Clean Slate as the execution-quality benchmark only;
- separate source and applied palettes;
- current audience-fit direction and legacy-pattern warnings;
- a blocking final visual-age checkpoint.

This first run remains evidence for the fixed functional workflow and for the aesthetic gap. It is not acceptance evidence for the revised design instructions. A new context-free run is required.

## Included evidence

- `strategy-brief.md`: the independent run's design rationale.
- `qa-summary.md`: the independent run's final technical acceptance report.
- `1440x900-landing.png`: complete desktop page.
- `390x844-landing.png`: complete mobile page.
