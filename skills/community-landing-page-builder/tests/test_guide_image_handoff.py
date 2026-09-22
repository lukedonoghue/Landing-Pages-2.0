"""Native handoff tests use explicit synthetic tool evidence; no model/provider calls."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL/'scripts'))
import guide_image_handoff as handoff
import image_workflow as images
import workflow_storage as storage
import workflow_runner as runner


class GuideImageHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'research').mkdir();(self.root/'build').mkdir()
        storage.write(self.root, 'funnel.json', {'client': {'name': 'Synthetic Co'}, 'offer': 'Synthetic planning'})
        storage.write(self.root, 'build/guide.json', {'title': 'Synthetic buyer guide', 'chapters': [{'id': 'choices'}], 'images': []})
        self.plan = json.loads((SKILL/'assets/image-plan.example.json').read_text())
        self.plan['assets'] = [self.plan['assets'][1]]
        storage.write(self.root, 'image-plan.json', self.plan)
        self.asset = self.plan['assets'][0]['id']
        self.prompt = 'Show a clearly labelled conceptual comparison of planning options.'
        self.reason = 'The supplied website has no usable explanatory comparison image.'

    def request(self):
        return handoff.request(self.root, self.asset, 'cover', self.prompt, self.reason)

    def register(self, packet):
        output = self.root/'research/synthetic-output.png'
        Image.new('RGB', (900, 600), '#467c81').save(output)
        evidence = self.root/'research/synthetic-tool-result.json'
        evidence.write_text(json.dumps({'scope': 'synthetic test, no real generation', 'output_sha256': images.sha(output.read_bytes())}))
        plan = images.load_plan(self.root/'image-plan.json')
        images.register_generation(plan, self.root, self.asset, packet['attempt_id'], output, evidence)
        images.save_plan(self.root/'image-plan.json', plan, 'synthetic-registration', self.asset)

    def test_repeated_resume_reuses_request_and_does_not_spend_new_attempt(self):
        first = self.request()
        for _ in range(5):
            self.assertEqual(self.request()['attempt_id'], first['attempt_id'])
            self.assertEqual(handoff.inspect(self.root)['kind'], 'image_handoff')
        self.assertEqual(len(images.load_plan(self.root/'image-plan.json')['generation_attempts']), 1)
        with patch.object(runner.guide, 'next_action', return_value=first), patch.object(runner, 'native_execute') as execute:
            self.assertEqual(runner.drive(self.root)['kind'], 'image_handoff')
            execute.assert_not_called()

    def test_registration_link_and_resume_preserve_actual_bytes(self):
        first = self.request();self.register(first)
        self.assertEqual(handoff.inspect(self.root)['kind'], 'work')
        row = handoff.link(self.root, 'Illustration of two conceptual planning choices.')
        self.assertEqual(row['source_type'], 'generated')
        self.assertEqual(row['sha256'], images.sha((self.root/row['path']).read_bytes()))
        self.assertIsNone(handoff.inspect(self.root))
        self.assertEqual(handoff.link(self.root, row['caption']), row)
        self.assertEqual(len(storage.read(self.root, 'build/guide.json')['images']), 1)

    def test_unexecuted_missing_or_stale_output_is_not_complete(self):
        first = self.request()
        with self.assertRaisesRegex(ValueError, 'Register the real'):handoff.link(self.root, 'Illustration of planning choices.')
        self.register(first)
        plan = images.load_plan(self.root/'image-plan.json')
        (self.root/plan['assets'][0]['source']['path']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'Artifact changed'):handoff.link(self.root, 'Illustration of planning choices.')

    def test_business_or_prompt_change_requires_reconciliation(self):
        self.request()
        with self.assertRaisesRegex(ValueError, 'Reconcile'):handoff.request(self.root, self.asset, 'cover', self.prompt+' Changed', self.reason)
        value = storage.read(self.root, 'funnel.json');value['offer'] = 'A different offer';storage.write(self.root, 'funnel.json', value)
        self.assertEqual(handoff.inspect(self.root)['kind'], 'reconcile')

    def test_never_generate_proof_or_require_api_billing(self):
        for key, value in [('trust_class', 'client-proof'), ('generation', {'mode': 'bundled-cli'})]:
            plan = copy.deepcopy(self.plan);plan['assets'][0][key] = value
            storage.write(self.root, 'image-plan.json', plan)
            with self.assertRaises(ValueError):self.request()
        self.assertFalse((self.root/handoff.RECORD).exists())

    def test_existing_guide_art_cannot_be_overwritten(self):
        first = self.request();self.register(first)
        data = storage.read(self.root, 'build/guide.json');data['images'] = [{'id': 'owner-image', 'placement': 'cover'}]
        storage.write(self.root, 'build/guide.json', data)
        with self.assertRaisesRegex(ValueError, 'authored image'):handoff.link(self.root, 'Illustration of planning choices.')

    def test_source_fallback_requires_explicit_reconciliation_and_real_acquisition(self):
        self.request()
        with self.assertRaisesRegex(ValueError, 'no generation is running'):handoff.use_source(self.root, self.asset, 'A permitted source illustration.')
        plan = images.load_plan(self.root/'image-plan.json')
        output = self.root/'research/supplied.png';Image.new('RGB', (900,600), '#345678').save(output)
        evidence = self.root/'research/supplied.txt';evidence.write_text('Synthetic owner supplied this exact illustration for reuse.')
        source = images.stored_image(self.root, 'research/image-originals', self.asset, output.read_bytes())
        plan['assets'][0].update(source=source, provenance={'kind':'actual','rights':'client-provided','rights_evidence':'Synthetic supplied-use instruction','evidence':images.artifact(self.root,evidence)})
        images.save_plan(self.root/'image-plan.json',plan,'synthetic-acquisition',self.asset)
        row = handoff.use_source(self.root,self.asset,'A supplied comparison of planning choices.',True)
        self.assertEqual(row['source_type'],'supplied')
        self.assertIsNone(handoff.inspect(self.root))
        self.assertEqual(images.load_plan(self.root/'image-plan.json')['generation_attempts'][0]['status'],'failed')

    def test_helpers_are_portable_and_handoff_is_a_permitted_output(self):
        import guide
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)/'project';guide.start(root, name='Synthetic client')
            self.assertTrue((root/'scripts/guide_image_handoff.py').exists())
            self.assertTrue((root/'references/review-manifest.example.json').exists())
        self.assertTrue(runner.allowed(handoff.RECORD))
        self.assertFalse(runner.allowed('scripts/guide_image_handoff.py'))

if __name__ == '__main__':unittest.main()
