"""Resume-safe native image handoff; reuse image_workflow's attempts and budgets.

No provider call, new API key, paid fallback or generated customer identity.
The active host executes the returned request with its actual image tool. A CLI
without that tool returns the same request, not another model retry.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import shutil
import image_workflow as images
import guide_quality as quality
import workflow_storage as storage

RECORD = 'build/guide-image-handoff.json'


def fingerprint(root, guide):
    return storage_hash({'business': quality.business_fingerprint(root),
                         'guide': {k: v for k, v in guide.items() if k != 'images'}})


def storage_hash(value):
    return images.sha(json.dumps(value, sort_keys=True).encode())


def request(root, asset_id, placement, prompt, reason):
    root = Path(root).resolve()
    with storage.lock(root), images.plan_lock(root/'image-plan.json'):
        guide = quality.read(root, 'build/guide.json')
        if placement not in {'cover', *[c['id'] for c in guide.get('chapters', [])]}:
            raise ValueError('Choose the actual guide cover or chapter ID')
        if len(prompt.strip()) < 30 or len(reason.strip()) < 25:
            raise ValueError('Describe the explanatory image and why sourced imagery is insufficient')
        existing = storage.read(root, RECORD)
        binding = fingerprint(root, guide)
        if existing and not existing.get('resolved'):
            if (existing.get('input_fingerprint'), existing.get('asset_id'), existing.get('placement'), existing.get('prompt')) != (binding, asset_id, placement, prompt):
                raise ValueError('Reconcile the saved image request before replacing its inputs')
            return inspect(root)
        plan_path = quality.local(root, 'image-plan.json')
        plan = images.load_plan(plan_path)
        asset = images.get_asset(plan, asset_id)
        if asset.get('trust_class') != 'illustrative' or asset.get('generation', {}).get('mode', 'native') != 'native':
            raise ValueError('Guide handoffs use native illustrations only, never proof or API generation')
        pending = [a for a in plan.get('generation_attempts', []) if a['asset_id'] == asset_id and a['status'] == 'pending']
        if pending:
            attempt = pending[0]
            if not attempt['request']['prompt'].startswith(prompt.strip() + '\n\nUsage:'):
                raise ValueError('An image attempt already exists with different instructions')
            packet = {'attempt_id': attempt['id'], 'mode': 'native', 'tool': 'image_gen', 'arguments': attempt['request']}
        else:
            packet = images.prepare_generation(plan, asset_id, prompt, root=root)
            images.save_plan(plan_path, plan, 'guide-image-requested', asset_id)
        storage.write(root, RECORD, {'schema_version': 1, 'asset_id': asset_id,
            'placement': placement, 'prompt': prompt, 'reason': reason,
            'input_fingerprint': binding, 'attempt_id': packet['attempt_id'], 'resolved': False})
        return inspect(root)


def inspect(root):
    record = storage.read(root, RECORD)
    if not record or record.get('resolved'):
        return None
    guide = quality.read(root, 'build/guide.json')
    if record.get('schema_version') != 1 or record.get('input_fingerprint') != fingerprint(root, guide):
        return {'stage': 'guide_image_handoff', 'kind': 'reconcile',
                'instruction': 'Guide/business inputs changed. Preserve the original attempt and reconcile before generating again.'}
    plan = images.load_plan(Path(root)/'image-plan.json')
    attempts = [a for a in plan.get('generation_attempts', []) if a['id'] == record['attempt_id'] and a['asset_id'] == record['asset_id']]
    if len(attempts) != 1:
        raise ValueError('The saved guide image attempt is missing; preserve its record')
    attempt = attempts[0]
    if attempt['status'] == 'registered':
        return {'stage': 'guide_image_handoff', 'kind': 'work', 'role': 'assets',
                'instruction': 'Link the registered image using guide_image_handoff.py link, then resume the guide. Do not generate it again.'}
    return {'stage': 'guide_image_handoff', 'kind': 'image_handoff',
            'instruction': 'Use the actual native image tool in the active host for this saved request. If unavailable, return this request to an image-capable session or acquire a permitted source image. Do not invoke a model CLI again or switch to API billing.',
            'asset_id': record['asset_id'], 'placement': record['placement'],
            'reason': record['reason'], 'attempt_id': attempt['id'],
            'tool': 'image_gen', 'arguments': attempt['request'],
            'next': 'Register the actual returned file and tool evidence with image_workflow.py register-generation, then run guide_image_handoff.py link.',
            'limits': ['Preparation is not image generation.', 'Never generate or substitute a reviewer/customer avatar.']}


def link(root, caption):
    root = Path(root).resolve()
    with storage.lock(root):
        record = storage.read(root, RECORD)
        if not record:
            raise ValueError('There is no saved guide image request')
        if record.get('resolved'):
            guide = quality.read(root, 'build/guide.json')
            row = next((i for i in guide.get('images', []) if i['id'] == record['asset_id']), None)
            if not row or quality.sha(quality.local(root, row['path'], 'public/assets')) != row['sha256']:
                raise ValueError('The previously linked image changed; inspect it before continuing')
            return row
        state = inspect(root)
        if state.get('kind') != 'work':
            raise ValueError('Register the real tool output first; an unexecuted request is not an image')
        if len(caption.strip()) < 20 or 'illustrat' not in caption.lower():
            raise ValueError('Use a descriptive caption that discloses the illustration')
        plan = images.load_plan(root/'image-plan.json')
        asset = images.get_asset(plan, record['asset_id'])
        attempt = next(a for a in plan['generation_attempts'] if a['id'] == record['attempt_id'])
        if asset.get('provenance', {}).get('attempt_id') != record['attempt_id']:
            raise ValueError('The asset was replaced by a different attempt')
        images.check_artifact(root, asset['source']);images.check_artifact(root, attempt['tool_evidence'])
        source = quality.local(root, asset['source']['path'], 'research')
        evidence = quality.local(root, attempt['tool_evidence']['path'], 'research')
        dest = quality.local(root, 'public/assets/images/guide/' + record['asset_id'] + '-' + asset['source']['sha256'][:12] + source.suffix, 'public/assets')
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and quality.sha(dest) != quality.sha(source):
            raise ValueError('Preserve the existing guide image rather than overwrite it')
        shutil.copy2(source, dest)
        row = {'id': record['asset_id'], 'placement': record['placement'],
               'path': dest.relative_to(root).as_posix(), 'sha256': quality.sha(dest),
               'source_type': 'generated', 'role': 'illustration', 'caption': caption,
               'purpose': record['reason'], 'rights_basis': asset['provenance']['rights_evidence'],
               'evidence_path': evidence.relative_to(root).as_posix(), 'evidence_sha256': quality.sha(evidence)}
        guide = quality.read(root, 'build/guide.json')
        rows = guide.setdefault('images', [])
        old = next((i for i in rows if i['id'] == row['id'] or i.get('placement') == 'cover' and row['placement'] == 'cover'), None)
        if old and old != row:
            raise ValueError('An authored image occupies this slot. Reconcile it before linking the new illustration')
        if not old:
            rows.append(row)
        storage.write(root, 'build/guide.json', guide)
        storage.write(root, RECORD, {**record, 'resolved': True, 'output_sha256': row['sha256']})
        return row



def use_source(root, source_asset_id, caption, generation_not_running=False):
    """Explicit licensed/supplied fallback; never race an uncertain tool call."""
    if not generation_not_running:
        raise ValueError('Confirm that no generation is running before replacing this request')
    root = Path(root).resolve()
    with storage.lock(root), images.plan_lock(root/'image-plan.json'):
        record = storage.read(root, RECORD)
        if not record or record.get('resolved'):
            raise ValueError('Choose an unresolved image handoff')
        guide = quality.read(root, 'build/guide.json')
        if fingerprint(root, guide) != record['input_fingerprint']:
            raise ValueError('Guide inputs changed; reconcile before linking a fallback')
        plan = images.load_plan(root/'image-plan.json')
        asset = images.get_asset(plan, source_asset_id)
        provenance = asset.get('provenance', {})
        if provenance.get('kind') != 'actual' or not provenance.get('rights_evidence') or provenance.get('rights') not in images.RIGHTS - {'generated'}:
            raise ValueError('Acquire the permitted source through image_workflow before using it')
        source = images.check_artifact(root, asset.get('source'))
        evidence = images.check_artifact(root, provenance.get('evidence'))
        quality.local(root, source.relative_to(root).as_posix(), 'research')
        quality.local(root, evidence.relative_to(root).as_posix(), 'research')
        if len(caption.strip()) < 15:
            raise ValueError('Describe the actual supplied/source image')
        dest = quality.local(root, 'public/assets/images/guide/'+record['asset_id']+'-'+quality.sha(source)[:12]+source.suffix, 'public/assets')
        row = {'id': record['asset_id'], 'placement': record['placement'], 'path': dest.relative_to(root).as_posix(),
               'sha256': quality.sha(source), 'source_type': 'website' if provenance.get('source_url') else 'supplied',
               'role': 'explanatory', 'caption': caption, 'purpose': record['reason'],
               'rights_basis': provenance['rights_evidence'], 'evidence_path': evidence.relative_to(root).as_posix(),
               'evidence_sha256': quality.sha(evidence)}
        if provenance.get('source_url'):row['source_url'] = provenance['source_url']
        if any(i['id'] == row['id'] or row['placement']=='cover' and i.get('placement')=='cover' for i in guide.get('images', [])):
            raise ValueError('Preserve the image already occupying this guide slot')
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and quality.sha(dest) != row['sha256']:
            raise ValueError('Preserve the existing source image')
        shutil.copy2(source, dest)
        attempt = images.pending_attempt(plan, record['asset_id'], record['attempt_id'])
        attempt.update(status='failed', finished_at=images.now(), reason='Native request explicitly reconciled without a running call; permitted source used instead.')
        target = images.get_asset(plan, record['asset_id'])
        target.update(stage='acquired', source=asset['source'], provenance=provenance, generated_disclosure=None)
        images.save_plan(root/'image-plan.json', plan, 'guide-source-fallback', target['id'])
        guide.setdefault('images', []).append(row)
        storage.write(root, 'build/guide.json', guide)
        storage.write(root, RECORD, {**record, 'resolved': True, 'source_fallback': True, 'output_sha256': row['sha256']})
        return row


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['request', 'status', 'link', 'use-source']);p.add_argument('project', type=Path)
    p.add_argument('--asset');p.add_argument('--placement');p.add_argument('--prompt', default='')
    p.add_argument('--reason', default='');p.add_argument('--caption', default='')
    p.add_argument('--source-asset');p.add_argument('--confirmed-no-running-generation', action='store_true')
    a = p.parse_args()
    try:
        result = request(a.project, a.asset, a.placement, a.prompt, a.reason) if a.command == 'request' else link(a.project, a.caption) if a.command == 'link' else use_source(a.project, a.source_asset, a.caption, a.confirmed_no_running_generation) if a.command == 'use-source' else inspect(a.project)
        print(json.dumps(result or {'status': 'no_pending_image'}, indent=2));return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({'kind': 'blocked', 'error': str(error)}));return 1

if __name__ == '__main__':
    raise SystemExit(main())
