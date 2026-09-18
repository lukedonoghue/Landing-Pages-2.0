import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const args=process.argv.slice(2),repo=args[args.indexOf('--repo')+1];
if(!args.includes('--repo')||!/^[-\w.]+\/[-\w.]+$/.test(repo||''))throw new Error('Usage: npm run github -- --repo owner/repository');
const run=(cmd,args,capture=false)=>{const r=spawnSync(cmd,args,{stdio:capture?'pipe':'inherit',encoding:'utf8'});if(r.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed`);return r.stdout?.trim();};
run(process.execPath,['scripts/preflight.mjs']);
if(!existsSync('.git'))run('git',['init','-b','main']);
const tracked=run('git',['ls-files'],true);
if(tracked.split('\n').some(p=>/(^|\/)(\.secrets|\.dev\.vars|\.env|node_modules|\.wrangler)(\/|$|\.)/.test(p)))throw new Error('A secret/runtime directory is tracked. Remove it from the Git index before publishing.');
const remote=spawnSync('git',['remote','get-url','origin'],{encoding:'utf8'});
if(remote.status===0){
 const normalized=remote.stdout.trim().replace(/\.git$/,'');
 if(![`https://github.com/${repo}`,`git@github.com:${repo}`,`ssh://git@github.com/${repo}`].includes(normalized))throw new Error('Origin is not the requested github.com repository. It was not changed or pushed.');
}
const files=['public','src','migrations','scripts','tests','package.json','package-lock.json','wrangler.jsonc','.gitignore','.node-version','.github','funnel.json','docs','research'].filter(existsSync);
run('git',['add','--',...files]);
const staged=spawnSync('git',['diff','--cached','--quiet']);
if(staged.status===1)run('git',['commit','-m','Build branded funnel with D1 CRM and verified delivery']);
if(remote.status===0){
  run('git',['push','-u','origin','HEAD']);
}else run('gh',['repo','create',repo,'--private','--source','.','--remote','origin','--push']);
console.log('Optional source backup published. The funnel can be published directly with npm run publish; GitHub is not required for Cloudflare hosting.');
