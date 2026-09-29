/** Cloudflare `cf` CLI adapter for guided publishing, run only by the person publishing
 * (never the coding agent). They connect their own Cloudflare account through cf, which
 * then chooses the account by name, confirms the zone and hostname before any change,
 * places the D1 database, records the recovery point and manages the form rate-limit
 * rule. The pinned Wrangler still uploads the Worker, applies migrations and stores
 * secrets over stdin: cf deploy cannot yet attach the per-release identity the live
 * checks verify. The project's own locked copy of cf is used, like Wrangler's. */
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';

export const CF_VERSION='1.0.0-beta.5';
export const JURISDICTIONS=['eu','fedramp'];
export const LOCATIONS=['weur','eeur','apac','oc','wnam','enam'];
const ACCOUNT=/^[a-f0-9]{32}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value,max=80)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);

export function cfInstalled(root) {
  const pkg=path.join(root,'node_modules/cf/package.json');
  try{return existsSync(pkg)&&JSON.parse(readFileSync(pkg,'utf8')).version===CF_VERSION;}catch{return false;}
}
export function cfBin(root) {
  if(!cfInstalled(root))throw new Error('Install the locked Cloudflare CLI with npm ci before publishing.');
  return path.join(root,'node_modules/cf/bin/cf');
}
// No telemetry, colour or progress output; CI mode keeps cf from prompting or checking
// for updates. Only an interactive sign-in drops it.
export function environment(account,{interactive=false}={}) {
  return {CF_SEND_TELEMETRY:'false',WRANGLER_SEND_METRICS:'false',DO_NOT_TRACK:'1',NO_COLOR:'1',CF_NO_OSC_PROGRESS:'1',
    ...(interactive?{}:{CI:'1',CF_QUIET:'1'}),...(ACCOUNT.test(account||'')?{CLOUDFLARE_ACCOUNT_ID:account}:{})};
}
// One cf sign-in profile per project, bound to its directory, so every cf call there
// uses the account owner's own login even when they publish for several businesses.
export const profileName=site=>{if(!/^[a-z][a-z0-9-]{2,48}$/.test(site||''))throw new Error('Invalid site name for a Cloudflare profile.');return 'lp-'+site;};
// cf prints the API result as JSON on success. Failures print `[code] message` and
// `404 Not Found · HTTP <path>` to stderr; only the numbers are kept.
export function outcome(result) {
  if(result.code===0){try{return {ok:true,value:JSON.parse(result.stdout)};}catch{return {ok:false,code:null,status:null};}}
  const text=String(result.stderr||'')+'\n'+String(result.stdout||'');
  const code=/\[(\d{3,6})\]/.exec(text)?.[1],status=/\b([45]\d\d) [A-Za-z][A-Za-z ]* · HTTP/.exec(text)?.[1];
  return {ok:false,code:code?Number(code):null,status:status?Number(status):null};
}
export function accountsFrom(value) {
  return Array.isArray(value)?value.filter(a=>ACCOUNT.test(a?.id||'')).map(a=>({id:a.id,name:clean(a.name)||a.id})):[];
}
export function zoneCandidates(host) {
  const labels=String(host).toLowerCase().split('.');
  return labels.slice(0,-1).map((_,index)=>labels.slice(index).join('.')).filter(name=>name.includes('.'));
}
export function zoneFor(host,zones,account) {
  const h=String(host).toLowerCase();
  return (Array.isArray(zones)?zones:[]).filter(z=>ACCOUNT.test(z?.id||'')&&typeof z.name==='string'&&(h===z.name.toLowerCase()||h.endsWith('.'+z.name.toLowerCase()))&&(!account||z.account?.id===account))
    .sort((a,b)=>b.name.length-a.name.length)
    .map(z=>({id:z.id,name:z.name.toLowerCase(),status:clean(z.status,20),plan:clean(z.plan?.name,40)||null}))[0]||null;
}
// Workers Custom Domains refuse a hostname that already has address records, and on
// an apex those are usually the owner's existing website.
export function dnsState(records,host) {
  const h=String(host).toLowerCase();
  const found=(Array.isArray(records)?records:[]).filter(r=>String(r?.name||'').toLowerCase()===h&&['A','AAAA','CNAME'].includes(r.type));
  return found.length?{state:'occupied',records:found.slice(0,5).map(r=>({type:r.type,content:clean(r.content,120),proxied:r.proxied===true}))}:{state:'clear'};
}
export function databaseFrom(value,name) {
  return value&&UUID.test(value.uuid||'')&&(!name||value.name===name)?{id:value.uuid.toLowerCase(),name:value.name}:null;
}
export function placement(intent) {
  const jurisdiction=intent?.database_jurisdiction,location=intent?.database_location;
  if(jurisdiction!==undefined&&!JURISDICTIONS.includes(jurisdiction))throw new Error('Unsupported D1 jurisdiction.');
  if(location!==undefined&&!LOCATIONS.includes(location))throw new Error('Unsupported D1 location hint.');
  if(jurisdiction&&location)throw new Error('Choose a D1 jurisdiction or a location hint, not both; a jurisdiction overrides the hint.');
  return {jurisdiction:jurisdiction||null,location:location||null};
}
export const createArgs=(name,where)=>['d1','create','--name',name,...(where.jurisdiction?['--jurisdiction',where.jurisdiction]:where.location?['--primary-location-hint',where.location]:[])];
export function client(run,bin,{account}={}) {
  const call=async(args,options={})=>outcome(await run(process.execPath,[bin,...args],{env:environment(account),timeout:120000,...options}));
  const list=async args=>{const r=await call(args);return r.ok&&Array.isArray(r.value)?r.value:null;};
  return {
    call,
    accounts:async()=>{const r=await list(['accounts','list','--per-page','50']);return r&&accountsFrom(r);},
    async zones(host){
      const found=[];
      for(const name of zoneCandidates(host)){const r=await list(['zones','list','--name',name,'--account-id',account,'--per-page','5']);if(!r)return null;found.push(...r);}
      return found;
    },
    dns:(zone,host)=>list(['dns','records','list','--zone',zone,'--name',host,'--per-page','20']),
    async worker(name){const r=await call(['workers','get',name]);return r.ok?'exists':r.code===10007||r.status===404?'missing':null;},
    async databases(name){const r=await list(['d1','list','--name',name,'--per-page','20']);return r&&r.map(d=>databaseFrom(d,name)).filter(Boolean);},
    async createDatabase(name,where){const r=await call(createArgs(name,where));return r.ok?databaseFrom(r.value,name):null;},
    async bookmark(database){const r=await call(['d1','time-travel','get-bookmark',database]);return r.ok?r.value:null;},
    async entrypoint(zone){const r=await call(['rulesets','account-rulesets','phases','get','http_ratelimit','--zone',zone]);return r.ok?{ok:true,status:200,value:r.value}:{ok:false,status:r.status??(r.code===10003?404:0),value:null};},
    async addRule(zone,ruleset,rule){const r=await call(['rulesets','account-rulesets','rules','create',ruleset,'--zone',zone,'--body',JSON.stringify(rule)]);return {ok:r.ok,status:r.status};},
    async createRuleset(zone,body){const r=await call(['rulesets','account-rulesets','create','--zone',zone,'--body',JSON.stringify(body)]);return {ok:r.ok,status:r.status};},
  };
}
// Read-only destination check before hosting consent: the zone must be active in the
// chosen account and, for a new Worker, the hostname must be free of address records.
export async function destination(api,{account,host,worker}) {
  const zones=await api.zones(host);if(!zones)return {status:'unavailable'};
  const zone=zoneFor(host,zones,account);
  if(!zone)return {status:'zone_missing',host};
  if(zone.status!=='active')return {status:'zone_pending',zone};
  const existing=await api.worker(worker);if(!existing)return {status:'unavailable',zone};
  if(existing==='exists')return {status:'ready',zone,worker:'existing',dns:{state:'existing-worker'}};
  const records=await api.dns(zone.id,host);if(!records)return {status:'unavailable',zone};
  const dns=dnsState(records,host);
  return {status:dns.state==='occupied'?'dns_conflict':'ready',zone,worker:'new',dns};
}
