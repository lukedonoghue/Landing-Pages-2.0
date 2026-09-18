# Enquiry erasure, retention and recovery

Read this when configuring a client's data handling, fulfilling an enquiry-erasure request, or preparing a database recovery. The first-party CRM starts with **automatic cleanup off**. Choose periods for the actual client; no universal retention duration is assumed. Include the chosen behavior in the existing final review and the client's privacy information, rather than creating another routine approval checkpoint.

## Owner flow

Open **Account → Data retention & erasure**. Search by name, email or phone; the results include active and removed contacts. Review an enquiry, read its scope/counts and effect on reporting, tick the acknowledgement and confirm permanent erasure. Cancel makes no changes. This selects an enquiry, not automatically every record sharing an email address. Review other matching enquiries when the request covers them too. The search shows up to 50 matches and asks for a narrower search if more exist.

The selected enquiry disappears from ordinary CRM views as soon as erasure is accepted. Its details, form answers, attribution, notes, activity, notifications and delivery rows are removed from the active D1 database. The operation waits for an earlier delivery attempt to finish or its lease to expire before reporting completion. Removing a connection disables it immediately but preserves any active delivery lease until it is safe to finish erasure. A request already sent to another system cannot be recalled by this CRM.

The result can be recovered after a lost response: retry the same operation, or reload Account and check Recent erasures. An expired or changed preview cannot authorize a new deletion. The UI offers a fresh review and acknowledgement when the record changed. The API can select up to 20 reviewed enquiry IDs per operation; the normal owner interface reviews individual enquiries.

**Remove contact remains a soft removal.** It preserves contact data and reporting. Permanent erasure removes the enquiry and its conversion link, so historical lead/conversion totals may decrease. Visit records have a separate retention period and can remain after an enquiry is erased. The dashboard describes the retained dataset and surfaces a history warning after cleanup. Do not call this a universal person-level erasure of every service, browser, export or backup.

## Retention settings

Expand Automatic retention, choose periods and scope, preview the current eligible counts, acknowledge and save. Empty periods are off. The periods are elapsed 24-hour days, evaluated in UTC. Changing an input invalidates the previous preview. Saving settings does not silently run a bulk purge; the existing scheduled task uses the saved policy, and the owner can request one cleanup batch.

| Setting | Age and scope | What remains |
| --- | --- | --- |
| Enquiries | Since removal in removed-only mode; since receipt in all-enquiries mode | Only the suppression/audit records described below; active enquiries are included only when all-enquiries mode is chosen |
| Notes and activity | Record creation time | Contact fields and current pipeline stage |
| Campaign and referrer details | Enquiry creation time | Contact fields and coarse channel/device categories used for reporting |
| Visit records | Visit creation time | Enquiries remain, with expired visit links/visitor hashes removed; legacy visit rows are cleaned too |
| Finished delivery records | Delivery-row creation time | Pending or actively leased deliveries are not purged by this period |

The five-minute scheduled task processes one configured category at a time, rotating between them. Each batch selects up to 20 enquiries or 200 records per other category/table. It also advances an accepted pending erasure and handles a bounded delivery batch. Large backlogs therefore take multiple runs. Turning scheduling off stops new automatic cleanup; it does not cancel an erasure already accepted. Durable settings survive redeployment.

The transaction design and bounded statements use the documented [D1 batch behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) and [D1 invocation/query limits](https://developers.cloudflare.com/d1/platform/limits/) (checked 17 September 2026). Local tests are not proof of capacity or delivery timing on a real Cloudflare account.

## Suppression record

Erasure retains a hash of the random submission key, an opaque enquiry ID and the time suppression began, plus operation counts, an opaque scope digest and completion state. It does **not** retain the contact payload or a contact-payload fingerprint. These records prevent a retry of an old submission from recreating the enquiry and allow an older backup to be cleaned before restoration. They are operational records, not a claim of universal anonymization. Do not remove them as ordinary contact-retention cleanup.

Use **Download erasure record** to export the complete current set. Pagination freezes its sequence boundary and record count; only a fully assembled export is marked complete. The record includes a persisted source database identity. A record from another modern source is rejected even if it has no overlapping enquiry IDs. Keep it privately, separately from older database backups. The browser export supports up to 100,000 entries and refuses to create a partial “complete” file if that limit is exceeded. Larger datasets need a private operator export and explicit capacity review.

## Older backups and other copies

Deletion from the active database does not immediately eliminate older SQL exports, downloaded CSVs, provider recovery history or data already delivered to optional integrations. Record the client's policy for these copies and their access/expiry. Cloudflare's recovery history is plan-dependent; its documented windows are currently seven days on Free and thirty on Paid, and restoring an earlier state does not remove earlier recovery points. See [Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/).

Before restoring an older backup:

1. Obtain the **latest complete erasure record** from the current owner controls and verify its date and client. If it is unavailable, do not describe the old backup as cleared for restored use.
2. Have the agent prepare a private cleaned copy:

   ```sh
   node scripts/backup.mjs verify --file .secrets/older-backup.sql \
     --erasure-records .secrets/latest-erasure-record.json \
     --clean-output .secrets/recovery-cleaned.sql
   ```

3. The helper imports only into its own temporary **local** D1, adds the data-lifecycle migration if needed, verifies both directions of the suppression-ID/submission-hash relationship, removes matched enquiries and their dependent records, revokes restored sessions, turns automatic retention off, disables connections and pauses old delivery jobs. It verifies foreign keys and exports a new private SQL file. The original database and backup are unchanged. An incomplete/conflicting record fails without publishing a cleaned result. For a pre-feature backup without a source identity, establish its client provenance first; only then add `--confirm-legacy-source` using that existing evidence. A modern identity mismatch cannot be overridden with this flag.
4. Use the **cleaned** file, not the original, for the separate recovery procedure in [admin-access-and-recovery.md](admin-access-and-recovery.md). Apply any other missing migrations, rotate owner access, verify a separate preview and confirm the exact production cutover only within the actual owner's authorization. Review retention and destination delivery state before enabling either again. Connections offers **Enable new deliveries** after review; that action does not restart previous paused/failed jobs.

The helper cannot prove that a supplied file is the newest record or authenticate its author. The owner/operator must establish that provenance. Its success proves local preparation and integrity; remote restore, actual provider recovery expiry and production cutover require their own evidence.
