import { HttpError, cleanText } from './security.js';

export const TRAFFIC_SOURCES = ['google', 'facebook', 'instagram', 'microsoft', 'direct', 'other', 'unknown'];
export const TRAFFIC_TYPES = ['paid', 'organic', 'other', 'unknown'];
export const DEVICES = ['desktop', 'mobile', 'unknown'];
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function eventId(value, required = false) {
  if (value == null || value === '') { if (required) throw new HttpError(400, 'A visit event ID is required.'); return null; }
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new HttpError(400, 'Invalid visit event ID.');
  return value.toLowerCase();
}
export function normalizeTrafficFilters(searchParams) {
  const definitions = { visitor_mode: ['unique', 'all'], device: ['all', ...DEVICES], traffic: ['blended', ...TRAFFIC_TYPES], source: ['all', ...TRAFFIC_SOURCES] };
  const filters = {};
  for (const [key, allowed] of Object.entries(definitions)) {
    const values = searchParams.getAll(key);
    if (values.length > 1 || (values.length && !allowed.includes(values[0]))) throw new HttpError(400, `Invalid ${key.replaceAll('_', ' ')} filter.`);
    filters[key] = values[0] || allowed[0];
  }
  return filters;
}
export function dimensionConditions(filters, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  const conditions = []; const params = [];
  for (const [filter, column, any] of [['device', 'device', 'all'], ['traffic', 'traffic_type', 'blended'], ['source', 'traffic_source', 'all']]) {
    if (filters[filter] !== any) { conditions.push(`${prefix}${column}=?`); params.push(filters[filter]); }
  }
  return { sql: conditions.length ? ` AND ${conditions.join(' AND ')}` : '', params };
}
export function classifyDevice(userAgent = '') {
  if (!userAgent || /bot|crawler|spider|headless/i.test(userAgent)) return 'unknown';
  // Tablets belong to Mobile; absence of a mobile token alone does not prove Desktop.
  if (/android|iphone|ipad|ipod|mobile|tablet|silk\/|kindle/i.test(userAgent)) return 'mobile';
  if (/windows nt|macintosh|mac os x|x11|cros|linux x86_64/i.test(userAgent)) return 'desktop';
  return 'unknown';
}
const googleDomains = ['google.com', 'google.co.uk', 'google.com.au', 'google.ca', 'google.de', 'google.fr', 'google.es', 'google.it', 'google.co.nz', 'google.co.in', 'google.co.jp', 'google.com.br', 'google.pl', 'google.nl', 'google.ie', 'google.co.za', 'google.com.sg', 'google.com.mx', 'google.pt', 'google.be', 'google.ch', 'google.at', 'google.se', 'google.no', 'google.dk', 'google.fi'];
const hostIs = (hostname, root) => hostname === root || hostname.endsWith(`.${root}`);
function sourceFromValue(value) {
  const source = String(value || '').trim().toLowerCase();
  if (['google', 'googleads', 'google ads', 'adwords'].includes(source)) return 'google';
  if (['facebook', 'fb', 'meta', 'facebookads', 'facebook ads'].includes(source)) return 'facebook';
  if (['instagram', 'ig'].includes(source)) return 'instagram';
  if (['microsoft', 'bing', 'microsoft ads', 'bingads'].includes(source)) return 'microsoft';
  if (['direct', '(direct)'].includes(source)) return 'direct';
  if (source) {
    try {
      const hostname = new URL(source.includes('://') ? source : `https://${source}`).hostname;
      return sourceFromHostname(hostname) || 'other';
    } catch { return 'other'; }
  }
  return null;
}
function sourceFromHostname(hostname) {
  if (googleDomains.some(root => hostIs(hostname, root))) return 'google';
  if (hostIs(hostname, 'facebook.com') || hostIs(hostname, 'fb.com')) return 'facebook';
  if (hostIs(hostname, 'instagram.com')) return 'instagram';
  if (hostIs(hostname, 'bing.com')) return 'microsoft';
  return null;
}
function isSearchHostname(hostname) {
  // A Google-owned property is not necessarily a search referrer: Gmail, Docs,
  // Maps and other properties retain Google source without inferred Organic.
  return googleDomains.some(root => hostname === root || ['www.', 'images.', 'encrypted.'].some(prefix => hostname === `${prefix}${root}`))
    || ['bing.com', 'www.bing.com', 'cn.bing.com'].includes(hostname);
}
export function classifyTraffic(attribution = {}, referrer = '', origin = '') {
  const medium = String(attribution.utm_medium || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  const paid = ['cpc', 'ppc', 'paid', 'paidsearch', 'paidsocial', 'display', 'cpm', 'cpv', 'retargeting', 'remarketing'].includes(medium);
  const explicitOrganic = ['organic', 'organicsearch', 'organicsocial', 'social', 'socialmedia', 'socialnetwork'].includes(medium);
  // Search ad click IDs provide positive paid evidence. fbclid only proves a Meta click.
  if (attribution.gclid || attribution.dclid || attribution.gbraid || attribution.wbraid) return { traffic_source: 'google', traffic_type: 'paid' };
  if (attribution.msclkid) return { traffic_source: 'microsoft', traffic_type: 'paid' };
  if (attribution.ttclid) return { traffic_source: 'other', traffic_type: 'paid' };
  let refSource = null; let hasExternalReferrer = false; let searchReferrer = false;
  try {
    const url = new URL(referrer);
    if (['https:', 'http:'].includes(url.protocol) && url.origin !== origin) { hasExternalReferrer = true; refSource = sourceFromHostname(url.hostname); searchReferrer = isSearchHostname(url.hostname); }
  } catch {}
  let source = sourceFromValue(attribution.utm_source || attribution.source) || refSource;
  if (attribution.fbclid && !['facebook', 'instagram'].includes(source)) source = 'facebook';
  const hasCampaignMetadata = Object.values(attribution).some(value => Boolean(value));
  source ||= hasExternalReferrer ? 'other' : hasCampaignMetadata ? 'unknown' : 'direct';
  let traffic = paid ? 'paid' : explicitOrganic ? 'organic' : 'other';
  if (!paid && !explicitOrganic && !medium) {
    if (searchReferrer && !attribution.utm_source && !attribution.source && !attribution.fbclid) traffic = 'organic';
    else if (['google', 'microsoft', 'facebook', 'instagram'].includes(source)) traffic = 'unknown';
  }
  return { traffic_source: source, traffic_type: traffic };
}
export function normalizeVisitAttribution(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid visit attribution.');
  const result = {};
  for (const key of ['source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic', 'gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid']) {
    if (value[key] != null) result[key] = cleanText(value[key], 512, key);
  }
  return result;
}
