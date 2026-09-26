"""Regressions for defects observed in the 26 September 2026 end-to-end field test.

See docs/community-landing-page-builder/E2E-FIELD-TEST-FIX-SPEC-20260926.md for the
defect IDs referenced below.
"""
import json
import os
import shutil
import ssl
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

import check_gates  # noqa: E402
import copy_parity  # noqa: E402
import guide  # noqa: E402
import image_workflow  # noqa: E402
import process_contract  # noqa: E402
import project_verify  # noqa: E402
import runtime_check  # noqa: E402
import workflow_runner  # noqa: E402
import workflow_storage as storage  # noqa: E402


def asset(image_id='hero-photo', trust='illustrative'):
    return {'id': image_id, 'section': 'Hero', 'purpose': 'Show the service', 'role': 'Hero photo', 'trust_class': trust,
            'source_original_ids': [image_id], 'counts_toward_content_minimum': True, 'required': True, 'allow_generation': False,
            'alt': 'A fitted security door', 'placement': {'desktop': {'aspect_ratio': '4:3', 'focal_point': [0.5, 0.5]},
                                                             'mobile': {'aspect_ratio': '4:3', 'focal_point': [0.5, 0.5]}},
            'max_bytes': {'desktop': 200000, 'mobile': 100000}, 'stage': 'planned'}


def plan(assets):
    return {'schema_version': 2, 'minimum_distinct_content_originals': 4, 'client_website': 'https://example.org', 'allowed_hosts': ['example.org'],
            'generation_budget': {'max_assets': 0, 'max_attempts_per_asset': 0, 'max_total_attempts': 0}, 'inventory': [], 'generation_attempts': [],
            'generation_decision': {'needed': False, 'reason': 'Sourced photos cover every placement.', 'gaps': []}, 'assets': assets, 'events': []}


class ImagePipelineTests(unittest.TestCase):
    def test_b4_cmyk_jpeg_is_optimized_without_changing_the_original(self):
        if not shutil.which('cwebp'):
            self.skipTest('cwebp is required by the image pipeline')
        from PIL import Image
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'cmyk.jpg'
            Image.new('CMYK', (640, 400), (10, 60, 0, 20)).save(source, 'JPEG')
            before = source.read_bytes()
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/optimize_images.py'), str(source), str(Path(temp) / 'out'), '--widths', '320'],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)['generated'][0]['width'], 320)
            self.assertEqual(source.read_bytes(), before)

    def test_g7_inventory_reads_lazy_loaded_sources(self):
        inventory = image_workflow.ImageInventory('https://example.org/page')
        inventory.feed('<img src="data:image/gif;base64,R0" bv-orig-srcset="https://example.org/a-800.webp 800w, https://example.org/a-300.webp 300w" '
                       'data-lazy-src="/b.jpg"><source data-srcset="https://example.org/c.webp 1x">')
        urls = {item['source_url'] for item in inventory.images}
        self.assertTrue({'https://example.org/a-800.webp', 'https://example.org/a-300.webp', 'https://example.org/b.jpg', 'https://example.org/c.webp'} <= urls)

    def test_g9_skill_role_words_are_accepted_as_trust_class_aliases(self):
        checked = image_workflow.validate_plan(plan([asset('corner-detail', 'diagram'), asset('owner-photo', 'proof')]))
        self.assertEqual([a['trust_class'] for a in checked['assets']], ['illustrative', 'client-proof'])
        with self.assertRaisesRegex(image_workflow.WorkflowError, 'client-proof, decorative, illustrative'):
            image_workflow.validate_plan(plan([asset('bad', 'hero')]))

    def test_g8_local_preview_only_is_an_honest_rights_value(self):
        self.assertIn('local-preview-only', image_workflow.RIGHTS)

    def test_g6_add_asset_validates_and_appends_a_planned_placement(self):
        current = image_workflow.validate_plan(plan([asset('hero-photo')]))
        added = image_workflow.add_asset(current, {k: v for k, v in asset('chooser-card').items() if k != 'stage'})
        self.assertEqual(added['stage'], 'planned')
        with self.assertRaisesRegex(image_workflow.WorkflowError, 'already exists'):
            image_workflow.add_asset(current, asset('chooser-card'))
        with self.assertRaises(image_workflow.WorkflowError):
            image_workflow.add_asset(current, {**asset('broken'), 'trust_class': 'hero'})

    def test_b3_tls_context_verifies_certificates(self):
        context = image_workflow.tls_context()
        self.assertIsInstance(context, ssl.SSLContext)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertIsInstance(runtime_check.https_certificates_available(), bool)


class GuidedDefaultsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        guide.start(self.root, name='Synthetic installer')

    def event(self, answers):
        revision = guide.state(self.root)['revision']
        return {'actor': 'user', 'message_id': f'm{revision}', 'event_id': f'e{revision}', 'expected_revision': revision,
                'answers': [{'id': key, 'value': value} for key, value in answers.items()]}

    def complete_enquiry(self, **extra):
        storage.write(self.root, 'build/discovery.json', {'schema_version': 1, 'suggestions': [], 'input_fingerprint': guide.research_fingerprint(self.root)})
        guide.discover(self.root)
        guide.answer(self.root, self.event({'service': 'Security doors', 'audience': 'Homeowners', 'region': 'Synthetic city',
                                            'offer': 'Free measure and quote at your home', 'conversion': 'enquire',
                                            'follow_up': 'We call back within one business day', **extra}))

    def test_g1_keywords_are_asked_for_enquiry_pages(self):
        self.complete_enquiry()
        asked = [q['id'] for q in guide.questions(self.root)]
        self.assertIn('keywords', asked)
        guide.answer(self.root, self.event({'keywords': 'security screens synthetic city'}))
        self.assertEqual(guide.config(self.root)['search_intent'], 'security screens synthetic city')

    def test_g2_g3_lead_defaults_include_phone_and_an_offer_led_cta(self):
        self.complete_enquiry(keywords='security doors', phone='0400 000 000')
        config = guide.config(self.root)
        self.assertEqual([field['name'] for field in config['form_fields']], ['name', 'phone', 'email'])
        self.assertEqual(config['cta'], 'Get my free quote')
        self.assertEqual(config['client']['phone_uri'], 'tel:0400000000')
        self.assertEqual(guide.phone_uri('+61 400 000 000'), 'tel:+61400000000')
        self.assertEqual(guide.default_cta({'offer': 'A consultation'}, 'enquire'), 'Request a call back')

    def test_s6_lead_scaffold_reconciles_static_leftovers(self):
        self.complete_enquiry(keywords='security doors')
        q = guide.next_action(self.root)
        guide.approve(self.root, {'actor': 'user', 'message_id': 'ok', 'message': 'Confirmed', 'kind': 'brief',
                                  'expected_revision': q['revision'], 'review_fingerprint': q['review_fingerprint']})
        self.assertEqual(guide.next_action(self.root)['operation'], 'scaffold')
        guide.local(self.root, 'scaffold')
        self.assertEqual(guide.config(self.root)['product_mode'], 'form-crm')
        self.assertIn('lead inbox', (self.root / 'START-HERE.md').read_text())

    def test_b2_claim_performs_local_operations_instead_of_dead_ending(self):
        self.complete_enquiry(keywords='security doors')
        q = guide.next_action(self.root)
        guide.approve(self.root, {'actor': 'user', 'message_id': 'ok', 'message': 'Confirmed', 'kind': 'brief',
                                  'expected_revision': q['revision'], 'review_fingerprint': q['review_fingerprint']})
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/workflow_runner.py'), 'claim', str(self.root)], capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue((self.root / 'src/worker.js').is_file())
        self.assertNotEqual(json.loads(result.stdout).get('operation'), 'scaffold')

    def test_b2_provider_defaults_to_the_running_host(self):
        self.assertEqual(workflow_runner.detect_provider({'CLAUDECODE': '1'}), 'claude')
        self.assertEqual(workflow_runner.detect_provider({'CODEX_HOME': '/x'}), 'codex')


class EvidenceContractTests(unittest.TestCase):
    def test_g11_build_brief_and_ledger_satisfy_the_docs_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'docs').mkdir()
            (root / 'build').mkdir()
            (root / 'docs/RESEARCH-BRIEF.md').write_text('# Research Brief\n\n<!-- WORKFLOW_TEMPLATE_INCOMPLETE: replace -->\n')
            (root / 'build/strategy-brief.md').write_text('# Strategy\n\n' + 'Buyer situation and leading advantage with sources. ' * 6)
            (root / 'build/claim-ledger.md').write_text('| Claim | Source |\n|---|---|\n| Family owned since 2004 | about page excerpt |\n| Ten year warranty | product page excerpt |\n')
            self.assertEqual(process_contract.validate_documents(root, ('RESEARCH-BRIEF.md', 'CLAIM-LEDGER.md')), [])

    def test_s3_workflow_docs_do_not_change_the_rendered_source_fingerprint(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'public').mkdir()
            (root / 'public/index.html').write_text('<h1>Page</h1>')
            (root / 'docs').mkdir()
            (root / 'docs/COPY-GATE-CHECKLIST.md').write_text('first')
            before = check_gates.source_snapshot(root)['source_fingerprint']
            (root / 'docs/COPY-GATE-CHECKLIST.md').write_text('second')
            self.assertEqual(check_gates.source_snapshot(root)['source_fingerprint'], before)
            (root / 'public/index.html').write_text('<h1>Changed</h1>')
            self.assertNotEqual(check_gates.source_snapshot(root)['source_fingerprint'], before)

    def test_s2_placeholder_privacy_page_fails_static_validation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            public = root / 'public'
            public.mkdir()
            for name in ('styles.css', 'script.js'):
                (public / name).write_text('')
            (public / 'index.html').write_text('<main><button data-open-modal>Get my free quote</button></main>')
            (public / 'thank-you.html').write_text('<meta name="robots" content="noindex"><p>Thanks</p>')
            (public / 'privacy.html').write_text('<p>This is a development template. Replace it with the client\'s approved privacy policy.</p>')
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/validate_funnel.py'), str(root)], capture_output=True, text=True)
            self.assertIn('Visible starter/placeholder text in privacy.html', result.stdout)


class RenderedCopyTests(unittest.TestCase):
    def test_b8_metadata_and_delivery_contract_are_not_visible_copy(self):
        master = {'h1': 'Headline', 'primary_cta': 'Get my free quote',
                  'sections': [{'id': 'reviews', 'headline': 'Reviews', 'testimonial': [{'review_id': 'review-001', 'quote': 'Great job'}]}],
                  'modal': {'title': 'Book'}, 'thank_you': {'headline': 'Thanks', 'delivery': 'Download on the thank-you page'}}
        expected = copy_parity.expected_surfaces(master, False)
        keys = {key for rows in expected.values() for key, _ in rows}
        self.assertNotIn('/sections/0/testimonial/0/review_id', keys)
        self.assertNotIn('/thank_you/delivery', keys)

    def test_b8_running_footer_first_on_a_page_does_not_split_paragraphs(self):
        text = 'Brand Name 1\nIntro line\n\fBrand Name 2\nWindow operation so\n\fBrand Name 3\nyou can choose.\n1. Checklist item\n'
        body = copy_parity.normalize(copy_parity.pdf_body(text, 3, ['Brand Name'], ['Brand Name']))
        self.assertIn('window operation so you can choose.', body)
        self.assertNotIn('so brand name', body)
        self.assertEqual(body.count('brand name'), 1, 'The approved footer label is kept once, outside the paragraphs')
        self.assertIn('checklist item', body)
        self.assertNotIn('1. checklist', body)


class ProjectVerifyTests(unittest.TestCase):
    def test_g5_fixture_is_derived_from_funnel_with_fictional_values(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'funnel.json').write_text(json.dumps({'form_fields': [{'name': 'name', 'type': 'text'}, {'name': 'phone', 'type': 'tel'},
                                                                          {'name': 'email', 'type': 'email'}, {'name': 'interest', 'type': 'select', 'options': ['Doors', 'Windows']}],
                                                          'analytics': {'mode': 'disabled', 'attribution_mode': 'lead'}}))
            self.assertTrue(project_verify.ensure_fixture(root))
            fixture = json.loads((root / 'test-fixture.json').read_text())
            self.assertTrue(fixture['synthetic'])
            self.assertTrue(fixture['fields']['email'].endswith('.invalid'))
            self.assertEqual(fixture['fields']['interest'], 'Doors')
            self.assertFalse(project_verify.ensure_fixture(root), 'An existing reviewed fixture is never overwritten')


if __name__ == '__main__':
    unittest.main()
