#!/usr/bin/env python3
"""Two human review checkpoints bound to the exact copy and release they approve.

This records a user's real instruction; it cannot authenticate the person writing
that instruction. Never use this helper to invent consent or treat QA as approval.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import check_gates
import copy_library
import image_workflow

COPY_FILES = {
    'copy': 'build/page-copy.json', 'brief': 'build/client-copy-brief.json',
    'context': 'build/copy-context.json', 'review': 'build/copy-editorial-review.json',
}

def now(): return datetime.now(timezone.utc).isoformat()
def read(path): return json.loads(path.read_text())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def state_path(root): return root / 'build/workflow.json'
def load(root):
    return read(state_path(root)) if state_path(root).exists() else {'schema_version': 1, 'approvals': {}}
def save(root, state):
    path = state_path(root); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + '\n')

def copy_state(root):
    paths = {key: root / value for key, value in COPY_FILES.items()}
    missing = [str(path.relative_to(root)) for path in paths.values() if not path.is_file()]
    if missing: return {'status':'blocked','failures':['Missing copy evidence: ' + ', '.join(missing)]}
    audit = copy_library.audit(paths['copy'], paths['brief'], paths['context'], paths['review'])
    failures = audit['failures'] + audit['editorial_requirements']
    hashes = {key: sha(path) for key, path in paths.items()}
    contract = read(root/'funnel.json') if (root/'funnel.json').exists() else {}
    approved_contract = {key:contract.get(key) for key in ['offer','cta','follow_up_promise','audience','search_intent','form_fields','brochure_gated']}
    fingerprint = hashlib.sha256(json.dumps({'copy':hashes['copy'],'contract':approved_contract},sort_keys=True).encode()).hexdigest()
    return {'status':audit['overall_status'],'failures':failures,'fingerprint':fingerprint,'input_hashes':hashes,'warnings':audit['warnings']}

def check_copy_approval(root, allow_fixture=False):
    current = copy_state(root)
    if current['status'] == 'blocked': return current
    approval = load(root).get('approvals',{}).get('copy',{})
    failures = []
    if approval.get('fingerprint') != current['fingerprint']: failures.append('Copy approval is missing or stale. Show the complete current copy and wait for the user to approve it before designing.')
    if approval.get('actor') != 'user' and not (allow_fixture and approval.get('actor') == 'fixture'): failures.append('A real user copy approval is required; automated review is not approval.')
    return {**current,'status':'blocked' if failures else current['status'],'failures':failures}

def check_publish_approval(root):
    if not read(root/'funnel.json').get('quality',{}).get('complete_workflow'):
        return {'status':'blocked','failures':['Complete workflow verification is required before publishing.']}
    copy_result = check_copy_approval(root)
    if copy_result['status'] == 'blocked': return copy_result
    gates = check_gates.check(root,'handoff',root/'build/gates.json')
    if gates['status'] == 'blocked': return gates
    current = check_gates.source_snapshot(root)['source_fingerprint']
    approval = load(root).get('approvals',{}).get('publish',{})
    failures = []
    if approval.get('actor') != 'user' or approval.get('fingerprint') != current:
        failures.append('Final publish approval is missing or stale. Present this exact reviewed funnel and wait for the user to approve publication.')
    return {'status':'blocked' if failures else gates['status'],'source_fingerprint':current,'failures':failures,'warnings':gates.get('warnings',[])}

def record(root, kind, message, message_id, fixture=False, allow_test_lead=False):
    if not message.strip() or not message_id.strip(): raise ValueError('Record the actual user approval message and its conversation/message reference.')
    if fixture and kind == 'publish': raise ValueError('Fixture approvals can never authorize publishing.')
    if kind == 'copy': current = copy_state(root)
    else:
        copy_result = check_copy_approval(root)
        if copy_result['status'] == 'blocked': raise ValueError('; '.join(copy_result['failures']))
        current = check_gates.check(root,'handoff',root/'build/gates.json')
    if current['status'] == 'blocked': raise ValueError('; '.join(current['failures']))
    fingerprint = current.get('fingerprint') or current['source_fingerprint']
    state = load(root)
    state.setdefault('approvals',{})[kind] = {'actor':'fixture' if fixture else 'user','message':message.strip(),'message_id':message_id.strip(),'approved_at':now(),'fingerprint':fingerprint,'allow_test_lead':bool(kind=='publish' and allow_test_lead)}
    if kind == 'copy': state['approvals'].pop('publish',None)
    save(root,state)
    return {'status':'pass','recorded':kind,'actor':'fixture' if fixture else 'user','fingerprint':fingerprint,'next':'design' if kind=='copy' else 'publish'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command',required=True)
    for name in ['status','check-copy','check-publish','record-copy-evidence','record-image-evidence','approve-copy','approve-publish']:
        p=sub.add_parser(name);p.add_argument('project_root',type=Path)
        if name.startswith('approve'):
            p.add_argument('--message-file',type=Path,required=True,help='File containing the real user approval; no invented or self-review approvals')
            p.add_argument('--message-id',required=True)
            if name=='approve-copy':p.add_argument('--fixture',action='store_true',help='Only a labeled local protocol test; never valid for publishing')
            if name=='approve-publish':p.add_argument('--allow-test-lead',action='store_true',help='Only when the actual approval includes a controlled live test lead')
        if name=='check-copy':p.add_argument('--allow-fixture',action='store_true')
    args=parser.parse_args();root=args.project_root.expanduser().resolve()
    try:
        if args.command=='record-image-evidence':
            plan_path=root/'image-plan.json';plan=read(plan_path)
            evaluated=image_workflow.gate(plan,root)
            snapshot=read(root/'build/gate-snapshot.json')
            artifacts=[{'path':'image-plan.json','type':'image_plan','sha256':sha(plan_path)}]
            for asset in plan.get('assets',[]):
                for item in [asset.get('source'),*asset.get('variants',[]),asset.get('review',{}).get('report')]:
                    if item:artifacts.append({'path':item['path'],'type':'image_evidence','sha256':item['sha256']})
                for view in asset.get('review',{}).get('result',{}).values():
                    if isinstance(view,dict) and view.get('screenshot_evidence'):
                        item=view['screenshot_evidence'];artifacts.append({'path':item['path'],'type':'screenshot','sha256':item['sha256']})
            result={'schema_version':1,'gate':'images','status':'pass' if evaluated['passed'] else 'blocked','source_fingerprint':snapshot['source_fingerprint'],'executed_at':now(),'target':{'mode':snapshot['mode'],'url':''},'tool':{'name':'image_workflow validate','version':'1'},'checks':{'image_workflow':evaluated['passed']},'image_review':evaluated,'plan_sha256':sha(plan_path),'artifacts':artifacts,'failures':evaluated['errors'],'warnings':[]}
            (root/'build/images-audit.json').write_text(json.dumps(result,indent=2)+'\n')
        elif args.command=='record-copy-evidence':
            current=copy_state(root)
            if current['status']=='blocked': raise ValueError('; '.join(current['failures']))
            snapshot=read(root/'build/gate-snapshot.json')
            paths={key:root/value for key,value in COPY_FILES.items()}
            audit=copy_library.audit(paths['copy'],paths['brief'],paths['context'],paths['review'])
            result={'schema_version':1,'gate':'copy','status':current['status'],'source_fingerprint':snapshot['source_fingerprint'],'executed_at':now(),'target':{'mode':snapshot['mode'],'url':''},'tool':{'name':'copy_library audit','version':'1'},'checks':{'current_editorial_review':True},'copy_audit':audit,'artifacts':[{'path':str(path.relative_to(root)),'type':key,'sha256':sha(path)} for key,path in paths.items()],'failures':[],'warnings':audit['warnings']}
            (root/'build/copy-audit.json').write_text(json.dumps(result,indent=2)+'\n')
        elif args.command=='check-copy': result=check_copy_approval(root,args.allow_fixture)
        elif args.command=='check-publish': result=check_publish_approval(root)
        elif args.command.startswith('approve'):
            result=record(root,args.command.removeprefix('approve-'),args.message_file.read_text(),args.message_id,getattr(args,'fixture',False),getattr(args,'allow_test_lead',False))
        else:
            copy_result=check_copy_approval(root)
            result={'status':'pass','stage':'awaiting_copy_approval' if copy_result['status']=='blocked' else 'design_and_qa','copy':copy_result,'approvals':load(root).get('approvals',{}),'limits':'Approval records preserve the user instruction and exact revision; they are not identity verification.'}
        print(json.dumps(result,indent=2))
        return 1 if result['status']=='blocked' else 0
    except (OSError,ValueError,KeyError) as error:
        print(json.dumps({'status':'blocked','failures':[str(error)]},indent=2));return 1

if __name__=='__main__':sys.exit(main())
