#!/usr/bin/env python3
"""Private loopback publishing UI. Does not serve project files or credentials."""
from __future__ import annotations
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import threading
from urllib.parse import urlsplit
import webbrowser
import runtime_context

MAX_BODY=16*1024


class Bridge:
    def __init__(self,ship):
        self.ship=ship;self.thread=None;self.error=None;self.lock=threading.Lock()
    def busy(self):return bool(self.thread and self.thread.is_alive())
    def status(self):return {'workflow':self.ship.status(),'running':self.busy(),'error':self.error}
    def submit(self,action,value,revision):
        with self.lock:
            if self.busy():raise ValueError('This operation is already running. No second request was started.')
            self.error=None
            def work():
                try:self.ship.act(action,value,revision,operator=True)
                except ValueError as error:self.error=''.join(c for c in str(error) if c=='\n' or ord(c)>=32)[:500]
                except Exception:self.error='The publishing operation stopped. Reopen this wizard to reconcile its saved state.'
            self.thread=threading.Thread(target=work,name='guided-publishing-operator',daemon=False)
            self.thread.start()
        return {'accepted':True}


def make_server(ship,port=0,assets=None,bridge=None):
    if not 0<=port<=65535:raise ValueError('Invalid loopback port.')
    token=secrets.token_urlsafe(32);bridge=bridge or Bridge(ship)
    assets=Path(assets) if assets else runtime_context.skill_root(__file__)/'assets/ship'
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def respond(self,code,value,mime='application/json; charset=utf-8'):
            body=json.dumps(value).encode() if mime.startswith('application/json') else value
            self.send_response(code)
            for key,value in {'Content-Type':mime,'Content-Length':str(len(body)),'Cache-Control':'no-store',
                'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
                'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}.items():self.send_header(key,value)
            self.end_headers();self.wfile.write(body)
        def trusted(self,mutation=False):
            host='127.0.0.1:'+str(self.server.server_port)
            if self.headers.get('Host')!=host:return False
            if not hmac.compare_digest(self.headers.get('Authorization','').encode('utf-8'),('Bearer '+token).encode('utf-8')):return False
            if mutation and self.headers.get('Origin')!='http://'+host:return False
            return self.headers.get('Sec-Fetch-Site','same-origin') in {'same-origin','none'}
        def do_GET(self):
            host='127.0.0.1:'+str(self.server.server_port)
            if self.headers.get('Host')!=host:return self.respond(403,{'error':'Unexpected host'})
            parsed=urlsplit(self.path)
            if parsed.query:return self.respond(400,{'error':'Query parameters are not supported'})
            files={'/':('index.html','text/html; charset=utf-8'),'/app.js':('app.js','application/javascript; charset=utf-8'),'/style.css':('style.css','text/css; charset=utf-8')}
            if parsed.path in files:
                file,mime=files[parsed.path];return self.respond(200,(assets/file).read_bytes(),mime)
            if not self.trusted():return self.respond(403,{'error':'Open the private URL printed by the local publisher'})
            if parsed.path!='/api/status':return self.respond(404,{'error':'Not found'})
            try:return self.respond(200,bridge.status())
            except (ValueError,OSError):return self.respond(409,{'error':'The saved state needs local recovery; no private contents were returned'})
        def do_POST(self):
            self.connection.settimeout(5)
            if not self.trusted(True):return self.respond(403,{'error':'Unauthenticated or cross-origin request'})
            if self.path!='/api/action':return self.respond(404,{'error':'Not found'})
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.respond(415,{'error':'Use JSON'})
            if self.headers.get('Transfer-Encoding'):return self.respond(400,{'error':'Chunked requests are not accepted'})
            try:
                n=int(self.headers.get('Content-Length','0'))
                if not 0<n<=MAX_BODY:return self.respond(413,{'error':'Request too large or empty'})
                value=json.loads(self.rfile.read(n))
                if not isinstance(value,dict) or set(value)-{'action','value','revision'}:raise ValueError('Invalid request')
                if type(value.get('revision')) is not int or value['revision']<0:raise ValueError('Invalid revision')
                allowed={'settings','continue','prepare','publish','attest','login','choose_account','database','sheets','edge_confirm','existing_confirm','open_handoff','new_release'}
                if value.get('action') not in allowed:raise ValueError('Unknown action')
                return self.respond(202,bridge.submit(value['action'],value.get('value'),value['revision']))
            except (ValueError,TypeError):return self.respond(409,{'error':'The action is invalid, stale or already running. Refresh and try again.'})
            except (OSError,TimeoutError):return self.respond(400,{'error':'Incomplete request'})
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    server.daemon_threads=True
    return server,token,bridge


def serve(ship,port=0):
    server,token,bridge=make_server(ship,port)
    url=f'http://127.0.0.1:{server.server_port}/#'+token
    print('Private publishing wizard (keep this URL on your computer):\n'+url,flush=True)
    webbrowser.open(url)
    try:server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()
        if bridge.busy():print('A guarded operation is still reconciling. Its journal is retained; do not start a replacement deployment.',flush=True)
    return 0
