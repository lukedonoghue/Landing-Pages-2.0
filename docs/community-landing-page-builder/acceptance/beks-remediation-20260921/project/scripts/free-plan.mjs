export function freePlanFailures(config) {
  const failures=[];
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
