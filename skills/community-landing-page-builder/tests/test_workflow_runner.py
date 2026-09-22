"""Actual SQLite loop/lease/journal tests with a synthetic, non-network worker."""
import base64
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL=Path(__file__).resolve().parents[1];sys.path.insert(0,str(SKILL/'scripts'))
import guide
import workflow_runner as runner
import native_routing as routing
import workflow_storage as storage


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);guide.start(self.root,name='Synthetic business')
    def worker(self,root,packet,route):
        storage.write(root,'build/discovery.json',{'input_fingerprint':guide.research_fingerprint(root),'suggestions':[]})
        return {'status':'done','summary':'Produced synthetic discovery with no fabricated facts.','outputs':['build/discovery.json'],'blockers':[]}
    def test_success_immediately_dispatches_local_next_then_asks_question(self):
        result=runner.drive(self.root,executor=self.worker)
        self.assertEqual(result['kind'],'question');self.assertIsNotNone(guide.state(self.root)['discovery_applied'])
        with routing.database(self.root) as (_,state):
            self.assertEqual(len(state['tasks']),1);task=next(iter(state['tasks'].values()));self.assertEqual(task['status'],'done')
            self.assertEqual(state['continuation']['status'],'pending')
    def test_done_without_outputs_does_not_advance_and_stops(self):
        calls=[]
        def liar(*args):calls.append(1);return {'status':'done','summary':'A claimed completion without artifacts','outputs':[],'blockers':[]}
        with self.assertRaisesRegex(ValueError,'budget exhausted'):runner.drive(self.root,executor=liar)
        self.assertEqual(len(calls),2);self.assertEqual(guide.next_action(self.root)['stage'],'research')
    def test_duplicate_claim_and_late_completion_are_rejected(self):
        action=guide.next_action(self.root);name,token,work,route=runner.begin(self.root,action,'synthetic')
        with self.assertRaises(ValueError):runner.begin(self.root,action,'duplicate')
        before=runner.files(self.root);receipt=self.worker(self.root,work,route);runner.finish(self.root,name,token,receipt,before)
        with self.assertRaises(ValueError):runner.finish(self.root,name,token,receipt,before)
    def test_input_packet_contains_hashes_constraints_and_no_secret_files(self):
        (self.root/'.secrets/production.txt').write_text('private fixture')
        packet=runner.packet(self.root,guide.next_action(self.root))
        self.assertIn('funnel.json',packet['inputs']);self.assertFalse(any('.secrets' in p for p in packet['inputs']))
        self.assertTrue(packet['contract']['no_external_mutations'])
    def test_partial_file_application_recovers_idempotently(self):
        name='build/discovery.json';data=b'{"suggestions":[]}';storage.write(self.root,runner.JOURNAL,{'writes':{name:{'before':None,'after':runner.hash_bytes(data),'content':base64.b64encode(data).decode()}}})
        with storage.lock(self.root):runner.recover_apply(self.root);runner.recover_apply(self.root)
        self.assertEqual((self.root/name).read_bytes(),data)
    def test_conflicting_recovery_does_not_overwrite(self):
        name='build/discovery.json';data=b'{}';storage.write(self.root,name,{'newer':True})
        storage.write(self.root,runner.JOURNAL,{'writes':{name:{'before':None,'after':runner.hash_bytes(data),'content':base64.b64encode(data).decode()}}})
        with self.assertRaises(ValueError):runner.recover_apply(self.root)
        self.assertEqual(storage.read(self.root,name),{'newer':True})
    def test_journal_cannot_edit_approvals(self):
        data=b'{}';storage.write(self.root,runner.JOURNAL,{'writes':{'build/workflow.json':{'before':None,'after':runner.hash_bytes(data),'content':base64.b64encode(data).decode()}}})
        with self.assertRaises(ValueError):runner.recover_apply(self.root)
    def test_native_environment_scrubs_cloud_and_model_api_keys(self):
        with patch.dict(os.environ,{'OPENAI_API_KEY':'private','CF_API_TOKEN':'private','AWS_SECRET_ACCESS_KEY':'private','PATH':'safe'}):
            env=runner.native_environment();self.assertNotIn('OPENAI_API_KEY',env);self.assertNotIn('CF_API_TOKEN',env);self.assertEqual(env['PATH'],'safe')
    def test_missing_native_runtime_is_a_precise_blocker(self):
        with patch.object(runner.shutil,'which',return_value=None),self.assertRaisesRegex(ValueError,'not installed'):runner.probe('codex')
    def test_live_process_must_not_be_blindly_retried(self):
        name,token,work,route=runner.begin(self.root,guide.next_action(self.root),'synthetic')
        runner.heartbeat(self.root,name,token,os.getpid())
        # Another live PID that is not the current coordinator remains a blocker.
        with routing.database(self.root) as (_,state):state['tasks'][name]['child_pid']=os.getppid()
        with self.assertRaisesRegex(ValueError,'still alive'):runner.reconcile_worker(self.root,name,'Observed an interrupted synthetic fixture')
    def test_reopening_requires_diagnosis_not_silent_budget_reset(self):
        with self.assertRaises(ValueError):runner.reopen(self.root,'research','retry')
        runner.reopen(self.root,'research','The missing research capability has now been supplied')
    def test_explicit_worker_blocker_is_preserved(self):
        def blocked(*args):return {'status':'blocked','summary':'Source unavailable','outputs':[],'blockers':['Provide the correct business identity.']}
        value=runner.drive(self.root,executor=blocked);self.assertEqual(value['kind'],'blocked');self.assertIn('business identity',value['worker_blockers'][0])


if __name__=='__main__':unittest.main()
