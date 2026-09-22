const ranks = { ok: 0, warning: 1, urgent: 2, exhausted: 3, unknown: 4 };

function valid(data) {
  return data && typeof data === 'object' && ['connected','not_connected'].includes(data.connection)
    && Object.hasOwn(ranks, data.status) && Array.isArray(data.metrics)
    && (!data.plan || (typeof data.plan.name === 'string' && typeof data.plan.source === 'string'))
    && typeof data.dashboard_url === 'string' && data.dashboard_url.startsWith('https://dash.cloudflare.com/');
}

function number(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function bytes(value) {
  if (!Number.isFinite(value)) return 'Unknown';
  const units = ['B','KB','MB','GB']; let amount = value; let index = 0;
  while (amount >= 1000 && index < units.length - 1) { amount /= 1000; index += 1; }
  return `${number(amount)} ${units[index]}`;
}

function valueText(item) {
  if (!Number.isFinite(item.value) || !Number.isFinite(item.limit)) return 'Unknown';
  const current = item.unit === 'bytes' ? bytes(item.value) : number(item.value);
  const limit = item.unit === 'bytes' ? bytes(item.limit) : number(item.limit);
  return `${current} of ${limit} (${number(item.percent)}%)`;
}

function messageFor(data, isAdmin) {
  if (data.connection === 'not_connected') return isAdmin
    ? 'Optional automatic checks are not connected. Ask Codex to connect read-only Cloudflare usage access, or check the Cloudflare dashboard.'
    : 'Automatic usage checks are not connected. Ask an administrator to connect read-only Cloudflare usage access, or check the Cloudflare dashboard.';
  if (data.reason === 'provider_permission') return isAdmin
    ? 'Cloudflare declined the usage check. Ask Codex to verify Account Analytics Read access, or check the Cloudflare dashboard.'
    : 'Cloudflare declined the usage check. Ask an administrator to review the read-only connection.';
  const incomplete = data.coverage === 'incomplete' ? ' Some usage figures are unavailable. Check Cloudflare for the rest.' : '';
  if (data.status === 'exhausted') return `Cloudflare reports a monitored Free allowance at or above 100%. Service may already be restricted. Optimize usage or ask the account owner to review a paid plan.${incomplete}`;
  if (data.status === 'urgent') return `A monitored Free allowance is at least 95% used. Optimize now or ask the account owner to review a paid plan.${incomplete}`;
  if (data.status === 'warning') return `A monitored Free allowance is at least 80% used. Optimize usage or ask the account owner to review a paid plan.${incomplete}`;
  if (data.reason === 'stale') return 'The last usage snapshot is stale. Check the Cloudflare dashboard for current figures.';
  if (data.reason === 'partial_data' || (data.status === 'unknown' && data.coverage === 'incomplete')) return 'Some usage figures are unavailable. Check Cloudflare for the rest.';
  if (data.status === 'unknown') return 'Cloudflare usage is temporarily unavailable. Check the dashboard and try again.';
  return 'Monitored Free allowances are below 80%. Other Cloudflare limits can still apply.';
}

function timeText(data) {
  const value = data.last_successful_at;
  if (!value) return 'No successful automatic check yet.';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Last successful check time is unavailable.';
  return `Last successful check ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC.`;
}

export function usageHeading(data) {
  if (data.status === 'unknown' && data.connection === 'connected' && data.metrics?.some(item => item?.status !== 'unknown' && Number.isFinite(item?.value))) return 'Usage partly checked';
  return ({ok:'Free usage is in range',warning:'Free usage warning',urgent:'Free usage urgent',exhausted:'Free allowance reported exhausted',unknown:'Free usage unavailable'})[data.status];
}

export function initFreeUsage(root, { request, currentUser, compactRoot = null }) {
  let sequence = 0;
  let controller;
  let destroyed = false;
  const heading = root.querySelector('[data-usage-heading]');
  const message = root.querySelector('[data-usage-message]');
  const details = root.querySelector('[data-usage-details]');
  const summary = root.querySelector('[data-usage-summary]');
  const metrics = root.querySelector('[data-usage-metrics]');
  const meta = root.querySelector('[data-usage-meta]');
  const dashboard = root.querySelector('[data-usage-dashboard]');
  const refreshButton = root.querySelector('[data-usage-refresh]');
  const isAdmin = currentUser?.role === 'admin';

  function renderCompact(data) {
    if (!compactRoot) return;
    compactRoot.dataset.status = data.status;
    compactRoot.querySelector('[data-sidebar-plan]').textContent = data.plan?.name || 'Plan not verified';
    compactRoot.querySelector('[data-sidebar-usage-status]').textContent = data.connection === 'connected' ? usageHeading(data) : 'Usage not connected';
    const list = compactRoot.querySelector('[data-sidebar-usage-metrics]'); list.replaceChildren();
    const shortLabels = { workers_requests:'Requests', d1_rows_read:'D1 reads', d1_rows_written:'D1 writes' };
    for (const item of data.metrics.filter(metric => shortLabels[metric.id])) {
      const row = document.createElement('div'); row.className = 'sidebar-usage-metric'; row.dataset.status = item.status;
      const line = document.createElement('span'); line.className = 'sidebar-usage-line';
      const label = document.createElement('span'); label.textContent = shortLabels[item.id];
      const value = document.createElement('strong'); value.textContent = Number.isFinite(item.percent) ? `${number(item.percent)}%` : 'Unknown';
      const track = document.createElement('span'); track.className = 'sidebar-usage-track'; track.setAttribute('aria-hidden','true');
      const fill = document.createElement('span'); fill.className = 'sidebar-usage-fill'; fill.style.width = `${Math.max(0, Math.min(100, Number(item.percent) || 0))}%`;
      line.append(label, value); track.append(fill); row.append(line, track); list.append(row);
    }
  }

  function render(data) {
    root.dataset.status = data.status;
    renderCompact(data);
    heading.textContent = usageHeading(data);
    message.textContent = messageFor(data, isAdmin);
    dashboard.href = data.dashboard_url;
    metrics.replaceChildren();
    if (data.connection === 'connected') {
      for (const item of data.metrics) {
        if (!item || typeof item.label !== 'string' || !Object.hasOwn(ranks, item.status)) continue;
        const entry = document.createElement('span'); entry.className = 'usage-metric'; entry.dataset.status = item.status;
        const label = document.createElement('strong'); label.textContent = item.label;
        const value = document.createElement('span'); value.textContent = valueText(item);
        entry.append(label, value); metrics.append(entry);
      }
    }
    details.hidden = !metrics.childElementCount;
    summary.textContent = `View ${metrics.childElementCount} usage figures`;
    const reset = data.period?.daily_resets_at ? ` Daily allowances reset at 00:00 UTC; storage does not reset.` : '';
    meta.textContent = `${timeText(data)} ${data.qualification || 'Provider analytics can lag.'}${reset}`;
  }

  async function load() {
    if (destroyed) return;
    const id = ++sequence;
    controller?.abort(); controller = new AbortController();
    refreshButton.disabled = true; root.setAttribute('aria-busy','true');
    if (id === 1) { heading.textContent = 'Checking Free usage'; message.textContent = 'Loading read-only Cloudflare account metrics...'; if (compactRoot) compactRoot.querySelector('[data-sidebar-usage-status]').textContent = 'Checking usage'; }
    try {
      const data = await request('/api/admin/free-usage', { signal: controller.signal });
      if (destroyed || id !== sequence) return;
      if (!valid(data)) throw new Error('Invalid usage response');
      render(data);
    } catch (error) {
      if (destroyed || id !== sequence || error?.name === 'AbortError') return;
      render({ connection:'connected', status:'unknown', coverage:'incomplete', reason:'provider_unavailable', checked_at:null, last_successful_at:null, qualification:'Provider analytics can lag.', period:{storage_resets:false}, metrics:[], dashboard_url:'https://dash.cloudflare.com/' });
    } finally {
      if (!destroyed && id === sequence) { refreshButton.disabled = false; root.removeAttribute('aria-busy'); }
    }
  }
  let timer = null; let lastLoad = 0;
  const schedule = () => {
    clearTimeout(timer); timer = null;
    if (!destroyed && !document.hidden) timer = setTimeout(() => { lastLoad = Date.now(); load().finally(schedule); }, 5 * 60 * 1000);
  };
  const refresh = async () => { if (destroyed) return; lastLoad = Date.now(); await load(); if (!destroyed) schedule(); };
  const visibility = () => {
    if (destroyed) return;
    if (document.hidden) { clearTimeout(timer); timer = null; return; }
    if (Date.now() - lastLoad >= 5 * 60 * 1000) refresh(); else schedule();
  };
  refreshButton.addEventListener('click', refresh);
  document.addEventListener('visibilitychange', visibility);
  return { refresh, destroy() { if (destroyed) return; destroyed = true; sequence += 1; controller?.abort(); clearTimeout(timer); timer = null; refreshButton.removeEventListener('click', refresh); document.removeEventListener('visibilitychange', visibility); } };
}
