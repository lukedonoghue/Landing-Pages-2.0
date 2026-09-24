#!/usr/bin/env python3
"""Guarded static Pages publication; no D1, email, live form or purchase tests.

Configure an existing owner-selected Pages project first. Existing workflow.py
owns publication authority and local QA. Unknown deployment outcomes are never
retried automatically. Production verification compares exact uploaded bytes.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
from urllib.parse import urlsplit, quote
import uuid

import check_gates
import workflow
import workflow_storage as storage

STATE = 'build/static-release.json'
ID = re.compile(r'^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')
MAX_BYTES = 25 * 1024 * 1024


def now():
    return datetime.now(timezone.utc).isoformat()


def target(root):
    config = storage.read(root, 'funnel.json') or {}
    if config.get('backend', {}).get('provider') != 'none':
        raise ValueError('Use the existing Worker publisher for a lead-inbox project')
    item = config.get('static_hosting', {})
    if not ID.fullmatch(item.get('project', '')) or not re.fullmatch(r'[a-f0-9]{32}', item.get('account_id', '')):
        raise ValueError('Select the exact existing Pages project and 32-character account ID')
    branch = item.get('production_branch', '')
    if not branch or len(branch)>100 or re.search(r'[\s\x00-\x1f]',branch) or branch.startswith('-'):
        raise ValueError('Select the actual Pages production branch')
    url = urlsplit(item.get('production_url', ''))
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.port or url.path not in {'','/'} or url.query or url.fragment:
        raise ValueError('Use the exact final HTTPS production origin')
    requested = config.get('requested_hosts', {}).get('public')
    if requested and url.hostname != requested:
        raise ValueError('The requested custom hostname is still pending; a temporary URL does not complete it')
    if not requested and url.hostname != item['project'] + '.pages.dev':
        raise ValueError('Confirm a custom host in requested_hosts.public or use the exact project.pages.dev hostname')
    return {**item, 'production_url':url.scheme+'://'+url.netloc}


def assets(root):
    public = storage.path_inside(root, 'public')
    if not public.is_dir() or not (public/'index.html').is_file():
        raise ValueError('Static publication requires public/index.html; never upload the project/guide directory')
    result = {}
    for item in sorted(public.rglob('*')):
        rel = item.relative_to(public)
        if item.is_symlink():
            raise ValueError('Do not publish symlinked assets')
        if any(p.startswith('.') or p in {'node_modules','build','scripts','research','docs','guide'} for p in rel.parts):
            raise ValueError('Private/tooling directory inside public: '+str(rel))
        if not item.is_file():
            continue
        if rel.name in {'_worker.js','_routes.json','wrangler.jsonc','funnel.json','package.json','credentials.json','secrets.json'} or item.suffix.lower() in {'.pem','.key','.p12','.pfx'}:
            raise ValueError('Static publication must not expose credentials, functions or owner configuration')
        if item.stat().st_size > MAX_BYTES:
            raise ValueError('Static asset exceeds the bounded publisher size: '+str(rel))
        result[rel.as_posix()] = hashlib.sha256(item.read_bytes()).hexdigest()
    return result


@contextmanager
def lease(root):
    path = storage.path_inside(root,'.secrets/static-publish.lock')
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    with path.open('a') as handle:
        os.chmod(path,0o600)
        try:
            fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('A static publish/reconciliation already owns this project')
        try:
            yield
        finally:
            fcntl.flock(handle,fcntl.LOCK_UN)


def inspect(root):
    root=Path(root).resolve()
    try:
        selected=target(root)
        assets(root)
    except (OSError, ValueError, TypeError) as error:
        return {'stage':'static_publish_setup','status':'blocked','failures':[str(error)],
                'next_action':{'instruction':'Verify the intended account, create/select a Pages project only with setup authority, associate the requested host and preserve existing DNS. Record static_hosting.project/account_id/production_branch/production_url, then refresh local evidence.'}}
    current=check_gates.source_snapshot(root)['source_fingerprint']
    record=storage.read(root,STATE,{})
    if record.get('status') in {'started','outcome_unknown','uploaded_unverified'}:
        return {'stage':'static_publish_recovery','status':'blocked','failures':['Reconcile existing deployment '+record['id']+' before any retry.'], 'operation':record}
    if record.get('status')=='verified' and record.get('source_fingerprint')==current and record.get('target')==selected:
        return {'stage':'static_published','status':'pass','failures':[], 'url':selected['production_url'],
                'verification':record['verification'],'verified_at':record['verified_at'], 'fresh_live_check':False,
                'next_action':{'instruction':'Return the saved verified static result with its timestamp; do not claim an actual purchase, booking or live enquiry was performed.'}}
    approval=workflow.check_publish_approval(root)
    if approval['status']=='blocked':
        return {'stage':'static_publish_authorization','status':'blocked','failures':approval['failures'], 'target':selected}
    return {'stage':'static_publish_ready','status':'pass','failures':[], 'target':selected, 'source_fingerprint':current}


def command(root, args, selected, timeout=120):
    # Installed npm executables are symlinks by design; do not use artifact guards here.
    executable=root/'node_modules/.bin/wrangler'
    if not executable.is_file():
        raise ValueError('Install locked project dependencies before Pages publication')
    env={**os.environ,'CLOUDFLARE_ACCOUNT_ID':selected['account_id'],'WRANGLER_SEND_METRICS':'false'}
    return subprocess.run([str(executable),*args],cwd=root,env=env,capture_output=True,text=True,timeout=timeout,check=True).stdout


def provider_preflight(root, selected, run=command):
    identity=run(root,['whoami'],selected)
    if selected['account_id'] not in identity:
        raise ValueError('The authenticated account did not match the selected account')
    # Read only. The operator selects an existing project; this command creates nothing.
    projects=run(root,['pages','project','list'],selected)
    rows=[line for line in projects.splitlines() if re.search(r'(?<![a-z0-9-])'+re.escape(selected['project'])+r'(?![a-z0-9-])', line) and selected['project']+'.pages.dev' in line]
    if not rows:
        raise ValueError('The selected Pages project/production hostname was not confirmed in this account')
    if not any(re.search(r'(?<![A-Za-z0-9_./-])'+re.escape(selected['production_branch'])+r'(?![A-Za-z0-9_./-])', row) for row in rows):
        raise ValueError('The selected Pages production branch was not confirmed; do not deploy a preview as production')
    result={'account_verified':True, 'project_verified':True, 'checked_at':now(),
            'issuer':'static_publish.provider_preflight','target':selected,
            'source_fingerprint':check_gates.source_snapshot(Path(root))['source_fingerprint']}
    storage.write(Path(root),'build/static-preflight.json',result)
    return result


class SameHost(urllib.request.HTTPRedirectHandler):
    def __init__(self, origin):
        self.origin=origin
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(newurl).scheme+'://'+urlsplit(newurl).netloc != self.origin:
            raise ValueError('Production verification redirected to an unexpected host')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch_bytes(url, origin):
    request=urllib.request.Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache'})
    with urllib.request.build_opener(SameHost(origin)).open(request,timeout=20) as response:
        if response.status != 200:
            raise ValueError('Production asset did not return HTTP 200')
        data=response.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES:
        raise ValueError('Production response exceeded the verification bound')
    return data


def verify(root, record, fetcher=fetch_bytes):
    current=check_gates.source_snapshot(root)['source_fingerprint']
    if current != record['source_fingerprint'] or target(root)!=record['target'] or assets(root)!=record['assets']:
        raise ValueError('Source/target changed after publication began; reconcile the recorded revision before releasing another')
    origin=record['target']['production_url']
    checked=[]
    for name,expected in record['assets'].items():
        if name in {'_headers','_redirects'}:
            continue
        url=origin+('/' if name=='index.html' else '/'+quote(name,safe='/'))
        if hashlib.sha256(fetcher(url,origin)).hexdigest()!=expected:
            raise ValueError('Production content does not match the reviewed asset: '+name)
        checked.append(name)
    config=storage.read(root,'funnel.json')
    conversion=config.get('conversion',{})
    return {'public_asset_hashes_verified':checked,'selected_conversion':conversion,
            'conversion_scope':'Local browser checks plus verified deployed bytes; no external booking, purchase, call or submission performed.',
            'requested_host_verified':True,'checked_at':now()}


def publish(root, run=command, fetcher=fetch_bytes):
    root=Path(root).resolve()
    with lease(root):
        status=inspect(root)
        if status['stage']!='static_publish_ready':
            raise ValueError('Static release is not ready: '+json.dumps(status))
        selected=target(root)
        preflight=provider_preflight(root,selected,run)
        # Recheck after provider I/O and before the only external mutation.
        approval=workflow.check_publish_approval(root)
        if approval['status']=='blocked' or approval['source_fingerprint']!=status['source_fingerprint']:
            raise ValueError('Publication authority changed during preflight')
        record={'schema_version':1,'id':uuid.uuid4().hex,'status':'started','source_fingerprint':status['source_fingerprint'],
                'target':selected,'assets':assets(root),'started_at':now(),'preflight':preflight}
        previous=storage.read(root,STATE)
        if previous:
            storage.write(root,'build/static-releases/'+previous['id']+'.json',previous)
        storage.write(root,STATE,record)
        try:
            run(root,['pages','deploy','./public','--project-name',selected['project'],'--branch',selected['production_branch'],
                      '--commit-message','Reviewed static release '+record['id']],selected,600)
        except Exception:
            record.update(status='outcome_unknown',error='Provider did not confirm the deployment. Reconcile before retry; no secret/provider payload is retained here.')
            storage.write(root,STATE,record)
            raise
        record.update(status='uploaded_unverified')
        storage.write(root,STATE,record)
        record['verification']=verify(root,record,fetcher)
        record.update(status='verified',verified_at=now())
        storage.write(root,STATE,record)
        return record


def reconcile(root, fetcher=fetch_bytes):
    root=Path(root).resolve()
    with lease(root):
        record=storage.read(root,STATE)
        if not record or record['status'] not in {'started','outcome_unknown','uploaded_unverified','verified'}:
            raise ValueError('No existing deployment to reconcile')
        record['verification']=verify(root,record,fetcher)
        record.update(status='verified',verified_at=now())
        storage.write(root,STATE,record)
        return record


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['status','publish','reconcile'])
    p.add_argument('project',type=Path)
    a=p.parse_args()
    try:
        result={'status':inspect,'publish':publish,'reconcile':reconcile}[a.command](a.project)
        print(json.dumps(result,indent=2));return int(result.get('status')=='blocked')
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as error:
        # Provider exceptions may contain command credentials/output; do not dump them.
        print(json.dumps({'status':'blocked','error':str(error) if isinstance(error,ValueError) else 'Static publication failed; inspect the saved operation before retry.'}));return 1


if __name__=='__main__':
    sys.exit(main())
