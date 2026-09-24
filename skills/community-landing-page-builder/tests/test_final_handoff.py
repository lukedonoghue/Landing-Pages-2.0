"""Synthetic orchestration fixtures; these are never client QA receipts."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import check_gates
import completion_contract
import guide
import portable_handoff
import workflow
import workflow_runner


class FinalHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'project'
        (self.root / 'public').mkdir(parents=True)
        (self.root / 'public/index.html').write_text('<h1>Synthetic fixture</h1>')
        (self.root / 'funnel.json').write_text(json.dumps({'backend': {'provider': 'none'}, 'client': {'name': 'Synthetic fixture'}}))

    def quality(self, root, *_args, **_kwargs):
        return {'status': 'pass', 'mode': 'handoff', **check_gates.source_snapshot(Path(root)),
                'gates': {'synthetic_fixture': {'status': 'pass'}}, 'failures': [], 'warnings': [], 'limits': []}

    def finalize_fixture(self):
        # Only acceptance inputs are mocked. ZIP creation, manifest checking,
        # clean extraction, byte hashing and summary generation all execute.
        with patch.object(check_gates, 'check', side_effect=self.quality), patch.object(workflow, 'copy_state', return_value={'status': 'pass', 'failures': []}):
            return completion_contract.finalize_local(self.root)

    def test_quality_pass_without_archive_is_not_final(self):
        summary = completion_contract.write_summary(self.root, self.quality(self.root))
        self.assertEqual(summary['release_level'], 'local-quality-ready')
        self.assertTrue(summary['export_required_for_local_final'])
        self.assertEqual(completion_contract.export_status(self.root)['status'], 'blocked')

    def test_guided_finalize_creates_and_verifies_real_archive(self):
        summary = self.finalize_fixture()
        self.assertEqual(summary['release_level'], 'local-final')
        self.assertFalse(summary['export_required_for_local_final'])
        exported = completion_contract.export_status(self.root)
        self.assertEqual(exported['status'], 'pass', exported)
        self.assertTrue(Path(exported['receipt']['archive']).is_file())
        self.assertEqual(exported['receipt']['restore_verification'], {'copy': 'pass', 'quality': 'pass'})
        for name in ('README-DELIVERY.md', 'docs/QA-REPORT.md', 'build/owner-handoff.json'):
            self.assertIn('local-final', (self.root / name).read_text())

    def test_repeated_finalize_reuses_unchanged_archive(self):
        self.finalize_fixture()
        before = (self.root / 'build/export-verification.json').read_bytes()
        with patch.object(portable_handoff, 'export_bundle', side_effect=AssertionError('Valid export should be reused')):
            self.assertEqual(self.finalize_fixture()['release_level'], 'local-final')
        self.assertEqual(before, (self.root / 'build/export-verification.json').read_bytes())

    def test_changed_source_downgrades_all_summary_surfaces(self):
        self.finalize_fixture()
        (self.root / 'public/index.html').write_text('<h1>Changed synthetic fixture</h1>')
        self.assertEqual(completion_contract.export_status(self.root)['status'], 'blocked')
        summary = completion_contract.write_summary(self.root, self.quality(self.root))
        self.assertEqual(summary['release_level'], 'local-quality-ready')
        self.assertNotIn('local-final', (self.root / 'README-DELIVERY.md').read_text())

    def test_deleted_archive_does_not_leave_saved_final_status_valid(self):
        self.finalize_fixture()
        receipt = json.loads((self.root / 'build/export-verification.json').read_text())
        Path(receipt['archive']).unlink()
        self.assertEqual(completion_contract.export_status(self.root)['status'], 'blocked')

    def test_corrupted_archive_is_blocked_not_an_unhandled_zip_error(self):
        self.finalize_fixture()
        receipt = json.loads((self.root / 'build/export-verification.json').read_text())
        Path(receipt['archive']).write_bytes(b'not an archive')
        self.assertEqual(completion_contract.export_status(self.root)['status'], 'blocked')

    def test_appended_bytes_do_not_match_verified_archive_hash(self):
        self.finalize_fixture()
        receipt = json.loads((self.root / 'build/export-verification.json').read_text())
        with Path(receipt['archive']).open('ab') as handle:
            handle.write(b'changed after export')
        self.assertEqual(completion_contract.export_status(self.root)['status'], 'blocked')

    def test_missing_restore_result_blocks_saved_pass(self):
        self.finalize_fixture()
        path = self.root / 'build/export-verification.json'
        receipt = json.loads(path.read_text()); receipt['restore_verification'] = {}
        path.write_text(json.dumps(receipt))
        self.assertEqual(completion_contract.export_status(self.root)['status'], 'blocked')

    def test_fixture_flag_cannot_bypass_final_client_acceptance(self):
        (self.root / 'funnel.json').write_text('{"development_fixture":true}')
        with self.assertRaisesRegex(ValueError, 'explicitly --in-progress'):
            portable_handoff.export_bundle(self.root, self.root / 'build/out.zip', 'Fixture')

    def test_worker_can_submit_research_but_not_coordinator_release_records(self):
        for name in ('build/research-acceptance.json', 'build/document-sources.json'):
            self.assertTrue(workflow_runner.allowed(name), name)
        for name in ('build/release-status.json', 'build/export-verification.json', 'build/owner-handoff.json'):
            self.assertFalse(workflow_runner.allowed(name), name)

    def test_guided_export_operation_requires_current_controller_action(self):
        with patch.object(guide, 'next_action', return_value={'operation': 'different'}):
            with self.assertRaisesRegex(ValueError, 'not the current guided action'):
                guide.local(self.root, 'finalize_local')

    def visual_fixture(self, modal=True):
        from PIL import Image
        if modal:
            (self.root / 'public/index.html').write_text('<button data-open-modal>Enquire</button><form></form>')
        (self.root / 'public/thank-you.html').write_text('<h1>Thank you</h1>')
        artifacts = []
        for width in (390, 1440):
            for index, state in enumerate(('page', 'modal_initial', 'modal_error', 'modal_focused', 'server_error', 'thank_you')):
                name = 'build/screenshots/' + str(width) + '-' + state + '.png'
                target = self.root / name; target.parent.mkdir(parents=True, exist_ok=True)
                Image.new('RGB', (width, 600), color=(index * 25, 60, 80)).save(target)
                artifacts.append({'path': name, 'sha256': check_gates.file_hash(target), 'type': 'screenshot',
                                  'state': state, 'viewport': {'width': width, 'height': 600}, 'device_pixel_ratio': 1})
        return {'artifacts': artifacts}

    def test_visual_acceptance_requires_mobile_and_desktop_interaction_states(self):
        report = self.visual_fixture()
        self.assertEqual(completion_contract.visual_state_errors(self.root, report), [])
        report['artifacts'] = [a for a in report['artifacts'] if not (a['state'] == 'modal_error' and a['viewport']['width'] == 390)]
        self.assertIn('Final visual acceptance lacks the mobile modal_error capture', completion_contract.visual_state_errors(self.root, report))

    def test_closed_page_captures_cannot_certify_modal_and_error_states(self):
        report = self.visual_fixture()
        report['artifacts'] = [a for a in report['artifacts'] if a['state'] == 'page']
        failures = completion_contract.visual_state_errors(self.root, report)
        self.assertTrue(any('modal_initial' in failure for failure in failures))
        self.assertTrue(any('server_error' in failure for failure in failures))

    def test_visual_state_width_cannot_be_invented(self):
        report = self.visual_fixture()
        report['artifacts'][0]['viewport']['width'] = 1024
        self.assertTrue(completion_contract.visual_state_errors(self.root, report))

    def test_call_only_page_does_not_require_nonexistent_form_states(self):
        report = self.visual_fixture(modal=False)
        report['artifacts'] = [a for a in report['artifacts'] if a['state'] in {'page', 'thank_you'}]
        self.assertEqual(completion_contract.visual_state_errors(self.root, report), [])

    def test_preview_jargon_blocks_visitor_surface_not_owner_documentation(self):
        import scan_surfaces
        page = self.root / 'public/index.html'
        page.write_text('<p>Your entry stays in the local demo CRM</p>')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'blocked')
        page.write_text('<p>Preview only. Nothing is sent to the business.</p>')
        (self.root / 'public/admin').mkdir()
        (self.root / 'public/admin/index.html').write_text('<p>Local demo CRM configuration</p>')
        self.assertEqual(scan_surfaces.scan(self.root)['status'], 'pass')

    def test_blocked_quality_never_creates_archive(self):
        quality = {**self.quality(self.root), 'status': 'blocked', 'failures': ['Synthetic missing browser evidence']}
        with patch.object(check_gates, 'check', return_value=quality), patch.object(portable_handoff, 'export_bundle') as exporter:
            with self.assertRaisesRegex(ValueError, 'remains blocked'):
                completion_contract.finalize_local(self.root)
            exporter.assert_not_called()


if __name__ == '__main__':
    unittest.main()
