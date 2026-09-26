import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const funnel=JSON.parse(readFileSync('funnel.json','utf8'));
const current=JSON.parse(readFileSync('src/site-config.json','utf8'));
if(!funnel.client?.name||!Array.isArray(funnel.form_fields)||!funnel.form_fields.length)throw new Error('Set client.name and the exact form_fields in funnel.json before syncing.');
const fields=funnel.form_fields.map(field=>({name:field.name,type:field.type||'text',required:field.required===true,...(field.options?{options:field.options}: {})}));
if(fields.some(f=>!f.name||!/^[-a-zA-Z0-9_]+$/.test(f.name))||new Set(fields.map(f=>f.name)).size!==fields.length)throw new Error('Every form field must have a unique safe name.');
const timezone=funnel.analytics?.timezone||'UTC';
new Intl.DateTimeFormat('en',{timeZone:timezone}).format();
const mode=funnel.analytics?.mode||'disabled';
if(!['consent','essential','disabled'].includes(mode))throw new Error('analytics.mode must be consent, essential, or disabled.');
const attributionMode=funnel.analytics?.attribution_mode||'lead';
if(!['consent','lead','disabled'].includes(attributionMode))throw new Error('analytics.attribution_mode must be consent, lead, or disabled.');
const requiredAttributionMode=funnel.analytics?.required_attribution_mode;
if(requiredAttributionMode===undefined)throw new Error('Set analytics.required_attribution_mode explicitly from the owner requirement before configuring.');
if(requiredAttributionMode!==undefined&&!['consent','lead','disabled'].includes(requiredAttributionMode))throw new Error('analytics.required_attribution_mode must be consent, lead, or disabled when supplied.');
if(requiredAttributionMode&&requiredAttributionMode!==attributionMode)throw new Error(`Required attribution mode ${requiredAttributionMode} does not match analytics.attribution_mode ${attributionMode}.`);
const advertisingUserDataMode=funnel.tracking?.customer_data_mode||'disabled';
if(!['consent','disabled'].includes(advertisingUserDataMode))throw new Error('tracking.customer_data_mode must be consent or disabled.');
const consentUiMode=funnel.privacy?.consent_ui||'disabled';
if(!['internal','external','disabled'].includes(consentUiMode))throw new Error('privacy.consent_ui must be internal, external, or disabled.');
const sensitiveCategory=funnel.tracking?.sensitive_category===true;
if(sensitiveCategory&&advertisingUserDataMode!=='disabled')throw new Error('Sensitive-category funnels must keep tracking.customer_data_mode disabled.');
const gtmContainerId=funnel.tracking?.gtm?.container_id||'';
if(gtmContainerId&&!/^GTM-[A-Z0-9]+$/.test(gtmContainerId))throw new Error('tracking.gtm.container_id must be blank or a GTM- container ID.');
// Offline conversions: which CRM stages are uploaded to Google Ads, under which
// conversion action name (it must match the action created in Google Ads) and value.
const offline=funnel.tracking?.google_ads?.offline_conversions||{};
const googleAdsOffline={};
if(Object.keys(offline.stages||{}).length){
  const currency=offline.currency||'';
  if(currency&&!/^[A-Z]{3}$/.test(currency))throw new Error('tracking.google_ads.offline_conversions.currency must be a three-letter ISO currency code such as USD.');
  const stageIds=new Set((current.stages||[]).map(stage=>stage.id));
  googleAdsOffline.currency=currency;googleAdsOffline.stages={};
  for(const [stage,action] of Object.entries(offline.stages)){
    const label=`tracking.google_ads.offline_conversions.stages.${stage}`;
    if(!stageIds.has(stage))throw new Error(`${label} is not a CRM stage (${[...stageIds].join(', ')}).`);
    const name=String(action?.conversion_name||'').trim();
    if(!name||name.length>100||/[\r\n]/.test(name))throw new Error(`${label}.conversion_name must be the exact Google Ads conversion action name.`);
    if(action.value!==undefined&&!(typeof action.value==='number'&&Number.isFinite(action.value)&&action.value>=0))throw new Error(`${label}.value must be a non-negative number.`);
    if(action.value!==undefined&&!currency)throw new Error('Set tracking.google_ads.offline_conversions.currency when a conversion value is set.');
    googleAdsOffline.stages[stage]={conversion_name:name,...(action.value!==undefined?{value:action.value}:{})};
  }
}
const publicHost=funnel.requested_hosts?.public||'';
const crmHost=funnel.requested_hosts?.crm||'';
const pagesGatewayHost=funnel.requested_hosts?.pages_gateway||'';
for(const [label,host] of [['public',publicHost],['crm',crmHost],['pages_gateway',pagesGatewayHost]])if(host&&!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))throw new Error(`requested_hosts.${label} must be a hostname without a scheme or path.`);
if(Boolean(publicHost)!==Boolean(crmHost)||(publicHost&&publicHost===crmHost))throw new Error('Two-host routing requires distinct public and CRM hostnames, or neither hostname.');
if(pagesGatewayHost&&!pagesGatewayHost.endsWith('.pages.dev'))throw new Error('requested_hosts.pages_gateway must be the exact production pages.dev hostname.');
if(pagesGatewayHost&&(!publicHost||!crmHost))throw new Error('requested_hosts.pages_gateway requires both public and CRM hostnames.');
const phoneDisplay=String(funnel.client?.phone_display||'').trim(), phoneUri=String(funnel.client?.phone_uri||'').trim();
if(phoneUri&&!/^tel:\+?[0-9 ()-]+$/.test(phoneUri))throw new Error('client.phone_uri must be a tel: link such as tel:+15551234567.');
const escapeHtml=value=>value.replace(/[&<>"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[character]);
const headerPhone=phoneDisplay&&phoneUri?`<a class="header-phone" data-header-phone href="${escapeHtml(phoneUri)}">${escapeHtml(phoneDisplay)}</a>`:'<a class="header-phone" data-header-phone href="tel:" hidden>Call</a>';
// Keep the browser attribute in step with funnel.json so a page never shows a
// consent banner (or collects measurement) the server configuration did not select,
// and show the header phone only when a verified number is configured.
for (const page of ['public/index.html','public/thank-you.html']) {
  if (!existsSync(page)) continue;
  const html = readFileSync(page, 'utf8');
  const synced = html.replace(/(<script[^>]*src="[^"]*funnel\.js"[^>]*data-analytics-mode=")[a-z]+(")/, `$1${mode}$2`)
    .replace(/<a class="header-phone" data-header-phone href="[^"]*"(?: hidden)?>[^<]*<\/a>/, headerPhone);
  if (synced !== html) writeFileSync(page, synced);
}
writeFileSync('src/site-config.json',JSON.stringify({...current,name:funnel.client.name,color:funnel.client.color||current.color,logo:funnel.client.logo||'',timezone,analyticsMode:mode,attributionMode,advertisingUserDataMode,consentUiMode,sensitiveCategory,gtmContainerId,googleAdsOffline,publicHost,crmHost,pagesGatewayHost,formFields:fields,allowedPaths:funnel.allowed_paths||['/','/index.html']},null,2)+'\n');
if(crmHost){
  const wrangler=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
  wrangler.workers_dev=false;
  wrangler.preview_urls=false;
  wrangler.vars={...(wrangler.vars||{}),CRM_PUBLIC_ORIGIN:`https://${crmHost}/`};
  writeFileSync('wrangler.jsonc',JSON.stringify(wrangler,null,2)+'\n');
}
console.log('Backend configuration synchronized. Match the form labels/choices to funnel.json, then rerun QA. Public privacy controls read the policy from the same Worker configuration.');
