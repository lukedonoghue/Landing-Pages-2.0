# Managed browser process follow-up

- Never wait on unbounded `Promise.all(document.images.map(...))`: lazy off-screen images may never request or settle.
- Exercise normal scrolling, then bound image readiness with `Promise.race` and a finite timer; keep the independent broken-image assertion.
- Wrap each browser in `try/finally` and close contexts before the browser.
- Run one browser or test suite at a time on this Mac.
- Launch long checks through `build/run-bounded-command.mjs`; it owns a detached process group, sends `SIGTERM` on timeout/interruption, and escalates only that group to `SIGKILL` after five seconds.
- Inventory only Playwright-managed paths and profiles after completion. Never signal installed personal Chrome or edit its profiles, locks, or preferences.

The September 21 hang came from two ad hoc image-review scripts whose unbounded lazy-image waits prevented their `finally` blocks from running. Those scripts and their temporary profiles were closed and must not be reused.
