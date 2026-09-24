# Publish your page with guidance

The new publishing wizard replaces the technical production checklist for the
standard Cloudflare Worker + D1 CRM deployment. It is a **new implementation
candidate**; read `GUIDED-PUBLISHING-IMPLEMENTATION-STATUS.md` for what has actually
been validated before treating it as a production release.

## Start

Ask your coding assistant:

> Finish this Landing Pages 2.0 project and prepare the guided publishing wizard.
> Read the community skill and references/guided-ship.md. Check the non-secret
> shipping status, repair actual local quality failures, and give me the trusted
> local launcher. Preserve my decisions. Do not publish from the coding agent or
> read production credentials. I will approve publication in the local wizard.

From a fresh generated project, open your own terminal and run:

```sh
python3 scripts/ship.py --operator --ui
```

From the reusable repository:

```sh
python3 scripts/dev.py ship --project /path/to/your-generated-page --operator --ui
```

Use the actual project path supplied by your assistant, not the fictional demo.
The demo intentionally refuses production publishing. Existing project copies
need a reviewed runtime update; changing the reusable repository does not silently
replace their private bundled builder.

## What you will see

Enter your website domain and CRM owner email. The wizard fills a site name;
advanced settings are optional. Leave Google Sheets unchecked unless you need it.
Sign in to Cloudflare when asked and select the correct account when more than one
is available. Approve preparation, confirm the few account safeguards that cannot
be inspected automatically, then choose **Publish and verify** for the displayed
destination and labelled synthetic test.

The wizard handles the routine work and shows one current action when it needs
help. A quality failure goes back to your coding assistant with a ready-to-copy
repair request, rather than a technical production checklist. Closing/reopening
the same wizard resumes the saved work; it does not start a replacement upload.

Your password is not entered into chat or the browser form. A private handoff opens
locally on your computer. Do not share the wizard's private address. Google setup
cards appear only when selected. You never need NetBean for this workflow.

## What Ready means

The receipt identifies the exact checked source and deployed version, completed
live test and removal of its synthetic contact. Owner confirmations remain visibly
different from automatic checks. A recovery bookmark is not a promise that a
restore has been rehearsed. A PDF download is not proof that every browser displays
its native embedded preview. No paid service is automatically enabled.

The first adapter covers a single custom domain, one Worker and one D1 database
on macOS/Linux. Separate public/CRM domains, external-DNS gateways, static-only and
workers.dev-only profiles retain their advanced publishing paths; the wizard does
not rewrite them. See the implementation status for remaining acceptance work.
