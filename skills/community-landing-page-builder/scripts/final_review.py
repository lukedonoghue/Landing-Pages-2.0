"""Post-control critical review of current evidence and rendered artifacts.

Evidence linkage is mechanical; semantic judgments must come from an actual
reviewer. A self-review is never upgraded to an independent execution.
"""
from pathlib import Path

DOMAINS=('claims','copy_repetition','review_intelligence','image_provenance','visitor_language',
         'accessibility','guide_value','conversion_intent','evidence_freshness')
QUESTIONS=('service','audience','next_step','reason_to_choose','proof','follow_up','uncertainty','guide_job')
STATES=('page','modal_initial','invalid','final_step','server_error','pending','uncertain','confirmed_thank_you','direct_thank_you')


def errors(root, report, snapshot):
    import completion_contract as c
    import check_gates
    root=Path(root).resolve();failures=[]
    try:
        if report.get('source_fingerprint')!=snapshot.get('source_fingerprint'):raise ValueError('Final review does not cover current source')
        provenance=report.get('reviewer_provenance',{})
        if provenance.get('mode') not in {'independent','self_review'}:raise ValueError('Declare actual independent or self_review mode')
        if not c.text(provenance.get('reviewer_task_id')) or not c.text(provenance.get('builder_task_id')):raise ValueError('Final review needs actual reviewer and builder identities')
        if provenance.get('mode')=='self_review' and provenance['reviewer_task_id']!=provenance['builder_task_id']:
            raise ValueError('Self-review must identify the same builder context')
        failures+=c.independent_review_errors(root,provenance,report_path='build/final-review.json')
        inspected={}
        for item in report.get('artifacts',[]):
            path=c.evidence(root,item);inspected[item['path']]=(item,path)
        producers=report.get('capture_reports',[])
        if not producers:raise ValueError('Final visual observations need source-bound executed capture reports')
        produced={}
        confirmed_paths={}
        config=c.read(root/'funnel.json')
        manifest=c.read(root/'build/gates.json') if (root/'build/gates.json').is_file() else {}
        for ref in producers:
            capture=c.read(c.evidence(root,ref))
            if capture.get('source_fingerprint')!=snapshot.get('source_fingerprint') or capture.get('status') not in c.PASS:
                raise ValueError('Final capture report is not current and executed')
            if capture.get('failures') or capture.get('execution',{}).get('exit_code')!=0:
                raise ValueError('Final capture was not a successful actual run')
            if not capture.get('executed_at') or not capture.get('tool'):
                raise ValueError('Final capture producer needs execution time and actual tool identity')
            for item in capture.get('artifacts',[]):
                if isinstance(item,dict) and item.get('path'):produced[item['path']]=item
            if capture.get('gate') in {'local_journey','crm'}:
                journey_gate='crm' if snapshot.get('mode')=='live' else 'local_journey'
                if capture['gate']!=journey_gate:raise ValueError('Receipt capture belongs to a different verification mode')
                registered=manifest.get('gates',{}).get(journey_gate,{})
                if registered.get('report')!=ref['path'] or registered.get('report_sha256')!=ref['sha256']:
                    raise ValueError('Confirmed state producer is not the registered local journey')
                problems=check_gates.validate_report(root,capture,snapshot,journey_gate)
                if problems:raise ValueError('Local journey is not valid: '+'; '.join(problems))
                if capture.get('fully_verified') is not True:raise ValueError('An incomplete journey cannot prove confirmed state')
                for item in capture.get('artifacts',[]):
                    if item.get('state')=='confirmed_thank_you' and item.get('receipt_id')==capture.get('receipt_id') and item.get('receipt_id'):
                        confirmed_paths[item['path']]=item['receipt_id']
        for path,(item,actual) in inspected.items():
            if item.get('type') in {'screenshot','rendered_text'}:
                recorded=produced.get(path,{})
                for key in ('sha256','state','viewport','engine','browser_version','url','source_fingerprint'):
                    if item.get(key)!=recorded.get(key) or key in {'sha256','state','source_fingerprint'} and not item.get(key):
                        raise ValueError('Final artifact metadata differs from its executed capture: '+path)
                if item.get('type')=='screenshot':
                    import image_workflow
                    size=image_workflow.image_info(actual.read_bytes())
                    viewport=item.get('viewport',{});ratio=item.get('device_pixel_ratio')
                    if type(ratio) not in {int,float} or not 0.5<=ratio<=4 or size['width']!=round(viewport.get('width',0)*ratio):
                        raise ValueError('Final screenshot bytes do not match actual viewport metadata')
                if item.get('state')=='confirmed_thank_you':
                    # The capture is emitted only by the real receipt-correlated
                    # journey, never by the read-only error-state sampler.
                    if path not in confirmed_paths or item.get('receipt_id')!=confirmed_paths[path]:
                        raise ValueError('Confirmed thank-you needs the actual correlated local-journey receipt')
            elif item.get('type')=='pdf_text':
                import guide_quality
                built=c.read(root/'build/guide-build.json')
                guide_quality.inspect_build(root)
                if built.get('text_output')!=path or built.get('artifacts',{}).get(path)!=item.get('sha256'):
                    raise ValueError('Cold-reader PDF text differs from the current generated guide')
        control=report.get('control_review')
        path=c.evidence(root,control)
        retained=c.read(path)
        registered=manifest.get('gates',{}).get('control_review',{})
        if registered.get('report')!=control['path'] or registered.get('report_sha256')!=control['sha256']:
            raise ValueError('Final review must reference the registered current control comparison')
        problems=check_gates.validate_report(root,retained,snapshot,'control_review')
        if problems:raise ValueError('Control comparison is not accepted: '+'; '.join(problems))
        completed=retained.get('executed_at') or retained.get('reviewed_at') or retained.get('completed_at')
        if not completed:raise ValueError('Final review must follow a dated control comparison')
        if check_gates.parsed_time(report.get('executed_at',''))<check_gates.parsed_time(completed):raise ValueError('Final review predates control comparison/repair')
        def observation(row,label,rendered=False):
            if not isinstance(row,dict) or row.get('status')!='pass' or not c.text(row.get('observations',row.get('answer'))):
                raise ValueError('Actual final-review observation is missing: '+label)
            refs=row.get('evidence',[])
            if not isinstance(refs,list) or not refs:raise ValueError('Final-review evidence is missing: '+label)
            for ref in refs:
                actual=c.evidence(root,ref)
                if ref['path'] not in inspected:raise ValueError('Evidence was not in the inspected packet: '+ref['path'])
                if rendered:
                    kind=inspected[ref['path']][0].get('type')
                    if kind not in {'rendered_text','pdf_text'}:raise ValueError('Cold-reader answers must cite extracted rendered text, not source drafts')
                    quote=ref.get('excerpt')
                    if not c.text(quote) or quote not in actual.read_text():raise ValueError('Cold-reader excerpt is missing from actual rendered content')
        for key in DOMAINS:observation(report.get('domains',{}).get(key),'domain '+key)
        config=c.read(root/'funnel.json');guide=config.get('catalogue',{}).get('enabled',True)
        for key in QUESTIONS:
            row=report.get('cold_reader',{}).get(key)
            if key=='guide_job' and not guide:
                if not isinstance(row,dict) or row.get('status')!='not_applicable' or not c.text(row.get('reason')):raise ValueError('No-guide cold-reader state needs an explicit justified disposition')
                continue
            observation(row,'cold reader '+key,True)
        required_states={'page'}
        form=bool(config.get('form_fields')) and config.get('conversion',{}).get('type','enquire')=='enquire'
        if form:required_states.update(STATES)
        captures=[item for item,_ in inspected.values() if item.get('type')=='screenshot']
        for group,test in (('mobile',lambda w:w<600),('desktop',lambda w:w>=1024)):
            seen={item.get('state') for item in captures if test(item.get('viewport',{}).get('width',0))}
            if not required_states.issubset(seen):raise ValueError('Final review is missing '+group+' visual states: '+', '.join(sorted(required_states-seen)))
        for width,height in ((768,1024),(1024,800),(1280,600)):
            if not any(item.get('viewport')=={'width':width,'height':height} for item in captures):raise ValueError('Final visual review needs tablet/laptop/short-height spot evidence')
        if guide:
            built=c.read(root/'build/guide-build.json')
            pages=built.get('pages',built.get('rendered_pages',[]))
            required={p['path'] if isinstance(p,dict) else p for p in pages if isinstance(p,(dict,str))}
            seen={item.get('path') for item in report.get('guide_pages',[])}
            if not required or required!=seen:raise ValueError('Inspect every rendered PDF page, not just its cover')
            for row in report['guide_pages']:observation(row,'PDF page '+row['path'])
        findings=report.get('findings')
        if not isinstance(findings,list):raise ValueError('Record findings explicitly, including [] when none were observed')
        ids=set()
        for finding in findings:
            if not c.text(finding.get('id')) or finding['id'] in ids:raise ValueError('Final finding IDs must be unique')
            ids.add(finding['id'])
            if finding.get('severity') not in {'P0','P1','P2','design_risk','evidence_gap'}:raise ValueError('Final finding severity is missing')
            c.evidence(root,finding.get('evidence'))
            if finding.get('disposition')=='fixed':
                c.evidence(root,finding.get('fix'));c.evidence(root,finding.get('retest'))
            elif finding.get('disposition')=='accepted_limit' and finding.get('severity')=='P2':
                failures+=c.warning_errors(root,{'warnings':[finding['id']],'warning_dispositions':[{**finding,'warning':finding['id']} ]})
            else:raise ValueError('Unresolved severe final finding: '+finding['id'])
        if report.get('unresolved_findings')!=[] or report.get('decision')!='pass':raise ValueError('Final critical review has unresolved findings')
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:failures.append('Final review: '+str(error))
    return failures
