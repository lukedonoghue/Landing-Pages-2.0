/* Shared accessible visitor controls. Factual policy text comes from active modes. */
(() => {
  const funnel=window.LeadFunnel;if(!funnel||document.querySelector('[data-funnel-privacy-dialog]'))return;
  const source=document.currentScript;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('privacy-controls.css',source.src).href;document.head.append(css);
  const make=(tag,text,cls)=>{const element=document.createElement(tag);if(text)element.textContent=text;if(cls)element.className=cls;return element;};
  let trigger=document.querySelector('[data-privacy-choices]');
  if(!trigger){trigger=make('button','Privacy choices','funnel-privacy-trigger');trigger.type='button';trigger.dataset.privacyChoices='';(document.querySelector('footer')||document.body).append(trigger);}
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','funnel-privacy-dialog');trigger.setAttribute('aria-expanded','false');
  const dialog=make('dialog',null,'funnel-privacy-dialog');dialog.id='funnel-privacy-dialog';dialog.dataset.funnelPrivacyDialog='';dialog.setAttribute('aria-labelledby','funnel-privacy-title');dialog.setAttribute('aria-describedby','funnel-privacy-description');
  const header=make('div',null,'funnel-privacy-heading'),title=make('h2','Privacy choices');title.id='funnel-privacy-title';title.tabIndex=-1;
  const close=make('button','Close','funnel-privacy-close');close.type='button';close.setAttribute('aria-label','Close privacy choices');header.append(title,close);
  const description=make('p');description.id='funnel-privacy-description';
  const stateText=make('p',null,'funnel-privacy-state');stateText.setAttribute('role','status');
  const detail=make('p',null,'funnel-privacy-detail');
  const note=make('p','Your enquiry works either way. Turning optional data off stops future optional collection; it does not erase information already received.','funnel-privacy-detail');
  const policy=make('a','Read the privacy information');policy.href='/privacy.html';
  const actions=make('div',null,'funnel-privacy-actions'),decline=make('button','No thanks','funnel-privacy-secondary'),allow=make('button','Allow optional data','funnel-privacy-primary');
  decline.type=allow.type='button';decline.dataset.privacyDecline='';allow.dataset.privacyAllow='';actions.append(decline,allow);
  dialog.append(header,description,stateText,detail,note,policy,actions);document.body.append(dialog);
  const announcement=make('span',null,'funnel-privacy-announcement');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');document.body.append(announcement);
  let banner=document.querySelector('[data-consent-banner]');
  if(!banner){banner=make('aside',null,'funnel-privacy-banner');banner.dataset.consentBanner='';banner.setAttribute('aria-label','Optional data choices');const text=make('p');const buttons=make('div');for(const [value,label] of [['decline','No thanks'],['accept','Allow optional data']]){const button=make('button',label);button.type='button';button.dataset.analyticsConsent=value;buttons.append(button);}banner.append(text,buttons);const main=document.querySelector('main');if(main)main.before(banner);else document.body.append(banner);}
  banner.classList.add('funnel-privacy-banner');
  const spacer=make('div',null,'funnel-privacy-spacer');spacer.setAttribute('aria-hidden','true');document.body.append(spacer);
  const size=()=>{if(!dialog.open)spacer.style.height=banner.hidden?'0px':(banner.getBoundingClientRect().height+24)+'px';};
  if(typeof ResizeObserver==='function')new ResizeObserver(size).observe(banner);
  function render(){
    const state=funnel.privacyState();
    const optional=state.analytics_mode!=='disabled'||state.attribution_mode==='consent'||state.advertising_user_data_mode==='consent';
    const matching=state.advertising_user_data_mode==='consent'&&!state.sensitive_category?' If allowed, email and phone are normalized, irreversibly hashed in this browser, and shared with configured advertising providers for conversion matching.':'';
    description.textContent=(state.analytics_mode==='disabled'?'Visitor measurement is disabled on this site.':'Optional measurement counts page visits and enquiries without sending raw contact details to analytics.')+matching;
    detail.textContent=state.attribution_mode==='lead'?'Campaign and referrer details are included with enquiries independently of optional measurement. Browser privacy preferences still take priority.':state.attribution_mode==='disabled'?'Campaign and referrer details are not saved.':'Campaign and referrer details are kept only when optional data is allowed.';
    stateText.textContent=state.loading?'Loading privacy settings. Optional data is off.':!state.configured?'Privacy settings are unavailable. Optional data is off.':state.browser_opt_out?'Your browser privacy preference keeps optional data off.':state.customer_data_allowed?'Optional measurement and hashed advertising matching are on.':state.measurement_allowed?'Optional measurement is on.':state.attribution_allowed&&state.attribution_mode==='consent'?'Optional campaign details are allowed.':'Optional measurement is off.';
    if(!state.can_persist)stateText.textContent+=' This browser may not retain your choice after leaving this page.';
    allow.disabled=!state.configured||state.browser_opt_out||!optional;
    allow.textContent=state.attribution_mode==='lead'?'Allow measurement':'Allow optional data';
    decline.textContent=state.attribution_mode==='lead'?'No optional measurement':'No thanks';
    const text=banner.querySelector('p');
    if(text){
      if(state.measurement_allowed&&state.choice===null){
        const origin=state.attribution_mode==='lead'?'Campaign details accompany enquiries independently.':state.attribution_mode==='disabled'?'Campaign details are not saved.':'Campaign details are added only if you allow optional data.';
        text.textContent='Visitor measurement is on. You can turn it off; your enquiry works either way. '+origin;
      }else text.textContent=state.attribution_mode==='lead'?'Allow visitor measurement? Campaign details are still included with your enquiry.':state.analytics_mode==='disabled'?'Allow campaign details with your enquiry? Your request works either way.':state.attribution_mode==='disabled'?'Allow visitor measurement? Campaign details are not saved. Your enquiry works either way.':'Allow optional page measurement and campaign details? Your enquiry works either way.';
    }
    const yes=banner.querySelector('[data-analytics-consent="accept"]');if(yes){yes.textContent=allow.textContent;yes.disabled=allow.disabled;}
    const no=banner.querySelector('[data-analytics-consent="decline"]');if(no)no.textContent=decline.textContent;
    banner.hidden=dialog.open||state.choice!==null||!state.configured||state.browser_opt_out||!optional||source?.dataset.banner==='false'||document.querySelector('script[src*="funnel.js"]')?.dataset.measure==='false';
    size();
  }
  function dismiss(){dialog.close();trigger.setAttribute('aria-expanded','false');render();trigger.focus({preventScroll:true});}
  function choose(value){funnel.setConsent(value);announcement.textContent=value?'Privacy choice saved.':'Optional measurement stopped. Your enquiry still works.';if(dialog.open)dismiss();else render();}
  trigger.addEventListener('click',event=>{event.preventDefault();render();dialog.showModal();trigger.setAttribute('aria-expanded','true');banner.hidden=true;size();title.focus({preventScroll:true});});
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
    const index=controls.indexOf(document.activeElement);
    event.preventDefault();
    const next=index<0?(event.shiftKey?controls.length-1:0):(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
    controls[next]?.focus();
  });
  close.addEventListener('click',dismiss);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  allow.addEventListener('click',()=>choose(true));decline.addEventListener('click',()=>choose(false));
  document.querySelectorAll('[data-analytics-consent]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.analyticsConsent==='accept')));
  window.addEventListener('funnel:privacy-change',render);funnel.ready.then(render);render();
})();
