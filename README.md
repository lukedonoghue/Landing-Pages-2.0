# Landing Pages 2.0

**Turn a business website into a researched, conversion-focused landing page and a working lead funnel - then guide it all the way to production.**

Landing Pages 2.0 is a guided AI workflow for building landing pages without making the business owner manage copywriting, design, QA, CRM setup, or deployment as separate projects.

Give it a business website or description. It researches the business, works out what matters to the buyer, writes the copy, builds the page, creates the supporting guide, tests the funnel, improves weak areas, and guides publication when you are ready.

## What you give it

For most builds, you can start with just:

- a business website, business name, or clear description;
- the service or offer you want to promote, if it is not obvious;
- any important facts the system cannot verify itself.

Optional inputs such as a reference page, brand assets, campaign context, custom-domain details, tracking IDs, or external integrations can be added later. They are not prerequisites for producing a strong local final.

## What you get

A complete form-led build can include:

- researched positioning and buyer insights;
- benefit-focused landing-page copy;
- supported reasons to choose the business;
- real review intelligence and provenance-safe testimonials where available;
- a custom responsive landing page;
- purposeful, source-aware imagery;
- a useful illustrated PDF buyer guide;
- a full thank-you page that matches the main page;
- an accessible enquiry journey;
- a built-in local Cloudflare Workers + D1 CRM;
- lead storage, notes, stages, attribution and reporting;
- mobile, desktop, browser, accessibility and conversion QA;
- automatic comparison against the Blue Mountain Mesh control;
- automatic repair of confirmed copy/layout weaknesses;
- a guided publishing workflow when you are ready to go live.

The goal is not to generate a page and hand you a technical checklist. The goal is to move from **business context -> finished funnel -> verified release** while asking you only for decisions the system genuinely cannot make itself.

## How the workflow works

### 1. Understand the business

The builder researches the official website, services, process, proof, FAQs, contact information, customer feedback and other relevant first-party material.

Where customer reviews are reasonably available, it extracts recurring:

- customer problems;
- desired outcomes;
- objections;
- praised capabilities;
- practical benefits;
- natural customer language;
- possible differentiators.

It separates research insight from publishable testimonials, so useful review themes do not automatically become quoted proof.

### 2. Write the sales argument before designing the page

The system identifies the strongest supportable reason to choose the business and writes the complete copy before layout.

The copy is reviewed for:

- clarity of the offer;
- customer benefit;
- differentiation;
- proof and mechanism;
- objections;
- process;
- CTA consistency;
- unsupported claims;
- generic AI language.

A weak copy draft is not simply passed into design. Copy acceptance is a real gate.

### 3. Design and build the funnel

The page is designed around the business rather than a generic template.

The builder uses the observed brand, typography, imagery and conversion intent where appropriate, then creates the responsive page and conversion journey.

For enquiry-led pages, the bundled Cloudflare/D1 CRM is the default. You do not need to choose a CRM, spreadsheet, analytics product, auth provider, or hosting stack just to get a working local funnel.

### 4. Build the supporting guide and thank-you experience

New complete builds normally include a researched buyer guide rather than a throwaway PDF.

The guide is rendered and every page is inspected. The thank-you page is derived from the main landing page so it keeps the same brand, proof, benefits and useful context instead of becoming a generic success box.

### 5. Test and improve the actual output

The builder tests the rendered page, not just the source files.

The workflow covers representative mobile and desktop layouts, conversion behavior, accessibility, PDF delivery, local CRM behavior, browser checks and performance.

After the first build, the system compares the real page against the Blue Mountain Mesh control for persuasive clarity and layout discipline. It creates a concrete improvement list, applies warranted repairs, then captures and reviews the page again before presenting the local final.

### 6. Publish through the guided release flow

When you are ready to go live, the publishing workflow handles the routine production work and surfaces only the action that actually needs you.

For the standard supported Cloudflare path, the experience is designed to be:

**domain + owner email -> Cloudflare sign-in -> automatic preflight/configuration -> publish approval -> deploy -> synthetic verification -> cleanup -> release receipt**

Google Sheets is off by default and appears only when explicitly selected.

Read [GUIDED-PUBLISHING-START-HERE.md](GUIDED-PUBLISHING-START-HERE.md) for the current publishing entry point.

---

# Start here

## Option A: build a real landing page with an AI coding session

Open this repository in a file-capable ChatGPT/Codex or Claude Code session.

Then paste:

> Build a landing page for [BUSINESS WEBSITE OR DESCRIPTION] using the Landing Pages 2.0 community workflow in guided mode. Research the business first, ask only for genuinely missing business decisions, write and review the benefit-focused copy before layout, build the page, useful PDF, thank-you page and local CRM where the conversion uses a form, run the quality checks, compare the first build against the control, repair confirmed weaknesses, and show me the improved local final. Do not publish until I ask.

The workflow should research before questioning you and continue through routine work without repeatedly asking whether it should proceed.

## Option B: run the deterministic local demo

From a fresh checkout:

```sh
python3 scripts/dev.py doctor
python3 scripts/dev.py bootstrap
python3 scripts/dev.py doctor
python3 scripts/dev.py demo
python3 scripts/dev.py verify-demo --full
python3 scripts/dev.py serve
```

The first doctor may report missing dependencies. Bootstrap installs the locked project-local Python, Node and browser dependencies without signing into accounts or deploying anything.

The demo uses fictional data and stays local.

## When you are ready to publish

From a generated project:

```sh
python3 scripts/ship.py --operator --ui
```

Or from this repository:

```sh
python3 scripts/dev.py ship --project /path/to/generated-project --operator --ui
```

The guided publishing flow resumes saved progress, keeps credentials out of chat, and separates automatic checks from the few external actions that require the owner.

---

## What the system should ask you - and what it should not

The system may need you to confirm things like:

- the actual service or offer when the source is ambiguous;
- an operational promise that is not published anywhere;
- which business/account is correct when several are possible;
- whether you approve the displayed production destination;
- an external sign-in, ownership, or DNS action that software cannot complete safely.

It should **not** ask you to decide:

- CSS structure;
- database schemas;
- which CRM to use for the standard form flow;
- how to configure D1;
- what model should perform each worker task;
- which QA scripts to run;
- how to repair a routine layout bug;
- whether obvious weak copy should be improved.

Those are workflow responsibilities.

## Guided mode vs automatic mode

**Guided mode** is best when you want to see the brief, copy and important business choices as the build progresses.

**Automatic mode** is best when you want the system to work through routine research, implementation, review and repair without approval pauses.

Both modes preserve the same claim, quality, conversion and publishing safeguards.

The visible guided journey is:

**Start -> Business -> Conversion -> Copy -> Design -> Preview -> Connections -> Publish -> Complete**

These are workflow stages, not nine permission screens.

## What "ready" means

The project uses status language deliberately:

- **local final** - the selected local experience has passed its gates;
- **publish-ready** - the selected external configuration is present and preflight has passed;
- **live and verified** - the actual deployed destination and selected conversion journey have been checked after publication.

A successful local build is not silently relabeled as a live deployment.

## What is automatic by default

For a normal form-led landing page:

| Area | Default behavior |
|---|---|
| Business research | Automatic |
| Review/customer-language research | Automatic when reasonably available |
| Strategy and positioning | Automatic, using supportable evidence |
| Copywriting | Automatic |
| Copy review | Automatic |
| Responsive design | Automatic |
| Image planning | Automatic |
| PDF buyer guide | Included unless research supports an exception |
| Thank-you page | Included |
| Local CRM | Included for form-led pages |
| Local QA | Automatic |
| Control comparison and repairs | Automatic |
| Google Sheets | Off unless selected |
| Ad-platform/GTM tracking | Off unless selected |
| Production publishing | Runs only when requested |

## Current standard publishing path

The self-guided publishing adapter currently targets the common configuration:

- macOS or Linux;
- one custom domain;
- one Cloudflare Worker;
- one D1 database;
- the bundled CRM.

Advanced configurations such as split public/CRM domains, external-DNS gateways, static-only pages and workers.dev-only releases retain their existing advanced publishing paths rather than being silently rewritten.

## Important principles

Landing Pages 2.0 is designed around a few non-negotiables:

- no invented proof, reviews, ratings, guarantees, credentials or outcomes;
- generated imagery is illustrative, never fake evidence;
- the source conversion intent is preserved unless the owner explicitly changes it;
- a form only reports success after the selected destination confirms success;
- required claims keep their qualifiers;
- live publication and live test leads require actual authorization;
- private credentials stay out of chat, source, screenshots and public artifacts;
- a green test report cannot override a visibly broken page.

## Optional integrations

The standard local build does not require any of these:

- Google Sheets;
- GTM;
- Google Ads conversion IDs;
- Meta or Microsoft tracking;
- GitHub source backup;
- external CRM/webhooks;
- custom email delivery;
- custom domains.

They are activated only when selected.

## Testing the current release

If you are testing the repository itself rather than building for a client, start with [TESTING-START-HERE.md](TESTING-START-HERE.md).

It contains the validated tester flow, environment expectations, feedback format and current known limitations.

## Technical reference

The main implementation is the community skill:

- [Community skill](skills/community-landing-page-builder/SKILL.md)
- [Guided workflow](skills/community-landing-page-builder/references/guided-workflow.md)
- [Copy workflow](skills/community-landing-page-builder/references/copy-workflow.md)
- [Copy acceptance](skills/community-landing-page-builder/references/copy-acceptance.md)
- [Review intelligence and testimonials](skills/community-landing-page-builder/references/review-intelligence-and-testimonials.md)
- [Image research and generation](skills/community-landing-page-builder/references/image-research-and-generation.md)
- [Reader guide quality](skills/community-landing-page-builder/references/reader-guide-quality.md)
- [Control comparison](skills/community-landing-page-builder/references/control-comparison.md)
- [Quality gates](skills/community-landing-page-builder/references/quality-gates.md)
- [Guided publishing](skills/community-landing-page-builder/references/guided-publishing.md)
- [Security operations](skills/community-landing-page-builder/references/security-operations.md)
- [Native orchestration](skills/community-landing-page-builder/references/orchestration.md)

## Install the community workflow into another project

From this repository:

```sh
python3 scripts/install_community.py --project /absolute/path/to/project --runtime codex --copy-skill
```

For Claude Code:

```sh
python3 scripts/install_community.py --project /absolute/path/to/project --runtime claude --copy-skill
```

For both profile sets:

```sh
python3 scripts/install_community.py --project /absolute/path/to/project --runtime both --copy-skill
```

Existing owner settings and unmanaged files are preserved. Conflicts stop installation instead of silently overwriting customized work.

## Development and contribution

For repository development, test commands, implementation details and legacy workflows, see [CONTRIBUTING.md](CONTRIBUTING.md).

The previous branded workflow remains under `skills/branded-lead-funnel-builder/` and its historical README is preserved in [README-LEGACY.md](README-LEGACY.md).

## Repository status

This is a private collaboration repository. The word "community" names the reusable workflow; it is not an open-source license grant.

The project is actively being tested as a self-guided workflow across real AI coding environments. Automated tests establish mechanical behavior, but they do not replace real-business evaluation of research quality, copy quality, design quality, or every possible hosting/account configuration.
