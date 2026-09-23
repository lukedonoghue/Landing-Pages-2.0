/** Apply a complete suppression record only inside backup.mjs's temporary local restore. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const keyHash=key=>createHash('sha256').update('erased-submission:'+key).digest('hex');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
export function validateErasureRecord(value){
  if(value?.schema_version!==1||value.complete!==true||!Array.isArray(value.entries)||value.entries.length>100000)throw new Error('Use a complete erasure record downloaded from the owner Data controls. Partial pages are not a restoration record.');
  if(!Number.isSafeInteger(value.entry_count)||value.entry_count!==value.entries.length||(value.next!==undefined&&value.next!==null))throw new Error('The erasure record is incomplete. Download all records through the owner controls.');
  if(!/^[a-f0-9]{32}$/.test(value.dataset_id||''))throw new Error('The erasure record needs its source database identity. Download a current complete record.');
  if(typeof value.generated_at!=='string'||!Number.isFinite(Date.parse(value.generated_at)))throw new Error('The erasure record needs its generation timestamp.');
  const ids=new Set(),keys=new Set();
  for(const entry of value.entries){
    if(!entry||!UUID.test(entry.lead_id||'')||!HASH.test(entry.key_hash||'')||typeof entry.erased_at!=='string'||!Number.isFinite(Date.parse(entry.erased_at)))throw new Error('Invalid suppression entry in the erasure record.');
    if(ids.has(entry.lead_id)||keys.has(entry.key_hash))throw new Error('Duplicate suppression entries in the erasure record.');
    ids.add(entry.lead_id);keys.add(entry.key_hash);
  }
  return value;
}
export function reconcileErasureRecord({recordFile,temporary,template,common,execute,confirmLegacySource=false}){
  let parsed;try{parsed=JSON.parse(readFileSync(recordFile,'utf8'));}catch{throw new Error('The erasure record is not readable JSON. Select a complete private export.');}
  const record=validateErasureRecord(parsed);
  if(!common.includes('--local')||common.includes('--remote'))throw new Error('Erasure reconciliation is restricted to the temporary LOCAL restore.');
  const query=sql=>{const output=execute(['d1','execute','RESTORE_DB',...common,'--command',sql,'--json']);try{return JSON.parse(output).flatMap(row=>row.results||[]);}catch{throw new Error('The local D1 verification result could not be read. No database contents are printed.');}};
  const sqlFile=path.join(temporary,'erasure-reconciliation.sql');
  const apply=sql=>{writeFileSync(sqlFile,sql,{mode:0o600});execute(['d1','execute','RESTORE_DB',...common,'--file',sqlFile,'--yes']);};
  const legacy=!query("SELECT name FROM sqlite_master WHERE type='table' AND name='erased_submissions'").length;
  if(legacy&&!confirmLegacySource)throw new Error('This backup predates source-bound erasure records. Verify its client provenance before using --confirm-legacy-source; no cleaned output was created.');
  if(legacy){
    // Support pre-feature backups without reapplying unrelated migrations.
    execute(['d1','execute','RESTORE_DB',...common,'--file',path.join(template,'migrations/0005_data_lifecycle.sql'),'--yes']);
    if(query("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").length)apply("INSERT INTO d1_migrations(name,applied_at) SELECT '0005_data_lifecycle.sql',datetime('now') WHERE NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name='0005_data_lifecycle.sql');");
  }
  if(legacy)apply(`UPDATE data_retention_policy SET dataset_id=${quote(record.dataset_id)} WHERE id=1;`);
  const source=query('SELECT dataset_id FROM data_retention_policy WHERE id=1')[0];
  if(source?.dataset_id!==record.dataset_id)throw new Error('The erasure record belongs to a different source database. No cleaned output was created.');
  for(let offset=0;offset<record.entries.length;offset+=200){
    const entries=record.entries.slice(offset,offset+200);
    // A restored suppression record is immutable. Conflicting identifiers are
    // not silently ignored, because they may indicate a wrong or damaged record.
    const old=query(`SELECT lead_id,key_hash FROM erased_submissions WHERE lead_id IN (${entries.map(entry=>quote(entry.lead_id)).join(',')}) OR key_hash IN (${entries.map(entry=>quote(entry.key_hash)).join(',')})`);
    for(const row of old)if(!entries.some(entry=>entry.lead_id===row.lead_id&&entry.key_hash===row.key_hash))throw new Error('Suppression identifiers conflict with this backup. Check the source record before restoring.');
    apply('INSERT OR IGNORE INTO erased_submissions(key_hash,lead_id,erased_at) VALUES '+entries.map(entry=>`(${quote(entry.key_hash)},${quote(entry.lead_id)},${quote(new Date(entry.erased_at).toISOString())})`).join(',')+';');
  }
  // Check the reverse relation too: an erased submission key must never remain
  // in a different restored enquiry just because a damaged record changed its ID.
  let cursor='';
  for(;;){
    const rows=query(`SELECT id,idempotency_key FROM leads WHERE id>${quote(cursor)} ORDER BY id LIMIT 1000`);
    if(!rows.length)break;
    const identities=new Map(rows.map(row=>[keyHash(row.idempotency_key),row.id]));
    const suppressed=query(`SELECT lead_id,key_hash FROM erased_submissions WHERE key_hash IN (${[...identities.keys()].map(quote).join(',')})`);
    if(suppressed.some(row=>identities.get(row.key_hash)!==row.lead_id))throw new Error('A suppressed submission key belongs to a different restored enquiry. Check the source record; no cleaned output was created.');
    cursor=rows.at(-1).id;
  }
  let erased=0;
  for(;;){
    const rows=query('SELECT l.id,l.idempotency_key,e.key_hash FROM leads l JOIN erased_submissions e ON e.lead_id=l.id ORDER BY l.id LIMIT 200');
    if(!rows.length)break;
    for(const row of rows)if(keyHash(row.idempotency_key)!==row.key_hash)throw new Error('The suppression record does not match this restored enquiry. Check that the backup and erasure record belong to the same client.');
    const selected=rows.map(row=>quote(row.id)).join(',');
    apply([...['webhook_outbox','notes','activity','lead_notifications','erasure_items'].map(table=>`DELETE FROM ${table} WHERE lead_id IN (${selected});`),`DELETE FROM leads WHERE id IN (${selected});`].join('\n'));
    erased+=rows.length;
  }
  // The isolated database has no live deliveries or sessions. A restored Worker
  // must not resume old login sessions or an outdated automatic deletion policy.
  apply("DELETE FROM sessions;\nUPDATE data_retention_policy SET enabled=0,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');\nUPDATE erasure_operations SET status='complete',completed_at=COALESCE(completed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE status='waiting' AND NOT EXISTS(SELECT 1 FROM erasure_items i WHERE i.operation_id=erasure_operations.id);\nUPDATE webhooks SET enabled=0;\nUPDATE webhook_outbox SET status='failed',locked_until=NULL,claim_token=NULL,last_error='Review destination and delivery state after restoration' WHERE status IN ('pending','sending');");
  // Backups may predate either feature. Never reactivate old one-use account
  // links or resume downstream deletion jobs merely by restoring the database.
  const restoredTables=new Set(query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('crm_account_actions','sheets_erasure_outbox')").map(row=>row.name));
  if(restoredTables.has('crm_account_actions'))apply("UPDATE crm_account_actions SET state='failed' WHERE used_at IS NULL;");
  if(restoredTables.has('sheets_erasure_outbox'))apply("UPDATE sheets_erasure_outbox SET status='failed',locked_until=NULL,claim_token=NULL,last_error='Review downstream deletion state after restoration' WHERE status IN ('pending','sending');");
  if(query('SELECT l.id FROM leads l JOIN erased_submissions e ON e.lead_id=l.id LIMIT 1').length)throw new Error('Suppressed enquiries remain in the temporary restore.');
  return {erased_enquiries:erased,record_entries:record.entries.length,record_generated_at:new Date(record.generated_at).toISOString(),automatic_retention:'disabled',connections:'disabled',old_delivery_queue:'paused',downstream_deletions:'paused_for_reconciliation',account_action_links:'invalidated',sessions:'revoked'};
}
