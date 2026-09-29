#!/usr/bin/env python3
"""UI test fixture ONLY. Real HTTP/controller/UI; provider calls explicitly stubbed.
Never imported by the publishing CLI, and never reads credentials or calls a cloud.
"""
import json
from pathlib import Path
import sys
import tempfile
import uuid
here=Path(__file__).resolve();app=here.parents[2]
scripts=app/'scripts' if (app/'scripts/ship.py').exists() else here.parents[4]/'scripts'
sys.path.insert(0,str(scripts))
import ship
import ship_ui
NAMES={'a'*32:'Fixture Plumbing Ltd','c'*32:'Fixture Agency'}
class SyntheticProvider:
    def call(self,operation,payload):
        v=payload['intent']
        if operation=='cloudflare' and not v.get('account_id'):
            # Two synthetic accounts, offered by name as the cf account listing would.
            return {'status':'action','code':'account','choices':list(NAMES),'details':{'labels':NAMES}}
        destination={'account':{'id':v.get('account_id',''),'name':NAMES.get(v.get('account_id'),'')},'zone':{'id':'b'*32,'name':'example.org','status':'active','plan':'Free Website'},
                     'hostname':v['domain'],'worker':'new','dns':'clear'}
        e={'prerequisites':{'copy_and_build':'checked'},'cloudflare':{'account_checked':True,'destination':destination},
          'configure':{'database_bound':True,'preview_aliases':'disabled'},
          'quality':{'handoff_gates':'passed','full_application_regressions':'passed-no-skips','worker_bundle':'passed'},
          'sheets':{'protocol':2,'read_only_signed_probe':'passed'},'preflight':{'target':{'worker':v['site']}},
          'protect':{'recovery_point':'cloudflare-time-travel-bookmark-recorded','edge':{'automatically_verified':True}},
          'publish':{'status':'verified','url':'https://'+v['domain'],'live_journey':'verified','release_id':str(uuid.uuid4())},
          'cleanup':{'synthetic_contact_erased':True,'managed_copies_erased':True},
          'verify':{'url':'https://'+v['domain'],'live_proof':'sealed-and-rechecked','cleanup':'complete'},
          'login':{'login':'completed'},'open_handoff':{'opened_locally':True}}
        return {'status':'pass','evidence':e[operation],**({'account_id':v['account_id']} if operation=='cloudflare' else {})}
def main():
    with tempfile.TemporaryDirectory(prefix='ship-ui-test-') as tmp:
        root=Path(tmp);(root/'funnel.json').write_text(json.dumps({'development_fixture':False,'test_only':True}))
        (root/'public').mkdir();(root/'public/index.html').write_text('<h1>Fictional UI fixture only</h1>')
        server,token,bridge=ship_ui.make_server(ship.Ship(root,SyntheticProvider()))
        print(json.dumps({'url':f'http://127.0.0.1:{server.server_port}/#{token}','scope':'UI test only; provider calls stubbed; no deployment'}),flush=True)
        try:server.serve_forever(poll_interval=0.1)
        except KeyboardInterrupt:pass
        finally:server.server_close()
if __name__=='__main__':main()
