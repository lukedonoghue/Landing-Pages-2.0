# First run and fictional local demo

Use this guide when installing the skill, checking its local tools, or demonstrating the workflow without a client account. The agent should operate the helpers and explain progress in ordinary language.

## Agent flow

1. Read the current client's request. A real client build uses the normal scaffold; the demo is only a learning/test environment.
2. Run the local tool doctor. If PATH has an older Node or incomplete Python, use an available supported runtime. In Codex, discover bundled runtimes through the workspace dependency tool; do not hardcode someone else's home directory.
3. If dependencies are missing, use bootstrap for project-local Python/Node/browser dependencies. It never upgrades the system Python, runs sudo, signs into accounts, or deploys. For missing OS packages, use the host's supported installation mechanism within the user's setup scope.
4. Re-run the doctor. A local-tools pass does not claim website access, image-model access, visual-review capability or Cloudflare authorization. Verify those only when their stage needs them.
5. For a demo, create a new directory and explain that it contains fictional data. Start it, show the page/admin and run the actual local journey. Open the private password file only for the authorized local login; never print it or commit it.
6. Inspect the captured page/modal/thank-you and all PDF page renders. Automated verification deliberately leaves visual review pending.
7. For a real project, continue research and copy drafting. Do not reuse fictional approval/content or remove the fixture flag to publish the demo.

There is no routine approval checkpoint for reversible local work. Default real-client builds continue through the tested local final. Copy approval is optional when explicitly requested; publication still needs an actual user instruction and controlled live test leads need explicit permission.

## Commands

The initial local helper supports macOS and Linux. Other operating systems need a tested runtime adapter; doctor reports that boundary explicitly.

From the repository, the convenience entry point is:

~~~sh
python3 scripts/dev.py doctor
python3 scripts/dev.py bootstrap
python3 scripts/dev.py doctor
python3 scripts/dev.py demo
python3 scripts/dev.py serve
~~~

Use Node 24 (minimum 22.19). If it is not on PATH, append --node /absolute/path/to/node, or set FUNNEL_NODE. Bootstrap creates a private Python environment inside the skill only if the current Python lacks the PDF dependencies; later quickstart calls discover that environment automatically.

From an installed skill, use the same commands through its own scripts/quickstart.py. No repository checkout is needed for the fictional demo. The default demo directory is .development/demo under the current working directory. Supply --project /path/to/new-demo to choose another location.

For a new demo, run bootstrap **without --project** first; it installs the skill template's build tools. Then run demo --project /path/to/new-demo. With doctor/bootstrap, --project means an **already generated application** containing its package/lock files, not a future output directory. The serve, verify-demo and reset-demo commands accept the created demo directory.

The local login is at /login.html, username owner. Its random password is stored privately at .secrets/local-admin-password.txt in the demo. No shared default password is shipped.

A demo contains three marked synthetic contacts and nine visits across Google paid, Facebook paid and Google organic traffic. These seeded rows demonstrate UI/filter states; they are not evidence of form delivery. Verification adds a separate real browser-originated local test lead.

## Verification and safe reset

~~~sh
python3 scripts/dev.py check
python3 scripts/dev.py verify-demo --full
python3 scripts/dev.py reset-demo
~~~

- check runs the repository's Python and application regressions and rejects skipped application tests. From an installed skill without the repository, its output explicitly identifies the narrower installed-skill suite scope.
- verify-demo creates its own loopback-only server and stops it afterward. It runs Chromium/WebKit and a real local form-to-D1-backed-CRM journey, captures actual desktop/mobile wording without submitting another lead, compares page/modal/thank-you/PDF against the authored synthetic master, records both release gates, then renders every PDF page. These fixture checks are never human copy approval.
- --full adds the nine-viewport layout matrix and three mobile Lighthouse runs.
- Reports and screenshots remain under the demo's build directory. No Cloudflare account is needed.
- The tests create a synthetic visit/contact that remains in local historical metrics. A soft-deleted contact would not remove that history.
- reset-demo only accepts a marked local demo with no account/domain/remote database binding. It preserves the old database state privately under .secrets/demo-backups before rebuilding/seeding the local database.
- Stop the demo server before reset. The quickstart lock prevents concurrent serve, verification and reset operations managed by this helper.

Creation refuses to overwrite an unrelated nonempty directory. Re-running demo on its own complete scaffold resumes dependency/PDF/database setup and preserves existing source edits. If source generation itself was interrupted before its required files were complete, choose a new directory; the incomplete files are retained.

Demos created before the rendered-copy helper was added need a new demo directory. Verification detects the missing contract/helper before starting the server or adding a test lead; it does not overwrite old source or data.

Older catalogue configurations with blank image paths need an explicit `image_mode: "none"` for intentional colour-only sections. Named missing images block generation and preserve the previous PDF. The agent can inspect/migrate its fictional demo configuration or create a new demo directory; existing client copy/assets must not be overwritten.

The fictional demo is explicitly blocked by the publication approval checker and remote setup. Automatic GitHub deployment is disabled for this beta. Use a new real client project and its actual approvals for a live page.

## Limits

These helpers establish local runtime and integration readiness. They do not author/approve a client's copy, authenticate Cloudflare, call a paid image API, perform an actual visual review, validate a production domain, or complete the full self-guided beta acceptance plan.
