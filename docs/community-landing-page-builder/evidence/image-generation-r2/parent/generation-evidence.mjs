import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const agent='01a0bf8c-0c10-7941-87c5-61cc6e36cb11';
const transcript=`/Users/mac/.codex/sessions/2026/09/20/rollout-2026-09-20T19-00-21-${agent}.jsonl`;
const events=(await readFile(transcript,'utf8')).trim().split('\n').map(JSON.parse);
const calls=events.filter(e=>e.payload?.type==='custom_tool_call'&&/await tools\.image_gen__imagegen\(/.test(e.payload.input||''));
const dir=`/Users/mac/.codex/generated_images/${agent}`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const returned=[];
for(const name of await readdir(dir)){if(name.endsWith('.png'))returned.push({file:name,sha256:hash(await readFile(`${dir}/${name}`))});}
const originals=[];
for(const name of ['hero-original.png','studio-original.png']){const bytes=await readFile(new URL(`../../runs/image-generation-r2/research/${name}`,import.meta.url));const sha256=hash(bytes);originals.push({file:`research/${name}`,sha256,matchesReturned:returned.find(a=>a.sha256===sha256)?.file||null});}
const data={agent,scope:'Only native image calls and SHA-256 original matching, no unrelated conversation exported.',calls:calls.map(e=>({timestamp:e.timestamp,callId:e.payload.call_id,invocation:e.payload.input,completion:events.find(o=>o.payload?.type==='custom_tool_call_output'&&o.payload.call_id===e.payload.call_id)?.timestamp})),originals,model:'Not returned by tool'};
await writeFile(new URL('generation-evidence.json',import.meta.url),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({calls:calls.length,originals}));
