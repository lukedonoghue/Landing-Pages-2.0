#!/usr/bin/env python3
"""Integrity regressions: unchanged timestamps cannot rescue stale evidence."""
import json
from pathlib import Path
import tempfile
import unittest
import check_gates as gates


class GatesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'public').mkdir()
        (self.root / 'public/index.html').write_text('<h1>Neutral service</h1>')
        (self.root / 'funnel.json').write_text(json.dumps({'catalogue': {'enabled': False}}))
        self.snapshot = {'schema_version': 1, 'created_at': gates.now(), 'mode': 'preview', **gates.source_snapshot(self.root)}
        self.manifest = {'snapshot': self.snapshot, 'gates': {}}
        self.manifest_path = self.root / 'build/gates.json'
        for gate in ['static', 'browser', 'visual']:
            self.add_report(gate)
        gates.write_json(self.manifest_path, self.manifest)

    def artifact(self, name, kind):
        path = self.root / f'build/{name}'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'{name} actual evidence fixture')
        return {'path': path.relative_to(self.root).as_posix(), 'type': kind, 'sha256': gates.file_hash(path)}

    def add_report(self, gate):
        report = {'schema_version': 1, 'gate': gate, 'status': 'pass', 'executed_at': gates.now(),
                  'source_fingerprint': self.snapshot['source_fingerprint'], 'tool': {'name': 'regression-fixture', 'version': '1'},
                  'target': {'mode': self.snapshot['mode']}, 'checks': [{'name': 'fixture', 'status': 'pass', 'detail': 'Known fixture'}]}
        if gate == 'browser':
            report.update(execution={'kind': 'automated'}, viewports=[{'width': w, 'height': 600 if w == 1280 else 844} for w in [360, 390, 768, 1024, 1180, 1280, 1440]], artifacts=[self.artifact('screen.png', 'screenshot')])
        if gate == 'visual':
            report.update(reviewer='test reviewer', observations=['Inspected fixture screenshot'], artifacts=[self.artifact('visual.png', 'screenshot')])
        path = self.root / f'build/{gate}.json'
        gates.write_json(path, report)
        self.manifest['gates'][gate] = {'status': 'pass', 'report': f'build/{gate}.json', 'report_sha256': gates.file_hash(path)}
        return report

    def result(self, mode='preview'):
        return gates.check(self.root, mode, self.manifest_path)

    def test_complete_preview_passes(self):
        self.assertEqual(self.result()['status'], 'pass')

    def test_public_asset_change_invalidates_all_claims(self):
        (self.root / 'public/logo.svg').write_text('<svg/>')
        result = self.result()
        self.assertEqual(result['status'], 'blocked')
        self.assertTrue(any('public/logo.svg' in x for x in result['failures']))

    def test_public_asset_folders_are_not_mistaken_for_qa_output(self):
        path = self.root / 'public/screenshots/service.jpg'
        path.parent.mkdir(parents=True)
        path.write_text('client-facing image')
        self.assertIn('public/screenshots/service.jpg', gates.source_snapshot(self.root)['files'])

    def test_screenshot_change_is_detected_without_source_change(self):
        (self.root / 'build/screen.png').write_text('replacement screenshot')
        result = self.result()
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('Artifact hash mismatch', str(result))

    def test_report_status_or_timestamp_tampering_is_detected(self):
        path = self.root / 'build/browser.json'
        report = gates.read_json(path)
        report['executed_at'] = gates.now()
        report['status'] = 'pass_with_warnings'
        gates.write_json(path, report)
        self.assertIn('Report changed', str(self.result()))

    def test_old_source_report_cannot_be_attached_to_fresh_snapshot(self):
        old_report = gates.read_json(self.root / 'build/browser.json')
        (self.root / 'public/index.html').write_text('<h1>Updated offer</h1>')
        fresh = {**self.snapshot, 'created_at': gates.now(), **gates.source_snapshot(self.root)}
        old_report['executed_at'] = gates.now()
        errors = gates.validate_report(self.root, old_report, fresh, 'browser')
        self.assertIn('Report source fingerprint does not match the snapshot', errors)

    def test_runtime_and_secret_changes_do_not_change_fingerprint(self):
        for path in ['node_modules/pkg/index.js', '.wrangler/state/db.sqlite', 'build/screenshots/new.png', '.secrets/production.json', '.secrets/production-admin-password.txt', '.dev.vars', '.env.local']:
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('excluded')
        self.assertEqual(gates.source_snapshot(self.root)['source_fingerprint'], self.snapshot['source_fingerprint'])

    def test_preview_evidence_is_not_a_live_claim(self):
        result = self.result('live')
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('crm', result['gates'])
        self.assertIn('Manifest mode differs', str(result))

    def test_handwritten_crm_pass_is_rejected(self):
        snapshot = {**self.snapshot, 'mode': 'live'}
        report = {'schema_version': 1, 'gate': 'crm', 'status': 'pass', 'executed_at': gates.now(),
                  'source_fingerprint': snapshot['source_fingerprint'], 'target': {'mode': 'live', 'url': 'https://example.test'},
                  'tool': {'name': 'builder', 'version': '1'}, 'checks': {'crm': True}}
        errors = gates.validate_report(self.root, report, snapshot, 'crm')
        self.assertTrue(any('executed verification' in e for e in errors))
        self.assertTrue(any('correlate' in e for e in errors))
        self.assertTrue(any('receipt artifacts' in e for e in errors))

    def test_passing_report_cannot_hide_failed_boolean_or_nested_checks(self):
        report = gates.read_json(self.root / 'build/visual.json')
        for checks in [{'submission_saved': False}, {'form': {'passed': False}}, [{'name': 'form', 'status': 'failed'}]]:
            report['checks'] = checks
            self.assertIn('Passing report contains failed or blocked checks', gates.validate_report(self.root, report, self.snapshot, 'visual'))

    def test_catalogue_requires_every_page(self):
        report = gates.read_json(self.root / 'build/visual.json')
        report.update(gate='catalogue', page_count=3, reviewed_pages=[1, 3], artifacts=[self.artifact('catalogue.pdf', 'pdf'), self.artifact('page-1.png', 'rendered_page')])
        errors = gates.validate_report(self.root, report, self.snapshot, 'catalogue')
        self.assertIn('Catalogue evidence must review every rendered page in order', errors)

    def test_required_gate_cannot_be_not_applicable(self):
        path = self.root / 'build/browser.json'
        report = gates.read_json(path)
        report['status'] = 'not_applicable'
        gates.write_json(path, report)
        self.manifest['gates']['browser'].update(status='not_applicable', report_sha256=gates.file_hash(path))
        gates.write_json(self.manifest_path, self.manifest)
        self.assertIn('Required gate is not_applicable', str(self.result()))

    def test_source_symlink_does_not_silently_escape_fingerprint(self):
        (self.root / 'external').symlink_to('/tmp')
        with self.assertRaises(ValueError):
            gates.source_snapshot(self.root)

    def test_artifact_cannot_escape_project(self):
        report = gates.read_json(self.root / 'build/visual.json')
        report['artifacts'][0]['path'] = '../outside.png'
        self.assertIn('Evidence must be inside', str(gates.validate_report(self.root, report, self.snapshot, 'visual')))


if __name__ == '__main__':
    unittest.main()
