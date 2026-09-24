"""Coordinator-written, portable native task evidence; not cryptographic provider authentication."""
from pathlib import Path
import hashlib
import json


def packet_hash(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def from_task(root, task, capabilities, freeze):
    import check_gates
    import workflow_storage as storage
    effective=task.get('effective',{})
    current=check_gates.source_snapshot(Path(root))['source_fingerprint']
    packet={'inputs':task.get('input_hashes',{}),'source_fingerprint':task.get('packet',{}).get('source_fingerprint',current),'role':task['role'],'phase':task['phase'],
            'profile':task.get('route',{}).get('agent'),'task_id':task['id']}
    outputs=dict(task.get('output_hashes',{}))
    # Read-only acceptance returns an artifact through the coordinator. A
    # report cannot hash a receipt which hashes that same report: link by task ID.
    for item in task.get('receipt',{}).get('review_artifacts',[]):
        import completion_contract as c
        c.evidence(root,item);outputs[item['path']]=item['sha256']
    value={'schema_version':1,'issuer':'native_routing.finish','task_id':task['id'],
           'role':task['role'],'phase':task['phase'],'profile':packet['profile'],
           'host':capabilities.get('provider'),'host_subagents':capabilities.get('native_subagents') is True,
           'execution':task.get('route',{}).get('execution'),'dispatch_id':effective.get('host_task_id'),
           'dispatched_at':task.get('started_at'),'completed_at':task.get('finished_at'),
           'parent_task_id':task.get('parent_task_id') or 'coordinator',
           'packet':packet,'packet_sha256':packet_hash(packet),'output_hashes':outputs,
           'status':'completed' if task.get('status')=='done' else task.get('status'),
           'source_fingerprint':packet['source_fingerprint'],
           'runtime_evidence':effective.get('evidence'),
           'scope':'Host-observed coordinator linkage; offline validation cannot independently authenticate a provider'}
    storage.write(root,'build/orchestration/tasks/'+task['id']+'.json',value)
    return value


def validate(root, provenance, report_path=None, expected_source=None, report_value=None):
    import completion_contract as c
    import check_gates
    import workflow_storage as storage
    if provenance.get('mode')!='independent':return []
    try:
        name=provenance.get('reviewer_task_id')
        import re
        if not isinstance(name,str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}',name):raise ValueError('Independent review needs its actual coordinator task ID')
        expected='build/orchestration/tasks/'+name+'.json'
        ref=provenance.get('execution_artifact')
        if ref:
            if ref.get('path')!=expected:raise ValueError('Reviewer receipt must come from the coordinator task namespace')
            path=c.evidence(root,ref)
        else:path=storage.path_inside(root,expected)
        value=c.read(path)
        if value.get('issuer')!='native_routing.finish' or value.get('schema_version')!=1 or value.get('task_id')!=name or value.get('status')!='completed':raise ValueError('Missing completed coordinator reviewer receipt')
        if value.get('role')!='review' or value.get('host') not in {'codex','claude'} or value.get('host_subagents') is not True or value.get('execution')!='native_subagent':raise ValueError('The host did not record real independent reviewer execution; use self_review')
        if name==provenance.get('builder_task_id') or not c.text(value.get('dispatch_id')) or not c.text(value.get('runtime_evidence')):raise ValueError('Reviewer task is not distinct or lacks an actual host execution reference')
        if check_gates.parsed_time(value['completed_at'])<check_gates.parsed_time(value['dispatched_at']):raise ValueError('Reviewer execution timestamps are invalid')
        packet=value.get('packet',{})
        if packet_hash(packet)!=value.get('packet_sha256'):raise ValueError('Reviewer input packet was changed')
        current=expected_source or check_gates.source_snapshot(Path(root))['source_fingerprint']
        if packet.get('source_fingerprint')!=current or value.get('source_fingerprint')!=current:raise ValueError('Reviewer receipt is stale for current product source')
        # Only the immutable initial control review may use its preserved old
        # source identity. It cannot authorize final current-source acceptance.
        historical=expected_source is not None and expected_source!=check_gates.source_snapshot(Path(root))['source_fingerprint']
        if not historical:
            for path,sha in packet.get('inputs',{}).items():
                if sha not in {None,'directory'}:c.evidence(root,{'path':path,'sha256':sha})
        outputs=value.get('output_hashes',{})
        if not outputs:raise ValueError('Reviewer receipt contains no retained review artifact')
        for path,sha in outputs.items():c.evidence(root,{'path':path,'sha256':sha})
        if report_path and report_path not in outputs:raise ValueError('Final review was not returned by the recorded reviewer')
        if report_value is not None and not any(c.read(storage.path_inside(root,path)) == report_value for path in outputs if path.endswith('.json')):
            raise ValueError('The validated review was not returned by the recorded reviewer')
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:return [str(error)]
    return []
