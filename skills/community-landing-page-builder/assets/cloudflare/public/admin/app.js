import { secureFetch } from './secure-fetch.js';
import { initSecurityPanel } from './security-panel.js';
import { initDataLifecyclePanel } from './data-lifecycle.js';
import { initAccountPanel } from './account.js';
import { initUsersPanel } from './users.js';
import { createDateRangePicker } from './date-range.js';
import { renderPerformanceChart } from './performance-chart.js';
import { initFreeUsage } from './free-usage.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DEFAULT_STAGES = [
  { id: 'new', label: 'New contact' }, { id: 'qualified', label: 'Qualified' },
  { id: 'engaged', label: 'Engaged' }, { id: 'follow_up', label: 'Follow-up' },
  { id: 'won', label: 'Won' }, { id: 'lost', label: 'Lost' }
];
const DEFAULT_FILTERS = { visitor_mode: 'unique', device: 'all', traffic: 'blended', source: 'all' };
const SOURCE_LABELS = {all:'All sources',google:'Google',facebook:'Facebook',instagram:'Instagram',microsoft:'Microsoft / Bing',direct:'Direct',other:'Other sources',unknown:'Unknown / historical'};
const state = { filters: {...DEFAULT_FILTERS}, leadSource: 'all', chartMode: 'count', view: 'overview', stages: DEFAULT_STAGES, timezone: 'UTC', leads: [], total: 0, page: 1, limit: 100, q: '', status: '', pending: new Set(), listRequest: 0, metricRequest: 0, detailRequest: 0, detail: null, metricDays: [], user: null, permissions: { manage_users: false, edit_leads: false, export_leads: false, manage_settings: false } };
let toastTimer;
let rangePicker;
let confirmAction;
let accountPanel;
let dataPanel;
let usersPanel;
let usageMonitor;

function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function button(text, className, handler) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}
function empty(node) { node.replaceChildren(); return node; }
function message(error) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
async function api(path, options = {}) {
  let response;
  try {
    response = await secureFetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  } catch { throw new Error('Unable to connect. Check your connection and try again.'); }
  if (response.status === 401) {
    window.location.assign('/login.html');
    throw new Error('Your session has ended. Please sign in again.');
  }
  let data = {};
  if (response.status !== 204) {
    try { data = await response.json(); }
    catch { throw new Error('The server returned an unreadable response. Please try again.'); }
  }
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
function toast(text, isError = false) {
  clearTimeout(toastTimer);
  const node = $('#toast');
  node.textContent = text;
  node.classList.toggle('error', isError);
  node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, 5500);
}
function report(node, text, retry) {
  empty(node); node.hidden = false; node.classList.add('error');
  node.append(element('span', '', text));
  if (retry) node.append(button('Try again', 'button secondary', retry));
}
function loading(node, text) { node.classList.remove('error'); node.textContent = text; node.hidden = false; }
function markUpdated() { $('#last-updated').textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`; }
function dateLabel(value, full = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...(full ? { year: 'numeric', hour: 'numeric', minute: '2-digit' } : {}), timeZone: state.timezone }).format(date);
}
function calendarLabel(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date) : String(value);
}
function stageLabel(id) { return state.stages.find(stage => stage.id === id)?.label || id || 'New contact'; }
function leadName(lead) { return lead.name || lead.email || 'Unnamed enquiry'; }
function sourceName(lead) {
  const touches = asObject(lead.attribution), latest = asObject(touches.latest_touch), first = asObject(touches.first_touch);
  const touch = Object.keys(latest).length ? latest : first;
  const raw = String(lead.traffic_source || touch.utm_source || lead.utm_source || lead.source || 'unknown').toLowerCase();
  let source = ({bing:'microsoft',fb:'facebook',ig:'instagram',meta:'facebook'})[raw] || raw;
  if (source === 'other' && (touch.ttclid || String(touch.utm_source || '').toLowerCase().replace(/\s/g, '') === 'tiktok')) source = 'tiktok';
  const name = ({google:'Google',microsoft:'Microsoft',facebook:'Meta',instagram:'Instagram',tiktok:'TikTok',direct:'Direct',email:'Email',other:'Other',unknown:'Unknown'})[source] || 'Other';
  const medium = String(touch.utm_medium || lead.utm_medium || '').toLowerCase().replace(/[\s_-]/g, '');
  if (source === 'direct') return name;
  if (lead.traffic_type === 'organic' || (lead.traffic_type !== 'paid' && ['organic','organicsearch','organicsocial'].includes(medium))) return `${name} Organic`;
  if (['facebook','instagram','tiktok'].includes(source) && (lead.traffic_type === 'paid' || ['paidsocial','cpc','ppc','cpm'].includes(medium))) return `${name} Paid Social`;
  if (['cpc','ppc'].includes(medium)) return `${name} CPC`;
  if (medium === 'paidsearch') return `${name} Paid Search`;
  if (medium === 'display') return `${name} Display`;
  if (lead.traffic_type === 'paid') return `${name} Paid`;
  if (medium === 'referral') return `${name} Referral`;
  return name;
}
function integer(value) { return Number(value || 0).toLocaleString(); }
function percentage(numerator, denominator) { return Number(denominator) > 0 ? `${(Number(numerator || 0) / Number(denominator) * 100).toFixed(1)}%` : '-'; }
function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : {}; } catch {} }
  return {};
}
function displayValue(value) { return typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value ?? '-'); }
function can(permission) { return state.permissions[permission] === true; }
function applySession(session) {
  if (!session?.authenticated) throw new Error('Your session has ended. Please sign in again.');
  if (!session.user) {
    state.user = { id: 'owner', username: 'owner', role: 'admin' };
    state.permissions = { manage_users: true, edit_leads: true, export_leads: true, manage_settings: true };
    return;
  }
  state.user = session.user;
  state.permissions = Object.fromEntries(['manage_users', 'edit_leads', 'export_leads', 'manage_settings'].map(key => [key, session.permissions?.[key] === true]));
}
function allowedView(view) {
  if (view === 'users') return can('manage_users');
  if (view === 'connections') return can('manage_settings');
  return Boolean(viewCopy[view]);
}

const viewCopy = {
  overview: ['A clear view of your growth.', 'See who arrives, who enquires, and what happens next.'],
  pipeline: ['Every enquiry. A next step.', 'Move conversations forward, from first contact to a new customer.'],
  leads: ['Your conversations, together.', 'Find an enquiry, review the details, and pick up where you left off.'],
  account: ['Your workspace, securely managed.', 'Manage your password, sessions and new-enquiry alerts.'],
  connections: ['A little less busywork.', 'Connect your enquiries to the tools your team already uses.'],
  users: ['The right access for every person.', 'Invite colleagues, assign roles, and review account recovery requests.']
};
function showView(view) {
  if (!allowedView(view)) view = 'overview';
  rangePicker?.close();
  closeFilters();
  state.view = view;
  $$('.nav-item').forEach(item => {
    const active = item.dataset.view === view;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  $('#page-title').textContent = viewCopy[view][0];
  $('#page-description').textContent = viewCopy[view][1];
  $('#overview-panel').hidden = view !== 'overview';
  $('#leads-panel').hidden = !['pipeline', 'leads'].includes(view);
  $('#connections-panel').hidden = view !== 'connections';
  $('#users-panel').hidden = view !== 'users';
  $('#account-panel').hidden = view !== 'account';
  $('#board-hint').hidden = view !== 'pipeline' || !can('edit_leads');
  history.replaceState(null, '', `#${view}`);
  if (view === 'overview') loadMetrics();
  else if (view === 'connections') loadWebhooks();
  else if (view === 'users') usersPanel?.refresh();
  else if (view === 'account') accountPanel?.refreshNotifications();
  else loadLeads();
}

function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: state.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
async function loadMetrics() {
  const request = ++state.metricRequest;
  const status = $('#metrics-status');
  const from = $('#date-from').value; const to = $('#date-to').value;
  if (!from || !to || from > to) { report(status, 'Choose a start date on or before the end date.'); return; }
  loading(status, 'Loading performance…');
  $('#metric-cards').hidden = true; $('#metrics-content').hidden = true;
  try {
    const data = await api(`/api/admin/metrics?${new URLSearchParams({ from, to, ...state.filters })}`);
    if (request !== state.metricRequest) return;
    const totals = data.totals || {}; const days = data.days || [];
    const allVisits = state.filters.visitor_mode === 'all';
    const lifetime = data.lifetime_totals;
    const coverage = [...new Set([...(data.warnings || []), ...(data.coverage?.warnings || [])])];
    $('#metric-coverage').textContent = coverage.join(' '); $('#metric-coverage').hidden = !coverage.length;
    const metrics = [
      ['Visitors', integer(totals.visitors), allVisits ? 'All measured visits, including repeat visits' : 'Daily unique browsers, added across the range', 'visitors'],
      ['Conversions', integer(totals.conversions), allVisits ? 'Visits that produced an accepted enquiry' : 'Measured browsers that sent an enquiry', 'conversions'],
      ['Conversion rate', percentage(totals.conversions, totals.visitors), allVisits ? 'Converted visits ÷ measured visits' : 'Converted visitors ÷ measured visitors', 'rate'],
      ['Enquiries', integer(totals.leads), 'Saved leads matching the selected filters', 'leads']
    ];
    const cards = empty($('#metric-cards'));
    metrics.forEach(([label, value, note, key]) => {
      const card = element('article', 'metric-card');
      const number = element('p', 'metric-value', value);
      if (lifetime) number.append(element('small','metric-lifetime',`${key==='rate' ? percentage(lifetime.conversions,lifetime.visitors) : integer(lifetime[key])} all time`));
      card.append(element('h2', 'metric-label', label), number, element('p', 'metric-note', note)); cards.append(card);
    });
    state.metricDays = days; renderDailyTable(days, totals);
    const definition = typeof data.definition === 'string' ? data.definition : 'Visitors are measured daily unique browsers. Converted visitors are those with a saved enquiry linked to a measured visit on that day. Enquiries count all saved leads. The range rate uses the totals, not an average of daily rates. Tracking blockers, consent choices, and visitors returning on different days affect these counts.';
    $('#metric-definition').textContent = `${definition} Reporting timezone: ${data.timezone || state.timezone}.`;
    cards.hidden = false; $('#metrics-content').hidden = false; renderChart(days); status.hidden = true; markUpdated();
  } catch (error) { if (request === state.metricRequest) report(status, message(error), loadMetrics); }
}
function renderChart(days) {
  const legend = empty($('#performance-legend'));
  if (state.chartMode === 'count') {
    for (const [label, cls] of [['Visitors','visitor-key'],['Conversions','conversion-key']]) {
      const item = element('span'); item.append(element('i',cls),document.createTextNode(label)); legend.append(item);
    }
  } else { const item = element('span'); item.append(element('i','conversion-key'),document.createTextNode('Conversion rate')); legend.append(item); }
  renderPerformanceChart($('#activity-chart'), days, {mode:state.chartMode, visitorLabel:state.filters.visitor_mode==='all' ? 'Visits' : 'Unique visitors'});
}
function renderDailyTable(days, totals) {
  const table = element('table', 'daily-table');
  const caption = element('caption', 'sr-only', 'Daily traffic and lead conversion, with totals for the selected range'); table.append(caption);
  const thead = element('thead'); const heading = element('tr');
  ['Metric', 'Total', ...days.map(day => calendarLabel(day.date))].forEach((label, index) => { const th = element('th', index === 1 ? 'total-cell' : '', label); th.scope = 'col'; heading.append(th); });
  thead.append(heading); table.append(thead);
  const body = element('tbody');
  [['Visitors', 'visitors'], ['Conversions', 'conversions'], ['Conversion rate', 'rate'], ['Enquiries', 'leads']].forEach(([label, key]) => {
    const row = element('tr'); const th = element('th', '', label); th.scope = 'row'; row.append(th);
    [totals, ...days].forEach((day, index) => row.append(element('td', index === 0 ? 'total-cell' : '', key === 'rate' ? percentage(day.conversions, day.visitors) : integer(day[key]))));
    body.append(row);
  });
  table.append(body); empty($('#daily-table')).append(table);
}

async function loadLeads() {
  accountPanel?.setExportParams(new URLSearchParams({q:state.q,status:state.status,source:state.leadSource}));
  const request = ++state.listRequest;
  const status = $('#leads-status');
  loading(status, 'Loading enquiries…'); $('#leads-panel').setAttribute('aria-busy', 'true');
  $('#pipeline-board').hidden = true; $('#lead-table').hidden = true; $('#pagination').hidden = true;
  try {
    const data = await api(`/api/admin/leads?${new URLSearchParams({ q: state.q, status: state.status, source: state.leadSource, page: String(state.page), limit: String(state.limit) })}`);
    if (request !== state.listRequest) return;
    state.leads = data.leads || []; state.total = Number(data.total || 0); state.page = Number(data.page || state.page); state.limit = Number(data.limit || state.limit);
    if (!state.leads.length && state.total > 0 && state.page > 1) { state.page -= 1; return loadLeads(); }
    renderLeads(); status.hidden = true; markUpdated();
  } catch (error) { if (request === state.listRequest) report(status, message(error), loadLeads); }
  finally { if (request === state.listRequest) $('#leads-panel').removeAttribute('aria-busy'); }
}
function renderLeads() {
  const first = state.total ? (state.page - 1) * state.limit + 1 : 0;
  const last = Math.min(state.page * state.limit, state.total);
  $('#lead-count').textContent = state.total ? `Showing ${integer(first)}-${integer(last)} of ${integer(state.total)} enquiries${state.view === 'pipeline' && state.total > state.limit ? '. Board counts reflect this page.' : ''}` : (state.q || state.status || state.leadSource!=='all' ? 'No enquiries match these filters.' : 'No enquiries yet. Your first submission will appear here.');
  renderBoard(); renderLeadTable();
  $('#pipeline-board').hidden = state.view !== 'pipeline'; $('#lead-table').hidden = state.view !== 'leads';
  $('#pagination').hidden = state.total <= state.limit;
  $('#previous-page').disabled = state.page <= 1; $('#next-page').disabled = state.page * state.limit >= state.total;
  $('#page-number').textContent = `Page ${state.page} of ${Math.max(1, Math.ceil(state.total / state.limit))}`;
}
function stageSelect(lead, className = '') {
  const select = element('select', className);
  select.setAttribute('aria-label', `Stage for ${leadName(lead)}`);
  state.stages.forEach(stage => { const option = element('option', '', stage.label); option.value = stage.id; select.append(option); });
  select.value = lead.status || 'new'; select.disabled = !can('edit_leads') || state.pending.has(String(lead.id));
  select.dataset.leadStage = String(lead.id);
  if (can('edit_leads')) select.addEventListener('change', () => changeStage(lead, select.value, select));
  return select;
}
function renderBoard() {
  const board = empty($('#pipeline-board'));
  state.stages.forEach(stage => {
    const leads = state.leads.filter(lead => lead.status === stage.id);
    const column = element('section', `stage-column stage-${stage.id}`); column.dataset.stage = stage.id;
    const header = element('div', 'stage-header'); const title = element('h2', 'stage-title');
    title.append(element('span', 'stage-indicator'), document.createTextNode(stage.label));
    header.append(title, element('span', 'stage-count', leads.length)); column.append(header);
    if (!leads.length) column.append(element('p', 'empty-column', `No enquiries in ${stage.label.toLowerCase()}.`));
    leads.forEach(lead => {
      const card = element('article', 'lead-card'); card.draggable = can('edit_leads') && !state.pending.has(String(lead.id)); card.dataset.leadId = lead.id;
      const top = element('div', 'lead-card-top'); const avatar = element('span', 'avatar', leadName(lead).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()); avatar.setAttribute('aria-hidden', 'true');
      const text = element('div');
      const open = button(leadName(lead), 'lead-name', event => openLead(lead.id, event.currentTarget)); open.dataset.openLead = String(lead.id);
      text.append(open, element('p', 'lead-email', lead.email || lead.phone || 'Contact details in enquiry'));
      top.append(avatar, text); card.append(top);
      const meta = element('div', 'lead-card-meta'); meta.append(element('span', 'source-tag', sourceName(lead)), element('time', '', dateLabel(lead.created_at))); card.append(meta, stageSelect(lead, 'card-stage'));
      if (can('edit_leads')) {
        card.addEventListener('dragstart', event => {
          if (event.target.closest('select') || state.pending.has(String(lead.id))) { event.preventDefault(); return; }
          event.dataTransfer.setData('text/plain', String(lead.id)); event.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => { card.classList.remove('dragging'); $$('.stage-column').forEach(node => node.classList.remove('drag-over')); });
      }
      column.append(card);
    });
    if (can('edit_leads')) {
      column.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; column.classList.add('drag-over'); });
      column.addEventListener('dragleave', event => { if (!column.contains(event.relatedTarget)) column.classList.remove('drag-over'); });
      column.addEventListener('drop', event => {
        event.preventDefault(); column.classList.remove('drag-over');
        const id = event.dataTransfer.getData('text/plain'); const lead = state.leads.find(item => String(item.id) === id);
        if (lead && lead.status !== stage.id) changeStage(lead, stage.id);
      });
    }
    board.append(column);
  });
}
function renderLeadTable() {
  const root = empty($('#lead-table')); const table = element('table', 'lead-table');
  const caption = element('caption', 'sr-only', 'Enquiries matching the selected search and stage'); table.append(caption);
  const head = element('thead'); const row = element('tr');
  ['Contact', 'Phone', 'Stage', 'Source', 'Received'].forEach(label => { const th = element('th', '', label); th.scope = 'col'; row.append(th); }); head.append(row); table.append(head);
  const body = element('tbody');
  state.leads.forEach(lead => {
    const tr = element('tr'); const name = element('td');
    const open = button(leadName(lead), 'text-button', event => openLead(lead.id, event.currentTarget)); open.dataset.openLead = String(lead.id);
    name.append(open, element('p', 'table-email', lead.email));
    const stage = element('td'); stage.append(stageSelect(lead, 'card-stage'));
    const source = element('td', '', sourceName(lead));
    tr.append(name, element('td', '', lead.phone || '-'), stage, source, element('td', '', dateLabel(lead.created_at, true))); body.append(tr);
  });
  if (!state.leads.length) { const tr = element('tr'); const td = element('td', 'muted', state.q || state.status || state.leadSource!=='all' ? 'Try another search, stage, or source.' : 'Enquiries will appear when someone submits your form.'); td.colSpan = 5; tr.append(td); body.append(tr); }
  table.append(body); root.append(table);
}
async function changeStage(lead, status, control) {
  if (!can('edit_leads')) return;
  const id = String(lead.id); const previous = lead.status;
  if (previous === status || state.pending.has(id)) return;
  state.pending.add(id);
  $$('[data-lead-stage]').filter(node => node.dataset.leadStage === id).forEach(node => { node.disabled = true; });
  $('#global-error').hidden = true;
  if ($('#detail-error')) $('#detail-error').textContent = '';
  try {
    const data = await api(`/api/admin/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, version: lead.version }) });
    if (!data.lead || String(data.lead.id)!==id || data.lead.status!==status || !Number.isInteger(data.lead.version) || data.lead.version <= Number(lead.version)) throw new Error('The server did not confirm the saved stage. Refresh to check its current state.');
    const updated = data.lead;
    Object.assign(lead, updated);
    toast(`${leadName(lead)} moved to ${stageLabel(status)}.`);
    if ($('#lead-dialog').open && String(state.detail?.lead?.id) === id) await openLead(id);
    await loadLeads();
  } catch (error) {
    if (control?.isConnected) control.value = previous;
    if (error.status === 409) {
      report($('#global-error'), 'This enquiry changed in another session. The latest version has been loaded; choose its stage again.');
      await loadLeads();
      if ($('#lead-dialog').open && String(state.detail?.lead?.id) === id) {
        await openLead(id);
        if ($('#detail-error')) $('#detail-error').textContent = 'This enquiry changed in another session. Its latest version is shown; choose the stage again.';
      }
    } else {
      report($('#global-error'), `Stage was not saved. ${message(error)}`);
      if ($('#detail-error')) $('#detail-error').textContent = `Stage was not saved. ${message(error)}`;
    }
  } finally {
    state.pending.delete(id);
    $$('[data-lead-stage]').filter(node => node.dataset.leadStage === id).forEach(node => { node.disabled = !can('edit_leads'); });
    $$('.lead-card').filter(node => node.dataset.leadId === id).forEach(node => { node.draggable = can('edit_leads'); });
    if (control && !$('#lead-dialog').open) {
      const panel = state.view === 'pipeline' ? $('#pipeline-board') : $('#lead-table');
      const replacement = $$('[data-lead-stage]', panel).find(node => node.dataset.leadStage === id);
      if (replacement) replacement.focus({ preventScroll: true });
    }
  }
}

const dialogTriggers = new WeakMap();
function openDialog(dialog, trigger) {
  if (!dialog.open) { dialogTriggers.set(dialog, trigger || document.activeElement); dialog.showModal(); }
}
function closeDialog(dialog) { dialog.close(); }
function isDialogBackdropPointer(dialog, event) {
  const bounds = dialog.getBoundingClientRect();
  return event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
}
$$('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    const trigger = dialogTriggers.get(dialog);
    if (trigger?.isConnected) { trigger.focus({ preventScroll: true }); return; }
    const replacement = $$('[data-open-lead]').find(node => node.dataset.openLead === trigger?.dataset?.openLead && node.getClientRects().length);
    (replacement || $('.nav-item.active'))?.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const nodes = $$('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]', dialog).filter(node => node.getClientRects().length);
    if (!nodes.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
  });
});
const leadDialog = $('#lead-dialog');
let leadBackdropPointerStarted = false;
leadDialog.addEventListener('pointerdown', event => {
  leadBackdropPointerStarted = event.isPrimary && event.button === 0 && isDialogBackdropPointer(leadDialog, event);
});
leadDialog.addEventListener('pointercancel', () => { leadBackdropPointerStarted = false; });
leadDialog.addEventListener('click', event => {
  const closeFromBackdrop = leadBackdropPointerStarted && isDialogBackdropPointer(leadDialog, event);
  leadBackdropPointerStarted = false;
  if (closeFromBackdrop) closeDialog(leadDialog);
});
leadDialog.addEventListener('close', () => { leadBackdropPointerStarted = false; state.detailRequest += 1; state.detail = null; });
async function openLead(id, trigger) {
  const request = ++state.detailRequest;
  const dialog = $('#lead-dialog'); const content = empty($('#detail-content'));
  $('#detail-title').textContent = 'Loading enquiry…'; content.append(element('p', 'notice', 'Loading contact details…')); openDialog(dialog, trigger);
  try {
    const data = await api(`/api/admin/leads/${encodeURIComponent(id)}`);
    if (request !== state.detailRequest || !dialog.open) return;
    state.detail = data; renderDetail(data);
  } catch (error) { if (request === state.detailRequest) { $('#detail-title').textContent = 'Enquiry unavailable'; empty(content).append(element('p', 'notice error', message(error)), button('Try again', 'button secondary', () => openLead(id))); } }
}
function detailsFields(entries) {
  const dl = element('dl', 'detail-fields');
  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    const item = element('div'); item.append(element('dt', '', key), element('dd', '', displayValue(value))); dl.append(item);
  });
  return dl;
}
function detailSection(title, content) { const section = element('section', 'detail-section'); section.append(element('h3', '', title), content); return section; }
function renderDetail(data) {
  const lead = data.lead; const root = empty($('#detail-content')); $('#detail-title').textContent = leadName(lead);
  const stageRow = element('div', 'detail-inline'); const stage = stageSelect(lead); stage.id = 'detail-stage'; const label = element('label', '', 'Current stage'); label.htmlFor = stage.id; stageRow.append(label, stage);
  const error = element('p', 'inline-error'); error.id = 'detail-error'; error.setAttribute('role', 'alert');
  root.append(stageRow, error, element('p', 'detail-submitted', `Received ${dateLabel(lead.created_at, true)}`));
  root.append(detailSection('Contact', detailsFields([['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone]])));
  const fields = asObject(lead.form_data);
  if (Object.keys(fields).length) root.append(detailSection('Enquiry details', detailsFields(Object.entries(fields).map(([key, value]) => [key.replace(/[_-]/g, ' '), value]))));
  const attribution = asObject(lead.attribution);
  const flatAttribution = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic', 'gclid', 'dclid', 'gbraid', 'wbraid','fbclid','msclkid','ttclid'].map(key => [key, lead[key]]).filter(([, value]) => value);
  const attributionContent = element('div');
  attributionContent.append(detailsFields([['Source', sourceName(lead)], ['Device', lead.device], ['Landing page', lead.landing_page], ['Referrer', lead.referrer]]));
  const groups = [['First touch', asObject(attribution.first_touch)], ['Latest touch', asObject(attribution.latest_touch)]];
  const hasTouches = groups.some(([, touch]) => Object.keys(touch).length);
  if (!hasTouches && flatAttribution.length) groups.push(['Recorded campaign', Object.fromEntries(flatAttribution)]);
  for (const [label, touch] of groups) {
    if (!Object.keys(touch).length) continue;
    const group = element('details', 'attribution-group');
    group.append(element('summary', '', label), detailsFields(Object.entries(touch))); attributionContent.append(group);
  }
  if (!flatAttribution.length && !hasTouches) attributionContent.append(element('p', 'muted small', 'No campaign attribution was recorded for this enquiry.'));
  root.append(detailSection('Attribution', attributionContent));
  const notes = element('div'); const list = element('ul', 'note-list');
  (data.notes || []).forEach(note => { const li = element('li'); li.append(element('p', '', note.body), element('time', '', dateLabel(note.created_at, true))); list.append(li); });
  notes.append(list);
  if (!data.notes?.length) notes.append(element('p', 'muted small', can('edit_leads') ? 'No notes yet. Add context for your next conversation.' : 'No notes have been recorded.'));
  if (can('edit_leads')) {
    const form = element('form', 'note-form'); const noteLabel = element('label', '', 'Add a note'); noteLabel.htmlFor = 'new-note';
    const textarea = element('textarea'); textarea.id = 'new-note'; textarea.name = 'body'; textarea.required = true; textarea.maxLength = 4000; textarea.placeholder = 'What should you remember about this enquiry?'; textarea.setAttribute('aria-describedby', 'note-error');
    const noteError = element('p', 'inline-error'); noteError.id = 'note-error'; noteError.setAttribute('role', 'alert');
    const submit = element('button', 'button primary', 'Save note'); submit.type = 'submit'; form.append(noteLabel, textarea, noteError, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!textarea.value.trim()) { noteError.textContent = 'Write a note before saving.'; textarea.focus(); return; }
      submit.disabled = true; submit.textContent = 'Saving…'; noteError.textContent = '';
      try {
        await api(`/api/admin/leads/${encodeURIComponent(lead.id)}/notes`, { method: 'POST', body: JSON.stringify({ body: textarea.value.trim() }) });
        toast('Note saved.');
        if ($('#lead-dialog').open && String(state.detail?.lead?.id) === String(lead.id)) { await openLead(lead.id); $('#new-note')?.focus(); }
      } catch (error) { noteError.textContent = message(error); submit.disabled = false; submit.textContent = 'Save note'; }
    });
    notes.append(form);
  }
  root.append(detailSection('Conversation notes', notes));
  const history = element('ul', 'activity-list');
  (data.activity || []).forEach(item => {
    const text = item.description || (item.to_status ? `${item.from_status ? `${stageLabel(item.from_status)} → ` : ''}${stageLabel(item.to_status)}` : String(item.event_type || item.action || 'Enquiry updated').replace(/[_-]/g, ' '));
    const li = element('li'); li.append(element('p', '', text), element('time', '', dateLabel(item.created_at, true))); history.append(li);
  });
  if (!data.activity?.length) history.append(element('li', 'muted', 'No activity recorded yet.'));
  root.append(detailSection('Activity', history));
  const bottom = element('div', 'detail-bottom'); bottom.append(element('span', 'muted small', `Enquiry ${lead.id}`));
  if (can('edit_leads')) {
    bottom.append(button('Remove contact', 'text-button', event => confirmRemoval('Remove this contact?', `Remove ${leadName(lead)} from the CRM? Historical reporting is retained.`, 'Remove contact', async () => {
      await api(`/api/admin/leads/${encodeURIComponent(lead.id)}`, { method: 'DELETE' }); closeDialog($('#lead-dialog')); toast('Contact removed.'); await loadLeads();
    }, event.currentTarget)));
    if (dataPanel) bottom.append(button('Review permanent erasure','text-button',()=>{closeDialog($('#lead-dialog'));showView('account');dataPanel.reviewErasure([lead.id]);}));
  }
  root.append(bottom);
}
function confirmRemoval(title, description, actionLabel, action, trigger) {
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description; $('#accept-confirm').textContent = actionLabel; $('#confirm-error').textContent = ''; confirmAction = action; openDialog($('#confirm-dialog'), trigger); $('#cancel-confirm').focus();
}

let webhookRequest = 0;
async function loadWebhooks() {
  if (!can('manage_settings')) return;
  const request = ++webhookRequest; const status = $('#webhooks-status'); loading(status, 'Loading connections…'); empty($('#webhooks-list'));
  try {
    const data = await api('/api/admin/webhooks'); if (request !== webhookRequest) return;
    const list = $('#webhooks-list');
    (data.webhooks || []).forEach(hook => {
      const card = element('article', 'webhook-card'); card.append(element('h3', '', hook.name), element('p', 'webhook-url', hook.url));
      const meta = element('div', 'webhook-meta');
      meta.append(element('span', '', hook.enabled ? 'Enabled' : 'Disabled'), element('span', '', `${integer(hook.pending_count)} pending`), element('span', '', `${integer(hook.failed_count)} failed`));
      if (hook.last_delivered_at) meta.append(element('span', '', `Last delivered ${dateLabel(hook.last_delivered_at, true)}`)); card.append(meta);
      if(!hook.enabled)card.append(button('Enable new deliveries','button secondary',event=>confirmRemoval('Enable this connection?',`Send future enquiries to ${hook.name}? Previous paused or failed deliveries will remain stopped.`,'Enable new deliveries',async()=>{await api(`/api/admin/webhooks/${encodeURIComponent(hook.id)}`,{method:'PATCH',body:JSON.stringify({enabled:true})});toast('New deliveries enabled. Previous jobs were not restarted.');await loadWebhooks();},event.currentTarget)));
      if(hook.url.startsWith('https://script.google.com/macros/s/')){
        const label=element('label','','Prepared Sheets key version'),version=element('input');
        version.type='number';version.min=String((hook.sheets_key_version||1)+1);version.value=version.min;version.step='1';version.setAttribute('aria-label','Prepared Sheets key version');label.append(version);card.append(label);
        card.append(button('Activate prepared key','button secondary',event=>{
          const value=Number(version.value);if(!Number.isSafeInteger(value)||value<Number(version.min)){version.reportValidity();return;}
          confirmRemoval('Activate the prepared Sheets key?','First run sheets:rotate in a trusted operator terminal and update the standalone script properties. This does not generate or display a secret here. Failed signed deliveries will be retried.','Activate prepared key',async()=>{const result=await api(`/api/admin/webhooks/${encodeURIComponent(hook.id)}`,{method:'PATCH',body:JSON.stringify({sheets_key_version:value})});toast(`Sheets key version ${result.key_version} active.`);await loadWebhooks();},event.currentTarget);
        }));
      }
      card.append(button('Remove connection', 'text-button', event => confirmRemoval('Remove this connection?', `Stop sending new enquiries to ${hook.name}? Leads already saved in your CRM will remain.`, 'Remove connection', async () => {
        const removed=await api(`/api/admin/webhooks/${encodeURIComponent(hook.id)}`, { method: 'DELETE' }); toast(removed.finishing_deliveries?'Connection removed. An earlier delivery may still finish.':'Connection removed.'); await loadWebhooks();
      }, event.currentTarget))); list.append(card);
    });
    if (!data.webhooks?.length) list.append(element('p', 'webhooks-empty', 'No connections yet. Add a webhook to send new enquiries to another tool.'));
    status.hidden = true; markUpdated();
  } catch (error) { if (request === webhookRequest) report(status, message(error), loadWebhooks); }
}

function updateFilters() {
  $$('[data-filter]').forEach(control => control.setAttribute('aria-pressed', String(state.filters[control.dataset.filter] === control.dataset.value)));
  $('#traffic-source').value = state.filters.source;
  const count = Object.keys(DEFAULT_FILTERS).filter(key => state.filters[key] !== DEFAULT_FILTERS[key]).length;
  $('#filter-count').textContent = String(count); $('#filter-count').hidden = count === 0;
  $('#filter-summary').textContent = [state.filters.visitor_mode === 'all' ? 'All visits' : 'Unique visitors', {all:'All devices',desktop:'Desktop',mobile:'Mobile'}[state.filters.device], {blended:'Blended traffic',paid:'Paid traffic',organic:'Organic traffic'}[state.filters.traffic], SOURCE_LABELS[state.filters.source]].join(' · ');
}
function closeFilters(restore = false) {
  const panel = $('#filter-popover'); if (!panel || panel.hidden) return;
  panel.hidden = true; $('#filter-trigger').setAttribute('aria-expanded','false');
  if (restore) $('#filter-trigger').focus({preventScroll:true});
}
function positionFilters() {
  const panel = $('#filter-popover'), trigger = $('#filter-trigger').getBoundingClientRect();
  const below = innerHeight - trigger.bottom - 18, above = trigger.top - 18;
  const upward = below < 270 && above > below;
  panel.style.maxHeight = `${Math.max(150,upward ? above : below)}px`;
  if (innerWidth <= 620) {panel.style.top = upward ? 'auto' : `${trigger.bottom+9}px`;panel.style.bottom = upward ? `${innerHeight-trigger.top+9}px` : 'auto';panel.style.marginTop='0';}
  else {panel.style.top=upward ? 'auto':'calc(100% + 9px)';panel.style.bottom=upward ? 'calc(100% + 9px)' : 'auto';}
}
$('#filter-trigger').addEventListener('click',()=>{
  if (!$('#filter-popover').hidden) {closeFilters(true);return;}
  rangePicker?.close(); $('#filter-popover').hidden=false; $('#filter-trigger').setAttribute('aria-expanded','true');positionFilters();
  $('#filter-popover [aria-pressed=true]')?.focus({preventScroll:true});
});
$('#performance-filter').addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#filter-popover').hidden){event.preventDefault();closeFilters(true);}});
for (const eventName of ['pointerdown','focusin']) document.addEventListener(eventName,event=>{if(!$('#performance-filter').contains(event.target))closeFilters();});
window.addEventListener('resize',()=>{if(!$('#filter-popover').hidden)positionFilters();});
window.addEventListener('scroll',()=>{if(!$('#filter-popover').hidden)positionFilters();},{passive:true});
$$('[data-filter]').forEach(control=>control.addEventListener('click',()=>{state.filters[control.dataset.filter]=control.dataset.value;updateFilters();loadMetrics();}));
$('#traffic-source').addEventListener('change',()=>{state.filters.source=$('#traffic-source').value;updateFilters();loadMetrics();});
$('#reset-filters').addEventListener('click',()=>{state.filters={...DEFAULT_FILTERS};updateFilters();loadMetrics();});
$$('[data-chart-mode]').forEach(control=>control.addEventListener('click',()=>{state.chartMode=control.dataset.chartMode;$$('[data-chart-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartMode===state.chartMode)));renderChart(state.metricDays);}));
$('#lead-source').addEventListener('change',()=>{state.leadSource=$('#lead-source').value;state.page=1;loadLeads();});

$$('.nav-item').forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
let resizeFrame;
window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (state.view === 'overview' && !$('#metrics-content').hidden) renderChart(state.metricDays); }); });
$('#lead-filter').addEventListener('submit', event => { event.preventDefault(); state.q = $('#lead-search').value.trim(); state.status = $('#stage-filter').value; state.page = 1; loadLeads(); });
$('#stage-filter').addEventListener('change', () => { state.status = $('#stage-filter').value; state.q = $('#lead-search').value.trim(); state.page = 1; loadLeads(); });
$('#refresh-leads').addEventListener('click', loadLeads);
$('#previous-page').addEventListener('click', () => { state.page = Math.max(1, state.page - 1); loadLeads(); });
$('#next-page').addEventListener('click', () => { if (state.page * state.limit < state.total) { state.page += 1; loadLeads(); } });
$('#close-detail').addEventListener('click', () => closeDialog($('#lead-dialog')));
$('#cancel-confirm').addEventListener('click', () => closeDialog($('#confirm-dialog')));
$('#accept-confirm').addEventListener('click', async () => {
  const submit = $('#accept-confirm'); submit.disabled = true; $('#cancel-confirm').disabled = true; $('#confirm-error').textContent = '';
  try { await confirmAction?.(); closeDialog($('#confirm-dialog')); }
  catch (error) { $('#confirm-error').textContent = message(error); }
  finally { submit.disabled = false; $('#cancel-confirm').disabled = false; }
});
$('#refresh-webhooks').addEventListener('click', loadWebhooks);
const webhookName = $('#webhook-name');
webhookName.addEventListener('invalid', event => {
  event.preventDefault();
  const error = $('#webhook-name-error'); error.hidden = false;
  error.textContent = 'Enter a name for this connection.';
  webhookName.setAttribute('aria-invalid', 'true'); webhookName.focus();
});
webhookName.addEventListener('input', () => {
  if (webhookName.validity.valid) { $('#webhook-name-error').hidden = true; webhookName.removeAttribute('aria-invalid'); }
});
$('#webhook-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!can('manage_settings')) return;
  const form = event.currentTarget; const submit = $('button[type=submit]', form); const error = $('#webhook-error'); const url = $('#webhook-url');
  error.textContent = ''; url.removeAttribute('aria-invalid');
  let endpoint;
  try { endpoint = new URL(url.value.trim()); if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error(); }
  catch { error.textContent = 'Enter an HTTPS webhook URL without an embedded username or password.'; url.setAttribute('aria-invalid', 'true'); url.focus(); return; }
  submit.disabled = true; submit.textContent = 'Saving…';
  try {
    await api('/api/admin/webhooks', { method: 'POST', body: JSON.stringify({ name: $('#webhook-name').value.trim(), url: endpoint.href, enabled: $('#webhook-enabled').checked }) });
    form.reset(); toast('Connection saved.'); await loadWebhooks();
  } catch (failure) { error.textContent = message(failure); }
  finally { submit.disabled = false; submit.textContent = 'Save connection'; }
});
$('#logout').addEventListener('click', async event => {
  const control = event.currentTarget; control.disabled = true;
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); window.location.assign('/login.html'); }
  catch (error) { report($('#global-error'), `Unable to sign out. ${message(error)}`); control.disabled = false; }
});
async function start() {
  try {
    applySession(await api('/api/auth/session'));
    usageMonitor = initFreeUsage($('#free-usage'), { request:api, currentUser:state.user, compactRoot:$('#sidebar-usage') });
    usageMonitor.refresh();
    $('[data-view="connections"]').hidden = !can('manage_settings');
    $('[data-view="users"]').hidden = !can('manage_users');
    const config = await api('/api/admin/config');
    if (Array.isArray(config.stages) && config.stages.length) state.stages = config.stages.filter(stage => DEFAULT_STAGES.some(allowed => allowed.id === stage.id));
    try { new Intl.DateTimeFormat(undefined, { timeZone: config.timezone }); state.timezone = config.timezone || 'UTC'; } catch {}
    $('#timezone-label').textContent = `${state.timezone} reporting`;
    if (config.brand?.name) { $('#brand-name').textContent = config.brand.name; document.title = `${config.brand.name} · Lead workspace`; }
    // Brand input is server configuration, but validate it before it reaches CSS or a URL.
    if (/^#[a-f\d]{6}$/i.test(config.brand?.color || '')) document.documentElement.style.setProperty('--brand', config.brand.color);
    if (typeof config.brand?.logo === 'string' && /^\/(?!\/)/.test(config.brand.logo)) { const img = element('img'); img.src = config.brand.logo; img.alt = ''; empty($('#brand-mark')).append(img); }
    state.stages.forEach(stage => { const option = element('option', '', stage.label); option.value = stage.id; $('#stage-filter').append(option); });
    accountPanel = initAccountPanel($('#account-panel'), {currentUser:state.user,permissions:state.permissions,onNotifications(data){const badge=$('#new-lead-badge');badge.textContent=String(data.unread_count || 0);badge.hidden=!data.unread_count;badge.setAttribute('aria-label',`${data.unread_count || 0} new enquiries`);}});
    if (can('manage_settings')) dataPanel = initDataLifecyclePanel($('#account-panel'),{request:api,siteName:config.brand?.name||'Funnel',onChanged(){accountPanel?.refreshNotifications();}});
    if (can('manage_users')) { usersPanel = initUsersPanel($('#users-panel'), {request:api,currentUser:state.user}); initSecurityPanel($('#users-panel'),{request:api}); }
    updateFilters();
    rangePicker = createDateRangePicker($('#date-filter'), { today: todayISO, earliest: () => config.earliest_date || todayISO(), onChange: loadMetrics });
    showView(location.hash.slice(1) || 'overview');
  } catch (error) { report($('#global-error'), `Unable to load this workspace. ${message(error)}`, () => window.location.reload()); $('#metrics-status').hidden = true; }
}
start();
