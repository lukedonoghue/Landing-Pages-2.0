"""Offline regression fixtures, not execution receipts for a client build."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import check_gates as gates
import completion_contract as contract
import image_evidence
import image_workflow as images
import scan_surfaces
import portable_handoff
import workflow
from test_image_workflow import png


class CompletionIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.put('public/index.html', '<h1>Specific service</h1>')
        self.write('funnel.json', {'backend': {'provider': 'none'}, 'catalogue': {'enabled': False}})

    def put(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def write(self, name, content):
        return self.put(name, json.dumps(content))

    def artifact(self, name='research/source.txt', content='Synthetic source evidence, no real business claim.'):
        path = self.put(name, content)
        return {'path': name, 'sha256': gates.file_hash(path)}

    def native(self, output):
        return {'kind': 'native_image_result', 'status': 'succeeded', 'tool': 'image_gen',
                'tool_call_id': 'synthetic-call', 'output_id': 'synthetic-output',
                'raw_result': 'Synthetic test only: synthetic-output', 'executed_at': gates.now(),
                'output_sha256': images.sha(output)}

    def plan(self):
        plan = json.loads((SKILL/'assets/image-plan.example.json').read_text())
        plan['assets'] = plan['assets'][:1]
        plan['minimum_distinct_content_originals'] = 1
        proof = self.artifact()
        plan['content_minimum_exception'] = {'reason': 'One-asset regression fixture, not a complete landing page.', 'evidence': proof}
        source = self.root/'supplied.png'; source.write_bytes(png())
        plan['inventory'] = [{'id': 'source', 'origin': 'client-supplied', 'local_file': str(source), 'source_sha256': images.sha(source.read_bytes()), 'evidence': proof}]
        item = plan['assets'][0]
        images.acquire(plan, self.root, item['id'], 'source', 'client-provided', 'Synthetic test rights', 'Synthetic test project, not real proof')
        item['variants'] = [dict(item['source'])]
        item['stage'] = 'optimized'
        return plan

    def test_runtime_examples_do_not_block_but_project_docs_do(self):
        self.put('.community-builder/references/example.md', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        self.put('scripts/tool.py', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'pass')
        self.put('docs/RESEARCH-BRIEF.md', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'blocked')

    def test_scanner_does_not_exclude_project_due_to_ancestor_name(self):
        root = self.root/'test-results/project'
        root.mkdir(parents=True)
        (root/'index.html').write_text('WORKFLOW_TEMPLATE_INCOMPLETE')
        self.assertEqual(scan_surfaces.scan(root)['status'], 'blocked')

    def test_public_placeholders_and_canonical_copy_remain_in_scope(self):
        self.put('build/page-copy.md', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'blocked')
        self.put('build/page-copy.md', 'Approved complete wording')
        self.put('public/index.html', '{{CLIENT_NAME}}')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'blocked')

    def test_canonical_copy_and_brand_changes_invalidate_source(self):
        before = gates.source_snapshot(self.root)['source_fingerprint']
        for name in ('build/page-copy.json', 'build/brand.json', 'build/research-acceptance.json'):
            self.write(name, {'changed': name})
            after = gates.source_snapshot(self.root)['source_fingerprint']
            self.assertNotEqual(before, after)
            before = after

    def test_generated_summary_does_not_invalidate_its_own_snapshot(self):
        before = gates.source_snapshot(self.root)
        self.put('docs/QA-REPORT.md', 'Current generated report')
        self.write('build/release-status.json', {'status': 'blocked'})
        self.put('README-DELIVERY.md', 'Current generated handoff')
        self.put('image-plan.json.lock', '')
        self.assertEqual(before, gates.source_snapshot(self.root))

    def test_canonical_symlink_is_rejected(self):
        (self.root/'build').mkdir()
        (self.root/'build/page-copy.json').symlink_to(self.root/'funnel.json')
        with self.assertRaises(ValueError):
            gates.source_snapshot(self.root)

    def test_native_note_is_not_a_generation_receipt(self):
        note = self.put('research/image-evidence.txt', 'I made a raster illustration.')
        with self.assertRaisesRegex(ValueError, 'structured retained tool result'):
            image_evidence.native_result(note, '0'*64)

    def test_structured_synthetic_receipt_requires_the_same_bytes(self):
        receipt = self.write('research/native.json', self.native(b'image bytes'))
        self.assertEqual(image_evidence.native_result(receipt, images.sha(b'image bytes'))['tool_call_id'], 'synthetic-call')
        with self.assertRaisesRegex(ValueError, 'different output bytes'):
            image_evidence.native_result(receipt, '0'*64)

    def test_native_receipt_requires_real_output_linkage_and_time(self):
        for key, value in [('raw_result', 'not linked'), ('executed_at', '2999-01-01T00:00:00Z'), ('tool_call_id', '')]:
            record = self.native(b'fixture'); record[key] = value
            receipt = self.write('research/native.json', record)
            with self.assertRaises(ValueError):
                image_evidence.native_result(receipt, images.sha(b'fixture'))

    def test_native_model_is_not_guessed(self):
        receipt = self.write('research/native.json', self.native(b'fixture'))
        with self.assertRaisesRegex(ValueError, 'not reported'):
            image_evidence.native_result(receipt, images.sha(b'fixture'), 'unreported-model')

    def test_preflight_does_not_require_a_render_before_layout(self):
        plan = self.plan()
        self.assertTrue(images.preflight(plan, self.root)['passed'])
        self.assertFalse(images.gate(plan, self.root)['passed'])

    def test_a_second_filename_does_not_add_an_original(self):
        plan = self.plan(); item = copy.deepcopy(plan['assets'][0])
        item['id'] = 'duplicate'; item['source_original_ids'] = ['duplicate']
        plan['assets'].append(item)
        self.assertEqual(images.preflight(plan, self.root)['distinct_content_original_count'], 1)

    def test_a_composite_cannot_invent_four_original_ids(self):
        plan = self.plan(); plan['assets'][0]['source_original_ids'] = ['a', 'b', 'c', 'd']
        result = images.preflight(plan, self.root)
        self.assertFalse(result['passed'])
        self.assertTrue(any('original_evidence' in e for e in result['errors']))

    def test_changed_optimized_bytes_block_preflight(self):
        plan = self.plan()
        (self.root/plan['assets'][0]['variants'][0]['path']).write_bytes(png(color=(120,10,10)))
        self.assertFalse(images.preflight(plan, self.root)['passed'])

    def test_gate_does_not_mutate_saved_review_history(self):
        plan = self.plan(); original = copy.deepcopy(plan)
        images.gate(plan, self.root)
        self.assertEqual(plan, original)

    def test_missing_manifest_lists_all_required_gates_as_blocked(self):
        result = gates.check(self.root, 'handoff', self.root/'build/gates.json')
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('copy', result['gates'])
        self.assertIn('images', result['gates'])
        self.assertTrue(all(r['status'] == 'blocked' for r in result['gates'].values()))

    def test_disabling_complete_workflow_does_not_disable_final_checks(self):
        self.write('funnel.json', {'quality': {'complete_workflow': False}, 'backend': {'provider': 'cloudflare'}})
        required = gates.required_gates(self.root, 'handoff')
        for gate in ('copy','images','local_journey','performance','browser_compat','rendered_copy'):
            self.assertIn(gate, required)

    def test_a_warning_requires_a_specific_current_disposition(self):
        report = {'status':'pass_with_warnings', 'warnings':['admin button needs review']}
        self.assertTrue(contract.warning_errors(self.root, report))
        report['warning_dispositions'] = [{'warning':report['warnings'][0], 'disposition':'accepted_limit', 'scope':'Synthetic-only protocol fixture', 'owner_impact':'No real owner effect', 'retest_trigger':'Any relevant fixture change', 'reason':'Synthetic fixture demonstrating explicit disposition', 'evidence':self.artifact()}]
        self.assertEqual(contract.warning_errors(self.root, report), [])
        self.put('research/source.txt', 'changed')
        self.assertTrue(contract.warning_errors(self.root, report))

    def test_empty_warning_status_is_not_a_pass(self):
        self.assertTrue(contract.warning_errors(self.root, {'status':'pass_with_warnings','warnings':[]}))

    def test_a_task_name_does_not_prove_independent_execution(self):
        provenance = {'mode':'independent','reviewer_task_id':'other-task','builder_task_id':'builder'}
        self.assertTrue(contract.independent_review_errors(self.root, provenance))
        self.assertEqual(contract.independent_review_errors(self.root, {'mode':'self_review'}), [])

    def test_matching_dispatch_result_is_required_for_independence(self):
        value = {'status':'completed','task_id':'reviewer','host':'synthetic test harness', 'dispatch_id':'test-dispatch','raw_result':'Synthetic test findings, not real independent review'}
        path = self.write('build/review-execution.json', value)
        provenance = {'mode':'independent','reviewer_task_id':'reviewer','builder_task_id':'builder', 'execution_artifact':{'path':'build/review-execution.json','sha256':contract.digest(path)}}
        self.assertTrue(contract.independent_review_errors(self.root, provenance))
        provenance['reviewer_task_id'] = 'invented'
        self.assertTrue(contract.independent_review_errors(self.root, provenance))

    def test_missing_research_and_empty_section_maps_block(self):
        self.assertTrue(contract.research(self.root))
        self.write('build/page-structure.json', {'sections': []})
        self.write('build/reference-fidelity.json', {'sources': [], 'reference_sections': [], 'coverage': []})
        self.assertTrue(contract.coverage(self.root))

    def test_exception_requires_attempts_and_unchanged_evidence(self):
        value = {'reviewer':'synthetic reviewer','reason':'Source inaccessible','evidence': self.artifact()}
        with self.assertRaises(ValueError):
            contract.exception(self.root, value, 'Research')
        value['attempts'] = [{'source':'official site','outcome':'Unavailable in synthetic fixture','evidence':value['evidence']}]
        contract.exception(self.root, value, 'Research')

    def test_summary_does_not_promote_missing_tests_or_leave_qa_a_template(self):
        self.put('docs/QA-REPORT.md', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        result = gates.check(self.root, 'handoff', self.root/'build/gates.json')
        summary = contract.write_summary(self.root, result)
        self.assertEqual(summary['release_level'], 'local-preview')
        self.assertEqual(summary['status'], 'blocked')
        self.assertNotIn('WORKFLOW_TEMPLATE_INCOMPLETE', (self.root/'docs/QA-REPORT.md').read_text())
        owner = contract.read(self.root/'build/owner-handoff.json')
        self.assertEqual(owner['source_fingerprint'], result['source_fingerprint'])
        self.assertEqual(owner['status'], 'action_required')

    def test_accepted_quality_is_not_itself_a_completed_export(self):
        result = {'status':'pass','mode':'handoff','source_fingerprint':gates.source_snapshot(self.root)['source_fingerprint'],'gates':{'static':{'status':'pass','failures':[]}},'failures':[], 'warnings':[]}
        # Tests renderer semantics only: this fabricated fixture is never registered.
        summary = contract.write_summary(self.root, result)
        self.assertEqual(summary['release_level'], 'local-preview')
        self.assertTrue(summary['export_required_for_local_final'])

    def test_summary_rejects_a_stale_aggregate(self):
        result = gates.check(self.root, 'handoff', self.root/'build/gates.json')
        self.put('public/index.html', '<h1>A changed offer</h1>')
        with self.assertRaisesRegex(ValueError, 'Source changed'):
            contract.write_summary(self.root, result)

    def test_owner_production_usage_is_never_invented_as_verified(self):
        self.put('src/free-usage.js', '// Synthetic runtime marker')
        result = gates.check(self.root, 'handoff', self.root/'build/gates.json')
        contract.write_summary(self.root, result)
        owner = contract.read(self.root/'build/owner-handoff.json')
        self.assertEqual(owner['usage_monitoring']['status'], 'deferred')
        self.assertIn('has not been verified', owner['message'])

    def test_export_of_missing_copy_and_gates_is_rejected(self):
        with self.assertRaises(ValueError):
            portable_handoff.export_bundle(self.root, self.root/'build/out.zip', 'Synthetic')

    def test_legacy_site_only_export_cannot_claim_complete(self):
        completed = subprocess.run([sys.executable,str(SKILL/'scripts/package_handoff.py'),str(self.root), '--output',str(self.root/'build/out.zip'),'--client','Synthetic','--site-only'], capture_output=True,text=True)
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn('cannot certify completion', completed.stderr)

    def test_packaging_rejects_caches_and_locks_but_keeps_dependency_lock(self):
        for name in ('.secrets/workflow-state.lock','assets/cache.pyc','image-plan.json.lock'):
            with self.assertRaises(ValueError):
                portable_handoff.eligible(name)
        portable_handoff.eligible('package-lock.json')



    def test_scanner_does_not_hide_public_runtime_named_subfolder(self):
        self.put('public/.community-builder/index.html', 'WORKFLOW_TEMPLATE_INCOMPLETE')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'blocked')

    def test_unreadable_public_text_is_not_a_clean_scan(self):
        (self.root/'public/index.html').write_bytes(b'\xff\xfe')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'blocked')

    def test_deployed_images_must_be_registered_and_used(self):
        plan = self.plan()
        source = plan['assets'][0]['source']['path']
        self.assertTrue(contract.deployed_image_errors(self.root, plan))
        # Deploy the same actual bytes under the site tree, then register the variant.
        target = self.root/'public/photo.png'; target.write_bytes((self.root/source).read_bytes())
        plan['assets'][0]['variants'] = [dict(plan['assets'][0]['source'], path='public/photo.png')]
        self.put('public/index.html', '<h1>Actual service</h1><img src="photo.png" alt="Synthetic fixture">')
        self.assertEqual(contract.deployed_image_errors(self.root, plan), [])
        plan['assets'] = []
        self.assertTrue(any('no image-plan' in e for e in contract.deployed_image_errors(self.root, plan)))

    def test_remote_image_is_not_retained_deployed_byte_evidence(self):
        self.put('public/index.html', '<img src="https://example.test/photo.png">')
        self.assertTrue(any('actual deployed image bytes' in e for e in contract.deployed_image_errors(self.root, {'assets': []})))

    def test_css_visuals_are_checked_too(self):
        self.put('public/index.html', '<link rel="stylesheet" href="site.css">')
        self.put('public/site.css', 'body { background-image: url(photo.png); }')
        (self.root/'public/photo.png').write_bytes(png())
        self.assertTrue(any('no image-plan' in e for e in contract.deployed_image_errors(self.root, {'assets': []})))

    def test_canonical_documents_render_and_detect_drift(self):
        original = self.artifact('build/strategy-brief.md', 'A retained, specific business finding, source qualification and useful buyer decision. ' * 5)
        self.write('build/document-sources.json', {'documents': {'RESEARCH-BRIEF.md': original}})
        self.assertEqual(contract.render_documents(self.root)['status'], 'pass')
        self.assertEqual(contract.document_source_errors(self.root), [])
        self.put('docs/RESEARCH-BRIEF.md', 'A different draft')
        self.assertTrue(contract.document_source_errors(self.root))

    def test_renderer_does_not_erase_template_markers(self):
        original = self.artifact('build/strategy-brief.md', 'WORKFLOW_TEMPLATE_INCOMPLETE ' * 10)
        self.write('build/document-sources.json', {'documents': {'RESEARCH-BRIEF.md': original}})
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            contract.render_documents(self.root)
        self.assertFalse((self.root/'docs/RESEARCH-BRIEF.md').exists())

    def test_canonical_inputs_survive_archive_source_exclusion(self):
        for name in contract.CANONICAL_INPUTS:
            self.assertFalse(gates.excluded(Path(name)), name)
        self.assertTrue(gates.excluded(Path('build/cached-report.json')))

    def test_raw_lighthouse_metrics_not_a_self_asserted_score(self):
        audit = {'lighthouseVersion':'synthetic-test','requestedUrl':'http://127.0.0.1:8787/','configSettings': {'formFactor': 'mobile', 'throttlingMethod': 'simulate'},
                 'categories': {'performance': {'score': .95}},
                 'audits': {'largest-contentful-paint': {'numericValue': 1900},
                            'cumulative-layout-shift': {'numericValue': .01},
                            'total-blocking-time': {'numericValue': 50}}}
        artifacts=[]
        for i in range(3):
            name='build/raw-lighthouse-'+str(i)+'.json'
            path=self.write(name, {**audit,'fetchTime':'2026-01-01T00:00:0'+str(i)+'Z'})
            artifacts.append({'path':name,'sha256':gates.file_hash(path),'type':'lighthouse_json'})
        report={'artifacts':artifacts,'target':{'url':'http://127.0.0.1:8787/'},'server':{'command':'synthetic fixture server'},
                'metrics': {'performance':95.0,'lcp_ms':1900,'cls':.01,'tbt_ms':50}}
        self.assertEqual(contract.performance_errors(self.root, report), [])
        report['metrics']['performance']=100
        self.assertTrue(contract.performance_errors(self.root, report))
        report['artifacts']=[]
        self.assertTrue(contract.performance_errors(self.root, report))

    def test_browser_cannot_infer_viewport_from_filename(self):
        from PIL import Image
        path=self.root/'public/fake-1280x600.png';Image.new('RGB',(390,844)).save(path)
        report={'artifacts':[{'path':'public/fake-1280x600.png','sha256':gates.file_hash(path),
                'type':'screenshot','viewport':{'width':1280,'height':600},'device_scale_factor':1,'state':'page'}]}
        self.assertTrue(contract.browser_evidence_errors(self.root, report, 'browser'))

    def test_declared_independent_control_review_requires_execution(self):
        from test_control_review import ControlReviewTests
        fixture=ControlReviewTests();fixture.setUp()
        try:
            fixture.final()
            acceptance=contract.read(fixture.root/'build/control-review/acceptance.json')
            acceptance['reviewer']['mode']='independent'
            fixture.save('acceptance.json',acceptance)
            import control_review
            self.assertEqual(control_review.inspect(fixture.root)['status'], 'blocked')
        finally:fixture.doCleanups()


if __name__ == '__main__':
    unittest.main()
