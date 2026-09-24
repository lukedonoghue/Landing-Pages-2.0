# Landing Pages 2.0

**Give it a business website. Get back a researched, conversion-focused landing page, a working lead funnel, and a guided path to launch.**

Landing Pages 2.0 is built for the part of landing-page work that normally gets split across five different jobs: research, copywriting, design, development, and launch.

You give it a business website or a clear description of the business. It researches the offer and the customer, writes the copy, builds the page, creates the supporting guide, tests the funnel, improves weak areas, and can guide the final publishing process when you are ready.

The aim is simple: **less briefing, less back-and-forth, and a much more complete first result.**

## What it does for you

A typical build covers:

- research into the business, offer, customers, proof, FAQs, and competitors where useful;
- customer-review analysis to uncover common problems, desired outcomes, objections, and language buyers actually use;
- benefit-focused landing-page copy with a clear reason to choose the business;
- responsive page design that follows the business rather than a generic template;
- relevant imagery and a useful buyer guide;
- a full thank-you page rather than a basic success message;
- a built-in lead inbox and CRM for enquiry-led pages;
- mobile, desktop, browser, accessibility, and conversion testing;
- an automatic review of the first build, followed by repairs before the page is presented as finished;
- guided publishing when you want to take the page live.

You do not need to arrive with a finished brief, a CRM choice, a wireframe, or a list of technical requirements.

## The basic workflow

### 1. It learns the business

The builder starts by reading the business website and the pages that matter: services, process, FAQs, testimonials, contact details, proof, and other useful first-party information.

If customer reviews are available, it looks for repeated patterns such as:

- what customers were struggling with;
- what they wanted to achieve;
- what made them hesitate;
- what they valued most;
- what they praised after buying;
- how they naturally describe the problem and the result.

That research feeds the strategy and the copy. Reviews are only quoted as testimonials when they can be used accurately and with the right attribution.

### 2. It writes the sales argument before it designs the page

The workflow works out the strongest credible reason someone should choose this business, then writes the full page around that.

The copy is reviewed for clarity, benefits, proof, objections, differentiation, and weak generic language before layout starts.

The point is not to make a page look polished around mediocre copy. The argument has to make sense first.

### 3. It designs and builds the page

The page is built around the business's actual brand, offer, content, and conversion goal.

For enquiry-led pages, a built-in lead inbox and CRM is included by default, so you can test the full journey without first choosing and configuring a separate CRM.

### 4. It creates the guide and thank-you experience

Complete builds normally include a useful buyer guide or service guide, not a filler PDF.

The thank-you page is built as part of the same experience, with the same brand, proof, benefits, and useful next-step content.

### 5. It checks the finished page and improves it

The workflow tests the actual rendered page across different screen sizes and checks the conversion journey, accessibility, guide delivery, browser behavior, local CRM, and performance.

It then reviews the first build against the project's reference standard, identifies what is still weak, fixes the problems, and checks the page again.

So the first draft is not automatically treated as the final answer.

### 6. It can guide the page all the way to launch

When you are happy with the page, the publishing flow handles the routine setup and verification work and only stops when something genuinely needs you, such as signing in, choosing the correct account, or approving the final destination.

For the standard Cloudflare setup, the experience is designed to feel like:

**choose the domain -> sign in -> review the destination -> publish -> verify the live funnel**

Google Sheets, ad tracking, external CRMs, and other integrations are optional. They are not part of the default setup unless you want them.

See [GUIDED-PUBLISHING-START-HERE.md](GUIDED-PUBLISHING-START-HERE.md) when you are ready to test publishing.

---

## Start a real build

Open this repository in a file-capable ChatGPT/Codex or Claude Code session and say:

> Build a landing page for [BUSINESS WEBSITE OR DESCRIPTION] using Landing Pages 2.0 in guided mode. Research the business first, ask me only for anything important you genuinely cannot work out, and take the build through copy, design, QA, and the improved local final. Do not publish until I ask.

That is enough to begin.

The workflow should do the research before asking you for information and should keep moving through routine work without repeatedly asking whether it can continue.

## What you'll usually need to provide

Usually, not much.

A business website or clear description is enough to get started. If the exact offer is not obvious, tell it what you want to promote.

It may come back to you if something genuinely needs your judgment, for example:

- the website is unclear about the exact service or offer;
- an important business fact cannot be verified;
- there are several possible accounts or domains and it needs to know which one is yours;
- you are ready to publish and need to approve the destination or sign in.

Everything else should be handled as part of the build.

## Guided mode or automatic mode

Use **guided mode** if you want to see the important business decisions and copy as the build progresses.

Use **automatic mode** if you want the workflow to make routine decisions, build, review, and repair without stopping for approval.

Both modes use the same research, copy, quality, and publishing safeguards.

## What you get at the end

A complete enquiry-led project can include:

- the finished responsive landing page;
- the final copy and strategy notes;
- a useful PDF guide;
- the full thank-you page;
- the lead form and working local CRM;
- lead stages, notes, attribution, and reporting;
- representative mobile and desktop screenshots;
- QA results and repaired issues;
- a project that can be resumed later without starting again;
- the guided publishing flow when you are ready to launch.

## Run the local demo

If you want to see the workflow working with fictional data first:

```sh
python3 scripts/dev.py doctor
python3 scripts/dev.py bootstrap
python3 scripts/dev.py doctor
python3 scripts/dev.py demo
python3 scripts/dev.py verify-demo --full
python3 scripts/dev.py serve
```

The first check may tell you that some dependencies are missing. Bootstrap installs the project's locked dependencies locally. It does not sign in to accounts or publish anything.

## Publish a generated project

From the generated project:

```sh
python3 scripts/ship.py --operator --ui
```

Or from this repository:

```sh
python3 scripts/dev.py ship --project /path/to/generated-project --operator --ui
```

The publishing wizard saves its progress, keeps credentials out of chat, and resumes from the last completed step if it is interrupted.

The standard guided publishing path currently covers the most common setup: one custom domain, one Cloudflare Worker, one D1 database, and the bundled CRM on macOS or Linux.

More unusual setups are still supported through the advanced publishing references rather than being silently changed to fit the simple path.

## Optional extras

A normal local build does **not** require:

- Google Sheets;
- Google Tag Manager;
- Google Ads, Meta, or Microsoft tracking;
- an external CRM;
- GitHub source backup;
- custom email delivery;
- a custom domain.

Add them only when they are actually useful.

## Built to stay honest

The workflow is deliberately conservative about proof and claims.

It should not invent reviews, ratings, guarantees, results, credentials, people, or business facts. Generated imagery is treated as illustration rather than evidence. A form should only show success when the selected destination has actually accepted it.

And if a page is visibly broken, a passing test report does not make it finished.

## Testing this repository

If you are testing Landing Pages 2.0 itself rather than building for a real business, start with [TESTING-START-HERE.md](TESTING-START-HERE.md).

That guide covers the current tester flow, setup, feedback format, and known limitations.

---

## Developer and implementation reference

The main implementation lives in the community skill:

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

### Install the workflow into another project

For ChatGPT/Codex:

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

Existing project settings and unmanaged files are preserved. Conflicts stop the installation instead of silently overwriting customized work.

For repository development, test commands, implementation details, and legacy workflows, see [CONTRIBUTING.md](CONTRIBUTING.md).

The previous branded workflow remains under `skills/branded-lead-funnel-builder/` and its historical README is preserved in [README-LEGACY.md](README-LEGACY.md).

## Current scope

Landing Pages 2.0 is being tested as a self-guided workflow across real AI coding environments.

The automated test suite checks the mechanics of the workflow, but real-business testing is still important for judging research quality, copy quality, design quality, and how intuitive the experience feels to someone using it for the first time.

This is a private collaboration repository. The word "community" refers to the reusable workflow and is not an open-source license grant.
