"""Regressions for the docs/verify review group: the one-command verifier, its fixture,
project bootstrap, stale demos, stage-scoped document checks and copy-quality IDs.

Synthetic fixtures only; Lighthouse, browsers, Wrangler and pip are stubbed or skipped.
"""
from contextlib import contextmanager
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1]
REPO = SKILL.parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))

import check_gates  # noqa: E402
import completion_contract  # noqa: E402
import copy_quality  # noqa: E402
import demo_project  # noqa: E402
import process_contract  # noqa: E402
import project_verify  # noqa: E402
import question_log  # noqa: E402
import quickstart  # noqa: E402
import scaffold_project  # noqa: E402
import validate_required_records  # noqa: E402

NODE = shutil.which('node')
FIELDS = json.loads((SKILL / 'assets/cloudflare/src/site-config.json').read_text())['formFields']
SERVER = ['node', 'node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8799']


def write(root, name, value):
    path = Path(root) / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value))
    return {'path': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def node_module(script, *argv, cwd=None):
    result = subprocess.run([NODE, '--input-type=module', '-e', script, *argv], capture_output=True, text=True, cwd=cwd, timeout=60)
    if result.returncode:
        raise AssertionError(result.stderr[-2000:])
    return json.loads(result.stdout)


def uri(name):
    return json.dumps((SKILL / 'assets/cloudflare/scripts' / name).as_uri())


class FixtureContractTests(unittest.TestCase):
    """e2e-walkthrough#0: the generated fixture must satisfy the live-verify journey contract."""

    @unittest.skipUnless(NODE, 'node is required to run the live-verify contract')
    def test_generated_fixture_passes_live_verify_scope_checks_for_every_policy(self):
        fixtures = []
        with tempfile.TemporaryDirectory() as temp:
            for attribution in ('lead', 'disabled'):
                for analytics in ('disabled', 'consent', 'essential'):
                    write(temp, 'funnel.json', {'form_fields': FIELDS, 'analytics': {'mode': analytics, 'attribution_mode': attribution}})
                    fixtures.append(project_verify.fixture_from_funnel(temp))
        result = node_module(f"""
import {{ATTRIBUTION_KEYS, testRunOptions}} from {uri('live-verify.mjs')};
import {{loadFixture}} from {uri('browser-compat.mjs')};
const outcome = f => {{ try {{ loadFixture(f); return testRunOptions({{'allow-test-lead': true}}, f); }} catch (error) {{ return error.message; }} }};
console.log(JSON.stringify({{keys: ATTRIBUTION_KEYS, results: JSON.parse(process.argv[1]).map(outcome)}}));
""", json.dumps(fixtures))
        self.assertEqual(list(project_verify.ATTRIBUTION_KEYS), result['keys'], 'Keep the Python list pinned to live-verify.mjs')
        self.assertEqual(result['results'], [{'readOnly': False}] * len(fixtures))
        self.assertEqual({'source': 'google', 'traffic': 'paid', 'device': 'desktop'}, fixtures[0]['expected_dimensions'])

    @unittest.skipUnless(NODE, 'node is required to run the live-verify contract')
    def test_documented_example_fixture_passes_the_same_checks(self):
        doc = (SKILL / 'references/performance-and-browser-qa.md').read_text()
        example = json.loads(doc.split('## Site-specific fixture', 1)[1].split('```json', 1)[1].split('```', 1)[0])
        result = node_module(f"""
import {{testRunOptions}} from {uri('live-verify.mjs')};
import {{loadFixture}} from {uri('browser-compat.mjs')};
const fixture = loadFixture(JSON.parse(process.argv[1]));
console.log(JSON.stringify(testRunOptions({{'allow-test-lead': true}}, fixture)));
""", json.dumps(example))
        self.assertEqual(result, {'readOnly': False})

    def test_first_generator_fixture_is_upgraded_and_a_reviewed_fixture_is_kept(self):
        with tempfile.TemporaryDirectory() as temp:
            write(temp, 'funnel.json', {'form_fields': FIELDS, 'analytics': {'mode': 'essential', 'attribution_mode': 'lead'}})
            legacy = {**project_verify.fixture_from_funnel(temp), 'query': dict(project_verify.LEGACY_QUERY),
                      'expected_features': {'first_party_attribution': True, 'measured_visit': False}, 'fields': {'email': 'reviewed@example.invalid'}}
            write(temp, 'test-fixture.json', legacy)
            self.assertTrue(project_verify.ensure_fixture(temp))
            upgraded = json.loads(Path(temp, 'test-fixture.json').read_text())
            self.assertEqual(set(upgraded['query']), set(project_verify.ATTRIBUTION_KEYS))
            self.assertTrue(upgraded['expected_features']['measured_visit'])
            self.assertEqual(upgraded['fields'], {'email': 'reviewed@example.invalid'}, 'Reviewed fields survive the upgrade')
            reviewed = {**upgraded, 'query': {**upgraded['query'], 'utm_campaign': 'reviewed-campaign'}}
            write(temp, 'test-fixture.json', reviewed)
            self.assertFalse(project_verify.ensure_fixture(temp))
            self.assertEqual(json.loads(Path(temp, 'test-fixture.json').read_text()), reviewed)


class VerifyProjectTests(unittest.TestCase):
    """docs-consistency#0, verify-tooling-ci#1-#3: the one-command verifier on a non-fixture project."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        write(self.root, 'funnel.json', {'quality': {'contract_version': 4, 'complete_workflow': True}, 'form_fields': FIELDS,
                                         'backend': {'provider': 'cloudflare-d1'}, 'analytics': {'mode': 'disabled', 'attribution_mode': 'lead'}})
        write(self.root, 'src/worker.js', 'export default {};\n')
        write(self.root, 'public/index.html', '<h1>Synthetic service</h1>')
        self.snapshot('handoff')

    def snapshot(self, mode):
        value = {'schema_version': 1, 'created_at': check_gates.now(), 'mode': mode, **check_gates.source_snapshot(self.root)}
        write(self.root, 'build/gate-snapshot.json', value)
        return value

    def verify(self, mode='handoff', runs=1, failing=(), gates=None):
        """Run verify_project with every tool call stubbed; return the executed commands."""
        commands = []

        def run(command, **kwargs):
            command = [str(value) for value in command]
            commands.append(command)
            failed = '--gate' in command and command[command.index('--gate') + 1] in failing
            stdout = json.dumps({'gates': gates or {}}) if 'check' in command else '{}'
            return subprocess.CompletedProcess(command, 1 if failed else 0, stdout, 'synthetic failure' if failed else '')

        @contextmanager
        def server(*_args, **_kwargs):
            yield 'http://127.0.0.1:8799', type('Server', (), {'args': SERVER})()

        with patch.object(project_verify, 'project_server', server), patch.object(project_verify.subprocess, 'run', side_effect=run), \
                patch.object(quickstart, 'local_verification_access', return_value=([], 'owner')):
            self.result = project_verify.verify_project(self.root, 'node', mode, runs)
        return commands

    @staticmethod
    def uses(commands, tool):
        return [command for command in commands if tool in command]

    def test_handoff_runs_three_lighthouse_audits_with_the_actual_server_command(self):
        audit = self.uses(self.verify('handoff'), 'scripts/performance-audit.mjs')[0]
        self.assertEqual(audit[audit.index('--runs') + 1], '3')
        self.assertEqual(audit[audit.index('--server-command') + 1], ' '.join(SERVER))
        preview = self.uses(self.verify('preview'), 'scripts/performance-audit.mjs')[0]
        self.assertEqual(preview[preview.index('--runs') + 1], '1', 'Preview keeps its quick single diagnostic run')

    @unittest.skipUnless(NODE, 'node is required to run performance-audit.mjs')
    def test_verify_performance_arguments_produce_a_recordable_handoff_report(self):
        audit = self.uses(self.verify('handoff'), 'scripts/performance-audit.mjs')[0]
        snapshot = self.snapshot('handoff')
        node_module(f"""
import {{runPerformance}} from {uri('performance-audit.mjs')};
import {{parseArgs}} from {uri('browser-compat.mjs')};
const lhr = url => ({{lighthouseVersion: '12.0.0-synthetic', requestedUrl: url, configSettings: {{formFactor: 'mobile', throttlingMethod: 'simulate'}},
  categories: {{performance: {{score: 0.97}}}}, audits: {{'largest-contentful-paint': {{numericValue: 1800}}, 'cumulative-layout-shift': {{numericValue: 0.01}},
  'total-blocking-time': {{numericValue: 40}}}}}});
const report = await runPerformance(parseArgs(JSON.parse(process.argv[1])), {{lighthouse: async url => ({{lhr: lhr(url)}}), launch: async () => ({{port: 9, kill: async () => {{}}}}), env: {{}}}});
console.log(JSON.stringify({{status: report.status}}));
""", json.dumps(audit[2:]), cwd=self.root)
        report = json.loads((self.root / 'build/performance/result.json').read_text())
        self.assertEqual(check_gates.validate_report(self.root, report, snapshot, 'performance'), [])

    def final_review(self):
        (self.root / 'build/layout/final-states').mkdir(parents=True)
        captures = write(self.root, 'build/layout/final-states/result.json', {'status': 'pass'})
        journey = write(self.root, 'build/live-verification/first/local-journey.json', {'status': 'pass'})
        control = write(self.root, 'build/control-review/result.json', {'status': 'pass'})
        write(self.root, 'build/control-review/acceptance.json', {'status': 'pass'})
        write(self.root, 'build/final-review.json', {'gate': 'final_review', 'capture_reports': [captures, journey], 'control_review': control})
        write(self.root, 'build/gates.json', {'gates': {gate: {'status': 'pass'} for gate in ('final_review', 'local_journey', 'control_review', 'browser', 'performance')}})

    def test_rerun_records_a_current_final_review_first_and_keeps_what_it_cites(self):
        self.final_review()
        commands = self.verify('handoff')
        records = [command[command.index('--gate') + 1] for command in commands if 'record' in command and '--gate' in command]
        self.assertEqual(records[0], 'final_review', 'Recorded against the existing snapshot, before anything is regenerated')
        self.assertLess(commands.index(self.uses(commands, 'record')[0]), commands.index(self.uses(commands, 'snapshot')[0]))
        for tool in ('scripts/capture-final-states.mjs', 'scripts/live-verify.mjs', 'scripts/control_review.py'):
            self.assertFalse(self.uses(commands, tool), tool + ' would invalidate the final review it cites')
        self.assertTrue(self.uses(commands, 'scripts/performance-audit.mjs'), 'Uncited gates still re-run')
        self.assertIn('check_gates.py record . --gate final_review --report build/final-review.json', self.hint('final_review'))

    def hint(self, gate):
        self.verify('handoff', gates={gate: {'status': 'blocked', 'failures': ['Required gate has no evidence']}})
        return next(action for action in self.result['next_actions'] if action.startswith(gate + ':'))

    def test_a_stale_final_review_regenerates_every_capture(self):
        self.final_review()
        commands = self.verify('handoff', failing={'final_review'})
        for tool in ('scripts/capture-final-states.mjs', 'scripts/live-verify.mjs', 'scripts/control_review.py'):
            self.assertTrue(self.uses(commands, tool), tool)

    def test_only_no_download_tool_candidates_ask_the_owner_for_photos(self):
        evidence = write(self.root, 'research/home.html', '<img src="crew.jpg">')
        write(self.root, 'image-plan.json', {'assets': [], 'proof_candidates': [
            {'inventory_id': 'source-new', 'subject': 'crew on site', 'disposition': None},
            {'inventory_id': 'source-owner', 'subject': 'finished job', 'disposition': 'no-download-tool',
             'reason': 'This environment has no download tool for the client site', 'evidence': evidence}]})
        self.verify('handoff')
        actions = [action for action in self.result['next_actions'] if action.startswith('proof photos:')]
        owner = [action for action in actions if 'ask the owner' in action]
        self.assertEqual(len(owner), 1)
        self.assertIn('(source-owner)', owner[0])
        self.assertTrue(any('source-new' in action and 'no disposition' in action for action in actions), actions)


class BootstrapTests(unittest.TestCase):
    """verify-tooling-ci#0: project-level bootstrap in a generated project."""

    DRIVER = r'''
import json, subprocess, sys
from pathlib import Path
project = Path(sys.argv[1])
sys.path.insert(0, str(project / "scripts"))
sys.modules["reportlab"] = None  # this interpreter lacks the PDF libraries
import quickstart
calls = []
def venv(command, **kwargs):
    target = Path(command[-1]); (target / "bin").mkdir(parents=True, exist_ok=True); (target / "pyvenv.cfg").write_text("home = synthetic\n")
    return subprocess.CompletedProcess(command, 0)
def run(command, cwd, node=None, label="Command", env=None, timeout=600):
    calls.append([str(value) for value in command])
    raise ValueError(label + " failed offline.")
quickstart.subprocess.run, quickstart.run = venv, run
outcome = "installed"
try:
    quickstart.bootstrap("node", project)
except ValueError as error:
    outcome = str(error)
print(json.dumps({"pip": calls[0] if calls else None, "outcome": outcome, "venv_left": (project / ".venv").exists()}))
'''

    def test_scaffolded_project_bootstrap_uses_its_bundled_requirements_and_leaves_no_broken_venv(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp).resolve() / 'project'
            scaffold = subprocess.run([sys.executable, str(SKILL / 'scripts/scaffold_project.py'), str(project), '--client', 'Synthetic', '--website', 'https://example.org'],
                                      capture_output=True, text=True, timeout=120)
            self.assertEqual(scaffold.returncode, 0, scaffold.stderr)
            result = subprocess.run([sys.executable, '-c', self.DRIVER, str(project)], capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr)
            value = json.loads(result.stdout)
            requirements = Path(value['pip'][value['pip'].index('-r') + 1])
            self.assertEqual(requirements, project / '.community-builder/requirements-build.txt')
            self.assertTrue(requirements.is_file())
            self.assertIn('Private Python environment setup failed', value['outcome'])
            self.assertFalse(value['venv_left'], 'A failed install must not leave a venv that later commands re-enter')

    def test_quickstart_reenters_only_a_private_environment_that_imports_the_pdf_libraries(self):
        with tempfile.TemporaryDirectory() as temp:
            python = Path(temp) / '.venv/bin/python'
            python.parent.mkdir(parents=True)
            with patch.object(quickstart, 'SKILL', Path(temp)):
                for code, expected in ((1, None), (0, python)):
                    python.write_text(f'#!/bin/sh\nexit {code}\n')
                    python.chmod(0o755)
                    self.assertEqual(quickstart.private_python(), expected)


class DemoCurrencyTests(unittest.TestCase):
    """verify-tooling-ci#4: a demo that lacks a helper the current skill ships is stale."""

    def test_missing_helper_marks_the_demo_stale(self):
        with tempfile.TemporaryDirectory() as temp:
            scripts = Path(temp) / 'scripts'
            scripts.mkdir()
            write(temp, demo_project.MARKER, {'schema_version': 1, 'kind': 'synthetic-local-demo'})
            for source in [*(SKILL / 'scripts').glob('*.py'), *(SKILL / 'scripts').glob('*.mjs'), *(SKILL / 'assets/cloudflare/scripts').glob('*')]:
                shutil.copy2(source, scripts / source.name)
            self.assertEqual(demo_project.stale_helpers(temp), [])
            (scripts / 'capture-final-states.mjs').unlink()
            self.assertEqual(demo_project.stale_helpers(temp), ['capture-final-states.mjs'])
            with self.assertRaisesRegex(ValueError, 'differ or are missing'):
                demo_project.assert_current(temp)


class StageDocumentTests(unittest.TestCase):
    """e2e-walkthrough#1/#2: stage-scoped workflow documents under contract 4."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        write(self.root, 'funnel.json', {'quality': {'contract_version': 4}})
        for name, content in scaffold_project.DOCS.items():
            write(self.root, 'docs/' + name, content)

    def docs(self, stage):
        return {e.rsplit('docs/', 1)[1] for e in validate_required_records.validate(self.root, stage) if 'docs/' in e}

    def test_copy_and_build_gates_do_not_require_post_build_documents(self):
        self.assertEqual(self.docs('copy'), set(process_contract.COPY_GATE_DOCS))
        self.assertEqual(self.docs('build'), set(process_contract.BUILD_GATE_DOCS))
        self.assertIn('QA-REPORT.md', self.docs('handoff'))
        write(self.root, 'docs/QA-REPORT.md', '# QA\n\n| Check | Status |\n| --- | --- |\n')
        self.assertIn('QA-REPORT.md', self.docs('handoff'), 'An empty QA table still blocks handoff')
        self.assertIn('QA-REPORT.md', {e.rsplit('docs/', 1)[1] for e in completion_contract.inspect(self.root)['failures'] if 'docs/' in e})

    def test_fast_path_research_records_render_their_document_views(self):
        brief = write(self.root, 'build/strategy-brief.md', 'Synthetic buyer situation, offer, objections and proof drawn from the captured sources. ' * 3)
        ledger = write(self.root, 'build/claim-ledger.md', '| Claim | Source |\n| --- | --- |\n| Synthetic claim | research/home.html |\n' * 2)
        write(self.root, 'build/document-sources.json', {'documents': {'RESEARCH-BRIEF.md': brief, 'CLAIM-LEDGER.md': ledger}})
        completion_contract.render_documents(self.root)
        self.assertFalse({'RESEARCH-BRIEF.md', 'CLAIM-LEDGER.md'} & self.docs('copy'))
        step = (SKILL / 'SKILL.md').read_text().split('4. **Evidence, once.**', 1)[1].split('\n', 1)[0]
        self.assertNotIn('also satisfy', step)
        self.assertIn('build/document-sources.json', step)
        self.assertIn('check_gates.py documents', step)


class CopyQualityTests(unittest.TestCase):
    """e2e-walkthrough#5: one disposition per lint finding resolves repeated risk words."""

    def test_repeated_risk_word_needs_one_disposition(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            copy = 'Licensed plumbers for your home. Our Licensed team explains every quote.'
            write(root, 'funnel.json', {'backend': {'provider': 'none'}, 'catalogue': {'enabled': False}, 'quality': {'contract_version': 4},
                                        'guided_workflow': {'copy_format': 'markdown'}, 'business_follow_up_promise': 'Unknown; confirm with the business',
                                        'follow_up_promise': 'Unknown; confirm with the business', 'preview_disclosure': 'Preview only.',
                                        'local_test_behavior': 'Synthetic local-only persistence test'})
            write(root, 'build/page-copy.md', copy)
            source = write(root, 'research/source.txt', 'Our Licensed team is licensed in this synthetic state.')
            measured = copy_quality.lint(root)
            self.assertEqual([f['excerpt'] for f in measured['findings']], ['Licensed'])
            write(root, 'build/copy-quality-review.json', {
                'copy': measured['copy'], 'reviewer': 'Synthetic self-review', 'status': 'pass', 'review_theme_use': [],
                'findings': [{'id': f['id'], 'disposition': 'accepted_limit', 'reason': 'Sourced licence claim', 'evidence': source} for f in measured['findings']],
                'checks': {key: {'status': 'pass', 'observations': 'Synthetic observation', 'evidence': source} for key in copy_quality.SEMANTIC_DOMAINS}})
            write(root, 'build/claim-review.json', {'copy': measured['copy'], 'coverage': {'status': 'pass', 'observations': 'Synthetic copy inspected'},
                'claims': [{'id': 'licensed', 'wording': 'Licensed plumbers', 'truth_class': 'direct_fact', 'source_excerpt': 'Our Licensed team',
                            'evidence': source, 'qualifier': 'In this synthetic state', 'paraphrase_boundary': 'Licence only',
                            'locations': ['hero'], 'reviewer_judgment': 'Supported', 'status': 'pass'}]})
            write(root, 'build/review-insights.json', {'themes': {}})
            self.assertEqual(copy_quality.inspect(root), [])


class DocumentationConsistencyTests(unittest.TestCase):
    """docs-consistency#1-#12: the references state what the tools enforce."""

    def read(self, name):
        return (SKILL / name).read_text()

    def test_viewports_and_lighthouse_runs_match_the_gates(self):
        measured = self.read('references/measured-qa.md')
        self.assertIn('320×700', measured.split('## Browser coverage', 1)[1].split('\n\n', 2)[1])
        for name in ('references/first-run.md', 'scripts/quickstart.py'):
            self.assertNotIn('nine-viewport', self.read(name).lower(), name)
        for name in ('SKILL.md', 'references/quality-gates.md'):
            self.assertNotIn('one local mobile Lighthouse pass', self.read(name), name)
        self.assertIn('--server-command', self.read('references/performance-and-browser-qa.md'))

    def test_visual_contract_names_the_keys_the_visual_gate_reads(self):
        row = next(line for line in self.read('references/measured-qa.md').splitlines() if line.startswith('| visual |'))
        for key in ('review_provenance', 'reviewer_task_id', 'builder_task_id', 'reviewed_source_fingerprint', 'findings', 'retests', 'limits', 'category_fit'):
            self.assertIn(key, row)

    def test_references_name_only_existing_commands_and_records(self):
        self.assertNotIn('portable_handoff.py export', self.read('references/completion-integrity.md'))
        orchestration = self.read('references/orchestration.md')
        self.assertNotIn('build/reviews/', orchestration)
        self.assertNotIn('host: claude-code', orchestration)
        self.assertNotIn('retained, not overwritten', orchestration)
        self.assertNotIn('implementation status', (REPO / 'GUIDED-PUBLISHING-START-HERE.md').read_text())
        self.assertNotIn('installed-skill suite', self.read('references/first-run.md'))
        categories = re.search(r'`category`\s*\(([^)]*)\)', self.read('references/remediation-contracts.md')).group(1)
        for category in question_log.MATERIAL:
            self.assertIn(category, categories)

    def test_guided_copy_approval_is_not_described_as_opt_in(self):
        approval = self.read('references/approval-workflow.md')
        self.assertNotIn('Only when `funnel.json` sets', approval)
        self.assertIn('guided mode', approval.lower())
        self.assertNotIn('Keep the default no-copy-approval setting while', self.read('SKILL.md'))


if __name__ == '__main__':
    unittest.main()
