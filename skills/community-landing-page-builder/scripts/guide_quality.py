"""Source- and byte-bound buyer-guide requirements; semantic review is never inferred.

This module is deliberately offline. It validates captured evidence, not live
truth, ownership, publication permission or the honesty of the reviewer.
"""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image, ImageStat

CRITERIA = ('reader_value', 'benefit_clarity', 'source_fidelity', 'practical_detail',
            'imagery_relevance', 'readability', 'coherent_next_step')
PLACEHOLDER = re.compile(r'WORKFLOW_TEMPLATE_INCOMPLETE|specific outcome headline|the right service for what comes next|a practical guide to a better fit', re.I)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def norm(text):
    return ' '.join(str(text).split())


def local(root, name, prefix=None):
    root = Path(root).resolve()
    if not isinstance(name, str) or not name or Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError('Use a project-relative artifact path: ' + str(name))
    path = root / name
    if any(part.startswith(('.env', '.dev.vars')) or part in {'.secrets', '.git'} for part in Path(name).parts):
        raise ValueError('Private material cannot be guide evidence')
    if any(p.is_symlink() for p in [path, *path.parents] if p != root.parent):
        raise ValueError('Guide paths must not contain symlinks')
    if not path.resolve().is_relative_to(root) or prefix and not path.resolve().is_relative_to(root / prefix):
        raise ValueError('Guide path escapes its allowed directory: ' + name)
    return path


def read(root, name):
    value = json.loads(local(root, name).read_text())
    if not isinstance(value, dict):
        raise ValueError('Expected an object: ' + name)
    return value


def required(root):
    config = read(root, 'funnel.json')
    return config.get('quality', {}).get('reader_guide_version', 0) >= 1


def business_fingerprint(root):
    value = read(root, 'funnel.json')
    client = value.get('client', {})
    material = {k: value.get(k) for k in ('audience', 'offer', 'cta', 'follow_up_promise', 'conversion', 'brief')}
    material['client'] = {k: client.get(k) for k in ('name', 'website', 'region', 'phone_display', 'phone_uri')}
    return hashlib.sha256(json.dumps(material, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def validate_omission(root, catalogue):
    if len(norm(catalogue.get('omission_reason', ''))) < 30:
        raise ValueError('A guide omission requires a substantive buyer-research reason')
    evidence = catalogue.get('omission_evidence', [])
    if not evidence:
        raise ValueError('A guide omission requires captured source evidence, not a missing-image or time excuse')
    for item in evidence:
        path = local(root, item.get('path'), 'research')
        quote = norm(item.get('excerpt', ''))
        if not path.is_file() or sha(path) != item.get('sha256') or len(quote) < 20 or quote not in norm(path.read_text()):
            raise ValueError('Guide omission evidence is missing, unanchored or changed')


def validate_content(root, data):
    """Return hashes of every input used, or reject an incomplete reader guide."""
    if data.get('document_type') != 'buyer_guide' or data.get('workflow_ready') is not True:
        raise ValueError('Complete the researched buyer_guide, not the generic catalogue template')
    text = norm(json.dumps({k: data.get(k) for k in ('title', 'subtitle', 'reader_promise', 'chapters', 'checklist', 'next_step')}, ensure_ascii=False))
    authors = data.get('author_task_ids')
    if not isinstance(authors, list) or not authors or any(not isinstance(a, str) or not a.strip() for a in authors):
        raise ValueError('Record the actual guide author task/session IDs for honest review independence')
    if PLACEHOLDER.search(text):
        raise ValueError('Replace generic scaffold/instruction wording with actual buyer-facing advice')
    for key in ('title', 'subtitle', 'audience', 'reader_promise'):
        if len(norm(data.get(key, ''))) < 10:
            raise ValueError('A specific ' + key + ' is required')
    inputs, sources = {}, {}
    for source in data.get('sources', []):
        ident = source.get('id')
        if not ident or ident in sources or source.get('kind') not in {'business', 'industry', 'user'}:
            raise ValueError('Give every captured source a unique ID and truthful kind')
        path = local(root, source.get('path'), 'research')
        if not path.is_file() or sha(path) != source.get('sha256'):
            raise ValueError('Captured guide source is missing or changed: ' + str(ident))
        if source['kind'] != 'user':
            url = urlsplit(source.get('url', ''))
            if url.scheme != 'https' or not url.hostname or url.username or url.password:
                raise ValueError('Record the actual HTTPS source URL without credentials')
        if not source.get('title') or not source.get('retrieved_at'):
            raise ValueError('Source title and retrieval date are required')
        sources[ident] = (source, norm(path.read_text()))
        inputs[source['path']] = sha(path)
    if not sources or not any(s[0]['kind'] in {'business', 'user'} for s in sources.values()):
        raise ValueError('Use actual business research or supplied business evidence, not industry text alone')
    chapters = data.get('chapters', [])
    if not isinstance(chapters, list) or len(chapters) < 2:
        raise ValueError('A useful guide needs at least two substantive buyer decisions')
    seen = set()
    for chapter in chapters:
        ident = chapter.get('id')
        if not ident or ident in seen:
            raise ValueError('Each buyer decision needs a unique chapter ID')
        seen.add(ident)
        for field in ('headline', 'reader_question', 'why_it_matters'):
            if len(norm(chapter.get(field, ''))) < 12:
                raise ValueError(ident + ': explain the buyer question and meaningful benefit')
        paragraphs = chapter.get('paragraphs')
        if not isinstance(paragraphs, list) or len(paragraphs) < 2 or any(not isinstance(p, str) for p in paragraphs) or len(' '.join(paragraphs).split()) < 55:
            raise ValueError(ident + ': add substantive explanations and trade-offs, not a slogan')
        if not isinstance(chapter.get('takeaways'), list) or len(chapter['takeaways']) < 2 or any(len(norm(p)) < 15 for p in chapter['takeaways']):
            raise ValueError(ident + ': give the reader specific questions or actions')
        chapter_text = norm(' '.join([chapter['headline'], chapter['why_it_matters'], *paragraphs, *chapter['takeaways']]))
        evidence = chapter.get('evidence', [])
        if not evidence:
            raise ValueError(ident + ': link advice to captured sources')
        for item in evidence:
            source = sources.get(item.get('source_id'))
            quote, claim = norm(item.get('excerpt', '')), norm(item.get('claim', ''))
            if not source or len(quote) < 20 or quote not in source[1] or len(claim) < 15 or claim not in chapter_text:
                raise ValueError(ident + ': evidence needs a real source excerpt and exact authored claim')
    if len(data.get('checklist', [])) < 3 or any(len(norm(p)) < 15 for p in data['checklist']):
        raise ValueError('Include a useful decision/appointment checklist')
    if len(norm(data.get('next_step', ''))) < 20:
        raise ValueError('Explain the agreed next step without asking a completed lead to re-submit')
    images = data.get('images', [])
    hashes, ids = set(), set()
    chapter_ids = {c['id'] for c in chapters}
    cover_seen, body_seen = False, False
    for image in images:
        ident, position = image.get('id'), image.get('placement')
        if not ident or ident in ids or position not in {'cover', *chapter_ids}:
            raise ValueError('Images need unique IDs and an actual cover/chapter placement')
        ids.add(ident)
        path = local(root, image.get('path'), 'public/assets')
        if not path.is_file() or sha(path) != image.get('sha256'):
            raise ValueError('Guide image is missing or changed: ' + str(ident))
        with Image.open(path) as picture:
            picture.load()
            if min(picture.size) < 350 or max(picture.size) < 700:
                raise ValueError('Use a readable high-resolution guide image, not a thumbnail/logo')
            if max(ImageStat.Stat(picture.convert('RGB').resize((64, 64))).stddev) < 3:
                raise ValueError('A blank colour panel is not meaningful guide imagery')
        if not image.get('caption') or len(norm(image.get('purpose', ''))) < 25:
            raise ValueError('Explain what each image helps the reader understand')
        kind = image.get('source_type')
        proof = local(root, image.get('evidence_path'), 'research')
        if not proof.is_file() or sha(proof) != image.get('evidence_sha256'):
            raise ValueError('Record actual image acquisition/tool evidence')
        if not image.get('rights_basis'):
            raise ValueError('A website image needs a recorded reuse basis; discovery is not permission')
        if kind == 'generated':
            if image.get('role') != 'illustration' or 'illustrat' not in image['caption'].lower():
                raise ValueError('Generated imagery must be captioned as illustration, never customer/project proof')
            from image_evidence import native_result
            native_result(proof, sha(path))
        elif kind not in {'website', 'supplied'}:
            raise ValueError('Use sourced, supplied or actually generated images')
        elif kind == 'website':
            url = image.get('source_url', '')
            if urlsplit(url).scheme != 'https' or url not in proof.read_text():
                raise ValueError('Website image URL must appear in its captured acquisition evidence')
        inputs[image['path']] = sha(path)
        inputs[image['evidence_path']] = sha(proof)
        hashes.add(sha(path))
        cover_seen |= position == 'cover'
        body_seen |= position in chapter_ids
    if sum(i.get('placement') == 'cover' for i in images) != 1:
        raise ValueError('Use exactly one intentional guide cover image')
    if not cover_seen or not body_seen or len(hashes) < 2:
        raise ValueError('Use a meaningful cover image and a distinct explanatory interior image; logos do not count')
    logo = data.get('brand', {}).get('logo')
    if logo:
        path = local(root, logo, 'public/assets')
        if not path.is_file():
            raise ValueError('Brand logo is missing')
        inputs[logo] = sha(path)
    return inputs


def font_hashes(root, config_path, output):
    from build_catalogue import Catalogue
    data = json.loads(config_path.read_text())
    for value in data.get('brand', {}).get('fonts', {}).values():
        if not isinstance(value, str) or Path(value).is_absolute():
            raise ValueError('Use project-local licensed PDF fonts relative to the guide configuration')
        path = config_path.parent/value
        if any(p.is_symlink() for p in [path, *path.parents]):
            raise ValueError('PDF font paths must not contain symlinks')
        if not path.resolve().is_relative_to(Path(root).resolve()):
            raise ValueError('PDF font escapes the project')
    return Catalogue(config_path, output).font_files


def inspect_build(root):
    report = read(root, 'build/guide-build.json')
    if report.get('schema_version') != 2 or report.get('status') != 'pass':
        raise ValueError('Build and render the researched guide with the current helper')
    config = read(root, report.get('config'))
    if report.get('font_hashes') != font_hashes(root, local(root, report['config']), local(root, report['output'])):
        raise ValueError('PDF fonts changed; rebuild and inspect the rendered guide')
    if report.get('business_fingerprint') != business_fingerprint(root):
        raise ValueError('Business/offer/follow-up changed; update and re-review the guide')
    expected = validate_content(root, config)
    if report.get('author_task_ids') != config.get('author_task_ids'):
        raise ValueError('Build author identity does not match the reviewed guide')
    expected[report['config']] = sha(local(root, report['config']))
    if expected != report.get('inputs'):
        raise ValueError('Guide research, images or copy changed; rebuild before review')
    artifacts = report.get('artifacts', {})
    pages = report.get('rendered_pages', [])
    if not pages or len(pages) != report.get('page_count') or any(p not in artifacts for p in pages):
        raise ValueError('Render every guide page and record its hash')
    if len(set(pages)) != len(pages):
        raise ValueError('Guide page renders must be distinct artifacts')
    local(root, report.get('output'), 'public/assets/brochure')
    local(root, report.get('preview'), 'public/assets/brochure')
    for name in [report.get('text_output'), *pages]:
        local(root, name, 'build')
    for name in [report.get('output'), report.get('text_output'), report.get('preview'), *pages]:
        path = local(root, name)
        if not path.is_file() or artifacts.get(name) != sha(path):
            raise ValueError('Guide output/render/preview is missing or stale: ' + str(name))
    return report


def inspect_review(root, report=None):
    report = report or inspect_build(root)
    review = read(root, 'build/guide-review.json')
    if review.get('build_sha256') != sha(local(root, 'build/guide-build.json')):
        raise ValueError('Guide review is for an older PDF build')
    reviewer = review.get('reviewer', {})
    if reviewer.get('mode') not in {'independent', 'self_review'} or not reviewer.get('task_id'):
        raise ValueError('Name the actual reviewer; disclose self-review')
    if reviewer['mode'] == 'independent' and reviewer['task_id'] in report.get('author_task_ids', []):
        raise ValueError('The guide author is not an independent reviewer')
    from completion_contract import independent_review_errors
    errors = independent_review_errors(root, {**reviewer, 'reviewer_task_id': reviewer.get('task_id')})
    if errors:
        raise ValueError('; '.join(errors))
    rows = review.get('pages', [])
    if [r.get('page') for r in rows] != list(range(1, report['page_count'] + 1)):
        raise ValueError('Inspect every rendered page, not just the cover')
    text = norm(local(root, report['text_output']).read_text())
    for row, render in zip(rows, report['rendered_pages']):
        if row.get('render_sha256') != report['artifacts'][render] or len(norm(row.get('observation', ''))) < 35:
            raise ValueError('Record actual page-specific pixel observations tied to each render')
    checks = review.get('checks', [])
    if len(checks) != len(CRITERIA) or {c.get('criterion') for c in checks} != set(CRITERIA):
        raise ValueError('Complete all seven editorial/visual reader checks exactly once')
    for check in checks:
        excerpt = norm(check.get('excerpt', ''))
        if check.get('verdict') != 'pass' or len(excerpt) < 15 or excerpt not in text or len(norm(check.get('observation', ''))) < 35:
            raise ValueError('A guide check needs exact PDF wording and a substantive review, not a pass boolean')
    if review.get('unresolved_findings') != [] or not isinstance(review.get('improvements'), list):
        raise ValueError('Resolve the guide improvement checklist before delivery')
    for item in review['improvements']:
        if not all(item.get(k) for k in ('problem', 'before', 'after', 'verification')) or norm(item['after']) not in text or norm(item['before']) == norm(item['after']) and item.get('kind') != 'layout':
            raise ValueError('Guide fixes need actual changed wording and fresh verification')
    for saved in sorted(local(root, 'build/guide-review-history', 'build').glob('*.json')):
        old = read(root, saved.relative_to(root).as_posix())
        if hashlib.sha256(old['baseline_text'].encode()).hexdigest() != old.get('text_sha256'):
            raise ValueError('Preserved guide-review baseline was modified')
        for issue in old['review'].get('unresolved_findings', []):
            matches = [i for i in review['improvements'] if i.get('id') == issue['id'] and i.get('review_sha256') == saved.stem]
            if len(matches) != 1 or norm(matches[0].get('before', '')) != norm(issue['before']):
                raise ValueError('Every preserved guide finding needs a verified resolution: ' + issue['id'])
    return review


def repair_needed(root, report):
    """Only a current, explicit review failure dispatches repair work."""
    path = local(root, 'build/guide-review.json', 'build')
    if not path.is_file():
        return False
    review = read(root, 'build/guide-review.json')
    return review.get('build_sha256') == sha(local(root, 'build/guide-build.json')) and (
        bool(review.get('unresolved_findings')) or any(c.get('verdict') == 'improve' for c in review.get('checks', [])))


def archive_failed_review(root):
    """Keep the failed wording/checklist when a repair replaces the PDF."""
    try:
        report = read(root, 'build/guide-build.json')
        review = read(root, 'build/guide-review.json')
    except FileNotFoundError:
        return
    if not repair_needed(root, report):
        return
    text_path = local(root, report['text_output'], 'build')
    if sha(text_path) != report['artifacts'].get(report['text_output']):
        raise ValueError('Preserve the original reviewed PDF text before repairing it')
    issues = review.get('unresolved_findings', [])
    if not issues or any(not isinstance(i, dict) or not all(i.get(k) for k in ('id', 'problem', 'before', 'acceptance_test')) or norm(i['before']) not in norm(text_path.read_text()) for i in issues):
        raise ValueError('A failed guide review needs a concrete anchored improvement checklist')
    record = {'build_sha256': review['build_sha256'], 'review': review, 'baseline_text': text_path.read_text(), 'text_sha256': sha(text_path)}
    name = 'build/guide-review-history/' + sha(local(root, 'build/guide-review.json')) + '.json'
    path = local(root, name, 'build')
    if path.exists():
        if read(root, name) != record:
            raise ValueError('Preserved guide review conflicts with new work')
        return
    from build_guide import write_json
    write_json(path, record)
