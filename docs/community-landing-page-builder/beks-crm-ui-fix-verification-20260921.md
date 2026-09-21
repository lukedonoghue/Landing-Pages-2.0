# CRM UI fix verification - 2026-09-21

## Outcome

Implemented the requested fixes in the generated project and reusable shared Cloudflare source without changing the CRM design.

- Clicking the backdrop outside the white lead-details dialog closes it.
- Clicking inside the dialog keeps it open.
- Dragging a text selection from inside the dialog onto the backdrop does not close it.
- Escape closes the dialog and restores focus to the lead opener.
- Injected empty password-manager siblings no longer create an extra label grid row or lift the Username field, and Username remains clickable and fillable.
- Invite-field geometry remains unchanged at 2048, 900, 720, and 390 pixel viewport widths, with no horizontal overflow.

## Root cause and implementation

The accepted earlier CRM used the same native dialog behavior and had no explicit backdrop click handling. The fix in `public/admin/app.js` checks pointer coordinates against the lead dialog rectangle and only closes when the primary pointer starts and finishes on the backdrop. Existing native Escape handling and the existing close-event focus restoration remain in place.

The accepted earlier CRM predates `public/admin/users.css`. In the current reusable CRM, invite labels were grid containers. An empty injected sibling became a third grid item, adding a second 7px gap and shifting Username upward. Labels now use normal block flow, while direct inputs and selects retain the existing 7px separation and full grid-cell width. The correction has no extension-specific selectors, absolute positioning, or `!important` rules.

The generated project also had reusable login accessibility corrections. The complete override block was promoted to shared `public/login.css`: `[hidden]` reliably wins over author-level flex display rules, muted instructional/status colors use the corrected contrast tokens, and headings use fixed display sizes with zero letter spacing. The established 800px and 620px responsive sizes remain. `login.html` was not changed.

## Files changed

The same contents were applied to both roots:

- `public/admin/app.js`
- `public/admin/users.css`
- `public/login.css`
- `tests/crm-ui-behavior.test.mjs`

Project:

`/Users/mac/Documents/Codex/2026-09-17/co/work/community-run-20260921-us-r1/project`

Shared source:

`/Users/mac/Documents/Codex/2026-09-17/co/work/Landing-Pages-2.0/skills/community-landing-page-builder/assets/cloudflare`

No changes were made to `users.js`, team-account/backend files, `login.html`, page index files, landing-page styles, live data, deployment state, commits, or secrets. The existing normalized `viewCopy` text in `app.js` was preserved.

## Verification

Dedicated isolated browser suite:

```sh
node --test tests/crm-ui-behavior.test.mjs
```

Final parent-owned serial browser run used an explicit Chrome binary for `tests/team-accounts-ui.test.mjs` and `tests/crm-ui-behavior.test.mjs`: 13 tests passed, 0 failed, 0 skipped. The browser was closed after the run.

Coverage:

1. Source contract for guarded backdrop behavior and stable block labels without extension-specific hacks.
2. Login and forgot-password modes show/hide the expected forms and transfer focus using an unauthenticated route fixture, without submitting a login or reset request.
3. Backdrop click closes lead details.
4. Interior click keeps lead details open.
5. Inside-to-backdrop pointer drag keeps lead details open.
6. Escape closes and restores opener focus.
7. Generic empty-sibling injection preserves invite-field geometry and Username click/fill usability at 2048, 900, 720, and 390 pixels.

Additional checks:

- `node --check public/admin/app.js` passed.
- `node --check tests/crm-ui-behavior.test.mjs` passed.
- Existing non-browser `tests/runtime-contract.test.mjs`: 2 passed, 0 failed.
- Shared-source `git diff --check` passed.
- SHA-256/byte comparisons match between project and shared copies for `app.js`, `users.css`, `login.css`, and the dedicated test suite.
- The suite used one Playwright-managed headless Chromium with an ephemeral loopback fixture server. Pages close in `finally`; browser and server close in the suite teardown.
