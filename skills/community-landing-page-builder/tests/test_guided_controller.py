"""Mechanical guide, authority and real loopback-interface regressions (no models/cloud)."""
import copy
import hashlib
import http.client
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

SKILL=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(SKILL/'scripts'))
import guide
import guide_ui
import review_workflow
import workflow_storage as storage


class GuideTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        guide.start(self.root,name='Synthetic business')
    def save(self,name,value):
        if name=='build/discovery.json':value={**value,'input_fingerprint':guide.research_fingerprint(self.root)}
        storage.write(self.root,name,value)
    def event(self,answers,**kw):
        return {'actor':'user','message_id':'synthetic:message','event_id':'event-'+str(guide.state(self.root)['revision']),
                'expected_revision':guide.state(self.root)['revision'],'answers':[{'id':k,'value':v} for k,v in answers.items()],**kw}
    def discovered(self):
        fingerprint=guide.research_fingerprint(self.root)
        self.save('build/discovery.json',{'schema_version':1,'suggestions':[]})
        manifest=storage.read(self.root,review_workflow.MANIFEST)
        manifest.update(input_fingerprint=fingerprint)
        manifest['business'].update(name=guide.config(self.root)['client'].get('name',''),website=guide.config(self.root)['client'].get('website',''))
        manifest['discovery']={'status':'no_sources','searched_at':'2026-09-22T12:00:00+00:00','sources_checked':[{'name':'Synthetic fixture source check','url':'https://example.test/reviews','identity_match':'not_applicable'}],'notes':'Mechanical guide fixture; no customer feedback supplied.'}
        storage.write(self.root,review_workflow.MANIFEST,manifest)
        review_workflow.compile_project(self.root,fingerprint)
        guide.discover(self.root)
    def complete_business(self):
        self.discovered();guide.answer(self.root,self.event({'service':'Roof inspections','audience':'Homeowners','region':'Synthetic county','offer':'An inspection and written findings','conversion':'call','destination':'tel:+15555550123'}))
    def confirm(self):
        q=guide.next_action(self.root)
        return guide.approve(self.root,{'actor':'user','message_id':'confirm:1','message':'I confirm this brief','kind':'brief','expected_revision':q['revision'],'review_fingerprint':q['review_fingerprint']})
    def test_initial_profile_has_no_database_and_owner_ui_is_not_public(self):
        self.assertEqual(guide.config(self.root)['backend']['provider'],'none');self.assertFalse((self.root/'src/worker.js').exists())
        self.assertTrue((self.root/'scripts/guide.py').is_file());self.assertTrue((self.root/'assets/guide/index.html').is_file())
        self.assertFalse((self.root/'public/assets/guide').exists());self.assertEqual(guide.next_action(self.root)['kind'],'work')
    def test_many_answers_are_canonical_and_not_repeated(self):
        self.complete_business();q=guide.next_action(self.root);self.assertEqual(q['kind'],'approval');self.assertEqual(q['approval_kind'],'brief')
        self.assertEqual(guide.config(self.root)['brief']['service_focus'],'Roof inspections');self.assertEqual(guide.questions(self.root),[])
    def test_duplicate_answer_and_conflicting_replay(self):
        event=self.event({'region':'Global'});guide.answer(self.root,event);self.assertEqual(guide.answer(self.root,event)['status'],'already_applied')
        altered=copy.deepcopy(event);altered['answers'][0]['value']='Elsewhere'
        with self.assertRaises(ValueError):guide.answer(self.root,altered)
    def test_stale_screen_does_not_overwrite_new_answer(self):
        old=self.event({'region':'Old'});guide.answer(self.root,self.event({'region':'New'},event_id='new'))
        with self.assertRaises(ValueError):guide.answer(self.root,old)
        self.assertEqual(guide.config(self.root)['client']['region'],'New')
    def test_cancel_empty_and_secret_are_not_answers(self):
        for values in ({'offer':''},{'offer':'api_key=sk-123456789012345678901234'},{}):
            with self.subTest(values=values),self.assertRaises(ValueError):guide.answer(self.root,self.event(values))
        self.assertEqual(guide.state(self.root)['revision'],0)
    def test_resume_preserves_automatic_and_goal(self):
        record=guide.config(self.root);record['guided_workflow'].update(mode='automatic',goal='publish');self.save('funnel.json',record)
        guide.start(self.root)
        self.assertEqual(guide.config(self.root)['guided_workflow']['mode'],'automatic')
        with self.assertRaises(ValueError):guide.start(self.root,mode='guided')
    def test_help_is_read_only(self):
        before=(self.root/guide.STATE).read_bytes();result=subprocess.run([sys.executable,str(SKILL/'scripts/guide.py'),'help',str(self.root),'--question','service'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout);self.assertEqual(before,(self.root/guide.STATE).read_bytes())
    def test_actual_brief_confirmation_and_changed_brief(self):
        self.complete_business();self.confirm();self.assertNotEqual(guide.next_action(self.root)['stage'],'brief_review')
        guide.answer(self.root,self.event({'offer':'A different supported offer'}));self.assertEqual(guide.next_action(self.root)['stage'],'brief_review')
    def test_stale_review_fingerprint_is_rejected(self):
        self.complete_business();q=guide.next_action(self.root);config=guide.config(self.root);config['offer']='Changed behind the screen';self.save('funnel.json',config)
        with self.assertRaises(ValueError):guide.approve(self.root,{'actor':'user','message_id':'m','message':'Approve','kind':'brief','expected_revision':q['revision'],'review_fingerprint':q['review_fingerprint']})
    def test_research_never_overwrites_supplied_facts(self):
        source=self.root/'research/source.txt';source.write_text('Region: Overseas')
        self.save('build/discovery.json',{'suggestions':[{'id':'region','value':'Overseas','source_path':'research/source.txt','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'excerpt':'Region: Overseas'}]})
        guide.answer(self.root,self.event({'region':'User supplied region'}));guide.discover(self.root)
        self.assertEqual(guide.config(self.root)['client']['region'],'User supplied region')
    def test_changed_website_requires_new_research(self):
        self.complete_business();guide.answer(self.root,self.event({'website':'https://new-business.example'}))
        self.assertEqual(guide.next_action(self.root)['stage'],'research')
        with self.assertRaises(ValueError):guide.discover(self.root)
    def test_unanchored_research_rejected(self):
        (self.root/'research/source.txt').write_text('No support')
        self.save('build/discovery.json',{'suggestions':[{'id':'offer','value':'Invented offer','source_path':'research/source.txt','source_sha256':'bad','excerpt':'Invented'}]})
        with self.assertRaises(ValueError):guide.discover(self.root)
    def test_other_option_remains_a_real_answer(self):
        source=self.root/'research/source.txt';source.write_text('Residential and commercial inspections')
        self.save('build/discovery.json',{'suggestions':[{'id':'service','ambiguous':True,'options':[{'value':'Residential','label':'Residential'}],'source_path':'research/source.txt','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'excerpt':'Residential'}]});guide.discover(self.root)
        event=self.event({'service':'Commercial'});event['answers'][0]['other']=True;guide.answer(self.root,event)
        self.assertEqual(guide.config(self.root)['brief']['service_focus'],'Commercial')
    def test_lead_profile_is_selected_explicitly(self):
        self.complete_business();guide.answer(self.root,self.event({'conversion':'enquire','follow_up':'The owner calls back during office hours'}));self.confirm()
        self.assertEqual(guide.next_action(self.root)['operation'],'scaffold');guide.local(self.root,'scaffold')
        self.assertTrue((self.root/'src/worker.js').is_file());self.assertEqual(guide.config(self.root)['backend']['provider'],'cloudflare-d1')
    def test_preview_does_not_request_unneeded_hosting(self):
        self.complete_business();self.confirm()
        with patch.object(guide.workflow_progress,'inspect',return_value={'stage':'publishing_setup','blockers':[]}):
            self.assertEqual(guide.next_action(self.root)['stage'],'local_final')
    def test_publish_goal_moves_past_local_preview(self):
        self.complete_business();self.confirm();config=guide.config(self.root);config['guided_workflow']['goal']='publish';self.save('funnel.json',config)
        with patch.object(guide.workflow_progress,'inspect',return_value={'stage':'static_publish_setup','blockers':[]}):
            self.assertEqual(guide.next_action(self.root)['kind'],'connection')
    def test_recover_partial_answer_transaction(self):
        old_config,old_state=guide.config(self.root),guide.state(self.root);new=copy.deepcopy(old_config);new['audience']='Confirmed audience'
        record=copy.deepcopy(old_state);record['revision']+=1
        self.save(guide.JOURNAL,{'writes':{'funnel.json':{'before':guide.digest(old_config),'value':new},guide.STATE:{'before':guide.digest(old_state),'value':record}}})
        self.save('funnel.json',new)
        with storage.lock(self.root):guide.recover(self.root)
        self.assertEqual(guide.state(self.root)['revision'],1);self.assertFalse((self.root/guide.JOURNAL).exists())
    def test_conflicting_transaction_preserves_new_work(self):
        old=guide.config(self.root);new=copy.deepcopy(old);new['offer']='Pending'
        self.save(guide.JOURNAL,{'writes':{'funnel.json':{'before':guide.digest(old),'value':new}}});old['offer']='Newer edit';self.save('funnel.json',old)
        with storage.lock(self.root),self.assertRaises(ValueError):guide.recover(self.root)
        self.assertEqual(guide.config(self.root)['offer'],'Newer edit')


class InterfaceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);guide.start(self.root)
        class StubBridge:
            wakes=0
            def status(inner):return {'running':False,'last':None,'next':guide.next_action(self.root)}
            def wake(inner):inner.wakes+=1;return {'running':True}
        self.bridge=StubBridge();self.http,self.token,_=guide_ui.server(self.root,bridge=self.bridge)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True);self.thread.start()
        self.addCleanup(self.http.server_close);self.addCleanup(self.http.shutdown)
    def request(self,path,body=None,token=None,origin=None,host=None):
        connection=http.client.HTTPConnection('127.0.0.1',self.http.server_port)
        headers={'Authorization':'Bearer '+(token or self.token),'Host':host or f'127.0.0.1:{self.http.server_port}'}
        if body is not None:headers.update({'Content-Type':'application/json','Origin':origin or f'http://127.0.0.1:{self.http.server_port}'})
        connection.request('POST' if body is not None else 'GET',path,json.dumps(body) if body is not None else None,headers)
        response=connection.getresponse();data=response.read();connection.close();return response.status,data
    def test_selection_updates_same_controller_and_wakes_real_bridge_interface(self):
        event={'event_id':'same-click','expected_revision':0,'answers':[{'id':'business_name','value':'Local synthetic business'}]}
        self.assertEqual(self.request('/api/answer',event)[0],200);self.assertEqual(self.bridge.wakes,1)
        self.assertEqual(self.request('/api/answer',event)[0],200)
        self.assertEqual(guide.config(self.root)['client']['name'],'Local synthetic business')
    def test_bad_origin_auth_host_and_arbitrary_commands_rejected(self):
        self.assertEqual(self.request('/api/status',token='bad')[0],403)
        self.assertEqual(self.request('/api/run',{},origin='https://attacker.test')[0],403)
        self.assertEqual(self.request('/api/run',{},host='attacker.test')[0],403)
        self.assertEqual(self.request('/api/exec',{'command':'echo unsafe'})[0],404)
        self.assertEqual(self.bridge.wakes,0)
    def test_private_files_not_served(self):
        self.assertEqual(self.request('/funnel.json')[0],404);self.assertEqual(self.request('/.secrets/key')[0],404)
    def test_help_does_not_advance(self):
        before=guide.state(self.root);self.assertEqual(self.request('/api/help',{'id':'service'})[0],200)
        self.assertEqual(before,guide.state(self.root));self.assertEqual(self.bridge.wakes,0)


if __name__=='__main__':unittest.main()
