import {readFile,writeFile,readdir,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const agent='01a0bf74-8593-7a33-8204-a3afdeb19e56';
const transcript=`/Users/mac/.codex/sessions/2026/09/20/rollout-2026-09-20T18-34-39-${agent}.jsonl`;
const events=(await readFile(transcript,'utf8')).trim().split('\n').map(JSON.parse);
const calls=events.filter(e=>e.payload?.type==='custom_tool_call'&&/await tools\.image_gen__imagegen\(/.test(e.payload.input||''));
const conversion=events.find(e=>e.payload?.type==='custom_tool_call'&&(e.payload.input||'').includes('cwebp -quiet -q 84'));
const originals=`/Users/mac/.codex/generated_images/${agent}`;
await mkdir(new URL('generated-originals/',import.meta.url),{recursive:true});
const assets=[];
for(const name of await readdir(originals)) {
  if(!name.endsWith('.png'))continue;
  const bytes=await readFile(`${originals}/${name}`);
  const target=new URL(`generated-originals/${name}`,import.meta.url);
  await copyFile(`${originals}/${name}`,target);
  assets.push({file:`generated-originals/${name}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const evidence={agent,scope:'Only native image-generation calls and public asset conversion from this independent run. No other conversation, credentials or transcript exported.',calls:calls.map(e=>({timestamp:e.timestamp,callId:e.payload.call_id,invocation:e.payload.input,completion:events.find(o=>o.payload?.type==='custom_tool_call_output'&&o.payload.call_id===e.payload.call_id)?.timestamp})),conversion:{timestamp:conversion.timestamp,invocation:conversion.payload.input},assets,model:'Not reported by image tool',observation:'Three successful generation calls, two images used. First response was incorrectly treated as MCP content and not surfaced; third call regenerated the hero. Tool-managed originals were not included in the builder project. Parent preserved them here as evidence, without editing the page.'};
await writeFile(new URL('generation-evidence.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({calls:calls.length,originals:assets.length,report:fileURLToPath(new URL('generation-evidence.json',import.meta.url))}));
