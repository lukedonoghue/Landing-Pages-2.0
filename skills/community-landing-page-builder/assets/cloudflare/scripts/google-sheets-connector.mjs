import { readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync,lstatSync,chmodSync } from 'node:fs';
import { createHmac,randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetsEndpoint } from '../src/sheets-protocol.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function externalOutput(raw,base=root) {
  if(!raw)throw new Error('Choose --out outside the project for the private Script Properties handoff.');
  const file=path.resolve(raw);let parent=path.dirname(file),tail=[path.basename(file)];
  while(!existsSync(parent)){tail.unshift(path.basename(parent));parent=path.dirname(parent);}
  const actual=path.resolve(realpathSync(parent),...tail),rel=path.relative(realpathSync(base),actual);
  if(!rel || (!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw new Error('The private handoff must be outside the project.');
  if(existsSync(file))throw new Error('Choose a new private handoff filename.');return actual;
}
export async function runSheets(args) {
  const action=args.shift(),options={};
  if(!['prepare','connect','rotate','status'].includes(action))throw new Error('Use prepare, connect, rotate or status.');
  for(let i=0;i<args.length;i+=2){const k=args[i];if(!['--web-app-url','--out','--version'].includes(k)||k in options||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Invalid or repeated Sheets option.');options[k]=args[i+1];}
  if(action==='prepare')return {status:'ready',code:'google-apps-script/Code.gs',manifest:'google-apps-script/appsscript.json',next:'Create a standalone Apps Script project, deploy /exec, then run sheets:connect with the URL and an external --out file.'};
  const url=sheetsEndpoint(options['--web-app-url']);
  if(action==='status'){
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000)});
    // A ContentService redirect confirms an endpoint exists, NOT authenticated delivery or row persistence.
    return {reachable:response.ok||response.status===302,delivery_verified:false,note:'Use an explicitly authorized synthetic lead to verify signed delivery. A GET is not proof of a spreadsheet row.'};
  }
  const version=Number(options['--version']||1);
  if(!Number.isSafeInteger(version)||version<1||(action==='rotate'&&version<2))throw new Error('Rotation requires --version greater than the connection current version.');
  const out=externalOutput(options['--out']);
  const file=path.join(root,'.secrets/production.json');
  if(lstatSync(file).isSymbolicLink())throw new Error('Refusing a symlink secret file.');
  const secrets=JSON.parse(readFileSync(file,'utf8'));
  if(!secrets.GOOGLE_SHEETS_SIGNING_SECRET){secrets.GOOGLE_SHEETS_SIGNING_SECRET=randomBytes(32).toString('hex');writeFileSync(file,JSON.stringify(secrets,null,2)+'\n',{mode:0o600});}
  chmodSync(file,0o600);
  if(!/^[a-f0-9]{64}$/.test(secrets.GOOGLE_SHEETS_SIGNING_SECRET))throw new Error('Invalid Sheets master secret.');
  const key=createHmac('sha256',secrets.GOOGLE_SHEETS_SIGNING_SECRET).update(`sheets:v1:${version}:${url}`).digest('hex');
  mkdirSync(path.dirname(out),{recursive:true,mode:0o700});
  writeFileSync(out,JSON.stringify({CRM_CONNECTION_SECRET:key,CRM_KEY_VERSION:String(version),CRM_SPREADSHEET_ID:'SET_THE_CLIENT_SPREADSHEET_ID'},null,2)+'\n',{flag:'wx',mode:0o600});
  return {status:'prepared-not-deployed',key_version:version,private_handoff:out,web_app_url:url,next:action==='rotate'?'Operator: update Script Properties, then PATCH this connection with sheets_key_version. Retry failed deletions after rotation.':'Operator: set Script Properties, upload GOOGLE_SHEETS_SIGNING_SECRET from a trusted operator terminal with wrangler secret put (a repeat code-only publish does not upload new secrets), then add the clean /exec URL in CRM Connections. Never paste private file contents into an AI chat.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runSheets(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{console.error('Sheets setup did not complete. Check the clean deployment URL, key version and private external handoff path. No credential was printed.');process.exitCode=1;});
