"""Blueprint failure-class regressions. Synthetic fixtures are NOT client evidence.

Mocks isolate the acceptance inputs only where named. Source/file hashes,
coordinator receipt serialization, dependency comparison and command exit
semantics are exercised directly; no provider or independent agent is invoked.
"""
from pathlib import Path
from contextlib import ExitStack
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

S = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(S))
import check_gates as gates
import completion_contract as completion
import copy_contract
import copy_acceptance
import copy_quality
import dependency_state
import execution_receipts
import final_review
import guide
import question_log
import release_acceptance
import research_contract
import validate_required_records
import workflow
import workflow_storage as storage


class BlueprintTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.put('public/index.html', '<h1>Synthetic service</h1>')
        self.write('funnel.json', {'backend': {'provider': 'none'},
                                  'catalogue': {'enabled': False}, 'quality': {'contract_version': 4}})
        self.source = self.put('research/source.txt', 'Synthetic source evidence: inspect the fixture before choosing the service.')

    def put(self, name, text):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        return {'path': name, 'sha256': gates.file_hash(p)}

    def write(self, name, data):
        return self.put(name, json.dumps(data, sort_keys=True))

    def read(self, name):
        return json.loads((self.root / name).read_text())

    def research(self):
        record = {'sections': {k: {'status': 'pass', 'reason': 'Synthetic resolved research dimension',
                                  'evidence': [self.source]} for k in research_contract.SECTIONS},
                  'brand_decisions': {k: {'observed': 'Synthetic observed choice', 'selected': 'Synthetic observed choice',
                                           'evidence': self.source} for k in ('logo','colors','heading_font','body_font')},
                  'positioning_angles': [], 'first_party_image_attempts': []}
        self.write('build/research-acceptance.json', record)
        self.write('research/reviews/review-manifest.json', {'research_status': 'unavailable', 'reason': 'Synthetic fixture has no customers',
            'reviews': [], 'discovery': [{'source': 'Synthetic source', 'identity_signals': 'Synthetic identity only',
                'outcome': 'No customer reviews in this fixture', 'searched_at': gates.now(), 'evidence': self.source}]})
        self.write('build/brand.json', {'kind': 'rendered_brand_measurement', 'measurements': [{'fixture': True}]})
        return record

    def copy_review(self, text='Inspect the fixture before choosing the service.'):
        cfg = self.read('funnel.json')
        cfg.update(guided_workflow={'copy_format':'markdown'}, business_follow_up_promise='Unknown; confirm with the business',
                   follow_up_promise='Unknown; confirm with the business', preview_disclosure='Preview only.',
                   local_test_behavior='Synthetic local-only persistence test')
        self.write('funnel.json', cfg)
        self.put('build/page-copy.md', text)
        measured = copy_quality.lint(self.root)
        review = {'copy': measured['copy'], 'reviewer':'Synthetic self-review fixture', 'status':'pass',
                  'findings':[], 'review_theme_use':[], 'checks': {k: {'status':'pass', 'observations':'Synthetic reviewed observation',
                                                                     'evidence':self.source} for k in copy_quality.SEMANTIC_DOMAINS}}
        self.write('build/copy-quality-review.json', review)
        self.write('build/claim-review.json', {'copy':measured['copy'], 'coverage':{'status':'pass','observations':'Synthetic copy inspected'},
                                              'claims':[], 'no_material_claims_reason':'Only an instruction about this synthetic fixture'})
        self.write('build/review-insights.json', {'themes':{}})
        return review

    def conversion(self):
        fields = [{'name':'email','type':'email','required':True}]
        cfg = self.read('funnel.json')
        cfg.update(conversion={'type':'enquire'}, form_fields=fields, offer='Request information')
        self.write('funnel.json', cfg)
        record = {'source_conversion_type':'enquire','selected_conversion_type':'enquire',
                  'source_offer':'Request information','selected_offer':'Request information',
                  'source_fields':fields,'selected_fields':fields,'source_success_behavior':'Unknown',
                  'secondary_action':'No secondary action in fixture','local_implementation':'Synthetic local form',
                  'production_wiring':'Not configured','evidence':[self.source], 'allowed_changes':[]}
        self.write('build/conversion-contract.json', record)
        self.put('public/index.html','<form><input name="email" type="email" required></form>')
        return record

    def receipt(self):
        report = self.write('build/final-review.json', {'synthetic':'A unit-test review; no independent agent ran'})
        task = {'id':'reviewer','role':'review','phase':'acceptance','status':'done',
                'started_at':'2026-01-01T00:00:00Z','finished_at':'2026-01-01T00:00:01Z',
                'route':{'agent':'lp-critical','execution':'native_subagent'},
                'packet':{'source_fingerprint':gates.source_snapshot(self.root)['source_fingerprint']},
                'input_hashes':{self.source['path']:self.source['sha256']},
                'output_hashes':{report['path']:report['sha256']},
                'effective':{'host_task_id':'synthetic-host-id','evidence':'Synthetic protocol observation, not an actual provider run'}}
        execution_receipts.from_task(self.root, task, {'provider':'codex','native_subagents':True}, None)
        return {'mode':'independent','reviewer_task_id':'reviewer','builder_task_id':'builder'}

    def test_rt01_static_file_does_not_grant_release(self):
        value = release_acceptance.evaluate(self.root)
        self.assertEqual(value['release_class'], 'local_preview')
        self.assertTrue(value['blockers'])

    def test_rt02_forged_green_caller_is_recomputed(self):
        value = completion.write_summary(self.root, {'status':'pass','mode':'handoff',
                    'source_fingerprint':gates.source_snapshot(self.root)['source_fingerprint']})
        self.assertEqual(value['release_class'], 'local_preview')
        self.assertEqual(value['status'], 'blocked')

    def test_rt03_empty_qa_table_cannot_pass(self):
        self.put('docs/QA-REPORT.md', '# QA\n\n| Check | Status |\n| --- | --- |\n')
        self.assertTrue(any('no actual result rows' in e for e in validate_required_records.validate(self.root)))

    def test_rt03_generated_qa_rows_are_not_misclassified_empty(self):
        self.put('docs/QA-REPORT.md', '# QA\n\n| Check | Status |\n| --- | --- |\n| Browser | blocked |\n')
        self.assertFalse(any('no actual result rows' in e for e in validate_required_records.validate(self.root)))

    def test_rt03_template_marker_remains_blocking(self):
        self.put('docs/RESEARCH-BRIEF.md', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        self.assertTrue(any('template' in e.lower() for e in validate_required_records.validate(self.root)))

    def test_rt04_research_requires_explicit_manifest(self):
        self.research(); (self.root/'research/reviews/review-manifest.json').unlink()
        self.assertTrue(any('Review research:' in e for e in research_contract.inspect(self.root)))

    def test_rt04_unavailable_with_discovery_is_supported(self):
        self.research()
        self.assertEqual(research_contract.inspect(self.root), [])

    def test_rt04_label_without_discovery_does_not_pass(self):
        self.research(); m=self.read('research/reviews/review-manifest.json');m['discovery']=[]
        self.write('research/reviews/review-manifest.json',m)
        self.assertTrue(research_contract.inspect(self.root))

    def test_f12_each_research_dimension_is_required(self):
        original=self.research()
        for name in research_contract.SECTIONS:
            with self.subTest(dimension=name):
                record=copy.deepcopy(original);record['sections'].pop(name)
                self.write('build/research-acceptance.json',record)
                self.assertTrue(any(name in e for e in research_contract.inspect(self.root)))

    def test_f12_not_applicable_needs_evidence(self):
        record=self.research();record['sections']['service_area']={'status':'not_applicable','reason':'Remote service','evidence':[]}
        self.write('build/research-acceptance.json',record)
        self.assertTrue(any('service_area' in e for e in research_contract.inspect(self.root)))

    def test_f24_changed_brand_choice_requires_reason(self):
        record=self.research();record['brand_decisions']['heading_font']['selected']='Different font'
        self.write('build/research-acceptance.json',record)
        self.assertTrue(any('fallback' in e for e in research_contract.inspect(self.root)))

    def test_f20_acquisition_uses_real_producer_field_names_and_hash(self):
        record=self.research()
        from PIL import Image
        image=self.root/'research/synthetic.png';Image.new('RGB',(1200,800),'white').save(image)
        image_ref={'path':'research/synthetic.png','sha256':gates.file_hash(image)}
        asset={'id':'first','source':image_ref,'provenance':{'acquisition':{
            'status':'acquired','sha256':image_ref['sha256'],'width':1200,'height':800,
            'content_type':'image/png','retrieved_at':gates.now()}}}
        self.write('image-plan.json',{'assets':[asset]})
        record['first_party_image_attempts']=[{'status':'acquired','asset_id':'first'}]
        self.write('build/research-acceptance.json',record)
        self.assertEqual(research_contract.inspect(self.root),[])
        asset['provenance']['acquisition']['sha256']='0'*64
        self.write('image-plan.json',{'assets':[asset]})
        self.assertTrue(any('acquisition' in e.lower() for e in research_contract.inspect(self.root)))

    def test_rt08_coordinator_linked_protocol_receipt_passes(self):
        provenance=self.receipt()
        self.assertEqual(execution_receipts.validate(self.root,provenance,'build/final-review.json'),[])

    def test_rt08_no_subagent_capability_never_independent(self):
        provenance=self.receipt();row=self.read('build/orchestration/tasks/reviewer.json');row['host_subagents']=False
        self.write('build/orchestration/tasks/reviewer.json',row)
        self.assertTrue(execution_receipts.validate(self.root,provenance))

    def test_rt08_wrong_returned_artifact_blocks_independence(self):
        provenance=self.receipt()
        self.assertTrue(execution_receipts.validate(self.root,provenance,'build/another-review.json'))

    def test_rt08_altered_packet_cannot_pass(self):
        provenance=self.receipt();row=self.read('build/orchestration/tasks/reviewer.json');row['packet']['role']='copy'
        self.write('build/orchestration/tasks/reviewer.json',row)
        self.assertTrue(execution_receipts.validate(self.root,provenance))

    def test_rt08_changed_output_invalidates_receipt(self):
        provenance=self.receipt();self.write('build/final-review.json',{'changed':True})
        self.assertTrue(execution_receipts.validate(self.root,provenance))

    def test_rt08_fake_external_note_does_not_prove_execution(self):
        ref=self.write('build/note.json',{'status':'completed','task_id':'reviewer','dispatch_id':'invented'})
        self.assertTrue(execution_receipts.validate(self.root,{'mode':'independent','reviewer_task_id':'reviewer',
                                                              'builder_task_id':'builder','execution_artifact':ref}))

    def test_rt08_self_review_does_not_need_fake_receipt(self):
        self.assertEqual(execution_receipts.validate(self.root,{'mode':'self_review'}),[])

    def test_rt09_installed_runtime_changes_only_tool_identity(self):
        before=gates.source_snapshot(self.root);old=dependency_state.runtime_identity(self.root)
        self.put('.community-builder/scripts/tool.py','print("synthetic tool")')
        self.assertEqual(gates.source_snapshot(self.root),before)
        self.assertNotEqual(dependency_state.runtime_identity(self.root)['fingerprint'],old['fingerprint'])

    def test_rt13_copy_status_entrypoints_agree_on_missing_canonical_records(self):
        for markdown in (False,True):
            with self.subTest(markdown=markdown):
                cfg=self.read('funnel.json');cfg['quality']={'contract_version':2}
                if markdown:cfg['guided_workflow']={'copy_format':'markdown'}
                self.write('funnel.json',cfg)
                direct=copy_contract.inspect(self.root);common=workflow.copy_state(self.root)
                result=copy_acceptance.verify(self.root,self.root/'build/copy-review-inputs.json',self.root/'build/copy-editorial-review.json')
                self.assertEqual(direct['status'],'blocked')
                self.assertEqual(direct,common)
                self.assertEqual(result['status'],direct['status'])
                self.assertEqual(result['source_fingerprint'],direct['source_fingerprint'])

    def test_f17_current_semantic_review_can_pass(self):
        self.copy_review();self.assertEqual(copy_quality.inspect(self.root),[])

    def test_f17_claim_stretch_cannot_use_empty_ledger(self):
        review=self.copy_review('Only the work you actually need. Request a consultation.')
        measured=copy_quality.lint(self.root)
        review['findings']=[{'id':f['id'],'disposition':'not_applicable','reason':'Synthetic attempted bypass','evidence':self.source} for f in measured['findings']]
        self.write('build/copy-quality-review.json',review)
        self.assertTrue(any('semantic claim ledger' in e for e in copy_quality.inspect(self.root)))

    def test_f17_current_copy_change_invalidates_review(self):
        self.copy_review();self.put('build/page-copy.md','Changed offer and a new promise.')
        self.assertTrue(any('stale' in e for e in copy_quality.inspect(self.root)))

    def test_f18_preview_is_not_a_business_follow_up(self):
        self.copy_review();cfg=self.read('funnel.json');cfg['follow_up_promise']='Local CRM receipt'
        self.write('funnel.json',cfg)
        self.assertTrue(any('alias differs' in e for e in copy_quality.inspect(self.root)))

    def test_f18_technical_behavior_cannot_leak_to_copy(self):
        self.copy_review('Synthetic local-only persistence test')
        self.assertTrue(any('leaked' in e for e in copy_quality.inspect(self.root)))

    def test_f19_repeated_phrases_become_stable_review_findings(self):
        self.copy_review('Choose the service for your home. '*3)
        one=copy_quality.lint(self.root);two=copy_quality.lint(self.root)
        self.assertEqual(one,two);self.assertTrue(any(f['kind']=='repeated_phrase' for f in one['findings']))
        self.assertTrue(copy_quality.inspect(self.root))

    def test_rt23_review_themes_must_inform_copy_without_public_testimonials(self):
        review=self.copy_review()
        theme={'value':'Clear explanation','review_ids':['synthetic-review']}
        self.write('build/review-insights.json',{'themes':{'desired_outcomes':[theme]}})
        self.assertTrue(copy_quality.inspect(self.root))
        review['review_theme_use']=[{'dimension':'desired_outcomes',**theme,'disposition':'omitted',
                                    'reason':'This fixture does not offer that reviewed service'}]
        self.write('build/copy-quality-review.json',review)
        self.assertEqual(copy_quality.inspect(self.root),[])

    def test_f43_source_form_cannot_be_replaced_with_call(self):
        self.conversion();self.assertEqual(research_contract.conversion_errors(self.root,True),[])
        self.put('public/index.html','<a href="tel:123">Call now</a>')
        self.assertTrue(any('replaced' in e for e in research_contract.conversion_errors(self.root,True)))

    def test_f43_source_required_field_cannot_become_optional(self):
        self.conversion();self.put('public/index.html','<form><input name="email" type="email"></form>')
        self.assertTrue(research_contract.conversion_errors(self.root,True))

    def test_f43_changed_offer_needs_evidence(self):
        record=self.conversion();record['source_offer']='Different original offer'
        self.write('build/conversion-contract.json',record)
        self.assertTrue(any('authorization' in e for e in research_contract.conversion_errors(self.root)))

    def test_f39_dependency_graph_rejects_copy_changed_after_build(self):
        self.put('build/page-copy.json','{"headline":"Synthetic"}')
        dependency_state.record(self.root,'main_page',['build/page-copy.json'],['public/index.html'])
        self.assertEqual(dependency_state.inspect(self.root),[])
        self.put('build/page-copy.json','{"headline":"Changed"}')
        self.assertTrue(dependency_state.inspect(self.root))

    def test_f39_invalidation_names_materially_affected_gates(self):
        self.write('build/gate-snapshot.json',gates.source_snapshot(self.root))
        self.put('public/index.html','<h1>Changed layout</h1>')
        changed=dependency_state.changes(self.root)
        self.assertEqual(changed['first_changed_dependency'],'public/index.html')
        self.assertTrue({'browser','visual','performance','final_review'}.issubset(changed['invalidated_domains']))

    def test_rt24_question_without_prior_discovery_is_not_shown(self):
        # A separate guided fixture, not the already-created bare project.
        project=self.root/'guided';guide.start(project,name='Synthetic business')
        questions=guide.questions(project)
        accepted,errors=question_log.qualify(project,questions)
        self.assertEqual(accepted,[]);self.assertTrue(errors)

    def test_rt24_identity_question_needs_no_impossible_prior_search(self):
        project=self.root/'guided';guide.start(project)
        value=question_log.presented(project,guide.next_action(project))
        self.assertEqual(value['kind'],'question')
        self.assertEqual(question_log.validate(project),[])

    def test_rt25_representing_same_question_does_not_duplicate_log(self):
        project=self.root/'guided';guide.start(project)
        action=guide.next_action(project)
        question_log.presented(project,action);question_log.presented(project,action)
        value=storage.read(project,'build/question-log.json')
        self.assertEqual(len(value['questions']),len(action['questions']))

    def test_f40_warning_needs_owner_impact_scope_and_retest(self):
        report={'status':'pass_with_warnings','warnings':['Synthetic limit'],
                'warning_dispositions':[{'warning':'Synthetic limit','disposition':'accepted_limit',
                    'reason':'Synthetic bounded impact','evidence':self.source}]}
        self.assertTrue(completion.warning_errors(self.root,report))
        report['warning_dispositions'][0].update(scope='Fixture only',owner_impact='No real impact',retest_trigger='Fixture changes')
        self.assertEqual(completion.warning_errors(self.root,report),[])

    def test_f48_assertion_exits_nonzero_on_incomplete_project(self):
        proc=subprocess.run([sys.executable,str(S/'release_acceptance.py'),str(self.root),'--require','local_final'],capture_output=True,text=True,timeout=10)
        self.assertEqual(proc.returncode,1,proc.stderr)
        self.assertEqual(json.loads(proc.stdout)['release_class'],'local_preview')

    def test_f48_inspection_success_does_not_mean_release_pass(self):
        proc=subprocess.run([sys.executable,str(S/'release_acceptance.py'),str(self.root)],capture_output=True,text=True,timeout=10)
        self.assertEqual(proc.returncode,0,proc.stderr)
        self.assertTrue(json.loads(proc.stdout)['blockers'])

    def test_f48_workflow_assertion_delegates_release_authority(self):
        proc=subprocess.run([sys.executable,str(S/'workflow.py'),'assert-release',str(self.root),'--class','local_final'],capture_output=True,text=True,timeout=10)
        self.assertEqual(proc.returncode,1,proc.stderr)

    def test_f01_no_local_final_can_imply_publish_ready(self):
        self.assertFalse(release_acceptance.satisfies({'release_class':'local_final'},'publish_ready'))
        self.assertTrue(release_acceptance.satisfies({'release_class':'live_verified'},'local_final'))


class PublicationContractTests(unittest.TestCase):
    setUp=BlueprintTests.setUp
    put=BlueprintTests.put
    write=BlueprintTests.write
    read=BlueprintTests.read
    receipt=BlueprintTests.receipt
    # Only operator/account observations are synthetic; release classification
    # and written projections use real production functions.
    def test_worker_publish_uses_the_actual_consent_binding_object(self):
        import ship
        cfg={'backend':{'provider':'cloudflare-d1'}}
        state={'stage':'protect','pending':None,'blocked':None,'intent':{'site':'fixture'},
               'completed':{'preflight':{'source':'fingerprint','binding':'intent-hash','evidence':{'target':{'worker':'fixture'}}}},
               'consents':{'publish':{'binding':'intent-hash','message_id':'synthetic'}}}
        with patch.object(ship.Ship,'load',return_value=state), patch.object(ship.Ship,'binding',return_value='intent-hash'):
            self.assertEqual(release_acceptance.publication_state(self.root,'fingerprint','publish',cfg)['status'],'pass')
            state['consents']['publish']['binding']='old-intent'
            self.assertEqual(release_acceptance.publication_state(self.root,'fingerprint','publish',cfg)['status'],'blocked')

    def test_live_summary_does_not_invent_an_archive_requirement(self):
        fp=gates.source_snapshot(self.root)['source_fingerprint']
        quality={'status':'pass','mode':'handoff','source_fingerprint':fp,'gates':{'fixture':{'status':'pass'}},'failures':[],'warnings':[]}
        with patch.object(gates,'check',return_value=quality), patch.object(release_acceptance,'workflow_errors',return_value=([],{'stage':'static_published'})), patch.object(release_acceptance,'publication_state',return_value={'status':'pass','scope':'Synthetic observation'}):
            summary=completion.write_summary(self.root,quality,requested_mode='live')
            self.assertEqual(summary['release_class'],'live_verified')
            self.assertEqual(summary['mandatory']['portable_export']['status'],'not_applicable')
            self.assertEqual(summary['blockers'],[])
            owner=self.read('build/owner-handoff.json')
            self.assertNotIn('packaging is next',owner['message'])
            self.assertEqual(owner['release_class'],'live_verified')

    def test_live_summary_requires_real_publication_observation(self):
        fp=gates.source_snapshot(self.root)['source_fingerprint']
        quality={'status':'pass','mode':'handoff','source_fingerprint':fp,'gates':{},'failures':[],'warnings':[]}
        with patch.object(gates,'check',return_value=quality), patch.object(release_acceptance,'workflow_errors',return_value=([],{'stage':'static_published'})):
            summary=completion.write_summary(self.root,quality,requested_mode='live')
            self.assertEqual(summary['release_class'],'local_preview')
            self.assertTrue(summary['blockers'])

    def test_independent_receipt_must_return_the_exact_validated_json(self):
        provenance=self.receipt()
        self.assertEqual(execution_receipts.validate(self.root,provenance,report_value=self.read('build/final-review.json')),[])
        self.assertTrue(execution_receipts.validate(self.root,provenance,report_value={'fabricated':'pass'}))


class FinalReviewPacketTests(unittest.TestCase):
    """Synthetic rendered packet tests; not an actual visual review of a client."""
    def setUp(self):
        from test_control_review import ControlReviewTests
        from PIL import Image
        fixture=ControlReviewTests();fixture.setUp();self.addCleanup(fixture.doCleanups)
        self.root=fixture.root
        # This is a control-only synthetic static fixture with no PDF or form.
        cfg=storage.read(self.root,'funnel.json');cfg['catalogue']={'enabled':False}
        storage.write(self.root,'funnel.json',cfg)
        fixture.final()
        self.snapshot={'schema_version':1,'created_at':gates.now(),'mode':'handoff',**gates.source_snapshot(self.root)}
        storage.write(self.root,'build/gate-snapshot.json',self.snapshot)
        import control_review
        control_review.report(self.root)
        def save(name,data):
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data))
            return {'path':name,'sha256':gates.file_hash(p)}
        self.save=save
        artifacts=[]
        for width,height in ((390,844),(1440,900),(768,1024),(1024,800),(1280,600)):
            name=f'build/final-state-{width}.png';p=self.root/name;Image.new('RGB',(width,height),'white').save(p)
            artifacts.append({'path':name,'sha256':gates.file_hash(p),'type':'screenshot','state':'page',
                'viewport':{'width':width,'height':height},'device_pixel_ratio':1,'engine':'synthetic-test',
                'browser_version':'unit-test-not-browser','url':'http://127.0.0.1:8791/','source_fingerprint':self.snapshot['source_fingerprint']})
        name='build/rendered.txt';(self.root/name).write_text('Synthetic rendered service for homeowners. Request an inspection. No outcome guarantee.')
        text={**artifacts[0],'path':name,'sha256':gates.file_hash(self.root/name),'type':'rendered_text'};artifacts.append(text)
        capture=save('build/capture.json',{'status':'pass','source_fingerprint':self.snapshot['source_fingerprint'],
            'executed_at':gates.now(),'tool':{'name':'synthetic-fixture','version':'1'},'execution':{'exit_code':0},'artifacts':artifacts})
        control='build/control-review/result.json'
        ref={'path':text['path'],'sha256':text['sha256'],'excerpt':'Synthetic rendered service for homeowners.'}
        observation={'status':'pass','observations':'Synthetic anchored reviewer observation','evidence':[ref]}
        self.report={'source_fingerprint':self.snapshot['source_fingerprint'],'reviewer_provenance':{'mode':'self_review',
            'reviewer_task_id':'fixture-self','builder_task_id':'fixture-self'},'artifacts':artifacts,
            'capture_reports':[capture],'control_review':{'path':control,'sha256':gates.file_hash(self.root/control)},
            'executed_at':gates.now(),'domains':{key:copy.deepcopy(observation) for key in final_review.DOMAINS},
            'cold_reader':{key:copy.deepcopy(observation) for key in final_review.QUESTIONS},
            'findings':[],'unresolved_findings':[],'decision':'pass'}
        self.report['cold_reader']['guide_job']={'status':'not_applicable','reason':'This synthetic review packet does not include a guide'}

    def test_f28_complete_synthetic_observation_packet_passes(self):
        self.assertEqual(final_review.errors(self.root,self.report,self.snapshot),[])

    def test_f28_screenshot_metadata_must_match_executed_capture(self):
        self.report['artifacts'][0]['viewport']['height']=999
        self.assertTrue(final_review.errors(self.root,self.report,self.snapshot))

    def test_f28_missing_short_view_blocks(self):
        self.report['artifacts']=[a for a in self.report['artifacts'] if a.get('viewport',{}).get('width')!=1280]
        self.assertTrue(any('short-height' in e for e in final_review.errors(self.root,self.report,self.snapshot)))

    def test_f41_unresolved_severe_finding_blocks(self):
        self.report['findings']=[{'id':'blocking','severity':'P1','disposition':'accepted_limit',
                                  'evidence':self.report['cold_reader']['service']['evidence'][0]}]
        self.assertTrue(any('severe' in e for e in final_review.errors(self.root,self.report,self.snapshot)))

    def test_f42_cold_reader_cannot_cite_invented_rendered_excerpt(self):
        self.report['cold_reader']['service']['evidence'][0]['excerpt']='This text is absent.'
        self.assertTrue(any('excerpt' in e for e in final_review.errors(self.root,self.report,self.snapshot)))

    def test_f42_every_cold_reader_question_is_required(self):
        self.report['cold_reader'].pop('proof')
        self.assertTrue(any('proof' in e for e in final_review.errors(self.root,self.report,self.snapshot)))

    def test_f41_final_review_must_follow_control_repair(self):
        self.report['executed_at']='2000-01-01T00:00:00Z'
        self.assertTrue(any('predates' in e for e in final_review.errors(self.root,self.report,self.snapshot)))

    def test_f22_final_review_cannot_invent_independent_mode(self):
        self.report['reviewer_provenance']['mode']='independent'
        self.assertTrue(final_review.errors(self.root,self.report,self.snapshot))

    def test_f28_a_dated_note_cannot_replace_registered_control_review(self):
        self.report['control_review']=self.save('build/fake-control.json',{'executed_at':gates.now(),'status':'pass'})
        self.assertTrue(any('registered' in e for e in final_review.errors(self.root,self.report,self.snapshot)))


if __name__ == '__main__':
    unittest.main()
