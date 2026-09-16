# Feedback and independent review

Keep `docs/CHANGE-REQUESTS.md` as the single list of requested corrections. Capture requests as they arrive, including constraints and decisions already accepted. Clarify only a material ambiguity that cannot be resolved from the conversation or evidence. Repeated approval requests are not a quality gate.

Use a compact table:

| ID | Request / reason | Constraints and accepted decisions | Affected files/views | Verification | State / evidence | Unresolved reason |
|---|---|---|---|---|---|---|
| CR-001 | Exact user request | Preserve applicable scope | Concrete paths | Observable result | pending / verified with evidence | Blank only when resolved |

States for the feedback ledger are `pending`, `in_progress`, `verified`, `blocked`, and `superseded`. Evidence gates separately retain `pass`, `pass_with_warnings`, `blocked`, or `not_applicable`. A request is verified only after checking its current output. When a newer instruction supersedes one, link the replacement ID; never silently delete an unresolved item.

Map shared changes before editing. An offer/CTA/follow-up change can affect `funnel.json`, landing copy, modal step labels and submit label, thank-you wording, catalogue source and PDF, lead payload, tracking event names, and handoff instructions. A typography change affects desktop, intermediate widths, mobile, and catalogue readability. Backend changes require success/failure/idempotency checks even if screenshots remain unchanged. Rerun the gates that depend on changed artifacts and take a fresh source snapshot.

For a small change, inspect the relevant files and verify the resulting view or behavior. For substantial builds, use an independent reviewer when available. Give that reviewer `build/review-context.md` with:

- current source fingerprint and tested URL;
- brief, brand evidence, reference structure, canonical offer, and sourced claims;
- exact form scope, CRM stages, metrics definitions, and follow-up promise;
- accepted user decisions and constraints;
- report/screenshot/catalogue paths and known external limitations.

The reviewer must look at the actual current artifacts, disclose what could not be inspected, and attach each actionable finding to a selector/path, viewport, screenshot, or reproducible behavior. Ask separately about source integrity, conversion clarity, accessible function, and visual composition; do not substitute a single score for evidence. A reviewer should never override an explicit accepted requirement because of a style preference.

Resolve findings by reproducing them. Disputed issues remain recorded with evidence and a clear decision. Changes made after the review require refreshed evidence for their affected areas. A final review is complete when no unresolved required behavior or factual claim remains, and all remaining warnings have an explicit practical impact.

Use ChatGPT to review the rendered screenshots or an isolated computer-use session. Keyboard checks and screenshots complement each other: a beautiful screenshot does not prove form behavior, and green browser checks do not prove composition. Follow `measured-qa.md` for report shapes, integrity checks, and the distinction between local preview, handoff, and a live funnel.
