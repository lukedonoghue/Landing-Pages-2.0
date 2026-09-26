import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import portable_handoff
import workflow


COPY = {
    'h1': 'Roof inspections near Denver, booked this week',
    'primary_cta': 'Get my free quote',
    'sections': [
        {'id': 'benefits', 'headline': 'Why owners call us', 'body': 'Clear photos of every issue.', 'claim_ids': ['c1']},
        {'id': 'faq', 'questions': [{'question': 'How long?', 'answer': 'About an hour.'}]},
    ],
    'modal': {'submit_label': 'Send my request', 'failure': 'Please try again.'},
    'thank_you': {'headline': 'Request received', 'body': 'We will call you today.'},
}


class PassageApprovalTest(unittest.TestCase):
    """Owners re-approve only changed passages; metadata edits never need re-approval."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'build').mkdir()
        self.contract = {'offer': 'Free roof inspection'}
        self.write(COPY)
        patcher = mock.patch.object(workflow, 'copy_state', self.state)
        patcher.start()
        self.addCleanup(patcher.stop)

    def write(self, copy):
        (self.root / 'build/page-copy.json').write_text(json.dumps(copy, indent=2))

    def state(self, root):
        copy = hashlib.sha256((root / 'build/page-copy.json').read_bytes()).hexdigest()
        fingerprint = hashlib.sha256(json.dumps({'copy': copy, 'contract': self.contract}, sort_keys=True).encode()).hexdigest()
        return {'status': 'pass', 'failures': [], 'fingerprint': fingerprint, 'passages': workflow.copy_passages(root, self.contract)}

    def edited(self, change):
        copy = json.loads(json.dumps(COPY))
        change(copy)
        self.write(copy)

    def test_passages_cover_every_customer_facing_part(self):
        self.assertEqual(sorted(workflow.copy_passages(self.root, self.contract)),
                         ['contract', 'hero', 'modal', 'section:benefits', 'section:faq', 'thank_you'])

    def test_only_changed_passages_need_reapproval(self):
        first = workflow.check_copy_approval(self.root)
        self.assertEqual(first['status'], 'blocked')
        self.assertIn('complete current copy', first['failures'][0])
        workflow.record(self.root, 'copy', 'I approve this copy.', 'msg-1')
        self.assertEqual(workflow.check_copy_approval(self.root)['status'], 'pass')

        self.edited(lambda copy: copy['sections'][0].update(claim_ids=['c1', 'c2'], notes='tightened'))
        metadata = workflow.check_copy_approval(self.root)
        self.assertEqual(metadata['status'], 'pass', 'Metadata is not approvable text')
        self.assertEqual(metadata['changed_passages'], [])

        self.edited(lambda copy: copy['sections'][0].update(body='Clear photos and a written report.'))
        changed = workflow.check_copy_approval(self.root)
        self.assertEqual(changed['status'], 'blocked')
        self.assertEqual(changed['changed_passages'], ['section:benefits'])
        self.assertIn('section:benefits', changed['failures'][0])

        workflow.record(self.root, 'copy', 'I approve the changed passage.', 'msg-2')
        self.assertEqual(workflow.check_copy_approval(self.root)['status'], 'pass')

    def test_removed_sections_contract_changes_and_fixture_actor(self):
        workflow.record(self.root, 'copy', 'I approve this copy.', 'msg-1')
        self.edited(lambda copy: copy['sections'].pop())
        self.contract = {'offer': 'Free roof and gutter inspection'}
        self.assertEqual(workflow.check_copy_approval(self.root)['changed_passages'], ['contract', 'removed:section:faq'])
        workflow.record(self.root, 'copy', 'Automated check', 'fixture-1', fixture=True)
        self.assertIn('real user copy approval', ' '.join(workflow.check_copy_approval(self.root)['failures']))

    def test_changed_copy_drops_publish_approval_and_passages_survive_export(self):
        workflow.record(self.root, 'copy', 'I approve this copy.', 'msg-1')
        state = workflow.load(self.root)
        state['approvals']['publish'] = {'actor': 'user', 'fingerprint': 'old'}
        workflow.save(self.root, state)
        self.edited(lambda copy: copy.update(h1='Roof inspections in Denver, this week'))
        workflow.record(self.root, 'copy', 'I approve the new headline.', 'msg-2')
        approvals = workflow.load(self.root)['approvals']
        self.assertNotIn('publish', approvals)
        exported = json.loads(portable_handoff.sanitize_workflow((self.root / 'build/workflow.json').read_bytes()))
        self.assertEqual(exported['approvals']['copy']['passages'], approvals['copy']['passages'])

    def test_markdown_copy_is_split_by_heading(self):
        (self.root / 'funnel.json').write_text(json.dumps({'backend': {'provider': 'none'}, 'guided_workflow': {'copy_format': 'markdown'}}))
        (self.root / 'build/page-copy.md').write_text('# Headline\nRoof inspections\n\n## FAQ\nHow long?\n\n## FAQ\nWho comes?\n')
        self.assertEqual(sorted(workflow.copy_passages(self.root, self.contract)), ['contract', 'faq', 'faq-2', 'headline'])


if __name__ == '__main__':
    unittest.main()
