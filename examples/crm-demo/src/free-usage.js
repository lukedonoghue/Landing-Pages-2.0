const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;
const STALE_AFTER_MS = 15 * 60 * 1000;
const MAX_RESPONSE_BYTES = 256 * 1024;

export const FREE_LIMITS = Object.freeze({
  workers_requests: 100_000,
  d1_rows_read: 5_000_000,
  d1_rows_written: 100_000,
  d1_account_storage: 5_000_000_000,
  d1_database_storage: 500_000_000
});

export const FREE_USAGE_QUERY = `query CRMFreeUsage($accountTag: string!, $dayStart: string!, $dayEnd: string!, $date: Date!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      workersInvocationsAdaptive(limit: 1, filter: {datetime_geq: $dayStart, datetime_leq: $dayEnd}) {
        sum { requests }
      }
      d1AnalyticsAdaptiveGroups(limit: 1, filter: {date_geq: $date, date_leq: $date}) {
        sum { rowsRead rowsWritten }
      }
    }
  }
}`;

const cacheEntries = new Map();
const lastSuccessful = new Map();

export function configuredUsagePlan(env = {}) {
  const id = typeof env.CF_USAGE_PLAN === 'string' ? env.CF_USAGE_PLAN.trim().toLowerCase() : '';
  const names = { 'workers-free': 'Workers Free', 'workers-paid': 'Workers Paid' };
  return id in names
    ? { id, name: names[id], source: 'verified_configuration' }
    : { id: 'unknown', name: 'Plan not verified', source: 'unverified' };
}

export function resetFreeUsageCache() {
  cacheEntries.clear();
  lastSuccessful.clear();
}

function boundedSet(map, key, value) {
  map.delete(key);
  map.set(key, value);
  while (map.size > 4) map.delete(map.keys().next().value);
}

function utcPeriod(now) {
  const date = now.toISOString().slice(0, 10);
  const startsAt = `${date}T00:00:00.000Z`;
  const resetsAt = new Date(Date.parse(startsAt) + 86_400_000).toISOString();
  return { date, starts_at: startsAt, resets_at: resetsAt };
}

export function usageLevel(value, limit) {
  if (!Number.isFinite(value) || value < 0) return 'unknown';
  const proportion = value / limit;
  if (proportion >= 1) return 'exhausted';
  if (proportion >= 0.95) return 'urgent';
  if (proportion >= 0.8) return 'warning';
  return 'ok';
}

function metric(id, label, value, limit, unit, resetsAt, coverage = 'account') {
  const known = Number.isSafeInteger(value) && value >= 0;
  return {
    id,
    label,
    value: known ? value : null,
    limit,
    unit,
    percent: known ? Math.round(value / limit * 1000) / 10 : null,
    status: known ? usageLevel(value, limit) : 'unknown',
    resets_at: resetsAt,
    coverage
  };
}

function unknownMetrics(period) {
  return [
    metric('workers_requests', 'Workers requests', null, FREE_LIMITS.workers_requests, 'requests', period.resets_at),
    metric('d1_rows_read', 'D1 rows read', null, FREE_LIMITS.d1_rows_read, 'rows', period.resets_at),
    metric('d1_rows_written', 'D1 rows written', null, FREE_LIMITS.d1_rows_written, 'rows', period.resets_at),
    metric('d1_account_storage', 'D1 account storage', null, FREE_LIMITS.d1_account_storage, 'bytes', null, 'unmonitored'),
    metric('d1_database_storage', 'Largest D1 database', null, FREE_LIMITS.d1_database_storage, 'bytes', null, 'unmonitored')
  ];
}

function overall(metrics) {
  const ranks = { ok: 0, warning: 1, urgent: 2, exhausted: 3 };
  const known = metrics.filter(item => item.status !== 'unknown');
  const highest = known.reduce((value, item) => ranks[item.status] > ranks[value] ? item.status : value, 'ok');
  if (ranks[highest] > 0) return highest;
  return metrics.some(item => item.status === 'unknown') ? 'unknown' : 'ok';
}

function publicResponse({ connection = 'connected', reason = null, checkedAt, lastSuccessfulAt = checkedAt, period, metrics }) {
  return {
    connection,
    status: connection === 'connected' ? overall(metrics) : 'unknown',
    coverage: metrics.some(item => item.status === 'unknown') ? 'incomplete' : 'complete',
    reason,
    checked_at: checkedAt,
    last_successful_at: lastSuccessfulAt,
    qualification: 'Cloudflare analytics can be delayed. Values are provider estimates and may lag recent activity.',
    period: { daily_starts_at: period.starts_at, daily_resets_at: period.resets_at, storage_resets: false },
    metrics,
    dashboard_url: 'https://dash.cloudflare.com/'
  };
}

function unavailable(period, reason, checkedAt = null, connection = 'connected', lastSuccessfulAt = null) {
  return publicResponse({ connection, reason, checkedAt, lastSuccessfulAt, period, metrics: unknownMetrics(period) });
}

function number(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function aggregate(groups, field) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  let total = 0;
  for (const group of groups) {
    const value = number(group?.sum?.[field]);
    if (value === null || !Number.isSafeInteger(total + value)) return null;
    total += value;
  }
  return total;
}

export function normalizeFreeUsage(payload, now = new Date(), checkedAt = now.toISOString()) {
  const period = utcPeriod(now);
  const account = payload?.data?.viewer?.accounts;
  if (!Array.isArray(account) || account.length !== 1 || !account[0] || (Array.isArray(payload?.errors) && payload.errors.length)) {
    return unavailable(period, 'provider_unavailable', checkedAt);
  }
  const source = account[0];
  const requests = aggregate(source.workersInvocationsAdaptive, 'requests');
  const rowsRead = aggregate(source.d1AnalyticsAdaptiveGroups, 'rowsRead');
  const rowsWritten = aggregate(source.d1AnalyticsAdaptiveGroups, 'rowsWritten');
  const metrics = [
    metric('workers_requests', 'Workers requests', requests, FREE_LIMITS.workers_requests, 'requests', period.resets_at),
    metric('d1_rows_read', 'D1 rows read', rowsRead, FREE_LIMITS.d1_rows_read, 'rows', period.resets_at),
    metric('d1_rows_written', 'D1 rows written', rowsWritten, FREE_LIMITS.d1_rows_written, 'rows', period.resets_at),
    metric('d1_account_storage', 'D1 account storage', null, FREE_LIMITS.d1_account_storage, 'bytes', null, 'unmonitored'),
    metric('d1_database_storage', 'Largest D1 database', null, FREE_LIMITS.d1_database_storage, 'bytes', null, 'unmonitored')
  ];
  const age = now.getTime() - Date.parse(checkedAt);
  if (!Number.isFinite(age) || age < 0 || age > STALE_AFTER_MS) return unavailable(period, 'stale', checkedAt);
  return publicResponse({ checkedAt, period, metrics, reason: metrics.slice(0, 3).some(item => item.status === 'unknown') ? 'partial_data' : null });
}

function permissionFailure(status, payload) {
  if (status === 401 || status === 403) return true;
  return Array.isArray(payload?.errors) && payload.errors.some(error => /permission|access|authenticat|unauthoriz|forbidden/i.test(String(error?.message || '')));
}

async function providerRequest(token, accountId, period, now, fetcher, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: FREE_USAGE_QUERY, variables: { accountTag: accountId, dayStart: period.starts_at, dayEnd: now.toISOString(), date: period.date } }),
      signal: controller.signal
    });
    const declared = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) return { reason: 'provider_unavailable' };
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) return { reason: 'provider_unavailable' };
    let payload;
    try { payload = JSON.parse(text); } catch { return { reason: 'provider_unavailable' }; }
    if (!response.ok || permissionFailure(response.status, payload)) return { reason: permissionFailure(response.status, payload) ? 'provider_permission' : 'provider_unavailable' };
    return { payload };
  } catch {
    return { reason: 'provider_unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export async function freeUsage(env, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const period = utcPeriod(now);
  const token = typeof env.CF_ACCOUNT_ANALYTICS_TOKEN === 'string' ? env.CF_ACCOUNT_ANALYTICS_TOKEN.trim() : '';
  const accountId = typeof env.CF_USAGE_ACCOUNT_ID === 'string' ? env.CF_USAGE_ACCOUNT_ID.trim() : '';
  const plan = configuredUsagePlan(env);
  if (!token || !/^[a-f0-9]{32}$/i.test(accountId)) return { ...unavailable(period, 'not_connected', null, 'not_connected'), plan };

  const connectionKey = `${accountId}\u0000${token}`;
  const entryKey = `${connectionKey}\u0000${period.date}`;
  let entry = cacheEntries.get(entryKey);
  if (!entry) {
    entry = { expiresAt: 0, value: null, inflight: null };
    boundedSet(cacheEntries, entryKey, entry);
  }
  if (entry.value && entry.expiresAt > now.getTime()) return entry.value;
  if (entry.inflight) return entry.inflight;

  const fetcher = options.fetcher || globalThis.fetch;
  entry.inflight = (async () => {
    const checkedAt = now.toISOString();
    const result = await providerRequest(token, accountId, period, now, fetcher, options.timeoutMs || 4000);
    let value = result.payload
      ? normalizeFreeUsage(result.payload, now, checkedAt)
      : unavailable(period, result.reason, checkedAt, 'connected', lastSuccessful.get(connectionKey) || null);
    const daily = value.metrics.slice(0, 3);
    const validated = Boolean(result.payload) && value.reason !== 'provider_unavailable' && value.reason !== 'stale' && daily.some(item => item.value !== null);
    if (validated) boundedSet(lastSuccessful, connectionKey, checkedAt);
    value = { ...value, plan, last_successful_at: validated ? checkedAt : (lastSuccessful.get(connectionKey) || null) };
    entry.value = value;
    entry.expiresAt = now.getTime() + (value.reason ? ERROR_TTL_MS : (options.cacheTtlMs || CACHE_TTL_MS));
    return value;
  })();
  try { return await entry.inflight; }
  finally { entry.inflight = null; }
}
