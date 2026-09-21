import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {freePlanFailures} from './free-plan.mjs';
const failures=[];
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
failures.push(...freePlanFailures(config));
if(!existsSync('public/index.html')||!existsSync('public/thank-you.html')) failures.push('Build the landing and thank-you pages in public/.');
for(const file of ['public/funnel.js','public/privacy-controls.js','public/privacy-controls.css','public/privacy.html'])if(!existsSync(file))failures.push(`Visitor privacy controls require ${file}.`);
for(const file of ['public/index.html','public/thank-you.html','public/privacy.html'])if(existsSync(file)&&!/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\bfunnel\.js(?:[?#][^"']*)?["']/i.test(readFileSync(file,'utf8')))failures.push(`${file} must load funnel.js to keep privacy choices available.`);
if(!existsSync('src/site-config.json')) failures.push('Site configuration missing.');
const site=JSON.parse(readFileSync('src/site-config.json','utf8'));
if(site.name==='Your business') failures.push('Set the real client brand in src/site-config.json.');
if(!existsSync('funnel.json'))failures.push('Funnel configuration missing.');
else{
 const funnel=JSON.parse(readFileSync('funnel.json','utf8'));
 const selected=funnel.analytics?.attribution_mode,required=funnel.analytics?.required_attribution_mode;
 if(selected!==undefined&&!['consent','lead','disabled'].includes(selected))failures.push('analytics.attribution_mode must be consent, lead, or disabled.');
 if(required!==undefined&&!['consent','lead','disabled'].includes(required))failures.push('analytics.required_attribution_mode must be consent, lead, or disabled when supplied.');
 if(required&&required!==selected)failures.push(`Required attribution mode ${required} does not match analytics.attribution_mode ${selected}.`);
 if(selected!==undefined&&site.attributionMode!==selected)failures.push(`Attribution policy drift: funnel.json selects ${selected} but src/site-config.json uses ${site.attributionMode||'missing'}. Run npm run configure.`);
}
if(config.assets?.run_worker_first !== true) failures.push('All admin routes must run through the authenticated Worker.');

if(config.d1_databases?.[0]?.database_id==='00000000-0000-0000-0000-000000000000') failures.push('Run npm run setup -- --cloudflare --account-id <account> to bind the production database.');
if(config.name==='branded-lead-funnel') failures.push('Choose a unique client Worker name before production.');
const secretNames=['ADMIN_PASSWORD_HASH','SESSION_SECRET','WEBHOOK_SIGNING_SECRET'];
const secretValues=[];
function collectLocalSecrets(dir){
  if(!existsSync(dir))return;
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const p=dir+'/'+entry.name;if(entry.isDirectory())continue;
    const value=readFileSync(p,'utf8').trim();
    if(entry.name.endsWith('.json')){try{for(const v of Object.values(JSON.parse(value)))if(typeof v==='string'&&v.length>12)secretValues.push(v);}catch{failures.push('Local secret configuration is invalid.');}}
    else if(value.length>12)secretValues.push(value);
  }
}
collectLocalSecrets('.secrets');
function scan(dir){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const p=dir+'/'+entry.name;
  if(entry.isSymbolicLink()){failures.push(`Public symlink is not allowed: ${p}`);continue;}
  if(/^(?:\.env|\.dev\.vars)|(?:password|credential|secret|private.?key|erasure[-_]?record|suppression[-_]?record)|\.(?:pem|key|p12|pfx)$/i.test(entry.name)){failures.push(`Secret-like public path: ${p}`);continue;}
  if(entry.isDirectory()){scan(p);continue;}
  const buffer=readFileSync(p);
  if(secretValues.some(value=>buffer.includes(Buffer.from(value))))failures.push(`A local credential value leaked into ${p}`);
  if(/\.(html|js|json|txt)$/.test(p)){
   const text=buffer.toString('utf8');
   if(secretNames.some(key=>text.includes(key))||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push(`Secret configuration leaked into public asset ${p}`);
   const starterBrand=/<(?:a|span|div)\b[^>]*\bclass\s*=\s*["'][^"']*\bbrand\b[^"']*["'][^>]*>\s*Your business\s*<\//i.test(text);
   if(p.endsWith('.html')&&(starterBrand||/This is a development template|Replace this starter with your approved client content/.test(text)))failures.push(`${p} contains unfinished starter content.`);
   if(p.endsWith('.html')&&/data-local-preview\s*=\s*["']true/.test(text))failures.push(`${p} still uses simulated lead delivery.`);
  }
 }
}
if(existsSync('public')) scan('public');
if(!existsSync('scripts/check_gates.py')) failures.push('The project is missing its evidence checker; scaffold it through the skill.');
else {const result=spawnSync('python3',['scripts/check_gates.py','check','.', '--mode','handoff'],{stdio:'inherit'});if(result.status!==0)failures.push('Handoff evidence is missing or stale. Complete QA and visual review first.');}
if(failures.length){console.error(failures.map(x=>'- '+x).join('\n'));process.exit(1);}
console.log('Ready to publish this reviewed build directly to Cloudflare. No GitHub repository is required. Live-domain verification is still required after deployment.');
