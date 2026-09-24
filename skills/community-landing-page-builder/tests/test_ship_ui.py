"""Exercise actual loopback HTTP authentication; no cloud provider is invoked."""
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import ship_ui

class FakeBridge:
    def __init__(self):self.actions=[]
    def status(self):return {'workflow':{'stage':'inputs','revision':0},'running':False,'error':None}
    def submit(self,action,value,revision):self.actions.append((action,value,revision));return {'accepted':True}

class WizardHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bridge=FakeBridge();cls.server,cls.token,_=ship_ui.make_server(None,bridge=cls.bridge)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.host='127.0.0.1:'+str(cls.server.server_port)
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def req(self,path='/api/status',method='GET',body=None,headers=None,auth=True):
        con=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        fields={'Host':self.host,'Content-Type':'application/json','Origin':'http://'+self.host}
        if auth:fields['Authorization']='Bearer '+self.token
        if headers:fields.update(headers)
        encoded=json.dumps(body) if isinstance(body,(dict,list)) else body
        con.request(method,path,body=encoded,headers=fields);r=con.getresponse();out=(r.status,dict(r.getheaders()),r.read());con.close();return out
    def test_only_loopback_binding(self):self.assertEqual(self.server.server_address[0],'127.0.0.1')
    def test_status_requires_fragment_bearer_token(self):
        self.assertEqual(self.req(auth=False)[0],403);self.assertEqual(self.req()[0],200)
    def test_reject_dns_rebinding_host(self):self.assertEqual(self.req(headers={'Host':'evil.test:'+str(self.server.server_port)})[0],403)
    def test_reject_cross_origin_mutation(self):
        self.assertEqual(self.req('/api/action','POST',{'action':'continue','revision':0},headers={'Origin':'https://evil.test'})[0],403)
    def test_reject_cross_site_fetch(self):self.assertEqual(self.req(headers={'Sec-Fetch-Site':'cross-site'})[0],403)
    def test_no_mutations_on_get(self):
        before=len(self.bridge.actions);self.assertEqual(self.req('/api/action')[0],404);self.assertEqual(len(self.bridge.actions),before)
    def test_action_is_forwarded_once_with_revision(self):
        before=len(self.bridge.actions);r=self.req('/api/action','POST',{'action':'publish','value':True,'revision':5})
        self.assertEqual(r[0],202);self.assertEqual(len(self.bridge.actions),before+1);self.assertEqual(self.bridge.actions[-1],('publish',True,5))
    def test_reject_oversized_body(self):self.assertEqual(self.req('/api/action','POST','x'*17000)[0],413)
    def test_reject_array_and_unknown_action(self):
        self.assertEqual(self.req('/api/action','POST',[])[0],409)
        self.assertEqual(self.req('/api/action','POST',{'action':'execute','value':'rm -rf x','revision':0})[0],409)
    def test_reject_revision_boolean(self):self.assertEqual(self.req('/api/action','POST',{'action':'continue','revision':True})[0],409)
    def test_reject_unrecognized_fields(self):self.assertEqual(self.req('/api/action','POST',{'action':'continue','revision':0,'command':'shell'})[0],409)
    def test_reject_wrong_content_type(self):self.assertEqual(self.req('/api/action','POST','{}',headers={'Content-Type':'text/plain'})[0],415)
    def test_never_serve_project_credentials_or_arbitrary_files(self):
        for p in ['/.secrets/production.json','/../funnel.json','/funnel.json','/api/file?name=.secrets/production.json','/requirements.json']:
            with self.subTest(path=p):self.assertIn(self.req(p)[0],[400,404])
    def test_token_not_in_html_or_query(self):
        response=self.req('/',auth=False);self.assertEqual(response[0],200);self.assertNotIn(self.token.encode(),response[2])
        self.assertEqual(self.req('/api/status?token='+self.token)[0],400)
    def test_policy_blocks_embedding_and_inline_code(self):
        status,headers,_=self.req();self.assertEqual(headers['X-Frame-Options'],'DENY')
        self.assertIn("frame-ancestors 'none'",headers['Content-Security-Policy']);self.assertNotIn('unsafe-inline',headers['Content-Security-Policy'])
        self.assertEqual(headers['Cache-Control'],'no-store');self.assertEqual(headers['Referrer-Policy'],'no-referrer')
    def test_no_cors_grant(self):self.assertNotIn('Access-Control-Allow-Origin',self.req()[1])

if __name__=='__main__':unittest.main()
