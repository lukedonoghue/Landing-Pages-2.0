(() => {
  const $=s=>document.querySelector(s),create=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const fragment=new URLSearchParams(location.hash.slice(1));if(fragment.has('token')){sessionStorage.setItem('guide_token',fragment.get('token'));history.replaceState(null,'',location.pathname);}
  const token=sessionStorage.getItem('guide_token')||'';let current=null,lastRevision='',busy=false;
  async function api(path,body){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'The request could not be completed');return d;}
  function error(e){$('#error').textContent=e.message;$('#error').hidden=false;}
  async function act(fn){if(busy)return;busy=true;$('#error').hidden=true;try{await fn();await refresh(true);}catch(e){error(e);}finally{busy=false;}}
  const button=(label,handler)=>{const n=create('button',label);n.type='button';n.addEventListener('click',()=>act(handler));return n;};
  function render(data){current=data.next;const key=JSON.stringify([current.revision,current.stage,current.kind,current.review_fingerprint]);$('#state').textContent=data.running?'Working on this step. You can leave a question for the active agent.':current.kind==='complete'?'Selected scope complete':current.kind==='paused'?'Progress saved':'Ready for the next action';
    $('#blockers').textContent=JSON.stringify({blockers:current.blockers||[],worker:data.last?.worker_blockers||data.last?.error||null,next:current.progress?.next_action||null},null,2);
    if(key===lastRevision)return;lastRevision=key;$('#step-title').textContent=current.stage.replaceAll('_',' ');$('#instruction').textContent=current.instruction;
    $('#stages').replaceChildren(...current.stages.map(label=>create('span',label)));$('#summary').replaceChildren();for(const [k,v] of Object.entries(current.summary||{}))$('#summary').append(create('dt',k.replaceAll('.',' / ')),create('dd',String(v)));
    $('#questions').replaceChildren();$('#actions').replaceChildren();
    if(current.kind==='question'){
      const form=create('form');const controls=[];
      for(const q of current.questions){const group=create('fieldset'),legend=create('legend',q.label),help=create('p',q.reason);group.append(legend,help);let input;
        if(q.type==='choice'){input=create('select');input.append(new Option('Choose an option',''));for(const o of q.options)input.append(new Option(o.label,o.value));if(!q.field.startsWith('conversion.'))input.append(new Option('Other: describe it','__other'));}
        else{input=create('textarea');input.rows=2;input.maxLength=4000;input.value=q.current_value||'';}
        input.setAttribute('aria-label',q.label);const other=create('textarea');other.hidden=true;other.setAttribute('aria-label','Your alternative');input.addEventListener('change',()=>other.hidden=input.value!=='__other');group.append(input,other);
        group.append(button('Why does this matter?',async()=>{const h=await api('/api/help',{id:q.id});help.textContent=h.explanation;}));form.append(group);controls.push({q,input,other});}
      const submit=create('button','Save answers and continue');submit.type='submit';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();act(async()=>{const answers=controls.filter(x=>x.input.value.trim()).map(({q,input,other})=>({id:q.id,value:input.value==='__other'?other.value:input.value,other:input.value==='__other',question_revision:q.question_revision}));if(!answers.length)throw Error('Answer at least one question, or pause.');await api('/api/answer',{event_id:crypto.randomUUID(),expected_revision:current.revision,answers});});});$('#questions').append(form);
    }else if(current.kind==='approval'){
      if(current.approval_kind==='copy'||current.approval_kind==='publish')$('#actions').append(button('Open complete reviewed content',async()=>{const r=await api('/api/review');$('#documents').replaceChildren();for(const d of r.documents){$('#documents').append(create('h3',d.path),create('pre',d.text));}$('#review').open=true;}));
      let test=null;if(current.approval_kind==='publish'){const label=create('label');test=create('input');test.type='checkbox';label.append(test,document.createTextNode('Allow one labeled synthetic enquiry test where applicable. Soft-removal leaves historical metrics.'));$('#actions').append(label);}
      $('#actions').append(button(current.approval_kind==='brief'?'Confirm this brief':current.approval_kind==='copy'?'Approve this complete copy':'Publish this reviewed page',()=>api('/api/approve',{kind:current.approval_kind,expected_revision:current.revision,review_fingerprint:current.review_fingerprint,message:'I approve the '+current.approval_kind+' shown in this review.',allow_test_lead:!!test?.checked})));
      $('#actions').append(create('p','To request a wording, offer or design change, tell the active guide. A request for help never counts as approval.'));
    }else if(!['complete','wait','reconcile'].includes(current.kind))$('#actions').append(button('Continue or recheck',()=>api('/api/run',{})));
  }
  async function refresh(force=false){if(force)lastRevision='';try{render(await api('/api/status'));}catch(e){error(e);}}
  $('#pause').addEventListener('click',()=>act(()=>api('/api/pause',{})));$('#resume').addEventListener('click',()=>act(()=>api('/api/resume',{})));
  if(token){refresh();setInterval(()=>{if(!busy)refresh();},2000);}else error(Error('Use the private link printed by guide_ui.py.'));
})();
