// Release regressions: synthetic accounts and an in-memory database only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const {updateUser}=await import(pathToFileURL(resolve(root,'src/team-accounts.js')));
const {secureResponse}=await import(pathToFileURL(resolve(root,'src/security.js')));
function database(){
 const db=new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync(resolve(root,'migrations')).filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(resolve(root,'migrations',name),'utf8'));
 const facade={raw:db,afterRead:null};
 const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values);},async first(){const row=db.prepare(sql).get(...args);const snapshot=row?{...row}:null;if(facade.afterRead)await facade.afterRead(sql,args,snapshot);return snapshot;},async all(){return {results:db.prepare(sql).all(...args).map(r=>({...r})),success:true};},async run(){return {results:db.prepare(sql).all(...args).map(r=>({...r})),success:true,meta:{changes:db.prepare('SELECT changes() n').get().n}};}});
 facade.prepare=prepare;facade.batch=async statements=>{db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}};
 return facade;
}
for (const change of [{status:'disabled'},{role:'viewer'}]){
 test(`non-owner cannot modify a concurrently promoted administrator (${JSON.stringify(change)})`,async()=>{
  const DB=database(),id=crypto.randomUUID(),stamp=new Date().toISOString();
  try {
   DB.raw.prepare("INSERT INTO crm_users(id,username,email,role,status,email_verified_at,created_at,updated_at) VALUES(?,?,?,'manager','active',?,?,?)").run(id,'synthetic-target','target@example.invalid',stamp,stamp,stamp);
   let promoted=false;
   DB.afterRead=async(sql,args,row)=>{
    if(!promoted && sql==='SELECT * FROM crm_users WHERE id=?' && args[0]===id && row){
     promoted=true;
     // Interleave an owner-authorized promotion after the first read, before mutation.
     DB.raw.prepare("UPDATE crm_users SET role='admin',version=version+1 WHERE id=?").run(id);
    }
   };
   let rejected=false;try{await updateUser({DB},{id:'synthetic-other-admin',role:'admin'},id,change);}catch(e){if(![403,409].includes(e.status))throw e;rejected=true;}
   const actual=DB.raw.prepare('SELECT role,status,version FROM crm_users WHERE id=?').get(id);
   assert.equal(rejected,true,'A stale authorization snapshot must fail closed rather than modify the now-protected administrator');
   assert.equal(actual.role,'admin');assert.equal(actual.status,'active');
  }finally{DB.raw.close();}
 });
}
test('served PDF permits same-origin guide reader but not arbitrary cross-origin framing',()=>{
 const response=secureResponse(new Response('%PDF-test-only',{headers:{'Content-Type':'application/pdf'}}),'/assets/brochure/service-guide.pdf');
 const xfo=response.headers.get('X-Frame-Options');
 assert.equal(xfo,'SAMEORIGIN','The same-site iframe must not receive DENY');
 assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);
 const inherited=secureResponse(new Response('%PDF-test-only',{headers:{'Content-Type':'application/pdf','X-Frame-Options':'DENY'}}),'/assets/brochure/service-guide.pdf');
 assert.equal(inherited.headers.get('X-Frame-Options'),'SAMEORIGIN');
 for(const [path,type,status] of [
  ['/assets/brochure/service-guide.pdf','text/html',200],
  ['/assets/brochure/service-guide.pdf','application/pdf',404],
  ['/admin/export.pdf','application/pdf',200],
  ['/api/admin/export.pdf','application/pdf',200],
  ['/other.pdf','application/pdf',200]
 ])assert.equal(secureResponse(new Response('not a public guide',{status,headers:{'Content-Type':type}}),path).headers.get('X-Frame-Options'),'DENY');
});
test('admin, login and account-action documents remain unframeable',()=>{
 for(const path of ['/admin/','/login.html','/account-action.html']) {
  const response=secureResponse(new Response('private shell'),path);
  assert.equal(response.headers.get('X-Frame-Options'),'DENY');assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 }
});

// A rejected race must not come at the cost of ordinary owner/manager operations.
test('ordinary edits succeed, while an existing administrator stays owner-managed',async()=>{
 const DB=database(),id=crypto.randomUUID(),stamp=new Date().toISOString();
 try {
  DB.raw.prepare("INSERT INTO crm_users(id,username,email,role,status,email_verified_at,created_at,updated_at) VALUES(?,?,?,'manager','active',?,?,?)").run(id,'ordinary-target','ordinary@example.invalid',stamp,stamp,stamp);
  await updateUser({DB},{id:'other-admin',role:'admin'},id,{role:'viewer'});
  assert.equal(DB.raw.prepare('SELECT role FROM crm_users WHERE id=?').get(id).role,'viewer');
  await updateUser({DB},{id:'owner',role:'admin'},id,{role:'admin'});
  await assert.rejects(updateUser({DB},{id:'other-admin',role:'admin'},id,{status:'disabled'}),e=>e.status===403);
  await updateUser({DB},{id:'owner',role:'admin'},id,{status:'disabled'});
  assert.equal(DB.raw.prepare('SELECT status FROM crm_users WHERE id=?').get(id).status,'disabled');
 } finally { DB.raw.close(); }
});

test('partial and revalidated PDF responses keep one same-origin framing policy',()=>{
 for(const status of [200,206,304]) {
  const response=secureResponse(new Response(status===304?null:'%PDF-test-only',{status,headers:{'Content-Type':'application/pdf; charset=binary','X-Frame-Options':'DENY, SAMEORIGIN'}}),'/assets/brochure/service-guide.pdf');
  assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');
  assert.equal(response.headers.get('Content-Security-Policy'),"frame-ancestors 'self'");
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 }
});

test('PDF exceptions do not cover arbitrary paths, nested assets or HTML errors',()=>{
 for(const pathname of ['/other.pdf','/assets/brochure/nested/private.pdf','/assets/brochure/.pdf','/assets/brochure/guide.pdf.html','/login.pdf','/account-action.pdf','/api/guide.pdf']) {
  const result=secureResponse(new Response('%PDF-test-only',{headers:{'Content-Type':'application/pdf'}}),pathname);
  assert.equal(result.headers.get('X-Frame-Options'),'DENY',pathname);
 }
});

test('static PDF rule removes inherited DENY instead of emitting conflicting values',()=>{
 const text=readFileSync(resolve(root,'public/_headers'),'utf8');
 const blocks=text.split(/\r?\n(?=\/)/);
 const global=blocks.find(block=>block.startsWith('/*\n'));
 const pdf=blocks.find(block=>block.startsWith('/assets/brochure/*.pdf\n'));
 assert.match(global,/X-Frame-Options: DENY/);
 assert.ok(pdf,'A scoped static-asset PDF rule is required');
 assert.match(pdf,/! X-Frame-Options/);
 assert.match(pdf,/Content-Security-Policy: frame-ancestors 'self'/);
 assert.doesNotMatch(pdf,/^\s+X-Frame-Options:/m,'Cloudflare joins duplicate header values; use removal plus CSP');
});
