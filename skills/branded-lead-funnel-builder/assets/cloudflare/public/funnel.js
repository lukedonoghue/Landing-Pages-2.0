/* First-party privacy choices, measurement and tab-scoped lead attribution. */
(() => {
  const script=document.currentScript,prefix='funnel_v2_',cookieName='funnel_privacy_choice',memory=new Map();
  let serverOptOut=false;
  let loading=true,configured=false,mode='disabled',attributionMode='disabled',choice=null,epoch=0,storageUsable=true;
  let pageVisitorId='',visitEventId='',visitRecorded=false,visitStarted=false,visitPromise=Promise.resolve(),visitController;
  const measuredPage=script?.dataset.measure!=='false';
  const key=(type,name)=>type+':'+name;
  const get=(type,name,fallback=null)=>{if(memory.has(key(type,name)))return memory.get(key(type,name))??fallback;try{return JSON.parse(window[type].getItem(prefix+name))??fallback;}catch{return fallback;}};
  const set=(type,name,value)=>{memory.set(key(type,name),value);try{window[type].setItem(prefix+name,JSON.stringify(value));return true;}catch{return false;}};
  // Keep a tombstone only when storage refuses deletion. Successful removal
  // allows another tab's renewed identifier to be read after regrant.
  const remove=(type,name)=>{memory.set(key(type,name),null);try{window[type].removeItem(prefix+name);memory.delete(key(type,name));}catch{}};
  const cookieChoice=()=>{try{const found=/(?:^|;\s*)funnel_privacy_choice=(allow|deny)(?:;|$)/.exec(document.cookie||'');return found?found[1]==='allow':null;}catch{return null;}};
  const setCookie=value=>{try{document.cookie=`${cookieName}=${value?'allow':'deny'}; Path=/; SameSite=Strict${location.protocol==='https:'?'; Secure':''}`;return cookieChoice()===value;}catch{return false;}};
  try{const old=localStorage.getItem(prefix+'analytics_consent');localStorage.setItem(prefix+'analytics_consent',old??'null');if(old===null)localStorage.removeItem(prefix+'analytics_consent');}catch{storageUsable=false;}
  const saved=storageUsable?get('localStorage','analytics_consent'):null,cookie=cookieChoice();
  choice=saved===false||cookie===false?false:saved===true||cookie===true?true:null;
  if(!storageUsable && cookie===null)choice=null;
  const browserOptOut=()=>serverOptOut||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const permitted=()=>configured&&!browserOptOut()&&choice!==false&&(choice===true||(mode==='essential'&&storageUsable));
  const canMeasure=()=>permitted()&&mode!=='disabled';
  const canAttribute=()=>configured&&!browserOptOut()&&attributionMode!=='disabled'&&(attributionMode==='lead'||choice===true);
  const clean=value=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.origin+url.pathname:'';}catch{return '';}};
  const externalReferrer=()=>{try{const url=new URL(document.referrer);return url.origin===location.origin?'':clean(url.href);}catch{return '';}};
  const campaignKeys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid','fbclid','msclkid'];
  const campaign=()=>{const params=new URLSearchParams(location.search);return Object.fromEntries(campaignKeys.filter(name=>params.has(name)).map(name=>[name,params.get(name).slice(0,500)]));};
  const sanitizeTouch=value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const result=Object.fromEntries(campaignKeys.filter(name=>typeof value[name]==='string').map(name=>[name,value[name].slice(0,500)]));
    for(const name of ['landing_page','referrer'])if(typeof value[name]==='string')result[name]=clean(value[name]);
    if(typeof value.captured_at==='string')result.captured_at=value.captured_at.slice(0,40);
    return result;
  };
  const clearTouches=()=>{remove('sessionStorage','first_touch');remove('sessionStorage','latest_touch');};
  const captureTouch=()=>{
    if(!canAttribute()){clearTouches();return;}
    if(!measuredPage)return;
    const tags=campaign(),referrer=externalReferrer(),touch={...tags,landing_page:clean(location.href),referrer,captured_at:new Date().toISOString()};
    if(!Object.keys(sanitizeTouch(get('sessionStorage','first_touch'))).length)set('sessionStorage','first_touch',touch);
    if(Object.keys(tags).length||referrer||!Object.keys(sanitizeTouch(get('sessionStorage','latest_touch'))).length)set('sessionStorage','latest_touch',touch);
  };
  const clearMeasurement=()=>{
    epoch++;visitController?.abort();visitController=undefined;visitPromise=Promise.resolve();
    pageVisitorId='';visitEventId='';visitRecorded=false;visitStarted=false;remove('localStorage','visitor_id');
  };
  const signal=()=>{if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('funnel:privacy-change'));};
  const reconcile=()=>{if(!canMeasure())clearMeasurement();if(!canAttribute())clearTouches();};
  const syncChoice=()=>{if(cookieChoice()===false&&choice!==false){choice=false;set('localStorage','analytics_consent',false);reconcile();signal();}if(browserOptOut())reconcile();};
  const visitor=()=>{
    if(!canMeasure())return '';
    let id=pageVisitorId||get('localStorage','visitor_id');
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id||''))id=crypto.randomUUID();
    pageVisitorId=id;set('localStorage','visitor_id',id);return id;
  };
  const visit=()=>{
    if(!canMeasure()||!measuredPage||visitStarted)return;
    visitStarted=true;visitEventId ||= crypto.randomUUID();const activeEpoch=epoch,id=visitEventId;
    visitController=new AbortController();
    const originAllowed=canAttribute();
    visitPromise=fetch('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},signal:visitController.signal,keepalive:true,body:JSON.stringify({event_id:id,visitor_id:visitor(),path:location.pathname,analytics_consent:true,attribution_consent:originAllowed,attribution:originAllowed?campaign():{},referrer:originAllowed?externalReferrer():''})})
      .then(async response=>{if(!response.ok)return;const result=await response.json();if(activeEpoch===epoch&&canMeasure()&&result.measured===true&&result.event_id===id)visitRecorded=true;}).catch(()=>null);
  };
  const status=()=>({configured,loading,analytics_mode:mode,attribution_mode:attributionMode,choice,measurement_allowed:canMeasure(),attribution_allowed:canAttribute(),browser_opt_out:browserOptOut(),can_persist:storageUsable||cookieChoice()!==null});
  if(choice===false||browserOptOut())clearMeasurement();
  if(browserOptOut())clearTouches();
  let ready;
  window.LeadFunnel={
    setConsent(value){
      if(typeof value!=='boolean')throw new TypeError('Privacy choice must be true or false.');
      choice=value;
      // Seed the shared browser ID before the preference event wakes other tabs.
      // Otherwise each tab can race to create its own ID during the same regrant.
      if(value)visitor();
      storageUsable=set('localStorage','analytics_consent',value);setCookie(value);
      reconcile();captureTouch();visit();signal();
    },
    privacyState(){syncChoice();return status();},
    hasConsent(){syncChoice();return canMeasure();},
    async context(){
      let timer;try{await Promise.race([ready.then(()=>visitPromise),new Promise(resolve=>{timer=setTimeout(resolve,1500);})]);}finally{clearTimeout(timer);}
      syncChoice();captureTouch();const originAllowed=canAttribute();
      return {visitor_id:visitor(),...(canMeasure()&&visitRecorded?{visit_event_id:visitEventId}:{}),analytics_consent:canMeasure(),attribution_consent:originAllowed,landing_page:clean(location.href),referrer:originAllowed?externalReferrer():'',attribution:originAllowed?{first_touch:sanitizeTouch(get('sessionStorage','first_touch')),latest_touch:sanitizeTouch(get('sessionStorage','latest_touch'))}:{first_touch:{},latest_touch:{}},__funnel_privacy_epoch:epoch};
    },
    protectSubmission(body){
      syncChoice();const safe={...body};delete safe.__funnel_privacy_epoch;
      if(!canMeasure()||body.__funnel_privacy_epoch!==epoch){safe.analytics_consent=false;safe.visitor_id='';delete safe.visit_event_id;}
      if(!canAttribute()||(attributionMode==='consent'&&body.__funnel_privacy_epoch!==epoch)){safe.attribution_consent=false;safe.attribution={first_touch:{},latest_touch:{}};safe.referrer='';}
      return safe;
    },
    accepted(result){
      if(result?.ok!==true||typeof result.lead_id!=='string'||!result.lead_id||typeof result.receipt_id!=='string'||!result.receipt_id||result.receipt_id.length>128)return;
      const receiptId=result.receipt_id;set('sessionStorage','receipt',{receipt_id:receiptId,created_at:Date.now()});
      syncChoice();if(!canMeasure())return;
      const stored=get('sessionStorage','emitted_receipts',[]),emitted=Array.isArray(stored)?stored.filter(id=>typeof id==='string'):[];
      if(emitted.includes(receiptId))return;
      try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'lead_accepted',receipt_id:receiptId});set('sessionStorage','emitted_receipts',[...emitted.slice(-199),receiptId]);}catch{}
    },
    receipt(){return get('sessionStorage','receipt');}
  };
  // Policy is served by the same Worker configuration that enforces submissions.
  // Missing/invalid settings fail closed for optional data, never for enquiries.
  const policyController=new AbortController(),policyTimeout=setTimeout(()=>policyController.abort(),5000);
  ready=fetch('/api/privacy-config',{cache:'no-store',credentials:'same-origin',signal:policyController.signal})
    .then(async response=>{if(!response.ok)throw Error();const value=await response.json();if(!['consent','essential','disabled'].includes(value.analytics_mode)||!['consent','lead','disabled'].includes(value.attribution_mode))throw Error();mode=value.analytics_mode;attributionMode=value.attribution_mode;serverOptOut=value.browser_opt_out===true;configured=true;})
    .catch(()=>{configured=false;mode='disabled';attributionMode='disabled';})
    .finally(()=>{loading=false;clearTimeout(policyTimeout);reconcile();captureTouch();visit();signal();});
  window.LeadFunnel.ready=ready;
  if(typeof window.addEventListener==='function') {
    window.addEventListener('storage',event=>{if(event.key===prefix+'analytics_consent'||event.key===null){let value=null;try{value=JSON.parse(event.newValue);}catch{};choice=value===true;memory.set(key('localStorage','analytics_consent'),choice);setCookie(choice);reconcile();captureTouch();visit();signal();}});
    window.addEventListener('focus',()=>{syncChoice();signal();});
  }
  if(typeof document.createElement==='function'&&script?.src){
    const ui=document.createElement('script');ui.src=new URL('privacy-controls.js',script.src).href;ui.defer=true;document.head.append(ui);
  }
})();
