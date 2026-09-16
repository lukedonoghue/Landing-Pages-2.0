import {existsSync,readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2), option=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
const run=(command,argv,capture=false)=>{const r=spawnSync(command,argv,{stdio:capture?'pipe':'inherit',encoding:'utf8'});if(r.status!==0){if(capture)console.error(r.stderr||r.stdout);throw new Error(`${command} ${argv.join(' ')} failed`);}return r.stdout||'';};
const node=argv=>run(process.execPath,argv);
const wrangler=(argv,capture=false)=>run(process.execPath,['node_modules/wrangler/bin/wrangler.js',...argv],capture);
try {
 if(!existsSync('.secrets/production.json')&&!process.env.CI)throw new Error('Run guided production setup before publishing; production credentials are missing. No remote changes were made.');
 if(!existsSync('scripts/workflow.py'))throw new Error('The human approval workflow is missing. Re-scaffold or restore the release helpers.');
 run('python3',['scripts/workflow.py','check-publish','.']);
 node(['scripts/preflight.mjs']);
 if(!existsSync('tests/backend.test.mjs'))throw new Error('Backend regression tests are missing.');
 node(['--test',...readdirSync('tests').filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/'+name)]);
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 const approval=JSON.parse(readFileSync('build/workflow.json','utf8')).approvals.publish;
 const fixture=option('--fixture')||'test-fixture.json';
 if(!existsSync(fixture))throw new Error('A validated test-fixture.json is required before deployment.');
 const credentials=option('--credentials-file');
 const passwordFile=option('--password-file')||'.secrets/production-admin-password.txt';
 if(!credentials&&!existsSync(passwordFile))throw new Error('Provide a private admin credential/password file for post-deployment verification.');
 const secrets=existsSync('.secrets/production.json')?JSON.parse(readFileSync('.secrets/production.json','utf8')):null;
 if(secrets){
  if(!secrets.ADMIN_USERNAME||!secrets.ADMIN_PASSWORD_HASH||!secrets.SESSION_SECRET)throw new Error('Production owner credentials are incomplete.');
  process.env.ADMIN_USERNAME=secrets.ADMIN_USERNAME;
 }else{
  const names=JSON.parse(wrangler(['secret','list'],true)).map(x=>x.name);
  if(!['ADMIN_USERNAME','ADMIN_PASSWORD_HASH','SESSION_SECRET'].every(x=>names.includes(x)))throw new Error('Production admin secrets are not provisioned.');
 }
 // Local checks and both real human approvals have passed before any remote mutation.
 wrangler(['d1','migrations','apply','DB','--remote']);
 const deployed=wrangler(['deploy'],true);process.stdout.write(deployed);
 if(secrets)wrangler(['secret','bulk','.secrets/production.json']);
 const url=option('--url') || (config.routes?.find(route=>route.custom_domain)?.pattern ? `https://${config.routes.find(route=>route.custom_domain).pattern}` : deployed.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev\b/)?.[0]);
 if(!url)throw new Error('Upload completed but its URL could not be resolved. Supply --url to run verification; do not call this launch verified.');
 const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw new Error('Post-deployment verification needs a clean HTTPS origin.');
 // Never send the admin password or synthetic lead to an unrelated --url host.
 const deployedOrigins=[...deployed.matchAll(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev\b/g)].map(match=>new URL(match[0]).origin);
 const configuredOrigins=(config.routes||[]).filter(route=>route.custom_domain).map(route=>new URL(`https://${route.pattern}`).origin);
 if(![...configuredOrigins,...deployedOrigins].includes(parsed.origin))throw new Error('Verification URL is not a configured custom domain or the Worker URL returned by this deployment. Credentials were not sent.');
 const version=deployed.match(/Current Version ID:\s*([0-9a-f-]+)/i)?.[1]||null;
 mkdirSync('build',{recursive:true});
 writeFileSync('build/deployment-record.json',JSON.stringify({url:parsed.origin,worker:config.name,database_id:config.d1_databases[0].database_id,version_id:version,uploaded_at:new Date().toISOString(),verification_pending:true},null,2)+'\n');
 run('python3',['scripts/check_gates.py','snapshot','.', '--mode','live']);
 const verify=['scripts/live-verify.mjs','--url',parsed.origin,'--allow-remote','--fixture',fixture,'--deployment-record','build/deployment-record.json','--project-root','.'];
 if(credentials)verify.push('--credentials-file',credentials);else verify.push('--password-file',passwordFile);
 if(approval.allow_test_lead)verify.push('--allow-test-lead');else verify.push('--read-only');
 node(verify);
 const report=JSON.parse(readFileSync('build/live-verification/result.json','utf8'));
 if(report.fully_verified!==true)throw new Error('Uploaded, but full live verification is incomplete. Review the recorded checks before sending traffic.');
 console.log(`Published and verified: ${parsed.origin}`);
} catch(error){console.error(error.message);process.exitCode=1;}
