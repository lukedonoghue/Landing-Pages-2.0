import { HttpError, adminCredentials, cleanText, hashPassword, hmac, json, randomToken, sessionCookie, sessionTokenHash, verifyPassword } from './security.js';
import { accountDeliveryMode, emailConfigured, listEmailRecipients, recipientOnboardingConfigured, requestEmailRecipient, requireVerifiedRecipient } from './email-recipients.js';

const now = () => new Date().toISOString();
const seconds = () => Math.floor(Date.now()/1000);
const roles = new Set(['admin','manager','viewer']);
const publicColumns = 'id,username,email,role,status,email_verified_at,created_at,updated_at';
export function permissions(user) {
  return {manage_users:user.role==='admin',edit_leads:user.role!=='viewer',export_leads:user.role!=='viewer',manage_settings:user.role!=='viewer'};
}
export function authorize(user, path, method) {
  if (path.startsWith('/api/admin/users') && user.role!=='admin') throw new HttpError(403,'Only an administrator can manage users.');
  if (user.role!=='viewer') return;
  const ownAccount = ['/api/admin/account/password','/api/admin/account/revoke-sessions'].includes(path);
  const reads = ['/api/admin/account','/api/admin/config','/api/admin/metrics','/api/admin/leads','/api/admin/notifications','/api/admin/free-usage'];
  if ((method==='GET' && (reads.includes(path) || /^\/api\/admin\/leads\/[a-f0-9-]{36}$/.test(path))) || (method==='POST' && ownAccount)) return;
  throw new HttpError(403,'This account has view-only access.');
}
function email(value) {
  const result = cleanText(value,254,'Email',true).toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)) throw new HttpError(400,'Enter a valid email address.');
  return result;
}
function emailReady(env, request) {
  const deliveryMode=accountDeliveryMode(env,request);
  if(deliveryMode==='unavailable')throw new HttpError(503,'Account actions are not configured. Set the public CRM origin first.');
  const configured = typeof env.CRM_PUBLIC_ORIGIN === 'string' ? env.CRM_PUBLIC_ORIGIN.trim() : '';
  let origin; try { origin = configured ? new URL(configured) : new URL(`${new URL(request.url).origin}/`); } catch { throw new HttpError(503,'Account action origin is not configured.'); }
  if (origin.protocol!=='https:' || origin.origin!==new URL(request.url).origin || origin.pathname!=='/' || origin.search || origin.hash) throw new HttpError(503,'Account action origin does not match this CRM.');
  return {origin:origin.origin,deliveryMode};
}
function audit(env, actor, action, target) { return env.DB.prepare('INSERT INTO crm_access_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,now()); }
async function owner(env) {
  const [credentials, profile] = await Promise.all([adminCredentials(env),env.DB.prepare('SELECT * FROM crm_owner_profile WHERE id=1').first()]);
  return {...credentials,...profile,version:credentials.version,id:'owner',role:'admin',status:'active'};
}
async function targetUser(env,id) {
  const user = id==='owner' ? await owner(env) : await env.DB.prepare('SELECT * FROM crm_users WHERE id=?').bind(id).first();
  if (!user) throw new HttpError(404,'User not found.');
  return user;
}
export async function loginTeam(env,request,body) {
  cleanText(body.password,1024,'Password',true);
  const identifier = cleanText(body.username,254,'Username or email').toLowerCase();
  const primary = await adminCredentials(env);
  const profile = await env.DB.prepare('SELECT email,email_verified_at FROM crm_owner_profile WHERE id=1').first();
  const isOwner = identifier===primary.username || (profile?.email_verified_at && identifier===profile.email);
  const member = isOwner ? null : await env.DB.prepare('SELECT * FROM crm_users WHERE username=? OR email=?').bind(identifier,identifier).first();
  const account = isOwner ? primary : member;
  // Unknown identifiers perform the same password derivation without creating a session.
  const matches = await verifyPassword(body.password,account?.password_hash || primary.password_hash);
  if (!account || !matches || (!isOwner && (account.status!=='active' || !account.email_verified_at))) throw new HttpError(401,'Incorrect username or password.');
  const token=randomToken(),tokenHash=await hmac(env.SESSION_SECRET,`session:${token}`), timestamp=seconds();
  const insert = isOwner
    ? env.DB.prepare('INSERT INTO sessions(token_hash,created_at,expires_at,credential_version,username) SELECT ?,?,?,?,? WHERE COALESCE((SELECT version FROM admin_credentials WHERE id=1),0)=? RETURNING token_hash').bind(tokenHash,timestamp,timestamp+43200,account.version,account.username,account.version)
    : env.DB.prepare(`INSERT INTO sessions(token_hash,created_at,expires_at,credential_version,username,user_id) SELECT ?,?,?,version,username,id FROM crm_users WHERE id=? AND version=? AND status='active' AND email_verified_at IS NOT NULL RETURNING token_hash`).bind(tokenHash,timestamp,timestamp+43200,account.id,account.version);
  const batch=[insert],prior=await sessionTokenHash(env,request);
  if(prior)batch.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(prior));
  const saved=await env.DB.batch(batch);
  if(!saved[0].results.length)throw new HttpError(401,'Credentials changed. Please sign in again.');
  return json({authenticated:true},200,{'Set-Cookie':sessionCookie(request,token)});
}
export async function listUsers(env,request) {
  const primary=await owner(env);
  const [users,requests,recipients]=await Promise.all([
    env.DB.prepare(`SELECT ${publicColumns} FROM crm_users ORDER BY created_at,id`).all(),
    env.DB.prepare(`SELECT r.id,r.user_id,r.status,r.delivery_state,r.attempts,r.created_at,u.username,u.email FROM crm_reset_requests r LEFT JOIN crm_users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.created_at`).all(),
    listEmailRecipients(env)
  ]);
  return {email_configured:emailConfigured(env),account_delivery_mode:accountDeliveryMode(env,request),recipient_onboarding_configured:recipientOnboardingConfigured(env),recipients,users:[{id:'owner',username:primary.username,email:primary.email || '',role:'admin',status:'active',email_verified_at:primary.email_verified_at},...users.results],requests:requests.results.map(r=>r.user_id==='owner'?{...r,username:primary.username,email:primary.email}:r)};
}
async function sendAction(env,request,user,purpose,actor,override={}) {
  const {origin,deliveryMode}=emailReady(env,request),recipient=override.email || user.email;
  if(deliveryMode==='email')await requireVerifiedRecipient(env,recipient);
  if(!recipient || (purpose==='reset' && !user.email_verified_at))throw new HttpError(409,'The account needs a confirmed registered email first.');
  if(user.status==='disabled')throw new HttpError(409,'This account is disabled.');
  const id=crypto.randomUUID(),token=randomToken(),hash=await hmac(env.SESSION_SECRET,`account-action:${token}`);
  const version=override.version ?? user.version, expires=seconds()+(purpose==='reset'?3600:86400);
  await env.DB.prepare('INSERT INTO crm_account_actions(id,token_hash,user_id,email,purpose,expected_version,expires_at,created_at,approved_by,reset_request_id) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,hash,user.id,recipient,purpose,version,expires,now(),actor.id,override.resetRequestId || null).run();
  const link=`${origin}/account-action.html#token=${token}&purpose=${purpose}`;
  const subject=purpose==='invite'?'Your CRM invitation':purpose==='reset'?'Your approved CRM password reset':'Confirm your CRM email';
  if(deliveryMode==='email'){
    try {
      await env.EMAIL.send({from:env.CRM_EMAIL_FROM,to:recipient,subject,text:`${subject}\n\nOpen this single-use link to continue:\n${link}\n\nThis link expires in ${purpose==='reset'?'one hour':'24 hours'}. If you did not expect this message, contact your CRM administrator. No password is included in this email.`});
    } catch {
      await env.DB.prepare("UPDATE crm_account_actions SET state='failed' WHERE id=? AND state='sending'").bind(id).run();
      throw new HttpError(503,'The email provider did not confirm sending. No account was activated. Retry from Users.');
    }
  }
  const accepted=override.resetRequestId
    ? await env.DB.prepare("UPDATE crm_account_actions SET state='ready' WHERE id=? AND state='sending' AND EXISTS(SELECT 1 FROM crm_reset_requests WHERE id=? AND status='pending' AND delivery_state='sending' AND claim_token=?) RETURNING id").bind(id,override.resetRequestId,override.resetClaim).first()
    : await env.DB.prepare("UPDATE crm_account_actions SET state='ready' WHERE id=? AND state='sending' RETURNING id").bind(id).first();
  if(!accepted) {
    await env.DB.prepare("UPDATE crm_account_actions SET state='failed' WHERE id=? AND state='sending'").bind(id).run();
    throw new HttpError(409,'This email was superseded by a newer account action. Use the latest message.');
  }
  await audit(env,actor.id,`${purpose}-email-accepted`,user.id).run();
  return deliveryMode==='email'
    ? {ok:true,delivery_mode:'email',email_status:'accepted',recipient,expires_at:expires}
    : {ok:true,delivery_mode:'manual',action_url:link,recipient,subject,expires_at:expires};
}
export async function createUser(env,request,actor,body) {
  const {deliveryMode}=emailReady(env,request);
  const username=cleanText(body.username,80,'Username',true).toLowerCase(),address=email(body.email);
  if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username))throw new HttpError(400,'Use 3 to 80 letters, numbers, dots, underscores or hyphens for the username.');
  if(!roles.has(body.role))throw new HttpError(400,'Choose Admin, Manager or View-only.');
  const primary=await adminCredentials(env);
  if(username===primary.username || address===primary.username)throw new HttpError(409,'That identity belongs to the owner.');
  const conflict=await env.DB.prepare('SELECT 1 FROM crm_users WHERE username=? OR email=? UNION ALL SELECT 1 FROM crm_owner_profile WHERE email=? OR pending_email=? LIMIT 1').bind(username,address,address,address).first();
  if(conflict)throw new HttpError(409,'That username or email is already registered.');
  if(deliveryMode==='email')try { await requireVerifiedRecipient(env,address); }
  catch(error) {
    if(!(error instanceof HttpError) || error.status!==409)throw error;
    if(!recipientOnboardingConfigured(env))throw error;
    const recipient=await requestEmailRecipient(env,actor,{email:address});
    if(recipient.status!=='verified') {
      const stamp=now();
      const queued=await env.DB.prepare(`UPDATE OR IGNORE crm_email_recipients SET pending_username=?,pending_role=?,pending_requested_by=?,pending_requested_at=?,updated_at=? WHERE id=? AND email=? RETURNING id`).bind(username,body.role,actor.id,stamp,stamp,recipient.id,address).first();
      if(!queued)throw new HttpError(409,'That username is already reserved by another pending invitation.');
      await audit(env,actor.id,'invite-pending-recipient-verification',recipient.id).run();
      return {ok:true,pending_verification:true,recipient_id:recipient.id};
    }
    await requireVerifiedRecipient(env,address);
  }
  const id=crypto.randomUUID(),stamp=now();
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO crm_users(id,username,email,role,created_at,updated_at) SELECT ?,?,?,?,?,?
    WHERE NOT EXISTS(SELECT 1 FROM crm_owner_profile WHERE email=? OR pending_email=?) RETURNING id`).bind(id,username,address,body.role,stamp,stamp,address,address).all();
  if(!result.results.length)throw new HttpError(409,'That username or email is already registered.');
  await audit(env,actor.id,'invite-created',id).run();
  return {...await sendAction(env,request,await targetUser(env,id),'invite',actor),id};
}
export async function continuePendingInvitation(env,request,actor,recipientId) {
  const pending=await env.DB.prepare('SELECT id,email,pending_username,pending_role FROM crm_email_recipients WHERE id=?').bind(recipientId).first();
  if(!pending?.pending_username)return null;
  try {
    const result=await createUser(env,request,actor,{email:pending.email,username:pending.pending_username,role:pending.pending_role});
    if(!result.pending_verification)await env.DB.prepare('UPDATE crm_email_recipients SET pending_username=NULL,pending_role=NULL,pending_requested_by=NULL,pending_requested_at=NULL,updated_at=? WHERE id=? AND pending_username=? AND pending_role=?').bind(now(),pending.id,pending.pending_username,pending.pending_role).run();
    return result;
  } catch(error) {
    const created=await env.DB.prepare('SELECT id FROM crm_users WHERE email=? AND username=?').bind(pending.email,pending.pending_username).first();
    if(created)await env.DB.prepare('UPDATE crm_email_recipients SET pending_username=NULL,pending_role=NULL,pending_requested_by=NULL,pending_requested_at=NULL,updated_at=? WHERE id=? AND pending_username=?').bind(now(),pending.id,pending.pending_username).run();
    throw error;
  }
}
export async function updateUser(env,actor,id,body) {
  if(id==='owner')throw new HttpError(403,'The original owner cannot be disabled or demoted.');
  if(id===actor.id)throw new HttpError(403,'Ask another administrator to change your access.');
  if(Object.keys(body).some(k=>!['role','status','email'].includes(k)) || (!body.role && !body.status && !body.email))throw new HttpError(400,'Change only role, status or an invited user email.');
  const user=await targetUser(env,id),role=body.role ?? user.role,status=body.status ?? user.status,address=body.email===undefined?user.email:email(body.email);
  if(!roles.has(role) || !['invited','active','disabled'].includes(status) || (body.status && !['active','disabled'].includes(body.status)))throw new HttpError(400,'Invalid role or status.');
  if(body.email!==undefined) {
    if(user.status!=='invited' || user.email_verified_at || user.password_hash)throw new HttpError(409,'Only a never-activated invitation email can be corrected.');
    if(emailConfigured(env))await requireVerifiedRecipient(env,address);
    const primary=await adminCredentials(env);
    const conflict=address===primary.username || await env.DB.prepare('SELECT 1 FROM crm_users WHERE id<>? AND email=? UNION ALL SELECT 1 FROM crm_owner_profile WHERE email=? OR pending_email=? LIMIT 1').bind(id,address,address,address).first();
    if(conflict)throw new HttpError(409,'That email is already registered.');
  }
  if(status==='active' && !user.email_verified_at)throw new HttpError(409,'The invited user must confirm their email first.');
  const identityCorrection=body.email!==undefined;
  const updated=await env.DB.prepare(`UPDATE OR IGNORE crm_users SET email=?,role=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?${identityCorrection?" AND status='invited' AND email_verified_at IS NULL AND password_hash IS NULL":''} RETURNING id`).bind(address,role,status,now(),id,user.version).first();
  if(!updated)throw new HttpError(409,identityCorrection?'The invitation was activated or changed. Refresh before correcting it.':'The account changed. Refresh before updating access.');
  await env.DB.batch([env.DB.prepare("UPDATE crm_account_actions SET state='failed' WHERE user_id=? AND state IN ('sending','ready') AND used_at IS NULL").bind(id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),audit(env,actor.id,identityCorrection?'invitation-corrected':'access-updated',id)]);
  return {ok:true};
}
export async function inviteOrReset(env,request,actor,id,purpose) {
  const user=await targetUser(env,id);
  if(purpose==='invite' && user.status!=='invited')throw new HttpError(409,'Only a pending invitation can be resent.');
  return sendAction(env,request,user,purpose,actor);
}
export async function setOwnerEmail(env,request,actor,body) {
  if(actor.id!=='owner')throw new HttpError(403,'Only the original owner can change their registered email.');
  emailReady(env,request);
  const address=email(body.email),primary=await adminCredentials(env);
  cleanText(body.current_password,1024,'Current password',true);
  if(!await verifyPassword(body.current_password,primary.password_hash))throw new HttpError(401,'Current password is incorrect.');
  const updated=await env.DB.prepare(`UPDATE crm_owner_profile SET pending_email=?,version=version+1 WHERE id=1 AND NOT EXISTS(SELECT 1 FROM crm_users WHERE email=?) RETURNING version`).bind(address,address).first();
  if(!updated)throw new HttpError(409,'That email is already registered.');
  return sendAction(env,request,await owner(env),'verify-email',actor,{email:address,version:updated.version});
}
export async function requestReset(env,body) {
  const address=email(body.email),primary=await owner(env);
  const user=primary.email_verified_at && primary.email===address ? primary : await env.DB.prepare("SELECT id FROM crm_users WHERE email=? AND status='active' AND email_verified_at IS NOT NULL").bind(address).first();
  if(user)await env.DB.prepare('INSERT OR IGNORE INTO crm_reset_requests(id,user_id,created_at) VALUES(?,?,?)').bind(crypto.randomUUID(),user.id,now()).run();
  return {ok:true,message:'If this email belongs to an active account, a reset request is awaiting administrator approval.'};
}
export async function reviewReset(env,request,actor,id,approve) {
  const pending=await env.DB.prepare("SELECT * FROM crm_reset_requests WHERE id=? AND status='pending'").bind(id).first();
  if(!pending)throw new HttpError(404,'Pending request not found.');
  if(pending.user_id===actor.id)throw new HttpError(403,'Another administrator must approve your reset. Use your current password to change it, or ask the Cloudflare owner for recovery.');
  const stamp=now(),current=seconds();
  if(!approve) {
    const rejected=await env.DB.prepare("UPDATE crm_reset_requests SET status='rejected',delivery_state='idle',claim_token=NULL,claim_expires_at=NULL,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending' AND (delivery_state<>'sending' OR claim_expires_at<?) RETURNING id").bind(actor.id,stamp,id,current).first();
    if(!rejected)throw new HttpError(409,'This reset request is already being processed. Refresh and try again.');
    await audit(env,actor.id,'reset-rejected',pending.user_id).run();
    return {ok:true};
  }
  const claim=crypto.randomUUID();
  const claimed=await env.DB.prepare("UPDATE crm_reset_requests SET delivery_state='sending',claim_token=?,claim_expires_at=?,attempts=attempts+1,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending' AND (delivery_state IN ('idle','failed') OR (delivery_state='sending' AND claim_expires_at<?)) RETURNING user_id").bind(claim,current+90,actor.id,stamp,id,current).first();
  if(!claimed)throw new HttpError(409,'This reset request is already being processed. Refresh and try again.');
  let delivery=null;
  try {
    const ready=await env.DB.prepare("SELECT id FROM crm_account_actions WHERE reset_request_id=? AND state='ready' AND used_at IS NULL AND expires_at>?").bind(id,current).first();
    if(!ready || accountDeliveryMode(env,request)==='manual') {
      await env.DB.prepare("UPDATE crm_account_actions SET state='failed' WHERE reset_request_id=? AND (state='sending' OR (state='ready' AND expires_at<=?))").bind(id,current).run();
      if(accountDeliveryMode(env,request)==='manual')await env.DB.prepare("UPDATE crm_account_actions SET state='failed' WHERE reset_request_id=? AND state='ready' AND used_at IS NULL").bind(id).run();
      delivery=await sendAction(env,request,await targetUser(env,claimed.user_id),'reset',actor,{resetRequestId:id,resetClaim:claim});
    }
    const results=await env.DB.batch([env.DB.prepare("UPDATE crm_reset_requests SET status='approved',delivery_state='sent',claim_token=NULL,claim_expires_at=NULL WHERE id=? AND status='pending' AND claim_token=?").bind(id,claim),audit(env,actor.id,'reset-approved',claimed.user_id)]);
    if(results[0].meta.changes!==1)throw new HttpError(409,'The reset request changed while it was being approved.');
  } catch(error) {
    await env.DB.prepare("UPDATE crm_reset_requests SET delivery_state='failed',claim_token=NULL,claim_expires_at=NULL WHERE id=? AND status='pending' AND claim_token=?").bind(id,claim).run();
    throw error;
  }
  return delivery || {ok:true,delivery_mode:'email',email_status:'accepted'};
}
export async function completeAction(env,request,body) {
  const token=cleanText(body.token,64,'Confirmation token',true);
  if(!/^[a-f0-9]{64}$/.test(token))throw new HttpError(400,'This link is invalid or expired.');
  const hash=await hmac(env.SESSION_SECRET,`account-action:${token}`);
  const action=await env.DB.prepare("SELECT * FROM crm_account_actions WHERE token_hash=? AND state='ready' AND used_at IS NULL AND expires_at>?").bind(hash,seconds()).first();
  if(!action)throw new HttpError(400,'This link is invalid or expired.');
  const nonce=crypto.randomUUID(),stamp=now(),isOwner=action.user_id==='owner',verifyEmail=action.purpose==='verify-email';
  const encoded=verifyEmail?null:await hashPassword(body.password);
  let predicate,update;
  if(verifyEmail) {
    predicate='EXISTS(SELECT 1 FROM crm_owner_profile WHERE id=1 AND version=? AND pending_email=? AND NOT EXISTS(SELECT 1 FROM crm_users WHERE email=crm_owner_profile.pending_email))';
    update=env.DB.prepare('UPDATE crm_owner_profile SET email=pending_email,pending_email=NULL,email_verified_at=?,version=version+1 WHERE id=1 AND EXISTS(SELECT 1 FROM crm_account_actions WHERE id=? AND consume_id=?)').bind(stamp,action.id,nonce);
  } else if(isOwner) {
    predicate='COALESCE((SELECT version FROM admin_credentials WHERE id=1),0)=? AND EXISTS(SELECT 1 FROM crm_owner_profile WHERE id=1 AND email=? AND email_verified_at IS NOT NULL)';
    const primary=await adminCredentials(env);
    update=env.DB.prepare(`INSERT INTO admin_credentials(id,password_hash,version,updated_at,username) SELECT 1,?,?,?,? WHERE EXISTS(SELECT 1 FROM crm_account_actions WHERE id=? AND consume_id=?)
      ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,version=excluded.version,updated_at=excluded.updated_at,username=excluded.username,recovery_id=NULL`).bind(encoded,action.expected_version+1,stamp,primary.username,action.id,nonce);
  } else {
    predicate="EXISTS(SELECT 1 FROM crm_users WHERE id=crm_account_actions.user_id AND version=? AND email=? AND status IN ('invited','active'))";
    update=env.DB.prepare(`UPDATE crm_users SET password_hash=?,version=version+1,status='active',email_verified_at=COALESCE(email_verified_at,?),updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM crm_account_actions WHERE id=? AND consume_id=?)`).bind(encoded,stamp,stamp,action.user_id,action.id,nonce);
  }
  // D1 batches are transactional. A fresh consume ID ties every mutation to one successful claim.
  const claim=env.DB.prepare(`UPDATE crm_account_actions SET used_at=?,consume_id=? WHERE id=? AND used_at IS NULL AND state='ready' AND expires_at>? AND ${predicate}`).bind(stamp,nonce,action.id,seconds(),action.expected_version,action.email);
  const statements=[claim,update];
  if(!verifyEmail)statements.push(env.DB.prepare(`DELETE FROM sessions WHERE ${isOwner?'user_id IS NULL':'user_id=?'} AND EXISTS(SELECT 1 FROM crm_account_actions WHERE id=? AND consume_id=?)`).bind(...(isOwner?[]:[action.user_id]),action.id,nonce));
  const result=await env.DB.batch(statements);
  if(result[0].meta.changes!==1)throw new HttpError(400,'This link is invalid or expired.');
  await audit(env,action.user_id,`${action.purpose}-completed`,action.user_id).run();
  return json({ok:true,sign_in:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
}
export async function memberPassword(env,request,user,body) {
  const current=await targetUser(env,user.id);
  cleanText(body.current_password,1024,'Current password',true);
  if(!await verifyPassword(body.current_password,current.password_hash))throw new HttpError(401,'Current password is incorrect.');
  if(body.current_password===body.new_password)throw new HttpError(400,'Choose a different new password.');
  const encoded=await hashPassword(body.new_password);
  const result=await env.DB.batch([env.DB.prepare('UPDATE crm_users SET password_hash=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(encoded,now(),user.id,current.version),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  if(result[0].meta.changes!==1)throw new HttpError(409,'The account changed. Sign in again.');
  return json({ok:true,signed_out:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
}
export async function memberRevoke(env,request,user) {
  await env.DB.batch([env.DB.prepare('UPDATE crm_users SET version=version+1 WHERE id=?').bind(user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  return json({ok:true,signed_out:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
}
