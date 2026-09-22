#!/usr/bin/env python3
"""Evidence-bound first-build comparison, repair checklist and final acceptance.

The host performs editorial/pixel judgment. This module enforces real artifacts,
anchored observations, unchanged baselines, completed repairs and fresh retests.
It does not generate copy or certify conversion uplift from a numeric score.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
import uuid

import check_gates
import copy_acceptance
import workflow_storage as storage

from runtime_context import skill_root

VERSION = '1.0.0'
BASE = 'build/control-review'
REFERENCE_ID = '6aebe071e132'
REFERENCE_URL = 'https://bluemountain1.pagedemo.co/'
CRITERIA = (
    'first_screen_offer', 'headline_story', 'customer_benefits',
    'reason_to_choose', 'mechanism_and_proof', 'plain_direct_copy',
    'objections_and_process', 'cta_and_conversion', 'layout_and_mobile',
)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(root, name):
    return storage.read(root, name)


def asset(root, name):
    # Use the existing secret/path boundary; reject symlinks too.
    path = storage.path_inside(root, name)
    check_gates.resolve_inside(root, name)
    if not path.is_file():
        raise ValueError('Missing review artifact: ' + name)
    return path


def nonempty(value):
    return isinstance(value, str) and len(value.strip()) >= 12


def enabled(root):
    config = read(root, 'funnel.json') or {}
    return not config.get('development_fixture') and (config.get('quality', {}).get('contract_version', 0) >= 2 or config.get('quality', {}).get('control_review') is True or bool(config.get('guided_workflow')))


def fingerprint(root):
    # Copy lives under build/, so it must be bound explicitly as well as source.
    paths = [p for p in ('build/page-copy.json', 'build/page-copy.md',
                        'build/strategy-brief.md', 'build/claim-ledger.md',
                        'docs/CLAIM-LEDGER.md', 'build/client-copy-brief.json')
             if (Path(root) / p).is_file()]
    return {'source_fingerprint': check_gates.source_snapshot(Path(root))['source_fingerprint'],
            'inputs': {p: sha(asset(root, p)) for p in paths}}


def layout_reference():
    path = skill_root(__file__) / 'references/control-layout.json'
    value = json.loads(path.read_text())
    return {'sha256': sha(path), 'map': value}


def reference():
    exported = skill_root(__file__) / 'references/control-reference.json'
    if exported.is_file():
        value = json.loads(exported.read_text())
        if value.get('url') != REFERENCE_URL or hashlib.sha256(value.get('text','').encode()).hexdigest() != value.get('sha256'):
            raise ValueError('Exported control reference is invalid')
        return value
    library = skill_root(__file__) / 'references/copy-library/sources.jsonl'
    for line in library.read_text(encoding='utf-8').splitlines():
        item = json.loads(line)
        if item.get('id') == REFERENCE_ID:
            text = item.get('text', '')
            if hashlib.sha256(text.encode()).hexdigest() != item.get('text_sha256'):
                raise ValueError('Bundled control reference hash is invalid')
            return {'id': REFERENCE_ID, 'url': REFERENCE_URL, 'captured_at': item['captured_at'],
                    'text': text, 'sha256': item['text_sha256'],
                    'scope': 'Archived copy and section structure, not a current pixel capture.'}
    raise ValueError('Bundled Blue Mountain control reference is missing')


def capture(root, name, expected=None):
    value = read(root, name)
    if not value or value.get('schema_version') != 1 or value.get('execution') != 'playwright':
        raise ValueError('Use the real capture-control.mjs output, not a pass flag')
    if expected is not None and value.get('input') != expected:
        raise ValueError('Capture does not match the current source/copy')
    views = value.get('views', [])
    if not isinstance(views, list) or not {390, 1440}.issubset({v.get('width') for v in views}):
        raise ValueError('Control comparison needs mobile and desktop captures')
    for view in views:
        screenshot = asset(root, view['screenshot'])
        if screenshot.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n' or sha(screenshot) != view['sha256']:
            raise ValueError('Screenshot is missing, changed or not a PNG')
        header = screenshot.read_bytes()[:24]
        if len(header) < 24 or int.from_bytes(header[16:20], 'big') != view['width'] or int.from_bytes(header[20:24], 'big') < view.get('height', 1):
            raise ValueError('Screenshot dimensions do not match the recorded viewport')
        if not nonempty(view.get('text')) or not view.get('headings'):
            raise ValueError('Capture has no rendered text/headline hierarchy')
    return value


def prepare(root, capture_path, builder):
    root = Path(root).resolve()
    if not builder.strip():
        raise ValueError('Identify the actual initial builder task/session')
    current = fingerprint(root)
    initial = capture(root, capture_path, current)
    with storage.lock(root):
        if read(root, BASE + '/baseline.json'):
            raise ValueError('Initial baseline already exists. Preserve it; use a new round for a new build.')
        control = reference()
        control['layout_reference'] = layout_reference()
        storage.write(root, BASE + '/reference.json', control)
        # Capture is embedded to preserve the initial copy even after edits.
        baseline = {'schema_version': 1, 'round_id': uuid.uuid4().hex,
                    'created_at': check_gates.now(), 'builder_task_id': builder,
                    'input': current, 'capture': initial, 'reference_sha256': control['sha256']}
        storage.write(root, BASE + '/baseline.json', baseline)
    return {'status': 'comparison_required', 'baseline_sha256': sha(root / (BASE + '/baseline.json')),
            'criteria': list(CRITERIA), 'next_action': 'Compare the actual first build with the control and write comparison.json. Do not edit before recording the checklist.'}


def anchored(value, corpus):
    return isinstance(value, str) and bool(value.strip()) and value in corpus


def review_checks(review, corpus, control_text):
    failures = []
    reviewer = review.get('reviewer', {})
    if reviewer.get('mode') not in {'independent', 'self_review'} or not reviewer.get('task_id'):
        failures.append('Disclose actual reviewer task and independent/self_review mode')
    rows = review.get('checks', [])
    if not isinstance(rows, list) or len(rows) != len(CRITERIA) or {r.get('criterion') for r in rows if isinstance(r, dict)} != set(CRITERIA):
        return failures + ['Cover every control criterion exactly once']
    for row in rows:
        label = row['criterion']
        if row.get('verdict') not in {'pass', 'improve'} or not nonempty(row.get('observation')):
            failures.append('Missing concrete observation: ' + label)
        if not anchored(row.get('draft_excerpt'), corpus):
            failures.append('Draft evidence is not present in rendered text: ' + label)
        if not anchored(row.get('control_excerpt'), control_text):
            failures.append('Control evidence is not present in the archived reference: ' + label)
    return failures


def comparison(root):
    baseline = read(root, BASE + '/baseline.json')
    draft = read(root, BASE + '/comparison.json')
    control = read(root, BASE + '/reference.json')
    if not baseline or not draft or not control:
        raise ValueError('Initial baseline, reference and comparison are required')
    if sha(asset(root, BASE + '/baseline.json')) != draft.get('baseline_sha256'):
        raise ValueError('Comparison does not reference the immutable initial baseline')
    if hashlib.sha256(control.get('text', '').encode()).hexdigest() != baseline.get('reference_sha256'):
        raise ValueError('Control reference changed')
    corpus = '\n'.join(v['text'] for v in baseline['capture']['views'])
    failures = review_checks(draft, corpus, control['text'])
    if draft.get('layout_reference_sha256') != control.get('layout_reference',{}).get('sha256') or not nonempty(draft.get('layout_observation')):
        failures.append('Compare the rendered draft to the reviewed Blue Mountain layout map and identify concrete layout differences')
    reviewer = draft.get('reviewer', {})
    if reviewer.get('mode') == 'independent' and reviewer.get('task_id') == baseline['builder_task_id']:
        failures.append('Builder self-review cannot be labeled independent')
    issues = draft.get('issues')
    if not isinstance(issues, list):
        raise ValueError('Comparison must produce an explicit issues checklist, including [] for evidenced no-change')
    ids = set()
    for issue in issues:
        if not isinstance(issue, dict) or not issue.get('id') or issue['id'] in ids:
            raise ValueError('Every issue needs a unique stable ID')
        ids.add(issue['id'])
        if issue.get('criterion') not in CRITERIA or issue.get('priority') not in {'P1', 'P2', 'P3'}:
            failures.append('Invalid issue criterion or priority: ' + issue['id'])
        for field in ('problem', 'why_it_matters', 'proposed_change', 'acceptance_test'):
            if not nonempty(issue.get(field)):
                failures.append('Actionable ' + field + ' is required: ' + issue['id'])
        if not issue.get('selector') or not anchored(issue.get('before'), corpus):
            failures.append('Issue needs a selector and exact initial rendered excerpt: ' + issue['id'])
    for row in draft.get('checks', []):
        if row.get('verdict') == 'improve' and not any(i.get('criterion') == row['criterion'] for i in issues):
            failures.append('Improvement criterion is missing a checklist item: ' + row['criterion'])
    if failures:
        raise ValueError('; '.join(failures))
    return baseline, draft, control


def inspect(root):
    root = Path(root).resolve()
    stage = 'control_comparison'
    try:
        if not read(root, BASE + '/baseline.json'):
            return {'status': 'blocked', 'stage': 'control_comparison', 'failures': ['Capture the initial page and preserve its baseline before reviewing it.']}
        baseline, draft, control = comparison(root)
        stage = 'control_repair'
        current = fingerprint(root)
        final_path = BASE + '/final-capture.json'
        resolutions = read(root, BASE + '/resolutions.json')
        if not resolutions:
            return {'status': 'blocked', 'stage': 'control_repair', 'issues': draft['issues'],
                    'failures': ['Apply the recorded checklist and record each resolution before final review.']}
        if resolutions.get('comparison_sha256') != sha(root / (BASE + '/comparison.json')):
            raise ValueError('Repair record is for a different checklist')
        if not (root / final_path).is_file():
            return {'status': 'blocked', 'stage': 'control_retest', 'failures': ['Recapture the improved page at mobile and desktop sizes.']}
        stage = 'control_retest'
        final = capture(root, final_path, current)
        if any(v.get('errors') or v.get('overflow') for v in final['views']):
            raise ValueError('Final capture has runtime errors or horizontal overflow')
        if final.get('capture_id') == baseline['capture'].get('capture_id'):
            raise ValueError('Final acceptance must recapture the page, not reuse the initial capture')
        corpus = '\n'.join(v['text'] for v in final['views'])
        rows = resolutions.get('items', [])
        if not isinstance(rows, list) or len(rows) != len(draft['issues']) or {r.get('id') for r in rows} != {i['id'] for i in draft['issues']}:
            raise ValueError('Every initial issue must have exactly one final disposition')
        failures = []
        for row in rows:
            issue = next(i for i in draft['issues'] if i['id'] == row['id'])
            if row.get('status') != 'fixed' or not anchored(row.get('after'), corpus):
                failures.append('Issue is unresolved or replacement is not rendered: ' + row['id'])
            if row.get('after') == issue['before'] and issue['criterion'] != 'layout_and_mobile':
                failures.append('Copy fix retained exactly the same weak wording: ' + row['id'])
            if not nonempty(row.get('verification')):
                failures.append('Explain the actual retest: ' + row['id'])
        acceptance = read(root, BASE + '/acceptance.json') or {}
        if acceptance.get('capture_sha256') != sha(root / final_path) or acceptance.get('resolutions_sha256') != sha(root / (BASE + '/resolutions.json')):
            failures.append('Final acceptance is missing or stale')
        failures += review_checks(acceptance, corpus, control['text'])
        if any(row.get('verdict') != 'pass' for row in acceptance.get('checks', [])):
            failures.append('Final control criteria still need improvement')
        if acceptance.get('reviewer', {}).get('mode') == 'independent' and acceptance['reviewer'].get('task_id') in {baseline['builder_task_id'], resolutions.get('builder_task_id')}:
            failures.append('Final independent reviewer must not be the builder or repairer')
        if acceptance.get('unresolved_findings') != []:
            failures.append('Final acceptance has unresolved or missing findings')
        if not nonempty(acceptance.get('headline_only_story')) or not nonempty(acceptance.get('cold_reader_summary')):
            failures.append('Read only the actual headlines and explain the offer as a first-time customer')
        return {'status': 'blocked' if failures else 'pass', 'stage': 'control_retest',
                'failures': failures, 'issue_count': len(rows), 'input': current,
                'warnings': ['Control copy and layout map derive from archived source, including the visually inspected 2024 screenshot. They do not represent a fresh live control render; retrieve the referenced screenshot for direct pixel comparison when available.',
                             'Editorial judgments are evidence-backed reviewer assessments, not measured conversion uplift.']}
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        return {'status': 'blocked', 'stage': stage, 'failures': [str(error)]}


def report(root):
    result = inspect(root)
    if result['status'] != 'pass':
        return result
    snapshot = read(root, 'build/gate-snapshot.json')
    if not snapshot or snapshot['source_fingerprint'] != result['input']['source_fingerprint']:
        raise ValueError('Create a current gate snapshot after improvements and before recording final control evidence')
    artifacts = []
    for path in sorted((Path(root) / BASE).glob('*.json')):
        if path.name == 'result.json':
            continue
        artifacts.append({'path': path.relative_to(root).as_posix(), 'type': 'control_review', 'sha256': sha(path)})
    for capture_name in ('final-capture.json', 'baseline.json'):
        cap = read(root, BASE + '/' + capture_name)
        for view in (cap['capture'] if capture_name == 'baseline.json' else cap)['views']:
            artifacts.append({'path': view['screenshot'], 'type': 'screenshot', 'sha256': view['sha256']})
    value = {'schema_version': 1, 'gate': 'control_review', 'status': 'pass',
             'source_fingerprint': snapshot['source_fingerprint'], 'target': {'mode': snapshot['mode']},
             'tool': {'name': 'control_review', 'version': VERSION}, 'executed_at': check_gates.now(),
             'checks': {'baseline_preserved': True, 'checklist_resolved': True, 'final_evidence_current': True},
             'artifacts': artifacts, 'warnings': result['warnings'], 'failures': []}
    with storage.lock(root):
        storage.write(root, BASE + '/result.json', value)
    check_gates.record_report(Path(root), 'control_review', BASE + '/result.json')
    return value


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['fingerprint', 'prepare', 'check', 'record'])
    p.add_argument('project', type=Path)
    p.add_argument('--capture', default=BASE + '/initial-capture.json')
    p.add_argument('--builder', default='')
    a = p.parse_args()
    try:
        result = {'fingerprint': lambda: fingerprint(a.project), 'prepare': lambda: prepare(a.project, a.capture, a.builder),
                  'check': lambda: inspect(a.project), 'record': lambda: report(a.project)}[a.command]()
        print(json.dumps(result, indent=2))
        return int(result.get('status') == 'blocked')
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({'status': 'blocked', 'failures': [str(error)]}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
