import { HttpError, adminCredentials, cleanText, hashPassword, hmac, json, randomToken, sessionCookie, sessionTokenHash, verifyPassword } from './security.js';

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
  const reads = ['/api/admin/account','/api/admin/config','/api/admin/metrics','/api/admin/leads','/api/admin/notifications'];
  if ((method==='GET' && (reads.includes(path) || /^\/api\/admin\/leads\/[a-f0-9-]{36}$/.test(path))) || (method==='POST' && ownAccount)) return;
  throw new HttpError(403,'This account has view-only access.');
}
function email(value) {
  const result = cleanText(value,254,'Email',true).toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)) throw new HttpError(400,'Enter a valid email address.');
  return result;
}
function verifiedRecipients(env) {
  try { const values=JSON.parse(env.CRM_VERIFIED_RECIPIENTS || '[]'); return Array.isArray(values)?values.filter(v=>typeof v==='string').map(v=>v.trim().toLowerCase()):[]; } catch { return []; }
}
export function emailConfigured(env) { return !!(env.EMAIL?.send && typeof env.CRM_EMAIL_FROM==='string' && env.CRM_EMAIL_FROM.includes('@') && env.CRM_PUBLIC_ORIGIN && verifiedRecipients(env).length); }
function emailReady(env, request) {
  if (!emailConfigured(env)) throw new HttpError(503,'Free-plan account email is not configured. Connect a verified Cloudflare sender and verify the recipient addresses first.');
  let origin; try { origin = new URL(env.CRM_PUBLIC_ORIGIN); } catch { throw new HttpError(503,'Account email origin is not configured.'); }
  if (origin.protocol!=='https:' || origin.origin!==new URL(request.url).origin || origin.pathname!=='/' || origin.search || origin.hash) throw new HttpError(503,'Account email origin does not match this CRM.');
  return origin.origin;
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
export async function listUsers(env) {
  const primary=await owner(env);
  const users=await env.DB.prepare(`SELECT ${publicColumns} FROM crm_users ORDER BY created_at,id`).all();
  const requests=await env.DB.prepare(`SELECT r.id,r.user_id,r.status,r.created_at,u.username,u.email FROM crm_reset_requests r LEFT JOIN crm_users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.created_at`).all();
  return {email_configured:emailConfigured(env),users:[{id:'owner',username:primary.username,email:primary.email || '',role:'admin',status:'active',email_verified_at:primary.email_verified_at},...users.results],requests:requests.results.map(r=>r.user_id==='owner'?{...r,username:primary.username,email:primary.email}:r)};
}
async function sendAction(env,request,user,purpose,actor,override={}) {
  const origin=emailReady(env,request),recipient=override.email || user.email;
  if(!verifiedRecipients(env).includes(recipient))throw new HttpError(409,'Cloudflare Free requires this recipient to be verified first. Ask the account owner to complete email verification and add it to the restricted sender configuration, then retry.');
  if(!recipient || (purpose==='reset' && !user.email_verified_at))throw new HttpError(409,'The account needs a confirmed registered email first.');
  if(user.status==='disabled')throw new HttpError(409,'This account is disabled.');
  const id=crypto.randomUUID(),token=randomToken(),hash=await hmac(env.SESSION_SECRET,`account-action:${token}`);
  const version=override.version ?? user.version, expires=seconds()+(purpose==='reset'?3600:86400);
  await env.DB.prepare('INSERT INTO crm_account_actions(id,token_hash,user_id,email,purpose,expected_version,expires_at,created_at,approved_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,hash,user.id,recipient,purpose,version,expires,now(),actor.id).run();
  const link=`${origin}/account-action.html#token=${token}&purpose=${purpose}`;
  const subject=purpose==='invite'?'Your CRM invitation':purpose==='reset'?'Your approved CRM password reset':'Confirm your CRM email';
  try {
    await env.EMAIL.send({from:env.CRM_EMAIL_FROM,to:recipient,subject,text:`${subject}\n\nOpen this single-use link to continue:\n${link}\n\nThis link expires in ${purpose==='reset'?'one hour':'24 hours'}. If you did not expect this message, contact your CRM administrator. No password is included in this email.`});
  } catch {
    await env.DB.prepare("UPDATE crm_account_actions SET state='failed' WHERE id=?").bind(id).run();
    throw new HttpError(503,'The email provider did not confirm sending. No account was activated. Retry from Users.');
  }
  await env.DB.batch([env.DB.prepare("UPDATE crm_account_actions SET state='ready' WHERE id=?").bind(id),audit(env,actor.id,`${purpose}-email-accepted`,user.id)]);
  return {ok:true,email_status:'accepted',expires_at:expires};
}
export async function createUser(env,request,actor,body) {
  emailReady(env,request);
  const username=cleanText(body.username,80,'Username',true).toLowerCase(),address=email(body.email);
  if(!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username))throw new HttpError(400,'Use 3 to 80 letters, numbers, dots, underscores or hyphens for the username.');
  if(!roles.has(body.role))throw new HttpError(400,'Choose Admin, Manager or View-only.');
  const primary=await adminCredentials(env);
  if(username===primary.username || address===primary.username)throw new HttpError(409,'That identity belongs to the owner.');
  const id=crypto.randomUUID(),stamp=now();
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO crm_users(id,username,email,role,created_at,updated_at) SELECT ?,?,?,?,?,?
    WHERE NOT EXISTS(SELECT 1 FROM crm_owner_profile WHERE email=? OR pending_email=?) RETURNING id`).bind(id,username,address,body.role,stamp,stamp,address,address).all();
  if(!result.results.length)throw new HttpError(409,'That username or email is already registered.');
  await audit(env,actor.id,'invite-created',id).run();
  return {...await sendAction(env,request,await targetUser(env,id),'invite',actor),id};
}
export async function updateUser(env,actor,id,body) {
  if(id==='owner')throw new HttpError(403,'The original owner cannot be disabled or demoted.');
  if(id===actor.id)throw new HttpError(403,'Ask another administrator to change your access.');
  if(Object.keys(body).some(k=>!['role','status'].includes(k)) || (!body.role && !body.status))throw new HttpError(400,'Change only role or status.');
  const user=await targetUser(env,id),role=body.role ?? user.role,status=body.status ?? user.status;
  if(!roles.has(role) || !['invited','active','disabled'].includes(status) || (body.status && !['active','disabled'].includes(body.status)))throw new HttpError(400,'Invalid role or status.');
  if(status==='active' && !user.email_verified_at)throw new HttpError(409,'The invited user must confirm their email first.');
  await env.DB.batch([env.DB.prepare('UPDATE crm_users SET role=?,status=?,version=version+1,updated_at=? WHERE id=?').bind(role,status,now(),id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),audit(env,actor.id,'access-updated',id)]);
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
  if(approve)await sendAction(env,request,await targetUser(env,pending.user_id),'reset',actor);
  await env.DB.batch([env.DB.prepare("UPDATE crm_reset_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(approve?'approved':'rejected',actor.id,now(),id),audit(env,actor.id,approve?'reset-approved':'reset-rejected',pending.user_id)]);
  return {ok:true};
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
