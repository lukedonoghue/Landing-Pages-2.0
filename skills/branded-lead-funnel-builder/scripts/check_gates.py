#!/usr/bin/env python3
"""Bind readiness claims to current source and inspectable evidence; not author authentication."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

VERSION = '1.0.0'
STATES = {'pass', 'pass_with_warnings', 'blocked', 'not_applicable'}
GATES = {'copy', 'performance', 'browser_compat', 'images', 'static', 'browser', 'visual', 'catalogue', 'crm', 'tracking', 'deployment'}
MODES = {'preview', 'handoff', 'live'}
EXCLUDED_DIRS = {'.secrets', '.git', 'node_modules', 'build', 'screenshots', '.wrangler', '.venv', '__pycache__', '.pytest_cache', 'coverage', 'test-results', 'playwright-report'}
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
    elif gate == 'images':
        if not report.get('image_review', {}).get('passed') or not report.get('plan_sha256'):
            errors.append('Image review must identify its current plan and reviewed asset results')
    elif gate == 'copy':
        if not report.get('copy_audit') or report['copy_audit'].get('overall_status') not in ('pass','pass_with_warnings'):
            errors.append('Copy evidence needs a current executed copy-library audit')
    elif gate == 'visual':
        if 'screenshot' not in kinds or not report.get('reviewer') or not report.get('observations'):
            errors.append('Visual evidence requires reviewer, specific observations, and screenshots')
    elif gate == 'catalogue':
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
        elif gate == 'deployment' and not {'http_trace', 'deployment_record'}.issubset(kinds):
            errors.append('Deployment evidence needs destination HTTP and deployment record artifacts')
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
    if quality.get('complete_workflow'):
        gates += ['copy', 'performance', 'browser_compat']
        if config.get('images', {}).get('enabled', True): gates.append('images')
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
            snapshot = read_json(resolve_inside(root, args.snapshot))
            if source_snapshot(root)['source_fingerprint'] != snapshot['source_fingerprint']:
                raise ValueError('Source changed since snapshot; rerun affected checks against a new snapshot')
            path = resolve_inside(root, args.report)
            report = read_json(path)
            failures = validate_report(root, report, snapshot, args.gate)
            if failures:
                raise ValueError('; '.join(failures))
            manifest = read_json(manifest_path) if manifest_path.is_file() else {}
            if (manifest.get('snapshot', {}).get('source_fingerprint'), manifest.get('snapshot', {}).get('mode')) != (snapshot['source_fingerprint'], snapshot['mode']):
                manifest = {'schema_version': 1, 'snapshot': snapshot, 'gates': {}}
            manifest['gates'][args.gate] = {'status': report['status'], 'recorded_at': now(), 'report': path.relative_to(root).as_posix(), 'report_sha256': file_hash(path)}
            write_json(manifest_path, manifest)
            print(json.dumps({'status': report['status'], 'gate': args.gate, 'manifest': str(manifest_path)}, indent=2))
            return 1 if report['status'] == 'blocked' else 0
        result = check(root, args.mode, manifest_path)
        print(json.dumps(result, indent=2))
        return 1 if result['status'] == 'blocked' else 0
    except (ValueError, OSError, KeyError) as error:
        print(json.dumps({'status': 'blocked', 'failures': [str(error)]}, indent=2))
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
