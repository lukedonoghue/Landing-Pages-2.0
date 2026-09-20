# Clarentis attempt 5 acceptance

2026-09-20. Source f9ba72d. Independent builder Pascal, Sol 5.6 xhigh, fork_context=false. Independent visual reviewer Hegel, same model/effort, fork_context=false. No parent coaching or earlier artifacts supplied to either. Shared-host instructed boundaries, not an OS sandbox.

## Result

Not accepted as warning-free. The visual reviewer returns pass with two advisories; parent keeps both open and corrects the skill before another fresh build. Historical page files remain unchanged.

1. P2: styles.css hides .hero .action-note at max-width 370px. The text explains that the quote CTA opens an email app; at 320px the visitor loses it. Parent browser assertion and independent screenshot review agree. The builder tightened the narrow hero to fit continuation, but should not have removed decision-relevant action information. quality-gates.md now explicitly protects action explanations, qualifiers and disclosures when adjusting the fold.
2. P3: one expanded FAQ answer says 'the published service list includes'. This violates the existing direct visitor-voice instruction. The final editorial rule now explicitly includes expanded answers and this source-attribution pattern. This is a missed application of an existing rule, not absence of a copy workflow. No new review round or helper added.

## Verified

- 103 of 104 parent assertions pass across 320x700, 390x844, 768x1024, 1024x800, 1280x600 and 1440x900. Only the 320px email explanation fails. Initial premature image-identity assertions were corrected to wait for lazy images to decode; they were test timing errors, not page failures.
- Four native generation calls produced four retained originals whose SHA-256 hashes match tool-returned files. All four are used once. Responsive derivatives count as the same picture. Reviewer found all four service-relevant and adequately disclosed, with no visible collisions or false proof.
- Published dist HTML, CSS and nine assets match the reviewed source bytes. Contact intent is intercepted before OS dispatch: all primary actions point to the source email, with a quote subject. Phone, FAQ keyboard controls, image decoding, local resource loads and overflow checks pass. No live enquiry sent.
- Saved browser report contains ten matching source/applied rendered-font pairs across five standard viewports, using .SF NS on this Mac. This verifies the actual fallback, not a claim that Inter was downloaded.
- Saved Lighthouse mobile report: Performance 100, Accessibility 100, LCP 1652.5794ms, CLS 0, TBT 0. It reports those two categories, not four.
- Source email conversion is retained directly, with no draft-preparation form. Therefore the previous modal validation/close regression is NOT tested or cleared by this page. Form/grouped-field carryovers remain separate.

Evidence: evidence/image-generation-r5/project, parent-audit and independent-review. Official business comparison: https://clarentis.co.uk/ . Luke's README-BOHDAN.md remains byte-identical to baseline 1693490. No CRM, hosting, analytics or PDF acceptance is claimed. PDF deliverable type remains pending clarification.
