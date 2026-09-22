/** Read-only local initial/final page capture for the control-comparison loop. */
import {readFile, writeFile, mkdir, lstat} from 'node:fs/promises';
import {resolve, dirname, relative, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
const {values} = parseArgs({options:{project:{type:'string'},url:{type:'string'},phase:{type:'string',default:'initial'},python:{type:'string',default:'python3'}}});
if(!values.project || !values.url || !['initial','final'].includes(values.phase))throw new Error('Use --project ROOT --url LOCAL_URL --phase initial|final');
const root=resolve(values.project),url=new URL(values.url),here=dirname(fileURLToPath(import.meta.url));
if(url.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password)throw new Error('Capture the local preview only. No live leads or production browsing are authorized by this tool.');
const sha=value=>createHash('sha256').update(value).digest('hex');
const fingerprint=()=>JSON.parse(execFileSync(values.python,[resolve(here,'control_review.py'),'fingerprint',root],{encoding:'utf8'}));
let chromium;
for(const base of [root,resolve(here,'../assets/cloudflare')]){
  try{({chromium}=await import(pathToFileURL(resolve(base,'node_modules/playwright-core/index.mjs')).href));break;}catch{}
}
if(!chromium)throw new Error('Install the pinned project browser dependencies and Chromium before capture.');
const output=resolve(root,'build/control-review'),id=randomUUID();
for(let path=root;path!==output;){path=resolve(path,relative(path,output).split(sep)[0]);try{if((await lstat(path)).isSymbolicLink())throw new Error('Control output cannot contain symlinks');}catch(error){if(error.code!=='ENOENT')throw error;}}
await mkdir(output,{recursive:true});
const input=fingerprint();const views=[];let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
  for(const [width,height] of [[1440,900],[390,844]]){
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    // Rendering is read-only: even auto-submitting page code cannot send a lead.
    await page.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
    try{
      const response=await page.goto(url.href,{waitUntil:'networkidle',timeout:30000});
      if(!response?.ok())throw new Error('Preview did not return a successful page response');
      await page.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);});
      // Resolve content-visibility for a complete review image, without deleting content.
      await page.addStyleTag({content:'* { content-visibility: visible !important; animation: none !important; transition: none !important; }'});
      const data=await page.evaluate(()=>({text:document.body.innerText,headings:[...document.querySelectorAll('h1,h2,h3')].filter(e=>e.getClientRects().length).map(e=>({level:e.tagName,text:e.innerText})),overflow:document.documentElement.scrollWidth>innerWidth+1}));
      const bytes=await page.screenshot({fullPage:true});
      const name=`${values.phase}-${id}-${width}.png`;await writeFile(resolve(output,name),bytes,{flag:'wx'});
      views.push({width,height,...data,errors,screenshot:`build/control-review/${name}`,sha256:sha(bytes)});
    }finally{await page.close();}
  }
}finally{await browser?.close();}
if(JSON.stringify(input)!==JSON.stringify(fingerprint()))throw new Error('Source changed while capturing; recapture the current page.');
const result={schema_version:1,execution:'playwright',capture_id:id,phase:values.phase,captured_at:new Date().toISOString(),url:url.href,input,views};
await writeFile(resolve(output,`${values.phase}-capture.json`),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'captured',capture:`build/control-review/${values.phase}-capture.json`,capture_id:id}));
