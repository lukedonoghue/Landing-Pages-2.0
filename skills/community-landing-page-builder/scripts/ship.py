#!/usr/bin/env python3
"""Resumable publishing coordinator. Status/JSON mode never uses provider credentials.

Human operators launch the loopback wizard. The coding agent may inspect status,
repair local QA failures, and reopen the same workflow; it must not invent consent.
The existing publisher remains responsible for freezing, migrations and deployment.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import uuid

import check_gates
import workflow_storage as storage

VERSION = 1
STATE = 'build/ship/state.json'
STAGES = ('inputs','prerequisites','cloudflare','prepare','configure','quality','sheets',
          'operator','preflight','approve','protect','publish','cleanup','verify','ready')
MUTATING = {'configure','protect','publish','cleanup','sheets'}
LABELS = {
    'inputs':'Where should your page go?', 'prerequisites':'Checking your computer',
    'cloudflare':'Connect Cloudflare', 'prepare':'Prepare your hosting',
    'configure':'Preparing your site and private owner access', 'quality':'Checking the finished page',
    'sheets':'Connect Google Sheets', 'operator':'Confirm your account safeguards',
    'preflight':'Checking the destination', 'approve':'Ready to publish?',
    'protect':'Saving recovery information', 'publish':'Publishing and testing your page',
    'cleanup':'Removing this release’s test contact', 'verify':'Checking the release receipt',
    'ready':'Your published page is verified'}
ACTION_TEXT = {
    'operator_required': ('Open the publishing wizard on your own computer',
        'Run the displayed command in a trusted terminal outside your coding agent. No password belongs in chat.'),
    'prerequisites': ('One local setup step is needed',
        'Ask your coding assistant to run the project doctor and bootstrap using the supported Node runtime, then continue here.'),
    'login': ('Sign in to Cloudflare',
        'Open the Cloudflare login from this wizard, approve access in your browser, then continue.'),
    'account': ('Choose your Cloudflare account', 'Select the account that should own this site.'),
    'quality': ('The page needs a local quality check',
        'Your coding assistant should repair or refresh the current local quality evidence. Publication stays paused; no quality check is waived.'),
    'staging_isolation': ('Use a separate staging site and database',
        'Staging cannot adopt an existing database that this wizard has not already bound as staging. Start from a fresh staging project and a unique site name; do not relabel production data.'),
    'database_conflict': ('Confirm the existing database',
        'A database with this site name already exists. Confirm its identity before reusing it, or start a different site.'),
    'split_host': ('This project has separate public and CRM domains',
        'The shipping adapter does not yet certify the two-host live journey. Use the existing reviewed two-host publisher; this wizard will not collapse or weaken that configuration.'),
    'sheets_setup': ('Finish the Google connection in your browser',
        'Create a standalone Apps Script from the supplied files. The private property handoff stays on your computer; never paste it into your coding assistant.'),
    'sheets_probe': ('Google has not confirmed this connection yet',
        'Check the versioned /exec deployment and its private Script Properties, then continue. No real lead is used to test the connection.'),
    'edge': ('Enable protection against repeated form submissions',
        'Open your Cloudflare domain security settings and add the supplied rate-limit rule. Existing rules are never overwritten and paid features are never enabled automatically.'),
    'existing_access': ('Review existing CRM access',
        'This destination already has named users or outbound connections. Review them once; the wizard never removes access or forwards data without your approval.'),
    'destination': ('The destination needs attention',
        'Check the selected Cloudflare account, domain and private owner access. Detailed diagnostics stay in the local protected folder.'),
    'approval_stale': ('The page or destination changed',
        'The old publishing approval has been cleared. Review the updated page and destination before publishing.'),
    'recovery': ('Resume the saved release',
        'The previous operation may have reached Cloudflare. Continue checks the saved journal first; it never starts an unreviewed replacement upload.'),
    'cleanup': ('Your test contact still needs cleanup',
        'The saved synthetic contact will be reconciled and erased. No other contact is selected. Publication is not marked complete until cleanup is verified.'),
    'handoff': ('Open the private handoff on this computer',
        'The system could not open your private file automatically. Use the existing owner-access or Google handoff in the trusted operator context; no secret is returned here.'),
    'verification': ('The release is not verified yet',
        'Continue retries verification of the same saved release. A successful upload alone is not a release approval.'),
    'changed_after_publish': ('The saved release and local files differ',
        'Preserve the release journal. Reconcile the saved release before preparing another one; this wizard will not redeploy automatically.'),
}


def now(): return datetime.now(timezone.utc).isoformat()
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def object_file(path):
    value=json.loads(path.read_text())
    if not isinstance(value,dict): raise ValueError('Expected an object in the project configuration.')
    return value


def safe_project(raw):
    original=Path(raw).expanduser().absolute()
    for parent in [original,*original.parents]:
        if parent.is_symlink(): raise ValueError('Use a real project directory, not a symlink.')
    root=original.resolve()
    for item in ('funnel.json','wrangler.jsonc','scripts/publish.mjs','scripts/ship-provider.mjs'):
        p=storage.path_inside(root,item)
        if not p.is_file(): raise ValueError('Open a generated, current Cloudflare project with the guided publishing helpers.')
    return root


def validate_intent(value):
    allowed={'domain','owner','sheets','environment','site','account_id','existing_database_id','sheets_url','sheet_id'}
    if not isinstance(value,dict) or set(value)-allowed: raise ValueError('Unknown publishing setting.')
    result=dict(value)
    result.setdefault('environment','production');result.setdefault('sheets',False)
    if result['environment'] not in {'production','staging'} or type(result['sheets']) is not bool:
        raise ValueError('Choose staging or production and whether to use Sheets.')
    for name in ('domain','owner','site'):
        if not isinstance(result.get(name),str): raise ValueError('Enter your domain and owner email.')
        result[name]=result[name].strip().lower()
    if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}',result['domain']) or len(result['domain'])>253:
        raise ValueError('Use a domain without a protocol, path, port or wildcard.')
    if re.search(r'\.(?:localhost|local|invalid|test|example|internal)$',result['domain']):
        raise ValueError('Use your actual public domain, not a reserved test hostname.')
    if not re.fullmatch(r'[a-z0-9][a-z0-9._+\-]{0,63}@[a-z0-9.-]+\.[a-z]{2,63}',result['owner']) or len(result['owner'])>80:
        raise ValueError('Use an owner email supported by the CRM (up to 80 characters).')
    if not re.fullmatch(r'[a-z][a-z0-9-]{2,48}',result['site']) or result['site']=='branded-lead-funnel':
        raise ValueError('Use a unique site name of 3–49 lowercase letters, numbers and hyphens.')
    if result.get('account_id') and not re.fullmatch(r'[a-f0-9]{32}',result['account_id']):raise ValueError('Choose a valid Cloudflare account.')
    if result.get('existing_database_id'):
        try:
            if str(uuid.UUID(result['existing_database_id']))!=result['existing_database_id']:raise ValueError()
        except (ValueError,AttributeError):raise ValueError('Choose the verified database identifier.')
    if result.get('sheets_url') and not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec',result['sheets_url']):
        raise ValueError('Use the clean Google /exec address without a secret, query or fragment.')
    if result.get('sheet_id') and not re.fullmatch(r'[A-Za-z0-9_-]{20,160}',result['sheet_id']):raise ValueError('Enter the spreadsheet identifier only.')
    return result


class Busy(ValueError): pass


@contextmanager
def shipping_lock(root):
    file=storage.path_inside(root,'build/ship/coordinator.lock')
    file.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    fd=os.open(file,os.O_RDWR|os.O_CREAT|getattr(os,'O_NOFOLLOW',0),0o600)
    try:
        try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise Busy('Publishing is already running for this project. Open its existing wizard.')
        yield
    finally:os.close(fd)


class Provider:
    """Only named reviewed operations; no browser-supplied executable/arguments."""
    def __init__(self,root,node='node'):
        self.root=root;self.node=node
    def call(self,operation,payload):
        cmd=[self.node,str(self.root/'scripts/ship-provider.mjs'),operation]
        try:
            proc=subprocess.run(cmd,cwd=self.root,input=json.dumps(payload),encoding='utf-8',
                                stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=3600,
                                env={**os.environ,'FUNNEL_PYTHON':sys.executable,'WRANGLER_SEND_METRICS':'false'})
            data=json.loads(proc.stdout)
            if not isinstance(data,dict) or data.get('status') not in {'pass','action','uncertain'}:raise ValueError()
            # Nonzero can never be converted to pass by a child’s stdout.
            if proc.returncode!=0 and data['status']=='pass':raise ValueError()
            return data
        except (subprocess.SubprocessError,OSError,ValueError):
            return {'status':'uncertain' if operation in MUTATING else 'action','code':'recovery' if operation in MUTATING else 'destination'}


class Ship:
    def __init__(self,root,adapter=None,node='node'):
        self.root=Path(root).resolve();self.adapter=adapter or Provider(self.root,node)
    def requirements(self,state):
        import runtime_context
        policy=object_file(runtime_context.skill_root(__file__)/'assets/ship/requirements.json')
        if policy.get('schema_version')!=1:raise ValueError('Unsupported readiness policy.')
        rows=[]
        for requirement in policy['requirements']:
            mode=requirement['mode']
            if requirement.get('when') not in {None,'sheets'}:raise ValueError('Unknown conditional requirement.')
            if requirement.get('when')=='sheets' and not state['intent']['sheets']:
                rows.append({'id':requirement['id'],'status':'not-enabled'});continue
            if mode=='CONFIRM':
                record=state['attestations'].get(requirement['attestation'],{})
                if record.get('value') is not True:raise ValueError('A required owner confirmation is missing.')
                rows.append({'id':requirement['id'],'status':'owner-confirmed','automatically_verified':False})
            elif mode in {'AUTO','AUTO_OR_CONFIRM'}:
                stage=requirement['stage']
                if stage not in state['completed']:raise ValueError('A required automated check is incomplete.')
                status='automated-pass'
                if mode=='AUTO_OR_CONFIRM' and state['completed'][stage]['evidence'].get('edge',{}).get('automatically_verified') is not True:status='owner-confirmed'
                rows.append({'id':requirement['id'],'status':status,'automatically_verified':status=='automated-pass'})
            else:raise ValueError('Unknown readiness requirement class.')
        return rows

    def fingerprint(self):return check_gates.source_snapshot(self.root)['source_fingerprint']
    def load(self):
        value=storage.read(self.root,STATE,{})
        if not value:return {'schema_version':VERSION,'id':str(uuid.uuid4()),'revision':0,'stage':'inputs',
            'project':digest(str(self.root)),'intent':{},'completed':{},'consents':{},'attestations':{},
            'events':[],'pending':None,'previous_release':None,'created_at':now(),'updated_at':now()}
        if value.get('schema_version')!=VERSION or value.get('project')!=digest(str(self.root)) or value.get('stage') not in STAGES:
            raise ValueError('The saved publishing state belongs to another project or version. Preserve it for recovery.')
        return value
    def save(self,state):
        state['revision']+=1;state['updated_at']=now();state['events']=state['events'][-100:]
        storage.write(self.root,STATE,state)
    def binding(self,state):return digest({'source':self.fingerprint(),'intent':state['intent']})
    def payload(self,state):
        return {'run_id':state['id'],'intent':state['intent'],'consents':state['consents'],
                'attestations':state['attestations'],'source':self.fingerprint(),'previous_release':state.get('previous_release')}
    def card(self,state):
        stage=state['stage'];code=state.get('blocked')
        if code:
            title,text=ACTION_TEXT.get(code,ACTION_TEXT['destination'])
            return {'kind':'action','code':code,'title':title,'text':text,'choices':state.get('choices',[])}
        defaults={
            'inputs':('form','Your domain, owner email and an optional Google Sheets connection are enough to start.'),
            'prepare':('prepare','Allow this wizard to prepare this exact Cloudflare account, domain and site database. This does not publish the page.'),
            'operator':('attest','Confirm account MFA, the privacy/retention notice, and a trusted publishing computer. These are owner confirmations, not automated proof.'),
            'approve':('publish','Publish this exact page to the displayed domain, run one labelled synthetic enquiry, then permanently remove only that test contact and its managed copies.'),
            'ready':('complete','Deployment, the saved live journey and test-contact cleanup were verified. See the release receipt for the exact scope and any owner-confirmed controls.')}
        kind,text=defaults.get(stage,('working','Routine checks run automatically. You can close and reopen this wizard to resume.'))
        return {'kind':kind,'title':LABELS[stage],'text':text}
    def view(self,state=None):
        state=state or self.load()
        state=dict(state)
        if state['stage']=='ready' and state.get('receipt',{}).get('source')!=self.fingerprint():
            state['blocked']='changed_after_publish'
        return {'schema_version':VERSION,'id':state['id'],'revision':state['revision'],'stage':state['stage'],
                'title':LABELS[state['stage']],'intent':state['intent'],'card':self.card(state),
                'completed':list(state['completed']),'updated_at':state['updated_at'],
                'receipt':state.get('receipt'),'busy':bool(state.get('pending')),
                'operator_command':f'python3 scripts/ship.py --project . --operator --ui'}
    def status(self):return self.view()
    def _drift(self,state):
        consent=state['consents'].get('publish')
        if consent and consent['binding']!=self.binding(state):
            if state.get('pending') or 'publish' in state['completed'] or self._release_exists(state):
                state['blocked']='changed_after_publish';self.save(state);return True
            state['consents'].pop('publish',None)
            for phase in STAGES[STAGES.index('quality'):]:state['completed'].pop(phase,None)
            state['stage']='quality';state['blocked']='approval_stale';self.save(state);return True
        return False
    def prior_verified(self):
        pointer=storage.read(self.root,'build/current-release.json',{})
        if not pointer:return None
        try:
            ident=str(uuid.UUID(pointer['id']))
            saved=storage.read(self.root,'build/releases/'+ident+'/state.json',{})
            if saved.get('phase')!='verified':raise ValueError('Unresolved release')
            import release_state
            release_state.verified(self.root,ident)
            return ident
        except (KeyError,TypeError,OSError,ValueError):
            raise ValueError('The prior release is unresolved or its verification is invalid. Preserve it and reconcile before preparing another release.')
    def _release_exists(self,state=None):
        pointer=storage.read(self.root,'build/current-release.json',{})
        if not pointer:return False
        if state and pointer.get('id')==state.get('previous_release'):
            return self.prior_verified()!=state['previous_release']
        return True
    def act(self,action,value=None,revision=None,operator=False):
        with shipping_lock(self.root):
            state=self.load()
            if revision!=state['revision']:raise ValueError('This screen is stale. Refresh before continuing.')
            if action=='new_release':
                if not operator or value is not True or state['stage']!='ready':raise ValueError('Finish and verify the current release before starting another.')
                previous=self.prior_verified()
                if not previous:raise ValueError('A verified predecessor is required.')
                storage.write(self.root,'build/ship/history/'+state['id']+'.json',state)
                receipt_path=storage.path_inside(self.root,'build/ship/release-receipt.json')
                if receipt_path.exists():
                    storage.write(self.root,'build/ship/history/'+state['id']+'-receipt.json',object_file(receipt_path))
                    receipt_path.unlink()
                old_revision=state['revision'];intent=state['intent'];attestations=state['attestations']
                state={'schema_version':VERSION,'id':str(uuid.uuid4()),'revision':old_revision,'stage':'inputs','project':digest(str(self.root)),
                    'intent':intent,'completed':{},'consents':{},'attestations':attestations,'pending':None,'previous_release':previous,
                    'events':[],'created_at':now(),'updated_at':now()}
                self.save(state);return self.view(state)
            if self._drift(state):return self.view(state)
            if action=='settings':
                if state.get('pending') or 'publish' in state['completed']:
                    raise ValueError('Preserve the saved release. Reconcile it before changing destinations.')
                previous=self.prior_verified()
                intent=validate_intent(value)
                if state['intent']!=intent or state['stage']=='inputs':
                    preserved=state['attestations'] if state['intent']==intent else {}
                    state.update(intent=intent,stage='prerequisites',completed={},consents={},attestations=preserved,pending=None,previous_release=previous)
            elif action in {'prepare','publish'}:
                expected='prepare' if action=='prepare' else 'approve'
                if state['stage']!=expected or value is not True:raise ValueError('Review this operation before explicitly approving it.')
                if not operator:raise ValueError('Only the trusted local operator may approve hosting or publication.')
                text=self.card({**state,'blocked':None})['text']
                state['consents'][action]={'message':text,'message_id':'ship-ui:'+str(uuid.uuid4()),
                    'binding':self.binding(state),'source':self.fingerprint(),'at':now(),
                    'allow_test_lead':action=='publish','allow_cleanup':action=='publish'}
                state['stage']='configure' if action=='prepare' else 'protect'
            elif action=='attest':
                required={'mfa':True,'privacy':True,'trusted_host':True}
                if state['intent']['sheets']:required['google_access']=True
                if state['stage']!='operator' or not operator or value!=required:
                    raise ValueError('The local owner must individually confirm all three account safeguards.')
                state['attestations']={key:{'value':True,'evidence':'owner-confirmed-not-api-verified','at':now(),
                    'target':digest(state['intent'])} for key in value}
                state['stage']='preflight'
            elif action=='login':
                if not operator or state['stage']!='cloudflare':raise ValueError('Cloudflare login is a local operator action.')
                state['pending']={'operation':'login','started_at':now()};self.save(state)
                result=self.adapter.call('login',self.payload(state));state['pending']=None
                if result.get('status')!='pass':state['blocked']='login';self.save(state);return self.view(state)
            elif action=='choose_account':
                if state['stage']!='cloudflare' or value not in state.get('choices',[]):raise ValueError('Choose an account returned by Cloudflare.')
                state['intent']['account_id']=value
            elif action=='database':
                if state.get('blocked')!='database_conflict' or value not in state.get('choices',[]):raise ValueError('Choose the database returned by the configured account.')
                # Reusing existing data is separately approved, never inferred from its name.
                if not operator:raise ValueError('Database reuse needs the local owner.')
                state['intent']['existing_database_id']=value
                state['consents'].pop('prepare',None);state['stage']='prepare'
            elif action=='sheets':
                if state['stage']!='sheets' or not operator:raise ValueError('Configure Sheets only in its selected step.')
                if not isinstance(value,dict) or set(value)-{'sheets_url','sheet_id'}:
                    raise ValueError('This step accepts only the Google deployment address and spreadsheet ID.')
                state['intent']=validate_intent({**state['intent'],**value})
            elif action=='open_handoff':
                if not operator or value not in {'owner','sheets'}:raise ValueError('Private handoffs can only be opened by the local owner.')
                if value=='owner' and 'configure' not in state['completed']:raise ValueError('Owner access has not been prepared.')
                if value=='sheets' and not state['intent'].get('sheets'):raise ValueError('Google Sheets is not enabled.')
                result=self.adapter.call('open_handoff',{**self.payload(state),'handoff':value})
                if result.get('status')!='pass':
                    raise ValueError('The private handoff could not be opened automatically. Use your trusted operator terminal; no secret was returned.')
                return self.view(state)
            elif action=='existing_confirm':
                if state.get('blocked')!='existing_access' or value is not True or not operator:raise ValueError('Review existing access before confirming it.')
                state['attestations']['existing_access']={'value':True,'evidence':'owner-confirmed-not-api-verified','at':now(),'target':digest(state['intent'])}
            elif action=='edge_confirm':
                if state.get('blocked')!='edge' or value is not True or not operator:raise ValueError('Confirm only the displayed rule after configuring it.')
                state['attestations']['edge']={'value':True,'evidence':'owner-confirmed-not-api-verified','at':now(),'target':digest(state['intent'])}
            elif action!='continue':raise ValueError('Unknown wizard action.')
            state.pop('blocked',None);state.pop('choices',None);self.save(state)
            return self._advance(state,operator)
    def advance(self,operator=False):
        with shipping_lock(self.root):
            state=self.load()
            if self._drift(state):return self.view(state)
            state.pop('blocked',None)
            return self._advance(state,operator)
    def validate_result(self,stage,result,state):
        e=result.get('evidence',{})
        tests={
            'prerequisites':lambda:e.get('copy_and_build')=='checked',
            'cloudflare':lambda:bool(re.fullmatch(r'[a-f0-9]{32}',result.get('account_id',''))),
            'configure':lambda:e.get('database_bound') is True and e.get('preview_aliases')=='disabled',
            'quality':lambda:e.get('handoff_gates')=='passed' and e.get('full_application_regressions')=='passed-no-skips' and e.get('worker_bundle')=='passed',
            'sheets':lambda:e.get('status')=='not-enabled' if not state['intent']['sheets'] else e.get('read_only_signed_probe')=='passed' and e.get('protocol')==2,
            'preflight':lambda:e.get('target',{}).get('worker')==state['intent']['site'],
            'protect':lambda:e.get('recovery_point')=='cloudflare-time-travel-bookmark-recorded',
            'publish':lambda:e.get('status')=='verified' and e.get('live_journey')=='verified' and e.get('url')=='https://'+state['intent']['domain'],
            'cleanup':lambda:e.get('synthetic_contact_erased') is True and e.get('managed_copies_erased') is True,
            'verify':lambda:e.get('live_proof')=='sealed-and-rechecked' and e.get('cleanup')=='complete' and e.get('url')=='https://'+state['intent']['domain']}
        if stage not in tests or not tests[stage]():raise ValueError('The operation returned incomplete evidence; publication was not marked ready.')

    def _advance(self,state,operator):
        for _ in range(len(STAGES)+2):
            stage=state['stage']
            if stage in {'inputs','prepare','operator','approve','ready'}:
                self.save(state);return self.view(state)
            if not operator:
                state['blocked']='operator_required';self.save(state);return self.view(state)
            if object_file(self.root/'funnel.json').get('development_fixture'):
                raise ValueError('The fictional demo cannot be published. Build a real project in a fresh directory first.')
            if stage=='sheets' and not state['intent']['sheets']:
                result={'status':'pass','evidence':{'status':'not-enabled'}}
            else:
                # Persist intent before doing work. A crash resumes this named operation.
                state['pending']={'operation':stage,'started_at':now()};self.save(state)
                result=self.adapter.call(stage,self.payload(state))
            if result.get('status')!='pass':
                if result.get('code') in {'quality','prerequisites'}:
                    storage.write(self.root,'build/ship/agent-task.json',{'schema_version':1,'kind':'local-repair',
                        'source':self.fingerprint(),'instruction':'Resume the existing community workflow to repair local prerequisites or quality evidence. Preserve human approvals. Do not fabricate gate results, use provider credentials or publish. Once checks pass, return to the operator wizard.',
                        'checks':['scripts/workflow.py check-copy .','scripts/workflow.py check-build .','scripts/check_gates.py check . --mode handoff'],
                        'provider_access':False,'secrets_access':False})
                state['blocked']=result.get('code') if result.get('code') in ACTION_TEXT else 'recovery'
                choices=result.get('choices',[])
                state['choices']=[v for v in choices if isinstance(v,str) and re.fullmatch(r'[a-f0-9-]{32,36}',v)][:50]
                state['pending']=None if result.get('status')=='action' else state.get('pending')
                self.save(state);return self.view(state)
            self.validate_result(stage,result,state)
            if stage=='cloudflare' and result.get('account_id'):
                if not re.fullmatch(r'[a-f0-9]{32}',result['account_id']):raise ValueError('Invalid Cloudflare account observation.')
                state['intent']['account_id']=result['account_id']
            # The reviewed bridge emits only a small summary, never a body/log/credential.
            evidence=result.get('evidence',{})
            if not isinstance(evidence,dict) or len(json.dumps(evidence))>16000:raise ValueError('Invalid operation evidence.')
            state['completed'][stage]={'at':now(),'evidence':evidence}
            if stage=='preflight':state['completed'][stage].update(source=self.fingerprint(),binding=self.binding(state))
            state['events'].append({'stage':stage,'status':'complete','at':now()});state['pending']=None
            state['stage']=STAGES[STAGES.index(stage)+1]
            if stage=='configure':
                state['consents'].pop('publish',None)
            if stage=='verify':
                state['receipt']={'schema_version':1,'status':'verified','run_id':state['id'],'verified_at':now(),
                    'source':self.fingerprint(),'intent':state['intent'],'automated':state['completed'],
                    'owner_confirmed':state['attestations'],'requirements':self.requirements(state),'scope':'This exact deployment and synthetic journey; not every future generated page.',
                    'native_pdf_preview':'Download verified; native preview remains browser-dependent.',
                    'recovery':'Time Travel bookmark recorded. No database restore was performed or automatically authorized.'}
                storage.write(self.root,'build/ship/release-receipt.json',state['receipt'])
            self.save(state)
        raise ValueError('Unexpected workflow cycle; preserve the saved state.')


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project',type=Path,default=Path.cwd())
    parser.add_argument('--node',default=os.environ.get('FUNNEL_NODE','node'))
    parser.add_argument('--operator',action='store_true',help='Run in a trusted human-operated terminal; not the coding agent.')
    parser.add_argument('--ui',action='store_true')
    parser.add_argument('--json',action='store_true',help='Read-only status; never access credentials or remote APIs.')
    parser.add_argument('--status',action='store_true')
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--repository',help=argparse.SUPPRESS)
    args=parser.parse_args(argv)
    try:
        root=safe_project(args.project);ship=Ship(root,node=args.node)
        if args.json or args.status:
            print(json.dumps(ship.status(),indent=2));return 0
        if not args.operator:
            print('Open the trusted local publishing wizard:\n  '+shlex.join([sys.executable,str(Path(__file__).resolve()),'--project',str(root),'--node',args.node,'--operator','--ui'])+'\nNo production password belongs in chat.');return 2
        import ship_ui
        return ship_ui.serve(ship,args.port)
    except (ValueError,OSError) as exc:
        print(json.dumps({'status':'blocked','message':str(exc)}));return 1
    except KeyboardInterrupt:
        print('Publishing paused. Reopen the same wizard to resume; no state was discarded.');return 0

if __name__=='__main__':raise SystemExit(main())
