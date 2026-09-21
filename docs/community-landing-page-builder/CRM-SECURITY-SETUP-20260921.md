# CRM security setup UX

## User requirement

The reusable CRM must give nontechnical business owners a short "One-time security setup" checklist. It must not expose our QA process, test accounts, environment variables or deployment commands. Outside consultants may use any email domain, not just the business's domain. Cloudflare Free recipient verification still applies.

## Scope

Updated the maintained community skill's users.js/users.css and mirrored those exact files into the current Bookkeeping by Beks project. Luke's originals, the frozen independent-build input and historical acceptance archive are unchanged. No account, sender, recipient, DNS or password changes are part of this UI repair.

The owner checklist has three steps: choose receiving inbox and sender with Codex, verify the inbox at Cloudflare Destination Addresses, then confirm the owner email in CRM Users. A short separate paragraph covers adding actual teammates. Non-owner administrators see teammate instructions rather than instructions for the hidden owner-only form. The guide stays below 180 words, opens when connection is missing, supports keyboard expansion and respects the user's expanded/collapsed choice across refresh.

Email configuration presence is not labelled proof of inbox delivery. Existing confirmed account badges now say "CRM verified" to distinguish account possession from Cloudflare's destination prerequisite. The sender needs a one-time domain connection; recipients have no same-domain requirement. Existing exact-recipient restrictions and disabled email actions remain intact until connection is configured.

## Local evidence

- GPT-5.6 Sol high implemented the shared changes; parent reviewed source and final 320px/1440px guide captures.
- Beks UI suite: 8/8 passed. Canonical UI suite: 8/8 passed before the screenshot-only change from full-page to guide-only captures.
- Account/mock-mail suite: 12/12 passed in each copy, including a new sender/recipient cross-domain regression. These tests do not prove real inbox delivery.
- Shared backend identity verifier: all 34 core files match.
- Guide keyboard toggle, disabled actions, collapsed state after refresh and 320px page overflow checks passed.
- Scoped git diff whitespace check passed. Skill quick_validate was unavailable because the local Python environments lack PyYAML; skill frontmatter was not changed.

Only synthetic provider-guide screenshots were captured for this review. No real customer/owner records or private links are included in this document.

## Actual email blocker

The current project still needs an explicitly authorized receiving inbox and sender. Read-only public DNS on 2026-09-21 showed netbean.com at dns1/dns2.registrar-servers.com with five eforward*.registrar-servers.com mail records. Do not replace that DNS/mail setup blindly. Reuse another authorized onboarded sender or separately review a DNS onboarding. The CRM may remain on workers.dev. Never promise that workers.dev supplies a sender domain.

Dashboard navigation was checked against current official Cloudflare destination, domain and pricing documentation linked in references/team-access.md. Both Cloudflare destination verification and CRM account verification are real prerequisites, not customer testing tasks.

## Publication

Local implementation is complete. Guarded publication is in progress; this checkpoint does not claim that the new guide is live. Replace this paragraph only after observed release identity and live UI proof. Real email delivery remains pending regardless of UI deployment.
