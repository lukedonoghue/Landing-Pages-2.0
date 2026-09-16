import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const args = process.argv.slice(2);
const option = name => { const i=args.indexOf(name); return i < 0 ? null : args[i+1]; };
const run = (command, args, capture=false) => {
  const result=spawnSync(command,args,{stdio:capture?'pipe':'inherit',encoding:'utf8'});
  if(result.status!==0) throw new Error(`${command} ${args.join(' ')} failed. ${capture ? result.stderr || '' : 'See the message above.'}`);
  return result.stdout;
};
const wrangler=(args,capture=false)=>run(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],capture);
const configPath='wrangler.jsonc';
const readConfig=()=>JSON.parse(readFileSync(configPath,'utf8'));
const saveConfig=config=>writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
const credentials=(kind)=>{
  mkdirSync('.secrets',{recursive:true,mode:0o700});
  const filename=`.secrets/${kind}.json`;
  const username=(option('--admin-username') || 'owner').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._@+-]{2,79}$/.test(username))throw new Error('Admin username must be 3–80 letters, numbers or email characters.');
  if(existsSync(filename)){const existing=JSON.parse(readFileSync(filename,'utf8'));if(!existing.ADMIN_USERNAME){existing.ADMIN_USERNAME=username;writeFileSync(filename,JSON.stringify(existing,null,2)+'\n',{mode:0o600});}else if(option('--admin-username')&&existing.ADMIN_USERNAME!==username)throw new Error(`Use npm run admin -- change-username --${kind==='production'?'remote':'local'} --username <new-owner>. Setup preserves the original bootstrap identity.`);return existing;}
  const password=randomBytes(24).toString('base64url');
  const salt=randomBytes(16).toString('hex');
  const hash=pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
  const secrets={ADMIN_USERNAME:username,ADMIN_PASSWORD_HASH:`pbkdf2_sha256$100000$${salt}$${hash}`,SESSION_SECRET:randomBytes(32).toString('hex'),WEBHOOK_SIGNING_SECRET:randomBytes(32).toString('hex')};
  writeFileSync(filename,JSON.stringify(secrets,null,2)+'\n',{mode:0o600,flag:'wx'});
  writeFileSync(`.secrets/${kind}-admin-password.txt`,password+'\n',{mode:0o600,flag:'wx'});
  return secrets;
};

try {
  const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
  if(nodeMajor<22||(nodeMajor===22&&nodeMinor<19)) throw new Error('Use Node.js 22.19 or newer, then npm ci.');
  if(!existsSync('node_modules/wrangler/bin/wrangler.js')) throw new Error('Run npm ci first.');
  if(args.includes('--cloudflare') && existsSync('funnel.json') && JSON.parse(readFileSync('funnel.json','utf8')).development_fixture === true) throw new Error('Fictional development fixtures cannot use remote setup. Start a new client project.');
  let config=readConfig();
  const site=option('--site');
  if(site){
    if(!/^[a-z][a-z0-9-]{2,48}$/.test(site)) throw new Error('--site must be a lowercase name with letters, numbers, and hyphens (3–49 characters).');
    if(config.d1_databases[0].database_id!=='00000000-0000-0000-0000-000000000000' && config.name!==site) throw new Error('This project is already bound to a database. Create a separate project for another client.');
    config.name=site;config.d1_databases[0].database_name=site+'-crm';
  }
  const account=option('--account-id');
  if(account){if(!/^[a-f0-9]{32}$/.test(account)) throw new Error('Invalid Cloudflare account ID.');config.account_id=account;}
  const domain=option('--domain');
  if(domain){
    if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) throw new Error('Supply only a domain or subdomain, without https or a path.');
    config.routes=[{pattern:domain.toLowerCase(),custom_domain:true}];
  }
  saveConfig(config);
  if(args.includes('--cloudflare')){
    if(config.name === 'branded-lead-funnel') throw new Error('Supply a unique client/site name with --site before remote setup. The shared starter name cannot be deployed.');
    if(!config.account_id && !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('Run wrangler whoami, then supply --account-id for the intended client account.');
    // Reuse an existing explicit instruction; this is not an extra approval checkpoint.
    // Remote provisioning precedes the final configured QA snapshot/publish approval.
    const authorizationFile=option('--authorization-file');
    const authorizationMessageId=option('--authorization-message-id');
    if(!authorizationFile||!authorizationMessageId||!existsSync(authorizationFile))throw new Error('Remote setup requires the existing user setup/publish instruction: --authorization-file <private message file> --authorization-message-id <conversation/message reference>. No Cloudflare changes were made.');
    const authorization=readFileSync(authorizationFile,'utf8').trim();
    if(!authorization||!authorizationMessageId.trim())throw new Error('Setup authorization must contain the actual user instruction and its message reference.');
    if(!existsSync('scripts/workflow.py'))throw new Error('The current copy approval checker is missing. Re-scaffold the project.');
    run('python3',['scripts/workflow.py','check-copy','.']);
    mkdirSync('build',{recursive:true});
    writeFileSync('build/setup-authorization.json',JSON.stringify({actor:'user',message:authorization,message_id:authorizationMessageId.trim(),recorded_at:new Date().toISOString(),scope:'Cloudflare infrastructure setup only; final publish approval is separate',target:{worker:config.name,account_id:config.account_id||process.env.CLOUDFLARE_ACCOUNT_ID,domains:config.routes||[]}},null,2)+'\n',{mode:0o600});
    wrangler(['whoami']);
    if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000'){
      const databases=JSON.parse(wrangler(['d1','list','--json'],true));
      const existing=databases.find(db=>db.name===config.d1_databases[0].database_name);
      if(existing) {
        if(option('--database-id')!==existing.uuid) throw new Error(`A database named ${existing.name} already exists. To bind that verified existing client database, rerun with --database-id ${existing.uuid}; otherwise choose a different --site name.`);
        config.d1_databases[0].database_id=existing.uuid;
      }
      else {
        const output=wrangler(['d1','create',config.d1_databases[0].database_name,'--no-update-config'],true);
        const id=output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
        if(!id) throw new Error('Database creation returned no ID. Check wrangler d1 list; do not create another database.');
        config.d1_databases[0].database_id=id;
      }
      saveConfig(config);
    }
    credentials('production');
    console.log('Cloudflare database configured. Production login saved in .secrets/production-admin-password.txt. Next: finish QA, then npm run publish. GitHub is optional; the page, CRM and data all run on Cloudflare.');
  } else {
    const secrets=credentials('local');
    if(!existsSync('.dev.vars')) writeFileSync('.dev.vars',Object.entries(secrets).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
    else if(!/^ADMIN_USERNAME=/m.test(readFileSync('.dev.vars','utf8')))writeFileSync('.dev.vars',readFileSync('.dev.vars','utf8')+'\nADMIN_USERNAME='+JSON.stringify(secrets.ADMIN_USERNAME)+'\n',{mode:0o600});
    wrangler(['d1','migrations','apply','DB','--local']);
    console.log('Local database and admin ready. Login password is in .secrets/local-admin-password.txt. Next: npm run dev.');
  }
} catch(error){console.error(error.message);process.exitCode=1;}
