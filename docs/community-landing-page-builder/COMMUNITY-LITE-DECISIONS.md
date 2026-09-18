# Community Landing Page Builder Decision Record

## Goal

Create a shareable one-prompt skill for a nontechnical business owner. A website URL must be enough to produce a good local landing page without API keys, private integrations, repository access, hosting credentials, or intermediate technical decisions.

The target is a credible, conversion-capable page with reliable visual review. The target is not the largest possible funnel or a perfect agency operations system.

## Working copy

- Source retained: `work/Landing-Pages-2.0/skills/branded-lead-funnel-builder`
- Separate fork: `work/Landing-Pages-2.0-community-lite/skills/community-landing-page-builder`
- The source `README-BOHDAN.md` is not edited.
- No client publication or deployment is part of this revision. Repository checkpoints are limited to the new community skill and documentation folders.

## Re-evaluation decisions

### P0

| Candidate | Decision | Lightweight implementation |
| --- | --- | --- |
| Output dash rule | Adopt | Top-level absolute rule plus `scan_surfaces.py`; no normalization that hides violations. |
| Unified truth and proof blocker | Adopt | One top-level invariant plus a compact material-claim ledger. |
| All-surface final scan | Adopt | Scan customer-facing text and hidden surfaces for forbidden marks and unresolved markers. |
| Brand fidelity baseline | Adopt | Supplied assets first, measured official identity, correct logo variant, brand visible in first viewport. |
| Anti-generic design gate | Adopt | Short visual rules and a fresh screenshot review, no numeric style score. |
| WCAG 2.2 AA baseline | Adopt | Semantic and interaction rules plus static/browser checks; automated scan when available. |
| Honest primary action and destinations | Adopt | One selected action, real destination, deterministic `data-primary-action`, no hash-only primary links. |
| Testimonial person diversity | Adopt | Never split one person into multiple proof cards; no minimum count. |
| No fake production completeness | Adopt | Honest local-final status and hard blockers for stubs, dead links, missing assets, and untested actions. |
| Form containment and per-field errors | Adopt | Native dialog or document-level guard, described errors, forced-focus test. |

### P1

| Candidate | Decision | Lightweight implementation |
| --- | --- | --- |
| Compact strategy brief | Adopt | One brief replaces several phase reports. |
| Real mechanism and proof map | Adopt | Included in strategy and copy rules. |
| Competitor scan | Conditional | Two or three official pages only when positioning remains unclear. |
| Adaptive job coverage | Adopt | Buyer jobs replace fixed section counts. |
| First-time-reader and bullet test | Adopt | Included in editorial pass. |
| Truthful urgency and scarcity | Adopt | Direct rule, no unsupported countdown or capacity claim. |
| Anti-hype vocabulary | Adopt with judgment | Small high-confidence list, not an unconditional word blacklist. |
| Layout robustness | Adopt | Intermediate widths, deliberate grids, no emergency short-label breaking. |
| Audience vocabulary and arithmetic | Adopt | Match the buyer and recalculate comparisons. |
| Copy density | Adopt as editing signal | No word-count quota. |
| Generated-image text and disclosure | Adopt | Generated images are illustrative and cannot carry documentary proof. |

### P2

| Candidate | Decision | Lightweight implementation |
| --- | --- | --- |
| Buyer stage and journey | Adopt | One line in the compact strategy brief. |
| Third-party name classification | Adopt when present | Comparison, platform/specification, or provenance credential. |
| Phone behavior | Adopt when a phone field exists | Native-friendly input, paste/autofill, no cursor-jumping mask or guessed country code. |
| Video facade | Adopt when video is useful | Poster, click-to-load controls, reduced-motion and fallback behavior. |
| Origin story | Conditional | Use only when decision-relevant and sourced. |
| Press or industry authority | Conditional | Use only when authoritative and material to the decision. |
| Gated-content semantics | Adopt when content is gated | Implement access honestly or describe thank-you delivery accurately. |

### P3

These items are rejected from the default core: Ads MCP or keyword blockers, Firecrawl-only research, Apps Script-only forms, raw PII analytics, exact image-model or API-key requirements, PageSpeed API-key gates, zero-pixel visual diffs, fixed section counts, mandatory headline variants or phone-frame previews, expert-panel scoring theater, private GitHub workflows, exact country-specific phone masks, image-count quotas, large research quotas, and mandatory brochure/CRM/reporting/backup/deployment systems.

Existing advanced modules remain available only when selected and must not block an ordinary local page.

## Byrider visual-audit fixes

| Observed failure | Skill correction |
| --- | --- |
| Text covered infographic labels and people | Images are classified; content-bearing pixels and faces receive protected regions. |
| Brochure clipping and sentence truncation passed | Every selected brochure page needs page-specific rendered review evidence and validator coverage. |
| Modal action fell below 1280 x 600 | Short-height browser gate checks action visibility and obstruction. |
| Consent covered hero content | Browser gate checks fixed consent/chat UI against H1, CTA, form actions, legal links, and footer. |
| Labeled roadmap used destructive cover cropping | Content-bearing images cannot use `cover`; browser gate blocks it. |
| Footer utilities collapsed visually | Explicit layout-gap rule and computed footer-gap check. |
| Generated technology scene looked like proof | Illustrative and proof roles are separated in copy, plan, and visual hierarchy. |
| Repeated card-grid section grammar | Anti-template and repetition review added without a section-count quota. |
| Oversized hero and proof images | Required visual review now covers laptop and evidence-to-space balance. |
| Duplicate investment facts | Final editorial and visual passes check duplicate decision content. |
| Fake guide preview | Preview must show the actual cover or verified spread. |
| Thin thank-you state | Success state review includes actual next step and fallback behavior. |
| Generic screenshot reused for all image reviews | Each image needs asset-specific evidence. |
| Self-authored booleans approved the run | Fresh acceptance pass required, separate reviewer or agent when available. |

## Visual-age finding from the independent run

The first context-free build fixed the earlier functional and layout failures, but its design still read as an older automotive franchise prospectus. This exposed a separate instruction gap:

- the exact Byrider blue and orange were correctly verified from the official logo;
- the builder then enlarged those saturated colors into broad page fields and added invented navy and cream support colors;
- condensed system headings, rule-heavy rails, numbered checkpoints, hard-edged shadows, and alternating blue, orange, and cream bands reinforced a legacy brochure character;
- the default skill did not require a comparison between source-brand truth and the visual age of the source website;
- Blue Mountain existed in the buried copy library and a case-study note, but the active default workflow did not load it;
- Blue Mountain is useful for conversion architecture, but its live visual design is too old to be a modern style target;
- Clean Slate is a stronger execution-quality benchmark for hierarchy, spacing, proof presentation, and finish.

Decision: adopt one short design-direction reference. It makes Blue Mountain the default structural benchmark, Clean Slate the execution-quality benchmark, requires separate source and applied palettes, and adds a blocking visual-age checkpoint. It does not add an approval step or require extra owner input.

## Implementation checklist

- [x] Create separate fork and keep the source copy unchanged.
- [x] Replace the heavy default funnel contract with a landing-page-first contract.
- [x] Move brochure, CRM, tracking, deployment, recovery, and handoff to optional modules.
- [x] Add compact research, copy, brand, image, and accessibility rules.
- [x] Add prohibited-surface scanner.
- [x] Add lightweight static page validator.
- [x] Add responsive browser measurement and obstruction checks.
- [x] Add page-specific brochure review validator.
- [x] Add active structural and execution reference hierarchy.
- [x] Add source-versus-applied palette rationale and visual-age gate.
- [x] Add and run focused regression tests.
- [x] Validate the skill package and scan its generated templates.
- [x] Run the first context-free Byrider acceptance build in a separate task.
- [x] Record the first result as a functional pass and visual-age failure without editing it into compliance.
- [ ] Run a second context-free Byrider build against the revised design instructions.
