import test from 'node:test';
import assert from 'node:assert/strict';
import {secureFetch} from '../public/admin/secure-fetch.js';

function dom(){
  const elements=[];
  const make=tag=>{
    const listeners=new Map();
    const node={tag,value:'',listeners,children:[],removed:false,append(...children){this.children.push(...children);},setAttribute(){},addEventListener(name,fn){listeners.set(name,fn);},focus(){},showModal(){},close(){},remove(){this.removed=true;}};
    elements.push(node);return node;
  };
  return {elements,document:{activeElement:{focus(){}},createElement:make,body:make('body')}};
}
async function withPage(run){
  const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};
  const page=dom();globalThis.window={location:{href:'https://crm.example.test/admin/',origin:'https://crm.example.test'}};globalThis.document=page.document;
  try{await run(page);}finally{for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}
const challenge=()=>Response.json({code:'reauthentication_required'},{status:403});
async function untilForm(page){for(let i=0;i<50&&!page.elements.some(e=>e.tag==='form');i++)await new Promise(resolve=>setTimeout(resolve,1));assert.ok(page.elements.some(e=>e.tag==='form'));}
test('password entry may exceed the network timeout without cancelling the protected retry',async()=>withPage(async page=>{
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;assert.equal(options.signal.aborted,false);assert.equal('timeoutMs' in options,false);
    if(calls===1)return challenge();
    assert.equal(options.redirect,'error');
    assert.equal(Buffer.from(new Headers(options.headers).get('X-CRM-Confirm-Password-UTF8'),'base64').toString('utf8'),'synthetic-Zoë-password');
    return Response.json({ok:true});
  };
  const result=secureFetch('/api/admin/data/retention',{method:'POST',timeoutMs:5});
  await untilForm(page);await new Promise(resolve=>setTimeout(resolve,20));
  const field=page.elements.find(e=>e.tag==='input');field.value='synthetic-Zoë-password';
  page.elements.find(e=>e.tag==='form').listeners.get('submit')({preventDefault(){}});
  assert.equal((await result).status,200);assert.equal(calls,2);assert.equal(field.value,'');assert.equal(page.elements.find(e=>e.tag==='dialog').removed,true);
}));
test('cancelling a password prompt sends no privileged retry',async()=>withPage(async page=>{
  let calls=0;globalThis.fetch=async()=>{calls++;return challenge();};
  const result=secureFetch('/api/admin/leads/export.csv');await untilForm(page);
  page.elements.find(e=>e.tag==='button'&&e.type==='button').listeners.get('click')();
  assert.equal((await result).status,403);assert.equal(calls,1);
}));
test('cross-origin requests are rejected before any credential or fetch',async()=>withPage(async()=>{
  globalThis.fetch=async()=>assert.fail('Cross-origin fetch must not run');
  await assert.rejects(secureFetch('https://other.example.test/api/admin/webhooks'),/stay on this CRM/);
}));
test('network attempts still time out and preserve an explicitly aborted caller',async()=>withPage(async()=>{
  globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>{if(signal.aborted)reject(new Error('aborted'));else signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
  await assert.rejects(secureFetch('/api/admin/leads',{timeoutMs:5}),/aborted/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(secureFetch('/api/admin/leads',{signal:controller.signal}),/aborted/);
}));
