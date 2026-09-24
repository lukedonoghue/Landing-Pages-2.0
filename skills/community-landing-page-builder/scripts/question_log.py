"""Evidence-backed necessary owner questions; pure planning and explicit presentation."""
from pathlib import Path

MATERIAL={'identity','offer','claim','primary_action','form_fields','destination','business_follow_up'}


def qualify(root, questions):
    import completion_contract as c
    import guide
    root=Path(root).resolve();config=guide.config(root)
    if config.get('quality',{}).get('contract_version',0)<4:return questions,[]
    identity=not (config.get('client',{}).get('website') or config.get('client',{}).get('name'))
    discovery=c.read(root/'build/discovery.json') if (root/'build/discovery.json').is_file() else {}
    unresolved=discovery.get('unresolved_facts',[]);accepted=[];errors=[]
    for question in questions:
        try:
            if identity and question['id'] in {'website','business_name'}:
                accepted.append({**question,'necessity':{'reason':'Business identity is required before research can begin','category':'identity','evidence':[]}});continue
            rows=[r for r in unresolved if isinstance(r,dict) and r.get('id')==question['id']]
            if len(rows)!=1:raise ValueError('Research the unresolved fact before asking: '+question['id'])
            row=rows[0]
            if row.get('category') not in MATERIAL or not c.text(row.get('reason')) or not c.text(row.get('material_effect')) or not row.get('evidence'):
                raise ValueError('Question needs an unresolved material decision and prior source evidence: '+question['id'])
            for ref in row['evidence']:c.evidence(root,ref)
            if guide.get(config,question['field']) and question['id'] not in guide.state(root).get('questions',{}):
                raise ValueError('Do not ask an already answered question: '+question['id'])
            accepted.append({**question,'necessity':row})
        except (OSError,ValueError,TypeError,KeyError,AttributeError) as error:errors.append(str(error))
    return accepted,errors


def presented(root, action):
    import guide
    import workflow_storage as storage
    import check_gates
    if action.get('kind')!='question':return action
    questions,errors=qualify(root,action.get('questions',[]))
    if errors:return {**action,'kind':'work','stage':'research','role':'research','questions':[],
                      'instruction':'Complete evidence-backed unresolved_facts in build/discovery.json before asking the owner.','blockers':errors}
    with storage.lock(root):
        record=storage.read(root,'build/question-log.json',{'schema_version':1,'questions':[]})
        for question in questions:
            event_id=guide.digest({'question':question['id'],'revision':action.get('revision')})
            if not any(row.get('event_id')==event_id for row in record['questions']):
                record['questions'].append({'event_id':event_id,'id':question['id'],'asked_at':check_gates.now(),
                    'revision':action.get('revision'),'necessity':question.get('necessity'),
                    'answer_record':'build/guide-state.json; no answer text is duplicated here'})
        storage.write(root,'build/question-log.json',record)
    return {**action,'questions':questions}


def validate(root):
    import workflow_storage as storage
    import completion_contract as c
    import check_gates
    record=storage.read(root,'build/question-log.json',{'schema_version':1,'questions':[]})
    errors=[]
    if record.get('schema_version')!=1 or not isinstance(record.get('questions'),list):return ['Unsupported owner question history']
    seen=set()
    for row in record['questions']:
        try:
            if not row.get('event_id') or row['event_id'] in seen:raise ValueError('Question presentation event was duplicated')
            seen.add(row['event_id']);check_gates.parsed_time(row['asked_at'])
            reason=row.get('necessity',{})
            if reason.get('category') not in MATERIAL or not c.text(reason.get('reason')):raise ValueError('Question was asked without a necessary material reason')
            if reason['category']!='identity' and (not reason.get('evidence') or not c.text(reason.get('material_effect'))):raise ValueError('Non-identity question lacks prior researched evidence')
            for ref in reason.get('evidence',[]):c.evidence(root,ref)
        except (OSError,ValueError,TypeError,KeyError,AttributeError) as error:errors.append('Question history: '+str(error))
    return errors
