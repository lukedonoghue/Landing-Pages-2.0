/* Standalone Google Apps Script. Secrets live in Script Properties, not this file.
 * CRM_CONNECTION_SECRET: derived connection key (64 hex), CRM_KEY_VERSION: integer,
 * CRM_SPREADSHEET_ID: client-owned spreadsheet ID. Do not share this script with sheet viewers.
 */
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(function(k) { return JSON.stringify(k) + ':' + canonical(value[k]); }).join(',') + '}';
  return JSON.stringify(value);
}
function constantEqual(a,b) { if (typeof a !== 'string' || typeof b !== 'string') return false; var diff=a.length^b.length; for(var i=0;i<Math.max(a.length,b.length);i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0; }
function jsonResponse(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return jsonResponse({ok:true,connector:'crm-sheets',protocol:1}); }
function signedMessage(e, properties) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length>131072) return null;
  var value; try { value=JSON.parse(e.postData.contents); } catch (_) { return null; }
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  var signature=value.signature; delete value.signature;
  var secret=properties.getProperty('CRM_CONNECTION_SECRET'), version=Number(properties.getProperty('CRM_KEY_VERSION')||'1');
  if (!/^[a-f0-9]{64}$/i.test(secret||'') || !/^[a-f0-9]{64}$/.test(signature||'') || value.key_version!==version || !Number.isSafeInteger(value.timestamp) || Math.abs(Math.floor(Date.now()/1000)-value.timestamp)>300) return null;
  var bytes=Utilities.computeHmacSha256Signature(String(value.timestamp)+'.'+canonical(value),secret,Utilities.Charset.UTF_8);
  var expected=bytes.map(function(b) {return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  if (!constantEqual(signature,expected) || !/^[a-f0-9-]{16,64}$/i.test(value.event_id||'')) return null;
  if (value.event==='connection.probe') return /^[a-f0-9-]{36}$/i.test(value.lead_id||'') ? value : null;
  if (value.event==='lead.erased') return /^[a-f0-9-]{36}$/i.test(value.lead_id||'') ? value : null;
  if (value.event==='lead.created' && value.lead && /^[a-f0-9-]{36}$/i.test(value.lead.id||'')) return value;
  return null;
}
function safeCell(value) {
  if (value===null || value===undefined) return '';
  var text=(typeof value==='object' ? JSON.stringify(value) : String(value)).slice(0,49000);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'"+text : text;
}
function getSheet(book,name,headers) {
  var sheet=book.getSheetByName(name)||book.insertSheet(name);
  if (!sheet.getLastRow()) sheet.appendRow(headers);
  return sheet;
}
function hasValue(sheet,column,value) {
  return sheet.getLastRow()>1 && !!sheet.getRange(2,column,sheet.getLastRow()-1,1).createTextFinder(value).matchEntireCell(true).useRegularExpression(false).findNext();
}
function eraseRows(sheet,leadId) {
  if (!sheet || sheet.getLastRow()<2) return;
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0], column=headers.indexOf('Lead ID')+1;
  if (!column) throw new Error('Missing Lead ID column');
  var matches=sheet.getRange(2,column,sheet.getLastRow()-1,1).createTextFinder(leadId).matchEntireCell(true).useRegularExpression(false).findAll();
  matches.map(function(cell){return cell.getRow();}).sort(function(a,b){return b-a;}).forEach(function(row){sheet.deleteRow(row);});
}
function doPost(e) {
  var properties=PropertiesService.getScriptProperties(), message=signedMessage(e,properties);
  if (!message) return jsonResponse({ok:false,retryable:false});
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(5000)) return jsonResponse({ok:false,retryable:true});
  try {
    var book=SpreadsheetApp.openById(properties.getProperty('CRM_SPREADSHEET_ID'));
    // Authenticated, read-only probe: never creates sheets, rows or tombstones.
    // It exposes two booleans for the caller's exact synthetic UUID, no PII.
    if (message.event==='connection.probe') {
      var existingLeads=book.getSheetByName('Leads'), existingErased=book.getSheetByName('_CRM Erased');
      var present=false;
      if (existingLeads && existingLeads.getLastRow()>1) {
        var probeHeaders=existingLeads.getRange(1,1,1,existingLeads.getLastColumn()).getValues()[0];
        var probeColumn=probeHeaders.indexOf('Lead ID')+1;
        if (!probeColumn) return jsonResponse({ok:false,retryable:false});
        present=hasValue(existingLeads,probeColumn,message.lead_id);
      }
      return jsonResponse({ok:true,event_id:message.event_id,protocol:2,key_version:Number(properties.getProperty('CRM_KEY_VERSION')||'1'),lead_present:present,erased:!!existingErased && hasValue(existingErased,1,message.lead_id)});
    }
    // Minimal opaque tombstones prevent a delayed creation request resurrecting erased data.
    var erased=getSheet(book,'_CRM Erased',['Lead ID']);
    if (message.event==='lead.erased') {
      if (!hasValue(erased,1,message.lead_id)) erased.appendRow([message.lead_id]);
      eraseRows(book.getSheetByName('Leads'),message.lead_id);
      eraseRows(book.getSheetByName('Attribution'),message.lead_id);
      SpreadsheetApp.flush();
      return jsonResponse({ok:true,event_id:message.event_id});
    }
    if (hasValue(erased,1,message.lead.id)) return jsonResponse({ok:true,event_id:message.event_id,erased:true});
    var fixed=['Event ID','Lead ID','Created at','Name','Email','Phone','Stage','Service'];
    var lead=message.lead, fields=lead.fields && typeof lead.fields==='object' && !Array.isArray(lead.fields) ? lead.fields : {};
    var keys=Object.keys(fields).filter(function(key){return /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key);}).sort();
    var sheet=getSheet(book,'Leads',fixed), headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    // A legacy sheet has incompatible/overbroad columns: fail closed, never silently repurpose it.
    if (fixed.some(function(h,i){return headers[i]!==h;})) return jsonResponse({ok:false,retryable:false});
    if (hasValue(sheet,1,message.event_id)) return jsonResponse({ok:true,event_id:message.event_id});
    keys.forEach(function(key){var label='Form: '+key;if(headers.indexOf(label)<0)headers.push(label);});
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    var row=[message.event_id,lead.id,lead.created_at,lead.name,lead.email,lead.phone,lead.status,lead.service];
    headers.slice(fixed.length).forEach(function(label){row.push(fields[label.slice(6)]);});
    sheet.appendRow(row.map(safeCell)); SpreadsheetApp.flush();
    return jsonResponse({ok:true,event_id:message.event_id});
  } catch (_) { return jsonResponse({ok:false,retryable:true}); }
  finally { lock.releaseLock(); }
}
