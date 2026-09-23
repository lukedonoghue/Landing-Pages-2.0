// Reauthentication is per action, not a persistent browser grant. No password
// is put in a URL, storage, telemetry, console or exception text.
let pendingPrompt = false;
export function confirmPassword() {
  if (pendingPrompt) return Promise.reject(new Error('Finish the current password confirmation first.'));
  pendingPrompt = true;
  return new Promise(resolve => {
    const previous=document.activeElement, dialog=document.createElement('dialog'), form=document.createElement('form');
    dialog.className='crm-reauth-dialog'; dialog.setAttribute('aria-label','Confirm sensitive action');
    const heading=document.createElement('h2'); heading.textContent='Confirm your current password';
    const text=document.createElement('p'); text.textContent='This action can expose or change private customer data.';
    const label=document.createElement('label'); label.textContent='Current password';
    const password=document.createElement('input'); password.type='password'; password.autocomplete='current-password'; password.required=true; password.maxLength=1024; password.name='current-password'; label.append(password);
    const submit=document.createElement('button'); submit.type='submit'; submit.textContent='Confirm'; submit.className='button primary';
    const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel'; cancel.className='button secondary';
    form.append(heading,text,label,submit,cancel); dialog.append(form); document.body.append(dialog);
    let done=false;
    const finish=value=>{if(done)return;done=true;password.value='';dialog.close();dialog.remove();pendingPrompt=false;previous?.focus();resolve(value);};
    form.addEventListener('submit',event=>{event.preventDefault();finish(password.value);});
    cancel.addEventListener('click',()=>finish(null)); dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    dialog.showModal(); password.focus();
  });
}
async function networkFetch(path, options) {
  const {timeoutMs=15000,signal,...init}=options;
  const controller=new AbortController();
  const abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try { return await fetch(path,{...init,signal:controller.signal}); }
  finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
}
export async function secureFetch(path,options={}) {
  const target=new URL(path,window.location.href);
  if(target.origin!==window.location.origin)throw new Error('Sensitive requests must stay on this CRM.');
  const response=await networkFetch(path,options);
  if(response.status!==403)return response;
  let problem;try{problem=await response.clone().json();}catch{return response;}
  if(problem.code!=='reauthentication_required')return response;
  // Only network attempts time out; entering a password is not a network stall.
  let password=await confirmPassword();
  if(password===null)return response;
  try {
    const headers=new Headers(options.headers); headers.delete('X-CRM-Confirm-Password'); headers.set('X-CRM-Confirm-Password-UTF8',btoa(String.fromCharCode(...new TextEncoder().encode(password))));
    return await networkFetch(path,{...options,headers,redirect:'error'});
  } finally { password=''; }
}
