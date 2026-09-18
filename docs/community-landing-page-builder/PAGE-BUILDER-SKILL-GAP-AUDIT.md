# Page Builder Skill Gap Audit

Date: 2026-09-18
Audit type: read-only forensic comparison
Target product: a lightweight, one-prompt landing-page skill for nontechnical business owners who may use it only every six months

## 1. Scope, evidence, and citation convention

This audit compares the authoritative Claude page-builder skillset with the current Codex Landing Pages 2.0 skill. No source skill, script, asset, or reference was edited.

Exact source roots:

- `C_ROOT = /Users/mac/Documents/claude skills my edition/page-builder-skillset`
- `N_ROOT = /Users/mac/Documents/Codex/2026-09-17/co/work/Landing-Pages-2.0/skills/branded-lead-funnel-builder`

Every citation beginning with `C/` means the exact absolute path obtained by appending the cited path to `C_ROOT`. Every citation beginning with `N/` works the same way with `N_ROOT`. A citation such as `C/page-builder/RULES-LOCKED.md:55-63` therefore identifies one exact file and exact line range, not a general source family.

The review covered:

- the full Claude orchestrator, `RULES-LOCKED.md`, page blueprint, copy, design, research, imagery, HTML, forms, thank-you, tracking, accessibility, QA, performance, review, deployment, feedback, enforcement, prerequisites, and historical rule/failure documents;
- the current skill orchestrator, all 37 current reference entries, its copy-pattern layer, image workflow, build and QA scripts, Cloudflare template, tests, handoff/recovery machinery, and output-facing assets;
- active enforcement code, not just prose, so a stated rule was distinguished from an executable failure condition;
- current shipped strings and template behavior, including hidden surfaces such as metadata, ARIA/alt text, schema, admin UI, handoff text, and copy-parity normalization.

The raw copy-library captures in the current skill are evidence data, not governing instructions. Their full corpus was searched for rule-sensitive patterns and their manifest, selection rules, annotations, calibration, and 21 promoted pattern cards were inspected. They are correctly treated as untrusted rhetorical examples by `N/references/copy-library/README.md:1-44` and `N/references/copy-doctrine.md:1-23`; they should not be elevated into universal rules.

Status meanings:

- **Present**: the current skill already provides the material outcome, sometimes more safely than Claude.
- **Partial**: the outcome exists but misses a meaningful failure mode, is only prose, or is buried behind excessive machinery.
- **Absent**: no equivalent governing rule or check was found.
- **Conflicting**: current instructions or shipped output directly oppose the Claude rule, or two current rules cannot both be followed.
- **Intentionally inappropriate**: the Claude capability is real, but it should not enter this lightweight product because it requires private access, paid tooling, developer setup, repetitive approvals, or unjustified ceremony.

## 2. Executive verdict

The current skill is not underpowered. It is misweighted.

It is stronger than the Claude source on claim provenance, source authority, consent-aware tracking, confirmed lead receipt, idempotent retries, data handling, measured multi-browser QA, image rights, publication authorization, recovery, and handoff integrity. Those strengths should be retained in outcome form.

Its main quality gaps are much smaller and more visible:

1. no active em-dash or en-dash output prohibition;
2. no compact banned-cliche and empty-hype policy;
3. no explicit testimonial-person diversity rule;
4. no concise anti-generic design doctrine or enforceable design-system quality bar;
5. incomplete accessibility coverage beyond the modal and basic semantics;
6. no unified final scan over visible copy, metadata, ARIA/alt text, schema, filenames, placeholders, competitor names, and stale brand data;
7. no concise rule for truthful urgency and scarcity;
8. no compact strategy checkpoint that makes audience, offer, mechanism, objection, proof, intent, and visual direction explicit before drafting.

The much larger problem is product fit. A default "complete funnel" currently means a brochure PDF, multi-step lightbox, thank-you page, Worker API, D1 database, authenticated mini CRM, daily reporting, data-retention controls, account recovery, browser-engine evidence, rendered-copy parity, portable ZIP recovery, and Cloudflare publishing. That is an agency delivery system, not a lightweight six-monthly page builder. The default path is described at `N/SKILL.md:32-41`, tested through `N/SKILL.md:179-226`, and delivered through `N/SKILL.md:228-239`.

The recommended product boundary is:

- default: researched copy, distinctive responsive page, appropriate imagery, accessible lead capture or honest contact action, thank-you behavior when a form exists, and real visual/static/browser QA;
- optional modules: brochure, CRM, advanced attribution, advertising adapters, deployment, backups, recovery, and handoff archive;
- no default requirement for an API key, MCP server, paid private integration, ad-account access, private repository, or developer-only environment.

The correct migration is therefore not "copy all Claude rules." It is:

- keep current truth, consent, delivery, and measurement outcomes;
- add a short set of missing copy, design, accessibility, and final-scan guardrails;
- remove or demote most infrastructure and evidence ceremony from the default route;
- refuse to import Claude rules that contradict one another or incentivize fabricated filler.

## 3. Material capability crosswalk

### 3.1 Research, strategy, and source integrity

| Claude capability | Claude source | Current source and status | Audit decision |
|---|---|---|---|
| Website alone can start the build; ask only consequential unknowns | `C/strategic-brief-builder/SKILL.md:25-80`; orchestrator research phases | `N/SKILL.md:10,51,71` - **Present and better aligned** | Keep current one-prompt autonomy. Do not import Claude's questionnaire sequence. |
| Source hierarchy and claim ledger | `C/site-scraper-brand-extractor/SKILL.md:259-268`; `C/page-builder/RULES-LOCKED.md:328-339` | `N/references/research-and-claims.md:5-37`; `N/SKILL.md:87-94` - **Present and stronger** | Keep authority, semantic support, qualifiers, scope, freshness, and approval. Reject Claude's simplistic two-source formula. |
| Compact evidence-backed strategy checkpoint | `C/strategic-brief-builder/SKILL.md:25,335-370` | `N/SKILL.md:106-127` creates many artifacts but no single decisive synthesis - **Partial** | Add one internal brief, not two user approval rounds. |
| Buyer awareness and decision-stage diagnosis | `C/offer-research/SKILL.md:246-264`; `C/market-research/SKILL.md:86-135` | `N/references/intake-schema.md:42-47`; `N/references/copy-doctrine.md:25-37` - **Partial** | Add a qualitative problem-aware/comparing/ready-to-act decision. No percentage estimates. |
| Trigger, comparison, risk, and decision journey | `C/market-research/SKILL.md:122-135` | Buyer psychology is named at `N/SKILL.md:106-110` but required fields are not explicit - **Partial** | Add four fields to the compact brief. |
| Real mechanism and benefit-to-proof map | `C/offer-research/SKILL.md:85-116,146-157,210-225` | `N/references/copy-doctrine.md:39-49`; `N/references/copy-workflow.md:41-61` - **Present/Partial** | Keep the chain; make the real operational mechanism explicit. Never invent a named method. |
| Bounded direct-competitor gap scan | `C/competitor-scanner/SKILL.md:23-59,78-86` | `N/references/copy-doctrine.md:39-43`; `N/references/research-and-claims.md:60` - **Partial** | Add a conditional two- or three-page scan. No Firecrawl requirement. |
| Third-party name classification: comparator, platform, provenance | `C/page-builder/RULES-LOCKED.md:370-394` | No equivalent rule found - **Absent** | Add simplified and conditional. Do not impose a universal comparator-name ban. |
| Message match from real keyword/ad evidence | `C/page-builder/RULES-LOCKED.md:396-418` | `N/SKILL.md:120`; `N/references/copy-and-structure.md:29,69` - **Present and better aligned** | Keep supplied keyword evidence and clearly label inferred intent. Do not require Ads/MCP access. |
| Testimonial provenance and faithful shortening | `C/testimonial-miner/SKILL.md:150-190`; locked rules D1-D5 | `N/references/research-and-claims.md:39-47`; `N/SKILL.md:92-94,126` - **Present** | Keep. |
| Different people across testimonial cards | `C/testimonial-miner/SKILL.md:182-190`; `C/page-builder/RULES-LOCKED.md:65-83` | No duplicate-person rule in `N/references/research-and-claims.md:39-47` - **Absent** | Add the honesty outcome; do not require three testimonials. |
| Fixed quotas for VOC, competitors, and sources | `C/offer-research/SKILL.md:120-143`; `C/market-research/SKILL.md:54-61,267-291` | `N/references/research-and-claims.md:60`; `N/references/copy-doctrine.md:41-43` reject arbitrary quotas - **Intentionally inappropriate** | Do not add. Sufficiency is whether the buyer decision and permitted proof are clear. |
| Google Ads MCP/pasted keyword blocker | `C/strategic-brief-builder/SKILL.md:88-138` | Conflicts with `N/SKILL.md:10,51` and `N/references/copy-and-structure.md:69` - **Intentionally inappropriate** | Do not add. It violates the task's private-integration exclusion. |

### 3.2 Copy, offer, proof, and conversion argument

| Claude capability | Claude source | Current source and status | Audit decision |
|---|---|---|---|
| Outcome-led H1 and benefit-led selling headings | `C/conversion-copywriter/SKILL.md:51-105,142-172` | `N/references/copy-doctrine.md:5-13,51-61`; `N/references/copy-and-structure.md:28-35` - **Present** | Keep current flexible outcome rule. |
| One audience, one offer, one exact primary action | `C/conversion-copywriter/SKILL.md:70-76,787-847`; locked K rules | `N/references/copy-and-structure.md:28-35`; `N/SKILL.md:118-127,154-162` - **Present** | Keep, while preserving accurate Phone, Back, Continue, and Download control labels per `N/references/copy-doctrine.md:63-65`. |
| Strong proof high and proof adjacent to claims | `C/page-builder/RULES-LOCKED.md:29-36`; `C/conversion-copywriter/SKILL.md:85-89,171-172` | `N/SKILL.md:122`; `N/references/copy-and-structure.md:37-43`; `N/references/research-and-claims.md:47` - **Present** | Keep current. Do not import a quota of three quantified points. |
| Follow-up promise is identical across page, form, and confirmation | `C/conversion-copywriter/SKILL.md:533-557` | `N/SKILL.md:124`; `N/references/copy-and-structure.md:34-35` - **Present** | Keep. |
| Claim qualifiers and unsourced-number scan | `C/conversion-copywriter/SKILL.md:107-113,561-580,1117-1142` | `N/references/research-and-claims.md:24-37`; `N/SKILL.md:91,127` - **Present** | Keep; add explicit ratio/percentage arithmetic check when comparative figures are used. |
| Specific nouns and stranger test | `C/conversion-copywriter/SKILL.md:114-122,646-713` | `N/references/copy-and-structure.md:67-69`; `N/references/copy-doctrine.md:11-13,73-80` - **Present/Partial** | Add a concise first-time-reader test, not the literal ban on words such as "guide" or "report." |
| Every bullet is concrete, beneficial, and section-relevant | `C/conversion-copywriter/SKILL.md:124-131,676-695` | `N/references/copy-and-structure.md:67-69` - **Partial** | Add simplified. Do not automatically delete every short bullet. |
| Selling headings are assertions, with FAQ/real-objection exceptions | `C/conversion-copywriter/SKILL.md:53-68` | `N/references/copy-doctrine.md:9,13` deliberately permits meaningful question-led or long headings - **Conflicting** | Keep current flexibility; add only "do not use generic questions that make the reader supply the value." |
| Banned buzzwords and AI-style hype | `C/conversion-copywriter/SKILL.md:584-593` | No equivalent list - **Absent** | Add a short high-confidence list plus a specificity test. Do not make legitimate contextual uses impossible. |
| Banned manipulative voice phrases | `C/conversion-copywriter/SKILL.md:268-298` | No equivalent exact list; `N/references/copy-doctrine.md:33,57` rejects fear inflation - **Partial** | Add the most egregious promises as examples; keep the governing rule evidence-based and non-manipulative. |
| No em dash or en dash in output surfaces | `C/conversion-copywriter/SKILL.md:597-621`; active gate `C/enforcement/gate_check_lp.py:92,429-440` | No rule; current output emits them and parity normalizes them at `N/scripts/copy_parity.py:31` - **Absent and conflicting** | Add as an explicit house-style rule over customer-facing marketing output and hidden surfaces, with a real scan. |
| No fake urgency or scarcity | `C/conversion-copywriter/SKILL.md:850-885` | `N/SKILL.md:51` bans invented deadlines; no general countdown/capacity rule - **Partial** | Add one sentence. |
| No misleading comparison cells | `C/conversion-copywriter/SKILL.md:458,1026-1034` | No equivalent found - **Absent, conditional** | Add only when a comparison table is used. |
| Copy-density and headline-flow editing | `C/conversion-copywriter/SKILL.md:963-1023` | `N/references/copy-doctrine.md:13,73-80`; visual heading-wrap checks at `N/references/measured-qa.md:32-40` - **Present/Partial** | Keep qualitative editing; do not import contradictory hard word counts. |
| Practitioner register, conditions beside numbers, arithmetic | `C/page-builder/RULES-LOCKED.md:487-572` | `N/references/copy-doctrine.md:25-35`; mechanism/qualifier rules - **Partial** | Add a compact expert-audience variant. Omit withdrawn jargon-density quotas. |
| Adaptive persuasive jobs rather than a fixed section count | `C/page-blueprint/SKILL.md:13-47,494-504` | `N/references/copy-and-structure.md:5-24` - **Present and stronger** | Keep. Resolve the current section-order conflict at `N/SKILL.md:30,43`. |

### 3.3 Design system, layout, imagery, and media

| Claude capability | Claude source | Current source and status | Audit decision |
|---|---|---|---|
| Brand-derived palette, typography character, and correct logo variant | `C/page-builder/RULES-LOCKED.md:97-117`; `C/design-system-generator/SKILL.md:93-105,425-436` | Brand extraction exists at `N/SKILL.md:87-90` and `N/references/research-and-claims.md:56-58`, but design direction is only broad at `N/SKILL.md:129-135` - **Partial** | Add a compact brand-fidelity block. |
| Concrete design-system tokens and atmosphere direction | `C/design-system-generator/SKILL.md:38-390` | `N/SKILL.md:111,131` requires `DESIGN-SYSTEM.md`, but the skill supplies little governing visual doctrine - **Partial/Absent** | Add simplified tokens and composition principles, not a large taxonomy. |
| Explicit anti-generic patterns | `C/page-builder/SKILL.md:61,70-74,354-358`; `C/design-destroyer/references/tells.md:21-128` | Side-by-side review catches some regressions at `N/references/reference-fidelity.md:35-47`, but no explicit visual bans - **Absent** | Add a short anti-template checklist. |
| Varied section composition | `C/design-system-generator/SKILL.md:375-390` | `N/references/reference-fidelity.md:7-12,37-45` checks pacing and section distinctiveness - **Present/Partial** | Keep outcome; add "do not repeat the same composition three sections in a row." |
| Clean card grids and robust intermediate widths | `C/page-builder/RULES-LOCKED.md:308-324,420-463` | Current measures 360 through 1440 and warns on wraps/grids at `N/references/measured-qa.md:30-40` - **Partial** | Add clean-row and fragile-layout rules; keep actual responsive sweep. |
| CTA above fold at canonical viewports | `C/page-builder/RULES-LOCKED.md:316-324,450-463` | Current records CTA positions as warnings at `N/references/measured-qa.md:32-40` - **Partial** | Make first-screen CTA a review requirement where conversion is the page's purpose, not an unconditional static failure for every layout. |
| Actual rendered visual review | `C/visual-qa/SKILL.md:103-253,366-375` | `N/SKILL.md:183-210`; `N/references/measured-qa.md:46-52` - **Present and stronger** | Keep the pixels-and-interactions outcome; reduce evidence schema. |
| Asset provenance and reuse rights | `C/image-sourcer/SKILL.md:123-139,161-178,205-229` | `N/references/image-research-and-generation.md:17-24`; `N/references/image-workflow.md:15-53` - **Present and stronger** | Keep outcome. |
| Never generate proof, client people, logos, awards, or before/after evidence | `C/image-generator/SKILL.md:56-75` | `N/SKILL.md:131-135`; `N/references/image-research-and-generation.md:26-38` - **Present and stronger** | Keep. No API/model ceremony needed. |
| Reject malformed text/hands, false endorsement, misleading context | `C/page-builder/RULES-LOCKED.md:465-483` | `N/references/image-research-and-generation.md:30-38`; `N/references/image-workflow.md:150-197` - **Present** | Keep, with lighter evidence. |
| Local responsive assets, dimensions, hero priority, lazy below fold | `C/page-builder/RULES-LOCKED.md:260-270`; `C/pagespeed-audit/SKILL.md:91-177` | `N/references/build-contract.md:67-75`; `N/references/image-workflow.md:140-152` - **Present** | Keep. |
| Video facade with meaningful poster and click-to-load controls | `C/page-builder/RULES-LOCKED.md:19-27`; `C/landing-page-html-builder/SKILL.md:702-704` | No equivalent governing rule found - **Absent, conditional** | Add only when video materially helps. Do not ban YouTube universally. |
| Exact GPT model/API provenance workflow | Claude image generation workflow | `N/SKILL.md:133`; `N/references/image-workflow.md:85-138` already contains an even heavier exact-model path - **Intentionally inappropriate** | Remove from default. Never require the user to supply an API key. |

### 3.4 Forms, thank-you behavior, tracking, and privacy

| Claude capability | Claude source | Current source and status | Audit decision |
|---|---|---|---|
| Real labels, validation, focus trap, Escape, focus return, visible errors | `C/landing-page-html-builder/SKILL.md:421-427,468-503,541-647`; accessibility skill | `N/references/build-contract.md:29-57`; `N/SKILL.md:195-206` - **Present and stronger** | Keep. |
| Never fake form success; confirm persistence before redirect/conversion | `C/landing-page-html-builder/SKILL.md:468-503,575-647` | Receipt/idempotency contract at `N/SKILL.md:173`; `N/references/lead-and-tracking-contract.md:21-31` - **Present and stronger** | Keep the outcome. Do not port Claude's broken Apps Script response handling. |
| Separate thank-you destination and one-shot conversion guard | `C/page-builder/RULES-LOCKED.md:119-129`; session contract | `N/references/build-contract.md:38-41,85-89`; `N/scripts/validate_funnel.py:152-167` - **Present** | Keep only when a form exists. |
| Minimal approved field set | Locked form rules and copy/form builder | `N/SKILL.md:160-161`; `N/references/build-contract.md:31-38` - **Present/Partial** | Keep no-extra-fields rule. Do not impose a universal three-field maximum. |
| Region-aware phone entry and normalization | `C/page-builder/RULES-LOCKED.md:129-258` | General field/schema validation exists; no equally detailed phone behavior - **Partial** | Add a concise conditional phone rule, not the long NANP implementation. |
| No raw contact data in analytics | `C/landing-page-html-builder/SKILL.md:468-473,596-617`; later Claude tracking sources conflict | `N/SKILL.md:165-173`; `N/references/build-contract.md:59-65`; `N/references/advertising-tracking.md:3-32` - **Present and stronger** | Keep current. Do not port Claude's raw-PII tracking samples. |
| Consent-aware optional enhanced conversions | Claude tracking setup is inconsistent | `N/SKILL.md:169`; `N/references/advertising-tracking.md:30-83` - **Present and stronger, but heavy** | Keep disabled by default and optional. Remove from ordinary build requirements. |
| Spam controls and injection safety | Claude form backend has inconsistent field names and incomplete escaping | Current server validation/honeypot/rate limits at `N/references/lead-and-tracking-contract.md:21-25` - **Present/Partial** | Preserve outcome. If spreadsheet/email backends are ever added, escape all formula and HTML contexts. |
| Apps Script and Sheets as mandatory backend | `C/page-builder/SKILL.md:44-51`; form backend skill | Conflicts with current Workers/D1 and target simplicity - **Intentionally inappropriate** | Do not add. Backend must be optional and provider-neutral. |

### 3.5 Accessibility, performance, QA, deployment, and process

| Claude capability | Claude source | Current source and status | Audit decision |
|---|---|---|---|
| Semantic structure, labels, alt text, focus, reduced motion | `C/accessibility-fixer/SKILL.md:34-111,227-270,311-387` | `N/references/build-contract.md:77-83`; modal checks at `N/references/measured-qa.md:32-42` - **Present** | Keep. |
| Skip link, AA contrast, target size, zoom, focus not obscured, paste, redundant-entry checks | `C/accessibility-fixer/SKILL.md:335-461` | No complete equivalent in current governing checklist - **Partial/Absent** | Add a compact WCAG 2.2 AA baseline and test it. |
| Empty alt for decorative images | Correct Claude design-system rule at `C/design-system-generator/SKILL.md:394-405` | `N/references/image-workflow.md:15-25` - **Present** | Keep. Reject contradictory Claude rules demanding nonempty alt for every image. |
| Measured responsive and interaction QA | `C/visual-qa/SKILL.md:103-253` | `N/SKILL.md:183-218`; `N/references/measured-qa.md:30-52` - **Present and stronger** | Keep the checks; reduce the number of mandatory reports. |
| Real Lighthouse budgets | `C/pagespeed-audit/SKILL.md:24-35,179-235` | `N/references/performance-and-browser-qa.md:64-81` - **Present and stronger for local use** | Keep local measurement and honest limitations. |
| Live PSI API only, never local measurement | `C/pagespeed-audit/SKILL.md:28-59` | Conflicts with a predeploy one-prompt path and requires an API/live URL - **Intentionally inappropriate** | Do not add. Post-publish measurement is optional. |
| Preserve appearance/tracking while optimizing | `C/pagespeed-audit/SKILL.md:28-35,179-209` | `N/references/performance-and-browser-qa.md:3,77-81` - **Present/Partial** | Keep; use inspected or thresholded visual diff, not exact pixel identity. |
| Final hidden-surface banned/stale scan | `C/page-builder/RULES-LOCKED.md:341-395` | `N/scripts/validate_funnel.py:186-193` catches narrow template markers only - **Absent** | Add. |
| Executable punctuation/banned-word gate | `C/enforcement/gate_check_lp.py:92,429-440` | No equivalent; `N/scripts/copy_parity.py:31` normalizes punctuation - **Absent/conflicting** | Add a small output scanner, scoped to intended customer-facing surfaces. |
| Source-fresh evidence, no claiming visual fixes from source alone | `C/page-builder/RULES-LOCKED.md:341-368` | `N/references/measured-qa.md:5-28,46-52` - **Present and stronger** | Keep outcome; collapse report ceremony. |
| Multi-person expert score gates | Claude quality/expert-panel skills | No exact current equivalent; current uses evidence states - **Intentionally inappropriate** | Do not add numeric persona theater. Use binary launch blockers and concrete findings. |
| Optional publication authorization and honest live status | Claude deploy process | `N/SKILL.md:20,47,57,75-77,220-226` - **Present and stronger** | Keep. |
| Cloudflare-only hosting plus D1 CRM | Claude deployer is Cloudflare-specific but contradictory | `N/SKILL.md:41,47,81` - **Conflicting with lightweight target** | Make deployment optional and hosting-neutral at the core; use a provider module only when requested. |
| Private GitHub pushes, phase commits, stop hooks, review loop | Claude orchestrator/deployer/review-loop | Current makes GitHub optional, but has extensive handoff/recovery machinery - **Intentionally inappropriate** | Do not add. |

## 4. Dedicated absolute-prohibition inventory

This section inventories the Claude rules stated as never, banned, forbidden, hard block, blocker, or launch failure. Repeated statements are consolidated, but their exact governing locations are retained. "Claude absolute" describes the source; it does not mean this audit recommends importing the rule unchanged.

### 4.1 Truth, claims, proof, and identity

| Claude absolute prohibition or fail condition | Exact location | Current status | Disposition for lightweight skill |
|---|---|---|---|
| Never expose prospect qualification thresholds in copy, FAQ, metadata, alt text, or routing explanation | `C/page-builder/RULES-LOCKED.md:7-15` | No equally specific rule | **Add simplified** when segmentation is used: route privately and do not disclose an internal gate as public value copy. |
| Never invent certifications, partner badges, awards, licenses, or verification claims | `C/page-builder/RULES-LOCKED.md:55-63` | Covered by `N/SKILL.md:91-94` and claim ledger | **Keep current**; unify in the final truth block. |
| Never turn one person into multiple independent testimonial cards | `C/page-builder/RULES-LOCKED.md:65-83`; `C/testimonial-miner/SKILL.md:182-190` | **Absent** | **Add simplified**. Use fewer cards or different verified proof. |
| Never synthesize a quote, plausible attribution, stock avatar, or "based on customer feedback" composite | `C/page-builder/RULES-LOCKED.md:75-83` | Covered in substance by current review/image rules | **Keep and state once clearly**. Do not use Claude's marked-placeholder escape hatch. |
| A testimonial placeholder blocks go-live | `C/page-builder/RULES-LOCKED.md:75-83` | Current blocks workflow markers, not this exact placeholder | **Do not port literally**. Omit the section or use other verified proof; no fake production placeholder should ship. |
| Never fabricate schema or mark up claims/reviews that the page cannot support | `C/landing-page-html-builder/SKILL.md:138-162` | Claim integrity exists; schema-specific language is sparse | **Add simplified** to final truth scan. |
| Every number and claim must have source, scope, qualifiers, and correct arithmetic | `C/conversion-copywriter/SKILL.md:561-580,1117-1142`; `C/page-builder/RULES-LOCKED.md:538-542` | Strongly present, arithmetic only partial | **Keep current; add arithmetic sentence**. |
| No unsourced superiority or absolute claims | `C/conversion-copywriter/SKILL.md:760-773` | Current warns through claim ledger | **Keep current**, with explicit comparison/superlative scan. |
| Never AI-generate logos, testimonial people, customers, team members, client projects, before/after evidence, certificates, awards, or product-specific proof | `C/image-generator/SKILL.md:56-75` | Present and stronger at `N/references/image-research-and-generation.md:26-38` | **Keep current**. |
| Never promise that the page will produce a conversion-rate win | `C/PRIORITIES-FROM-LUKE-MEETING-2026-05-07.md:86-91` | No equally direct promise rule | **Add direct**: describe expected rationale and measurement plan, not guaranteed conversion. |
| Never remove watermarks, mislabel unrelated images as before/after, or use reference-page brand assets | Claude asset rules; current equivalent at `N/references/research-and-claims.md:49-54` | Present | **Keep current**. |
| Never describe a unilateral choice as something "agreed" by the client | `C/page-builder/RULES-LOCKED.md:370-395` | Current preserves real authorization but not this exact wording | **Add simplified** to authorization/claim honesty. |

### 4.2 Copy, wording, punctuation, and typographic style

#### Exact banned-word inventory

Claude says "Never use" the following at `C/conversion-copywriter/SKILL.md:584-593`:

`solutions`, `leverage`, `innovative`, `comprehensive`, `cutting-edge`, `world-class`, `best-in-class`, `state-of-the-art`, `unique`, `synergy`, `holistic`, `seamless`, `robust`, `dynamic`, `next-generation`, `game-changing`, `paradigm`, `utilize`, `optimize`, `streamline`, `empower`, `revolutionize`, `transform` without specifics, `leading`, `premier`, `top-notch`, `unparalleled`, standalone `exceptional`, `right for you` in headlines, `uncorrelated with the economy`, `macroeconomic cycles`, `customer-satisfaction data`, `data-driven` without specifics, `satisfaction scores`, and `metrics` in CTAs or bridge copy.

Recommendation: **Add simplified**, not as an unqualified universal lexical ban. Block empty use of these words in customer-facing copy; allow a term when it is the client's verified category, a necessary technical term, or followed by concrete evidence. The governing test is whether the phrase says what changed, for whom, by what mechanism, or with what proof.

#### Exact hard-blocked voice phrases

Claude blocks these phrases at `C/conversion-copywriter/SKILL.md:268-284`:

- `while you sleep`
- `the machine already works`
- `money flows in`
- `set it and forget it`
- standalone `financial freedom`
- standalone `be your own boss`
- `escape the rat race`
- `fire your boss`
- `imagine waking up to...`
- `the secret to...`

It flags for replacement at `C/conversion-copywriter/SKILL.md:286-298`:

- `proven path to ownership`
- standalone `refined systems`
- `complete support`
- standalone `everything you need`
- standalone `from day one`
- standalone `the playbook exists`

Recommendation: **Add simplified examples** under a broader rule: no effortless-income, secret, escape, or unsupported completeness language. Do not turn the whole list into an industry-blind parser.

#### Other lexical and copy hard blocks

| Claude absolute | Exact location | Recommendation |
|---|---|---|
| No empty kicker, mood label, category label, or generic offer label | `C/page-builder/RULES-LOCKED.md:38-51`; `C/conversion-copywriter/SKILL.md:146-163` | **Add simplified**: remove decorative labels that add no meaning. |
| No generic selling question such as "Ready for X?" outside FAQ, a genuine objection heading, or the designated exception | `C/conversion-copywriter/SKILL.md:53-68` | **Add simplified** only for generic questions. Do not ban meaningful question-led headings. |
| No feature-first or business-achievement-first selling headline | `C/conversion-copywriter/SKILL.md:78-105` | Current outcome rule already covers this. **Keep**. |
| No orphan bullet, generic feature bullet, heading paraphrase, or buyer-irrelevant bullet | `C/conversion-copywriter/SKILL.md:124-131,676-695` | **Add simplified** three-part bullet test. Do not hard-fail solely for fewer than five words. |
| No repeated numeric credential in adjacent H2s | `C/conversion-copywriter/SKILL.md:625-636` | **Add simplified** as duplication editing, not a bespoke parser. |
| No inconsistent follow-up promise | `C/conversion-copywriter/SKILL.md:533-557` | Present. **Keep**. |
| No fake urgency, countdown, limited-time language, or capacity claim without verifiable basis | `C/conversion-copywriter/SKILL.md:850-885` | **Add direct**. |
| No empty, dash-only, or `N/A` competitor cells that imply zero | `C/conversion-copywriter/SKILL.md:458,1026-1034` | **Add conditional**. Use standalone proof when comparison data is unavailable. |
| No run of broken fragments, multiple sentence-ending periods in a heading, or incomplete list fragments in consumer copy | `C/conversion-copywriter/SKILL.md:963-986` | **Add as editorial review**, not a universal syntax gate for technical brands. |
| Vague CTA labels `Learn More`, `Get Started`, `Contact Us`, `Submit`, and `See the Full [vague noun]` fail | `C/conversion-copywriter/SKILL.md:787-802` | **Add simplified**: label the real action or deliverable. Allow `Contact us` only when contacting is literally the offer and a more specific label would mislead. |
| Orphan nouns `brief`, `report`, `model`, `system`, `framework`, `package`, `approach`, `solution`, `kit`, `guide`, `overview`, `breakdown`, `deep dive`, `deliverable` cannot appear in H1/H2/CTA/offer copy without a specifying noun | `C/conversion-copywriter/SKILL.md:646-713`, especially `:668` | **Add the stranger test**, not the blanket word ban. "2026 pricing guide" is clear; "get the guide" may not be. |
| No invented stats, testimonials, placeholders, or double hyphens | `C/conversion-copywriter/SKILL.md:1037-1057` | Truth/placeholder rules should be direct. Treat double hyphens as a house-style cleanup, not factual integrity. |

#### Exact punctuation rule, especially em dashes

The authoritative rule lives at:

- `C/conversion-copywriter/SKILL.md:597-621`
- `C/expert-panel/SKILL.md:35-42`
- `C/expert-review/SKILL.md:118-124`
- executable constants/check at `C/enforcement/gate_check_lp.py:92,429-440`

Its exact scope is zero Unicode em dash (`U+2014`), zero Unicode en dash (`U+2013`), zero HTML em-dash entities, and zero HTML en-dash entities in visible copy, title/meta/OG/Twitter text, alt text, ARIA text, JSON-LD/schema, and even comments. It directs the writer to use an ASCII hyphen or rewrite. `C/conversion-copywriter/SKILL.md:1037-1057` separately rejects a double hyphen and asks for curly quotation marks rather than straight quotation marks in prose.

Important forensic qualifications:

1. This is a house-style/AI-tell rule, not a WCAG or conversion-science requirement.
2. The active gate really checks output at `C/enforcement/gate_check_lp.py:429-440`.
3. The command examples in `C/conversion-copywriter/SKILL.md:607-619` were damaged by a bulk replacement and now search/replace the wrong characters. The rule is clear; those examples are not reliable implementation guidance.
4. `C/enforcement/check_consistency.py:84-91` currently reports 55 dash violations inside the Claude skillset, concentrated in the later design-destroyer files. The authoritative repository therefore does not currently satisfy its own global rule.
5. `C/CHANGELOG.md:7-31` reports historical dash cleanup, but the current scan is the relevant evidence.
6. A current-skill scan excluding raw copy-library corpus, package lock, and binary fonts found 17 em-dash and 12 en-dash code points. These include shipped admin UI, generated handoff text, setup/runtime messages, and documentation, not just archival examples. Representative exact locations are listed in P0-1 below.

Recommendation: **Add direct, narrowly scoped**. For this product, prohibit em/en dashes in generated customer-facing marketing content and hidden customer-facing surfaces, and enforce it with a Unicode/entity scan. Do not make punctuation inside internal developer logs, code operators, raw research captures, or third-party source quotations a page-quality failure. Update templates at the same time or the rule will fail immediately.

### 4.3 Visual design, fonts, layout, imagery, video, and navigation

| Claude absolute prohibition or fail condition | Exact location | Lightweight disposition |
|---|---|---|
| No violet/purple gradient on white, blue-to-purple hero gradient, or uniform gray card grid | `C/page-builder/SKILL.md:70-74` | **Add simplified** as anti-template defaults; permit only when verified brand evidence makes the choice intentional. |
| No emoji icons | `C/page-builder/SKILL.md:53-69,354-358` | **Add direct** for interface iconography. Plain-text emoji in genuine brand copy can be treated separately. |
| No generic token names or recycled design system | `C/page-builder/SKILL.md:61,354-358`; `C/landing-page-html-builder/SKILL.md:113-115` | **Add outcome**, not naming ceremony: the system must be visibly brand-specific. |
| Do not default to Inter variants, Roboto variants, Arial, Helvetica/Neue, system/native stacks, Open Sans, Lato, standard Montserrat, Poppins, or Raleway unless brand-verified; Montserrat Alternates is allowed | `C/page-builder/RULES-LOCKED.md:99-109` | **Do not import the whole blacklist**. Require brand-appropriate typography and reject ubiquitous defaults when they erase brand character. |
| No arbitrary off-brand colors; supplied assets outrank scraped substitutes; primary brand color must visibly appear | `C/page-builder/RULES-LOCKED.md:111-117` | **Add simplified**. |
| No three or more consecutive sections with the same composition | `C/design-system-generator/SKILL.md:375-383` | **Add simplified**. |
| No orphan `3+2` five-card grid | `C/page-builder/RULES-LOCKED.md:308-314` | **Add outcome**: fill rows cleanly or use a deliberate featured-card composition. |
| No `overflow-wrap:anywhere`, `word-break:break-all`, or `hyphens:auto` on headings, stats, buttons, nav, or short labels; no `ch` heading widths; no fixed-min-width child inside a multicolumn grid | `C/page-builder/RULES-LOCKED.md:424-438` | **Add direct/simplified**. These prevent real responsive failures. |
| Never hotlink production assets from third-party image CDNs | `C/page-builder/RULES-LOCKED.md:262-270` | Current local acquisition already covers this. **Keep**. |
| Never reuse one visible image file in multiple sections | `C/image-sourcer/SKILL.md:28-47` | **Do not port literally** because the same logo properly appears in header/footer. Add "avoid obvious repeated photo reuse." |
| No overlay/watermark on face portraits | `C/page-builder/RULES-LOCKED.md:91-95` | **Add conditional** where portraits exist. |
| Do not depend on AI-generated readable text or official-looking marks | `C/page-builder/RULES-LOCKED.md:465-483` | Present in current image acceptance. **Keep**. |
| No misleading click/download affordance, duplicate side-by-side primary CTA, overlapping header/bottom CTA, external/social/powered-by conversion leaks, or dead privacy/terms links | `C/page-builder/RULES-LOCKED.md:290-306` | **Add simplified**. Keep necessary phone/email and user-requested legal destinations. |
| Exactly one mobile persistent CTA; never sticky header and bottom bar together | `C/page-builder/RULES-LOCKED.md:302-306` | **Add as a collision/attention rule**, not a mandate that every page must be sticky. |
| No native heavy/autoplay video where a click facade is appropriate; play control must not impersonate YouTube unless brand-red | `C/page-builder/RULES-LOCKED.md:19-27` | **Add conditional facade outcome**. Do not copy the orchestrator's contradictory blanket YouTube ban. |

### 4.4 Forms, privacy, accessibility, and interaction

| Claude absolute prohibition or fail condition | Exact location | Lightweight disposition |
|---|---|---|
| Never fake success or redirect when endpoint is missing, stubbed, rejected, or ambiguous | `C/landing-page-html-builder/SKILL.md:468-503,575-647` | Current is stronger. **Keep current receipt/fail-loud behavior**. |
| Never put raw name, email, or phone into `dataLayer` | `C/landing-page-html-builder/SKILL.md:468-473,596-617` | Current is stronger. **Keep**. Reject contradictory Claude tracking samples. |
| Separate thank-you page; no modal-only success state | `C/page-builder/RULES-LOCKED.md:119-129` | **Keep when a form exists**, but do not force a form/thank-you artifact on click-to-call or page-only requests. |
| Phone input must reject invalid patterns, preserve cursor/country code, use numeric keyboard, and avoid sample-digit placeholder | `C/page-builder/RULES-LOCKED.md:129-258` | **Add simplified and region-aware**. Do not port brittle NANP code. |
| Color cannot be the sole indicator | `C/accessibility-fixer/SKILL.md:112-156,216-226` | Present in `N/references/build-contract.md:77-83`. **Keep**. |
| Browser zoom must not be disabled | `C/accessibility-fixer/SKILL.md:335-349` | **Add direct**. |
| Focus must not be fully hidden behind fixed/sticky UI | `C/accessibility-fixer/SKILL.md:391-433` | **Add direct and test**. |
| Forms must not block paste, and multi-step journeys must not ask for the same information again | `C/accessibility-fixer/SKILL.md:440-461`; `C/CHANGELOG.md:187-193` | **Add direct outcome**. Do not copy the stale raw-PII/sessionStorage sample. |
| Interactive targets must meet at least 24 by 24 CSS pixels; 44 by 44 is the preferred touch target | `C/accessibility-fixer/SKILL.md:391-417` | **Add simplified WCAG 2.2 AA baseline**. |
| Focus trap must be measured, not inferred from source | `C/accessibility-fixer/SKILL.md:227-270` | Current measures it. **Keep**. |
| Decorative images must use empty alt | Correct rule at `C/design-system-generator/SKILL.md:394-405` | Current already supports it. **Keep** and reject Claude's contradictory all-nonempty-alt rules. |

### 4.5 QA, performance, process, and deployment prohibitions

| Claude absolute prohibition or fail condition | Exact location | Lightweight disposition |
|---|---|---|
| Never report a visual fix from source alone; never use stale audit input; verify the checker; render after changes; scan case and variants across all surfaces | `C/page-builder/RULES-LOCKED.md:341-368`; `C/docs/RULES-LEARNED.md:45-60` | Current largely has this at `N/references/measured-qa.md:5-28,46-52`. **Keep outcome, simplify reports**. |
| No estimated PageSpeed score; measure real behavior | `C/pagespeed-audit/SKILL.md:28-35` | **Keep "never invent scores"**, but do not require PSI API/live deployment for the default local build. |
| Performance work must not change copy/layout or break tracking; keep originals; remeasure | `C/pagespeed-audit/SKILL.md:28-35,91-209` | **Keep outcome**. Replace exact zero-pixel-diff with deterministic inspected tolerance. |
| Never preload more than the real LCP asset | `C/pagespeed-audit/SKILL.md:144` | **Add direct technical rule**. |
| No placeholders, competing navigation/primary actions, more than two form steps, inline `style` attributes, generic AI fonts, or reused design system | `C/page-builder/SKILL.md:53-74,354-358` | Split: placeholders/competing actions **add**; step limit **do not universalize**; inline styles **style preference only**; generic/reused design **add outcome**. |
| Direct `wrangler pages deploy` is forbidden in Git-connected path | `C/cloudflare-deployer/SKILL.md:4-9,394-408,517` | Claude contradicts itself at `:55-99`. **Do not import any absolute route**. Use the provider's supported, user-authorized path. |
| Never place credentials/API keys in repo, deployed page, arguments, or evidence | Claude deploy/image/performance skills | Current strongly follows this. **Keep**. The default must not ask the novice to provide a private API key. |
| No private GitHub archive omission/phase-push deviation | Claude orchestrator deployment phases | **Do not add**. GitHub is not a page-quality requirement. |
| Numeric quality gates: total at least 80, every category at least 7, copy at least 8, any category 5 or lower auto-fails; expert panel aggregate 99/110 and nobody below 7 | `C/quality-rubric-scorer/SKILL.md:22-43`; `C/expert-panel/SKILL.md:18-24,130-159` | **Do not add as a requirement**. Use concrete binary launch blockers plus documented warnings. |

The archived `C/docs/BUILD-FAILURES-LOG.md:1-8` explicitly says it is not authoritative, and `C/docs/RULES-LEARNED.md:10-17` agrees. It contains stale fixed-section, YouTube, and inline-form advice. It was used here only as incident evidence, never as a rule source.

## 5. Prioritized candidate additions

Priorities are calibrated to the stated product, not to the complexity of either source repository:

- **P0**: prevents false claims, inaccessible or deceptive output, lost leads, or visibly generic/broken delivery.
- **P1**: materially improves persuasion and custom design with low or moderate agent runtime.
- **P2**: useful conditional depth; add only when the page type needs it.
- **P3**: do not add to the lightweight core.

### 5.1 P0 additions

| ID | Exact Claude source | Exact current source/status | Failure prevented | Burden | Lightweight wording to add | Recommendation |
|---|---|---|---|---|---|---|
| P0-1 Output dash rule and executable scan | `C/conversion-copywriter/SKILL.md:597-621`; `C/enforcement/gate_check_lp.py:92,429-440` | **Absent/conflicting**. `N/scripts/copy_parity.py:31` normalizes the marks; shipped strings use them at `N/assets/cloudflare/public/admin/app.js:72,85,91,204,269`, `data-lifecycle.js:21,94`, `date-range.js:25`, `performance-chart.js:22`, and `N/scripts/package_handoff.py:205,209-211` | Violating the intended house style and leaving a strong machine-written visual tell across hidden surfaces | User cognition: none. Runtime: trivial Unicode/entity scan | "Do not use em dashes or en dashes in generated marketing copy, title/meta/social text, alt/ARIA text, JSON-LD, or customer-facing handoff copy. Rewrite or use an ASCII hyphen. Scan the final rendered/source surfaces before delivery." | **Add direct**, scoped to generated customer-facing output. Update templates and tests with the rule. |
| P0-2 Unified truth/proof launch blocker | `C/page-builder/RULES-LOCKED.md:55-83,328-339`; `C/image-generator/SKILL.md:56-75`; `C/conversion-copywriter/SKILL.md:561-580` | **Present but scattered** at `N/SKILL.md:87-94,118-127,131-135`; `N/references/research-and-claims.md:24-54`; `N/references/image-research-and-generation.md:26-38` | Invented reviews, awards, guarantees, statistics, staff, project imagery, before/after proof, or misleading schema | User cognition: low. Runtime: low to moderate verification | "Use only claims, numbers, ratings, awards, guarantees, testimonials, people, locations, and proof imagery supported by user material or a cited authoritative source. Never synthesize proof or generate proof-bearing people/assets. Omit unsupported proof and do not call the page launch-ready while a required fact is pending." | **Add simplified** as one top-level invariant; reuse current ledger and image logic. |
| P0-3 All-surface final scan | `C/page-builder/RULES-LOCKED.md:341-395`; `C/docs/RULES-LEARNED.md:45-60` | **Absent/partial**. `N/scripts/validate_funnel.py:186-193` finds only narrow template tokens; no complete stale-brand/banned-text scan | Competitor names, old client data, placeholders, banned phrases, or stale claims surviving in metadata, alt/ARIA, schema, filenames, and hidden text | User cognition: none. Runtime: low | "Before delivery, scan visible copy and hidden customer-facing surfaces case-insensitively for placeholders, stale brand/contact data, forbidden wording, prohibited third-party names, unsupported numbers, and dead destinations. Re-run after any copy or asset change." | **Add simplified** with one small checker and a manual review note for semantic findings. |
| P0-4 Brand fidelity baseline | `C/page-builder/RULES-LOCKED.md:97-117,272-280`; `C/design-system-generator/SKILL.md:93-105` | **Partial** at `N/SKILL.md:87-90,129-135`; `N/references/research-and-claims.md:56-58` | Generic rebrand, invisible logo, palette drift, supplied assets being replaced, primary brand identity disappearing | User cognition: none unless sources conflict. Runtime: low | "Start from the supplied logo/assets and the client's observed palette and type character. Supplied assets outrank scraped alternatives. Use the correct light/dark logo, verify it against its rendered background, show the primary brand identity meaningfully, and confirm every asset loads." | **Add simplified**. |
| P0-5 Anti-generic design gate | `C/page-builder/SKILL.md:61,70-74`; `C/design-destroyer/references/tells.md:21-128`; `C/design-system-generator/SKILL.md:375-390` | **Absent/partial**. `N/references/reference-fidelity.md:35-47` reviews perceived completeness but supplies few concrete design exclusions | AI-template appearance: violet gradient hero, repeated gray cards, everything centered, identical surfaces, generic icons, empty decorative labels, typography with no brand character | User cognition: none. Runtime: low visual review | "The page must look specific to this business. Avoid default violet/blue-purple hero gradients, repeated gray card grids, emoji/stock icons, initial avatars used as proof, all-centered composition, and three consecutive sections with the same layout unless brand/reference evidence makes the choice intentional. Vary scale, density, media, and composition within one coherent system." | **Add simplified**. |
| P0-6 WCAG 2.2 AA baseline and focused runtime checks | `C/accessibility-fixer/SKILL.md:34-111,227-270,335-461`; `C/CHANGELOG.md:187-193` | **Partial**. Basics at `N/references/build-contract.md:77-83`; current contrast check only estimates H1-H3 on plain backgrounds and warns at `N/scripts/measure_funnel.mjs:109-131,256-258` | Keyboard traps, low contrast, invisible focus, zoom lock, obscured focused controls, inaccessible links, tiny targets, paste blocking, repeated form entry | User cognition: none. Runtime: medium automated plus targeted manual tests | "Use semantic landmarks and headings, a skip link, explicit labels and described errors, meaningful/empty alt as appropriate, persistent visible focus, AA contrast, at least 24x24 targets with 44x44 preferred, zoom enabled, reduced-motion support, descriptive link purpose, paste allowed, and no redundant re-entry. Test keyboard flow, focus visibility, modal containment, zoom, and an automated accessibility scan." | **Add simplified**. Also fix modal containment beyond Tab-cycling; current listener is modal-scoped at `N/assets/multistep-lightbox.js:106-125`. |
| P0-7 Honest primary action, destinations, and persistent chrome | `C/page-builder/RULES-LOCKED.md:290-306`; `C/conversion-copywriter/SKILL.md:70-76,787-802` | **Partial/present** at `N/references/copy-and-structure.md:28-35`; `N/SKILL.md:154-162`; no equally explicit dead-legal/overlapping-sticky rule | Misleading download/booking promise, competing primary actions, dead legal links, covered content, duplicate persistent CTAs | User cognition: low only if action is genuinely unclear. Runtime: low | "Choose one honest primary action and exact label. A download must download and a booking promise must book. Remove competing primary navigation/actions; phone/email may remain secondary. Privacy/terms destinations must resolve. On mobile use at most one persistent CTA and ensure fixed UI never covers focused, legal, or final content." | **Add simplified**. |
| P0-8 Testimonial-person diversity | `C/testimonial-miner/SKILL.md:182-190`; `C/page-builder/RULES-LOCKED.md:65-83` | **Absent**, despite strong provenance at `N/references/research-and-claims.md:39-47` | A manufactured-looking grid created by splitting one person's feedback into multiple independent cards | User cognition: none. Runtime: trivial | "Never present one customer as multiple testimonial cards. If fewer real testimonials exist, use fewer cards or a different verified proof type. Never fabricate filler." | **Add simplified**. Do not require three people. |
| P0-9 No fake production completeness | `C/page-builder/SKILL.md:63,354-358`; `C/landing-page-html-builder/SKILL.md:177-178,647,668-694` | **Partial**. Current blocks workflow markers at `N/SKILL.md:22` and token patterns at `N/scripts/validate_funnel.py:186-193`, but does not semantically catch every stub/sample/dead destination | Shipping sample copy, dead links, stub endpoints, missing required assets, or false "ready" status | User cognition: none. Runtime: low | "Do not call a build complete while placeholder/sample content, dead required links, stub endpoints, missing required assets, or an unverified lead path remains. Label a local static preview honestly when delivery is not configured." | **Add direct**. |
| P0-10 Form containment and per-field errors | `C/accessibility-fixer/SKILL.md:34-111,227-270`; `C/landing-page-html-builder/SKILL.md:421-427,668-694` | **Partial**. Current modal behavior exists at `N/references/build-contract.md:29-57`, but key handling is modal-scoped at `N/assets/multistep-lightbox.js:106-125`; custom validation uses `aria-invalid` without a field-specific described error at `:67-80` | Assistive-technology or programmatic focus escaping the dialog; errors announced without a clear field relationship | User cognition: none. Runtime: low to medium | "Use native dialog/inert behavior or document-level guarded focus containment. Associate custom errors with their fields and test forced focus outside the dialog, not only repeated Tab from inside." | **Add simplified**. |

### 5.2 P1 additions

| ID | Exact Claude source | Exact current source/status | Failure prevented | Burden | Lightweight wording to add | Recommendation |
|---|---|---|---|---|---|---|
| P1-1 One compact internal strategy brief | `C/strategic-brief-builder/SKILL.md:25,335-370` | **Partial/over-artifacted** at `N/SKILL.md:106-117` | Correct facts assembled without a decision about buyer, action, mechanism, objection, proof, intent, or visual tone | User cognition: none in normal cases. Runtime: low | "Before drafting, record one concise internal brief: buyer situation/trigger, desired action, primary offer/result, main friction, real mechanism, strongest trust anchor, primary objection, source/search intent, and fitting visual tone. Infer from evidence; ask only when a consequential decision remains unresolved." | **Add simplified**, while replacing several current artifacts. |
| P1-2 Real mechanism and proof map | `C/offer-research/SKILL.md:85-116,146-157,210-225` | **Partial/present** at `N/references/copy-doctrine.md:39-49`; `N/references/copy-workflow.md:41-61` | Interchangeable promises that never explain why the business can deliver | User cognition: none. Runtime: low | "Identify the real operational reason the offer works. Map each top benefit to the capability or evidence that supports it. If there is no defensible proprietary mechanism, describe the real process plainly; never invent one." | **Add simplified**. |
| P1-3 Bounded competitor-gap scan | `C/competitor-scanner/SKILL.md:23-59,78-86` | **Partial** at `N/references/copy-doctrine.md:39-43`; `N/references/research-and-claims.md:60` | Repeating category cliches and missing an obvious, supportable message gap | User cognition: none. Runtime: low to moderate | "When direct competitors are readily discoverable, inspect two or three of their own pages. Record lead promise, offer, proof, CTA, and repeated category claims; identify one or two gaps the client can credibly occupy. Never use competitor claims as facts about the client." | **Add simplified**, conditional. |
| P1-4 Explicit adaptive job coverage | `C/page-blueprint/SKILL.md:13-47,494-504` | **Present**, but `N/SKILL.md:43` conflicts with `:30`; adaptive behavior is clear at `N/references/copy-and-structure.md:5-24` | Forced template length or slavish reference order | User cognition: none. Runtime: lower than current | "Cover the buyer jobs supported by evidence: relevance, offer, trust/proof, mechanism/fit, objections, process, conversion, and legal close. Merge related jobs, omit unsupported jobs, and add a section only for a real buyer need. Preserve reference logic and richness, not literal section order." | **Add simplified/resolve conflict**. |
| P1-5 First-time-reader and bullet test | `C/conversion-copywriter/SKILL.md:114-131,646-713` | **Partial** at `N/references/copy-and-structure.md:67-69`; `N/references/copy-doctrine.md:73-80` | Vague artifacts, opaque CTA, filler bullets, pronouns without antecedents | User cognition: none. Runtime: low | "Every heading, CTA, and bullet must make sense to a first-time visitor. Specify the service, document, decision, or outcome. Keep a bullet only when it is concrete, beneficial, and belongs in that section." | **Add simplified**. |
| P1-6 Truthful urgency and scarcity | `C/conversion-copywriter/SKILL.md:850-885` | **Partial** at `N/SKILL.md:51`; `N/references/copy-doctrine.md:30,33` | Fake deadlines, capacity, countdowns, and fear-based pressure | User cognition: low only if a real limit needs confirmation. Runtime: trivial | "Use urgency or scarcity only when a real, verifiable deadline, availability, or capacity constraint exists. No countdown, 'limited time,' or 'spots left' claim without evidence." | **Add direct**. |
| P1-7 High-confidence anti-hype vocabulary | `C/conversion-copywriter/SKILL.md:268-298,584-593` | **Absent** | Empty AI copy that could fit any competitor | User cognition: none. Runtime: trivial scan plus editorial judgment | "Replace unsupported superlatives, effortless-income promises, and empty words such as innovative, world-class, seamless, robust, game-changing, or comprehensive with the specific action, mechanism, limit, or proof. Allow a term only when it is necessary and made concrete." | **Add simplified**, not the entire unconditional list. |
| P1-8 Layout robustness | `C/page-builder/RULES-LOCKED.md:308-324,420-463` | **Partial** at `N/references/measured-qa.md:30-40` | Orphan card rows, broken laptop widths, emergency word breaking, fixed-min-width overflow | User cognition: none. Runtime: low because current sweep exists | "Fill grid rows cleanly or use a deliberate featured-card layout. Avoid fixed minimum widths inside grid tracks, `ch` heading widths, and emergency word breaking on short UI text. Always inspect the 1024-1199px band." | **Add simplified**. |
| P1-9 Technical-audience adaptation and arithmetic | `C/page-builder/RULES-LOCKED.md:487-572`; `C/conversion-copywriter/SKILL.md:889-959` | **Partial** at `N/references/copy-doctrine.md:25-35,39-49` | Dumbing down experts, unexplained jargon for consumers, or misleading comparative ratios | User cognition: none. Runtime: low | "Match vocabulary to the buyer. Keep practitioner terms practitioners actually use; simplify syntax rather than deleting evidence. Put conditions beside comparative numbers and recalculate ratios/percentages from underlying values." | **Add simplified**. |
| P1-10 Copy density as an editing signal | `C/conversion-copywriter/SKILL.md:990-1023` | **Partial** at `N/references/copy-doctrine.md:13,73-80` | Bloated repetitive pages that hide proof and action | User cognition: none. Runtime: low | "Keep selling sections skimmable. Prefer short paragraphs, compact evidence blocks, and one distinct job per section. Treat word count as an editing signal, never as permission to delete necessary proof or technical conditions." | **Add simplified**. Do not import contradictory 15-20-word headline limits. |
| P1-11 Generated-image text and disclosure rule | `C/page-builder/RULES-LOCKED.md:465-483`; `C/image-generator/SKILL.md:56-75` | **Present but buried** at `N/references/image-research-and-generation.md:26-38` | Fake documents/awards/logos, malformed text, generated scene mistaken for real customer evidence | User cognition: none. Runtime: low image review | "Generated images are illustrative only. Do not rely on generated readable text, logos, official marks, people-as-testimonials, or documentary proof. Inspect full size and actual crops; disclose an illustration when viewers could mistake it for a real customer, project, or location." | **Add simplified at top level**, reuse current implementation. |

### 5.3 P2 additions

| ID | Exact Claude source | Exact current source/status | Failure prevented | Burden | Lightweight wording to add | Recommendation |
|---|---|---|---|---|---|---|
| P2-1 Buyer stage and decision journey | `C/market-research/SKILL.md:86-135`; `C/offer-research/SKILL.md:246-264` | **Partial** at `N/references/intake-schema.md:42-47`; `N/references/copy-doctrine.md:25-37` | Too much education for ready buyers or too little for problem-aware visitors | Low | "Identify whether likely visitors are problem-aware, comparing providers, or ready to act. Capture the trigger, what they compare, the risk that slows them, and the proof/next step that resolves the decision." | **Add simplified**. |
| P2-2 Third-party name classification | `C/page-builder/RULES-LOCKED.md:370-394`; `C/competitor-scanner/SKILL.md:83-86` | **Absent** | Aggressive named comparison without approval, or accidental removal of legitimate platform/provenance terms | Low, conditional | "Classify a third-party name as comparator, platform/specification, or provenance credential. Publish named comparisons only with substantiation and client approval. Keep factual platform/provenance names unless banned. Apply an actual name ban across visible and hidden surfaces." | **Add simplified**, not Claude's universal comparator-name ban. |
| P2-3 Phone field behavior | `C/page-builder/RULES-LOCKED.md:129-258` | **Partial**; current server validates shape, but the full entry behavior is not governed | Invalid leads, cursor-jumping mask, stripped country code, sample digits mistaken for real format | Medium only when phone exists | "For a phone field, use the numeric mobile keyboard, permit paste/autofill, normalize without cursor jumps, preserve an entered country code, validate the target region, reject obvious fake patterns, and do not use sample digits as the placeholder." | **Add simplified**. |
| P2-4 Video facade | `C/page-builder/RULES-LOCKED.md:19-27`; `C/landing-page-html-builder/SKILL.md:702-704` | **Absent** | Heavy autoplay/native controls, blank poster, misleading play treatment | Medium only when video exists | "If video materially helps, show a meaningful poster with a brand-compatible play control and duration, then load controls/player on click. Respect reduced motion and provide a useful fallback." | **Add simplified**, conditional. |
| P2-5 Origin story only when decision-relevant | `C/offer-research/SKILL.md:73-81` | **Partial** at `N/SKILL.md:87-90`; `N/references/copy-doctrine.md:39-49` | Missing genuine credibility, or forcing founder narrative as filler | Low | "Use a sourced origin story only when it explains relevant expertise, empathy, or the delivery mechanism. Do not force one into every page." | **Add simplified**, optional. |
| P2-6 Press/industry authority only when material | `C/testimonial-miner/SKILL.md:76-99` | Current ledger at `N/references/research-and-claims.md:24-37` covers truth but not decision relevance | Decorative authority bars and irrelevant statistics | Moderate, optional | "Use press or industry statistics only when they materially help the decision and have an authoritative citable source. Otherwise omit the block." | **Add simplified** only if authority content is present. |
| P2-7 Genuine gated-content semantics | `C/conversion-copywriter/SKILL.md:787-847`; `C/page-builder/RULES-LOCKED.md:290-300`; `C/thankyou-page-builder/SKILL.md:18-45` | Current records `brochure_gated` at `N/references/intake-schema.md:16-24,28-49`, but static brochure/thank-you assets are not access-controlled | Calling an unlinked public file "gated" or implying email delivery that does not exist | Low to medium | "If content is described as gated, either enforce access after a confirmed submission or say clearly that it is simply delivered from the thank-you page. Never imply email delivery or access control that is not implemented." | **Add simplified**. |

### 5.4 P3: do not add to the lightweight core

| ID | Candidate | Exact Claude source | Exact current comparison | Why it is inappropriate here | Recommendation |
|---|---|---|---|---|---|
| P3-1 | Google Ads MCP, pasted keyword list, Quality Score workflow, or ad-data hard stop | `C/strategic-brief-builder/SKILL.md:88-138`; `C/page-builder/RULES-LOCKED.md:396-418` | Current lightweight intent rule at `N/SKILL.md:10,51`; `N/references/copy-and-structure.md:69` | Requires private integration/operator coordination and blocks a novice with only a website | **Do not add**. Use supplied phrase or labeled inferred intent. |
| P3-2 | Firecrawl-only research | `C/competitor-scanner/SKILL.md:23-31,78-82`; `C/site-scraper-brand-extractor/SKILL.md:23-121` | Current transport-neutral reference handling at `N/references/project-reference.md:11-15` | Paid/private transport is not a research outcome | **Do not add**. Use any authorized browser/web method. |
| P3-3 | Apps Script/Google Sheets as the only backend | `C/page-builder/SKILL.md:44-51`; `C/form-backend-setup/SKILL.md:186-193,222-227,447-483` | Safer current receipt contract at `N/SKILL.md:171-173`; `N/references/lead-and-tracking-contract.md:21-31` | Wrong architecture, silent-success defects, formula/HTML injection gaps, setup burden | **Do not add**. Keep current receipt outcome; make backend optional. |
| P3-4 | Raw PII in `dataLayer` or thank-you/sessionStorage personalization | `C/tracking-setup/SKILL.md:164-200,235-269`; `C/thankyou-page-builder/SKILL.md:55-87`; `C/page-builder/SESSIONSTORAGE-CONTRACT.md:140-144` | Current excludes raw PII at `N/references/build-contract.md:59-65`; `N/references/lead-and-tracking-contract.md:27` | Privacy regression against current design | **Do not add**. Keep opaque receipt state only. |
| P3-5 | Exact GPT image model, bundled CLI, API-key route, or 3x3 grid | `C/image-generator/SKILL.md:23-34,77-113` | Current already duplicates the burden at `N/SKILL.md:133`; `N/references/image-workflow.md:85-138` | Explicitly excluded API-key burden; model availability drifts; proof is image fitness, not provider ceremony | **Do not add** and remove from current default. |
| P3-6 | PSI API-key/live-URL-only performance pass | `C/pagespeed-audit/SKILL.md:28-59` | Current local Lighthouse at `N/references/performance-and-browser-qa.md:64-81` | Deadlocks predeploy QA and asks for API access | **Do not add**. Retain local Lighthouse and optional post-publish measurement. |
| P3-7 | Exact zero-pixel diff after performance changes | `C/pagespeed-audit/SKILL.md:31-34,192-209` | Current uses actual review at `N/references/measured-qa.md:46-52` | Web fonts, animation, and rendering timing make exact equality brittle | **Do not add**. Use deterministic thresholded/inspected visual regression. |
| P3-8 | Fixed 13+2 or 15-section page | `C/page-builder/SKILL.md:55-59`; conflicting `C/page-blueprint/SKILL.md:13-26,494-504` | Current adaptive sequence at `N/references/copy-and-structure.md:5-24` | Bloats simple offers and pressures unsupported filler | **Do not add**. Use buyer jobs. |
| P3-9 | Mandatory headline variants and mobile phone-frame page | `C/headline-variant-builder/SKILL.md:23-37`; `C/mobile-preview-builder/SKILL.md:20-123` | No equivalent current default, appropriately | Extra artifacts do not improve a one-off default; iframe is not a real device test | **Do not add**. Create variants only when an experiment is requested; test a real viewport. |
| P3-10 | 11-person expert panel, 99/110 threshold, no score below 7 | `C/expert-panel/SKILL.md:18-24,130-176` | Current evidence-based review at `N/references/feedback-and-review.md:15-27` | False precision and agent ceremony | **Do not add**. Use evidence-based pass/fail blockers. |
| P3-11 | Private GitHub archive, phase pushes, stop hooks, Codex review-loop dependency | `C/page-builder/SKILL.md:411-463,498-511`; `C/review-loop/SKILL.md:73-78`; Cloudflare deployer | Current makes GitHub optional at `N/SKILL.md:41,47` | External writes, accounts, and developer workflow outside user intent | **Do not add**. |
| P3-12 | Exact US/NANP phone mask and third-party geolocation library | `C/page-builder/RULES-LOCKED.md:129-258`; `C/landing-page-html-builder/SKILL.md:281-310,373-419` | Current validates selected schema at `N/references/lead-and-tracking-contract.md:21-25` but has no exact mask | Region-specific, brittle, and too long for the core | **Do not add**. Use P2-3's compact region-aware outcome. |
| P3-13 | Mandatory image counts, one-file-one-use, and generated compositing pipeline | `C/image-sourcer/SKILL.md:28-80`; `C/page-builder/RULES-LOCKED.md:465-483` | Current purpose-led storyboard at `N/SKILL.md:131-135`, though still heavy | Encourages filler and conflicts with legitimate logo reuse | **Do not add**. Use placement-purpose and proof integrity. |
| P3-14 | 50+ VOC, 5-10 competitors, awareness percentages, demographic archetypes, and wound/shame/fear framework | `C/offer-research/SKILL.md:120-206,246-264`; `C/market-research/SKILL.md:54-61,86-190,244-291`; `C/strategic-brief-builder/SKILL.md:256-260,308-312` | Current rejects arbitrary quotas at `N/references/research-and-claims.md:60`; `N/references/copy-doctrine.md:41-43` | Runtime-heavy, pseudo-precise, stereotyping, and potentially manipulative | **Do not add**. Use bounded evidence and practical/emotional stakes without invented shame or fear. |
| P3-15 | Mandatory brochure, CRM, reporting, backup/recovery, and publishing for every page | Claude full-funnel phases reinforce it, but this is mainly current scope | Current default at `N/SKILL.md:32-41,175-177,228-239` | Converts a page request into an infrastructure project | **Do not keep as core**. Move to optional modules. |

## 6. Current instructions to remove, demote, or repair

This is deliberately separate from the Claude candidate list. These are instructions already present in the current skill that conflict with the stated lightweight, one-prompt, six-monthly use case.

### 6.1 Remove from the default path

| Current instruction | Exact current location | Why remove from default | What remains |
|---|---|---|---|
| A "complete funnel" always includes multi-step lightbox, brochure PDF, thank-you page, authenticated CRM, reporting, Cloudflare, and D1 | `N/SKILL.md:32-41` | Turns a landing-page request into a web-app/infrastructure project | Default to page plus honest conversion path. Add brochure, CRM, reporting, or deployment only when requested or required by the offer. |
| Cloudflare is the only required hosting platform and one D1 database is required per site | `N/SKILL.md:41,47,81` | Hosting and database architecture should not define a lightweight page-builder core | Keep the existing Cloudflare module as an optional, supported publishing adapter. |
| Non-skippable phase protocol and fixed completion labels | `N/SKILL.md:12-24` | Makes internal bookkeeping the product and blocks useful page output on evidence administration | Keep truthful status and no-fake-completion principles; replace with a short internal progress loop. |
| Seven Markdown and two JSON artifacts before HTML | `N/SKILL.md:106-117` | High authoring/runtime burden with duplicated information | Consolidate into: one strategy brief, one claim ledger, one copy master, and an image plan only when needed. |
| Mandatory curated-library helper, contexts, hashes, rendered master, anchored review, and freshness administration | `N/SKILL.md:102-104`; `N/references/copy-workflow.md:11-39,47-76`; `N/scripts/copy_library.py:219-329` | Developer-grade retrieval/evidence workflow for a task the model can complete directly from current research | Keep the 8 review outcomes at `N/references/copy-workflow.md:51-61`; make library retrieval optional support. |
| Exact GPT Image 2.5 identity and optional API-key CLI route | `N/SKILL.md:133`; `N/references/image-workflow.md:85-138`; scaffold default at `N/scripts/scaffold_project.py:67-70` | Directly conflicts with the exclusion on user-supplied/shared API keys and will drift with model availability | Use available native generation without model ceremony, or use authorized assets/redesign. Never make an API key a completion dependency. |
| Complete funnels are image-enabled and require plan, registered attempts, optimization hashes, exact desktop/mobile review evidence | `N/SKILL.md:135`; `N/references/image-research-and-generation.md:5-15,26-34`; `N/references/image-workflow.md:5-29,150-197` | Rights/truth/crop matter; the manifest ceremony should not be mandatory for a simple page | Keep purpose, rights, truth, alt, crop, and performance checks. Use a manifest only for multiple/proof-bearing/generated assets. |
| Catalogue workflow is a default funnel phase and gate | `N/SKILL.md:36-37,137-146,230-234`; `N/references/catalogue-workflow.md:1-75` | Many pages have no real brochure offer; forcing one creates filler and PDF-tool burden | Enable only when the offer genuinely includes a guide/catalogue or the user asks for one. |
| Admin/CRM/data-retention/recovery operations are default | `N/SKILL.md:175-177,212,216,235`; `N/references/cloudflare-crm.md:5-57`; `N/references/admin-access-and-recovery.md:1-75`; `N/references/data-lifecycle.md:1-55` | This is maintained-product/SaaS operations, not page construction | Keep as an opt-in lead-management module with its existing security tests. |
| Full Worker/D1/CRM/reporting journey is required for launch setup | `N/SKILL.md:193,212,216`; `N/references/performance-and-browser-qa.md:97-125` | Can block a high-quality static/contact page because an unrelated app stack is absent | Require an actual conversion journey only for the chosen destination: form receipt, booking, call link, or other real action. |
| Rendered-copy capture/parity over page, every form step, thank-you, and PDF is mandatory | `N/SKILL.md:214`; `N/references/rendered-copy.md:1-38` | Valuable for regulated/high-risk projects, excessive as a default every six months | Keep one final all-surface copy scan and targeted parity for high-risk, approved, or multi-artifact copy. |
| Portable release, resumption, archive integrity, recovery state, and START-HERE package are default handoff concerns | `N/SKILL.md:224-226,238`; `N/references/qa-and-handoff.md:55-97`; `N/references/resuming-work.md:1-50`; `N/references/guided-publishing.md:56-78` | Solves long-lived team delivery and disaster recovery, not a normal one-prompt build | Run only when a handoff archive, migration, or maintained live service is requested. |
| Brochure, Worker API, migrations, CRM, reporting, scripts, research artifacts, and many screenshots are standard completion deliverables | `N/SKILL.md:228-239` | Completion contract is wider than the user's page goal | Deliver the selected page, assets, optional conversion destination, and concise QA summary. Additional modules deliver their own artifacts only when active. |

### 6.2 Simplify rather than remove

| Current instruction | Exact current location | Simplification |
|---|---|---|
| Seven widths, two short heights, Chromium and WebKit, full modal/thank-you capture | `N/SKILL.md:183,193`; `N/references/measured-qa.md:30-44`; `N/references/performance-and-browser-qa.md:83-95` | Default to representative mobile, tablet/laptop, desktop, and one short-height form check, plus an intermediate-width sweep when headings/grids are fragile. Add a second engine when interaction or target audience makes it material. |
| Three-run Lighthouse median and raw-report evidence | `N/references/performance-and-browser-qa.md:64-81` | Keep the 90/LCP 2.5s/CLS 0.1/TBT 200ms targets. Run one real pass initially; repeat marginal or failing measurements and before publishing. |
| Exhaustive reference disposition for every source block and richest-journey rule | `N/SKILL.md:30`; `N/references/reference-fidelity.md:7-27`; `N/scripts/process_contract.py:91-124` | Preserve every relevant buyer question, proof role, media beat, and CTA job. Document only material omissions/replacements. Do not map irrelevant or duplicated source blocks. |
| Modal-only multi-step form is the default and validator expects exactly one modal form | `N/SKILL.md:35,154-161`; `N/scripts/validate_funnel.py:146-150` | Keep one accessible form and no hidden duplicate. Choose modal, inline, booking, or call flow according to user goal; do not force multiple steps. |
| Default form example contains three steps and six customer fields | `N/assets/multistep-lightbox.example.html:18-47` | Start with the minimum fields necessary for response. Add fit/scope fields only when they materially change routing or service delivery. |
| All enabled image placements must satisfy detailed exact-model, hash, byte, and screenshot evidence | `N/scripts/image_workflow.py:238-279,307-327,393-525` | Preserve hard truth/rights checks for proof and generated imagery; use normal responsive-image QA for ordinary decorative assets. |
| Copy approval/evidence and publish authorization share extensive revision state | `N/SKILL.md:57`; `N/references/approval-workflow.md:1-47` | Keep real external-action authorization and optional user-requested copy approval. Internal approval hashes should not be routine deliverables. |

### 6.3 Repair direct current conflicts and weak gates

1. **Reference order conflict:** `N/SKILL.md:30` says the final may reorganize or improve the reference; `N/SKILL.md:43` says replicate its section order. Keep persuasive jobs, proof/media rhythm, pacing, and CTA logic, not literal order.

2. **Design system in name only:** `N/SKILL.md:111,131` requires a design system, while `N/scripts/scaffold_project.py:21` creates only five headings and `N/scripts/process_contract.py:26-36,63-83` can pass it with 120 meaningful characters. Replace length-as-quality with required decisions: type hierarchy, color roles/contrast, spacing rhythm, shapes/surfaces, composition pattern, motion/reduced motion, and anti-template checks.

3. **Generic starter contradicts bespoke intent:** the current starter at `N/assets/cloudflare/public/styles.css:1` and `N/assets/cloudflare/public/index.html:4-5` uses a system stack, all-centered hero, tracked uppercase kicker, and equal-column cards. It is a useful test fixture, not a design default. Label it as such and prevent direct reuse as a client design.

4. **Dash parity masks the requested style rule:** `N/scripts/copy_parity.py:31-35` translates em/en dashes to ASCII hyphens before comparison. If the P0 dash rule is adopted, parity must preserve and flag those code points rather than normalize them away.

5. **Shipped output conflicts with the dash rule:** replace customer-facing marks at `N/assets/cloudflare/public/admin/app.js:72,85,91,204,269`, `data-lifecycle.js:21,94`, `date-range.js:25`, `performance-chart.js:22`, `N/scripts/package_handoff.py:205,209-211`, `N/scripts/portable_handoff.py:512`, and other generated/client strings. Internal/raw research data need not be rewritten.

6. **CTA fold, contrast, wrap, and crop problems are warnings only:** `N/scripts/measure_funnel.mjs:255-260`. Keep judgment where context matters, but require a reviewer to resolve or explicitly accept each warning before "final."

7. **Alt checking is incomplete:** the image plan validates informative alt at `N/scripts/image_workflow.py:262-263`, while the static validator parses images but checks only dimensions at `N/scripts/validate_funnel.py:42-43,213-221`. Add static checks for missing alt and manual classification of decorative versus meaningful images.

8. **Modal containment does not test forced focus escape:** `N/assets/multistep-lightbox.js:106-125` listens on the modal, and `N/assets/cloudflare/scripts/browser-compat.mjs:179-188` cycles Tab only from inside. Use native `<dialog>`/`inert` or a document-level guard and test programmatic focus outside.

9. **"Brochure gated" may only mean unlinked:** the decision is recorded at `N/references/intake-schema.md:16-24,28-49`, while brochure and thank-you files remain public static assets. Enforce actual post-submit access if gating is promised, or rename it as thank-you delivery.

10. **Manual semantics remain essential:** current code can enforce only claims carrying IDs at `N/scripts/copy_library.py:247-265`. It cannot prove every rendered sentence is entailed by evidence. Retain a human/agent semantic claim review instead of claiming full automation.

### 6.4 Current strengths that must not be lost while simplifying

- one-prompt autonomy and consequential questions only: `N/SKILL.md:10,16,24,51,71`;
- exact source hierarchy, claim ledger, qualifiers, and freshness: `N/references/research-and-claims.md:5-37`;
- review identity/provenance and no combined or intensified testimonials: `N/references/research-and-claims.md:39-47`;
- adaptive buyer journey and exact CTA/follow-up: `N/references/copy-and-structure.md:20-35`;
- image rights and no generated proof: `N/references/image-research-and-generation.md:17-38`;
- committed receipt, idempotency, visible failure, and no fake success: `N/SKILL.md:171-173`; `N/references/lead-and-tracking-contract.md:21-31`;
- no raw PII in analytics and consent-aware optional tracking: `N/references/build-contract.md:59-65`; `N/references/advertising-tracking.md:1-32`;
- actual pixel review and honest evidence limitations: `N/references/measured-qa.md:3,40,46-52`;
- real local Lighthouse measurements and accurate lab/field distinction: `N/references/performance-and-browser-qa.md:64-81`;
- real publication authorization and accurate local/live status: `N/SKILL.md:19-24,55-57,218-226`.

## 7. Claude contradictions, stale rules, and broken gates not to import

The Claude tree is valuable as incident history and a source of guardrails, but it is not internally coherent enough to port wholesale. These contradictions materially affect output or completion.

| # | Conflict | Exact evidence | Resolution for lightweight skill |
|---:|---|---|---|
| 1 | Fixed 13 sections plus 2 bars versus adaptive jobs | `C/page-builder/SKILL.md:55-59` versus `:309-313`; `C/page-blueprint/SKILL.md:13-26,494-504` | Use adaptive buyer jobs. Never force section count. |
| 2 | Section 5 is mandatory trust section versus video is Section 5 and absent video skips it | `C/page-builder/SKILL.md:59`; `C/image-sourcer/SKILL.md:156-159`; `C/page-blueprint/SKILL.md:471-474` | Trust job may be mandatory when relevant; video is conditional media, not a numbered section contract. |
| 3 | Synthesized testimonial fallback versus absolute ban | `C/page-builder/SKILL.md:362-365` versus `C/page-builder/RULES-LOCKED.md:75-83` | Never synthesize. Use fewer testimonials or other verified proof. |
| 4 | Generic industry badge fallback versus verified-only badges | `C/page-builder/SKILL.md:370` versus `C/page-builder/RULES-LOCKED.md:55-63` | Verified-only wins. |
| 5 | Exact keyword anywhere in hero fold versus literal keyword in H1 | `C/page-builder/RULES-LOCKED.md:402-405`; `C/strategic-brief-builder/SKILL.md:90-91,133-148,318-322`; `C/conversion-copywriter/SKILL.md:133-137,718-724,1194-1199` | If a real phrase is supplied, use it in title and naturally above the fold; keep H1 outcome-led. |
| 6 | Quantified proof in fold without displacing outcome versus proof number in headline | `C/page-builder/RULES-LOCKED.md:29-36`; `C/conversion-copywriter/SKILL.md:85-89` versus `C/landing-page-html-builder/SKILL.md:702-705` | Strong verified proof near hero; no headline-number quota. |
| 7 | 15-20 headline words are guidance versus more than 20 is a hard block | `C/conversion-copywriter/SKILL.md:379,1010,1039`; `C/page-builder/SKILL.md:347` | Judge rendered clarity and meaning, not a contradictory count. |
| 8 | Question exceptions versus templates using banned questions and phrases | `C/conversion-copywriter/SKILL.md:53-68,494-500`; `C/page-blueprint/SKILL.md:335-341,381-384` | Ban only generic selling questions; allow FAQ/genuine objections/brand-appropriate meaningful questions. |
| 9 | Hero must be centered versus canonical desktop left/two-column layout | `C/conversion-copywriter/SKILL.md:374-385`; `C/landing-page-html-builder/references/css-implementation-patterns.md:403-418`; `C/page-builder/SKILL.md:317-318` | Layout follows content, imagery, brand, and reference. No universal alignment. |
| 10 | Sticky header/trust bar is default versus per-build and one mobile persistent CTA | `C/page-blueprint/SKILL.md:110`; CSS reference `:470-594`; `C/page-builder/RULES-LOCKED.md:302-306` | Sticky UI is optional; at most one mobile persistent primary CTA and no covered content. |
| 11 | 375px test width versus 390x844 canonical and 375 retired | `C/page-blueprint/SKILL.md:141`; CSS reference `:201-207`; `C/page-builder/RULES-LOCKED.md:450-463` | Use actual current representative viewports and a responsive sweep; do not treat a phone-frame iframe as a device test. |
| 12 | Production images must be local versus reference skeleton uses remote CDN/preconnect | `C/page-builder/RULES-LOCKED.md:262-270`; CSS reference `:49-53,251-254,421-440` | Production assets local/authorized; remote references may be research only. |
| 13 | No external dependencies beyond fonts/analytics versus intl-tel-input and geolocation dependency | `C/page-builder/SKILL.md:55-57`; `C/landing-page-html-builder/SKILL.md:281-310` | Prefer native input and server validation; add a library only when actual locale requirements justify it. |
| 14 | No inline `style` versus source templates contain inline styles | `C/page-builder/SKILL.md:354-358`; `C/landing-page-html-builder/SKILL.md:252-253`; CSS reference `:812,827,844,863-864` | Treat separation as maintainability guidance, not an unverified absolute. |
| 15 | One modal form only versus inline final form required | `C/landing-page-html-builder/SKILL.md:22-25`; `C/page-blueprint/SKILL.md:394-408`; `C/conversion-copywriter/SKILL.md:515-524` | One honest conversion path by default; modal or inline based on journey, never hidden duplicates. |
| 16 | Legal links must be local versus real brand-policy URL is allowed | `C/landing-page-html-builder/SKILL.md:22`; `C/page-builder/RULES-LOCKED.md:300` | Destination must be real, relevant, stable, and verified; local is not inherently better. |
| 17 | Every image requires nonempty alt versus decorative images use empty alt | `C/landing-page-html-builder/SKILL.md:688`; `C/image-sourcer/SKILL.md:172-178`; `C/design-system-generator/SKILL.md:394-405` | Meaningful alt for meaningful images; `alt=""` for decorative images. |
| 18 | Locked cursor/country-code phone behavior versus crude sample mask | `C/page-builder/RULES-LOCKED.md:149-235`; `C/landing-page-html-builder/SKILL.md:373-419` | State outcome and test it; do not copy sample mask. |
| 19 | Five items may be 3+2 versus 3+2 is forbidden | `C/design-system-generator/SKILL.md:384-390`; `C/page-builder/RULES-LOCKED.md:308-312` | Choose a deliberate composition that does not look accidentally orphaned. |
| 20 | Every visible image path exactly once versus logo required in header and footer | `C/image-sourcer/SKILL.md:28-47`; `C/page-blueprint/SKILL.md:98-102,426-430` | Avoid obvious photo reuse; permit semantic brand/logo reuse. |
| 21 | YouTube categorically banned versus source/discovery rules allow it | `C/page-builder/SKILL.md:354-358`; `C/image-sourcer/SKILL.md:141-159`; `C/page-builder/RULES-LOCKED.md:268` | Choose an accessible, performant provider/facade. No universal provider ban. |
| 22 | Production skeleton contains noindex versus deployed root must index | CSS reference `:33-40`; orchestrator SEO/deploy phase `C/page-builder/SKILL.md:239-257` | Noindex preview/staging and thank-you; index public landing root when intended. |
| 23 | Conversion leaks/navigation banned versus default hamburger/nav/smooth anchors | `C/page-builder/RULES-LOCKED.md:298`; CSS reference `:533-556,1126-1160` | Use navigation only when it helps this landing-page decision; remove unrelated exits for paid traffic. |
| 24 | Motion hides content before JS without no-JS fallback | `C/design-system-generator/SKILL.md:323-352`; CSS reference `:1069-1083` | Progressive enhancement: content is visible by default; motion augments it. |
| 25 | Tech gradient taxonomy promotes blue-purple while hero rule bans it | `C/design-system-generator/SKILL.md:62,145`; `C/page-builder/SKILL.md:70-74` | Avoid trope by default; brand evidence can justify a controlled non-generic use. |
| 26 | "Power words" include guaranteed, exclusive, limited, certified, risk-free versus proof/scarcity restrictions | `C/conversion-copywriter/SKILL.md:640-643`; locked truth rules; copywriter `:850-885` | Do not import power-word list. Every such term needs factual support. |
| 27 | Technical density and unglossed-term quotas versus locked rules explicitly withdraw them | `C/conversion-copywriter/SKILL.md:891-900,967-972`; `C/page-builder/RULES-LOCKED.md:503-511,549-555` | Match practitioner register and simplify syntax; no density/fragment quota. |
| 28 | One action/label absolutism versus necessary Phone, Back, Continue, and Download roles | Claude copy CTA rules | Keep one primary conversion action, but label controls truthfully by role. Current `N/references/copy-doctrine.md:63-65` resolves this correctly. |
| 29 | Apps Script errors and silent rejects return HTTP 200 shapes the HTML client accepts as conversion | `C/form-backend-setup/SKILL.md:186-193,222-227`; `C/landing-page-html-builder/SKILL.md:590-595` | Do not port code. Current committed-receipt contract wins. |
| 30 | Stale standalone form handler pushes raw PII before fetch and redirects after failure | `C/form-backend-setup/SKILL.md:447-483` | Do not port. Current no-PII and confirmed-success behavior wins. |
| 31 | Tracking and thank-you skills push raw PII despite builder's absolute no-PII rule | `C/tracking-setup/SKILL.md:164-200,235-269`; `C/thankyou-page-builder/SKILL.md:55-87`; `C/landing-page-html-builder/SKILL.md:676-677` | No raw PII in analytics. Current receipt-only model wins. |
| 32 | Hidden anti-spam field names and timing claims disagree across client/server | `C/form-backend-setup/SKILL.md:62-75`; `C/landing-page-html-builder/SKILL.md:238-253,478-498,559-568` | Define one schema from the selected backend and test it end to end. |
| 33 | Accessibility claims WCAG 2.1+2.2 but promised output says only WCAG 2.1 A | `C/accessibility-fixer/SKILL.md:3-18` | Use a clear WCAG 2.2 AA target where applicable. |
| 34 | Focus-recovery sample listens on panel and cannot recover once focus is outside | `C/accessibility-fixer/SKILL.md:248-265` | Use native dialog/inert or document-level guard; test forced escape. |
| 35 | Error sample uses emoji despite no-emoji rule; hover-only link underline remains color-only before hover | `C/accessibility-fixer/SKILL.md:71-98`; orchestrator no-emoji rule | Use persistent non-color link cue and accessible text/icon, no decorative emoji dependency. |
| 36 | Visual QA writes `{ok,checks}` while gate expects `pass`/viewport structure | `C/visual-qa/SKILL.md:78-99`; `C/enforcement/gate_check_lp.py:661-681`; `C/enforcement/lp_run.py:42-45` | Do not port schema bureaucracy. Use one coherent report or direct command result. |
| 37 | Phase 6 expert review requires mobile/performance files created in later phases | `C/expert-review/SKILL.md:81-104`; `C/page-builder/SKILL.md:202-305` | Order checks after artifacts exist or remove phase coupling. |
| 38 | PageSpeed requires live public URL before deployment and another report schema | `C/pagespeed-audit/SKILL.md:28-35,212-235`; `C/page-builder/SKILL.md:262-305`; `C/enforcement/gate_check_lp.py:684-694`; `C/enforcement/lp_run.py:26` | Use local Lighthouse before publish, optional live measurement after publish, one coherent schema. |
| 39 | Cloudflare deployer alternates between Git-first, direct upload, and "never wrangler" | `C/cloudflare-deployer/SKILL.md:4-9,55-99,226-289,394-408,517`; helper `scripts/push-to-cloudflare.sh:131-160` | Do not import. Keep current optional coherent publisher. |
| 40 | Deployment is both early and "LAST" | `C/cloudflare-deployer/SKILL.md:55-65` | Build/test first; deploy only when authorized; verify destination afterward. |
| 41 | Deployer permits tracking placeholders while global gates prohibit placeholders | `C/cloudflare-deployer/SKILL.md:325,462-502`; Claude global placeholder rules | Placeholders are preview-only. Production requires real values or explicit tracking omission. |
| 42 | Deployer removes noindex from every page while thank-you requires noindex/nofollow | `C/cloudflare-deployer/SKILL.md:410-417`; `C/thankyou-page-builder/SKILL.md:140-150` | Preserve noindex on thank-you, private, and preview pages. |
| 43 | One-year immutable cache for stable, unhashed asset names | `C/cloudflare-deployer/SKILL.md:26-50,357-392` | Use immutable only for content-hashed assets. |
| 44 | Independent audit submits a live form without explicit test labeling/permission/cleanup | `C/independent-audit/SKILL.md:95-104` | Never port. Use synthetic identity, explicit scope, and cleanup. |
| 45 | Review loop defaults to dangerous approval/sandbox bypass | `C/review-loop/SKILL.md:73-78` | Never port. |
| 46 | Quick-editor can label a testimonial "Verified Google Review" without fresh provenance | `C/quick-editor/SKILL.md:62-92` | Current claim/review provenance wins. |
| 47 | Global dash ban exists, but detector examples are corrupted and current tree fails with 55 violations | `C/conversion-copywriter/SKILL.md:597-621`; `C/enforcement/check_consistency.py:84-91`; design-destroyer examples such as `C/design-destroyer/SKILL.md:26,36,48,55,75,93` | If adopted, implement a new scoped scanner and first clean generated templates. Do not copy broken commands or claim Claude currently passes. |

Two general lessons follow:

1. Use Claude's locked rules as leads to verify, not as mutually consistent law.
2. Port outcomes and failure prevention. Avoid file counts, phase numbers, provider-specific code, scoring arithmetic, and source-era implementation details unless they are independently necessary for the selected build.

## 8. Enforcement reality in the current skill

The current skill often has excellent prose, but only some of it is a real failure condition. This distinction matters when deciding whether a capability is present.

| Current enforcement layer | What it actually blocks | What it does not establish |
|---|---|---|
| Process/document gate | Missing/template-level phase documents and shallow design files: `N/scripts/process_contract.py:13-37,63-134` | Design quality. A 120-character design-system file can pass. |
| Copy audit | Stale evidence, missing required components, unapproved claim IDs, CTA/follow-up mismatch, placeholders, reference-brand leakage, project-specific forbidden claims, and missing review rows: `N/scripts/copy_library.py:219-329` | Universal cliches, dash style, urgency/scarcity, proof adjacency, or semantic entailment of every sentence. |
| Static funnel validator | Required files, one modal form, browser/server field parity, optional exact CTA, supplied brochure path, narrow template tokens, missing assets, raw-PII-shaped analytics, and modal hooks: `N/scripts/validate_funnel.py:114-271` | Broad accessibility, visual quality, brand fidelity, generic design, alt correctness, or hidden-surface stale-brand content. |
| Browser/layout harness | Overflow, image/font errors, modal activation, focus cycling, Escape/return, required-field progression, thank-you assets, and console/network errors: `N/scripts/measure_funnel.mjs:85-99,161-292` | Full WCAG, assistive-technology behavior, semantic proof adjacency, or design taste. CTA fold, short final heading line, low estimated heading contrast, and aggressive crop are warnings only at `:255-260`. |
| Image gate | Rights/proof evidence, no generated proof, model bookkeeping, responsive variants, byte limits, desktop/mobile review, and fresh hashes: `N/scripts/image_workflow.py:238-279,307-327,393-525` | Whether the page needed that many images or whether exact-model bureaucracy improves the design. |
| Evidence/readiness gate | Required gate set, current source fingerprint, report shape, artifact hashes, and viewport evidence: `N/scripts/check_gates.py:166-359` | The truth of a human-written observation or the persuasiveness of a green build. |
| Performance gate | Median performance at least 90, LCP at most 2500ms, CLS at most 0.1, TBT at most 200ms: `N/assets/cloudflare/scripts/performance-audit.mjs:7-25,42-82` | Field Core Web Vitals or real-user speed. The current docs correctly state this at `N/references/performance-and-browser-qa.md:68-79`. |
| Publication gate | Current copy/evidence, real user authorization, source fingerprint, and live release identity: `N/scripts/workflow.py:95-139`; `N/scripts/check_gates.py:137-164,266-303` | That Cloudflare/D1/CRM was necessary for the user's page request. |

The highest-value additions are therefore not more reports. They are small rules and checks in places the current enforcement stack does not reach: final text/surface lint, design-system substance, anti-template visual review, full accessibility coverage, and semantic truth review.

## 9. Recommended lightweight product shape

### 9.1 Default workflow

1. **Research autonomously.** Start from the client URL and supplied material. Inspect relevant first-party pages, public business evidence, and a supplied reference. Ask only when a missing fact changes the offer, legal claim, destination, or required field.
2. **Make one internal brief.** Record audience situation, action, offer/result, mechanism, objection, strongest proof, intent, and visual direction. Maintain a claim ledger for facts that will appear.
3. **Write one copy master.** Use adaptive buyer jobs, one honest primary action, early/adjacent proof, exact follow-up behavior, and the new clarity/urgency/punctuation rules.
4. **Design for this brand.** Decide typography character, color roles and contrast, spacing rhythm, shapes/surfaces, composition, image roles, and motion/reduced motion. Run the anti-generic check before implementation.
5. **Build the smallest honest conversion path.** This may be a form, booking link, call, email, download, or another real action. Use a thank-you page only when the journey requires one. A brochure and CRM are not assumed.
6. **Verify the real output.** Run static checks, the all-surface copy scan, accessibility checks, representative responsive screenshots, actual visual review, interaction success/failure, console/overflow, and one real Lighthouse pass. Repeat failed or marginal tests after fixes.
7. **Stop at a complete local result unless publishing was requested.** If publishing is requested, use the selected provider module, obtain only the access the external action actually needs, deploy, and verify the destination. Never ask the user to paste or share an API key into chat.

### 9.2 Default deliverables

- responsive landing page and local assets;
- selected conversion behavior and thank-you behavior when applicable;
- concise source/claim note and one internal strategy/copy master;
- representative mobile/tablet-or-laptop/desktop screenshots;
- concise QA summary with failures fixed and remaining external limits named.

### 9.3 Optional modules

- brochure/catalogue PDF;
- generated image workflow with a manifest for complex or proof-sensitive sets;
- CRM, attribution, advertising adapters, reporting, retention, backup, and recovery;
- A/B headline variants;
- deployment and custom-domain setup;
- portable handoff archive and long-lived resumption state;
- second-engine, full seven-width, three-run Lighthouse, or formal parity evidence for higher-risk work.

### 9.4 Only these conditions should block a normal local final

- a material claim or proof element is unsupported or misleading;
- the primary action is fake, dead, ambiguous, or reports success without confirmed completion;
- required client assets/destinations are missing and cannot be honestly omitted;
- the page has a serious accessibility, responsive, console, asset, or interaction failure;
- the final has unresolved sample/placeholder/stale-brand content;
- the actual page was not rendered and visually inspected;
- a selected optional module is presented as complete when its own critical path was not tested.

Missing Cloudflare, D1, GitHub, GTM, a private ad account, an MCP server, an image API key, a CRM, or a brochure must not block a high-quality local page when that capability was not selected.

## 10. Concise confirmation checklist

- [x] Claude orchestrator and `RULES-LOCKED.md` audited.
- [x] Output-affecting research, copy, design, form, image, accessibility, QA, performance, review, enforcement, and deployment sources traced.
- [x] Current skill instructions, references, enforcement scripts, templates, and tests compared.
- [x] Every material capability classified as present, partial, absent, conflicting, or intentionally inappropriate.
- [x] Exact em-dash/en-dash rule locations and active gate reported.
- [x] Banned wording, punctuation, style patterns, prohibitions, and fail conditions inventoried.
- [x] Each recommended addition includes source lines, current lines, prevented failure, burden, lightweight wording, and Add/Add simplified/Do not add disposition.
- [x] P0/P1/P2/P3 priorities supplied.
- [x] API-key, paid/private integration, MCP, and developer-only requirements excluded from the lightweight core.
- [x] Current instructions to remove or simplify listed separately.
- [x] Claude contradictions and broken/stale gates documented so they are not imported.
- [x] No source code or skill files changed; only this audit report was created.
