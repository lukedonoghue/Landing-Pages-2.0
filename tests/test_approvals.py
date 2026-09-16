"""Approval protocol regression fixtures; none authorizes a real publication."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
import test_library as fixtures
m = fixtures.m

SKILL=Path(__file__).resolve().parents[1]/'skills/branded-lead-funnel-builder'
sys.path.insert(0,str(SKILL/'scripts'))
import workflow

class ApprovalTests(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.LibraryTests();self.fixture.setUp();self.root=self.fixture.root
        # Map the copy regression fixture to the production workflow's canonical names.
        source={'copy':self.fixture.c,'brief':self.fixture.b,'context':self.fixture.ctx,'review':self.fixture.r}
        self.fixture.review()
        for key,relative in workflow.COPY_FILES.items():
            (self.root/relative).write_bytes(source[key].read_bytes())
        self.paths={key:self.root/relative for key,relative in workflow.COPY_FILES.items()}
        brief=json.loads(self.paths['brief'].read_text())
        (self.root/'funnel.json').write_text(json.dumps({'cta':brief['primary_cta'],'follow_up_promise':brief['follow_up_promise'],'quality':{'complete_workflow':True},'catalogue':{'enabled':False},'images':{'enabled':False}}))
        m.prepare(SKILL/'references/copy-library',self.paths['brief'],self.paths['context'],3)
        review=json.loads(self.paths['review'].read_text())
        review.update(copy_sha256=m.sha(self.paths['copy']),brief_sha256=m.sha(self.paths['brief']),context_sha256=m.sha(self.paths['context']))
        self.paths['review'].write_text(json.dumps(review))
    def tearDown(self):self.fixture.tearDown()
    def test_editorial_pass_is_not_user_approval(self):
        self.assertNotEqual(workflow.copy_state(self.root)['status'],'blocked')
        self.assertEqual(workflow.check_copy_approval(self.root)['status'],'blocked')
    def test_copy_approval_records_exact_revision(self):
        workflow.record(self.root,'copy','Synthetic approved copy','test-only-message')
        self.assertNotEqual(workflow.check_copy_approval(self.root)['status'],'blocked')
        copy=json.loads(self.paths['copy'].read_text());copy['h1']='Changed wording';self.paths['copy'].write_text(json.dumps(copy))
        self.assertEqual(workflow.check_copy_approval(self.root)['status'],'blocked')
    def test_fixture_approval_cannot_authorize_live_work(self):
        workflow.record(self.root,'copy','Synthetic local protocol fixture','test-only',fixture=True)
        self.assertNotEqual(workflow.check_copy_approval(self.root,allow_fixture=True)['status'],'blocked')
        self.assertEqual(workflow.check_copy_approval(self.root)['status'],'blocked')
        self.assertEqual(workflow.check_publish_approval(self.root)['status'],'blocked')
    def test_publish_requires_current_final_quality_evidence(self):
        workflow.record(self.root,'copy','Synthetic approved copy','test-only')
        with self.assertRaises(ValueError):workflow.record(self.root,'publish','Synthetic publish','test-only')
    def test_missing_approval_message_is_rejected(self):
        with self.assertRaises(ValueError):workflow.record(self.root,'copy','','test-only')
    def test_fixture_publish_is_always_rejected(self):
        with self.assertRaises(ValueError):workflow.record(self.root,'publish','Synthetic fixture','test-only',fixture=True)

if __name__=='__main__':unittest.main()
