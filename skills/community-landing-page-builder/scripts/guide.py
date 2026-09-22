#!/usr/bin/env python3
"""One user-facing guide over the existing evidence, approval and routing engines.

No cloud or model API calls. Answers are revisioned, replay-safe and projected to
canonical configuration. A connection acknowledgment never proves connectivity.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import uuid
from urllib.parse import urlsplit

import workflow
import workflow_progress
import workflow_storage as storage

from runtime_context import skill_root
SKILL = skill_root(__file__)
STATE = 'build/guide-state.json'
JOURNAL = '.secrets/guide-transaction.json'
STAGES = ['Start', 'Business', 'Conversion', 'Copy', 'Design', 'Preview', 'Connections', 'Publish', 'Complete']
SECRET = re.compile(r'(?:Bearer\s+\S+|\b(?:sk-|ghp_|gho_)[A-Za-z0-9_-]{16,}|(?:password|api[_ -]?key|access[_ -]?token)\s*[:=]\s*\S+)', re.I)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def config(root):
    value = storage.read(root, 'funnel.json')
    if value is None:
        raise ValueError('Start the guide before continuing')
    return value


def state(root):
    value = storage.read(root, STATE)
    if not value or value.get('schema_version') != 1:
        raise ValueError('Guide state is missing or unsupported. Use guide.py start; existing projects are not silently changed.')
    return value


def catalog():
    value = json.loads((SKILL / 'assets/guide/questions.json').read_text())
    if value.get('schema_version') != 1:
        raise ValueError('Unsupported question catalog')
    return {q['id']: q for q in value['questions']}


def get(value, field):
    for key in field.split('.'):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def put(value, field, answer):
    parts = field.split('.')
    for key in parts[:-1]:
        value = value.setdefault(key, {})
        if not isinstance(value, dict):
            raise ValueError('Canonical configuration field is not an object: ' + field)
    value[parts[-1]] = answer


def validate(question, value):
    if not isinstance(value, str) or len(value) > 4000 or '\x00' in value or SECRET.search(value):
        raise ValueError('Use business information only. Passwords and tokens belong in the provider/private connection, not guide answers.')
    value = value.strip()
    if question['required'] and not value:
        raise ValueError('This answer is required: ' + question['label'])
    kind = question['type']
    if kind == 'choice' and value not in {o['value'] for o in question['options']}:
        raise ValueError('Select a listed option; Help or Other is not implicit approval')
    if kind in {'url', 'destination'} and value:
        url = urlsplit(value)
        schemes = {'https', 'http'} if kind == 'url' else {'https', 'tel', 'mailto'}
        local_file = kind == 'destination' and value.startswith('/') and not value.startswith('//') and '..' not in value.split('/')
        if not local_file and (url.scheme not in schemes or url.username or url.password or (url.scheme in {'http','https'} and not url.hostname)):
            raise ValueError('Use a real public URL, call address, or local download path, without credentials')
    if kind == 'hostname' and value and not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}', value):
        raise ValueError('Use a lowercase hostname, not a URL or guessed DNS target')
    return value


def brief_fingerprint(value):
    return digest({q['field']: get(value, q['field']) for q in catalog().values()
                   if q['field'] not in {'requested_hosts.public','requested_hosts.crm'}})


def recover(root):
    """Replay a write-ahead record after interruption, but never overwrite new work."""
    pending = storage.read(root, JOURNAL)
    if not pending:
        return
    for name, item in pending['writes'].items():
        if name not in {'funnel.json', STATE, 'build/guide-business.json'}:
            raise ValueError('Invalid guide transaction destination')
        current = storage.read(root, name)
        if digest(current) not in {item['before'], digest(item['value'])}:
            raise ValueError('Guide transaction conflicts with newer work; preserve it and reconcile before resuming')
    for name, item in pending['writes'].items():
        storage.write(root, name, item['value'])
    storage.path_inside(root, JOURNAL).unlink()


def transaction(root, old_config, old_state, new_config, new_state):
    storage.write(root, JOURNAL, {'writes': {
        'funnel.json': {'before': digest(old_config), 'value': new_config},
        STATE: {'before': digest(old_state), 'value': new_state},
        'build/guide-business.json': {'before':digest(storage.read(root,'build/guide-business.json')), 'value':workflow.business_contract(new_config)}}})
    recover(root)


def start(root, mode=None, goal=None, website='', name=''):
    root = Path(root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    if not (root / 'funnel.json').exists():
        subprocess.run([sys.executable, str(SKILL/'scripts/scaffold_project.py'), str(root), '--profile', 'static_action', '--client', name, '--website', website], check=True, capture_output=True, text=True)
    with storage.lock(root):
        recover(root)
        old_config = config(root)
        old_state = storage.read(root, STATE)
        if old_state:
            if mode and mode != old_config['guided_workflow']['mode'] or goal and goal != old_config['guided_workflow']['goal']:
                raise ValueError('Resume preserves the selected mode and goal; use an explicit canonical configuration edit to change the build scope')
            return {'status': 'resumed', 'revision': old_state['revision'], 'next': next_action(root)}
        value = copy.deepcopy(old_config)
        selected = value.setdefault('guided_workflow', {'schema_version':1, 'mode':mode or 'guided', 'goal':goal or 'preview'})
        if selected.get('schema_version') != 1 or selected.get('mode') not in {'guided','automatic'} or selected.get('goal') not in {'preview','publish'}:
            raise ValueError('Invalid guided workflow configuration')
        selected.setdefault('copy_format', 'structured' if value.get('backend',{}).get('provider') != 'none' else 'markdown')
        value.setdefault('quality', {}).update(complete_workflow=True, contract_version=2, control_review=True)
        value.setdefault('approvals', {})['copy_before_design'] = selected['mode'] == 'guided'
        for field, answer in [('client.website',website),('client.name',name)]:
            if answer and not get(value, field):
                put(value, field, validate(next(q for q in catalog().values() if q['field']==field), answer))
        new_state = {'schema_version':1, 'project_id':uuid.uuid4().hex, 'revision':0, 'answers':{}, 'events':{}, 'questions':{}, 'confirmed_brief':None, 'discovery_applied':None, 'paused':False}
        transaction(root, old_config, old_state, value, new_state)
    return {'status':'started','revision':0,'next':next_action(root)}


def project_conversion(value):
    action = get(value, 'conversion.type')
    if not action:
        return
    lead = action == 'enquire'
    value['backend'] = {'provider':'cloudflare-d1' if lead else 'none','response_contract':'receipt-v1'}
    value['publish_target'] = 'cloudflare-workers' if lead else 'cloudflare-pages'
    value['guided_workflow']['profile'] = 'lead_inbox' if lead else 'static_action'
    value['guided_workflow']['copy_format'] = 'structured' if lead else 'markdown'
    if lead and not value.get('form_fields'):
        value['form_fields'] = [{'name':'name','type':'text','required':True},{'name':'email','type':'email','required':True}]
    if not lead:
        value['form_fields'] = []
        value['webhook_url'] = ''
    else:
        value['webhook_url'] = '/api/leads'
    if not value.get('cta'):
        value['cta'] = {'enquire':'Send an enquiry','book':'Book an appointment','call':'Call us','buy':'Shop now','download':'Download the guide'}[action]


def answer(root, event):
    """Apply one or several actual user answers atomically and reject stale screens."""
    root = Path(root).resolve()
    if event.get('actor') != 'user' or not event.get('message_id') or not event.get('event_id'):
        raise ValueError('Actual user event identity and message provenance are required')
    event_hash = digest(event)
    with storage.lock(root):
        recover(root)
        old_config, old_state = config(root), state(root)
        previous = old_state['events'].get(event['event_id'])
        if previous:
            if previous['sha256'] != event_hash:
                raise ValueError('An event ID cannot be replayed with different answers')
            return {'status':'already_applied','revision':previous['revision']}
        if event.get('expected_revision') != old_state['revision']:
            raise ValueError('This question screen is stale. Refresh; your existing answers are preserved.')
        rows = event.get('answers')
        if not isinstance(rows, list) or not rows or len(rows) > 30:
            raise ValueError('Supply the answered fields, not a bare yes or canceled prompt')
        value, record = copy.deepcopy(old_config), copy.deepcopy(old_state)
        questions = catalog()
        for row in rows:
            question = questions.get(row.get('id'))
            if not question:
                raise ValueError('Unsupported answer field')
            current_question = record['questions'].get(question['id'], question)
            if row.get('question_revision', digest(current_question)) != digest(current_question):
                raise ValueError('Question choices changed; answer the current question')
            if row.get('other') is True and question['type'] == 'text':
                result = validate(question, row.get('value'))
            else:
                result = validate(current_question, row.get('value'))
            put(value, question['field'], result)
            record['answers'][question['id']] = {'message_id':event['message_id'], 'value_sha256':digest(result), 'source':'user'}
            record['questions'].pop(question['id'], None)
        identity_changed = any(get(value,q) != get(old_config,q) for q in ('client.name','client.website'))
        if identity_changed:
            answered = {r['id'] for r in rows}
            for qid, evidence in list(record['answers'].items()):
                if evidence.get('source') == 'research' and qid not in answered:
                    put(value,catalog()[qid]['field'],'')
                    record['answers'].pop(qid)
            record['discovery_applied']=None
        project_conversion(value)
        record['revision'] += 1
        record['events'][event['event_id']] = {'sha256':event_hash,'revision':record['revision']}
        transaction(root, old_config, old_state, value, record)
        return {'status':'applied','revision':record['revision'],'next':'Continue with guide.py next; unrelated answers are retained.'}


def research_fingerprint(root):
    value=config(root)
    return digest({'name':get(value,'client.name'),'website':get(value,'client.website'),'files':get(value,'brief.files') or []})


def discover(root):
    """Apply source-anchored research suggestions without replacing known answers."""
    root = Path(root).resolve()
    path = storage.path_inside(root, 'build/discovery.json')
    discovery = json.loads(path.read_text())
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    if discovery.get('input_fingerprint') != research_fingerprint(root):
        raise ValueError('Research belongs to a different business input; research the current supplied information before applying it')
    with storage.lock(root):
        recover(root)
        old_config, old_state = config(root), state(root)
        if old_state['discovery_applied'] == source_hash:
            return {'status':'already_applied'}
        value, record = copy.deepcopy(old_config), copy.deepcopy(old_state)
        questions = catalog()
        for item in discovery.get('suggestions', []):
            question = questions.get(item.get('id'))
            if not question:
                raise ValueError('Research suggestion has an unsupported field')
            if get(value, question['field']):
                continue
            source = storage.path_inside(root, item['source_path'])
            if not source.is_file() or any(x in source.relative_to(root).parts for x in {'.secrets','.git','.wrangler','node_modules'}):
                raise ValueError('Use a captured nonsecret business source')
            if hashlib.sha256(source.read_bytes()).hexdigest() != item.get('source_sha256') or not item.get('excerpt') or item['excerpt'] not in source.read_text():
                raise ValueError('Research suggestion lacks current anchored source evidence')
            if item.get('ambiguous') is True:
                supplied = copy.deepcopy(question)
                supplied['reason'] = item.get('reason') or question['reason']
                if item.get('options') and question['type'] == 'text':
                    if not all(isinstance(o,dict) and isinstance(o.get('value'),str) and isinstance(o.get('label'),str) for o in item['options']):
                        raise ValueError('Discovered choices are malformed')
                    supplied.update(type='choice', options=item['options'])
                record['questions'][question['id']] = supplied
            else:
                proposed = validate(question, item.get('value'))
                put(value, question['field'], proposed)
                record['answers'][question['id']] = {'source':'research','source_path':item['source_path'],'source_sha256':item['source_sha256'],'value_sha256':digest(proposed)}
        project_conversion(value)
        record.update(discovery_applied=source_hash, revision=record['revision']+1)
        transaction(root, old_config, old_state, value, record)
    return {'status':'applied','revision':record['revision']}


def questions(root):
    value, record = config(root), state(root)
    result = []
    for default in catalog().values():
        question = record['questions'].get(default['id'], default)
        condition = question.get('when', {})
        when = get(value, condition.get('field',''))
        applicable = not condition or ('equals' in condition and when == condition['equals']) or ('not' in condition and when is not None and when != condition['not'])
        if applicable and question['required'] and (not get(value, question['field']) or question['id'] in record['questions']):
            result.append({**question,'question_revision':digest(question),'current_value':get(value,question['field']) or ''})
    return result


def next_action(root):
    root = Path(root).resolve()
    value, record = config(root), state(root)
    base = {'schema_version':1,'revision':record['revision'],'stages':STAGES,'mode':value['guided_workflow']['mode'],'goal':value['guided_workflow']['goal'],
            'summary': {q['field']:get(value,q['field']) for q in catalog().values() if get(value,q['field'])},
            'limits':['A goal is not publication authority. This guide records provenance; it cannot authenticate a claimed user event or force a closed chat session to run.']}
    def action(stage, kind, instruction, **extra):
        result = {**base,'stage':stage,'kind':kind,'instruction':instruction,**extra}
        if kind == 'approval':
            result['review_fingerprint'] = review_fingerprint(root, extra['approval_kind'])
        return result
    if storage.read(root, JOURNAL):
        return action('reconcile','local','Recover the pending atomic answer transaction before further work.',operation='recover')
    if record['paused']:
        return action('paused','wait','Your progress is saved. Resume to continue the same build.')
    if not get(value,'client.name') and not get(value,'client.website'):
        return action('business','question','Start with your business name or website.',questions=[{**catalog()['business_name'],'question_revision':digest(catalog()['business_name'])}, {**catalog()['website'],'question_revision':digest(catalog()['website'])}])
    discovery_path = root/'build/discovery.json'
    discovery_value = storage.read(root,'build/discovery.json') if discovery_path.is_file() else None
    if not discovery_value or discovery_value.get('input_fingerprint') != research_fingerprint(root):
        return action('research','work','Research the supplied website and facts. Save captured sources and build/discovery.json with evidence-anchored suggestions or ambiguities. Preserve user answers. Do not ask the owner to repeat discoverable facts. Set input_fingerprint to the supplied current research fingerprint.',role='research',research_input_fingerprint=research_fingerprint(root))
    if hashlib.sha256(discovery_path.read_bytes()).hexdigest() != record['discovery_applied']:
        return action('discovery','local','Apply verified research suggestions without overwriting existing answers.',operation='discover')
    missing = questions(root)
    if missing:
        return action('business','question','Confirm the details that change the page. Other or Help keeps the question open until a real answer is recorded.',questions=missing[:3])
    if value['guided_workflow']['mode']=='guided' and record['confirmed_brief'] != brief_fingerprint(value):
        return action('brief_review','approval','Confirm the business, offer and customer journey shown above. This is not publishing permission.',approval_kind='brief')
    if get(value,'backend.provider')=='cloudflare-d1' and not (root/'src/worker.js').is_file():
        return action('scaffold','local','Prepare the selected private lead inbox locally. No cloud resources will be created.',operation='scaffold')
    report = workflow_progress.inspect(root)
    stage = report['stage']
    extras = {'progress':report, 'blockers':report.get('blockers',[])}
    if value['guided_workflow']['goal']=='preview' and stage in {'publishing_setup','ready_to_publish','awaiting_publish_authorization','static_publish_setup','static_publish_ready','static_publish_authorization','ready_for_handoff'}:
        return action('local_final','complete','Present the improved local page and its tested scope. Nothing has been published.',**extras)
    if stage=='awaiting_copy_approval':
        return action(stage,'approval','Review the complete current copy, including form, confirmation and PDF promises. Approve it or request changes.',approval_kind='copy',**extras)
    if stage in {'awaiting_publish_authorization','static_publish_authorization'}:
        return action(stage,'approval','Review the exact page, destination and selected modules. Publication and a labeled live test are separate choices.',approval_kind='publish',**extras)
    if stage in {'ready_to_publish','static_publish_ready'}:
        return action(stage,'publish','Run only the existing guarded publisher using the current source-bound user authorization. Reconcile unknown outcomes before retry.',**extras)
    if stage in {'publishing_setup','static_publish_setup'}:
        return action(stage,'connection','Connect the intended hosting account using its own sign-in window. Verify the account, then guide the exact required setup and DNS records. Do not paste passwords here. A sign-in acknowledgment triggers rechecking, not completion.',**extras)
    if stage in {'publishing_outcome_unknown','image_generation_pending','release_recovery','static_publish_recovery','deployed_unverified'}:
        return action(stage,'reconcile','Inspect the existing process or provider operation before retrying. Preserve its request identity; do not create a replacement lead, image request or deployment blindly.',**extras)
    if stage in {'published_verified','static_published'}:
        return action(stage,'complete','Return the verified result and separate pending domain, conversion, owner-access and integration limits. Saved proof is not a fresh live check.',**extras)
    if stage=='ready_for_handoff' or (value['guided_workflow']['goal']=='preview' and stage in {'publishing_setup','ready_to_publish'}):
        return action('local_final','complete','Present the improved local page and its tested scope. Nothing has been published.',**extras)
    roles={'research':'research','copy_drafting':'copy','copy_review':'copy','control_comparison':'review','control_repair':'copy','control_retest':'review','local_verification':'debug'}
    return action(stage,'work',report['next_action']['instruction'],role=roles.get(stage,'frontend'),**extras)


def review_fingerprint(root, kind):
    if kind == 'brief':
        return brief_fingerprint(config(root))
    if kind == 'copy':
        return workflow.copy_state(root).get('fingerprint')
    return workflow.check_gates.source_snapshot(root)['source_fingerprint']


def approve(root, event):
    root = Path(root).resolve()
    if event.get('actor') != 'user' or not event.get('message_id') or not event.get('message'):
        raise ValueError('An approval requires the actual user instruction and message identity')
    if SECRET.search(event['message']):
        raise ValueError('Do not store credentials in approval text')
    current = next_action(root)
    if current['kind'] != 'approval' or event.get('kind') != current['approval_kind'] or event.get('expected_revision') != current['revision']:
        raise ValueError('Approval does not match the current pending review')
    if not event.get('review_fingerprint') or event['review_fingerprint'] != current.get('review_fingerprint'):
        raise ValueError('The reviewed content or destination changed. Show the current review before approving.')
    if event['kind']=='brief':
        with storage.lock(root):
            record = state(root)
            if record['revision'] != event['expected_revision']:
                raise ValueError('Brief changed while confirming')
            if review_fingerprint(root, 'brief') != event['review_fingerprint']:
                raise ValueError('The reviewed brief changed during approval')
            record.update(confirmed_brief=brief_fingerprint(config(root)), revision=record['revision']+1)
            record['brief_message_id']=event['message_id']
            storage.write(root,STATE,record)
        return {'status':'confirmed','revision':record['revision']}
    # There is no second copy or publishing approval flag in guide state.
    return workflow.record(root,event['kind'],event['message'],event['message_id'],allow_test_lead=event.get('allow_test_lead') is True, expected_fingerprint=event['review_fingerprint'])


def local(root, operation):
    root=Path(root).resolve()
    if operation=='discover':
        return discover(root)
    if operation=='recover':
        with storage.lock(root):
            recover(root)
        return {'status':'recovered'}
    if operation=='scaffold':
        current=next_action(root)
        if current.get('operation')!='scaffold':
            raise ValueError('Scaffolding is not the current selected action')
        subprocess.run([sys.executable,str(SKILL/'scripts/scaffold_project.py'),str(root),'--profile','lead_inbox','--client',get(config(root),'client.name')],check=True,capture_output=True,text=True)
        return {'status':'scaffolded','remote_changes':False}
    raise ValueError('Unknown local operation')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['start','next','status','answer','approve','discover','resume','pause','help'])
    p.add_argument('project',type=Path)
    p.add_argument('--mode',choices=['guided','automatic'])
    p.add_argument('--goal',choices=['preview','publish'])
    p.add_argument('--website',default='');p.add_argument('--name',default='')
    p.add_argument('--event',type=Path);p.add_argument('--question')
    a=p.parse_args()
    try:
        if a.command=='start':result=start(a.project,a.mode,a.goal,a.website,a.name)
        elif a.command in {'answer','approve'}:
            if not a.event:raise ValueError('--event must contain actual user input; canceled prompts are not answers')
            event=json.loads(a.event.read_text())
            result=answer(a.project,event) if a.command=='answer' else approve(a.project,event)
        elif a.command=='discover':result=discover(a.project)
        elif a.command in {'pause','resume'}:
            with storage.lock(a.project):
                recover(a.project);record=state(a.project);record['paused']=a.command=='pause';storage.write(a.project,STATE,record)
            result=next_action(a.project)
        elif a.command=='help':
            q=catalog().get(a.question)
            result={'explanation':q['reason'] if q else 'The guide keeps business choices separate from technical work, and never treats help or cancellation as approval.','next':next_action(a.project)}
        else:result=next_action(a.project)
        print(json.dumps(result,indent=2))
        return 0
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as error:
        print(json.dumps({'status':'blocked','error':str(error)}));return 1


if __name__=='__main__':
    sys.exit(main())
