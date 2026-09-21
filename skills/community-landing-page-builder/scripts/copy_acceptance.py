#!/usr/bin/env python3
"""Check a real editorial review's evidence and freshness, not conversion quality."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

CRITERIA = {
    'message_match', 'claim_support', 'outcome_and_mechanism', 'objection_coverage',
    'headline_story', 'voice_and_density', 'offer_consistency', 'reference_adaptation',
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(root, value):
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError('Review inputs must use project-relative file paths')
    path = (root / value).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Review input escapes the project')
    return path


def text(path):
    if path.suffix != '.json':
        return path.read_text(encoding='utf-8')
    def strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, list):
            for item in value:
                yield from strings(item)
        elif isinstance(value, dict):
            for key, item in value.items():
                if key not in {'id', 'claim_ids', 'source_ids', 'notes', 'evidence', 'approved_asset'}:
                    yield from strings(item)
    return '\n'.join(strings(read(path)))


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def anchored(excerpt, corpus):
    return nonempty(excerpt) and excerpt in corpus


def prepare(root, copy, brief, sources):
    if not sources:
        raise ValueError('Supply the inspected claim ledger/source evidence with --source')
    rows = [('copy', copy), ('brief', brief)] + [
        (f'source{i + 1}', value) for i, value in enumerate(sources)
    ]
    if len({inside(root, value) for _, value in rows}) != len(rows):
        raise ValueError('Copy, brief and source inputs must be different files')
    return {'schema_version': 1, 'inputs': {
        key: {'path': inside(root, value).relative_to(root).as_posix(),
              'sha256': digest(inside(root, value))} for key, value in rows
    }}


def verify(root, snapshot_path, review_path):
    failures = []
    snapshot, review = read(snapshot_path), read(review_path)
    if snapshot.get('schema_version') != 1:
        raise ValueError('Unsupported copy-review snapshot version')
    inputs = snapshot.get('inputs', {})
    if not {'copy', 'brief'} <= inputs.keys() or not any(k.startswith('source') for k in inputs):
        raise ValueError('Snapshot needs copy, brief and source evidence')
    if review.get('inputs_sha256') != digest(snapshot_path):
        failures.append('Review is stale for the input snapshot')
    corpora = {}
    for key, row in inputs.items():
        path = inside(root, row['path'])
        if digest(path) != row.get('sha256'):
            failures.append(f'Input changed after review preparation: {key}')
        corpora[key] = text(path)
    reviewer = review.get('reviewer', {})
    if not isinstance(reviewer, dict) or reviewer.get('mode') not in {'independent', 'self_review'} or not nonempty(reviewer.get('identity')):
        failures.append('Record the actual reviewer identity and independent/self_review mode')
    checks = review.get('checks', [])
    if not isinstance(checks, list) or len(checks) != len(CRITERIA) or any(not isinstance(c, dict) for c in checks):
        raise ValueError('Review needs eight structured criterion checks')
    if {c.get('criterion') for c in checks} != CRITERIA:
        failures.append('Review must cover all eight criteria exactly once')
    for check in checks:
        criterion, evidence = check.get('criterion'), check.get('evidence', {})
        if not isinstance(evidence, dict):
            raise ValueError('Criterion evidence must be an object')
        if check.get('verdict') != 'pass':
            failures.append(f'Unresolved editorial criterion: {criterion}')
        if not anchored(evidence.get('copy_excerpt'), corpora['copy']) or not nonempty(evidence.get('explanation')):
            failures.append(f'Missing current copy excerpt or editorial reasoning: {criterion}')
        if criterion in {'message_match', 'objection_coverage'} and not anchored(evidence.get('brief_excerpt'), corpora['brief']):
            failures.append(f'Missing actual brief requirement: {criterion}')
        refs = evidence.get('source_refs', [])
        if not isinstance(refs, list):
            raise ValueError('source_refs must be a list')
        if criterion in {'claim_support', 'outcome_and_mechanism', 'reference_adaptation'} and not refs:
            failures.append(f'Missing inspected source evidence: {criterion}')
        for ref in refs:
            if not isinstance(ref, dict):
                raise ValueError('Source references must be objects')
            sid = ref.get('id')
            if not isinstance(sid, str) or not sid.startswith('source') or sid not in corpora or not anchored(ref.get('excerpt'), corpora[sid]):
                failures.append(f'Source excerpt is absent or not from an evidence input: {criterion}')
    summary = review.get('reader_summary', {})
    for key in ('offer', 'buyer_benefit', 'reason_to_choose', 'next_step'):
        answer = summary.get(key, {}) if isinstance(summary, dict) else {}
        if not isinstance(answer, dict) or not nonempty(answer.get('answer')) or not anchored(answer.get('copy_excerpt'), corpora['copy']):
            failures.append(f'Cold-reader answer is missing or unanchored: {key}')
    challenge = review.get('strongest_challenge', {})
    if (not isinstance(challenge, dict)
            or not anchored(challenge.get('copy_excerpt'), corpora['copy'])
            or not nonempty(challenge.get('risk')) or not nonempty(challenge.get('resolution'))
            or challenge.get('status') not in {'resolved', 'accepted_with_reason'}):
        failures.append('Review must resolve the strongest actual objection to accepting this copy')
    if review.get('decision') != 'pass' or review.get('unresolved_findings') != []:
        failures.append('Copy is not accepted or unresolved findings remain')
    return {
        'status': 'blocked' if failures else 'pass', 'failures': failures,
        'warnings': ['Review is self-review, not independent'] if isinstance(reviewer, dict) and reviewer.get('mode') == 'self_review' else [],
        'limits': 'Validates current evidence and review completeness, not semantic truth, reviewer independence, conversion uplift or best possible copy.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    prepare_cmd = sub.add_parser('prepare')
    prepare_cmd.add_argument('--project', required=True)
    prepare_cmd.add_argument('--copy', required=True)
    prepare_cmd.add_argument('--brief', required=True)
    prepare_cmd.add_argument('--source', action='append', required=True)
    prepare_cmd.add_argument('--out', default='build/copy-review-inputs.json')
    verify_cmd = sub.add_parser('verify')
    verify_cmd.add_argument('--project', required=True)
    verify_cmd.add_argument('--inputs', default='build/copy-review-inputs.json')
    verify_cmd.add_argument('--review', default='build/copy-editorial-review.json')
    args = parser.parse_args()
    try:
        root = Path(args.project).resolve()
        if args.command == 'prepare':
            result = prepare(root, args.copy, args.brief, args.source)
            output = inside(root, args.out)
            if output in {inside(root, row['path']) for row in result['inputs'].values()}:
                raise ValueError('Snapshot output cannot overwrite an input')
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
            print(json.dumps({'status': 'ready_for_editorial_review', 'snapshot': str(output), 'inputs_sha256': digest(output)}))
            return 0
        result = verify(root, inside(root, args.inputs), inside(root, args.review))
        print(json.dumps(result, indent=2))
        return 1 if result['status'] == 'blocked' else 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        print(json.dumps({'status': 'blocked', 'failures': [str(error)]}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
