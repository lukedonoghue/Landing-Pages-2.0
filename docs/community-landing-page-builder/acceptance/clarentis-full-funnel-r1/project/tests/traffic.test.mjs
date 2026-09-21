import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDevice, classifyTraffic, eventId, normalizeTrafficFilters } from '../src/traffic.js';

test('click identifiers and explicit media classify traffic without treating every Meta click as paid', () => {
  for (const key of ['gclid', 'gbraid', 'wbraid']) assert.deepEqual(classifyTraffic({ [key]: 'click', utm_source: 'email' }), { traffic_source: 'google', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ utm_medium: 'cpc' }), { traffic_source: 'unknown', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ msclkid: 'click' }), { traffic_source: 'microsoft', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ fbclid: 'click' }), { traffic_source: 'facebook', traffic_type: 'unknown' });
  assert.deepEqual(classifyTraffic({ fbclid: 'click', utm_source: 'ig', utm_medium: 'paid_social' }), { traffic_source: 'instagram', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ utm_source: 'fb', utm_medium: 'cpc' }), { traffic_source: 'facebook', traffic_type: 'paid' });
  assert.deepEqual(classifyTraffic({ utm_source: 'google', utm_medium: 'organic' }), { traffic_source: 'google', traffic_type: 'organic' });
  for (const utm_medium of ['organic_social', 'organic-social', 'organic social', 'social', 'social_media']) assert.deepEqual(classifyTraffic({ utm_source: 'ig', utm_medium, fbclid: 'click' }), { traffic_source: 'instagram', traffic_type: 'organic' });
  assert.deepEqual(classifyTraffic({ utm_source: 'bing', utm_medium: 'ppc' }), { traffic_source: 'microsoft', traffic_type: 'paid' });
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
