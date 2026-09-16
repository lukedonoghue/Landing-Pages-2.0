/* First-party attribution and consent-aware measurement. No contact data in analytics. */
(() => {
  const script=document.currentScript, mode=script?.dataset.analyticsMode||'consent', prefix='funnel_v2_', memory=new Map();
  const get=(type,k,fallback=null)=>{try{return JSON.parse(window[type].getItem(prefix+k))??fallback;}catch{return memory.get(k)??fallback;}};
  const set=(type,k,v)=>{try{window[type].setItem(prefix+k,JSON.stringify(v));}catch{memory.set(k,v);}};
  const clean=value=>{try{const u=new URL(value,location.href);return u.origin+u.pathname;}catch{return '';}};
  const keys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid','fbclid','msclkid'];
  const params=new URLSearchParams(location.search);
  const currentAttribution=Object.fromEntries(keys.filter(k=>params.has(k)).map(k=>[k,params.get(k).slice(0,500)]));
  const touch={...currentAttribution};
  Object.assign(touch,{landing_page:clean(location.href),referrer:document.referrer?clean(document.referrer):'',captured_at:new Date().toISOString()});
  // Visit attribution belongs to this navigation. Retained touches below belong to the CRM lead only.
  const visitReferrer=(()=>{try{const u=new URL(document.referrer);return u.origin!==location.origin?clean(u.href):'';}catch{return '';}})();
  if(!get('sessionStorage','first_touch'))set('sessionStorage','first_touch',touch);
  if(keys.some(k=>params.has(k))||!get('sessionStorage','latest_touch'))set('sessionStorage','latest_touch',touch);
  let consent=mode==='essential'||get('localStorage','analytics_consent',false)===true;
  const allowed=()=>consent&&mode!=='disabled'&&navigator.doNotTrack!=='1'&&navigator.globalPrivacyControl!==true;
  let pageVisitorId='';
  const visitor=()=>{if(!allowed())return '';let id=pageVisitorId||get('localStorage','visitor_id');if(!/^[0-9a-f-]{36}$/i.test(id||''))id=crypto.randomUUID();pageVisitorId=id;set('localStorage','visitor_id',id);return id;};
  const visitEventId=crypto.randomUUID();
  let visitRecorded=false;
  let visitPromise=Promise.resolve();
  const visit=()=>{
    if(!allowed()||script?.dataset.measure==='false')return;
    visitPromise=fetch('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:visitEventId,visitor_id:visitor(),path:location.pathname,analytics_consent:true,attribution:currentAttribution,referrer:visitReferrer}),keepalive:true})
      .then(async response=>{if(!response.ok)return;const result=await response.json();if(result.measured===true&&result.event_id===visitEventId)visitRecorded=true;}).catch(()=>null);
  };
  window.LeadFunnel={
    setConsent(value){consent=value===true;set('localStorage','analytics_consent',consent);if(consent)visit();else{try{localStorage.removeItem(prefix+'visitor_id');}catch{memory.delete('visitor_id');}}},
    hasConsent:allowed,
    async context(){let timer;try{await Promise.race([visitPromise,new Promise(resolve=>{timer=setTimeout(resolve,1500);})]);}finally{clearTimeout(timer);}return {visitor_id:visitor(),...(allowed()&&visitRecorded?{visit_event_id:visitEventId}:{}),analytics_consent:allowed(),landing_page:clean(location.href),referrer:document.referrer?clean(document.referrer):'',attribution:{first_touch:get('sessionStorage','first_touch',touch),latest_touch:get('sessionStorage','latest_touch',touch)}};},
    accepted(result){set('sessionStorage','receipt',{receipt_id:result.receipt_id,created_at:Date.now()});if(!allowed()||result.duplicate)return;try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'lead_accepted',receipt_id:result.receipt_id});}catch{}},
    receipt(){return get('sessionStorage','receipt');}
  };
  document.querySelectorAll('[data-analytics-consent]').forEach(button=>button.addEventListener('click',()=>{window.LeadFunnel.setConsent(button.dataset.analyticsConsent==='accept');button.closest('[data-consent-banner]')?.setAttribute('hidden','');}));
  if(get('localStorage','analytics_consent')!==null)document.querySelector('[data-consent-banner]')?.setAttribute('hidden','');
  visit();
})();
