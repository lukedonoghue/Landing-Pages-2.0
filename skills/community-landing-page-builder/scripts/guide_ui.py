#!/usr/bin/env python3
"""Loopback guide with authenticated, same-origin actions and a real runner bridge.

Open only the printed private URL. The fragment credential is kept in browser
session storage, never sent as a query or printed in request logs. Public preview
serving is a separate server rooted at public/, never this project root.
"""
from __future__ import annotations
import argparse
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import sys
import threading
from urllib.parse import urlsplit
import uuid

import guide
import workflow_runner as runner

ASSETS=Path(__file__).resolve().parents[1]/'assets/guide'
MAX_BODY=64*1024


class Bridge:
    def __init__(self,root,provider):
        self.root=Path(root).resolve();self.provider=provider;self.lock=threading.Lock();self.thread=None;self.last=None;self.cancel=threading.Event()
    def wake(self):
        with self.lock:
            if self.thread and self.thread.is_alive():return {'running':True}
            self.last=None;self.cancel.clear()
            def work():
                try:self.last=runner.drive(self.root,self.provider,cancel=self.cancel)
                except Exception as error:self.last={'kind':'blocked','error':str(error) if isinstance(error,ValueError) else type(error).__name__}
            self.thread=threading.Thread(target=work,name='guided-native-runner',daemon=True);self.thread.start()
            return {'running':True}
    def stop(self):
        self.cancel.set()
        if self.thread:self.thread.join(timeout=12)
    def status(self):
        return {'running':bool(self.thread and self.thread.is_alive()),'last':self.last,'next':guide.next_action(self.root)}


def server(root,provider='codex',port=0,bridge=None):
    root=Path(root).resolve();token=secrets.token_urlsafe(32);bridge=bridge or Bridge(root,provider)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def respond(self,status,value,mime='application/json; charset=utf-8'):
            data=json.dumps(value).encode() if mime.startswith('application/json') else value
            self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.end_headers();self.wfile.write(data)
        def trusted(self,mutation=False):
            host='127.0.0.1:'+str(self.server.server_port)
            if self.headers.get('Host')!=host:return False
            if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):return False
            if mutation and self.headers.get('Origin')!='http://'+host:return False
            return self.headers.get('Sec-Fetch-Site','same-origin') in {'same-origin','none'}
        def do_GET(self):
            if self.headers.get('Host')!='127.0.0.1:'+str(self.server.server_port):return self.respond(403,{'error':'Unexpected host'})
            path=urlsplit(self.path).path
            names={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}
            if path in names:
                mime={'/':'text/html; charset=utf-8','/app.js':'application/javascript; charset=utf-8','/style.css':'text/css; charset=utf-8'}[path]
                return self.respond(200,(ASSETS/names[path]).read_bytes(),mime)
            if not self.trusted():return self.respond(403,{'error':'Open the private guide URL from this runner'})
            try:
                if path=='/api/status':return self.respond(200,bridge.status())
                if path=='/api/review':
                    value=guide.config(root);paths=guide.workflow.copy_files(root)
                    documents=[]
                    for name in [paths['copy'],paths['brief']]:
                        file=guide.storage.path_inside(root,name)
                        if file.is_file() and file.stat().st_size<=500000:documents.append({'path':name,'text':file.read_text()})
                    return self.respond(200,{'documents':documents,'next':guide.next_action(root)})
                return self.respond(404,{'error':'Not found'})
            except (ValueError,OSError,KeyError,TypeError) as error:return self.respond(409,{'error':str(error)})
        def do_POST(self):
            if not self.trusted(True):return self.respond(403,{'error':'Unauthenticated or cross-origin action'})
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.respond(415,{'error':'Use JSON'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=MAX_BODY:raise ValueError('Invalid request size')
                data=json.loads(self.rfile.read(length))
                if not isinstance(data,dict):raise ValueError('Use an object')
                path=urlsplit(self.path).path
                if path in {'/api/answer','/api/approve'}:
                    # The server creates provenance for this actual authenticated UI action, not client-supplied actor claims.
                    identity=data.get('event_id') or uuid.uuid4().hex
                    if not isinstance(identity,str) or len(identity)>100:raise ValueError('Invalid event identity')
                    event={**data,'event_id':identity,'actor':'user','message_id':'local-guide:'+identity}
                    result=guide.answer(root,event) if path.endswith('answer') else guide.approve(root,event)
                    bridge.wake();return self.respond(200,result)
                if path=='/api/run':return self.respond(202,bridge.wake())
                if path in {'/api/pause','/api/resume'}:
                    with guide.storage.lock(root):
                        record=guide.state(root);record['paused']=path.endswith('pause');guide.storage.write(root,guide.STATE,record)
                    if path.endswith('resume'):bridge.wake()
                    return self.respond(200,bridge.status())
                if path=='/api/help':
                    q=guide.catalog().get(data.get('id'))
                    return self.respond(200,{'explanation':q['reason'] if q else 'Ask the active agent about this step. Help is not an answer or approval.','next':guide.next_action(root)})
                return self.respond(404,{'error':'Unsupported action'})
            except (ValueError,OSError,KeyError,TypeError) as error:return self.respond(409,{'error':str(error)})
    http=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    http.daemon_threads=True
    return http,token,bridge


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('project',type=Path);p.add_argument('--provider',choices=['codex','claude'],default='codex');p.add_argument('--port',type=int,default=0)
    a=p.parse_args();http,token,bridge=server(a.project,a.provider,a.port)
    print(f'Private owner guide: http://127.0.0.1:{http.server_port}/#token={token}',flush=True)
    print('Keep this process open. Start work from the guide. Closing it pauses dispatch; existing native work must be reconciled before restart.',flush=True)
    try:http.serve_forever()
    except KeyboardInterrupt:pass
    finally:bridge.stop();http.server_close()


if __name__=='__main__':main()
