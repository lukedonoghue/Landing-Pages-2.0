# Business 2 acceptance withdrawn: product coverage and form entry

Date: 2026-09-20. Status: **BLOCKED / NOT ACCEPTED**. This supersedes the acceptance conclusion in EXTERNAL-REFERENCE-R3-REVIEW.md. Keep the original build, frozen skill and reviewer output unchanged as evidence. Do not proceed to business 3 on the strength of the earlier pass.

## What was actually checked, and why the verdict was wrong

The earlier run did perform browser, form-state, typography, image and performance tests. Those results are not fabricated, but they do not establish product completeness. The parent and fresh reviewer accepted the implemented inline form as the chosen journey, concentrated on earlier rendering/state bugs, and did not challenge the abbreviated reference mapping, footer-only contact or unexplained person name. Independent reviewers given an incomplete specification can repeat its omissions. The orchestrator promoted narrow technical/visual evidence into a page-acceptance claim. That was an acceptance error, not evidence the user is merely changing aesthetic preferences.

Distinguish historical instructions from the newly explicit requirement: the frozen skill literally allowed an inline OR modal form. Therefore this build's lack of popup was permitted by the faulty skill, not a builder refusing an explicit popup-only rule in that snapshot. The user's clarification now makes popup entry mandatory for every enquiry CTA, even when an inline form is also justified.

## Traceable findings

Paths below are relative to `evidence/external-reference-r3/project/` unless stated otherwise. The live unchanged copy remains at port 4175.

| ID | Symptom and evidence | Cause and correction |
| --- | --- | --- |
| R3-P01 | Thin decision coverage. `index.html` has seven main sections: hero, design, projects, process, practical detail, FAQ, enquiry. Three project cards have titles and outbound links but little explanation. There is one short testimonial, four FAQs, no service-area explanation and no quote-cost explanation. `build/strategy-brief.md:7` explicitly identifies cost as a buyer concern, but the final copy leaves it unanswered. | Frozen SKILL.md step 2 says to merge jobs and omit filler, with no fixed section count. This was not a literal instruction to make a short page, but it allowed generic mentions to stand in for substantive answers. The active research table compressed the reference into four broad beats. Route the stronger reference-fidelity rule through the default workflow, require concrete answers/proof and final section mapping in the existing brief, and review omissions before acceptance. |
| R3-P02 | All four form-entry links, `index.html:27`, `:41`, `:64`, `:125`, use `href="#enquire"`; the only form is at `:179`. No modal exists. | Frozen SKILL.md step 5 explicitly says `Choose modal or inline form from the journey`. No popup requirement existed in the active default. Replace it with one popup journey for all enquiry CTAs, with optional evidence-supported inline access sharing state. Static validation now blocks these four primary section-jump links; browser QA must still prove actual opening, no jump, closing and shared state. |
| R3-P03 | Phone is not absent, but appears only at `index.html:238` as `Call Alex: 07803 362187`. Nothing equivalent appears in the header/hero or beside the enquiry offer. | `build/claim-ledger.md:18` deliberately allocates the verified-contact claim to Footer, labelled Secondary contact only. The skill required weaker secondary styling but not discoverability. There is no recorded research justification for footer-only placement. Require a verified public enquiry number near the top and final contact for local/service businesses. Secondary means subordinate emphasis, not hidden availability. |
| R3-P04 | Alex appears only at the footer phone link, without context elsewhere. | The ledger records a first name/number but does not explain a business role. The existing cold-visitor copy rule should have caught this; review did not apply it to contact copy. Require a supported relationship or neutral `Call the team` wording. Do not invent that Alex is an owner or project manager. |
| R3-P05 | Earlier report says no blocker remains and marks C11 acceptance passed. | Test counts and collision-free screenshots displaced reference completeness and cold-visitor conversion clarity. Withdraw acceptance, retain narrow test results, and make these product checks explicit within the existing review rather than add another agent/review round. |

## Comparison with the examples

The skill already names Blue Mountain as a structural benchmark and Clean Slate as an execution-quality benchmark. Mentioning them did not enforce their depth. The older `references/reference-fidelity.md` required substantive mapping and side-by-side comparison, but the default entrypoint did not load it; active research instructions were weaker. It is not justified to say the resulting page meets those examples merely because it has a hero, proof, process and repeated CTA.

- Blue Mountain: live web access failed in this review. The bundled copy-library source captured 2026-09-16 contains early phone access, fuller product mechanism and material explanation, multiple customer accounts, fit/selection detail, risk reassurance and repeated offer presentation. This is historical content evidence, not a fresh live visual comparison. Do not copy its claims, guarantees or dated visual style.
- Clean Slate: public page inspected 2026-09-20 at https://www.cleanslatelandsolutions.com/ . It exposes phone access at the top, introduces a named person before personal contact language, and gives separate space to offer, customer evidence, reasons to trust, services and process. This review does not infer current popup behavior from extracted web text.
- Actual supplied reference: https://www.greenretreats.co.uk/ . Its range selection, budget, proof, uses and consultation detail cannot be reduced to large photos alone. Its prices, celebrity, facilities and claims cannot be copied to this client; those buyer questions need client-specific answers or justified exclusions.
- Client evidence: https://gardenroomco.com/about-us/ describes the team, consultation, site survey, design and computer visualisations before commitment, and multiple first-party testimonials. https://gardenroomco.com/ exposes relevant regional pages. These are research leads for fuller evidence-based copy, not permission to fabricate pricing, precise coverage boundaries, ratings or staff roles. Exact delivery scope and current claims require verification when the new page is built.

The current desktop capture is 1440x5039. Its height is not itself a failure threshold. The problem is how little concrete decision help some of that space contains. Increasing whitespace, adding filler sections, imposing a word quota or cloning the reference is not the correction.

## Skill changes and verification scope

- Default workflow now loads reference fidelity. Its coverage map lives inside the existing strategy brief; no extra report or fixed section-count quota.
- Copy/reference rules distinguish unsupported claims from unanswered buyer questions, and require a substantive rationale for omissions.
- Form-entry CTAs open one accessible popup; optional inline access shares state and submission handling. Submission buttons still submit and navigation links may still navigate.
- Verified public enquiry phones must be readable near the top and at final contact; named people need context or neutral team wording.
- Existing visual/conversion/fresh review now checks these requirements explicitly, including every form-entry placement. It cannot label required but absent popup behavior N/A.
- Static helper detects primary links targeting form sections without modal markers and modal markers without dialog markup. Focused fixtures cover failing jumps, allowed content navigation/call controls and dialog markup. Passing markup does not prove runtime behavior; that remains a browser test.

The existing page is not repaired, and no fresh build has been run with this patch. Source changes and helper tests are not proof that the skill now produces an acceptable page. The next cold-start Garden Room run must check R3-P01 through R3-P05 separately from the earlier C01-C11 carryover. Popup lifecycle cases are mandatory on that next run; a required grouped field is only tested when genuinely needed, not added to a business form just for coverage.

No CRM, deployment, live lead, private account or production endpoint was touched. Luke's README and original skill remain unchanged.

Verification of this patch: 69 package tests pass using the bundled Python runtime. The first system-Python run could not import the existing optional ReportLab catalogue dependency; switching to the configured bundled runtime resolved that environment issue. The unchanged attempt-3 page now fails the revised static gate on all four primary `#enquire` links. `git diff --check` passes. No fresh browser interaction or new independent page build was performed during this correction; existing captures were re-inspected alongside source and copy. Usage moved from 43% to 44% on the tracked account-wide weekly meter, below the unchanged 50% ceiling.
