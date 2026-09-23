const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
const action=(text,handler,cls='button secondary')=>{const button=make('button',text,cls);button.type='button';button.addEventListener('click',handler);return button;};
const periods=[['leads_days','Enquiries'],['notes_days','Notes and activity'],['attribution_days','Campaign and referrer details'],['visits_days','Visit records'],['delivery_history_days','Finished delivery records']];
const date=value=>new Date(value).toLocaleString();
const amount=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
export function initDataLifecyclePanel(host,{request,onChanged=()=>{},siteName='Funnel'}={}) {
  let disposed=false,searchSequence=0,preview=null,loaded=false,polling=false,waiting=[];
  const panel=make('section',null,'data-panel');panel.setAttribute('aria-labelledby','data-panel-title');
  const title=make('h2','Data retention & erasure');title.id='data-panel-title';title.tabIndex=-1;
  const status=make('p',null,'data-status');status.id='data-controls-status';status.setAttribute('role','status');
  panel.append(title,make('p','Remove contact hides an enquiry. Permanent erasure deletes its details, notes, history and delivery records. Erasure and retention can reduce historical lead and conversion totals.','data-help'));
  const finder=make('form',null,'data-finder'),label=make('label','Find an enquiry to erase'),search=make('input');search.type='search';search.name='erasure-search';search.minLength=3;search.maxLength=200;search.required=true;search.autocomplete='off';label.append(search);
  const find=make('button','Find enquiries','button secondary');find.type='submit';finder.append(label,find);
  const results=make('div',null,'data-results');results.setAttribute('aria-live','polite');
  panel.append(finder,make('p','Search includes active and removed contacts. Review each matching enquiry before erasing it.','data-help'),results);
  const retention=make('details',null,'data-settings'),summary=make('summary','Automatic retention');retention.append(summary);
  const form=make('form',null,'data-retention-form'),enabled=make('input');enabled.type='checkbox';enabled.name='retention-enabled';
  const enabledLabel=make('label',null,'data-check');enabledLabel.append(enabled,make('span','Enable automatic cleanup'));
  const scopeLabel=make('label','Enquiry scope'),scope=make('select');scope.name='lead_scope';for(const [value,text]of [['removed','Removed contacts only'],['all','All enquiries, including active contacts']]){const option=make('option',text);option.value=value;scope.append(option);}scopeLabel.append(scope);
  const fields={};const grid=make('div',null,'data-periods');
  for(const [key,text]of periods){const item=make('label',text+' - days'),input=make('input');input.name=key;input.type='number';input.min='1';input.max='36500';input.step='1';input.placeholder='Off';item.append(input);fields[key]=input;grid.append(item);}
  const review=make('button','Preview retention settings','button secondary');review.type='submit';
  form.append(enabledLabel,scopeLabel,grid,make('p','Leave a period blank to keep it off. Enquiry age is measured from removal for removed-only scope, otherwise from receipt. Other periods use record creation time. Cleanup runs in small batches.','data-help'),review);
  const reviewBox=make('div',null,'data-preview');reviewBox.hidden=true;
  const reviewText=make('p'),counts=make('ul'),acknowledge=make('input');acknowledge.type='checkbox';acknowledge.name='confirm-retention';
  const acknowledgeLabel=make('label',null,'data-check');acknowledgeLabel.append(acknowledge,make('span','I have reviewed the periods and their effect on existing data.'));
  const save=action('Save retention settings',savePolicy,'button primary');save.disabled=true;reviewBox.append(reviewText,counts,acknowledgeLabel,save);
  const run=action('Run one cleanup batch',runBatch);run.disabled=true;
  retention.append(form,reviewBox,run);panel.append(retention);
  const historyHeading=make('h3','Recent erasures'),history=make('div',null,'data-history');
  const refresh=action('Refresh erasure progress',()=>refreshOperations().catch(report));
  const download=action('Download erasure record',downloadLedger);
  panel.append(historyHeading,history,refresh,make('p','Keep the erasure record separately from older backups. It records which enquiries must stay erased, without contact details. Before restoring an older backup, use the latest record to prevent erased enquiries from returning. Managed Sheets deletions are tracked in Security activity. Downloaded exports, legacy sheets and other external copies need separate handling.','data-help'),download,status);host.append(panel);
  const dialog=make('dialog',null,'data-erasure-dialog');dialog.id='erasure-dialog';dialog.setAttribute('aria-labelledby','erasure-title');dialog.setAttribute('aria-describedby','erasure-effect');
  const heading=make('h2','Review permanent erasure');heading.id='erasure-title';heading.tabIndex=-1;
  const selected=make('div'),effect=make('p');effect.id='erasure-effect';const tally=make('p');
  const confirm=make('input');confirm.type='checkbox';confirm.name='confirm-erasure';const confirmLabel=make('label',null,'data-check');confirmLabel.append(confirm,make('span','Permanently erase the enquiries listed above.'));
  const error=make('p',null,'data-error');error.id='erasure-error';confirm.setAttribute('aria-describedby','erasure-error');error.setAttribute('role','alert');
  const buttons=make('div',null,'data-actions');let submitting=false,eraseBody=null,eraseIds=null,needsReview=false,opener=null;
  const cancel=action('Cancel',closeDialog),erase=action('Erase permanently',submitErasure,'button danger');erase.disabled=true;buttons.append(cancel,erase);dialog.append(heading,selected,effect,tally,confirmLabel,error,buttons);document.body.append(dialog);
  async function call(path,options={}){return request(path,{...options,timeoutMs:15000});}
  const post=(path,body={})=>call(path,{method:'POST',body:JSON.stringify(body)});
  function report(error){if(!disposed)status.textContent=error.message||'Unable to complete this action. Please try again.';}
  function closeDialog(){if(submitting)return;dialog.close();selected.replaceChildren();eraseBody=null;eraseIds=null;needsReview=false;confirm.checked=false;(opener?.isConnected&&opener.getClientRects().length?opener:title).focus();}
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(node=>node.getClientRects().length);event.preventDefault();const current=controls.indexOf(document.activeElement);controls[current<0?(event.shiftKey?controls.length-1:0):(current+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus();});
  confirm.addEventListener('change',()=>{erase.disabled=!confirm.checked||submitting;});
  async function reviewErasure(ids,trigger=search){
    if(submitting)return;opener=trigger;status.textContent='Preparing the erasure preview…';
    try{
      const data=await post('/api/admin/data/erasures/preview',{lead_ids:ids});selected.replaceChildren();
      for(const lead of data.enquiries){const row=make('p');row.append(make('strong',lead.name||'Unnamed enquiry'),make('span',`${lead.email?' · '+lead.email:''} · ${lead.removed?'Removed':'Active'} · ${date(lead.created_at)}`));selected.append(row);}
      effect.textContent=data.effect;tally.textContent=`${amount(data.counts.enquiries,'enquiry','enquiries')}, ${amount(data.counts.notes,'note')}, ${amount(data.counts.activity,'history entry','history entries')}, ${amount(data.counts.deliveries,'delivery record')}.`;
      eraseIds=[...ids];needsReview=false;eraseBody={operation_id:crypto.randomUUID(),token:data.token};confirm.disabled=false;confirm.checked=false;erase.disabled=true;erase.textContent='Erase permanently';error.textContent='';status.textContent='';dialog.showModal();if(dialog.scrollHeight>dialog.clientHeight){heading.tabIndex=-1;heading.focus({preventScroll:true});dialog.scrollTop=0;}else cancel.focus();
    }catch(e){report(e);}
  }
  async function submitErasure(){
    if(needsReview){const ids=eraseIds,trigger=opener;closeDialog();await refreshOperations().catch(report);await reviewErasure(ids,trigger);return;}
    if(!eraseBody||!confirm.checked||submitting)return;submitting=true;cancel.disabled=true;erase.disabled=true;confirm.disabled=true;error.textContent='';erase.textContent='Submitting…';dialog.setAttribute('aria-busy','true');heading.focus({preventScroll:true});
    try{
      const result=await post('/api/admin/data/erasures',eraseBody);if(result.id!==eraseBody.operation_id||!['waiting','complete'].includes(result.status)||!Number.isInteger(result.counts?.enquiries))throw new Error('Erasure acknowledgement is incomplete.');submitting=false;opener=null;closeDialog();
      status.textContent=result.status==='complete'?`Erased from CRM: ${result.counts.enquiries} ${result.counts.enquiries===1?'enquiry':'enquiries'}.`:'Erasure accepted. Waiting for earlier delivery attempts to finish or expire.';
      results.replaceChildren();await refreshOperations().catch(()=>{status.textContent+=' Refresh progress to check the latest operation status.';});onChanged();
    }catch(e){needsReview=[400,409].includes(e.status);error.textContent=needsReview?e.message:'The result could not be confirmed. Retry this same erasure to recover its result. '+(e.message||'');erase.textContent=needsReview?'Review current data':'Retry same erasure';if(needsReview)confirm.checked=false;}
    finally{submitting=false;dialog.removeAttribute('aria-busy');cancel.disabled=false;confirm.disabled=needsReview;erase.disabled=needsReview?false:!confirm.checked;}
  }
  finder.addEventListener('submit',async event=>{
    event.preventDefault();if(!finder.reportValidity())return;const sequence=++searchSequence;find.disabled=true;status.textContent='Searching…';
    try{const data=await call('/api/admin/data/enquiries?q='+encodeURIComponent(search.value.trim()));if(sequence!==searchSequence)return;results.replaceChildren();
      for(const lead of data.enquiries){const row=make('article',null,'data-result'),text=make('div');text.append(make('strong',lead.name||'Unnamed enquiry'),make('span',`${lead.email||''} · ${lead.deleted_at?'Removed':'Active'} · ${date(lead.created_at)}`));row.append(text,action('Review erasure',event=>reviewErasure([lead.id],event.currentTarget)));results.append(row);}
      status.textContent=data.total>data.limit?`Showing the newest ${data.limit} of ${data.total} matches. Refine the search to find the others.`:data.total?`${data.total} matching ${data.total===1?'enquiry':'enquiries'}.`:'No matching enquiries.';
    }catch(e){report(e);}finally{find.disabled=false;}
  });
  function policyValue(){return {enabled:enabled.checked,lead_scope:scope.value,...Object.fromEntries(periods.map(([key])=>[key,fields[key].value===''?null:Number(fields[key].value)]))};}
  function invalidate(){preview=null;reviewBox.hidden=true;acknowledge.checked=false;save.disabled=true;run.disabled=true;}
  form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
  acknowledge.addEventListener('change',()=>{save.disabled=!preview||!acknowledge.checked;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!loaded||!form.reportValidity())return;review.disabled=true;status.textContent='Checking the retention effect…';
    const candidate=policyValue();try{
      const data=await post('/api/admin/data/retention/preview',{policy:candidate});if(JSON.stringify(candidate)!==JSON.stringify(policyValue()))return;preview=data;counts.replaceChildren();
      for(const [key,label]of periods)counts.append(make('li',`${label}: ${data.counts[key]} currently eligible; ${candidate[key]===null?'off':candidate[key]+' days'}.`));
      reviewText.textContent=(candidate.enabled?'Automatic cleanup will be enabled. ':'Automatic cleanup will stay off. ')+data.effect;acknowledge.checked=false;save.disabled=true;reviewBox.hidden=false;status.textContent='Review the effect below before saving.';
    }catch(e){report(e);}finally{review.disabled=false;}
  });
  async function savePolicy(){
    if(!preview||!acknowledge.checked)return;const body={policy:preview.policy,token:preview.token};save.disabled=true;const controls=[...form.querySelectorAll('input,select,button'),acknowledge];controls.forEach(node=>node.disabled=true);
    try{const data=await post('/api/admin/data/retention',body);invalidate();run.disabled=!data.policy.enabled;status.textContent=data.policy.enabled?'Retention settings saved. Scheduled cleanup uses these periods.':'Automatic retention is off. Previously accepted erasures can still finish.';}
    catch(e){report(e);if([400,409].includes(e.status)){invalidate();await load();status.textContent=e.message+' Current settings have been loaded; review them before saving.';}else save.disabled=!acknowledge.checked;}finally{controls.forEach(node=>node.disabled=false);}
  }
  async function runBatch(){run.disabled=true;status.textContent='Running one configured cleanup batch…';try{await post('/api/admin/data/retention/run');await refreshOperations();status.textContent='Cleanup batch completed. Large backlogs require further scheduled batches.';onChanged();}catch(e){report(e);}finally{run.disabled=!enabled.checked;}}
  async function refreshOperations(){
    const data=await call('/api/admin/data/erasures');if(disposed)return;waiting=data.operations.filter(item=>item.status!=='complete');history.replaceChildren();
    for(const item of data.operations){const row=make('p');row.append(make('strong',`${amount(item.counts.enquiries||0,'enquiry','enquiries')} - ${item.status==='complete'?'erased from CRM; check Sheets deletion status':item.active_deliveries?'waiting for earlier deliveries':'awaiting completion'}`),make('span',`${date(item.completed_at||item.created_at)} · ${item.origin}`));history.append(row);}
    if(!data.operations.length)history.append(make('p','No erasure operations yet.','data-help'));
  }
  async function downloadLedger(){
    download.disabled=true;status.textContent='Preparing the complete erasure record…';
    try{const entries=[];let after=0,through=null,dataset=null,expected=null;
      do{const query=new URLSearchParams({after:String(after)});if(through!==null)query.set('through',String(through));const data=await call('/api/admin/data/erasure-records?'+query);if(!/^[a-f0-9]{32}$/.test(data.dataset_id||'')||!Number.isSafeInteger(data.total)||data.total<0)throw new Error('The erasure record response is incomplete.');if(expected!==null&&expected!==data.total)throw new Error('The erasure record boundary changed. Start again.');expected=data.total;if(dataset!==null&&dataset!==data.dataset_id)throw new Error('The source database changed during export. Start again.');dataset=data.dataset_id;through=data.through;entries.push(...data.entries);if(entries.length>100000)throw new Error('The erasure record is too large for a browser download. Ask the operator to export the suppression table privately. No partial record was downloaded.');if(data.next!==null&&(!Number.isSafeInteger(data.next)||data.next<=after))throw new Error('The erasure record could not be completed. Try again.');after=data.next;}while(after!==null);
      if(entries.length!==expected)throw new Error('The erasure record is incomplete. No partial file was downloaded.');
      const content={schema_version:1,complete:true,entry_count:expected,dataset_id:dataset,site_name:siteName,generated_at:new Date().toISOString(),through,entries};const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));const a=make('a');a.href=url;a.download=`erasure-record-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent=`Downloaded ${entries.length} suppression records. Keep this file privately and separately from older backups.`;
    }catch(e){report(e);}finally{download.disabled=false;}
  }
  async function load(){
    try{const policy=await call('/api/admin/data/retention');enabled.checked=policy.enabled;scope.value=policy.lead_scope;for(const [key]of periods)fields[key].value=policy[key]??'';loaded=true;review.disabled=false;run.disabled=!policy.enabled;await refreshOperations();}catch(e){report(e);status.append(action('Reload data controls',load));}
  }
  panel.querySelectorAll('input,select').forEach(input=>{input.setAttribute('aria-describedby','data-controls-status');input.addEventListener('invalid',()=>input.setAttribute('aria-invalid','true'));input.addEventListener('input',()=>input.removeAttribute('aria-invalid'));});
  review.disabled=true;load();
  const timer=setInterval(async()=>{if(disposed||polling||document.hidden||!waiting.length||!panel.getClientRects().length)return;polling=true;try{const result=await post(`/api/admin/data/erasures/${waiting[0].id}/continue`);await refreshOperations();if(result.status==='complete'){status.textContent='CRM erasure is complete. Check Security activity for outstanding Google Sheets deletions.';onChanged();}}catch(e){report(e);}finally{polling=false;}},5000);
  return {reviewErasure,refresh:refreshOperations,dispose(){disposed=true;clearInterval(timer);dialog.remove();panel.remove();}};
}
