import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize } from '../src/team-accounts.js';
import { FREE_LIMITS, FREE_USAGE_QUERY, freeUsage, normalizeFreeUsage, resetFreeUsageCache, usageLevel } from '../src/free-usage.js';

const env = { CF_ACCOUNT_ANALYTICS_TOKEN:'narrow-read-only-test-token', CF_USAGE_ACCOUNT_ID:'a'.repeat(32) };
const now = new Date('2026-09-21T12:34:56.000Z');

function payload({ requests=12_000, rowsRead=345_000, rowsWritten=6_700, storage=[120_000_000,80_000_000] } = {}) {
  return { data:{ viewer:{ accounts:[{
    workersInvocationsAdaptive:[{sum:{requests}}],
    d1AnalyticsAdaptiveGroups:[{sum:{rowsRead,rowsWritten}}],
    d1StorageAdaptiveGroups:storage.map((databaseSizeBytes,index)=>({max:{databaseSizeBytes},dimensions:{databaseId:`database-${index}`,date:'2026-09-21'}}))
  }] } }, errors:null };
}

function response(body, status=200) {
  return new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json'}});
}

test('thresholds change at exactly 80, 95 and 100 percent', () => {
  const limit = 100_000;
  assert.equal(usageLevel(79_999,limit),'ok');
  assert.equal(usageLevel(80_000,limit),'warning');
  assert.equal(usageLevel(94_999,limit),'warning');
  assert.equal(usageLevel(95_000,limit),'urgent');
  assert.equal(usageLevel(99_999,limit),'urgent');
  assert.equal(usageLevel(100_000,limit),'exhausted');
  assert.equal(usageLevel(-1,limit),'unknown');
});

test('provider query is account-wide and uses billable row metrics', () => {
  assert.match(FREE_USAGE_QUERY,/workersInvocationsAdaptive/);
  assert.match(FREE_USAGE_QUERY,/d1AnalyticsAdaptiveGroups/);
  assert.match(FREE_USAGE_QUERY,/rowsRead rowsWritten/);
  assert.doesNotMatch(FREE_USAGE_QUERY,/scriptName|readQueries|writeQueries/);
  assert.doesNotMatch(FREE_USAGE_QUERY,/d1StorageAdaptiveGroups|databaseSizeBytes/);
  const workersBlock = FREE_USAGE_QUERY.slice(FREE_USAGE_QUERY.indexOf('workersInvocationsAdaptive'),FREE_USAGE_QUERY.indexOf('d1AnalyticsAdaptiveGroups'));
  assert.doesNotMatch(workersBlock,/dimensions/);
});

test('normalization reports daily totals and leaves unverified storage coverage unknown', () => {
  const result = normalizeFreeUsage(payload(),now);
  assert.equal(result.status,'unknown'); assert.equal(result.reason,null); assert.equal(result.coverage,'incomplete');
  assert.equal(result.period.daily_starts_at,'2026-09-21T00:00:00.000Z');
  assert.equal(result.period.daily_resets_at,'2026-09-22T00:00:00.000Z');
  assert.equal(result.period.storage_resets,false);
  const metrics=Object.fromEntries(result.metrics.map(item=>[item.id,item]));
  assert.equal(metrics.workers_requests.limit,FREE_LIMITS.workers_requests);
  assert.equal(metrics.d1_rows_read.value,345_000);
  assert.equal(metrics.d1_rows_written.value,6_700);
  assert.equal(metrics.d1_account_storage.value,null);
  assert.equal(metrics.d1_account_storage.resets_at,null);
  assert.equal(metrics.d1_account_storage.coverage,'unmonitored');
  assert.equal(metrics.d1_database_storage.value,null);
});

test('unknown storage never suppresses a known urgent daily warning', () => {
  const result=normalizeFreeUsage(payload({requests:99_000}),now);
  assert.equal(result.status,'urgent'); assert.equal(result.coverage,'incomplete'); assert.equal(result.reason,null);
  assert.equal(result.metrics.find(item=>item.id==='workers_requests').status,'urgent');
  assert.equal(result.metrics.find(item=>item.id==='d1_account_storage').status,'unknown');
});

test('missing and stale provider data stay unknown rather than becoming zero or green', () => {
  const partial=payload(); delete partial.data.viewer.accounts[0].workersInvocationsAdaptive;
  const incomplete=normalizeFreeUsage(partial,now);
  assert.equal(incomplete.status,'unknown'); assert.equal(incomplete.reason,'partial_data');
  assert.equal(incomplete.metrics.find(item=>item.id==='workers_requests').value,null);
  assert.equal(incomplete.metrics.find(item=>item.id==='d1_rows_read').value,345_000);
  const stale=normalizeFreeUsage(payload(),now,'2026-09-21T12:00:00.000Z');
  assert.equal(stale.status,'unknown'); assert.equal(stale.reason,'stale');
  assert.ok(stale.metrics.every(item=>item.value===null));
});

test('no optional credential returns an honest not-connected response without fetching', async () => {
  resetFreeUsageCache(); let calls=0;
  const result=await freeUsage({}, {now,fetcher:async()=>{calls+=1;return response(payload());}});
  assert.equal(calls,0); assert.equal(result.connection,'not_connected'); assert.equal(result.status,'unknown');
  assert.equal(result.reason,'not_connected'); assert.equal(result.last_successful_at,null);
  assert.ok(result.metrics.every(item=>item.value===null));
});

test('cache deduplicates concurrent checks, expires, and rolls over at UTC midnight', async () => {
  resetFreeUsageCache(); let calls=0; const bodies=[];
  const fetcher=async (_url,options)=>{calls+=1;bodies.push(JSON.parse(options.body));await new Promise(resolve=>setTimeout(resolve,5));return response(payload());};
  const first=await Promise.all(Array.from({length:5},()=>freeUsage(env,{now,fetcher,cacheTtlMs:1000})));
  assert.equal(calls,1); assert.ok(first.every(item=>item.checked_at===now.toISOString()));
  assert.deepEqual(bodies[0].variables,{accountTag:'a'.repeat(32),dayStart:'2026-09-21T00:00:00.000Z',dayEnd:'2026-09-21T12:34:56.000Z',date:'2026-09-21'});
  await freeUsage(env,{now:new Date('2026-09-21T12:34:56.500Z'),fetcher,cacheTtlMs:1000}); assert.equal(calls,1);
  await freeUsage(env,{now:new Date('2026-09-21T12:34:57.001Z'),fetcher,cacheTtlMs:1000}); assert.equal(calls,2);
  await freeUsage(env,{now:new Date('2026-09-22T00:00:00.000Z'),fetcher,cacheTtlMs:1000}); assert.equal(calls,3);
  assert.equal(bodies[2].variables.dayStart,'2026-09-22T00:00:00.000Z');
  assert.equal(bodies[2].variables.date,'2026-09-22');
});

test('provider permission failures are safe, unknown and credential-free', async () => {
  resetFreeUsageCache(); const secret=env.CF_ACCOUNT_ANALYTICS_TOKEN;
  const result=await freeUsage(env,{now,fetcher:async()=>response({errors:[{message:`forbidden for ${secret}`} ]},403)});
  assert.equal(result.reason,'provider_permission'); assert.equal(result.status,'unknown');
  assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(result),/forbidden/i);
});

test('response validation rejects malformed, oversized and error-bearing provider data', async () => {
  for (const providerResponse of [
    response({data:{viewer:{accounts:[]}}}),
    response({data:{viewer:{accounts:[payload().data.viewer.accounts[0]]}},errors:[{message:'schema failure'}]}),
    new Response('{bad json',{status:200}),
    new Response(JSON.stringify(payload()),{status:200,headers:{'content-length':String(300_000)}})
  ]) {
    resetFreeUsageCache(); const result=await freeUsage(env,{now,fetcher:async()=>providerResponse});
    assert.equal(result.status,'unknown'); assert.ok(['provider_unavailable','partial_data'].includes(result.reason));
  }
});

test('last successful timestamp survives a later provider failure without serving stale values', async () => {
  resetFreeUsageCache(); let available=true;
  const fetcher=async()=>available?response(payload()):response({errors:[{message:'temporary'}]},503);
  const first=await freeUsage(env,{now,fetcher,cacheTtlMs:1}); assert.equal(first.reason,null); assert.equal(first.last_successful_at,now.toISOString());
  available=false;
  const second=await freeUsage(env,{now:new Date(now.getTime()+2),fetcher,cacheTtlMs:1});
  assert.equal(second.status,'unknown'); assert.equal(second.last_successful_at,now.toISOString());
  assert.ok(second.metrics.every(item=>item.value===null));
});

test('slow account and UTC-day requests cannot overwrite another cache entry', async () => {
  resetFreeUsageCache();
  const pending=[]; let calls=0;
  const fetcher=(_url,options)=>new Promise(resolve=>{calls+=1;pending.push({variables:JSON.parse(options.body).variables,resolve});});
  const accountA={...env,CF_USAGE_ACCOUNT_ID:'a'.repeat(32)};
  const accountB={...env,CF_USAGE_ACCOUNT_ID:'b'.repeat(32)};
  const slowA=freeUsage(accountA,{now,fetcher});
  const fastB=freeUsage(accountB,{now,fetcher});
  pending[1].resolve(response(payload({requests:95_000}))); const resultB=await fastB;
  pending[0].resolve(response(payload({requests:80_000}))); const resultA=await slowA;
  assert.equal(resultB.status,'urgent'); assert.equal(resultA.status,'warning');
  assert.equal((await freeUsage(accountB,{now,fetcher})).status,'urgent'); assert.equal(calls,2);

  resetFreeUsageCache(); pending.length=0; calls=0;
  const oldDay=freeUsage(accountA,{now:new Date('2026-09-21T23:59:59.900Z'),fetcher});
  const newDay=freeUsage(accountA,{now:new Date('2026-09-22T00:00:00.000Z'),fetcher});
  pending[1].resolve(response(payload({requests:10}))); const newResult=await newDay;
  pending[0].resolve(response(payload({requests:99_000}))); await oldDay;
  assert.equal(newResult.metrics[0].value,10);
  assert.equal((await freeUsage(accountA,{now:new Date('2026-09-22T00:00:00.500Z'),fetcher})).metrics[0].value,10);
  assert.equal(calls,2);
});

test('all authenticated CRM roles may read usage but view-only cannot mutate it', () => {
  for (const role of ['admin','manager','viewer']) assert.doesNotThrow(()=>authorize({role},'/api/admin/free-usage','GET'));
  assert.throws(()=>authorize({role:'viewer'},'/api/admin/free-usage','POST'),error=>error.status===403);
});
