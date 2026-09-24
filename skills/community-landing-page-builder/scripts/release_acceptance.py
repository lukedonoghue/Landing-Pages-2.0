#!/usr/bin/env python3
"""One release-class interface over existing gates, workflow, owner and exporter.

Inspection is read-only. --write invokes the existing deterministic summary
writer. --require is a machine assertion, not a successful-inspector exit code.
"""
from pathlib import Path
import argparse
import json
import sqlite3
from contextlib import closing
import sys

CLASSES=('blocked','local_preview','local_final','publish_ready','live_verified')
PASS={'pass','pass_with_warnings','pass_with_accepted_limits'}
READY_STAGES={'ready_for_handoff','publishing_setup','ready_to_publish','awaiting_publish_authorization',
              'static_publish_setup','static_publish_ready','static_publish_authorization',
              'published_verified','live_verified','static_published'}


def workflow_errors(root):
    import workflow_progress
    errors=[]
    try:
        progress=workflow_progress.inspect(root)
        if progress.get('stage') not in READY_STAGES:
            errors.append('Workflow is '+str(progress.get('stage'))+' / '+str(progress.get('status'))+'; '+str(progress.get('next_action',{})))
        db=Path(root)/'build/orchestration/state.sqlite3'
        if db.is_file():
            if db.is_symlink():raise ValueError('Orchestration state must not be a symlink')
            with closing(sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)) as connection:
                row=connection.execute('SELECT value FROM state WHERE id=1').fetchone()
            state=json.loads(row[0]) if row else {}
            active=[name for name,t in state.get('tasks',{}).items() if t.get('status')=='running']
            if active:errors.append('Work is still running: '+', '.join(active))
        return errors,progress
    except (OSError,ValueError,TypeError,KeyError,sqlite3.Error) as error:return ['Workflow: '+str(error)],{}


def publication_state(root, source, mode, config):
    """Read existing trusted operator observations; never contact an account."""
    import workflow_storage as storage
    import check_gates
    failures=[]
    try:
        if config.get('backend',{}).get('provider')=='none':
            import static_publish, workflow
            selected=static_publish.target(root)
            if mode=='live':
                record=storage.read(root,static_publish.STATE,{})
                actual=static_publish.assets(root)
                observed=record.get('verification',{})
                if record.get('status')!='verified' or record.get('source_fingerprint')!=source or record.get('target')!=selected or record.get('assets')!=actual:
                    raise ValueError('The static deployment is not verified for current source and destination')
                expected={name for name in actual if name not in {'_headers','_redirects'}}
                if set(observed.get('public_asset_hashes_verified',[]))!=expected or observed.get('requested_host_verified') is not True:
                    raise ValueError('Static deployment lacks complete retained byte/host observations')
                check_gates.parsed_time(observed['checked_at'])
                return {'status':'pass','scope':observed.get('conversion_scope'), 'verified_at':observed['checked_at']}
            record=storage.read(root,'build/static-preflight.json',{})
            if record.get('source_fingerprint')!=source or record.get('target')!=selected or record.get('issuer')!='static_publish.provider_preflight':
                raise ValueError('Actual destination preflight is missing or stale')
            if record.get('account_verified') is not True or record.get('project_verified') is not True:
                raise ValueError('Actual account/project preflight has not passed')
            check_gates.parsed_time(record['checked_at'])
            approval=workflow.check_publish_approval(root)
            if approval.get('status') not in PASS:raise ValueError('Current explicit publication authority is missing')
        else:
            import ship
            operator=ship.Ship(root);state=operator.load()
            if mode=='live':
                receipt=state.get('receipt',{})
                if state.get('stage')!='ready' or state.get('pending') or state.get('blocked') or receipt.get('source')!=source or receipt.get('status')!='verified':
                    raise ValueError('The operator has not completed current live verification and cleanup')
                return {'status':'pass','scope':receipt.get('scope'),'verified_at':receipt.get('verified_at')}
            record=state.get('completed',{}).get('preflight',{})
            if state.get('pending') or state.get('blocked') or state.get('stage') not in {'approve','protect','publish'}:
                raise ValueError('The operator is not ready for this publish')
            if record.get('source')!=source or record.get('binding')!=operator.binding(state):
                raise ValueError('Destination preflight is missing or belongs to an earlier source/intent')
            if record.get('evidence',{}).get('target',{}).get('worker')!=state.get('intent',{}).get('site'):
                raise ValueError('Preflight destination differs from the selected Worker')
            if state.get('consents',{}).get('publish',{}).get('binding')!=operator.binding(state):
                raise ValueError('The current publish has not been explicitly authorized')
        return {'status':'pass','scope':'Current retained preflight and explicit publication authorization; no new provider operation'}
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:
        return {'status':'blocked','failures':['Publication: '+str(error)]}


def evaluate(root, mode='handoff'):
    import check_gates
    import completion_contract as c
    import workflow_storage as storage
    import validate_owner_handoff
    root=Path(root).resolve();blockers=[];rows={}
    try:
        config=storage.read(root,'funnel.json',{})
        gate_mode='handoff' if mode=='publish' or mode=='live' and config.get('backend',{}).get('provider')=='none' else mode
        quality=check_gates.check(root,gate_mode,root/'build/gates.json')
        source=quality['source_fingerprint'];blockers+=quality.get('failures',[])
        rows.update(quality.get('gates',{}))
        wf_errors,progress=workflow_errors(root)
        rows['workflow']={'status':'blocked' if wf_errors else 'pass','stage':progress.get('stage'),'failures':wf_errors}
        blockers+=wf_errors
        owner=storage.read(root,'build/owner-handoff.json',{})
        owner_errors=validate_owner_handoff.validate(owner,project=root)
        if owner.get('source_fingerprint')!=source:owner_errors.append('Owner handoff is missing or stale for current source')
        core=storage.read(root,'build/release-inputs.json',{})
        if core.get('source_fingerprint')!=source or core.get('quality_status') not in PASS:owner_errors.append('Owner handoff has no current accepted release inputs')
        try:
            if owner.get('release_status_path')!='build/release-inputs.json':raise ValueError('Owner handoff must reference the immutable release inputs')
            c.evidence(root,{'path':owner['release_status_path'],'sha256':owner.get('release_status_sha256')})
        except (OSError,ValueError,KeyError,TypeError) as error:owner_errors.append(str(error))
        rows['owner_handoff']={'status':'blocked' if owner_errors else 'pass','failures':owner_errors}
        blockers+=owner_errors
        archive_required=mode!='live' or config.get('delivery',{}).get('zip') is True
        exported=c.export_status(root,source) if archive_required else {'status':'not_applicable','reason':'This live-verification claim does not deliver a ZIP. A separate archive requires handoff verification.','failures':[]}
        rows['portable_export']={k:v for k,v in exported.items() if k!='receipt'}
        blockers+=exported.get('failures',[])
        if mode in {'publish','live'}:
            publication=publication_state(root,source,mode,config);rows['publication']=publication;blockers+=publication.get('failures',[])
        release_class='local_preview' if any((root/p).is_file() for p in ('public/index.html','index.html')) else 'blocked'
        if config.get('development_fixture'):
            blockers.append('Development fixtures are previews, never accepted client releases')
        elif not blockers and quality.get('status') in PASS:
            release_class={'live':'live_verified','publish':'publish_ready','handoff':'local_final'}[mode]
        return {'schema_version':1,'release_class':release_class,'source_fingerprint':source,
                'evaluated_at':check_gates.now(),'mandatory':rows,'warnings':quality.get('warnings',[]),
                'blockers':list(dict.fromkeys(blockers)),
                'next_action':progress.get('next_action'),
                'scope':'Current local evidence' if mode!='live' else 'Current retained deployment and live-path evidence; not continuous monitoring',
                'publication_authorized':mode=='publish' and release_class=='publish_ready',
                'limitations':['Offline hashes establish consistency, not provider authenticity or semantic truth.',
                               'Publication authorization is separate from release quality.']}
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:
        return {'schema_version':1,'release_class':'blocked','mandatory':rows,'blockers':[str(error)],'warnings':[]}


def satisfies(value, required):
    # Do not equate a local final with a prepared external destination.
    return value.get('release_class')==required or required=='local_final' and value.get('release_class')=='live_verified'


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('project',type=Path)
    p.add_argument('--require',choices=CLASSES);p.add_argument('--mode',choices=['handoff','publish','live'],default='handoff');p.add_argument('--write',action='store_true')
    a=p.parse_args(argv)
    if a.write:
        import completion_contract as c,check_gates
        mode='handoff' if a.mode=='publish' or a.mode=='live' and c.read(a.project/'funnel.json').get('backend',{}).get('provider')=='none' else a.mode
        c.write_summary(a.project,check_gates.check(a.project,mode,a.project/'build/gates.json'), requested_mode=a.mode)
    result=evaluate(a.project,a.mode);print(json.dumps(result,indent=2))
    return 0 if a.require is None or satisfies(result,a.require) else 1
if __name__=='__main__':sys.exit(main())
