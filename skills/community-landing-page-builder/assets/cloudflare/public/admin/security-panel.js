export function initSecurityPanel(host,{request}) {
  const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);return node;};
  const panel=make('section'),title=make('h2','Recent security activity'),summary=make('p'),sessions=make('div'),events=make('ol'),status=make('p');
  panel.className='account-panel';panel.setAttribute('aria-label','Security activity');status.setAttribute('role','status');
  const refresh=make('button','Refresh security activity');refresh.type='button';refresh.className='button secondary';
  const retry=make('button','Retry repaired Sheets deletions');retry.type='button';retry.className='button secondary';retry.hidden=true;
  panel.append(title,summary,refresh,retry,sessions,events,status);host.append(panel);
  async function load() {
    refresh.disabled=true;
    try {
      const data=await request('/api/admin/security/overview');
      summary.textContent=`Outbound connections: ${data.outbound_connections}. Google Sheets deletions awaiting completion: ${data.downstream_erasures.reduce((n,r)=>n+r.total,0)}.`;
      retry.hidden=!data.downstream_erasures.some(r=>r.status==='failed');
      sessions.replaceChildren(make('h3','Active sessions'));
      for(const row of data.sessions)sessions.append(make('p',`${row.user_id}: ${row.active_sessions} active session(s)`));
      events.replaceChildren();
      for(const row of data.events)events.append(make('li',`${row.created_at} | ${row.action} | actor ${row.actor_id} | target ${row.target_id}${row.details.count!==undefined?' | count '+row.details.count:''}${row.details.destination_host?' | '+row.details.destination_host:''}`));
      status.textContent='Audit entries are retained for 90 days. Session tokens and customer details are not shown.';
    } catch(error) {status.textContent=error.message||'Security activity could not be loaded.';}
    finally {refresh.disabled=false;}
  }
  refresh.addEventListener('click',load);
  retry.addEventListener('click',async()=>{retry.disabled=true;try{await request('/api/admin/webhooks/erasures/retry',{method:'POST',body:'{}'});await load();}catch(error){status.textContent=error.message;}finally{retry.disabled=false;}});
  load();return {refresh:load};
}
