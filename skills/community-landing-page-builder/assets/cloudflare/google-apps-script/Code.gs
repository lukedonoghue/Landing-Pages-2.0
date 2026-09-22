var CRM_CONNECTION_TOKEN = "__CRM_CONNECTION_TOKEN__";
var LEADS_SHEET = "Leads";
var ATTRIBUTION_SHEET = "Attribution";
var MAX_CELL_LENGTH = 49000;
var ATTRIBUTION_KEYS = [
  "source", "utm_source", "utm_medium", "utm_campaign", "utm_id",
  "utm_term", "utm_content", "utm_source_platform", "utm_creative_format",
  "utm_marketing_tactic", "gclid", "dclid", "gbraid", "wbraid",
  "fbclid", "msclkid", "ttclid", "landing_page", "referrer"
];

function doGet() {
  return jsonResponse({ ok: true, service: "crm-google-sheets", schema_version: 1 });
}

function doPost(e) {
  if (!e || !e.parameter || !constantTimeEqual(String(e.parameter.token || ""), CRM_CONNECTION_TOKEN)) {
    throw new Error("Unauthorized CRM connection.");
  }
  var envelope = JSON.parse(e.postData && e.postData.contents || "{}");
  if (envelope.event !== "lead.created" || !isEventId(envelope.event_id) || !isPlainObject(envelope.lead)) {
    throw new Error("Invalid CRM lead event.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var leads = ensureSheet(spreadsheet, LEADS_SHEET);
    if (hasEvent(leads, envelope.event_id)) return jsonResponse({ ok: true, event_id: envelope.event_id, duplicate: true });

    var lead = envelope.lead;
    var form = isPlainObject(lead.form_data) ? lead.form_data : {};
    var first = isPlainObject(lead.attribution) && isPlainObject(lead.attribution.first_touch) ? lead.attribution.first_touch : {};
    var latest = isPlainObject(lead.attribution) && isPlainObject(lead.attribution.latest_touch) ? lead.attribution.latest_touch : {};
    var dynamicFields = Object.keys(form).sort();
    var leadHeaders = [
      "Event ID", "Received at", "Lead ID", "Receipt ID", "Name", "Email", "Phone",
      "Form name", "CRM stage", "Landing page", "Referrer", "Traffic source",
      "Traffic type", "Device"
    ].concat(dynamicFields.map(function(name) { return "Form: " + name; }), ["Complete lead JSON"]);
    ensureHeaders(leads, leadHeaders);
    appendMappedRow(leads, leadHeaders, {
      "Event ID": envelope.event_id,
      "Received at": lead.created_at || envelope.created_at || "",
      "Lead ID": lead.id || "",
      "Receipt ID": lead.receipt_id || "",
      "Name": lead.name || "",
      "Email": lead.email || "",
      "Phone": lead.phone || "",
      "Form name": lead.form_name || "",
      "CRM stage": lead.status || "",
      "Landing page": lead.landing_page || "",
      "Referrer": lead.referrer || "",
      "Traffic source": lead.traffic_source || lead.source || "",
      "Traffic type": lead.traffic_type || "",
      "Device": lead.device || "",
      "Complete lead JSON": JSON.stringify(lead)
    }, form);

    var attribution = ensureSheet(spreadsheet, ATTRIBUTION_SHEET);
    var attributionHeaders = ["Event ID", "Received at", "Lead ID"];
    ATTRIBUTION_KEYS.forEach(function(key) { attributionHeaders.push("First: " + key); });
    ATTRIBUTION_KEYS.forEach(function(key) { attributionHeaders.push("Latest: " + key); });
    attributionHeaders.push("First touch JSON", "Latest touch JSON");
    ensureHeaders(attribution, attributionHeaders);
    var attributionValues = {
      "Event ID": envelope.event_id,
      "Received at": lead.created_at || envelope.created_at || "",
      "Lead ID": lead.id || "",
      "First touch JSON": JSON.stringify(first),
      "Latest touch JSON": JSON.stringify(latest)
    };
    ATTRIBUTION_KEYS.forEach(function(key) {
      attributionValues["First: " + key] = first[key] || "";
      attributionValues["Latest: " + key] = latest[key] || "";
    });
    appendMappedRow(attribution, attributionHeaders, attributionValues, {});
    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, event_id: envelope.event_id, duplicate: false });
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet(spreadsheet, name) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  return sheet;
}

function ensureHeaders(sheet, required) {
  var lastColumn = sheet.getLastColumn();
  var headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  required.forEach(function(header) {
    if (headers.indexOf(header) === -1) headers.push(header);
  });
  if (headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return headers;
}

function appendMappedRow(sheet, requiredHeaders, values, form) {
  var headers = ensureHeaders(sheet, requiredHeaders);
  var row = headers.map(function(header) {
    var value = Object.prototype.hasOwnProperty.call(values, header) ? values[header] : "";
    if (header.indexOf("Form: ") === 0) value = form[header.slice(6)];
    return safeCell(value);
  });
  sheet.appendRow(row);
}

function hasEvent(sheet, eventId) {
  if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return false;
  return Boolean(sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(eventId).matchEntireCell(true).findNext());
}

function safeCell(value) {
  if (value === null || value === undefined) return "";
  var text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (text.length > MAX_CELL_LENGTH) text = text.slice(0, MAX_CELL_LENGTH);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isEventId(value) {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  var difference = 0;
  for (var i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
