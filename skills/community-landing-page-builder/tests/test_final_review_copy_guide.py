"""Regressions for the final review's copy-approval and reader-guide findings.

Each test names the finding it covers. Everything here is synthetic and local: no
model, provider, network or publication step runs.
"""
import contextlib
import copy
import hashlib
import http.client
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest import mock

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import build_guide  # noqa: E402
import guide  # noqa: E402
import guide_image_handoff as handoff  # noqa: E402
import guide_quality as q  # noqa: E402
import guide_ui  # noqa: E402
import image_workflow as images  # noqa: E402
import question_log  # noqa: E402
import research_contract  # noqa: E402
import visual_direction  # noqa: E402
import workflow  # noqa: E402
import workflow_runner as runner  # noqa: E402
import workflow_storage as storage  # noqa: E402

_spec = importlib.util.spec_from_file_location('final_review_reader_fixture', SKILL / 'assets/cloudflare/tests/fixtures/reader_guide_fixture.py')
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)

CONTRACT = {'offer': 'Free roof inspection'}


def fake_copy_state(root):
    """copy_state as copy_contract reports it for passing copy: bound to the master's bytes."""
    root = Path(root).resolve()
    master = root / workflow.copy_files(root)['copy']
    return {'status': 'pass', 'failures': [], 'contract': CONTRACT,
            'fingerprint': hashlib.sha256(master.read_bytes() + json.dumps(CONTRACT).encode()).hexdigest(),
            'passages': workflow.copy_passages(root, CONTRACT)}


class Temp(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        (self.root / 'build').mkdir()
        (self.root / 'research').mkdir()

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value if isinstance(value, str) else json.dumps(value, indent=2))

    def patch(self, target, name, value):
        patcher = mock.patch.object(target, name, value)
        patcher.start()
        self.addCleanup(patcher.stop)


STRUCTURED = {
    'h1': 'Roof inspections near Denver, booked this week',
    'primary_cta': 'Get my free quote',
    'sections': [{'id': 'proof', 'headline': 'Photos of every issue', 'body': 'Clear photos.'},
                 {'id': 'pricing', 'headline': 'One fixed inspection fee', 'body': 'Agreed before the visit.'},
                 {'id': 'faq', 'questions': [{'question': 'How long?', 'answer': 'About an hour.'}]}],
    'modal': {'submit_label': 'Send my request'},
    'thank_you': {'headline': 'Request received', 'body': 'We will call you today.'},
}


class PassageTests(Temp):
    """copy-approvals#1, #2, #7: what an owner approval binds and what it is diffed against."""

    def setUp(self):
        super().setUp()
        self.patch(workflow, 'copy_state', fake_copy_state)

    def markdown(self, text):
        self.write('funnel.json', {'backend': {'provider': 'none'}, 'guided_workflow': {'copy_format': 'markdown'}})
        self.write('build/page-copy.md', text)

    def approve(self, message_id='msg-1'):
        workflow.record(self.root, 'copy', 'I approve this copy.', message_id)
        self.assertEqual(workflow.check_copy_approval(self.root)['status'], 'pass')

    def test_markdown_heading_edit_that_keeps_its_slug_needs_reapproval(self):  # copy-approvals#1
        self.markdown('# Save 20% on your spring tune-up\n\n## From $49 per visit\nNo call-out fee.\n')
        self.approve()
        self.markdown('# Save $20 on your spring tune-up\n\n## From \u00a349 per visit\nNo call-out fee.\n')
        result = workflow.check_copy_approval(self.root)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['changed_passages'], ['from-49-per-visit', 'save-20-on-your-spring-tune-up'])
        self.assertIn('# Save $20 on your spring tune-up', workflow.copy_passages(self.root, CONTRACT)['save-20-on-your-spring-tune-up']['text'])

    def test_markdown_headline_without_body_is_still_a_passage(self):  # copy-approvals#1
        self.markdown('# Roof inspections booked this week\n## What you get\nA written report.\n')
        self.approve()
        self.markdown('# Guaranteed same-day roof repairs\n## What you get\nA written report.\n')
        result = workflow.check_copy_approval(self.root)
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('guaranteed-same-day-roof-repairs', result['changed_passages'])

    def test_fixture_approval_is_not_a_baseline_for_the_owner(self):  # copy-approvals#2
        self.write('build/page-copy.json', STRUCTURED)
        workflow.record(self.root, 'copy', 'Automated protocol check', 'fixture-1', fixture=True)
        edited = copy.deepcopy(STRUCTURED)
        edited['sections'][0]['body'] = 'Clear photos and a written report.'
        self.write('build/page-copy.json', edited)
        result = workflow.check_copy_approval(self.root)
        self.assertEqual(result['changed_passages'], [])
        self.assertIn('complete current copy', result['failures'][0])
        # A fixture recorded after a real approval replaces it, so it cannot hide earlier changes either.
        self.write('build/page-copy.json', STRUCTURED)
        self.approve('msg-2')
        workflow.record(self.root, 'copy', 'Automated protocol check', 'fixture-2', fixture=True)
        self.write('build/page-copy.json', edited)
        self.assertIn('complete current copy', workflow.check_copy_approval(self.root)['failures'][0])
        # Explicit protocol tests that accept fixtures keep their own baseline.
        self.assertEqual(workflow.check_copy_approval(self.root, allow_fixture=True)['changed_passages'], ['section:proof'])

    def test_section_reorder_needs_reapproval(self):  # copy-approvals#7
        self.write('build/page-copy.json', STRUCTURED)
        self.approve()
        reordered = copy.deepcopy(STRUCTURED)
        reordered['sections'].reverse()
        self.write('build/page-copy.json', reordered)
        result = workflow.check_copy_approval(self.root)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['changed_passages'], ['section_order'])
        self.markdown('# Headline\nRoof inspections\n\n## Proof\nPhotos.\n\n## Pricing\nOne fee.\n')
        self.approve('msg-3')
        self.markdown('# Headline\nRoof inspections\n\n## Pricing\nOne fee.\n\n## Proof\nPhotos.\n')
        self.assertEqual(workflow.check_copy_approval(self.root)['changed_passages'], ['section_order'])


class GuidedProject(Temp):
    """A guided static project whose brief is confirmed and whose copy files exist."""

    def setUp(self):
        super().setUp()
        guide.start(self.root, name='Synthetic Roofing')
        storage.write(self.root, 'build/discovery.json', {'schema_version': 1, 'suggestions': [], 'input_fingerprint': guide.research_fingerprint(self.root)})
        guide.discover(self.root)
        self.answer({'service': 'Roof inspections', 'audience': 'Homeowners', 'region': 'Synthetic county',
                     'offer': 'An inspection and written findings', 'conversion': 'call', 'destination': 'tel:+15555550123'})
        brief = guide.next_action(self.root)
        guide.approve(self.root, {'actor': 'user', 'message_id': 'confirm:1', 'message': 'I confirm this brief', 'kind': 'brief',
                                  'expected_revision': brief['revision'], 'review_fingerprint': brief['review_fingerprint']})
        for name, text in (('build/strategy-brief.md', 'Synthetic strategy brief.'), ('build/claim-ledger.md', 'Synthetic claim ledger.'),
                           ('build/copy-editorial-review.json', '{}')):
            self.write(name, text)
        self.patch(workflow, 'copy_state', fake_copy_state)
        # The research contract is exercised by its own tests; these cover the copy stages after it.
        self.patch(research_contract, 'inspect', lambda root: [])
        self.patch(research_contract, 'conversion_errors', lambda root: [])

    def answer(self, answers):
        record = guide.state(self.root)
        guide.answer(self.root, {'actor': 'user', 'message_id': 'synthetic:message', 'event_id': 'event-' + str(record['revision']),
                                 'expected_revision': record['revision'], 'answers': [{'id': k, 'value': v} for k, v in answers.items()]})


class SurfaceScanRoutingTests(GuidedProject):
    """copy-approvals#0: copy the scan rejects is repair work, never an unrecordable approval."""

    def test_long_dash_dispatches_copy_repair_instead_of_owner_approval(self):
        self.write('build/page-copy.md', '# Roof inspections booked this week\nA written report \u2014 with photos of every issue.\n')
        action = guide.next_action(self.root)
        self.assertEqual((action['kind'], action['stage'], action['role']), ('work', 'copy_review', 'copy'))
        self.assertTrue(any('U+2014 long dash' in blocker for blocker in action['blockers']))
        calls = []

        def copy_worker(root, work, route):
            calls.append(work['stage'])
            path = root / 'build/page-copy.md'
            path.write_text(path.read_text().replace(' \u2014 ', ' - '))
            return {'status': 'done', 'summary': 'Replaced the long dash in the canonical copy.', 'outputs': ['build/page-copy.md'], 'blockers': []}
        result = runner.drive(self.root, executor=copy_worker)
        self.assertEqual(calls, ['copy_review'])
        self.assertEqual((result['kind'], result['approval_kind']), ('approval', 'copy'))
        # Once the copy is clean the owner's approval can actually be recorded.
        workflow.record(self.root, 'copy', 'I approve this copy.', 'msg-1', expected_fingerprint=result['review_fingerprint'])


class QuestionHistoryTests(Temp):
    """copy-approvals#3: history keeps what was cited when asked, not today's bytes."""

    def test_changed_cited_source_does_not_invalidate_asked_questions(self):
        guide.start(self.root, name='Synthetic Roofing')
        page = self.root / 'research/home.html'
        page.write_text('<p>Synthetic Roofing: roof services in a synthetic region.</p>')
        evidence = {'path': 'research/home.html', 'sha256': hashlib.sha256(page.read_bytes()).hexdigest()}
        unresolved = [{'id': q['id'], 'category': 'offer', 'reason': 'The captured page does not settle this decision',
                       'material_effect': 'The answer changes the offer or conversion path', 'evidence': [evidence]} for q in guide.questions(self.root)]
        storage.write(self.root, 'build/discovery.json', {'schema_version': 1, 'suggestions': [], 'unresolved_facts': unresolved,
                                                          'input_fingerprint': guide.research_fingerprint(self.root)})
        guide.discover(self.root)
        self.assertEqual(guide.present(self.root)['kind'], 'question')
        self.assertTrue(storage.read(self.root, 'build/question-log.json')['questions'])
        self.assertEqual(question_log.validate(self.root), [])
        page.write_text('<p>Synthetic Roofing: recaptured page with new services.</p>')
        self.assertEqual(question_log.validate(self.root), [])
        # A new question still needs current evidence, and malformed history is still rejected.
        self.assertTrue(question_log.qualify(self.root, guide.questions(self.root))[1])
        log = storage.read(self.root, 'build/question-log.json')
        log['questions'][0]['necessity']['evidence'] = [{'path': '/etc/hosts', 'sha256': evidence['sha256']}]
        storage.write(self.root, 'build/question-log.json', log)
        self.assertTrue(any('project-relative' in error for error in question_log.validate(self.root)))


class ReviewEndpointTests(Temp):
    """copy-approvals#2 and #4: the owner's review screen shows the passages the approval covers."""

    def setUp(self):
        super().setUp()
        guide.start(self.root, name='Synthetic Roofing')
        self.patch(workflow, 'copy_state', fake_copy_state)

        class StubBridge:
            def status(inner):
                return {'running': False, 'last': None, 'next': guide.next_action(self.root)}

            def wake(inner):
                return {'running': True}
        self.http, self.token, _ = guide_ui.server(self.root, bridge=StubBridge())
        thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.http.server_close)
        self.addCleanup(self.http.shutdown)

    def review(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        connection.request('GET', '/api/review', headers={'Authorization': 'Bearer ' + self.token, 'Host': f'127.0.0.1:{self.http.server_port}'})
        response = connection.getresponse()
        data = json.loads(response.read())
        connection.close()
        self.assertEqual(response.status, 200, data)
        return {p['id']: p for p in data['passages']}

    def test_removed_passages_are_listed_and_fixture_records_are_not_a_baseline(self):
        self.write('build/page-copy.md', '# Roof inspections\nBooked this week.\n\n## Our guarantee\nWe return if a repair leaks.\n')
        workflow.record(self.root, 'copy', 'I approve this copy.', 'msg-1')
        self.write('build/page-copy.md', '# Roof inspections\nBooked this week.\n')
        changed = workflow.check_copy_approval(self.root)['changed_passages']
        self.assertIn('removed:our-guarantee', changed)
        passages = self.review()
        self.assertEqual(passages['our-guarantee']['status'], 'removed')
        self.assertEqual({p for p, item in passages.items() if item['status'] != 'unchanged'},
                         {name.removeprefix('removed:') for name in changed})
        workflow.record(self.root, 'copy', 'Automated protocol check', 'fixture-1', fixture=True)
        self.write('build/page-copy.md', '# Roof inspections\nBooked this week, with photos.\n')
        self.assertEqual({item['status'] for item in self.review().values()}, {'new'})


APP_HARNESS = r"""
const fs = require('fs'), vm = require('vm');
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; this.hidden = false; this.open = false; this.listeners = {}; this.value = ''; }
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute() {}
  text() { return [this.textContent, ...this.children.map(c => c.text ? c.text() : String(c.data || ''))].join(' ').trim(); }
  find(label) { if (this.tagName === 'button' && this.textContent === label) return this; for (const c of this.children) { const hit = c.find && c.find(label); if (hit) return hit; } return null; }
  click() { for (const fn of this.listeners.click || []) fn({ preventDefault() {} }); }
}
const ids = ['#error', '#state', '#blockers', '#step-title', '#instruction', '#stages', '#summary', '#questions', '#actions', '#documents', '#review', '#pause', '#resume'];
const els = Object.fromEntries(ids.map(id => [id, new El('div')]));
const server = { next: null, documents: [], passages: [], approvals: [] };
let poll = null;
const context = {
  document: { querySelector: s => els[s], createElement: t => new El(t), createTextNode: t => ({ data: t }) },
  location: { hash: '#token=synthetic', pathname: '/' }, history: { replaceState() {} },
  sessionStorage: { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } },
  URLSearchParams, JSON, Error, Promise, Option: class {}, crypto: { randomUUID: () => 'synthetic-uuid' },
  setInterval: fn => { poll = fn; }, console,
  fetch: async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    let value = { running: false, last: null, next: server.next };
    if (path === '/api/review') value = { documents: server.documents, passages: server.passages, next: server.next };
    if (path === '/api/approve') { server.approvals.push(body); value = { status: 'pass' }; }
    return { ok: true, json: async () => value };
  },
};
const settle = async () => { for (let i = 0; i < 25; i++) await new Promise(r => setImmediate(r)); };
const pending = fingerprint => ({ revision: 3, stage: 'awaiting_copy_approval', kind: 'approval', approval_kind: 'copy', review_fingerprint: fingerprint,
  changed_passages: ['removed:section:guarantee'], instruction: 'Review the changed passages.', stages: ['Copy'], summary: {}, blockers: [] });
(async () => {
  const out = {};
  server.next = pending('first');
  server.documents = [{ path: 'build/page-copy.json', text: 'COPY THE OWNER OPENED' }];
  server.passages = [{ id: 'section:guarantee', status: 'removed', text: 'This passage was removed.' }];
  vm.runInNewContext(fs.readFileSync(process.argv[2], 'utf8'), context);
  await settle();
  els['#actions'].find('Show what changed (1)').click(); await settle();
  out.changed = els['#documents'].text();
  els['#actions'].find('Open complete reviewed content').click(); await settle();
  out.opened = els['#documents'].text(); out.openedOpen = els['#review'].open;
  poll(); await settle();
  out.samePoll = els['#documents'].text();
  server.next = pending('second');  // the copy changed while the pane was open
  poll(); await settle();
  out.afterChange = els['#documents'].text(); out.afterChangeOpen = els['#review'].open;
  els['#actions'].find('Approve 1 changed passage').click(); await settle();
  out.approvals = server.approvals;
  process.stdout.write(JSON.stringify(out));
})().catch(error => { console.error(error); process.exit(1); });
"""


@unittest.skipUnless(shutil.which('node'), 'Node.js runs the guide UI script')
class GuideScreenTests(Temp):
    """copy-approvals#4 and #5 in the actual assets/guide/app.js, with a minimal DOM."""

    def test_stale_review_content_is_cleared_and_removed_passages_are_labelled(self):
        self.write('harness.js', APP_HARNESS)
        run = subprocess.run(['node', str(self.root / 'harness.js'), str(SKILL / 'assets/guide/app.js')], capture_output=True, text=True, timeout=60)
        self.assertEqual(run.returncode, 0, run.stderr)
        out = json.loads(run.stdout)
        self.assertIn('Removed: Section: guarantee', out['changed'])
        self.assertIn('COPY THE OWNER OPENED', out['opened'])
        self.assertTrue(out['openedOpen'])
        self.assertIn('COPY THE OWNER OPENED', out['samePoll'], 'A poll of the same review keeps the open content')
        self.assertNotIn('COPY THE OWNER OPENED', out['afterChange'], 'Content of an older review must not stay beside the new Approve button')
        self.assertFalse(out['afterChangeOpen'])
        self.assertEqual([a['review_fingerprint'] for a in out['approvals']], ['second'])



class ReaderGuide(unittest.TestCase):
    """The synthetic reader-guide fixture used by test_reader_guide.py."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.data = fixture.fixture(self.root, SCRIPTS)

    def save(self):
        build_guide.write_json(self.root / 'build/guide.json', self.data)

    def build(self):
        self.save()
        with contextlib.redirect_stdout(io.StringIO()):
            build_guide.build_reader(self.root, self.root / 'build/guide.json', self.data)
        return q.read(self.root, 'build/guide-build.json')

    def saved(self):
        return json.loads((self.root / 'build/guide.json').read_text())

    def funnel(self, **changes):
        value = json.loads((self.root / 'funnel.json').read_text())
        for field, answer in changes.items():
            target = value
            *parents, last = field.split('.')
            for key in parents:
                target = target.setdefault(key, {})
            target[last] = answer
        build_guide.write_json(self.root / 'funnel.json', value)

    def source(self, ident, text):
        path = self.root / 'research' / (ident + '.txt')
        path.write_text(text)
        self.data['sources'].append({'id': ident, 'kind': 'user', 'title': 'Synthetic ' + ident, 'path': 'research/' + ident + '.txt',
                                     'sha256': q.sha(path), 'retrieved_at': '2026-09-22'})


class GuideImageHandoffTests(ReaderGuide):
    """guide-pdf#0: the build's own sync must not strand a pending illustration request."""

    PROMPT = 'Show a clearly labelled conceptual comparison of two office cleaning scopes.'
    REASON = 'The supplied website has no usable explanatory comparison image.'

    def setUp(self):
        super().setUp()
        plan = json.loads((SKILL / 'assets/image-plan.example.json').read_text())
        plan['assets'] = [plan['assets'][1]]
        storage.write(self.root, 'image-plan.json', plan)
        self.asset = plan['assets'][0]['id']
        self.data['images'] = []  # the illustration is still to be generated

    def failed_first_build(self):
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, 'cover image'):
            build_guide.build_reader(self.root, self.root / 'build/guide.json', self.data)

    def register_and_link(self, packet):
        output = self.root / 'research/synthetic-output.png'
        from PIL import Image
        Image.new('RGB', (900, 600), '#467c81').save(output)
        evidence = self.root / 'research/synthetic-tool-result.json'
        evidence.write_text(json.dumps({'scope': 'synthetic test, no real generation', 'kind': 'native_image_result', 'status': 'succeeded',
                                        'tool': 'synthetic-native-tool', 'tool_call_id': 'synthetic-call', 'output_id': 'synthetic-output',
                                        'raw_result': 'Synthetic fixture output: synthetic-output', 'executed_at': '2026-01-01T00:00:00Z',
                                        'output_sha256': images.sha(output.read_bytes())}))
        plan = images.load_plan(self.root / 'image-plan.json')
        images.register_generation(plan, self.root, self.asset, packet['attempt_id'], output, evidence)
        images.save_plan(self.root / 'image-plan.json', plan, 'synthetic-registration', self.asset)
        self.assertEqual(handoff.inspect(self.root)['kind'], 'work')
        return handoff.link(self.root, 'Illustration comparing two synthetic office cleaning scopes.')

    def test_chapter_request_before_the_first_build_survives_the_build(self):
        text = {key: self.data.pop(key) for key in q.DERIVED_KEYS if key in self.data}
        self.data['content_source'] = q.CONTENT_SOURCE
        build_guide.write_json(self.root / 'build/page-copy.json', {'brochure': {'text': text}})
        self.save()
        packet = handoff.request(self.root, self.asset, 'scope', self.PROMPT, self.REASON)
        self.failed_first_build()
        self.assertIn('chapters', self.saved(), 'The failed build still synced the copy-master text')
        self.assertEqual(handoff.inspect(self.root)['kind'], 'image_handoff')
        self.assertEqual(self.register_and_link(packet)['placement'], 'scope')

    def test_brand_default_added_by_the_first_build_is_not_an_input_change(self):
        del self.data['brand']['colors']['primary']
        self.funnel(**{'client.color': '#123456'})
        self.save()
        packet = handoff.request(self.root, self.asset, 'cover', self.PROMPT, self.REASON)
        self.failed_first_build()
        self.assertEqual(self.saved()['brand']['colors']['primary'], '#123456')
        self.assertEqual(self.register_and_link(packet)['placement'], 'cover')

    def test_real_copy_change_still_invalidates_the_request(self):
        text = {key: self.data.pop(key) for key in q.DERIVED_KEYS if key in self.data}
        self.data['content_source'] = q.CONTENT_SOURCE
        master = {'brochure': {'text': text}}
        build_guide.write_json(self.root / 'build/page-copy.json', master)
        self.save()
        handoff.request(self.root, self.asset, 'scope', self.PROMPT, self.REASON)
        master['brochure']['text']['chapters'][0]['headline'] = 'Check the written scope before you compare prices'
        build_guide.write_json(self.root / 'build/page-copy.json', master)
        self.assertEqual(handoff.inspect(self.root)['kind'], 'reconcile')
        (self.root / 'build/page-copy.json').unlink()  # unreadable guide text is reported, not raised from next_action
        self.assertEqual(handoff.inspect(self.root)['kind'], 'reconcile')


class PriceTableEvidenceTests(ReaderGuide):
    """guide-pdf#1: every printed price must be stated by the excerpt cited for it."""

    def table(self, rows, evidence):
        data = copy.deepcopy(self.data)
        data['chapters'][0]['price_table'] = {'caption': 'Typical visit prices', 'columns': ['Service', 'Price'], 'rows': rows, 'evidence': evidence}
        return data

    def test_made_up_or_uncovered_prices_are_rejected(self):
        self.source('rates', 'Published rate card. Standard office clean from $120 per visit. Deep clean $480 fixed.')
        rows = [['Standard office clean', 'From $120 per visit'], ['Deep clean', '$480 fixed']]
        rate = {'source_id': 'rates', 'excerpt': 'Standard office clean from $120 per visit', 'claim': 'From $120 per visit'}
        deep = {'source_id': 'rates', 'excerpt': 'Deep clean $480 fixed', 'claim': '$480 fixed'}
        invented = self.table([*rows, ['Window clean', '$95']], [{'source_id': 'business', 'excerpt': 'The written scope identifies rooms', 'claim': 'Standard'}])
        with self.assertRaisesRegex(ValueError, 'exact figure'):
            q.validate_content(self.root, invented)
        unstated = self.table(rows, [{**rate, 'excerpt': 'Published rate card. Standard office clean'}, deep])
        with self.assertRaisesRegex(ValueError, 'exact figure'):
            q.validate_content(self.root, unstated)
        uncovered = self.table([*rows, ['Window clean', '$95']], [rate, deep])
        with self.assertRaisesRegex(ValueError, r'never infer prices \(95\)'):
            q.validate_content(self.root, uncovered)
        q.validate_content(self.root, self.table(rows, [rate, deep]))

    def test_contract_four_price_rows_need_a_stated_support_judgment(self):
        self.funnel(**{'quality.contract_version': 4})
        for chapter in self.data['chapters']:
            for item in chapter['evidence']:
                item.update(support_type='direct', reviewer_judgment='The excerpt names this exact task list.')
        self.source('rates', 'Published rate card. Standard office clean from $120 per visit.')
        rate = {'source_id': 'rates', 'excerpt': 'Standard office clean from $120 per visit', 'claim': 'From $120 per visit'}
        rows = [['Standard office clean', 'From $120 per visit']]
        for bad in ({}, {'support_type': 'general_context', 'reviewer_judgment': 'Prices like this are typical.'}):
            with self.assertRaisesRegex(ValueError, 'never inferred'):
                q.validate_content(self.root, self.table(rows, [{**rate, **bad}]))
        q.validate_content(self.root, self.table(rows, [{**rate, 'support_type': 'direct', 'reviewer_judgment': 'The rate card states this price.'}]))


class NarrationTests(ReaderGuide):
    """guide-pdf#2, e2e-walkthrough#4 and guide-pdf#6: lint what the reader reads, and only research voice."""

    def test_unprinted_evidence_is_not_linted_but_reader_text_is(self):
        self.funnel(**{'quality.contract_version': 4})
        for chapter in self.data['chapters']:
            for item in chapter['evidence']:
                item.update(support_type='direct', reviewer_judgment='The site states this service directly. We found it on the captured page.')
        q.validate_content(self.root, self.data)
        self.data['chapters'][0]['paragraphs'][0] += ' The site states this service directly.'
        with self.assertRaisesRegex(ValueError, 'reads like research'):
            q.validate_content(self.root, self.data)

    def test_trade_advice_is_not_research_narration(self):
        for advice in ('Working hours are planned according to the site rules your building manager sets.',
                       'Prices vary according to the site access, so ask for a survey.',
                       'Materials are stored as shown on the site plan.',
                       'On a recent job we found rot behind the fascia, so ask for photos before any repair.'):
            self.assertEqual(q.research_narration(advice, 'Bear Plumbing'), [], advice)
        for narration in ('According to their website, they offer same-day callouts.', 'As listed on the official site, installs take a day.',
                          'Their site states that parts are guaranteed.', 'Our research found two suitable options.',
                          'We could not verify their licence.', 'We found no reviews mentioning delays.'):
            self.assertTrue(q.research_narration(narration, 'Bear Plumbing'), narration)


class ThankYouParityTests(ReaderGuide):
    """guide-pdf#3: a passing guide review does not approve the confirmation hero copy."""

    def compare(self, master):
        import copy_parity
        config = json.loads((self.root / 'build/thank-you.json').read_text())
        thanks = ' '.join(['Your request has been received', config['confirmed_headline'], config['follow_up'],
                           config['download_label'], config['guide_summary']])
        documents = []
        for width in (390, 1440):
            documents += [{'surface': 'landing', 'state': 'initial', 'width': width, 'text': 'Office care that fits your working day Request a quote'},
                          {'surface': 'modal', 'state': 'step-0', 'width': width, 'text': 'Tell us what you need'},
                          {'surface': 'thank_you', 'state': 'confirmation', 'width': width, 'text': thanks}]
        capture = {'status': 'pass', 'execution': {'kind': 'automated', 'exit_code': 0}, 'viewports': [{'width': 390}, {'width': 1440}],
                   'documents': documents, 'synthetic_submissions_attempted': 0}
        return copy_parity.compare(master, {'catalogue': {'enabled': False}}, capture, copy_parity.guide_wording(self.root))

    def test_unapproved_confirmation_headline_and_summary_fail_parity(self):
        self.build()
        fixture.synthetic_review(self.root)
        config = json.loads((self.root / 'build/thank-you.json').read_text())
        master = {'h1': 'Office care that fits your working day', 'primary_cta': 'Request a quote', 'sections': [],
                  'modal': {'title': 'Tell us what you need'},
                  'thank_you': {'follow_up_promise': config['follow_up'], 'download_label': config['download_label']}}
        result = self.compare(master)
        self.assertFalse(result['passed'])
        self.assertTrue(any('thank_you' in f and 'unapproved rendered text' in f for f in result['failures']), result['failures'])
        master['thank_you'].update(headline=config['confirmed_headline'], guide_summary=config['guide_summary'])
        self.assertTrue(self.compare(master)['passed'], 'Approved thank_you copy renders without failures')


class FontDefaultTests(ReaderGuide):
    """guide-pdf#4: an automatic site font must cover everything printed, on every build."""

    def site_font(self):
        (self.root / 'public/assets/fonts').mkdir(parents=True)
        for name in ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'):
            shutil.copy(SKILL / 'assets/pdf-fonts' / name, self.root / 'public/assets/fonts' / name)
        build_guide.write_json(self.root / 'build/brand.json', {'measurements': [{'typography': {'body': {'renderedFonts': [{'familyName': 'DejaVu Sans'}]}}}]})

    def test_caption_characters_count_toward_font_coverage(self):
        self.site_font()
        from reportlab.pdfbase.ttfonts import TTFontFile

        class WithoutCheckMark(TTFontFile):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.charToGlyph = {c: g for c, g in self.charToGlyph.items() if c != 0x2713}
        with mock.patch('reportlab.pdfbase.ttfonts.TTFontFile', WithoutCheckMark):
            self.assertTrue(q.matched_fonts(self.root, self.data))
            self.data['images'][0]['caption'] = 'Test illustration \u2713 a visual aid, not a photograph of a client site.'
            self.assertIsNone(q.matched_fonts(self.root, self.data))

    def test_automatic_font_is_rechecked_and_dropped_when_it_no_longer_fits(self):
        self.site_font()
        self.build()
        self.assertEqual(self.saved()['brand']['fonts']['regular'], '../public/assets/fonts/DejaVuSans.ttf')
        shutil.rmtree(self.root / 'public/assets/fonts')
        with self.assertRaisesRegex(ValueError, 'out of date'):
            q.inspect_build(self.root)
        self.data = self.saved()
        self.build()
        self.assertNotIn('fonts', self.saved()['brand'], 'The bundled DejaVu pair is used again')
        self.assertNotIn(q.AUTO, self.saved()['brand'])
        # A pair an author chose is theirs: it is kept, and a missing file fails loudly.
        self.site_font()
        self.data = self.saved()
        self.data['brand']['fonts'] = {'regular': '../public/assets/fonts/DejaVuSans.ttf', 'bold': '../public/assets/fonts/DejaVuSans-Bold.ttf'}
        self.build()
        self.assertNotIn(q.AUTO, self.saved()['brand'])
        (self.root / 'public/assets/fonts/DejaVuSans.ttf').unlink()
        with self.assertRaisesRegex(ValueError, 'font is missing'):
            self.build()


class BrandColourTests(ReaderGuide):
    """guide-pdf#7: the automatic brand colour must keep the cover band legible, and follow corrections."""

    def test_light_colour_is_not_adopted_and_an_adopted_one_follows_corrections(self):
        del self.data['brand']['colors']['primary']
        self.funnel(**{'client.color': '#F5C400'})
        self.build()
        self.assertNotIn('primary', self.saved()['brand']['colors'], 'White on #F5C400 is 1.6:1; the maintained navy is used')
        self.funnel(**{'client.color': '#0B3D91'})
        self.data = self.saved()
        self.build()
        self.assertEqual(self.saved()['brand']['colors']['primary'], '#0B3D91')
        self.funnel(**{'client.color': '#123456'})
        with self.assertRaisesRegex(ValueError, 'out of date'):
            q.inspect_build(self.root)
        self.data = self.saved()
        self.build()
        self.assertEqual(self.saved()['brand']['colors']['primary'], '#123456')

    def test_band_caption_falls_back_to_white_when_the_accent_is_illegible(self):
        import build_reader_guide
        real, seen = build_reader_guide.ParagraphStyle, {}

        def record(name, **options):
            seen[name] = options.get('textColor')
            return real(name, **options)
        self.data['brand']['colors']['primary'] = '#767676'  # white passes 4.5:1, the default accent is 3.2:1
        with mock.patch.object(build_reader_guide, 'ParagraphStyle', record):
            self.build()
        self.assertEqual(seen['BandCaption'].hexval(), '0xffffff')
        self.data['brand']['colors']['primary'] = '#174e40'
        with mock.patch.object(build_reader_guide, 'ParagraphStyle', record):
            self.build()
        self.assertEqual(seen['BandCaption'].hexval(), '0xf2d58c')


class GuideTextExtractionTests(ReaderGuide):
    """guide-pdf#8: review excerpts can quote a wrapped price-table cell exactly."""

    def test_wrapped_table_cell_is_contiguous_in_the_extracted_text(self):
        self.source('rates', 'Published rate card. Standard office clean from $120 per visit.')
        cell = 'Kitchen and washroom surfaces, bins, floors and desks in shared areas, plus a monthly check of every meeting room'
        self.data['chapters'][0]['price_table'] = {'caption': 'Typical visit prices', 'columns': ['Service', 'Includes', 'Price'],
                                                   'rows': [['Standard office clean', cell, 'From $120 per visit']],
                                                   'evidence': [{'source_id': 'rates', 'excerpt': 'Standard office clean from $120 per visit', 'claim': 'From $120 per visit'}]}
        report = self.build()
        self.assertIn(q.norm(cell), q.norm((self.root / report['text_output']).read_text()))


class MarkdownGuideApprovalTests(Temp):
    """guide-pdf#5: in a markdown-copy project the PDF guide text is still owner-approved copy."""

    def setUp(self):
        super().setUp()
        config = {'backend': {'provider': 'none'}, 'offer': 'Office cleaning', 'quality': {'reader_guide_version': 1},
                  'guided_workflow': {'schema_version': 1, 'mode': 'guided', 'goal': 'preview', 'copy_format': 'markdown'}}
        self.write('funnel.json', config)
        self.write('build/guide-business.json', workflow.business_contract(config))
        self.write('build/copy-review-inputs.json', {'inputs': {'business': {'path': 'build/guide-business.json',
                                                     'sha256': hashlib.sha256((self.root / 'build/guide-business.json').read_bytes()).hexdigest()}}})
        for name, text in (('build/page-copy.md', '# Office cleaning that fits your day\nA clear task list.\n'),
                           ('build/strategy-brief.md', 'Synthetic brief.'), ('build/claim-ledger.md', 'Synthetic ledger.'),
                           ('build/copy-editorial-review.json', '{}')):
            self.write(name, text)
        self.write('build/guide.json', {'document_type': 'buyer_guide', 'content_source': q.CONTENT_SOURCE})
        self.master = {'brochure': {'text': {'title': 'Choose a cleaning scope that covers the work you need', 'chapters': []}}}
        self.write('build/page-copy.json', self.master)
        import copy_acceptance
        self.patch(copy_acceptance, 'verify_review', lambda *args: {'status': 'pass', 'failures': []})

    def test_guide_text_edit_needs_owner_reapproval(self):
        self.assertIn('pdf_guide', workflow.copy_state(self.root)['passages'])
        workflow.record(self.root, 'copy', 'I approve this copy.', 'msg-1')
        self.assertEqual(workflow.check_copy_approval(self.root)['status'], 'pass')
        self.master['brochure']['text']['title'] = 'Guaranteed spotless offices or your money back'
        self.write('build/page-copy.json', self.master)
        result = workflow.check_copy_approval(self.root)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['changed_passages'], ['pdf_guide'])
        self.master['brochure']['text']['title'] = 'Choose a cleaning scope \u2014 then compare quotes'
        self.write('build/page-copy.json', self.master)
        self.assertTrue(any('page-copy.json' in f and 'long dash' in f for f in workflow.copy_surface_failures(self.root)))


class ArchetypeTests(Temp):
    """image-proof#10: the local-trade sign-off cannot silently switch off for want of an archetype."""

    FIT = {'category': 'residential plumbing', 'target_buyer': 'Lancaster homeowners with a repair to arrange',
           'reads_as_category_without_brand': True, 'first_party_proof': 'none_available',
           'reasoning': 'Without the name, the plumbing photos, palette and service words still read as a local plumber.',
           'media_strategy': 'Job photos lead; one realistic illustration supports the process.'}

    def test_ambiguous_business_type_is_asked_and_answer_sets_the_archetype(self):
        guide.start(self.root, name='Synthetic Plumbing')
        source = self.root / 'research/home.html'
        source.write_text('<p>Plumbing repairs, bathroom design and a showroom.</p>')
        evidence = {'path': 'research/home.html', 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
        unresolved = [{'id': q, 'category': 'identity' if q == 'business_type' else 'offer', 'reason': 'The captured page does not settle this',
                       'material_effect': 'The answer changes the page', 'evidence': [evidence]}
                      for q in ('business_type', 'service', 'audience', 'region', 'offer', 'conversion')]
        storage.write(self.root, 'build/discovery.json', {'schema_version': 1, 'input_fingerprint': guide.research_fingerprint(self.root), 'unresolved_facts': unresolved, 'suggestions': [
            {'id': 'business_type', 'ambiguous': True, 'reason': 'The site describes both on-site repairs and a showroom.',
             'source_path': 'research/home.html', 'source_sha256': evidence['sha256'], 'excerpt': 'Plumbing repairs'}]})
        guide.discover(self.root)
        asked = {question['id']: question for question in guide.present(self.root)['questions']}
        self.assertIn('business_type', asked, 'The owner is asked the question research flagged')
        record = guide.state(self.root)
        guide.answer(self.root, {'actor': 'user', 'message_id': 'synthetic:message', 'event_id': 'business-type', 'expected_revision': record['revision'],
                                 'answers': [{'id': 'business_type', 'value': 'local_trade', 'question_revision': asked['business_type']['question_revision']}]})
        self.assertEqual(guide.config(self.root)['business']['archetype'], 'local_trade')
        self.assertNotIn('business_type', [question['id'] for question in guide.questions(self.root)])

    def test_contract_four_visual_acceptance_needs_an_archetype(self):
        self.write('funnel.json', {'quality': {'contract_version': 4}})
        errors = visual_direction.category_fit_errors(self.root, {'category_fit': self.FIT}, 'self_review')
        self.assertTrue(any('business.archetype' in error for error in errors), errors)
        self.write('funnel.json', {'quality': {'contract_version': 4}, 'business': {'archetype': 'professional_service'}})
        self.assertEqual(visual_direction.category_fit_errors(self.root, {'category_fit': self.FIT}, 'self_review'), [])


class LocalCommandTests(Temp):
    """e2e-walkthrough#10: the CLI keeps a local step's own instruction and reports real overflow widths."""

    def test_local_output_keeps_the_bootstrap_step(self):
        hint = 'Run python3 scripts/quickstart.py bootstrap --project . before helpers that use a browser.'
        output = io.StringIO()
        with mock.patch.object(guide, 'local', return_value={'status': 'scaffolded', 'remote_changes': False, 'next': hint}), \
                mock.patch.object(guide, 'next_action', return_value={'kind': 'work', 'stage': 'research'}), \
                mock.patch.object(sys, 'argv', ['guide.py', 'local', str(self.root), '--operation', 'scaffold']), contextlib.redirect_stdout(output):
            self.assertEqual(guide.main(), 0)
        result = json.loads(output.getvalue())
        self.assertEqual((result['setup'], result['next']['stage']), (hint, 'research'))

    def test_thank_you_overflow_failure_reports_the_measured_width(self):
        line = next(text for text in (SCRIPTS / 'measure_funnel.mjs').read_text().splitlines() if "check('thank_you_overflow'" in text)
        self.assertNotIn('fits viewport', line)
        self.assertIn('${thankYou.pageWidth}px', line)


if __name__ == '__main__':
    unittest.main()
