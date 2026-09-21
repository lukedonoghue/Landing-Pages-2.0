export function freePlanFailures(config) {
  const failures=[];
  if(config.vars?.CF_ACCOUNT_ANALYTICS_TOKEN)failures.push('Store CF_ACCOUNT_ANALYTICS_TOKEN as a Worker secret, never as a Wrangler variable.');
  if(config.vars?.CLOUDFLARE_API_TOKEN||config.vars?.CLOUDFLARE_API_KEY)failures.push('Do not expose a broad Cloudflare credential to the Worker. Usage monitoring accepts only its dedicated Account Analytics Read secret.');
  if(config.vars?.CF_USAGE_ACCOUNT_ID!==undefined&&!/^[a-f0-9]{32}$/i.test(config.vars.CF_USAGE_ACCOUNT_ID))failures.push('CF_USAGE_ACCOUNT_ID must be the selected 32-character Cloudflare account ID.');
  for(const key of ['ai','browser','images','queues','vectorize','durable_objects','r2_buckets','unsafe']) {
    if(config[key])failures.push(`${key} is outside this skill's reviewed Workers/D1 free-only configuration. Do not enable extra billing to publish.`);
  }
  if(config.env)failures.push('Review one explicit flat free-plan configuration; environment overrides are not accepted.');
  if(config.send_email?.length) {
    let recipients=[];
    try { recipients=JSON.parse(config.vars?.CRM_VERIFIED_RECIPIENTS || '[]'); } catch {}
    const valid=Array.isArray(recipients) && recipients.length>0 && recipients.every(v=>typeof v==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    if(!valid)failures.push('Free account email requires an explicit CRM_VERIFIED_RECIPIENTS list of Cloudflare-verified recipients.');
    const binding=config.send_email;
    if(binding.length!==1 || binding[0].name!=='EMAIL')failures.push('Use only the restricted EMAIL binding for free CRM account mail.');
    const destinations=binding[0]?.allowed_destination_addresses;
    if(!valid || !Array.isArray(destinations) || destinations.length!==recipients.length || !recipients.every(v=>destinations.includes(v)))failures.push('Restrict the EMAIL binding to exactly the verified runtime recipient list.');
    const sender=config.vars?.CRM_EMAIL_FROM,senders=binding[0]?.allowed_sender_addresses;
    if(!sender || !Array.isArray(senders) || senders.length!==1 || senders[0]!==sender)failures.push('Restrict the EMAIL binding to the configured verified sender.');
    if(!/^https:\/\/[^/]+\/?$/.test(config.vars?.CRM_PUBLIC_ORIGIN || ''))failures.push('Set the exact HTTPS CRM origin for account confirmation links.');
  }
  return failures;
}
