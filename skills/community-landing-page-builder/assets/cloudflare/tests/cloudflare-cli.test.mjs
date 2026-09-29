/** The Cloudflare CLI adapter against the pinned cf binary and a local stand-in for the
 * Cloudflare API. A synthetic token, a throwaway HOME and a from-scratch environment keep
 * any real login, keyring or account out of reach; no request leaves 127.0.0.1. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cfBin,cfInstalled,client,destination,accountsFrom,zoneCandidates,zoneFor,dnsState,databaseFrom,placement,outcome,environment,profileName,createArgs} from '../scripts/cloudflare-cli.mjs';
import {edgeProtection,rateRule} from '../scripts/ship-provider.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const A='a'.repeat(32),B='c'.repeat(32),Z='b'.repeat(32),DB='22222222-2222-4222-8222-222222222222';
const ok=(result,info)=>({success:true,errors:[],messages:[],result,...(info?{result_info:info}:{})});
const fail=(code,message)=>({success:false,errors:[{code,message}],messages:[],result:null});

test('helpers keep only well-formed, printable provider facts',()=>{
  assert.deepEqual(accountsFrom([{id:A,name:'Acme\u0007 Plumbing'},{id:'bad',name:'x'},{id:B}]),[{id:A,name:'Acme Plumbing'},{id:B,name:B}]);
  assert.deepEqual(zoneCandidates('quote.acme.co.uk'),['quote.acme.co.uk','acme.co.uk','co.uk']);
  const zones=[{id:Z,name:'acme.co.uk',status:'active',account:{id:A},plan:{name:'Free'}},{id:'d'.repeat(32),name:'co.uk',status:'active',account:{id:A}},{id:'e'.repeat(32),name:'quote.acme.co.uk',status:'active',account:{id:B}}];
  // The longest zone in the chosen account wins; another account's zone never does.
  assert.deepEqual(zoneFor('Quote.Acme.co.uk',zones,A),{id:Z,name:'acme.co.uk',status:'active',plan:'Free'});
  assert.equal(zoneFor('acme.com',zones,A),null);
  assert.deepEqual(dnsState([{name:'quote.acme.co.uk',type:'TXT',content:'v=spf1'}],'quote.acme.co.uk'),{state:'clear'});
  assert.deepEqual(dnsState([{name:'ACME.co.uk',type:'A',content:'192.0.2.1',proxied:true}],'acme.co.uk'),{state:'occupied',records:[{type:'A',content:'192.0.2.1',proxied:true}]});
  assert.deepEqual(databaseFrom({uuid:DB.toUpperCase(),name:'acme-crm'},'acme-crm'),{id:DB,name:'acme-crm'});
  assert.equal(databaseFrom({uuid:DB,name:'other-crm'},'acme-crm'),null);
  assert.equal(databaseFrom({uuid:'not-a-uuid',name:'acme-crm'}),null);
  assert.deepEqual(placement({database_jurisdiction:'eu'}),{jurisdiction:'eu',location:null});
  assert.deepEqual(createArgs('acme-crm',placement({database_location:'weur'})),['d1','create','--name','acme-crm','--primary-location-hint','weur']);
  for(const bad of [{database_jurisdiction:'us'},{database_location:'moon'},{database_jurisdiction:'eu',database_location:'weur'}])assert.throws(()=>placement(bad));
  assert.deepEqual(outcome({code:1,stdout:'',stderr:'┌ APIError\n│ [10007] This Worker does not exist on your account.\n│ 404 Not Found · HTTP /accounts/x/workers/workers/y\n└'}),{ok:false,code:10007,status:404});
  assert.deepEqual(outcome({code:0,stdout:'not json'}),{ok:false,code:null,status:null});
  assert.equal(profileName('acme-site'),'lp-acme-site');assert.throws(()=>profileName('../x'));
  const env=environment(A);assert.equal(env.CF_SEND_TELEMETRY,'false');assert.equal(env.CI,'1');assert.equal(env.CLOUDFLARE_ACCOUNT_ID,A);
  assert.equal(environment(null,{interactive:true}).CI,undefined);
});

test('the template pins the cf version the adapter was checked against',()=>{
  assert.equal(cfInstalled(ROOT),true);assert.match(cfBin(ROOT),/node_modules\/cf\/bin\/cf$/);
  assert.equal(cfInstalled(mkdtempSync(path.join(tmpdir(),'no-cf-'))),false);
});

// A stand-in for the Cloudflare API with the envelopes and errors the real one returns.
function stubApi() {
  const calls=[],rulesets=new Map();let dnsRecords=[{id:'f'.repeat(32),name:'quote.acme.com',type:'CNAME',content:'old-site.example.net',proxied:true}];
  const route=(method,url,body)=>{
    const {pathname,searchParams}=new URL(url,'http://stub');const p=pathname.replace('/client/v4','');
    if(method==='GET'&&p==='/accounts')return [200,ok([{id:A,name:'Acme Plumbing Ltd',type:'standard'},{id:B,name:'Agency',type:'standard'}])];
    if(method==='GET'&&p==='/zones'){const name=searchParams.get('name');return [200,ok(name==='acme.com'&&searchParams.get('account.id')===A?[{id:Z,name:'acme.com',status:'active',account:{id:A,name:'Acme Plumbing Ltd'},plan:{name:'Free Website'}}]:[])];}
    if(method==='GET'&&p===`/zones/${Z}/dns_records`)return [200,ok(dnsRecords.filter(r=>r.name===searchParams.get('name')))];
    if(method==='GET'&&p===`/accounts/${A}/workers/workers/acme-site`)return [404,fail(10007,'This Worker does not exist on your account.')];
    if(method==='GET'&&p===`/accounts/${A}/d1/database`)return [200,ok(searchParams.get('name')==='acme-site-crm'?[{uuid:DB,name:'acme-site-crm',version:'production'}]:[])];
    if(method==='POST'&&p===`/accounts/${A}/d1/database`)return [200,ok({uuid:'33333333-3333-4333-8333-333333333333',name:body.name,version:'production'})];
    if(method==='GET'&&p===`/accounts/${A}/d1/database/${DB}/time_travel/bookmark`)return [200,ok({bookmark:'00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683'})];
    if(method==='GET'&&p===`/zones/${Z}/rulesets/phases/http_ratelimit/entrypoint`)return rulesets.has(Z)?[200,ok(rulesets.get(Z))]:[404,fail(10003,'could not find entrypoint ruleset in the http_ratelimit phase')];
    if(method==='POST'&&p===`/zones/${Z}/rulesets`){rulesets.set(Z,{id:'9'.repeat(32),...body});return [200,ok(rulesets.get(Z))];}
    return [404,fail(7003,'No route for that URI')];
  };
  const server=http.createServer((req,res)=>{let text='';req.on('data',d=>text+=d);req.on('end',()=>{
    const body=text?JSON.parse(text):undefined;calls.push({method:req.method,url:req.url,auth:req.headers.authorization,body});
    const [status,value]=route(req.method,req.url,body);res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));});});
  return {calls,server,clearDns:()=>{dnsRecords=[];}};
}
async function withStub(t) {
  const stub=stubApi();await new Promise(resolve=>stub.server.listen(0,'127.0.0.1',resolve));
  const home=mkdtempSync(path.join(tmpdir(),'cf-home-'));
  t.after(()=>{stub.server.close();rmSync(home,{recursive:true,force:true});});
  // Nothing is inherited: no real token, account, profile or keyring can be picked up.
  const base={PATH:process.env.PATH,HOME:home,XDG_CONFIG_HOME:path.join(home,'.config'),CLOUDFLARE_API_BASE_URL:`http://127.0.0.1:${stub.server.address().port}/client/v4`,CLOUDFLARE_API_TOKEN:'synthetic-token-not-real',CLOUDFLARE_AUTH_USE_KEYRING:'false'};
  const run=(exe,args,{env={},timeout=60000}={})=>new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{env:{...base,...env},cwd:home});let stdout='',stderr='';
    const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
    child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});
  });
  return {stub,run,bin:cfBin(ROOT)};
}

test('the pinned cf lists accounts, checks the zone and hostname, and places a new database',{timeout:180000},async t=>{
  const {stub,run,bin}=await withStub(t);
  const api=client(run,bin,{account:A});
  assert.deepEqual(await client(run,bin).accounts(),[{id:A,name:'Acme Plumbing Ltd'},{id:B,name:'Agency'}]);
  // A new Worker on a hostname that already serves another site is stopped before any change.
  const blocked=await destination(api,{account:A,host:'quote.acme.com',worker:'acme-site'});
  assert.equal(blocked.status,'dns_conflict');assert.deepEqual(blocked.dns.records,[{type:'CNAME',content:'old-site.example.net',proxied:true}]);
  stub.clearDns();
  assert.deepEqual(await destination(api,{account:A,host:'quote.acme.com',worker:'acme-site'}),{status:'ready',zone:{id:Z,name:'acme.com',status:'active',plan:'Free Website'},worker:'new',dns:{state:'clear'}});
  assert.equal((await destination(api,{account:A,host:'quote.other.org',worker:'acme-site'})).status,'zone_missing');
  assert.deepEqual(await api.databases('acme-site-crm'),[{id:DB,name:'acme-site-crm'}]);
  assert.deepEqual(await api.createDatabase('acme-new-crm',placement({database_jurisdiction:'eu'})),{id:'33333333-3333-4333-8333-333333333333',name:'acme-new-crm'});
  assert.equal((await api.bookmark(DB)).bookmark,'00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683');
  const created=stub.calls.find(c=>c.method==='POST'&&c.url.endsWith('/d1/database'));
  assert.deepEqual(created.body,{jurisdiction:'eu',name:'acme-new-crm'});
  assert.ok(stub.calls.every(c=>c.auth==='Bearer synthetic-token-not-real'),'every request carried only the synthetic token');
});

test('the form rate-limit rule is created and read back through cf',{timeout:180000},async t=>{
  const {stub,run,bin}=await withStub(t);
  const input={intent:{domain:'quote.acme.com',account_id:A},attestations:{}};
  const api=client(run,bin,{account:A});
  assert.deepEqual(await edgeProtection(ROOT,input,false,api),{status:'configuration-needed',automatically_verified:false,zone_id:Z});
  assert.deepEqual(await edgeProtection(ROOT,input,true,api),{status:'api-verified',automatically_verified:true,zone_id:Z});
  const created=stub.calls.find(c=>c.method==='POST'&&c.url.endsWith(`/zones/${Z}/rulesets`));
  assert.equal(created.body.phase,'http_ratelimit');assert.deepEqual(created.body.rules,[rateRule()]);
});

test('owner confirmation settles the edge rule when the login cannot read rules',async()=>{
  const api={zones:async()=>[{id:Z,name:'acme.com',status:'active',account:{id:A}}],entrypoint:async()=>({ok:false,status:403,value:null})};
  const input={intent:{domain:'landing.acme.com',account_id:A},attestations:{}};
  await assert.rejects(edgeProtection(ROOT,input,true,api),error=>error.code==='edge');
  // Previously this asked again forever: the confirmation was never accepted.
  assert.deepEqual(await edgeProtection(ROOT,{...input,attestations:{edge:{value:true}}},true,api),{status:'owner-confirmed',automatically_verified:false});
});
