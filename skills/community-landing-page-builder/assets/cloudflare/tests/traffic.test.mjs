import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDevice, classifyTraffic, eventId, normalizeTrafficFilters, normalizeVisitAttribution } from '../src/traffic.js';
import { serializeLead } from '../src/repository.js';

test('click identifiers and explicit media classify traffic without treating every Meta click as paid', () => {
  for (const key of ['gclid', 'dclid', 'gbraid', 'wbraid']) assert.deepEqual(classifyTraffic({ [key]: 'click', utm_source: 'email' }), { traffic_source: 'google', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ utm_medium: 'cpc' }), { traffic_source: 'unknown', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ msclkid: 'click' }), { traffic_source: 'microsoft', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ ttclid: 'click' }), { traffic_source: 'other', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ fbclid: 'click' }), { traffic_source: 'facebook', traffic_type: 'unknown' });
  assert.deepEqual(classifyTraffic({ fbclid: 'click', utm_source: 'ig', utm_medium: 'paid_social' }), { traffic_source: 'instagram', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ utm_source: 'fb', utm_medium: 'cpc' }), { traffic_source: 'facebook', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ utm_source: 'google', utm_medium: 'organic' }), { traffic_source: 'google', traffic_type: 'organic' });
  for (const utm_medium of ['organic_social', 'organic-social', 'organic social', 'social', 'social_media']) assert.deepEqual(classifyTraffic({ utm_source: 'ig', utm_medium, fbclid: 'click' }), { traffic_source: 'instagram', traffic_type: 'organic' });
  assert.deepEqual(classifyTraffic({ utm_source: 'bing', utm_medium: 'ppc' }), { traffic_source: 'microsoft', traffic_type: 'paid' });
});
test('visit normalization preserves supported campaign extensions and rejects URL contact fields', () => {
  const tags = {utm_id:'campaign',utm_source_platform:'platform',utm_creative_format:'format',utm_marketing_tactic:'tactic',dclid:'display-click',ttclid:'tiktok-click'};
  assert.deepEqual(normalizeVisitAttribution({...tags,email:'private@example.invalid',utm_private:'discard'}),tags);
  assert.throws(() => normalizeVisitAttribution({utm_id:'x'.repeat(513)}));
});
test('CRM serialization preserves distinct full first/latest touches and returns latest direct fields',()=>{
  const keys=['utm_source','utm_medium','utm_campaign','utm_id','utm_term','utm_content','utm_source_platform','utm_creative_format','utm_marketing_tactic','gclid','dclid','gbraid','wbraid','fbclid','msclkid','ttclid'];
  const first=Object.fromEntries(keys.map(key=>[key,`first-${key}`])),latest=Object.fromEntries(keys.map(key=>[key,`latest-${key}`]));latest.utm_source='email';
  const lead=serializeLead({id:'synthetic',payload_hash:'private',idempotency_key:'private',visitor_hash:null,deleted_at:null,form_data:'{}',attribution:JSON.stringify({first_touch:{...first},latest_touch:{...latest}}),source:'',referrer:''});
  for(const [key,value] of Object.entries(first))assert.equal(lead.attribution.first_touch[key],value);
  for(const [key,value] of Object.entries(latest)){assert.equal(lead.attribution.latest_touch[key],value);assert.equal(lead[key],value);}
  assert.equal(lead.source,'email');assert.equal('payload_hash' in lead,false);assert.equal('visitor_hash' in lead,false);
});
test('referrer matching uses exact domains and known search referrers are organic only without paid evidence', () => {
  for (const hostname of ['google.com', 'www.google.com', 'google.co.uk', 'www.google.co.uk', 'images.google.com']) assert.deepEqual(classifyTraffic({}, `https://${hostname}/search`), { traffic_source: 'google', traffic_type: 'organic' });
  for (const hostname of ['bing.com', 'www.bing.com', 'cn.bing.com']) assert.deepEqual(classifyTraffic({}, `https://${hostname}/search`), { traffic_source: 'microsoft', traffic_type: 'organic' });
  for (const hostname of ['mail.google.com', 'docs.google.com', 'maps.google.com', 'www.mail.google.com']) assert.deepEqual(classifyTraffic({}, `https://${hostname}/page`), { traffic_source: 'google', traffic_type: 'unknown' });
  assert.deepEqual(classifyTraffic({}, 'https://ads.bing.com/page'), { traffic_source: 'microsoft', traffic_type: 'unknown' });
  assert.deepEqual(classifyTraffic({}, 'https://m.facebook.com/story'), { traffic_source: 'facebook', traffic_type: 'unknown' });
  for (const referrer of ['https://evilfacebook.com', 'https://facebook.com.evil.test', 'https://google.com.evil.test', 'https://google.badsite']) assert.equal(classifyTraffic({}, referrer).traffic_source, 'other');
  assert.deepEqual(classifyTraffic({}, 'https://site.test/next', 'https://site.test'), { traffic_source: 'direct', traffic_type: 'other' });
  assert.deepEqual(classifyTraffic({ utm_medium: 'paid-social' }, 'https://m.facebook.com'), { traffic_source: 'facebook', traffic_type: 'paid' });
});
test('device classification groups phones and tablets, preserves missing and bot devices as unknown', () => {
  for (const agent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', 'Mozilla/5.0 (iPad; CPU OS 18_0)', 'Mozilla/5.0 (Linux; Android 14; Pixel)']) assert.equal(classifyDevice(agent), 'mobile');
  for (const agent of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Mozilla/5.0 (X11; Linux x86_64)']) assert.equal(classifyDevice(agent), 'desktop');
  for (const agent of ['', null, 'curl/8.0', 'Googlebot/2.1']) assert.equal(classifyDevice(agent), 'unknown');
});
test('filters and event IDs validate strictly including duplicated query arguments', () => {
  assert.deepEqual(normalizeTrafficFilters(new URLSearchParams()), { visitor_mode: 'unique', device: 'all', traffic: 'blended', source: 'all' });
  for (const query of ['visitor_mode=people', 'device=tablet', 'traffic=facebook', 'source=spam', 'source=google&source=facebook', 'device=']) assert.throws(() => normalizeTrafficFilters(new URLSearchParams(query)), /Invalid/);
  assert.equal(eventId(null), null); assert.throws(() => eventId(null, true)); assert.throws(() => eventId('email@example.com', true));
  assert.equal(eventId('48C308E3-6F30-48DB-8B59-19B21D69B01F'), '48c308e3-6f30-48db-8b59-19b21d69b01f');
});
