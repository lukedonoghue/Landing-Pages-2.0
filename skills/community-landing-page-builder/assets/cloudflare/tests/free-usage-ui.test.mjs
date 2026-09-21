import test from 'node:test';
import assert from 'node:assert/strict';
import { initFreeUsage, usageHeading } from '../public/admin/free-usage.js';

test('partial known usage has a neutral heading instead of claiming all usage is unavailable', () => {
  assert.equal(usageHeading({connection:'connected',status:'unknown',metrics:[
    {status:'ok',value:10},{status:'ok',value:20},{status:'ok',value:30},{status:'unknown',value:null}
  ]}),'Usage partly checked');
  assert.equal(usageHeading({connection:'connected',status:'unknown',metrics:[{status:'unknown',value:null}]}),'Free usage unavailable');
  assert.equal(usageHeading({connection:'not_connected',status:'unknown',metrics:[]}),'Free usage unavailable');
  assert.equal(usageHeading({connection:'connected',status:'urgent',metrics:[{status:'urgent',value:95}]}),'Free usage urgent');
});

test('destroy during a pending refresh cannot recreate its timer', async () => {
  let resolveRequest; let scheduled=0; let removed=0;
  const request=()=>new Promise(resolve=>{resolveRequest=resolve;});
  const node=()=>({textContent:'',hidden:false,disabled:false,href:'',dataset:{},replaceChildren(){},append(){},addEventListener(){},removeEventListener(){removed+=1;},setAttribute(){},removeAttribute(){},childElementCount:0});
  const nodes={
    '[data-usage-heading]':node(),'[data-usage-message]':node(),'[data-usage-details]':node(),'[data-usage-summary]':node(),
    '[data-usage-metrics]':node(),'[data-usage-meta]':node(),'[data-usage-dashboard]':node(),'[data-usage-refresh]':node()
  };
  const root={dataset:{},querySelector(selector){return nodes[selector];},setAttribute(){},removeAttribute(){}};
  const originalDocument=globalThis.document,originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
  globalThis.document={hidden:false,addEventListener(){},removeEventListener(){removed+=1;}};
  globalThis.setTimeout=()=>{scheduled+=1;return scheduled;}; globalThis.clearTimeout=()=>{};
  try {
    const monitor=initFreeUsage(root,{request,currentUser:{role:'admin'}});
    const pending=monitor.refresh(); monitor.destroy();
    resolveRequest({connection:'not_connected',status:'unknown',coverage:'incomplete',metrics:[],dashboard_url:'https://dash.cloudflare.com/'});
    await pending;
    assert.equal(scheduled,0); assert.equal(removed,2);
    await monitor.refresh(); assert.equal(scheduled,0);
  } finally {
    globalThis.document=originalDocument; globalThis.setTimeout=originalSetTimeout; globalThis.clearTimeout=originalClearTimeout;
  }
});
