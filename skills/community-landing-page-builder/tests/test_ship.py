"""Coordinator fault injection. No credentials, cloud account or remote writes."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import ship

ACCOUNT='a'*32
INTENT={'domain':'landing.acme.com','owner':'owner@acme.com','site':'acme-page','sheets':False,'environment':'production'}

class FakeProvider:
    def __init__(self):self.calls=[];self.stop={};self.empty=False
    def call(self,operation,payload):
        self.calls.append((operation,copy.deepcopy(payload)))
        if operation in self.stop:
            value=self.stop.pop(operation)
            if isinstance(value,Exception):raise value
            return value
        if self.empty:return {'status':'pass','evidence':{}}
        v=payload['intent'];e={
            'prerequisites':{'copy_and_build':'checked'},'cloudflare':{'account_checked':True},
            'configure':{'database_bound':True,'preview_aliases':'disabled'},
            'quality':{'handoff_gates':'passed','full_application_regressions':'passed-no-skips','worker_bundle':'passed'},
            'sheets':{'protocol':2,'read_only_signed_probe':'passed'},
            'preflight':{'target':{'worker':v['site']}},
            'protect':{'recovery_point':'cloudflare-time-travel-bookmark-recorded','edge':{'automatically_verified':True}},
            'publish':{'status':'verified','url':'https://'+v['domain'],'live_journey':'verified','release_id':str(uuid.uuid4())},
            'cleanup':{'synthetic_contact_erased':True,'managed_copies_erased':True},
            'verify':{'url':'https://'+v['domain'],'live_proof':'sealed-and-rechecked','cleanup':'complete'},
            'login':{'login':'completed'},'open_handoff':{'opened_locally':True}}
        return {'status':'pass','evidence':e[operation],**({'account_id':ACCOUNT} if operation=='cloudflare' else {})}

class CoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        (self.root/'funnel.json').write_text(json.dumps({'development_fixture':False}))
        (self.root/'public').mkdir();(self.root/'public/index.html').write_text('<h1>Actual test source</h1>')
        self.adapter=FakeProvider();self.app=ship.Ship(self.root,self.adapter)
    def tearDown(self):self.temp.cleanup()
    def action(self,name,value=None,operator=True):return self.app.act(name,value,self.app.status()['revision'],operator)
    def to_prepare(self,extra=None):return self.action('settings',{**INTENT,**(extra or {})})
    def to_approve(self,sheets=False):
        self.to_prepare({'sheets':sheets});self.action('prepare',True)
        self.action('attest',{'mfa':True,'privacy':True,'trusted_host':True,**({'google_access':True} if sheets else {})})
        self.assertEqual(self.app.status()['stage'],'approve')
    def test_status_is_local_and_does_not_touch_provider(self):
        self.assertEqual(self.app.status()['stage'],'inputs');self.assertFalse(self.adapter.calls)
        self.assertFalse((self.root/ship.STATE).exists())
    def test_requires_operator_before_any_provider_access(self):
        value=self.action('settings',INTENT,operator=False)
        self.assertEqual(value['card']['code'],'operator_required');self.assertFalse(self.adapter.calls)
    def test_crm_only_runs_to_verified_and_never_calls_sheets(self):
        self.to_approve();out=self.action('publish',True)
        self.assertEqual(out['stage'],'ready');self.assertNotIn('sheets',[x[0] for x in self.adapter.calls])
        receipt=json.loads((self.root/'build/ship/release-receipt.json').read_text())
        self.assertEqual(receipt['status'],'verified')
        self.assertTrue(any(x['id']=='sheets_row_lifecycle' and x['status']=='not-enabled' for x in receipt['requirements']))
        self.assertTrue(any(x['id']=='account_mfa' and x['automatically_verified'] is False for x in receipt['requirements']))
    def test_sheets_expands_only_when_enabled(self):
        self.to_approve(True);self.action('publish',True)
        self.assertEqual([x[0] for x in self.adapter.calls].count('sheets'),1)
        self.assertIn('google_access',self.app.load()['attestations'])
    def test_no_provision_without_explicit_preparation_consent(self):
        self.assertEqual(self.to_prepare()['stage'],'prepare')
        self.action('continue');self.assertNotIn('configure',[x[0] for x in self.adapter.calls])
        with self.assertRaises(ValueError):self.action('prepare',False)
    def test_no_publish_without_real_button_confirmation(self):
        self.to_approve();self.action('continue');self.assertNotIn('publish',[x[0] for x in self.adapter.calls])
        with self.assertRaises(ValueError):self.action('publish','yes')
        with self.assertRaises(ValueError):self.action('publish',True,False)
    def test_attestations_are_individual_and_cannot_be_omitted(self):
        self.to_prepare();self.action('prepare',True)
        with self.assertRaises(ValueError):self.action('attest',{'mfa':True})
        self.assertEqual(self.app.status()['stage'],'operator')
    def test_stale_browser_revision_is_rejected(self):
        revision=self.app.status()['revision'];self.to_prepare()
        with self.assertRaises(ValueError):self.app.act('prepare',True,revision,True)
    def test_empty_pass_is_not_evidence(self):
        self.adapter.empty=True
        with self.assertRaisesRegex(ValueError,'incomplete evidence'):self.to_prepare()
        self.assertNotEqual(self.app.status()['stage'],'ready')
    def test_unknown_return_code_never_claims_ready(self):
        self.adapter.stop['cloudflare']={'status':'pass_with_warnings','code':'made-up'}
        out=self.to_prepare();self.assertEqual(out['card']['code'],'recovery')
    def test_source_change_invalidates_approval_before_upload(self):
        self.to_approve();self.adapter.stop['protect']={'status':'action','code':'edge'}
        self.action('publish',True);(self.root/'public/index.html').write_text('Changed after approval')
        out=self.action('continue');self.assertEqual(out['card']['code'],'approval_stale')
        self.assertNotIn('publish',self.app.load()['consents']);self.assertNotIn('publish',[x[0] for x in self.adapter.calls])
    def test_changed_source_after_uncertain_upload_preserves_journal(self):
        self.to_approve();self.adapter.stop['publish']={'status':'uncertain','code':'recovery'};self.action('publish',True)
        old=self.app.load()['id'];(self.root/'public/index.html').write_text('New code')
        out=self.action('continue');self.assertEqual(out['card']['code'],'changed_after_publish');self.assertEqual(self.app.load()['id'],old)
        self.assertIn('publish',self.app.load()['consents'])
    def test_uncertain_publish_resumes_same_workflow_and_consent(self):
        self.to_approve();self.adapter.stop['publish']={'status':'uncertain','code':'recovery'}
        first=self.action('publish',True);self.assertEqual(first['stage'],'publish')
        saved=self.app.load();second=self.action('continue');self.assertEqual(second['stage'],'ready')
        calls=[x[1] for x in self.adapter.calls if x[0]=='publish'];self.assertEqual(calls[0]['run_id'],calls[1]['run_id']);self.assertEqual(calls[0]['consents'],calls[1]['consents'])
        self.assertEqual(saved['id'],self.app.load()['id'])
    def test_crash_keeps_pending_operation_for_resume(self):
        self.to_approve();self.adapter.stop['publish']=RuntimeError('Simulated process interruption')
        with self.assertRaises(RuntimeError):self.action('publish',True)
        self.assertEqual(self.app.load()['pending']['operation'],'publish')
        self.assertEqual(self.action('continue')['stage'],'ready')
    def test_cleanup_failure_is_a_release_blocker(self):
        self.to_approve();self.adapter.stop['cleanup']={'status':'action','code':'cleanup'}
        self.assertEqual(self.action('publish',True)['stage'],'cleanup')
        self.assertFalse((self.root/'build/ship/release-receipt.json').exists())
        self.assertEqual(self.action('continue')['stage'],'ready')
    def test_settings_cannot_replace_an_uncertain_release(self):
        self.to_approve();self.adapter.stop['publish']={'status':'uncertain','code':'recovery'};self.action('publish',True)
        with self.assertRaises(ValueError):self.action('settings',{**INTENT,'domain':'other.acme.com'})
    def test_uncertain_existing_pointer_blocks_destination_change(self):
        self.to_prepare();ship.storage.write(self.root,'build/current-release.json',{'id':str(uuid.uuid4())})
        with self.assertRaises(ValueError):self.action('settings',{**INTENT,'site':'different'})
    def test_quality_failure_creates_native_agent_task_not_fake_evidence(self):
        self.to_prepare();self.adapter.stop['quality']={'status':'action','code':'quality'}
        self.action('prepare',True);task=json.loads((self.root/'build/ship/agent-task.json').read_text())
        self.assertFalse(task['provider_access']);self.assertFalse(task['secrets_access']);self.assertNotIn('quality',self.app.load()['completed'])
    def test_account_selection_only_accepts_observed_identifiers(self):
        self.adapter.stop['cloudflare']={'status':'action','code':'account','choices':[ACCOUNT,'b'*32]}
        self.to_prepare()
        with self.assertRaises(ValueError):self.action('choose_account','c'*32)
        self.assertEqual(self.action('choose_account',ACCOUNT)['stage'],'prepare')
    def test_existing_database_requires_new_preparation_confirmation(self):
        self.to_prepare();identifier=str(uuid.uuid4());self.adapter.stop['configure']={'status':'action','code':'database_conflict','choices':[identifier]}
        self.action('prepare',True)
        out=self.action('database',identifier);self.assertEqual(out['stage'],'prepare');self.assertNotIn('prepare',self.app.load()['consents'])
    def test_existing_access_confirmation_is_recorded_not_called_api_proof(self):
        self.to_prepare();self.action('prepare',True);self.adapter.stop['preflight']={'status':'action','code':'existing_access'}
        self.action('attest',{'mfa':True,'privacy':True,'trusted_host':True})
        self.assertEqual(self.action('existing_confirm',True)['stage'],'approve')
        self.assertEqual(self.app.load()['attestations']['existing_access']['evidence'],'owner-confirmed-not-api-verified')
    def test_fictional_demo_is_never_publishable(self):
        (self.root/'funnel.json').write_text('{"development_fixture":true}')
        with self.assertRaisesRegex(ValueError,'fictional demo'):self.to_prepare()
        self.assertFalse(self.adapter.calls)
    def test_symlink_in_source_rejected(self):
        (self.root/'public/link').symlink_to('/etc/hosts')
        with self.assertRaises(ValueError):self.app.fingerprint()
    def test_private_files_are_not_source_or_status(self):
        (self.root/'.secrets').mkdir();(self.root/'.secrets/production.json').write_text('{"password":"DO_NOT_READ"}')
        self.to_prepare();self.assertNotIn('DO_NOT_READ',json.dumps(self.app.status()))
        self.assertNotIn('DO_NOT_READ',json.dumps(self.adapter.calls))
    def test_two_wizards_do_not_run_concurrent_operations(self):
        with ship.shipping_lock(self.root):
            with self.assertRaises(ship.Busy):self.to_prepare()
    def test_corrupt_state_is_not_reset(self):
        (self.root/'build/ship').mkdir(parents=True);(self.root/ship.STATE).write_text('{"schema_version":999}')
        with self.assertRaises(ValueError):self.app.status()
        self.assertIn('999',(self.root/ship.STATE).read_text())
    def test_repeated_continue_after_ready_does_not_redeploy(self):
        self.to_approve();self.action('publish',True);n=len(self.adapter.calls)
        self.action('continue');self.assertEqual(len(self.adapter.calls),n)
    def test_invalid_intent_rejected(self):
        for extra in [{'password':'secret'},{'domain':'https://acme.com/path'},{'domain':'a.internal'},
                      {'owner':'x\nAuthorization: bad'},{'site':'a; touch x'},{'sheets':'false'},
                      {'sheets_url':'https://script.google.com/macros/s/x/exec?token=private'}]:
            with self.subTest(extra=extra),self.assertRaises(ValueError):ship.validate_intent({**INTENT,**extra})
    def test_reference_and_state_cannot_be_transferred_to_other_project(self):
        self.to_prepare();state=self.app.load();state['project']='wrong';ship.storage.write(self.root,ship.STATE,state)
        with self.assertRaises(ValueError):self.app.status()

    def test_sheet_step_cannot_change_domain_account_or_disable_integration(self):
        self.to_prepare({'sheets':True})
        self.adapter.stop['sheets']={'status':'action','code':'sheets_setup'}
        self.action('prepare',True)
        original=self.app.load()['intent']
        for bad in [{'domain':'attacker.com'},{'account_id':'b'*32},{'sheets':False},{'environment':'staging'}]:
            with self.subTest(bad=bad),self.assertRaises(ValueError):self.action('sheets',bad)
        self.assertEqual(self.app.load()['intent'],original)
    def test_handoff_open_failure_is_not_silently_reported_as_success(self):
        self.to_approve()
        self.adapter.stop['open_handoff']={'status':'action','code':'destination'}
        with self.assertRaisesRegex(ValueError,'could not be opened'):self.action('open_handoff','owner')
        self.assertEqual(self.app.status()['stage'],'approve')
    def test_new_release_archives_the_old_receipt_and_requires_fresh_approval(self):
        self.to_approve();self.action('publish',True)
        old=self.app.load();newid=str(uuid.uuid4())
        with patch.object(self.app,'prior_verified',return_value=newid):
            result=self.action('new_release',True)
        self.assertEqual(result['stage'],'inputs')
        self.assertNotEqual(result['id'],old['id']);self.assertEqual(self.app.load()['previous_release'],newid)
        self.assertEqual(self.app.load()['consents'],{});self.assertFalse((self.root/'build/ship/release-receipt.json').exists())
        self.assertTrue((self.root/('build/ship/history/'+old['id']+'-receipt.json')).is_file())
    def test_new_release_is_operator_only_and_never_discards_unresolved_publication(self):
        self.to_approve()
        with self.assertRaises(ValueError):self.action('new_release',True)
        self.action('publish',True)
        with self.assertRaises(ValueError):self.action('new_release',True,operator=False)
        with patch.object(self.app,'prior_verified',side_effect=ValueError('Unresolved predecessor')):
            with self.assertRaises(ValueError):self.action('new_release',True)
        self.assertEqual(self.app.status()['stage'],'ready')
    def test_existing_verified_release_can_start_a_fresh_reviewed_run(self):
        ident=str(uuid.uuid4())
        with patch.object(self.app,'prior_verified',return_value=ident):
            self.to_prepare()
        self.assertEqual(self.app.load()['previous_release'],ident)
        self.assertNotIn('publish',self.app.load()['consents'])
    def test_private_handoff_path_is_denied_in_both_generated_agent_policies(self):
        import agent_security
        self.assertIn('~/.landing-pages-publishing',agent_security.HOME_PATHS)
        self.assertIn('Read(~/.landing-pages-publishing/**)',agent_security.claude_settings()['permissions']['deny'])
        self.assertIn('"~/.landing-pages-publishing" = "deny"',agent_security.codex_config())

if __name__=='__main__':unittest.main()
