/** Durable redacted journey checkpoints; original synthetic requests stay private. */
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { atomic, read, inside, hash, UUID } from './release-tools.mjs';

export const MAX_JOURNEY_RUNS = 3;
const RECOVERY = {
  source_changed: 'Project source changed or has no current snapshot. Preserve the prior journey and review/test this revision before continuing.',
  binding_mismatch: 'Saved journey does not match this source, fixture, snapshot or destination. Resume its original reviewed release; do not replace its request.',
  retry_limit: 'This journey has reached its bounded recovery limit. Preserve its receipt and diagnose the recorded failure before any additional attempt.',
  private_payload: 'The original private recovery payload is missing or changed. Restore that exact private file; do not replace it with a new submission.',
  contact_changed: 'The test contact was changed outside this verification operation. Inspect its current stage/version and preserve those edits; recovery will not overwrite them.',
  cleanup_proof: 'Cleanup began without complete retained journey proof. Reconcile the saved receipt and artifacts; do not recreate a removed contact.'
};
export class JourneyRecoveryError extends Error {
  constructor(code) { super(RECOVERY[code] || 'Preserve the saved journey and inspect its recovery evidence.');this.code=code; }
}
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const fingerprint = value => hash(JSON.stringify(canonical(value)));

export function openJourney({root, out, binding, resume=false}) {
  root=path.resolve(root);out=inside(root,out);
  const file=path.join(out,'attempt.json');
  let state;
  if(resume) {
    state=read(file);
    if(state.schema_version!==2 || !UUID.test(state.id || '') || fingerprint(state.binding)!==fingerprint(binding)) throw new JourneyRecoveryError('binding_mismatch');
    if(!Number.isSafeInteger(state.runs) || state.runs<1 || state.runs>=MAX_JOURNEY_RUNS)throw new JourneyRecoveryError('retry_limit');
  } else {
    const old=existsSync(file)?read(file):null;
    if(old?.form_attempted || old?.visit_attempted)throw new Error('This output already contains a possibly submitted journey. Resume it or choose a fresh output after resolving its outcome.');
    state={schema_version:2,id:randomUUID(),binding,runs:0,started_at:new Date().toISOString(),form_attempted:false,visit_attempted:false,request_key:null,receipt:null,visits:[],trace:[],runtime_errors:0};
  }
  state.runs++;state.stage='starting';
  const save=()=>atomic(file,state);save();
  const privateDir=inside(root,'.secrets/journeys/'+state.id,true);
  const payloadFile=kind=>inside(root,path.join(privateDir,kind+'.json'),true);
  const retain=(kind,body)=>{
    const digest=fingerprint(body),key=kind+'_sha256';
    if(state[key] && state[key]!==digest)throw new Error('A recovery request cannot replace the original payload.');
    mkdirSync(privateDir,{recursive:true,mode:0o700});atomic(payloadFile(kind),body);state[key]=digest;save();
    return body;
  };
  const payload=kind=>{try{const body=read(payloadFile(kind));if(fingerprint(body)!==state[kind+'_sha256'])throw new Error();return body;}catch{throw new JourneyRecoveryError('private_payload');}};
  const runOut=path.join(out,'runs',String(state.runs).padStart(3,'0'));
  mkdirSync(runOut,{recursive:true});
  const retainPublic=value=>{
    const relative=path.relative(root,path.join(runOut,'public-complete.json')).split(path.sep).join('/');
    atomic(inside(root,relative),value);state.public_complete={path:relative,sha256:hash(readFileSync(inside(root,relative)))};save();
  };
  const publicProof=()=>{
    if(!state.public_complete)return null;
    const file=inside(root,state.public_complete.path);
    if(hash(readFileSync(file))!==state.public_complete.sha256)throw new Error('Retained public journey evidence changed.');
    const value=read(file);
    if(fingerprint(value.binding)!==fingerprint(binding) || !value.redirect || !value.brochure || !value.receipt || value.receipt.lead_id!==state.receipt?.lead_id || value.receipt.receipt_id!==state.receipt?.receipt_id)throw new Error('Retained browser proof does not match its accepted receipt.');
    for(const item of value.artifacts)if(hash(readFileSync(inside(root,item.path)))!==item.sha256)throw new Error('Retained browser artifact changed.');
    return value;
  };
  const retainCore=value=>{
    const relative=path.relative(root,path.join(runOut,'core-complete.json')).split(path.sep).join('/');
    atomic(inside(root,relative),value);state.core_complete={path:relative,sha256:hash(readFileSync(inside(root,relative)))};save();
  };
  const coreProof=()=>{
    if(!state.core_complete)return null;
    const file=inside(root,state.core_complete.path);
    if(hash(readFileSync(file))!==state.core_complete.sha256)throw new Error('Retained core journey evidence changed.');
    const value=read(file);
    if(fingerprint(value.binding)!==fingerprint(binding) || value.observations?.receipt_id!==state.receipt?.receipt_id || value.observations?.lead_id!==state.receipt?.lead_id || ['receipt_correlation','crm_update','metrics'].some(key=>value.assertions?.[key]!==true) || !value.checks?.length || value.checks.some(row=>row.status!=='pass'))throw new Error('Retained pre-cleanup proof is incomplete or belongs to another journey.');
    if(['db_receipt','crm_recovery','dashboard_result'].some(type=>value.artifacts.filter(item=>item.type===type).length!==1))throw new Error('Retained pre-cleanup artifacts are incomplete.');
    for(const item of value.artifacts)if(hash(readFileSync(inside(root,item.path)))!==item.sha256)throw new Error('Retained pre-cleanup artifact changed.');
    return value;
  };
  return {state,save,retain,payload,runOut,retainPublic,publicProof,retainCore,coreProof};
}
