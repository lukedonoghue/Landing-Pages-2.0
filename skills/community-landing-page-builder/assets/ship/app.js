'use strict';
const key='lp2-ship-token';
const fragment=location.hash.slice(1);
if(fragment){sessionStorage.setItem(key,fragment);history.replaceState(null,'',location.pathname);}
const token=sessionStorage.getItem(key)||'';
let state=null,lastRevision=null,running=false,inflight=false;
const $=id=>document.getElementById(id);
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function error(text){$('error').hidden=!text;$('error').textContent=text||'';}
async function request(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers},cache:'no-store'});const value=await response.json();if(!response.ok)throw new Error(value.error||'The local publisher could not complete this request.');return value;}
function button(text,action,values,secondary=false){const b=node('button',text,secondary?'secondary':'');b.type='button';b.addEventListener('click',()=>act(action,typeof values==='function'?values():values));$('buttons').append(b);}
function field(label,id,value='',type='text'){const l=node('label',label);l.htmlFor=id;const i=node('input');i.id=id;i.type=type;i.value=value;i.autocomplete=type==='email'?'email':'off';$('content').append(l,i);return i;}
function check(label,id,checked=false){const l=node('label',undefined,'check');const i=node('input');i.type='checkbox';i.id=id;i.checked=checked;l.append(i,node('span',label));$('content').append(l);return i;}
function help(text){$('content').append(node('p',text,'help'));}
function link(text,url){const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';$('content').append(node('p')).append(a);}
function render(value){
 state=value.workflow;running=value.running;error(value.error);
 $('busy').hidden=!running;
 if(lastRevision===state.revision){for(const b of document.querySelectorAll('button'))b.disabled=running||inflight;return;}
 lastRevision=state.revision;
 $('step-title').textContent=state.card.title;$('description').textContent=state.card.text;
 $('progress').textContent=state.stage==='ready'?'PUBLISHED AND VERIFIED':state.completed.length+' automated steps completed';
 $('content').replaceChildren();$('buttons').replaceChildren();$('destination').replaceChildren();
 $('completed').replaceChildren(...state.completed.map(s=>node('li',s.replaceAll('_',' '))));
 if(state.intent.domain){const d=node('div',undefined,'destination');for(const [k,v] of [['Domain',state.intent.domain],['Owner',state.intent.owner],['Cloudflare account',state.intent.account_id],['Google Sheets',state.intent.sheets?'Enabled':'Not enabled']])if(v)d.append(node('p',k+': '+v));$('destination').append(d);}
 const code=state.card.code;
 if(state.stage==='inputs'){
   field('Your website domain','domain',state.intent.domain||'');field('CRM owner email','owner',state.intent.owner||'','email');
   const name=field('Site name','site',state.intent.site||'');const nameLabel=name.previousElementSibling;let autoName=!state.intent.site;name.addEventListener('input',()=>{autoName=false;});
   $('domain').addEventListener('input',()=>{if(!autoName)return;let slug=$('domain').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');if(!/^[a-z]/.test(slug))slug='site-'+slug;name.value=slug.slice(0,49);});
   check('Also send enquiries to Google Sheets (optional)','sheets',state.intent.sheets||false);
   const envLabel=node('label','Destination type');envLabel.htmlFor='environment';const env=node('select');env.id='environment';for(const val of ['production','staging']){const o=node('option',val==='production'?'Production':'Staging (use a separate domain and site name)');o.value=val;env.append(o);}env.value=state.intent.environment||'production';const advanced=node('details',undefined,'advanced');advanced.append(node('summary','Advanced destination settings'),nameLabel,name,envLabel,env);$('content').append(advanced);
   button('Check my setup','settings',()=>({domain:$('domain').value,owner:$('owner').value,site:name.value,sheets:$('sheets').checked,environment:$('environment').value,...(state.intent.account_id?{account_id:state.intent.account_id}:{}),...(state.intent.existing_database_id?{existing_database_id:state.intent.existing_database_id}:{})}));
 }else if(state.card.kind==='prepare'){
   help('This prepares infrastructure and owner access. The page is not published until you review it and choose Publish. It can use your provider’s normal account quotas.');button('Prepare this site','prepare',true);
 }else if(state.card.kind==='publish'){
   help('The test will create, edit and erase one labelled synthetic enquiry. Historical analytics may retain its contribution. Any selected Google Sheet receives that test too. Routine checks do not bypass your earlier copy or design approvals.');
   button('Publish and verify','publish',true);
 }else if(state.card.kind==='attest'){
   check('MFA is enabled on the Cloudflare account I selected.','mfa');
   check('I reviewed the page’s privacy notice and intended retention policy.','privacy');
   check('This is a trusted computer. Production secrets are kept outside my coding agent’s accessible context.','trusted_host');
   if(state.intent.sheets)check('The Google automation account has MFA; the sheet has named viewers only and restricted script editors.','google_access');
   button('Confirm and continue','attest',()=>Object.fromEntries(['mfa','privacy','trusted_host',...(state.intent.sheets?['google_access']:[])].map(k=>[k,$(k).checked])));
 }else if(code==='account'||code==='database_conflict'){
   const select=node('select');select.id='choice';for(const choice of state.card.choices){const opt=node('option',choice);opt.value=choice;select.append(opt);}$('content').append(select);
   button(code==='account'?'Use this account':'I confirm this is the correct database',code==='account'?'choose_account':'database',()=>select.value);
 }else if(code==='login'){
   button('Open Cloudflare sign-in','login');button('I’ve signed in — continue','continue',null,true);
 }else if(state.stage==='sheets'&&(code==='sheets_setup'||code==='sheets_probe')){
   field('Google Apps Script deployment address (/exec)','sheets_url',state.intent.sheets_url||'');
   field('Spreadsheet ID (from its address)','sheet_id',state.intent.sheet_id||'');
   link('Open Google Apps Script','https://script.google.com/home');
   help('Create a standalone project using google-apps-script/Code.gs and appsscript.json from your project. Deploy a versioned web app as yourself with public endpoint access. The signed connector, not a secret URL, authenticates requests.');
   button('Prepare / check connection','sheets',()=>({sheets_url:$('sheets_url').value,sheet_id:$('sheet_id').value}));
   button('Open my private Script Properties handoff','open_handoff','sheets',true);
   help('After preparing, open the private handoff yourself and copy its three values into Google’s Script Properties. Then press Check connection again. The handoff contents are never returned through this page.');
 }else if(code==='edge'){
   link('Open Cloudflare security settings','https://dash.cloudflare.com/');
   help('Select the domain → Security → WAF / Rate limiting. Match URI path equals /api/leads. Count by IP: 10 requests per 10 seconds; Block for 10 seconds. On Free, do not add method/hostname expressions. Keep other existing rules.');
   button('I enabled this protection','edge_confirm',true);button('Recheck with API access','continue',null,true);
 }else if(code==='existing_access'){
   help('This site already has named users or outbound connections. Review them in the existing CRM before continuing. The wizard does not disable people or remove integrations automatically.');
   link('Review the existing CRM','https://'+state.intent.domain+'/login.html');button('I reviewed the existing access and connections','existing_confirm',true);
 }else if(state.stage==='ready'){
   link('Open my published page','https://'+state.intent.domain);link('Open my CRM','https://'+state.intent.domain+'/login.html');
   help('The non-secret release receipt is saved in build/ship/release-receipt.json. It separates automated verification from owner-confirmed account controls.');button('Open my private owner password handoff','open_handoff','owner',true);button('Prepare another release','new_release',true,true);
 }else if(!running){
   if(code==='quality'||code==='prerequisites'||code==='approval_stale'){help('Your assistant can read build/ship/agent-task.json and the existing quality reports, repair the page, and resume. Never ask it to write a “pass” result or read production credential files.');const copy=node('button','Copy the repair request','secondary');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('Continue the existing Landing Pages 2.0 project. Read build/ship/agent-task.json and the current quality reports. Repair local prerequisites and actual source-bound QA, preserve user approvals, and return to the same publishing wizard. Do not access production secrets, run provider-authenticated commands, publish, or manufacture a passing report.');copy.textContent='Copied — paste into your coding assistant';}catch{error('Clipboard unavailable. Ask your coding assistant to read build/ship/agent-task.json.');}});$('buttons').append(copy);}
   button('Continue','continue');
 }
 for(const b of document.querySelectorAll('button'))b.disabled=running||inflight;
}
async function act(action,value){if(inflight||running)return;inflight=true;error('');try{await request('/api/action',{method:'POST',body:JSON.stringify({action,value,revision:state.revision})});lastRevision=null;await poll();}catch(e){error(e.message);}finally{inflight=false;}}
async function poll(){try{render(await request('/api/status'));}catch(e){error(e.message);}}
if(!token){error('Open the private address printed in your terminal. No connection token was found.');}else{poll();setInterval(poll,1500);}
