import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/copy_acceptance.py'
SPEC = importlib.util.spec_from_file_location('copy_acceptance', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CopyAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.copy = 'Accounting support with an agreed scope and fee. Request a consultation.'
        self.brief = 'Small businesses need clarity on price and included work.'
        self.source = 'Synthetic evidence: the provider agrees scope and a fixed fee before work.'
        for name, value in [('copy.md', self.copy), ('brief.md', self.brief), ('source.md', self.source)]:
            (self.root / name).write_text(value)
        self.snapshot = MODULE.prepare(self.root, 'copy.md', 'brief.md', ['source.md'])
        self.save('snapshot.json', self.snapshot)
        self.review = {
            'inputs_sha256': MODULE.digest(self.root / 'snapshot.json'),
            'reviewer': {'mode': 'self_review', 'identity': 'Synthetic unit-test fixture, not an editorial approval'},
            'decision': 'pass', 'unresolved_findings': [],
            'checks': [{'criterion': c, 'verdict': 'pass', 'evidence': {
                'copy_excerpt': self.copy, 'brief_excerpt': self.brief,
                'explanation': 'Synthetic fixture for mechanical validation only.',
                'source_refs': [{'id': 'source1', 'excerpt': self.source}],
            }} for c in sorted(MODULE.CRITERIA)],
            'reader_summary': {k: {'answer': 'Synthetic answer', 'copy_excerpt': self.copy}
                               for k in ('offer', 'buyer_benefit', 'reason_to_choose', 'next_step')},
            'strongest_challenge': {'copy_excerpt': self.copy, 'risk': 'No exclusivity evidence.',
                                    'resolution': 'Positioned as a concrete offer, not exclusive.',
                                    'status': 'accepted_with_reason'},
        }

    def save(self, name, value):
        (self.root / name).write_text(json.dumps(value))

    def verify(self, review=None):
        self.save('review.json', self.review if review is None else review)
        return MODULE.verify(self.root, self.root / 'snapshot.json', self.root / 'review.json')

    def test_current_evidence_passes_with_self_review_disclosure(self):
        result = self.verify()
        self.assertEqual(result['status'], 'pass')
        self.assertIn('self-review', result['warnings'][0])

    def test_each_changed_input_blocks(self):
        for name in ('copy.md', 'brief.md', 'source.md'):
            with self.subTest(name=name):
                path = self.root / name
                old = path.read_text()
                path.write_text(old + ' changed')
                self.assertEqual(self.verify()['status'], 'blocked')
                path.write_text(old)

    def test_snapshot_replacement_invalidates_review(self):
        self.snapshot['note'] = 'changed snapshot'
        self.save('snapshot.json', self.snapshot)
        self.assertEqual(self.verify()['status'], 'blocked')

    def test_missing_or_fabricated_source_excerpt_blocks(self):
        for refs in ([], [{'id': 'source1', 'excerpt': 'Invented guarantee'}],
                     [{'id': 'brief', 'excerpt': self.brief}]):
            changed = copy.deepcopy(self.review)
            next(c for c in changed['checks'] if c['criterion'] == 'claim_support')['evidence']['source_refs'] = refs
            self.assertEqual(self.verify(changed)['status'], 'blocked')

    def test_quoted_instruction_is_not_a_quote_from_copy(self):
        self.review['checks'][0]['evidence']['copy_excerpt'] = 'Verify every claim'
        self.assertEqual(self.verify()['status'], 'blocked')

    def test_missing_reader_reason_to_choose_blocks(self):
        del self.review['reader_summary']['reason_to_choose']
        self.assertEqual(self.verify()['status'], 'blocked')

    def test_weak_copy_flagged_by_editorial_reviewer_stays_blocked(self):
        self.review['checks'][0]['verdict'] = 'fail'
        self.review['checks'][0]['evidence']['explanation'] = 'This claim implies a result the evidence does not establish.'
        self.assertEqual(self.verify()['status'], 'blocked')

    def test_unresolved_findings_and_challenge_block(self):
        for key, value in [('unresolved_findings', ['Unverified savings']), ('strongest_challenge', {}), ('decision', 'blocked')]:
            changed = copy.deepcopy(self.review)
            changed[key] = value
            self.assertEqual(self.verify(changed)['status'], 'blocked')

    def test_duplicate_criteria_block(self):
        self.review['checks'][0] = self.review['checks'][1]
        self.assertEqual(self.verify()['status'], 'blocked')

    def test_outside_and_duplicate_input_paths_rejected(self):
        for path in ('../outside.md', str(self.root / 'copy.md')):
            with self.assertRaises(ValueError):
                MODULE.prepare(self.root, path, 'brief.md', ['source.md'])
        with self.assertRaises(ValueError):
            MODULE.prepare(self.root, 'copy.md', 'brief.md', ['copy.md'])

    def test_json_copy_uses_decoded_words_not_metadata(self):
        self.save('copy.json', {'h1': 'A clear "fixed fee"', 'notes': 'private research note'})
        self.assertIn('A clear "fixed fee"', MODULE.text(self.root / 'copy.json'))
        self.assertNotIn('private research note', MODULE.text(self.root / 'copy.json'))

    def test_relocated_unchanged_project_still_passes(self):
        import shutil
        with tempfile.TemporaryDirectory() as destination:
            target = Path(destination) / 'project'
            self.save('review.json', self.review)
            shutil.copytree(self.root, target)
            self.assertEqual(MODULE.verify(target.resolve(), target / 'snapshot.json', target / 'review.json')['status'], 'pass')

    def test_structured_audit_requires_and_reuses_the_same_acceptance_review(self):
        spec = importlib.util.spec_from_file_location('copy_library_review_test', SCRIPT.with_name('copy_library.py'))
        library = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(library)
        (self.root / 'build').mkdir()
        draft = {'h1': self.copy, 'primary_cta': 'Request a consultation',
                 'sections': [{'id': 'hero', 'headline': 'Accounting support', 'body': self.copy}]}
        brief = {'client_name': 'Synthetic', 'primary_cta': draft['primary_cta'],
                 'follow_up_promise': '', 'output_mode': 'copy_only', 'claims': []}
        self.save('build/page-copy.json', draft)
        self.save('build/client-copy-brief.json', brief)
        context = {'brief_sha256': MODULE.digest(self.root / 'build/client-copy-brief.json'),
                   'editorial_contract_version': 2}
        self.save('build/copy-context.json', context)
        self.review.update({
            'copy_sha256': MODULE.digest(self.root / 'build/page-copy.json'),
            'brief_sha256': MODULE.digest(self.root / 'build/client-copy-brief.json'),
            'context_sha256': MODULE.digest(self.root / 'build/copy-context.json'),
        })
        paths = [self.root / 'build' / name for name in
                 ('page-copy.json', 'client-copy-brief.json', 'copy-context.json', 'copy-editorial-review.json')]
        self.save('build/copy-editorial-review.json', self.review)
        self.assertEqual(library.audit(*paths)['overall_status'], 'blocked')
        snapshot = MODULE.prepare(self.root, 'build/page-copy.json', 'brief.md', ['source.md'])
        self.save('build/copy-review-inputs.json', snapshot)
        self.review['inputs_sha256'] = MODULE.digest(self.root / 'build/copy-review-inputs.json')
        self.save('build/copy-editorial-review.json', self.review)
        self.assertEqual(library.audit(*paths)['overall_status'], 'pass')
        snapshot['inputs']['copy']['path'] = 'copy.md'
        snapshot['inputs']['copy']['sha256'] = MODULE.digest(self.root / 'copy.md')
        self.save('build/copy-review-inputs.json', snapshot)
        self.review['inputs_sha256'] = MODULE.digest(self.root / 'build/copy-review-inputs.json')
        self.save('build/copy-editorial-review.json', self.review)
        self.assertIn('different draft', '\n'.join(library.audit(*paths)['editorial_requirements']))

    def test_prepared_writer_context_enables_the_new_gate(self):
        spec = importlib.util.spec_from_file_location('copy_library_prepare_test', SCRIPT.with_name('copy_library.py'))
        library = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(library)
        (self.root / 'build').mkdir()
        brief = {key: 'Synthetic bookkeeping' for key in
                 ('client_name', 'service', 'audience', 'sector', 'offer_type', 'intent')}
        brief.update(primary_cta='Request a consultation', follow_up_promise='', claims=[])
        self.save('build/client-copy-brief.json', brief)
        output = self.root / 'build/copy-context.json'
        library.prepare(library.DEFAULT, self.root / 'build/client-copy-brief.json', output, 1)
        self.assertEqual(MODULE.read(output)['editorial_contract_version'], 2)

    def test_modal_submit_label_uses_explicit_brief_value_or_primary_cta_fallback(self):
        spec = importlib.util.spec_from_file_location('copy_library_submit_test', SCRIPT.with_name('copy_library.py'))
        library = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(library)
        (self.root / 'build').mkdir()
        draft = {
            'h1': 'Synthetic accounting support',
            'primary_cta': 'Try the consultation form',
            'sections': [{'id': 'hero', 'headline': 'Accounting support', 'body': self.copy}],
            'modal': {'submit_label': 'Save demo request', 'follow_up_promise': ''},
        }
        brief = {
            'client_name': 'Synthetic', 'primary_cta': draft['primary_cta'],
            'form_submit_label': 'Save demo request', 'follow_up_promise': '',
            'output_mode': 'copy_only', 'claims': [],
        }
        self.save('build/page-copy.json', draft)
        self.save('build/client-copy-brief.json', brief)
        self.save('build/copy-context.json', {
            'brief_sha256': MODULE.digest(self.root / 'build/client-copy-brief.json'),
            'editorial_contract_version': 2,
        })
        paths = [self.root / 'build' / name for name in
                 ('page-copy.json', 'client-copy-brief.json', 'copy-context.json')]
        self.assertNotIn('Modal submit label', '\n'.join(library.audit(*paths)['failures']))

        draft['modal']['submit_label'] = 'Different submit action'
        self.save('build/page-copy.json', draft)
        self.assertIn('Modal submit label differs from brief form_submit_label', library.audit(*paths)['failures'])

        brief.pop('form_submit_label')
        self.save('build/client-copy-brief.json', brief)
        self.save('build/copy-context.json', {
            'brief_sha256': MODULE.digest(self.root / 'build/client-copy-brief.json'),
            'editorial_contract_version': 2,
        })
        self.assertIn('Modal submit label differs from primary CTA', library.audit(*paths)['failures'])


if __name__ == '__main__':
    unittest.main()
