"""Final-review regressions for the image proof ledger; offline, synthetic fixtures only."""
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import image_workflow as images  # noqa: E402
import test_image_workflow as base  # noqa: E402
from test_image_workflow import png  # noqa: E402

SITE = 'https://bearplumbing.example'
GALLERY = SITE + '/gallery/bathroom-1.jpg'
PUBLIC = [(2, 1, 6, '', ('93.184.216.34', 443))]


class Response:
    def __init__(self, status, headers, body=b''):
        self.status, self.headers, self.body = status, headers, body

    def getheader(self, name):
        return self.headers.get(name)

    def read(self, limit):
        return self.body[:limit]


def fetcher(resolver=lambda *a, **k: PUBLIC, error=None, response=None):
    """The real fetch_image with a fake resolver and connection; nothing leaves the machine."""
    class Connection:
        def __init__(self, host, address):
            pass

        def request(self, *args, **kwargs):
            if error:
                raise error

        def getresponse(self):
            return response

        def close(self):
            pass
    return lambda url, hosts: images.fetch_image(url, hosts, resolver, Connection)


class Ledger(unittest.TestCase):
    """A client-website gallery photo, an owner record, a client-proof slot and a decorative slot."""
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        for folder in ('research', 'build', 'docs', 'public'):
            (self.root / folder).mkdir()
        (self.root / 'research/gallery.html').write_text(f'<img src="{GALLERY}">')
        self.plan = {'schema_version': 2, 'client_website': SITE, 'allowed_hosts': ['bearplumbing.example'],
                     'inventory': [self.entry('source-gallery', GALLERY)], 'proof_candidates': [],
                     'assets': [{'id': 'bathroom-proof', 'trust_class': 'client-proof', 'stage': 'planned'},
                                {'id': 'texture', 'trust_class': 'decorative', 'stage': 'planned'}]}
        self.owner = self.record('owner.json', {'kind': 'owner_authorization', 'message_id': 'msg-2', 'statement': 'Use my gallery photos.'})

    def entry(self, ident, url, origin='client-website', page=SITE + '/gallery'):
        return {'id': ident, 'source_url': url, 'observed_page': page, 'origin': origin,
                'evidence': images.artifact(self.root, self.root / 'research/gallery.html')}

    def record(self, name, value):
        (self.root / 'research' / name).write_text(json.dumps(value) if isinstance(value, dict) else value)
        return 'research/' + name

    def photo(self, name='attached.png', color=(40, 90, 160)):
        path = self.root / name
        path.write_bytes(png(64, 48, color))
        return path

    def upload(self, name, *files):
        return self.record(name, {'kind': 'user_attachment', 'message_id': 'msg-' + name, 'files': [images.sha(f.read_bytes()) for f in files]})

    def attempt(self, fetch, image='bathroom-proof', candidate='source-gallery'):
        with self.assertRaises(images.WorkflowError) as caught:
            images.acquire(self.plan, self.root, image, candidate, 'client-authorized', self.owner, 'Bathroom job from the gallery', fetcher=fetch)
        return caught.exception

    def cli(self, *args, env=None):
        return subprocess.run([sys.executable, str(SKILL / 'scripts/image_workflow.py'), '--plan', str(self.root / 'image-plan.json'), *args],
                              capture_output=True, text=True, cwd=SKILL, env={**os.environ, **(env or {})}, timeout=60)

    def saved_plan(self, **changes):
        plan = json.loads((SKILL / 'assets/image-plan.example.json').read_text())
        plan.update(client_website=SITE, allowed_hosts=['bearplumbing.example'], inventory=[self.entry('source-gallery', GALLERY)], **changes)
        (self.root / 'image-plan.json').write_text(json.dumps(plan))
        return plan


class LedgerTests(Ledger):
    def test_environment_failures_leave_the_photo_for_the_owner(self):
        def no_dns(*args, **kwargs):
            raise socket.gaierror(8, 'nodename nor servname provided, or not known')
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        candidate = self.plan['proof_candidates'][0]
        for kind, fetch in (('network', fetcher(resolver=no_dns)), ('timeout', fetcher(error=TimeoutError('timed out'))),
                            ('tls-certificate', fetcher(error=ssl.SSLCertVerificationError(1, 'certificate verify failed: unable to get local issuer certificate'))),
                            ('non-public-address', fetcher(resolver=lambda *a, **k: [(2, 1, 6, '', ('10.0.0.8', 443))]))):
            candidate['disposition'] = None
            self.assertIn('--replaces source-gallery', str(self.attempt(fetch)))
            receipt = json.loads((self.root / candidate['receipt']['path']).read_text())
            role = images.proof_role(self.plan, self.root)
            self.assertEqual((candidate['disposition'], receipt['error_class']), ('no-download-tool', kind))
            self.assertEqual((role['errors'], role['unresolved'], role['status']), ([], ['source-gallery'], 'unresolved'))
        candidate['disposition'] = 'acquisition-failed'  # as the earlier tool recorded an environment failure
        role = images.proof_role(self.plan, self.root)
        self.assertEqual((role['errors'], role['unresolved']), ([], ['source-gallery']))
        # Only a failure of the photo itself closes the candidate.
        redirect = Response(302, {'Location': GALLERY})
        for kind, fetch in (('http-404', fetcher(response=Response(404, {}))), ('mime-mismatch', fetcher(response=Response(200, {'Content-Type': 'text/html'}))),
                            ('oversize', fetcher(response=Response(200, {'Content-Type': 'image/png', 'Content-Length': str(images.MAX_BYTES + 1)}))),
                            ('redirect-limit', fetcher(response=redirect))):
            candidate['disposition'] = None
            self.attempt(fetch)
            role = images.proof_role(self.plan, self.root)
            self.assertEqual((candidate['disposition'], json.loads((self.root / candidate['receipt']['path']).read_text())['error_class']), ('acquisition-failed', kind))
            self.assertEqual((role['errors'], role['unresolved'], role['status']), ([], [], 'no_usable_proof'))

    def test_owner_attachment_replaces_only_a_no_download_candidate(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        photo = self.photo()
        upload = self.upload('upload.json', photo)
        attached = images.inventory_file(self.plan, self.root, photo, 'user_attachment', self.root / upload)['id']

        def replace(image='bathroom-proof', candidate=attached, rights='client-provided', evidence=upload):
            return images.acquire(self.plan, self.root, image, candidate, rights, evidence, 'The owner attached this job photo', replaces='source-gallery')
        with self.assertRaisesRegex(images.WorkflowError, 'no-download-tool'):
            replace()
        self.record('capability.txt', 'This sandbox has no outbound network access for downloads.')
        images.dispose(self.plan, self.root, 'source-gallery', 'no-download-tool', 'The sandbox cannot download files; the owner will attach them.', self.root / 'research/capability.txt')
        self.plan['inventory'].append(self.entry('source-other', SITE + '/gallery/other.jpg'))
        with self.assertRaisesRegex(images.WorkflowError, "owner's own file"):
            replace(candidate='source-other', rights='client-authorized', evidence=self.owner)
        with self.assertRaisesRegex(images.WorkflowError, 'client-proof placement'):
            replace(image='texture')
        replace()
        candidate, asset = self.plan['proof_candidates'][0], self.plan['assets'][0]
        self.assertEqual((candidate['disposition'], candidate['asset_id'], candidate['replacement_inventory_id']), ('used', 'bathroom-proof', attached))
        self.assertEqual(asset['provenance']['replaces_candidate'], 'source-gallery')
        role = images.proof_role(self.plan, self.root)
        self.assertEqual((role['errors'], role['unresolved'], role['used'], role['status']), ([], [], ['source-gallery'], 'proof_used'))
        del asset['provenance']['replaces_candidate']
        self.assertTrue(any('no asset holds it' in e for e in images.proof_role(self.plan, self.root)['errors']))

    def test_cli_blocked_download_then_owner_attachment(self):
        self.saved_plan(proof_candidates=[{'inventory_id': 'source-gallery', 'source_url': GALLERY, 'subject': 'Finished bathroom remodel', 'disposition': None}])
        offline = self.root / 'offline'
        offline.mkdir()
        (offline / 'sitecustomize.py').write_text('import socket\n\ndef _offline(*args, **kwargs):\n    raise socket.gaierror(8, "no DNS in this sandbox")\n\nsocket.getaddrinfo = _offline\n')
        env = {'PYTHONPATH': str(offline)}
        failed = self.cli('acquire', '--id', 'hero-client-project', '--candidate', 'source-gallery', '--rights', 'client-authorized',
                          '--rights-evidence', self.owner, '--proof-evidence', 'Bathroom job from the gallery', env=env)
        self.assertEqual(failed.returncode, 1, failed.stderr)
        self.assertIn('--replaces source-gallery', failed.stderr)
        self.assertEqual(images.proof_role(json.loads((self.root / 'image-plan.json').read_text()), self.root)['unresolved'], ['source-gallery'])
        # The owner attaches the photo; project-relative evidence works from another working directory.
        photo = self.photo()
        upload = self.upload('owner-upload.json', photo)
        added = self.cli('inventory-file', '--file', str(photo), '--authority', 'user_attachment', '--evidence', upload, env=env)
        self.assertEqual(added.returncode, 0, added.stderr)
        attached = json.loads(added.stdout)['id']
        done = self.cli('acquire', '--id', 'hero-client-project', '--candidate', attached, '--replaces', 'source-gallery', '--rights', 'client-provided',
                        '--rights-evidence', upload, '--proof-evidence', 'The owner attached this photo of the gallery job', env=env)
        self.assertEqual(done.returncode, 0, done.stderr)
        saved = json.loads((self.root / 'image-plan.json').read_text())
        self.assertEqual((images.proof_role(saved, self.root)['status'], saved['proof_candidates'][0]['replacement_inventory_id']), ('proof_used', attached))

    def test_research_binding_covers_cdn_www_http_and_inventory_urls(self):
        self.plan['client_website'] = 'https://www.bearplumbing.example'
        cdn, godaddy = 'https://images.squarespace-cdn.com/content/v1/abc', 'https://img1.wsimg.com/isteam/ip/abc'
        self.plan['inventory'] += [self.entry('source-van', cdn + '/van.jpg'), self.entry('source-plain', godaddy + '/IMG_1'),
                                   self.entry('source-ref', 'https://images.squarespace-cdn.com/content/v1/other/kitchen.jpg', 'reference-website', 'https://other.example/')]
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        listed = [cdn + '/bath-2.jpg', 'https://bearplumbing.example/team.webp', godaddy + '/IMG_1', godaddy + '/IMG_2.jpg/:/cr=t:0%25/rs=w:1280']
        (self.root / 'docs/IMAGE-RESEARCH.md').write_text(
            f'Gallery {GALLERY}?ver=2 and http://bearplumbing.example/gallery/bathroom-1.jpg. Rejected: `{listed[0]}`, **{listed[1]}**.\n'
            f'| {listed[2]} | {listed[3]} |\nReference https://images.squarespace-cdn.com/content/v1/other/kitchen.jpg; page https://bearplumbing.example/services/\n')
        flagged = sorted(e.split(' lists client image ')[1].split('; ')[0] for e in images.research_binding_errors(self.plan, self.root))
        self.assertEqual(flagged, sorted(listed))
        for n, url in enumerate(listed):
            if not any(e['source_url'] == url for e in self.plan['inventory']):
                self.plan['inventory'].append(self.entry(f'source-{n}', url))
            images.add_candidate(self.plan, next(e['id'] for e in self.plan['inventory'] if e['source_url'] == url), 'Gallery job photo')
        self.assertEqual(images.research_binding_errors(self.plan, self.root), [])
        example = json.loads((SKILL / 'assets/image-plan.example.json').read_text())
        example['client_website'] = None  # a business with no website says so explicitly
        images.validate_plan(example)
        del example['client_website']
        with self.assertRaisesRegex(images.WorkflowError, 'client_website'):
            images.validate_plan(example)

    def test_upload_record_authorises_only_its_files(self):
        photo, logo = self.photo('bath.png'), self.photo('logo.png', (200, 30, 30))
        own, logo_upload = self.upload('bath-upload.json', photo), self.upload('logo-upload.json', logo)
        entry = images.inventory_file(self.plan, self.root, photo, 'user_attachment', self.root / own)
        images.add_candidate(self.plan, entry['id'], 'Owner-supplied bathroom job')
        with self.assertRaisesRegex(images.WorkflowError, "does not list this file's sha256"):
            images.acquire(self.plan, self.root, 'bathroom-proof', entry['id'], 'client-provided', logo_upload, 'Owner-supplied job photo')
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        with self.assertRaisesRegex(images.WorkflowError, 'client-provided rights cover files the owner supplied'):
            images.acquire(self.plan, self.root, 'bathroom-proof', 'source-gallery', 'client-provided', logo_upload, 'Gallery job', fetcher=lambda url, hosts: (png(64, 48), url))
        images.acquire(self.plan, self.root, 'bathroom-proof', entry['id'], 'client-provided', own, 'Owner-supplied job photo')

    def test_reuse_not_authorized_needs_a_refusal_record(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        self.record('note.txt', 'The owner has not said yet whether we may reuse these.')
        with self.assertRaisesRegex(images.WorkflowError, 'authority record'):
            images.dispose(self.plan, self.root, 'source-gallery', 'reuse-not-authorized', 'Owner has not authorised reuse of website photos yet.', self.root / 'research/note.txt')
        refusal = self.record('refusal.json', {'kind': 'owner_refusal', 'message_id': 'msg-7', 'statement': 'Please do not reuse the gallery photos.'})
        images.dispose(self.plan, self.root, 'source-gallery', 'reuse-not-authorized', 'The owner declined reuse of the gallery photos.', self.root / refusal)
        self.assertEqual(images.proof_role(self.plan, self.root)['status'], 'no_usable_proof')
        self.plan['proof_candidates'][0]['evidence'] = images.artifact(self.root, self.root / 'research/note.txt')  # hand-edited plan
        role = images.proof_role(self.plan, self.root)
        self.assertTrue(role['errors'])
        self.assertEqual(role['unresolved'], ['source-gallery'])

    def test_business_photo_in_any_placement_is_in_the_ledger(self):
        photo = lambda url, hosts: (png(64, 48), url)
        with self.assertRaisesRegex(images.WorkflowError, 'candidate'):
            images.acquire(self.plan, self.root, 'texture', 'source-gallery', 'client-authorized', self.owner, fetcher=photo)
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        with self.assertRaisesRegex(images.WorkflowError, 'unsuitable first'):
            images.acquire(self.plan, self.root, 'texture', 'source-gallery', 'client-authorized', self.owner, fetcher=photo)
        self.record('crop.txt', 'Inspected crop: 240px wide and blurred at every planned proof crop.')
        images.dispose(self.plan, self.root, 'source-gallery', 'unsuitable', 'Only 240px wide and blurred at every proof crop.', self.root / 'research/crop.txt')
        images.acquire(self.plan, self.root, 'texture', 'source-gallery', 'client-authorized', self.owner, fetcher=photo)
        role = images.proof_role(self.plan, self.root)
        self.assertEqual((self.plan['proof_candidates'][0]['disposition'], role['errors'], role['status']), ('unsuitable', [], 'no_usable_proof'))
        (self.root / 'build/research-acceptance.json').write_text(json.dumps({'first_party_image_attempts': [{'status': 'acquired', 'asset_id': 'texture'}]}))
        self.assertEqual(images.research_binding_errors(self.plan, self.root), [])
        # A plan edited by hand (or written by the earlier tool) cannot hide the photo from the ledger.
        self.plan['proof_candidates'] = []
        role = images.proof_role(self.plan, self.root)
        self.assertTrue(role['errors'])
        self.assertEqual(role['status'], 'unresolved')
        self.assertTrue(any('texture as acquired' in e for e in images.research_binding_errors(self.plan, self.root)))
        # Registering a photo a proof placement already holds records it as used, without re-acquiring it.
        self.plan['assets'][0]['provenance'] = {'kind': 'actual', 'candidate_id': 'source-gallery'}
        self.assertEqual(images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')['disposition'], 'used')
        self.assertEqual(images.proof_role(self.plan, self.root)['status'], 'proof_used')

    def test_receipt_name_never_carries_the_inventory_id_as_a_path(self):
        outside = set(self.root.parent.glob('escaped*'))
        for ident in ('../../../escaped', 'css-bg/hero'):
            self.plan['inventory'].append(self.entry(ident, SITE + '/gallery/' + ident.replace('/', '-') + '.jpg'))
            images.add_candidate(self.plan, ident, 'Background job photo')
            error = self.attempt(fetcher(response=Response(404, {})), candidate=ident)
            self.assertIn('HTTP 404', str(error))
            receipt = self.root / images.proof_candidate(self.plan, ident)['receipt']['path']
            self.assertEqual((receipt.parent, json.loads(receipt.read_text())['candidate_id']), (self.root / 'research/acquisition-receipts', ident))
        self.assertEqual(set(self.root.parent.glob('escaped*')), outside)

    def test_used_proof_must_be_rendered_by_an_image_element(self):
        images.add_candidate(self.plan, 'source-gallery', 'Finished bathroom remodel')
        self.plan['proof_candidates'][0].update(disposition='used', asset_id='bathroom-proof')
        self.plan['assets'][0]['variants'] = [{'path': 'public/assets/images/optimized/bathroom-proof-abc/bathroom-960.webp'}]
        served = '/assets/images/optimized/bathroom-proof-abc/bathroom-960.webp'
        for page, errors in ((f'<!-- <img src="{served}"> -->', 1), (f'<link rel="prefetch" href="{served}">', 1), (f'<img hidden src="{served}">', 1),
                             (f'<template><img src="{served}"></template>', 1), (f'<picture><source srcset="{served} 960w"><img src="/other.webp" alt=""></picture>', 0)):
            (self.root / 'public/index.html').write_text(page)
            self.assertEqual(len(images.rendered_proof_errors(self.plan, self.root)), errors, page)


class WorkflowFileTests(unittest.TestCase):
    """The complete one-asset plan from test_image_workflow, for preflight, review and the CLI."""
    setUp, tearDown = base.ImageWorkflowTests.setUp, base.ImageWorkflowTests.tearDown
    acquire, create_review = base.ImageWorkflowTests.acquire, base.ImageWorkflowTests.create_review

    def ready(self):
        self.acquire()
        item = self.plan['assets'][0]
        item.update(variants=[dict(item['source'])], stage='optimized')
        return item

    def test_preflight_rechecks_the_rights_record_against_the_bytes(self):
        W = base.workflow
        item = self.ready()
        self.assertTrue(W.preflight(self.plan, self.root)['passed'])
        logo = self.root / 'logo.png'
        logo.write_bytes(png(40, 40, (200, 30, 30)))
        (self.root / 'logo-upload.json').write_text(json.dumps({'kind': 'user_attachment', 'message_id': 'msg-logo', 'files': [W.sha(logo.read_bytes())]}))
        item['provenance']['rights_evidence'] = 'logo-upload.json'
        self.assertTrue(any("does not list this file's sha256" in e for e in W.preflight(self.plan, self.root)['errors']))

    def test_client_website_origin_needs_a_page_on_the_client_site(self):
        W = base.workflow
        (self.root / 'research').mkdir()
        (self.root / 'research/stock.html').write_text('<img src="https://images.unsplash.com/photo-1.jpg">')
        (self.root / 'image-plan.json').write_text(json.dumps(self.plan))
        run = lambda page: subprocess.run([sys.executable, str(SKILL / 'scripts/image_workflow.py'), '--plan', str(self.root / 'image-plan.json'), 'inventory-html',
                                           '--html', str(self.root / 'research/stock.html'), '--page-url', page, '--origin', 'client-website'], capture_output=True, text=True, cwd=SKILL, timeout=60)
        refused = run('https://unsplash.com/photos/bathroom')
        self.assertEqual(refused.returncode, 1)
        self.assertIn('reference-website', refused.stderr)
        accepted = run('https://www.client.example/gallery')
        self.assertEqual(accepted.returncode, 0, accepted.stderr)
        # A hand-recorded client-website entry from another site cannot become client proof either.
        owner = self.root / 'owner.json'
        owner.write_text(json.dumps({'kind': 'owner_authorization', 'message_id': 'msg-2', 'statement': 'Use my photos.'}))
        self.plan['inventory'][0].update(origin='client-website', source_url='https://images.unsplash.com/photo-1.jpg', observed_page='https://unsplash.com/photos/bathroom')
        del self.plan['inventory'][0]['local_file']
        W.add_candidate(self.plan, 'supplied-1', 'Bathroom remodel photo')
        W.acquire(self.plan, self.root, self.image_id, 'supplied-1', 'client-authorized', 'owner.json', 'Bathroom job', fetcher=lambda url, hosts: (self.supplied.read_bytes(), url))
        item = self.plan['assets'][0]
        item.update(variants=[dict(item['source'])], stage='optimized')
        self.assertTrue(any('observed_page' in e for e in W.preflight(self.plan, self.root)['errors']))

    def test_legacy_client_supplied_entry_is_upgraded_in_place(self):
        W = base.workflow
        self.ready()
        entry = self.plan['inventory'][0]
        entry.update(id='source-' + entry['source_sha256'][:12])
        self.plan['assets'][0]['provenance']['candidate_id'] = entry['id']
        for candidate in self.plan.get('proof_candidates', []):
            candidate['inventory_id'] = entry['id']
        entry.pop('authority')  # as inventory-file wrote it before --authority existed
        self.assertTrue(any('--authority' in e for e in W.preflight(self.plan, self.root)['errors']))
        with self.assertRaisesRegex(W.WorkflowError, 'already in the inventory'):
            W.inventory_file(self.plan, self.root, self.supplied, 'agent_created', self.evidence)
        self.assertIs(W.inventory_file(self.plan, self.root, self.supplied, 'user_attachment', self.evidence), entry)
        self.assertEqual((len(self.plan['inventory']), entry['authority']), (1, 'user_attachment'))
        self.assertTrue(W.preflight(self.plan, self.root)['passed'])
        with self.assertRaisesRegex(W.WorkflowError, 'already in the inventory'):
            W.inventory_file(self.plan, self.root, self.supplied, 'user_attachment', self.evidence)

    @unittest.skipUnless(shutil.which('cwebp'), 'cwebp is required for real optimization')
    def test_element_capture_cannot_be_an_image_file_from_the_plan(self):
        W = base.workflow
        self.acquire()
        W.optimize(self.plan, self.root, self.image_id)
        report_path, report = self.create_review()
        variant = self.plan['assets'][0]['variants'][-1]
        report['desktop'].update(element_screenshot=variant['path'])
        report['desktop']['element']['bbox'].update(width=variant['width'], height=variant['height'])
        report_path.write_text(json.dumps(report))
        with self.assertRaisesRegex(W.WorkflowError, 'rendered capture'):
            W.review_asset(self.plan, self.root, self.image_id, report_path)


class ParserTests(unittest.TestCase):
    def test_srcset_keeps_commas_inside_cdn_urls(self):
        cloudinary = 'https://res.cloudinary.com/bear/image/upload/w_{},c_fill/bath.jpg'
        wix = 'https://static.wixstatic.com/media/abc.jpg/v1/fill/w_{},h_276,al_c,q_85/abc.jpg'
        parser = images.ImageInventory('https://www.bear.example/gallery')
        parser.feed(f'<img srcset="{cloudinary.format(400)} 400w, {cloudinary.format(800)} 800w"><picture><source srcset="{wix.format(490)} 1x,{wix.format(980)} 2x">'
                    '<img src="data:image/gif;base64,R0" data-srcset="/a.jpg 1x,/b.jpg 2x"></picture>')
        self.assertEqual([i['source_url'] for i in parser.images], [cloudinary.format(400), cloudinary.format(800), wix.format(490), wix.format(980),
                                                                    'https://www.bear.example/a.jpg', 'https://www.bear.example/b.jpg'])

    def test_documented_owner_records_are_accepted(self):
        doc = (SKILL / 'references/image-workflow.md').read_text()
        shapes = {kind: re.search(r'`(\{"kind": "%s".*?\})`' % kind, doc) for kind in ('owner_instruction', 'owner_refusal')}
        self.assertTrue(all(shapes.values()), 'image-workflow.md documents the owner_instruction and owner_refusal records')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            photo = root / 'photo.png'
            photo.write_bytes(png(32, 32))
            record = json.loads(shapes['owner_instruction'].group(1).replace('<sha256>', images.sha(photo.read_bytes())))
            (root / 'instruction.json').write_text(json.dumps(record))
            plan = {'inventory': [], 'proof_candidates': []}
            entry = images.inventory_file(plan, root, photo, 'owner_instruction', root / 'instruction.json')
            self.assertEqual(entry['origin'], 'client-supplied')
            (root / 'refusal.json').write_text(shapes['owner_refusal'].group(1))
            images.add_candidate(plan, entry['id'], 'Owner-supplied job photo')
            images.dispose(plan, root, entry['id'], 'reuse-not-authorized', 'The owner declined reuse of this photo.', root / 'refusal.json')


class CaptureScriptTests(unittest.TestCase):
    MODULES = SKILL / 'assets/cloudflare/node_modules'

    @unittest.skipUnless(shutil.which('node') and (MODULES / 'playwright-core').is_dir(), 'node and playwright-core are required')
    def test_uncapturable_images_are_reported_and_the_rest_written(self):
        import functools
        import http.server
        import threading
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            (root / 'public/assets').mkdir(parents=True)
            (root / 'package.json').write_text('{"private": true}')
            (root / 'node_modules').symlink_to(self.MODULES)
            assets = []
            for n, name in enumerate(('hero', 'desk', 'pic', 'legacy', 'absent')):
                (root / f'public/assets/{name}.png').write_bytes(png(320, 200, (40 * n, 90, 160)))
                data = (root / f'public/assets/{name}.png').read_bytes()
                assets.append({'id': name, 'variants': [{'path': f'public/assets/{name}.png', 'sha256': images.sha(data)}]})
            (root / 'image-plan.json').write_text(json.dumps({'assets': [a for a in assets if a['id'] != 'legacy']}))
            (root / 'public/index.html').write_text(
                '<!doctype html><style>img{width:300px;height:180px;display:block}@media (max-width:600px){.desktop-only{display:none}}</style>'
                '<img src="/assets/hero.png" alt=""><div class="desktop-only"><img src="/assets/desk.png" alt=""></div><div style="height:12000px"></div>'
                '<picture><source srcset="/assets/legacy.png"><img loading="lazy" src="/assets/pic.png" alt=""></picture>')
            class Quiet(http.server.SimpleHTTPRequestHandler):
                def log_message(self, *args):
                    pass
            server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root / 'public')))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                run = subprocess.run(['node', str(SKILL / 'scripts/capture-image-reviews.mjs'), '--url', f'http://127.0.0.1:{server.server_address[1]}/',
                                      '--project-root', str(root)], capture_output=True, text=True, timeout=180)
            finally:
                server.shutdown()
                server.server_close()
            if 'browserType.launch' in run.stderr:
                self.skipTest('No Playwright browser is installed')
            result = json.loads(run.stdout)
            self.assertEqual((run.returncode, result['status']), (1, 'blocked'))
            self.assertEqual(sorted(p.name for p in (root / 'build/image-reviews').glob('*.json')), ['desk.json', 'hero.json'])
            self.assertEqual(sorted(json.loads((root / 'build/image-reviews/hero.json').read_text())), ['desktop', 'instructions', 'mobile', 'reviewer', 'source_sha256', 'variant_sha256'])
            missing = ' | '.join(result['missing_on_page'])
            for expected in ('desk (mobile): present but not rendered', 'pic (desktop): serves /assets/legacy.png', 'absent (mobile)'):
                self.assertIn(expected, missing)


if __name__ == '__main__':
    unittest.main()
