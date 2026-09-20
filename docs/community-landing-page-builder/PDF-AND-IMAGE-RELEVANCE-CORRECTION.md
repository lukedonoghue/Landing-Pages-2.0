# PDF scope and image relevance correction

2026-09-20. User finding on Clarentis attempt 2 at http://127.0.0.1:43192/. This correction supplements, rather than erases, the earlier independent audit. No generated test page was changed.

## PDF: omitted by our contract, not a generation failure

Luke's tracked skill at commit 1693490 includes a brand-matched services catalogue/brochure PDF in its six-part funnel and completion contract. README-BOHDAN.md includes PDF generation, rendered review, download and integration acceptance. It remains unchanged.

Our community fork introduced a different default at d417c90. COMMUNITY-LITE-DECISIONS.md explicitly rejects mandatory brochure/CRM/reporting/deployment systems and records moving brochures to optional modules. Current SKILL.md lines 14 and 35 implement that choice: a page is not automatically a brochure, and the brochure module activates for a matching offer or user request. Consequently the three page-first cases did not exercise brochure production. The generator and catalogue review workflow still exist, but were not selected.

This was an orchestrator scope simplification, not three agents independently failing a mandatory PDF instruction. Deferral of CRM/deployment does not establish approval to omit a brochure. We should have exposed that product-scope change rather than presenting page-only tests as complete tests of Luke's funnel. PDF/catalogue acceptance remains untested in these three cases.

The user's earlier request also allowed screenshots instead of PDF for visual page review. A screenshot of the page and a downloadable visitor brochure are different deliverables. The current clarification asks which PDF is intended before changing the default or adding a download/form promise. No brochure default change is claimed in this correction.

## Image count and wrong subject

Attempt 2 build/image-plan.md selected a hero workspace and a supporting studio, plus the official logo. The skill said to plan by role, not quota. It did not mandate only two pictures. The plan supplied generic role descriptions but did not demonstrate that they covered the page's visual explanation needs.

The exact native generation prompt for the second image called for an independent UK maker's studio with ceramic objects, kraft packaging, blank forms, a notebook and pen. The resulting pixels are dominated by pottery, flowers, tools and packaging. This is the literal outcome of the wrong creative brief, not an image tool malfunction. It accompanies 'Make the everyday numbers easier to manage' and setup/records/filing copy, without a researched maker-specific audience explanation or an accounting activity.

The fresh reviewer explicitly called the craft scene an indirect accounting illustration but classified it as 'Taste only', citing realism and disclosure. The parent accepted that reasoning. That classification is withdrawn: disclosure addresses truthfulness, not relevance. This is a P2 visual-content finding and must be checked separately from image loading, crop, overlay, accessibility and provenance. The overall attempt was already blocked for other findings; this adds a missed blocker, not a retroactive pass.

## Source correction and next acceptance

Only references/image-research-and-generation.md is changed:

- Existing image-plan purpose now names the visible subject/action supporting adjacent copy.
- Generation/sourcing starts with the intended visitor understanding; arbitrary customer-industry scenes need a researched, explicit connection.
- Existing per-image visual review now rejects realistic but irrelevant assets. No extra review round, tool, quota or generated-image minimum is added.

Attempt 3 was launched from frozen source 38148fd before this finding. It cannot validate this new correction, even if its images happen to be better. Do not send this finding to its builder and then call the outcome an independent first run. Review its completed result separately; the next clean build must use the corrected frozen skill. PDF scope awaits the user's answer.
