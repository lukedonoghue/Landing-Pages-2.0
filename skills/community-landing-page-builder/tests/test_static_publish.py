"""Guarded static release with synthetic provider/readback, never remote mutation."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit,unquote

SKILL=Path(__file__).resolve().parents[1];sys.path.insert(0,str(SKILL/'scripts'))
import static_publish as publish
import workflow_storage as storage
import check_gates


class StaticPublishTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);(self.root/'public').mkdir()
        (self.root/'public/index.html').write_text('<h1>Book the supported inspection</h1><a href="https://booking.example/">Book</a>')
        storage.write(self.root,'funnel.json',{'backend':{'provider':'none'},'conversion':{'type':'book','destination':'https://booking.example/'},
            'static_hosting':{'project':'synthetic-static','account_id':'a'*32,'production_branch':'main','production_url':'https://synthetic-static.pages.dev'}})
        self.calls=[]
    def provider(self,root,args,target,timeout=120):
        self.calls.append(args)
        if args==['whoami']:return 'Account '+target['account_id']
        if args==['pages','project','list']:return 'synthetic-static | synthetic-static.pages.dev | main'
        return 'Synthetic deployment accepted'
    def fetch(self,url,origin):
        path=unquote(urlsplit(url).path).lstrip('/') or 'index.html';return (self.root/'public'/path).read_bytes()
    def approval(self,root):return {'status':'pass','source_fingerprint':check_gates.source_snapshot(root)['source_fingerprint'],'failures':[]}
    def test_no_authority_cannot_publish(self):
        with patch.object(publish.workflow,'check_publish_approval',return_value={'status':'blocked','failures':['Actual user authority absent']}):
            with self.assertRaises(ValueError):publish.publish(self.root,self.provider,self.fetch)
        self.assertEqual(self.calls,[])
    def test_success_uses_actual_assets_no_database_or_lead(self):
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval):result=publish.publish(self.root,self.provider,self.fetch)
        self.assertEqual(result['status'],'verified');self.assertEqual(result['verification']['public_asset_hashes_verified'],['index.html'])
        self.assertFalse(any('d1' in a for a in self.calls));self.assertEqual(len([a for a in self.calls if a[:2]==['pages','deploy']]),1)
        self.assertEqual(publish.inspect(self.root)['stage'],'static_published')
    def test_unknown_deploy_is_not_retried(self):
        def unknown(root,args,target,timeout=120):
            result=self.provider(root,args,target,timeout)
            if args[:2]==['pages','deploy']:raise TimeoutError('Synthetic lost acknowledgement')
            return result
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval):
            with self.assertRaises(TimeoutError):publish.publish(self.root,unknown,self.fetch)
            with self.assertRaises(ValueError):publish.publish(self.root,unknown,self.fetch)
        self.assertEqual(len([a for a in self.calls if a[:2]==['pages','deploy']]),1)
        self.assertEqual(publish.inspect(self.root)['stage'],'static_publish_recovery')
        self.assertEqual(publish.reconcile(self.root,self.fetch)['status'],'verified')
    def test_wrong_account_blocks_before_mutation(self):
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval),self.assertRaisesRegex(ValueError,'account did not match'):
            publish.publish(self.root,lambda *a:'Different account',self.fetch)
        self.assertIsNone(storage.read(self.root,publish.STATE))
    def test_project_branch_must_match_the_same_row(self):
        def wrong(root,args,target,timeout=120):
            return target['account_id'] if args==['whoami'] else 'synthetic-static | synthetic-static.pages.dev | staging\nother | other.pages.dev | main'
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval),self.assertRaisesRegex(ValueError,'production branch'):
            publish.publish(self.root,wrong,self.fetch)
        self.assertIsNone(storage.read(self.root,publish.STATE))
    def test_missing_provider_project_blocks(self):
        def wrong(root,args,target,timeout=120):return target['account_id'] if args==['whoami'] else 'Different Pages project'
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval),self.assertRaises(ValueError):publish.publish(self.root,wrong,self.fetch)
    def test_temp_host_does_not_satisfy_requested_custom_domain(self):
        value=storage.read(self.root,'funnel.json');value['requested_hosts']={'public':'go.example.com'};storage.write(self.root,'funnel.json',value)
        self.assertEqual(publish.inspect(self.root)['stage'],'static_publish_setup')
    def test_wrong_deployed_bytes_remain_unverified(self):
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval),self.assertRaises(ValueError):publish.publish(self.root,self.provider,lambda *a:b'Wrong deployment')
        self.assertEqual(storage.read(self.root,publish.STATE)['status'],'uploaded_unverified')
    def test_changed_source_during_preflight_blocks(self):
        calls=0
        def changed(root,args,target,timeout=120):
            nonlocal calls;calls+=1
            if calls==2:(root/'public/index.html').write_text('Changed before upload')
            return self.provider(root,args,target,timeout)
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval),self.assertRaises(ValueError):publish.publish(self.root,changed,self.fetch)
        self.assertFalse(any(a[:2]==['pages','deploy'] for a in self.calls))
    def test_private_and_worker_assets_are_rejected(self):
        for name in ['.env','funnel.json','_worker.js','private.key','scripts/owner.txt']:
            with self.subTest(name=name):
                path=self.root/'public'/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('Synthetic private fixture')
                with self.assertRaises(ValueError):publish.assets(self.root)
                path.unlink()
                if path.parent!=self.root/'public':path.parent.rmdir()
    def test_no_project_root_publication_fallback(self):
        (self.root/'public/index.html').unlink();(self.root/'index.html').write_text('Owner-root file')
        with self.assertRaises(ValueError):publish.assets(self.root)
    def test_concurrent_static_publication_is_rejected(self):
        with publish.lease(self.root),self.assertRaises(ValueError):
            with publish.lease(self.root):pass
    def test_new_source_requires_new_authority_after_saved_success(self):
        with patch.object(publish.workflow,'check_publish_approval',side_effect=self.approval):publish.publish(self.root,self.provider,self.fetch)
        (self.root/'public/index.html').write_text('New revision')
        with patch.object(publish.workflow,'check_publish_approval',return_value={'status':'blocked','failures':['Stale authorization']}):
            self.assertEqual(publish.inspect(self.root)['stage'],'static_publish_authorization')


if __name__=='__main__':unittest.main()
