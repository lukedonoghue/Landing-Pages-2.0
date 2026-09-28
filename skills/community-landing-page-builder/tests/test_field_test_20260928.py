"""Regressions for the 28 September 2026 two-run field test (Bear Plumbing).

The named tests follow the report's section 9. Two of its named tests live beside
the code they cover: test_copy_surface_scan_precedes_approval
(test_copy_approval_passages.py) and test_chat_preview_isolated_assets
(test_self_contained_preview.py).
"""
from pathlib import Path
import json
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import guide_quality  # noqa: E402
import image_workflow as images  # noqa: E402
import validate_funnel  # noqa: E402
import visual_direction  # noqa: E402
import workflow  # noqa: E402

GALLERY = 'https://bearplumbing.example/gallery/bathroom-1.jpg'


class Project(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        (self.root / 'research').mkdir()
        (self.root / 'build').mkdir()
        (self.root / 'research/gallery.html').write_text(f'<img src="{GALLERY}">')
        self.plan = {'schema_version': 2, 'allowed_hosts': ['bearplumbing.example'], 'client_website': 'https://bearplumbing.example',
                     'inventory': [{'id': 'source-gallery', 'source_url': GALLERY, 'origin': 'client-website',
                                    'evidence': images.artifact(self.root, self.root / 'research/gallery.html')}],
                     'assets': [{'id': 'bathroom-proof', 'trust_class': 'client-proof', 'stage': 'planned'},
                                *[{'id': f'service-illustration-{n}', 'trust_class': 'illustrative', 'stage': 'reviewed'} for n in range(4)]]}

    def record(self, name, value):
        path = self.root / 'research' / name
        path.write_text(json.dumps(value))
        return 'research/' + name


class ImageProofTests(Project):
    def test_agent_created_file_not_client_supplied(self):
        import struct, zlib
        chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)
        drawing = self.root / 'drawing.png'
        drawing.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 64, 48, 8, 2, 0, 0, 0))
                            + chunk(b'IDAT', zlib.compress((b'\0' + bytes((40, 90, 160)) * 64) * 48)) + chunk(b'IEND', b''))
        note = self.root / 'research/illustration-provenance.txt'
        note.write_text('Created from scratch in this project by the builder.')
        entry = images.inventory_file(self.plan, self.root, drawing, 'agent_created', note)
        self.assertEqual((entry['origin'], entry['authority']), ('agent-created', 'agent_created'))
        self.plan['inventory'].pop()
        with self.assertRaisesRegex(images.WorkflowError, 'authority record file'):
            images.inventory_file(self.plan, self.root, drawing, 'user_attachment', note)

    def test_client_authorized_requires_owner_receipt(self):
        with self.assertRaisesRegex(images.WorkflowError, 'not a sentence'):
            images.check_rights(self.root, 'client-authorized', 'Client authorized website reuse in the brief')
        upload = self.record('upload.json', {'kind': 'user_attachment', 'message_id': 'msg-1', 'files': []})
        with self.assertRaisesRegex(images.WorkflowError, 'must have kind'):
            images.check_rights(self.root, 'client-authorized', upload)
        owner = self.record('owner.json', {'kind': 'owner_authorization', 'message_id': 'msg-2', 'statement': 'Use the photos on my website.'})
        images.check_rights(self.root, 'client-authorized', owner)
        images.check_rights(self.root, 'local-preview-only', 'Not yet authorized; local preview only')

    def test_first_party_candidate_needs_disposition(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        self.assertTrue(any('no disposition' in e for e in images.proof_role(self.plan, self.root)['errors']))
        # Research that names a photo binds the plan to it.
        (self.root / 'build/research-acceptance.json').write_text(json.dumps({'first_party_image_attempts': [
            {'source_url': GALLERY}, {'source_url': 'https://bearplumbing.example/gallery/heater.jpg'}]}))
        (self.root / 'docs').mkdir()
        (self.root / 'docs/IMAGE-RESEARCH.md').write_text('Preferred proof: https://bearplumbing.example/gallery/softener.webp')
        missing = images.research_binding_errors(self.plan, self.root)
        self.assertEqual(len(missing), 2)
        self.assertTrue(any('heater.jpg' in e for e in missing) and any('softener.webp' in e for e in missing))

    def test_unavailable_candidate_needs_attempt_receipt(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        candidate = self.plan['proof_candidates'][0]
        candidate['disposition'] = 'acquisition-failed'  # a narrative claim, with no attempt
        self.assertTrue(images.proof_role(self.plan, self.root)['errors'])
        candidate['disposition'] = None
        owner = self.record('owner.json', {'kind': 'owner_authorization', 'message_id': 'msg-2'})

        def refused(url, hosts):
            raise images.WorkflowError('Image request failed with HTTP 403')
        with self.assertRaises(images.WorkflowError):
            images.acquire(self.plan, self.root, 'bathroom-proof', 'source-gallery', 'client-authorized', owner, 'Bathroom job', fetcher=refused)
        self.assertEqual(candidate['disposition'], 'acquisition-failed')
        receipt = json.loads((self.root / candidate['receipt']['path']).read_text())
        self.assertEqual((receipt['candidate_id'], receipt['source_url'], receipt['error_class']), ('source-gallery', GALLERY, 'http-403'))
        self.assertEqual(images.proof_role(self.plan, self.root)['errors'], [])
        # A host that was never allowed is a configuration gap, not a failed download.
        def blocked(url, hosts):
            raise images.WorkflowError('Image host is not allowlisted: cdn.example')
        with self.assertRaises(images.WorkflowError):
            images.acquire(self.plan, self.root, 'bathroom-proof', 'source-gallery', 'client-authorized', owner, 'Bathroom job', fetcher=blocked)
        self.assertTrue(any('add it to allowed_hosts' in e for e in images.proof_role(self.plan, self.root)['errors']))
        # No download tool is its own honest state: unresolved, never a failed attempt.
        capability = self.root / 'research/capability.txt'
        capability.write_text('This sandbox has no outbound network access for file downloads.')
        images.dispose(self.plan, self.root, 'source-gallery', 'no-download-tool', 'The sandbox cannot download files; ask the owner to attach them.', capability)
        role = images.proof_role(self.plan, self.root)
        self.assertEqual((role['errors'], role['unresolved'], role['status']), ([], ['source-gallery'], 'unresolved'))

    def test_image_count_does_not_close_proof_gap(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        role = images.proof_role(self.plan, self.root)
        self.assertEqual(role['status'], 'unresolved', 'Four illustrations do not resolve a known proof candidate')
        candidate = self.plan['proof_candidates'][0]
        candidate.update(disposition='used', asset_id='service-illustration-0')
        self.plan['assets'][1]['provenance'] = {'candidate_id': 'source-gallery'}
        self.assertTrue(any('must carry the proof role' in e for e in images.proof_role(self.plan, self.root)['errors']))

    def test_image_reviews_require_asset_specific_capture(self):
        shared = {'desktop': {'element_evidence': {'sha256': 'a' * 64}}, 'mobile': {'element_evidence': {'sha256': 'b' * 64}}}
        for asset in self.plan['assets'][1:3]:
            asset['review'] = {'result': shared}
        self.assertEqual(len(images.reused_element_captures(self.plan)), 2)

    def test_used_proof_must_be_on_the_page(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        self.plan['proof_candidates'][0].update(disposition='used', asset_id='bathroom-proof')
        self.plan['assets'][0]['variants'] = [{'path': 'public/assets/images/bathroom-960.webp'}]
        (self.root / 'public').mkdir()
        (self.root / 'public/index.html').write_text('<img src="/assets/images/other.webp">')
        self.assertTrue(images.rendered_proof_errors(self.plan, self.root))
        (self.root / 'public/index.html').write_text('<img src="/assets/images/bathroom-960.webp">')
        self.assertEqual(images.rendered_proof_errors(self.plan, self.root), [])


class CategoryFitTests(Project):
    FIT = {'category': 'residential plumbing', 'target_buyer': 'Lancaster homeowners with a repair to arrange',
           'reads_as_category_without_brand': True, 'first_party_proof': 'none_available',
           'reasoning': 'Without the name, the plumbing photos, palette and service words still read as a local plumber.',
           'media_strategy': 'Job photos lead; one realistic illustration supports the process.'}

    def test_local_trade_category_fit_required(self):
        (self.root / 'funnel.json').write_text(json.dumps({'business': {'archetype': 'local_trade'}}))
        self.assertTrue(visual_direction.category_fit_errors(self.root, {}, 'self_review'))
        self.assertEqual(visual_direction.category_fit_errors(self.root, {'category_fit': self.FIT}, 'self_review'), [])
        wrong = {**self.FIT, 'reads_as_category_without_brand': False}
        self.assertTrue(any('does not yet read as' in e for e in visual_direction.category_fit_errors(self.root, {'category_fit': wrong}, 'self_review')))
        # The design abandoned known job photos and the builder reviewed itself: owner sign-off is required.
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        note = self.root / 'research/unsuitable.txt'
        note.write_text('Inspected crop: the photo is 240px wide and blurred.')
        images.dispose(self.plan, self.root, 'source-gallery', 'unsuitable', 'Only 240px wide and blurred at every planned crop.', note)
        (self.root / 'image-plan.json').write_text(json.dumps(self.plan))
        self.assertTrue(any('owner_visual_signoff' in e for e in visual_direction.category_fit_errors(self.root, {'category_fit': self.FIT}, 'self_review')))
        signed = {**self.FIT, 'owner_visual_signoff': {'message_id': 'msg-9', 'statement': 'I like this direction, go ahead.'}}
        self.assertEqual(visual_direction.category_fit_errors(self.root, {'category_fit': signed}, 'self_review'), [])

    def test_comparison_records_media_strategy_separately(self):
        (self.root / 'funnel.json').write_text(json.dumps({'business': {'archetype': 'local_trade'}}))
        self.assertTrue(visual_direction.media_strategy_errors(self.root, {}))
        self.assertEqual(visual_direction.media_strategy_errors(self.root, {'media_strategy': {
            'first_party_proof': 'Bathroom and heater job photos lead the hero and services.',
            'photo_vs_illustration_fit': 'Photos for proof; illustration only in the process steps.',
            'category_authenticity': 'Reads as a local plumbing business without the logo.'}}), [])


class FormBehaviorTests(Project):
    PAGE = ('<!doctype html><html><head><script src="funnel.js" defer></script><script src="script.js" defer></script></head><body>'
            '<form><input name="phone" type="tel" required><select name="reason" required><option value="">Choose one</option><option>New project</option></select></form></body></html>')
    THANKS = '<!doctype html><html><head><script src="/funnel.js"></script><script src="/confirmation.js"></script></head><body><p data-confirmed-only hidden>Done</p><a data-guide-download href="/g.pdf">Download</a></body></html>'

    def failures(self, page=PAGE, thanks=THANKS, funnel=None):
        (self.root / 'src').mkdir(exist_ok=True)
        (self.root / 'src/site-config.json').write_text('{}')
        (self.root / 'funnel.json').write_text(json.dumps(funnel or {'form_fields': []}))
        return validate_funnel.form_behavior_failures(self.root, page, thanks, True)

    def test_well_formed_page_passes(self):
        self.assertEqual(self.failures(), [])

    def test_phone_pattern_must_count_digits(self):
        page = self.PAGE.replace('type="tel"', 'type="tel" pattern="[+0-9\\(\\) .\\-]{7,40}"')
        self.assertTrue(any("accepts '-------'" in f for f in self.failures(page)))

    def test_required_select_default_must_be_declared(self):
        page = self.PAGE.replace('<option value="">Choose one</option>', '')
        self.assertTrue(any('preselects' in f for f in self.failures(page)))
        self.assertEqual(self.failures(page, funnel={'form_fields': [{'name': 'reason', 'default': 'New project'}]}), [])

    def test_confirmation_does_not_reopen_the_enquiry(self):
        thanks = self.THANKS.replace('</body>', '<button data-open-modal>Request a call back</button><form></form></body>')
        self.assertTrue(any('still offers the enquiry' in f for f in self.failures(thanks=thanks)))

    def test_runtime_loads_before_the_form_script(self):
        page = self.PAGE.replace('<script src="funnel.js" defer></script>', '')
        self.assertTrue(any('must load funnel.js before script.js' in f for f in self.failures(page)))
        thanks = self.THANKS.replace('<script src="/confirmation.js"></script>', '')
        self.assertTrue(any('confirmation.js' in f for f in self.failures(thanks=thanks)))


class DocumentStructureTests(Project):
    def test_repeated_document_declaration_fails_static_validation(self):
        import subprocess
        public = self.root / 'public'
        public.mkdir()
        for name, body in (('index.html', '<!doctype html><html><body><main><div role="dialog" id="lead-modal"><form action="/thank-you.html"></form></div><button data-open-modal>Go</button></main></body></html>'),
                           ('thank-you.html', '<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Thanks</body></html>'),
                           ('styles.css', ''), ('script.js', 'Escape')):
            (public / name).write_text(body)
        run = lambda: json.loads(subprocess.run([sys.executable, str(SKILL / 'scripts/validate_funnel.py'), str(self.root)], capture_output=True, text=True).stdout)
        self.assertFalse(any('well-formed document' in f for f in run()['failures']))
        (public / 'thank-you.html').write_text('<!DOCTYPE html>\n' + (public / 'thank-you.html').read_text())
        self.assertTrue(any('thank-you.html must be one well-formed document' in f for f in run()['failures']))


class WorkflowTests(unittest.TestCase):
    def test_guided_mode_always_requires_copy_approval(self):
        self.assertTrue(workflow.copy_approval_required({'guided_workflow': {'mode': 'guided'}, 'approvals': {'copy_before_design': False}}))
        self.assertFalse(workflow.copy_approval_required({'guided_workflow': {'mode': 'automatic'}, 'approvals': {'copy_before_design': False}}))

    def test_guide_research_narration_is_rejected(self):
        found = guide_quality.research_narration(
            'Bear Plumbing lists water treatment. No round-the-clock or immediate attendance is promised by this page.', 'Bear Plumbing')
        self.assertEqual(found, ['is promised by this page', 'Bear Plumbing lists'])
        self.assertEqual(guide_quality.research_narration('Ask which tasks are included before you agree a visit.', 'Bear Plumbing'), [])


if __name__ == '__main__':
    unittest.main()
