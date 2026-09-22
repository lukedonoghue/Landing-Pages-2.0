import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, mkdir, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));

class Sheet {
  constructor() { this.rows = []; this.frozen = 0; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((count, row) => Math.max(count, row.length), 0); }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows(count) { this.frozen = count; }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    const sheet = this;
    return {
      getValues() {
        return Array.from({ length: rowCount }, (_, rowOffset) => Array.from({ length: columnCount }, (_, columnOffset) => sheet.rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ''));
      },
      setValues(values) {
        values.forEach((source, rowOffset) => source.forEach((value, columnOffset) => {
          const target = row - 1 + rowOffset; sheet.rows[target] ||= []; sheet.rows[target][column - 1 + columnOffset] = value;
        }));
        return this;
      },
      setFontWeight() { return this; },
      createTextFinder(text) {
        return { matchEntireCell() { return this; }, findNext() {
          for (let index = row - 1; index < row - 1 + rowCount; index++) if (sheet.rows[index]?.[column - 1] === text) return { row: index + 1 };
          return null;
        } };
      }
    };
  }
}

function appsScriptRuntime(source) {
  const sheets = new Map();
  const spreadsheet = { getSheetByName: name => sheets.get(name) || null, insertSheet(name) { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; } };
  const context = {
    JSON,
    Object,
    Array,
    String,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput(text) { return { text, setMimeType() { return this; } }; } },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} }
  };
  vm.createContext(context); vm.runInContext(source, context);
  return { context, sheets };
}

test('Apps Script writes dynamic form data and complete first/latest attribution once per event', async () => {
  const template = await readFile(path.join(root, 'google-apps-script', 'Code.gs'), 'utf8');
  const { context, sheets } = appsScriptRuntime(template.replace('__CRM_CONNECTION_TOKEN__', 'private-token'));
  const event = {
    event: 'lead.created', event_id: 'a'.repeat(32), created_at: '2026-09-22T12:00:00Z',
    lead: {
      id: 'lead-1', receipt_id: 'receipt-1', created_at: '2026-09-22T12:00:00Z', name: 'Alex Example', email: 'alex@example.invalid', phone: '+61412345678', form_name: 'quote', status: 'new', landing_page: '/', referrer: '', traffic_source: 'google', traffic_type: 'paid', device: 'mobile',
      form_data: { email: 'alex@example.invalid', service: 'Consultation', budget: '=IMPORTXML("bad")' },
      attribution: { first_touch: { utm_source: 'google', utm_campaign: 'first', gclid: 'g-first' }, latest_touch: { utm_source: 'microsoft', utm_campaign: 'latest', msclkid: 'm-last' } }
    }
  };
  const request = { parameter: { token: 'private-token' }, postData: { contents: JSON.stringify(event) } };
  const first = JSON.parse(context.doPost(request).text); const second = JSON.parse(context.doPost(request).text);
  assert.deepEqual(first, { ok: true, event_id: event.event_id, duplicate: false });
  assert.deepEqual(second, { ok: true, event_id: event.event_id, duplicate: true });
  const leads = sheets.get('Leads'); const attribution = sheets.get('Attribution');
  assert.equal(leads.rows.length, 2); assert.equal(attribution.rows.length, 2);
  const lead = Object.fromEntries(leads.rows[0].map((header, index) => [header, leads.rows[1][index]]));
  const touch = Object.fromEntries(attribution.rows[0].map((header, index) => [header, attribution.rows[1][index]]));
  assert.equal(lead['Form: service'], 'Consultation'); assert.equal(lead['Form: budget'], "'=IMPORTXML(\"bad\")");
  assert.equal(JSON.parse(lead['Complete lead JSON']).receipt_id, 'receipt-1');
  assert.equal(touch['First: gclid'], 'g-first'); assert.equal(touch['Latest: msclkid'], 'm-last');
  assert.throws(() => context.doPost({ ...request, parameter: { token: 'wrong' } }), /Unauthorized/);
});

test('connector helper keeps tokens private and builds the exact Apps Script webhook URL', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'crm-sheets-'));
  await mkdir(path.join(temporary, 'scripts')); await mkdir(path.join(temporary, 'google-apps-script'));
  await cp(path.join(root, 'scripts', 'google-sheets-connector.mjs'), path.join(temporary, 'scripts', 'google-sheets-connector.mjs'));
  await cp(path.join(root, 'google-apps-script', 'Code.gs'), path.join(temporary, 'google-apps-script', 'Code.gs'));
  const prepared = spawnSync(process.execPath, ['scripts/google-sheets-connector.mjs', 'prepare'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(prepared.status, 0, prepared.stderr); assert.doesNotMatch(prepared.stdout, /[a-f0-9]{64}/);
  const privateCode = await readFile(path.join(temporary, '.secrets', 'google-sheets', 'Code.gs'), 'utf8');
  assert.doesNotMatch(privateCode, /__CRM_CONNECTION_TOKEN__/); assert.match(privateCode, /[a-f0-9]{64}/);
  const connected = spawnSync(process.execPath, ['scripts/google-sheets-connector.mjs', 'connect', '--web-app-url', 'https://script.google.com/macros/s/deployment_123/exec'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(connected.status, 0, connected.stderr); assert.doesNotMatch(connected.stdout, /token=/);
  const record = JSON.parse(await readFile(path.join(temporary, '.secrets', 'google-sheets', 'connection.json'), 'utf8'));
  assert.equal(record.status, 'ready'); assert.match(record.webhook_url, /^https:\/\/script\.google\.com\/macros\/s\/deployment_123\/exec\?token=[a-f0-9]{64}$/);
});
