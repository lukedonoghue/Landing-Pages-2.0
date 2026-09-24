"""Guide and generated-runtime contracts. No provider operation is invoked."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import guide
import ship
import workflow_storage as storage
class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        guide.start(self.root,name='Synthetic business',goal='publish')
        value=guide.config(self.root);value['guided_workflow']['mode']='automatic';value['backend']['provider']='cloudflare-d1'
        storage.write(self.root,'funnel.json',value)
        (self.root/'src').mkdir(exist_ok=True);(self.root/'src/worker.js').write_text('// fixture')
        discovery={'schema_version':1,'suggestions':[],'input_fingerprint':guide.research_fingerprint(self.root)}
        storage.write(self.root,'build/discovery.json',discovery);guide.discover(self.root)
        self.patches=[patch.object(guide,'questions',return_value=[]),patch('guide_image_handoff.inspect',return_value=None)]
        for p in self.patches:p.start();self.addCleanup(p.stop)
    def pending_ship(self,stage='cleanup',blocked=None):
        state=ship.Ship(self.root).load();state['stage']=stage
        if blocked:state['blocked']=blocked
        storage.write(self.root,ship.STATE,state)
    def test_underlying_verified_upload_is_not_completion_until_ship_cleanup(self):
        self.pending_ship()
        with patch.object(guide.workflow_progress,'inspect',return_value={'stage':'published_verified'}):
            action=guide.next_action(self.root)
        self.assertEqual(action['kind'],'connection');self.assertEqual(action['operation'],'guided_ship')
    def test_quality_blocker_returns_local_work_not_provider_execution(self):
        self.pending_ship('quality','quality');action=guide.next_action(self.root)
        self.assertEqual(action['kind'],'work');self.assertEqual(action['stage'],'publishing_local_repair')
        self.assertIn('Never fabricate',action['instruction'])
    def test_corrupt_ship_journal_is_recovery_not_reset(self):
        storage.write(self.root,ship.STATE,{'schema_version':999})
        action=guide.next_action(self.root)
        self.assertEqual(action['kind'],'reconcile');self.assertEqual(storage.read(self.root,ship.STATE)['schema_version'],999)
    def test_initial_publish_setup_uses_trusted_ship_launcher(self):
        with patch.object(guide.workflow_progress,'inspect',return_value={'stage':'publishing_setup','blockers':[]}):
            action=guide.next_action(self.root)
        self.assertEqual(action['operation'],'guided_ship');self.assertEqual(action['status_command'],['python3','scripts/ship.py','--json'])
    def test_fresh_scaffold_copies_operator_ui_and_private_policy(self):
        destination=self.root/'scaffold'
        out=subprocess.run([sys.executable,str(ROOT/'scripts/scaffold_project.py'),str(destination),'--client','Synthetic','--website','https://example.org'],capture_output=True,text=True,timeout=60)
        self.assertEqual(out.returncode,0,out.stdout+out.stderr)
        for path in ['scripts/ship.py','scripts/ship_ui.py','scripts/ship-provider.mjs','scripts/ship-release.mjs','.community-builder/assets/ship/index.html','.community-builder/assets/ship/requirements.json']:
            self.assertTrue((destination/path).is_file(),path)
        result=subprocess.run([sys.executable,str(destination/'scripts/ship.py'),'--project',str(destination),'--json'],capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertEqual(json.loads(result.stdout)['stage'],'inputs')
        self.assertFalse((destination/'.secrets/ship').exists(),'Status must not access provider credentials')
        self.assertIn('~/.landing-pages-publishing',(destination/'.claude/settings.json').read_text())
if __name__=='__main__':unittest.main()
