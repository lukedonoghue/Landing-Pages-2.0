#!/usr/bin/env python3
"""Bind readiness claims to current source and inspectable evidence; not author authentication."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
import math
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

VERSION = '1.2.0'
STATES = {'pass', 'pass_with_warnings', 'blocked', 'not_applicable'}
GATES = {'control_review', 'copy', 'reviews', 'rendered_copy', 'performance', 'browser_compat', 'images', 'static', 'browser', 'visual', 'catalogue', 'local_journey', 'crm', 'tracking', 'deployment'}
MODES = {'preview', 'handoff', 'live'}
# Host-only settings are not deployed inputs; staged QA must remain portable.
EXCLUDED_DIRS = {'.codex', '.claude', '.secrets', '.git', 'node_modules', 'build', 'screenshots', '.wrangler', '.venv', '__pycache__', '.pytest_cache', 'coverage', 'test-results', 'playwright-report'}
SECRET_SUFFIXES = {'.pem', '.key', '.p12', '.pfx'}

def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def excluded(path):
    secret = '.secrets' in path.parts or path.name.startswith(('.env', '.dev.vars')) or path.suffix.lower() in SECRET_SUFFIXES or path.name in {'.DS_Store', 'credentials.json', 'secrets.json'}
    if path.parts and path.parts[0] == 'public':
        return secret
    return secret or any(part in EXCLUDED_DIRS for part in path.parts)

def source_snapshot(root):
    root = root.resolve()
    files = {}
    for directory, subdirs, names in os.walk(root, followlinks=False):
        parent = Path(directory)
        for name in sorted(subdirs + names):
            path = parent / name
            rel = path.relative_to(root)
            if excluded(rel):
                if name in subdirs:
                    subdirs.remove(name)
                continue
            if path.is_symlink():
                raise ValueError(f'Source symlink is not supported; copy the intended input: {rel}')
            if path.is_file():
                files[rel.as_posix()] = file_hash(path)
    if not files:
        raise ValueError('Project has no source files')
    packed = json.dumps(files, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    return {'files': files, 'source_fingerprint': hashlib.sha256(packed).hexdigest()}

def resolve_inside(root, value):
    path = Path(value)
    path = (root / path).resolve() if not path.is_absolute() else path.resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f'Evidence must be inside the project: {value}')
    relative = path.relative_to(root.resolve())
    if any(part in {'.secrets', '.git', 'node_modules', '.wrangler'} for part in relative.parts) or path.name.startswith(('.env', '.dev.vars')) or path.suffix.lower() in SECRET_SUFFIXES:
        raise ValueError(f'Secret/runtime paths cannot be evidence: {relative}')
    return path

def read_json(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError(f'Expected a JSON object: {path}')
    return data

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def parsed_time(value):
    date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if date.tzinfo is None:
        raise ValueError('Timestamp requires a UTC offset')
    return date

def local_journey_errors(root, report):
    """Check correlation across actual verifier artifacts, not a green status alone."""
    errors=[]
    try:
        url=urlsplit(report.get('target',{}).get('url',''))
        if url.scheme not in {'http','https'} or url.hostname not in {'localhost','127.0.0.1','::1'} or url.username or url.password or url.query or url.fragment:
            errors.append('Local journey needs the actual loopback destination')
        if url.port is not None and not 1<=url.port<=65535:errors.append('Local journey port is invalid')
    except ValueError:errors.append('Local journey needs the actual loopback destination')
    if report.get('target',{}).get('mode') not in {'preview','handoff'}:errors.append('Local journey belongs to preview/handoff evidence')
    execution=report.get('execution',{})
    if execution.get('kind')!='automated' or execution.get('exit_code')!=0 or not execution.get('command'):
        errors.append('Local journey needs an executed successful browser verification command')
    if report.get('fully_verified') is not True or report.get('readiness')!='local-journey-verified' or report.get('mode')!='synthetic-browser-journey':
        errors.append('Read-only or incomplete checks are not local journey proof')
    assertions=report.get('journey_assertions',{})
    if any(assertions.get(key) is not True for key in ('named_login','redirect','brochure','receipt_correlation','crm_update','metrics','logout')):
        errors.append('Local journey is missing a required executed assertion')
    def evidence(kind):
        matches=[item for item in report.get('artifacts',[]) if isinstance(item,dict) and item.get('type')==kind]
        if len(matches)!=1:raise ValueError('Local journey needs one unambiguous '+kind+' artifact')
        return json.loads(resolve_inside(root,matches[0]['path']).read_text())
    try:
        proof=evidence('db_receipt');events=evidence('event_trace');trace=evidence('http_trace');dashboard=evidence('dashboard_result')
        for key in ('lead_id','receipt_id','stored_receipt_id'):UUID(proof[key])
        measured=proof.get('visit_event_id') is not None
        if measured:UUID(proof['visit_event_id'])
        if proof.get('evidence_source')!='authenticated-worker-api-backed-by-D1' or proof.get('database_id')!='local-D1' or proof['receipt_id']!=proof['stored_receipt_id']:
            errors.append('Local stored receipt is not correlated with the accepted lead')
        observed=report.get('observations',{})
        if any(observed.get(key)!=proof.get(key) for key in ('lead_id','receipt_id','stored_receipt_id','visit_event_id','database_id','evidence_source')):
            errors.append('Local report observations differ from the receipt artifact')
        matched=[event for event in events if isinstance(event,dict) and event.get('event_id')==proof['visit_event_id'] and event.get('linked_lead_id')==proof['lead_id'] and all(event.get(key) is measured for key in ('analytics_consent','valid_visitor_id','measured'))]
        if not matched or matched[0].get('dimensions')!=dashboard.get('filters'):
            errors.append('Local visit policy and dashboard cohort do not match the saved lead')
        lead_path='/api/admin/leads/'+proof['lead_id']
        required=[('/api/leads','POST'),(lead_path,'GET'),(lead_path+'/notes','POST'),('/api/auth/logout','POST')]
        if any(not any(isinstance(row,dict) and row.get('path')==route and row.get('method')==method and row.get('status') in (200,201) for row in trace) for route,method in required):
            errors.append('Local trace is missing a successful submission, CRM operation or logout')
        if not any(row.get('path')==lead_path and row.get('method')=='PATCH' and row.get('status')==200 for row in trace if isinstance(row,dict)):
            recovered=evidence('crm_recovery');intent=recovered.get('status_intent',{})
            if recovered.get('evidence_source')!='authenticated-worker-api-backed-by-D1' or recovered.get('lead_id')!=proof['lead_id'] or intent.get('lead_id')!=proof['lead_id'] or intent.get('target')!='qualified' or not isinstance(intent.get('expected_version'),int) or intent['expected_version']<1 or recovered.get('observed_version')!=intent['expected_version']+1 or recovered.get('observed_status')!='qualified':
                errors.append('Recovered CRM stage needs an exact-version intent and authenticated persisted-state observation')
        before,after=dashboard['before'],dashboard['after']
        values=[before[key] for key in ('visitors','conversions','leads')]+[after[key] for key in ('visitors','conversions','leads','conversion_rate')]
        if any(isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<0 for value in values):
            raise ValueError('Local dashboard evidence has invalid measurements')
        cohort_ok=(all(after[key]>=before[key]+1 for key in ('visitors','conversions','leads')) if measured else after['visitors']==before['visitors'] and after['conversions']==before['conversions'] and after['leads']>=before['leads']+1)
        if not cohort_ok or after['conversions']>after['visitors']:
            errors.append('Local dashboard does not match the configured measurement policy and accepted lead')
        expected=after['conversions']/after['visitors']*100 if after['visitors'] else 0
        if abs(after['conversion_rate']-expected)>0.011:errors.append('Local conversion rate does not match its cohort')
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:
        errors.append('Local journey evidence is incomplete or invalid: '+str(error))
    return errors

def deployment_identity_errors(root, report, snapshot):
    errors=[]
    try:
        artifacts=report.get('artifacts',[])
        identities=[a for a in artifacts if a.get('type')=='deployment_identity']
        runtimes=[a for a in artifacts if a.get('type')=='runtime_identity']
        if len(identities)!=1 or len(runtimes)!=1:raise ValueError('Deployment needs one control-plane identity and before/after runtime identity artifact')
        identity=read_json(resolve_inside(root,identities[0]['path']))
        runtime=read_json(resolve_inside(root,runtimes[0]['path']))
        if identity!=report.get('deployment_identity'):errors.append('Deployment report and identity artifact disagree')
        if identity.get('evidence_source')!='cloudflare-wrangler-deployments-and-version-api':errors.append('Identity must come from the actual Cloudflare deployment/version inspection')
        for key in ('release_id','version_id','database_id'):
            if UUID(identity[key]).version not in range(1,9):errors.append('Invalid deployed '+key)
        if not isinstance(identity.get('account_id'),str) or len(identity['account_id'])!=32 or any(c not in '0123456789abcdef' for c in identity['account_id']):errors.append('Cloudflare account identity is missing')
        active=identity.get('active_versions',[])
        if len(active)!=1 or active[0].get('version_id')!=identity['version_id'] or active[0].get('percentage')!=100:errors.append('Identity is not for one fully active version')
        if identity.get('source_fingerprint')!=snapshot['source_fingerprint']:errors.append('Deployed source marker differs from reviewed release source')
        if not identity.get('worker') or not identity.get('script_etag'):errors.append('Worker/bundle identity is incomplete')
        if identity.get('url','').rstrip('/')!=report.get('target',{}).get('url','').rstrip('/'):errors.append('Runtime origin differs from the inspected deployment')
        if identity.get('database_id')!=report.get('observations',{}).get('database_id'):errors.append('Live receipt was not correlated with the inspected D1 binding')
        for when in ('before','after'):
            observed=runtime[when]
            if any(observed.get(key)!=identity[key] for key in ('version_id','release_id','source_fingerprint')):
                errors.append('Running identity differs '+when+' the live journey')
            if parsed_time(observed['observed_at'])<parsed_time(snapshot['created_at']):errors.append('Runtime identity predates the live snapshot')
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:
        errors.append('Deployment identity evidence is invalid: '+str(error))
    return errors

def validate_report(root, report, snapshot, gate):
    errors = []
    if report.get('schema_version') != 1 or report.get('gate') != gate:
        errors.append('Report requires schema_version=1 and matching gate')
    if report.get('status') not in STATES:
        errors.append('Report has no valid status')
    if report.get('source_fingerprint') != snapshot['source_fingerprint']:
        errors.append('Report source fingerprint does not match the snapshot')
    if report.get('target', {}).get('mode') != snapshot['mode']:
        errors.append('Report target.mode does not match snapshot mode')
    tool = report.get('tool', {})
    if not tool.get('name') or not tool.get('version'):
        errors.append('Report must identify tool/reviewer and version')
    try:
        measured = parsed_time(report.get('executed_at', ''))
        if measured < parsed_time(snapshot['created_at']):
            errors.append('Report predates the snapshot')
        if (measured - datetime.now(timezone.utc)).total_seconds() > 300:
            errors.append('Report timestamp is in the future')
    except (TypeError, ValueError):
        errors.append('Report executed_at must be an ISO timestamp with timezone')
    if not report.get('checks'):
        errors.append('Report requires actual check results, not a status alone')
    artifacts = report.get('artifacts', [])
    kinds = set()
    if not isinstance(artifacts, list):
        errors.append('artifacts must be a list')
        artifacts = []
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            errors.append('Each artifact must have path, type and sha256')
            continue
        kinds.add(artifact.get('type'))
        try:
            path = resolve_inside(root, artifact.get('path', ''))
            if not path.is_file():
                errors.append(f"Missing artifact: {artifact.get('path')}")
            elif not artifact.get('sha256') or file_hash(path) != artifact['sha256']:
                errors.append(f"Artifact hash mismatch: {artifact.get('path')}")
        except ValueError as error:
            errors.append(str(error))
    if gate == 'browser':
        if 'screenshot' not in kinds or not report.get('viewports'):
            errors.append('Browser evidence requires viewports and screenshot artifacts')
        if report.get('execution', {}).get('kind') != 'automated':
            errors.append('Browser evidence must identify an automated execution')
        viewports = report.get('viewports', [])
        widths = {item.get('width') for item in viewports if isinstance(item, dict)}
        if not {360, 390, 768, 1024, 1180, 1280, 1440}.issubset(widths):
            errors.append('Browser evidence does not cover every required width')
        if not any(item.get('width') == 1280 and item.get('height', 10000) <= 600 for item in viewports if isinstance(item, dict)):
            errors.append('Browser evidence must include low-height laptop coverage')
    elif gate == 'performance':
        if report.get('execution', {}).get('kind') != 'automated' or not {'lighthouse_json'}.intersection(kinds):
            errors.append('Performance needs an executed Lighthouse audit and its raw JSON artifact')
        if not report.get('metrics'):
            errors.append('Performance metrics are missing')
    elif gate == 'browser_compat':
        engines = report.get('engines', [])
        names = {item if isinstance(item, str) else item.get('name', item.get('engine')) for item in engines}
        if not {'chromium', 'webkit'}.issubset(names):
            errors.append('Compatibility evidence requires both Chromium and WebKit')
        if report.get('execution', {}).get('kind') != 'automated' or 'screenshot' not in kinds:
            errors.append('Compatibility evidence requires actual browser execution and screenshots')
    elif gate == 'reviews':
        try:
            import review_workflow
            actual = review_workflow.audit_project(root, rendered=True)
            if actual['status'] == 'blocked':
                errors += actual['failures']
            expected = report.get('review_intelligence', {})
            if expected.get('manifest_sha256') != actual.get('manifest_sha256'):
                errors.append('Review gate report is stale for the current review manifest')
            if expected.get('static_testimonial_count') != actual.get('static_testimonial_count') or expected.get('dynamic_provider_count') != actual.get('dynamic_provider_count'):
                errors.append('Review gate counts differ from the current compiled selection')
        except (OSError, ValueError, KeyError, TypeError) as error:
            errors.append('Review evidence is invalid: ' + str(error))
    elif gate == 'images':
        if not report.get('image_review', {}).get('passed') or not report.get('plan_sha256'):
            errors.append('Image review must identify its current plan and reviewed asset results')
    elif gate == 'control_review':
        import control_review
        errors += control_review.inspect(root).get('failures', [])
    elif gate == 'copy':
        import workflow
        if workflow.lightweight(root):
            errors += workflow.copy_state(root).get('failures', [])
        elif not report.get('copy_audit') or report['copy_audit'].get('overall_status') not in ('pass','pass_with_warnings'):
            errors.append('Copy evidence needs a current executed copy-library audit')
    elif gate == 'local_journey':
        errors += local_journey_errors(root,report)
    elif gate == 'rendered_copy':
        try:
            import copy_parity
            captures = [a for a in artifacts if a.get('type') == 'rendered_copy_capture']
            masters = [a for a in artifacts if a.get('type') == 'copy_master']
            if len(captures) != 1 or len(masters) != 1 or masters[0].get('path') != 'build/page-copy.json':
                raise ValueError('Rendered copy needs one actual capture and the canonical build/page-copy.json')
            actual = copy_parity.audit(root, captures[0]['path'])
            errors += actual['failures']
            if actual['target'] != report.get('target') or actual['source_fingerprint'] != snapshot['source_fingerprint'] or actual['copy_sha256'] != report.get('copy_sha256'):
                errors.append('Rendered copy report is for a different target, source or master')
            if {a['path'] for a in actual['artifacts']} != {a.get('path') for a in artifacts}:
                errors.append('Rendered copy report must retain every input artifact')
            if report.get('execution', {}).get('kind') != 'automated' or report.get('execution', {}).get('exit_code') != 0:
                errors.append('Rendered copy needs a successful executed comparison')
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
            errors.append('Rendered copy evidence is invalid: ' + str(error))
    elif gate == 'visual':
        if 'screenshot' not in kinds or not report.get('reviewer') or not report.get('observations'):
            errors.append('Visual evidence requires reviewer, specific observations, and screenshots')
        provenance = report.get('review_provenance', {})
        mode = provenance.get('mode') if isinstance(provenance, dict) else None
        required = ('reviewer_identity', 'reviewer_task_id', 'builder_identity', 'builder_task_id')
        if mode not in {'independent', 'self_review'} or any(not isinstance(provenance.get(key), str) or not provenance[key].strip() for key in required):
            errors.append('Visual acceptance must disclose independent/self_review mode and reviewer/builder task provenance')
        elif mode == 'independent' and provenance['reviewer_task_id'] == provenance['builder_task_id']:
            errors.append('Independent visual acceptance requires a separate reviewer task; a second pass in the builder task is self_review')
        elif mode == 'self_review' and provenance['reviewer_task_id'] != provenance['builder_task_id']:
            errors.append('Self-review provenance must identify the same builder task')
        if report.get('reviewed_source_fingerprint') != snapshot['source_fingerprint']:
            errors.append('Visual acceptance must name the exact reviewed source fingerprint')
        findings, retests = report.get('findings'), report.get('retests')
        if not isinstance(findings, list) or not isinstance(retests, list):
            errors.append('Visual acceptance must include findings and retests lists in the existing report')
        else:
            finding_ids = set()
            for finding in findings:
                if not isinstance(finding, dict) or not finding.get('id') or not finding.get('finding') or not finding.get('evidence') or finding.get('disposition') not in {'fixed', 'accepted_limit', 'blocked', 'no_change'}:
                    errors.append('Each visual finding needs id, concrete finding, evidence and truthful disposition')
                    continue
                finding_ids.add(finding['id'])
            retest_ids = {row.get('finding_id') for row in retests if isinstance(row, dict) and row.get('result') == 'pass' and row.get('evidence')}
            if any(finding.get('disposition') == 'fixed' and finding.get('id') not in retest_ids for finding in findings if isinstance(finding, dict)):
                errors.append('Every fixed visual finding needs a passing evidence-backed retest')
            if any(isinstance(row, dict) and row.get('finding_id') not in finding_ids for row in retests):
                errors.append('Visual retests must refer to a recorded finding')
        if not isinstance(report.get('limits'), list):
            errors.append('Visual acceptance must state unresolved limits')
    elif gate == 'catalogue':
        config = read_json(root / 'funnel.json')
        if config.get('quality', {}).get('reader_guide_version', 0) >= 1:
            try:
                import guide_quality
                import thank_you_page
                guide_build = guide_quality.inspect_build(root)
                guide_quality.inspect_review(root, guide_build)
                thank_you_page.inspect(root)
            except (ValueError, OSError, KeyError, TypeError) as error:
                errors.append('Reader guide/confirmation: ' + str(error))
        count = report.get('page_count', 0)
        if not isinstance(count, int) or count < 1 or report.get('reviewed_pages', []) != list(range(1, count + 1)):
            errors.append('Catalogue evidence must review every rendered page in order')
        if not {'pdf', 'rendered_page'}.issubset(kinds):
            errors.append('Catalogue evidence requires PDF and rendered-page artifacts')
        if isinstance(count, int) and len([item for item in artifacts if isinstance(item, dict) and item.get('type') == 'rendered_page']) < count:
            errors.append('Catalogue evidence requires a rendered artifact for every page')
    elif gate in {'crm', 'tracking', 'deployment'}:
        execution = report.get('execution', {})
        if execution.get('kind') != 'automated' or not execution.get('command') or execution.get('exit_code') != 0:
            errors.append('Live evidence requires an executed verification command and successful exit code')
        url = report.get('target', {}).get('url', '')
        if not url.startswith('https://') or 'localhost' in url or '127.0.0.1' in url:
            errors.append('Live evidence requires the actual HTTPS destination URL')
        if snapshot['mode'] != 'live':
            errors.append('Live evidence cannot be attached to a preview/handoff snapshot')
        if gate == 'crm':
            observations = report.get('observations', {})
            receipt = observations.get('receipt_id')
            if not receipt or receipt != observations.get('stored_receipt_id') or not observations.get('database_id'):
                errors.append('CRM evidence must correlate an accepted receipt with the stored D1 receipt and database')
            if not {'http_trace', 'db_receipt'}.issubset(kinds):
                errors.append('CRM evidence needs redacted HTTP and database receipt artifacts')
        elif gate == 'tracking' and not {'event_trace', 'dashboard_result'}.issubset(kinds):
            errors.append('Tracking evidence needs event and dashboard query artifacts')
        elif gate == 'deployment':
            if not {'http_trace', 'deployment_record'}.issubset(kinds):errors.append('Deployment evidence needs destination HTTP and deployment record artifacts')
            errors += deployment_identity_errors(root,report,snapshot)
    if report.get('status') in {'pass', 'pass_with_warnings'}:
        if report.get('failures'):
            errors.append('Passing report contains failures')
        checks = report.get('checks', {})
        def failed_check(value):
            if value is False:
                return True
            if isinstance(value, dict):
                if value.get('status') in {'blocked', 'fail', 'failed', 'error'} or value.get('passed') is False:
                    return True
                return any(failed_check(item) for item in value.values())
            if isinstance(value, list):
                return any(failed_check(item) for item in value)
            return False
        if failed_check(checks):
            errors.append('Passing report contains failed or blocked checks')
    return errors

def required_gates(root, mode):
    gates = ['static', 'browser', 'visual']
    config = read_json(root / 'funnel.json') if (root / 'funnel.json').is_file() else {}
    quality = config.get('quality', {})
    if not config.get('development_fixture') and (quality.get('contract_version',0) >= 2 or quality.get('control_review') or config.get('guided_workflow')):
        gates.append('control_review')
    if quality.get('complete_workflow'):
        gates += ['copy', 'performance', 'browser_compat']
        if config.get('backend',{}).get('provider')!='none':
            gates.append('rendered_copy')
            if mode in {'preview','handoff'}:gates.append('local_journey')
        if not config.get('development_fixture'):
            if quality.get('review_intelligence_version',0) >= 1: gates.append('reviews')
            gates.append('images')
    catalogue = config.get('catalogue', {})
    if not isinstance(catalogue, dict) or catalogue.get('enabled') is not False:
        gates.append('catalogue')
    if mode == 'live':
        gates += ['crm', 'tracking', 'deployment']
    return gates

def check(root, mode, manifest_path):
    errors, warnings, results = [], [], {}
    if not manifest_path.is_file():
        return {'status': 'blocked', 'mode': mode, 'failures': ['Evidence manifest is missing'], 'gates': {}}
    config = read_json(root/'funnel.json') if (root/'funnel.json').is_file() else {}
    if config.get('quality', {}).get('reader_guide_version', 0) >= 1 and config.get('catalogue', {}).get('enabled') is False:
        try:
            import guide_quality
            guide_quality.validate_omission(root, config['catalogue'])
        except (ValueError, OSError, KeyError, TypeError) as error:
            errors.append('Reader-guide omission: ' + str(error))
    manifest = read_json(manifest_path)
    snapshot = manifest.get('snapshot', {})
    current = source_snapshot(root)
    if snapshot.get('mode') != mode:
        errors.append('Manifest mode differs from requested claim; create and test a matching snapshot')
    if snapshot.get('source_fingerprint') != current['source_fingerprint']:
        changed = sorted(name for name in set(snapshot.get('files', {})) | set(current['files']) if snapshot.get('files', {}).get(name) != current['files'].get(name))
        errors.append('Source changed after evidence was captured: ' + ', '.join(changed[:20]))
    for gate in required_gates(root, mode):
        entry = manifest.get('gates', {}).get(gate)
        gate_errors = []
        if not entry:
            gate_errors.append('Required gate has no evidence')
        else:
            try:
                path = resolve_inside(root, entry['report'])
                if not path.is_file() or file_hash(path) != entry.get('report_sha256'):
                    gate_errors.append('Report changed or is missing')
                else:
                    report = read_json(path)
                    gate_errors += validate_report(root, report, snapshot, gate)
                    if report.get('status') in {'blocked', 'not_applicable'}:
                        gate_errors.append('Required gate is ' + report['status'])
                    if report.get('status') != entry.get('status'):
                        gate_errors.append('Recorded status differs from report')
                    if report.get('status') == 'pass_with_warnings':
                        warnings.append(f"{gate}: " + '; '.join(report.get('warnings', ['Review report warnings'])))
            except (KeyError, ValueError, OSError) as error:
                gate_errors.append(str(error))
        results[gate] = {'status': 'blocked' if gate_errors else entry['status'], 'failures': gate_errors}
        errors.extend(f'{gate}: {message}' for message in gate_errors)
    return {'status': 'blocked' if errors else ('pass_with_warnings' if warnings else 'pass'), 'mode': mode,
            'source_fingerprint': current['source_fingerprint'], 'gates': results, 'failures': errors, 'warnings': warnings,
            'limits': ['Hashes detect changed artifacts; they do not authenticate the report author.', 'Preview and handoff do not prove live delivery or production tracking.']}

def record_report(root, gate, report_path, snapshot_path='build/gate-snapshot.json', manifest_path='build/gates.json'):
    import workflow_storage
    if gate not in GATES:raise ValueError('Unknown quality gate')
    root=Path(root).resolve()
    with workflow_storage.lock(root):
        destination=resolve_inside(root,manifest_path)
        if destination.relative_to(root).parts[0]!='build':raise ValueError('Manifest must be under build/')
        snapshot=read_json(resolve_inside(root,snapshot_path))
        if source_snapshot(root)['source_fingerprint']!=snapshot['source_fingerprint']:
            raise ValueError('Source changed since snapshot; rerun affected checks against a new snapshot')
        path=resolve_inside(root,report_path);report=read_json(path)
        failures=validate_report(root,report,snapshot,gate)
        if failures:raise ValueError('; '.join(failures))
        manifest=read_json(destination) if destination.is_file() else {}
        if (manifest.get('snapshot',{}).get('source_fingerprint'),manifest.get('snapshot',{}).get('mode'))!=(snapshot['source_fingerprint'],snapshot['mode']):
            manifest={'schema_version':1,'snapshot':snapshot,'gates':{}}
        manifest['gates'][gate]={'status':report['status'],'recorded_at':now(),'report':path.relative_to(root).as_posix(),'report_sha256':file_hash(path)}
        workflow_storage.write(root,destination.relative_to(root).as_posix(),manifest)
        return {'status':report['status'],'gate':gate,'manifest':str(destination)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ('snapshot', 'record', 'check'):
        p = sub.add_parser(command)
        p.add_argument('project_root', type=Path)
        p.add_argument('--manifest', default='build/gates.json')
        if command in {'snapshot', 'check'}:
            p.add_argument('--mode', choices=sorted(MODES), required=True)
        if command == 'snapshot':
            p.add_argument('--out', default='build/gate-snapshot.json')
        if command == 'record':
            p.add_argument('--snapshot', default='build/gate-snapshot.json')
            p.add_argument('--gate', choices=sorted(GATES), required=True)
            p.add_argument('--report', required=True)
    args = parser.parse_args()
    root = args.project_root.expanduser().resolve()
    try:
        if args.command == 'snapshot':
            data = {'schema_version': 1, 'created_at': now(), 'mode': args.mode, 'project_root': str(root), 'tool': {'name': 'check_gates', 'version': VERSION}, **source_snapshot(root)}
            path = resolve_inside(root, args.out)
            if 'build' not in path.relative_to(root).parts:
                raise ValueError('Snapshot must be under build/ so evidence does not change source identity')
            write_json(path, data)
            print(json.dumps({'status': 'pass', 'snapshot': str(path), 'source_fingerprint': data['source_fingerprint'], 'files': len(data['files'])}, indent=2))
            return 0
        manifest_path = resolve_inside(root, args.manifest)
        if 'build' not in manifest_path.relative_to(root).parts:
            raise ValueError('Manifest must be under build/')
        if args.command == 'record':
            result=record_report(root,args.gate,args.report,args.snapshot,args.manifest)
            print(json.dumps(result,indent=2))
            return 1 if result['status']=='blocked' else 0
        result = check(root, args.mode, manifest_path)
        print(json.dumps(result, indent=2))
        return 1 if result['status'] == 'blocked' else 0
    except (ValueError, OSError, KeyError) as error:
        print(json.dumps({'status': 'blocked', 'failures': [str(error)]}, indent=2))
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
