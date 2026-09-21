# QA and Handoff

## Evidence gates

| Gate | Required evidence |
|---|---|
| Research | Source files/URLs, retrieval dates, reference matrix |
| Claims | Approved ledger with qualifiers and locations |
| Copy | Passed checklist and one CTA/follow-up promise |
| Catalogue | Full render/contact sheet, metadata/page count, cover derivatives |
| Build | Source files, optimized assets, no unresolved local references |
| Interaction | Browser-completed form path plus error path |
| Responsive | Screenshots at 1440, 1280, 768, 390 |
| Delivery | Confirmed CRM receipt or explicit pending warning |
| Tracking | Confirmed IDs/events or explicit pending warning |
| Handoff | Archive integrity, file matches, START-HERE instructions |

Use `pass_with_warnings` only when the remaining issue is genuinely non-blocking for the stated deliverable. Missing CRM receipt is non-blocking for a local preview and blocking for launch readiness.

Before delivery, reconcile the owner-facing QA summary with the current dated reports, actual deployment URL/revision, selected configuration and unresolved blockers. Remove stale present-tense status and copied test counts; preserve older results explicitly as historical evidence. Execute any supplied setup command against a safe synthetic fixture or its documented dry-run/help contract, not just by reading it. Describe the actual configured cron interval and distinguish immediate processing from scheduled retries. Account-email tests using a mail sink prove local behavior, not real provider delivery.

## Browser test matrix

At minimum:

- page loads with no console/runtime error;
- phone, privacy, and brochure links resolve;
- every CTA opens the same modal;
- modal heading and step counter are announced;
- empty required fields block progress;
- all radio/select choices are reachable by keyboard;
- Back retains values;
- Escape and backdrop close;
- focus returns to the trigger;
- mobile modal remains usable with the virtual-keyboard viewport;
- successful endpoint response reaches thank-you;
- failed/non-2xx endpoint response does not claim success;
- thank-you page exposes the correct brochure and promise;
- screenshots show loaded lazy images after scrolling.

## Static validation

Run `scripts/validate_funnel.py`. Treat its result as one input, not a replacement for browser and visual QA.

Check the generated report for:

- required files;
- exactly one modal form by default;
- missing local assets;
- inconsistent CTA text;
- unresolvable brochure link;
- images missing dimensions;
- raw-PII-shaped analytics keys;
- external font hosts;
- missing webhook warning.

## Handoff

Run:

```bash
python3 scripts/package_handoff.py \
  <project-root> \
  --output <archive.zip> \
  --client "<client name>"
```

For the supported Cloudflare profile, version-2 ZIPs contain:

```text
Client-Cloudflare-Funnel/
  START-HERE.txt
  FILE-MANIFEST.json
  project/                  # Open this as the actual project root
```

Wrapper instructions and checksums stay outside `project/`, so they do not change its reviewed source fingerprint. Root fixtures, image plans, copy inputs, research, progress, current QA and linked artifacts retain their paths. Standard completed-but-unregistered reports are included for resumption. Catalogue assets must use relative project-local paths; default installed-skill fonts remain a tool dependency. A fictional demo also retains its authoring configuration.

The default Worker export requires current copy and handoff quality checks. Use `--in-progress` for an unfinished build that needs collaboration; missing/stale checks remain explicitly blocked. This is an ordinary work-in-progress handoff, not a new publishing permission checkpoint. The legacy `--allow-missing-evidence` option maps to the same unfinished scope for Worker projects. `--evidence-manifest` can add exact project-relative inputs; it cannot bypass privacy/path checks.

Use the installed skill's helper to verify and extract into a **new** directory:

```sh
python3 /path/to/installed-skill/scripts/portable_handoff.py verify client.zip
python3 /path/to/installed-skill/scripts/portable_handoff.py extract client.zip --into /new/handoff
python3 /path/to/installed-skill/scripts/workflow.py resume /new/handoff/project
```

The extractor checks inventory, hashes, source identity and applicable copy/QA evidence. It rejects traversal, symlinks, duplicate/colliding paths, inconsistent reviewed labels and oversized archives. Existing work is never overwritten. It does not execute received project code, install packages, contact an account or publish. A checksum detects corruption; it does not authenticate the sender or prove consent. Review the provenance before executing received code or installing its dependencies.

Credentials, private recovery requests, runtime databases and raw lead/session exports require a separate secure handover and are excluded. The helper also rejects recognized credential values in otherwise ordinary files. Keep source free of unrelated private data; binary media and human-authored source still require the normal content/privacy review. Intermediate unrelated build logs are not automatically included.

Approval messages are reduced to hashes and minimal revision/message references. Reusable copy approval remains evidence for its exact scope, never a substitute for the current user's instruction. Publication approvals and active deployment pointers become historical records. The imported project starts with pending publication context, and the guarded publisher will not contact a provider until that context is reconciled. When the actual user already authorized the same reviewed source and destination, reuse and record that real instruction without asking again; never invent approval from archive metadata. A changed account/domain/source must satisfy its current checks and scope.

Publishing history and sealed nonsecret release evidence remain available for inspection across another export. An unresolved prior upload, test submission or recovery operation needs its actual outcome reconciled; do not reactivate pointers or generate new IDs merely because private files were intentionally omitted. A source ZIP is not a live database backup or a complete cross-account recovery procedure. Install local dependencies and create local credentials/database before previewing; obtain real account access separately only when publishing is requested.

Write the ZIP outside the project, or under `build/`, with a `.zip` extension. Packaging uses a temporary file and validates it before replacement. Source and evidence files are not valid output targets. Packages above the documented implementation limits (20,000 files, 128 MiB per file, 1 GiB uncompressed total) require a deliberate separate handoff arrangement.

The older static-only packaging mode retains its `landing-page/`, `brochure/` and `evidence/` layout. The new portable workflow guarantee applies to the Cloudflare profile; do not describe an old static ZIP as a resumable Worker project.
