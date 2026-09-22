# Review Intelligence and Testimonial Pipeline - implementation record

Date: 2026-09-22  
Branch: `feature/review-intelligence-testimonials`  
Base commit: `af49ee2fd7823ff8589c0242337d4c5e9da7ff4c`

## Purpose

Make customer-review research a first-class input to Landing Pages 2.0 positioning and copy while keeping published testimonials source-linked, identity-safe and provider-compliant.

## Implemented

- Added the canonical workflow reference: `references/review-intelligence-and-testimonials.md`.
- Added a normalized review manifest example with business/source identity matching, rights/storage flags, reviewer identity/avatar provenance, publication state and analysis tags.
- Added `scripts/review_workflow.py`:
  - aggregates source-linked customer problems, desired outcomes, buying triggers, objections, praised capabilities, benefits, voice phrases, differentiator signals and testimonial roles;
  - writes `build/review-insights.json`;
  - selects complementary publishable testimonials into `build/testimonial-selection.json`.
- Added `scripts/validate_reviews.py`:
  - validates exact-business source matching;
  - blocks generated reviewer avatars;
  - blocks publication states that conflict with source permissions;
  - detects stale selection/insight artifacts;
  - validates rendered quotes, names, ratings/dates and avatars against one source review;
  - supports a rendered evidence contract at `build/rendered-testimonials.json`.
- Added focused unit tests for aggregation, role-diverse selection, non-matched sources, generated avatars and invented rendered quotes.
- Wired the workflow into:
  - the active skill research stage;
  - research-and-claims;
  - copy and proof placement;
  - image/proof rules;
  - quality gates;
  - guided workflow;
  - orchestration evidence;
  - copy workflow;
  - native researcher routing/profile instructions;
  - project scaffolding;
  - guided runner allowed outputs.

## Publication model

Review intelligence and testimonial publication are separate.

A review can be:
- `research_only`
- `publishable_text`
- `publishable_full`
- `blocked`

Public discoverability alone is not treated as publication permission.

Google/restricted-provider content is explicitly optional. The skill must not scrape Google Maps or make a paid/metered provider a prerequisite. A future provider connection may supply compliant review data, but provider terms control storage, attribution and avatar handling.

## Merge notes

This branch intentionally does not modify live deployment/provider credentials and does not add a Google API dependency. It is designed to merge after the concurrent main-branch polishing work. Rebase/merge main first if overlapping documentation or scaffold files changed.

After merge, run:
- `python3 -m unittest skills/community-landing-page-builder/tests/test_review_workflow.py -v`
- the existing community release suite;
- native profile consistency check;
- one fresh guided pilot on a business with several first-party reviews and one with no usable reviews.

The pilot should confirm that review themes materially affect the selected leading advantage and copy, that testimonial cards preserve exact identity/source provenance, and that an unavailable or restricted provider does not block the ordinary local build.
