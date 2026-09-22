#!/usr/bin/env python3
"""Offline regression tests: routing, native profiles, task state and safe installation."""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import native_routing as nr
import install_native as installer

class RoutingTests(unittest.TestCase):
    def cap(self, provider='codex'):
        profiles = list(nr.policy()['providers'][provider].values())
        for role in nr.policy()['roles'].values():
            profiles.extend(role.get('provider_routes', {}).get(provider, []))
        models = {}
        for profile in profiles:
            models.setdefault(profile['model'], [])
            if profile['effort'] is not None and profile['effort'] not in models[profile['model']]:
                models[profile['model']].append(profile['effort'])
        return {'provider': provider, 'native_subagents': True, 'model_selection': True,
                'evidence': 'Synthetic native schema/model picker fixture',
                'models': models}

    def test_no_capability_defaults_sequential(self):
        for runtime in ['codex', 'claude', 'chat']:
            result = nr.resolve('frontend', runtime)
            self.assertEqual(result['execution'], 'sequential')
            self.assertIsNone(result['model'])

    def test_mechanical_has_no_model(self):
        result = nr.resolve('mechanical', 'codex', capabilities=self.cap())
        self.assertEqual(result['execution'], 'tool')
        self.assertIsNone(result['agent'])

    def test_codex_profiles(self):
        result = nr.resolve('frontend', 'codex', capabilities=self.cap())
        self.assertEqual((result['model'], result['effort']), ('gpt-5.6-terra', 'medium'))

    def test_claude_profiles(self):
        cap = self.cap('claude')
        self.assertEqual(nr.resolve('frontend', 'claude', capabilities=cap)['model'], 'sonnet')
        self.assertEqual(nr.resolve('copy', 'claude', capabilities=cap)['model'], 'sonnet')
        self.assertEqual(nr.resolve('review', 'claude', capabilities=cap)['model'], 'sonnet')
        result = nr.resolve('research', 'claude', capabilities=cap)
        self.assertEqual(result['model'], 'haiku')
        self.assertIsNone(result['effort'])

    def test_provider_native_copy_and_review_routes(self):
        codex = self.cap('codex')
        self.assertEqual(nr.resolve('copy', 'codex', capabilities=codex)['model'], 'gpt-6-astra')
        self.assertEqual(nr.resolve('review', 'codex', capabilities=codex)['model'], 'gpt-5.6-sol')
        claude = self.cap('claude')
        self.assertEqual(nr.resolve('copy', 'claude', capabilities=claude)['model'], 'sonnet')
        self.assertEqual(nr.resolve('review', 'claude', capabilities=claude)['model'], 'sonnet')

    def test_no_cross_provider_routing(self):
        result = nr.resolve('copy', 'codex', capabilities=self.cap('claude'))
        self.assertEqual(result['execution'], 'sequential')

    def test_missing_model_inherits(self):
        cap = self.cap(); cap['models'] = {}
        result = nr.resolve('copy', 'codex', capabilities=cap)
        self.assertIsNone(result['model'])
        self.assertEqual(result['execution'], 'native_subagent')

    def test_stronger_available_fallback(self):
        cap = self.cap(); del cap['models']['gpt-5.6-luna']
        result = nr.resolve('research', 'codex', capabilities=cap)
        self.assertEqual(result['model'], 'gpt-5.6-terra')

    def test_unsupported_effort_not_emitted(self):
        cap = self.cap(); cap['models'] = {'gpt-5.6': ['low']}
        result = nr.resolve('copy', 'codex', capabilities=cap)
        self.assertIsNone(result['model'])
        self.assertIsNone(result['effort'])

    def test_no_model_selection_inherits_both(self):
        cap = self.cap(); cap['model_selection'] = False
        result = nr.resolve('copy', 'codex', capabilities=cap)
        self.assertIsNone(result['model']); self.assertIsNone(result['effort'])

    def test_third_attempt_escalates(self):
        cap = self.cap()
        self.assertEqual(nr.resolve('frontend', 'codex', attempt=2, capabilities=cap)['tier'], 'standard')
        self.assertEqual(nr.resolve('frontend', 'codex', attempt=3, capabilities=cap)['tier'], 'deep')

    def test_high_risk_skips_small_models(self):
        result = nr.resolve('frontend', 'codex', capabilities=self.cap(), high_risk=True)
        self.assertEqual(result['tier'], 'critical')
        self.assertEqual(result['effort'], 'xhigh')

    def test_escalation_selects_matching_native_profile(self):
        route = nr.resolve('frontend', 'codex', attempt=3, capabilities=self.cap())
        self.assertEqual(route['agent'], 'lp-deep')
        import tomllib
        config = tomllib.loads(installer.render('codex')['.codex/agents/' + route['agent'] + '.toml'].decode())
        self.assertEqual(config['model'], route['model'])
        self.assertEqual(config['model_reasoning_effort'], route['effort'])

    def test_fallback_uses_real_inherited_profile(self):
        cap = self.cap(); cap['models'] = {}
        route = nr.resolve('frontend', 'codex', capabilities=cap)
        self.assertEqual(route['agent'], 'lp-inherit')
        text = installer.render('codex')['.codex/agents/lp-inherit.toml'].decode()
        self.assertNotIn('\nmodel =', text)
        self.assertNotIn('model_reasoning_effort =', text)

    def test_review_fallback_preserves_read_only_profile(self):
        cap = self.cap(); cap['models'] = {}
        route = nr.resolve('review', 'codex', capabilities=cap)
        self.assertEqual(route['agent'], 'lp-reviewer-inherit')
        text = installer.render('codex')['.codex/agents/lp-reviewer-inherit.toml'].decode()
        self.assertIn('sandbox_mode = "read-only"', text)

    def test_every_resolved_profile_matches_both_runtimes(self):
        import tomllib
        for provider in ('codex', 'claude'):
            files = installer.render(provider)
            for role in nr.policy()['roles']:
                for attempt in (1, 3):
                    route = nr.resolve(role, provider, attempt=attempt, capabilities=self.cap(provider))
                    if route['execution'] == 'tool': continue
                    if provider == 'codex':
                        conf = tomllib.loads(files['.codex/agents/' + route['agent'] + '.toml'].decode())
                        self.assertEqual(conf.get('model'), route['model'])
                        self.assertEqual(conf.get('model_reasoning_effort'), route['effort'])
                    else:
                        front = files['.claude/agents/' + route['agent'] + '.md'].decode().split('---')[1]
                        self.assertIn('model: ' + (route['model'] or 'inherit'), front)
                        if route['effort']: self.assertIn('effort: ' + route['effort'], front)

    def test_invalid_role_provider_attempt(self):
        for kw in ({'role': 'bad'}, {'provider': 'external'}, {'attempt': 0}, {'attempt': 4}, {'attempt': True}):
            with self.assertRaises(nr.RoutingError):
                nr.resolve(**({'role': 'copy'} | kw))

    def test_unknown_capability_shapes_fail(self):
        cap = self.cap(); cap['models'] = []
        with self.assertRaises(nr.RoutingError): nr.resolve('copy', 'codex', capabilities=cap)

class StateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.write('brief.md', 'accepted input')

    def write(self, path, value='output'):
        target = self.root / path; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value)

    def task(self, name='one', **kw):
        return {'id': name, 'role': 'frontend', 'brief': 'Build only the assigned file',
                'inputs': ['brief.md'], 'writes': ['public/' + name + '.html'], 'depends_on': [], **kw}

    def complete(self, name='one', worker='builder', **receipt):
        c = nr.claim(self.root, name, worker)
        outputs = c['task']['writes']
        for output in outputs: self.write(output)
        return nr.finish(self.root, name, c['claim_token'],
                         {'status': 'done', 'summary': 'Fixture work completed', 'outputs': outputs, **receipt})

    def test_add_is_atomic_on_invalid_dependency(self):
        with self.assertRaises(nr.RoutingError): nr.add_tasks(self.root, [self.task(depends_on=['missing'])])
        self.assertEqual(nr.status(self.root)['tasks'], [])

    def test_reject_cycle(self):
        with self.assertRaises(nr.RoutingError):
            nr.add_tasks(self.root, [self.task('one', depends_on=['two']), self.task('two', depends_on=['one'])])

    def test_duplicate_ids(self):
        with self.assertRaises(nr.RoutingError): nr.add_tasks(self.root, [self.task(), self.task()])

    def test_unsafe_paths(self):
        for path in ('../x', '/tmp/x', 'a/../x', '.secrets/password', '.codex/config.toml', 'public/.env',
                     'x\\y', 'C:/x', 'public/*', 'x.key', 'build/orchestration/state.sqlite3'):
            with self.subTest(path=path), self.assertRaises(nr.RoutingError): nr.relative(path)

    def test_symlink_artifact_rejected(self):
        (self.root/'link').symlink_to(self.root/'brief.md')
        with self.assertRaises(nr.RoutingError): nr.add_tasks(self.root, [self.task(inputs=['link'])])

    def test_task_receipt_and_output_hashes(self):
        nr.add_tasks(self.root, [self.task()]); self.complete()
        result = nr.status(self.root)
        self.assertTrue(result['tasks'][0]['fresh'])
        self.assertFalse(result['release_approved'])
        self.assertIsNone(result['tasks'][0]['effective']['model'])

    def test_dependency_not_ready_until_completed(self):
        nr.add_tasks(self.root, [self.task(), self.task('two', depends_on=['one'])])
        with self.assertRaises(nr.RoutingError): nr.claim(self.root, 'two', 'b')
        self.complete(); self.assertIn('two', nr.status(self.root)['ready'])

    def test_stale_dependency_blocks_downstream(self):
        nr.add_tasks(self.root, [self.task(), self.task('two', depends_on=['one'])]); self.complete()
        self.write('public/one.html', 'changed')
        self.assertNotIn('two', nr.status(self.root)['ready'])

    def test_missing_input_blocks_start(self):
        nr.add_tasks(self.root, [self.task(inputs=['absent'])])
        with self.assertRaises(nr.RoutingError): nr.claim(self.root, 'one', 'b')

    def test_changed_inputs_reject_finish(self):
        nr.add_tasks(self.root, [self.task()]); c=nr.claim(self.root, 'one', 'b')
        self.write('brief.md', 'changed'); self.write('public/one.html')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root, 'one', c['claim_token'], {'status':'done','summary':'x','outputs':['public/one.html']})

    def test_owned_read_modify_write_supported(self):
        nr.add_tasks(self.root, [self.task(inputs=['brief.md'], writes=['brief.md'])])
        self.complete(); self.assertTrue(nr.status(self.root)['tasks'][0]['fresh'])

    def test_missing_outputs_reject_finish(self):
        nr.add_tasks(self.root, [self.task()]); c=nr.claim(self.root, 'one', 'b')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root, 'one', c['claim_token'], {'status':'done','summary':'x','outputs':['public/one.html']})

    def test_unowned_output_rejected(self):
        nr.add_tasks(self.root, [self.task()]); c=nr.claim(self.root, 'one', 'b'); self.write('other.txt')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root, 'one', c['claim_token'], {'status':'done','summary':'x','outputs':['other.txt']})

    def test_wrong_claim_and_replay_rejected(self):
        nr.add_tasks(self.root, [self.task()]); c=nr.claim(self.root, 'one', 'b')
        receipt={'status':'failed','summary':'synthetic failure'}
        with self.assertRaises(nr.RoutingError): nr.finish(self.root, 'one', 'wrong', receipt)
        nr.finish(self.root, 'one', c['claim_token'], receipt)
        with self.assertRaises(nr.RoutingError): nr.finish(self.root, 'one', c['claim_token'], receipt)

    def test_effective_model_requires_evidence(self):
        nr.add_tasks(self.root, [self.task()]); c=nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root,'one',c['claim_token'],{'status':'failed','summary':'x','effective_model':'gpt-5.6'})

    def test_failed_work_not_completed(self):
        nr.add_tasks(self.root,[self.task()]); c=nr.claim(self.root,'one','b')
        nr.finish(self.root,'one',c['claim_token'],{'status':'failed','summary':'Failed local check'})
        self.assertFalse(nr.status(self.root)['tasks'][0]['fresh'])

    def parallel(self): nr.configure(self.root, RoutingTests().cap())

    def test_overlapping_writes_reserved(self):
        self.parallel(); nr.add_tasks(self.root,[self.task(),self.task('two',writes=['public'])])
        nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'two','c')

    def test_read_write_conflict_reserved(self):
        self.parallel(); self.write('public/one.html')
        nr.add_tasks(self.root,[self.task(),self.task('two',inputs=['public/one.html'])])
        nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'two','c')

    def test_independent_writes_parallel(self):
        self.parallel(); nr.add_tasks(self.root,[self.task(),self.task('two')])
        nr.claim(self.root,'one','b'); nr.claim(self.root,'two','c')

    def test_same_path_claim_race_only_one_wins(self):
        self.parallel(); nr.add_tasks(self.root,[self.task(),self.task('two',writes=['public/one.html'])])
        def work(name):
            try: nr.claim(self.root,name,name); return 'claimed'
            except nr.RoutingError: return 'blocked'
        with ThreadPoolExecutor(max_workers=2) as executor:
            values=list(executor.map(work,['one','two']))
        self.assertEqual(sorted(values),['blocked','claimed'])

    def test_worker_cap(self):
        self.parallel(); nr.add_tasks(self.root,[self.task('t'+str(i)) for i in range(5)])
        for i in range(4): nr.claim(self.root,'t'+str(i),str(i))
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'t4','4')

    def test_sequential_cap(self):
        nr.add_tasks(self.root,[self.task(),self.task('two')]); nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'two','c')

    def test_exclusive_resource(self):
        self.parallel(); nr.add_tasks(self.root,[self.task(resources=['lighthouse']),self.task('two',resources=['lighthouse'])])
        nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'two','c')

    def test_cannot_reconfigure_running_workers(self):
        nr.add_tasks(self.root,[self.task()]); nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError): self.parallel()

    def test_retry_running_requires_stopped_worker(self):
        nr.add_tasks(self.root,[self.task()]); nr.claim(self.root,'one','b')
        with self.assertRaises(nr.RoutingError): nr.retry(self.root,'one','timeout')
        nr.retry(self.root,'one','native worker stopped',True)
        self.assertIn('one',nr.status(self.root)['ready'])

    def test_retry_budget_is_bounded(self):
        nr.add_tasks(self.root,[self.task()])
        for i in range(3):
            c=nr.claim(self.root,'one','b')
            nr.finish(self.root,'one',c['claim_token'],{'status':'failed','summary':'test failure'})
            if i<2: nr.retry(self.root,'one','bounded repair')
        with self.assertRaises(nr.RoutingError): nr.retry(self.root,'one','more')

    def prep_review(self, parallel=True):
        if parallel: self.parallel()
        nr.add_tasks(self.root,[self.task(), self.task('review',role='review',phase='acceptance',writes=[],depends_on=['one'])])
        self.complete(host_task_id='builder-id')

    def test_acceptance_needs_freeze(self):
        self.prep_review()
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'review','reviewer')

    def test_freeze_blocks_pending_work(self):
        nr.add_tasks(self.root,[self.task()])
        with self.assertRaises(nr.RoutingError): nr.freeze(self.root,[])

    def test_reviewer_identity_cannot_be_builder(self):
        self.prep_review(); nr.freeze(self.root,[])
        with self.assertRaises(nr.RoutingError): nr.claim(self.root,'review','builder')

    def test_independent_review_receipt(self):
        self.prep_review(); nr.freeze(self.root,[]); c=nr.claim(self.root,'review','reviewer')
        result=nr.finish(self.root,'review',c['claim_token'],{'status':'done','summary':'Reviewed fixture',
                         'review_mode':'independent','host_task_id':'reviewer-id'})
        self.assertFalse(result['release_approved'])

    def test_duplicate_host_identity_rejected(self):
        self.prep_review(); nr.freeze(self.root,[]); c=nr.claim(self.root,'review','reviewer')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root,'review',c['claim_token'],{'status':'done','summary':'x','review_mode':'independent','host_task_id':'builder-id'})

    def test_self_review_fallback_honest(self):
        self.prep_review(False); nr.freeze(self.root,[]); c=nr.claim(self.root,'review','builder')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root,'review',c['claim_token'],{'status':'done','summary':'x','review_mode':'independent','host_task_id':'fake'})
        nr.finish(self.root,'review',c['claim_token'],{'status':'done','summary':'Fresh isolated reread','review_mode':'self_review'})

    def test_source_change_invalidates_frozen_review(self):
        self.prep_review(); nr.freeze(self.root,[]); c=nr.claim(self.root,'review','reviewer')
        self.write('public/new.css')
        with self.assertRaises(nr.RoutingError):
            nr.finish(self.root,'review',c['claim_token'],{'status':'done','summary':'x','review_mode':'independent','host_task_id':'r'})

    def test_thaw_invalidates_completed_review(self):
        self.prep_review(); nr.freeze(self.root,[]); c=nr.claim(self.root,'review','reviewer')
        nr.finish(self.root,'review',c['claim_token'],{'status':'done','summary':'x','review_mode':'independent','host_task_id':'r'})
        nr.thaw(self.root,'targeted fix')
        self.assertFalse(nr.status(self.root)['freeze_current'])
        self.assertEqual(nr.status(self.root)['tasks'][-1]['status'],'pending')

    def test_scheduler_symlink_rejected(self):
        (self.root/'build').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(nr.RoutingError): nr.status(self.root)

    def test_cli_smoke(self):
        result=subprocess.run([sys.executable,str(SCRIPTS/'native_routing.py'),'route','copy'],capture_output=True,text=True,check=True)
        self.assertEqual(json.loads(result.stdout)['execution'],'sequential')

class InstallationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        skill=self.root/'skills/community-landing-page-builder'; skill.mkdir(parents=True)
        (skill/'SKILL.md').write_text('fixture')

    def test_codex_toml_valid(self):
        import tomllib
        for name,data in installer.render('codex').items():
            result=tomllib.loads(data.decode())
            self.assertTrue(result['name'].startswith('lp-'))
            if 'inherit' not in result['name']: self.assertIn('model_reasoning_effort',result)
            self.assertIn('developer_instructions',result)

    def test_claude_haiku_omits_effort(self):
        text=installer.render('claude')['.claude/agents/lp-researcher.md'].decode()
        front=text.split('---')[1]
        self.assertIn('model: haiku',front); self.assertNotIn('effort:',front)

    def test_claude_copy_and_review_stay_on_sonnet(self):
        files=installer.render('claude')
        self.assertIn('effort: medium',files['.claude/agents/lp-builder.md'].decode())
        self.assertIn('effort: high',files['.claude/agents/lp-reviewer.md'].decode())
        self.assertIn('model: sonnet',files['.claude/agents/lp-copy.md'].decode())
        self.assertIn('model: sonnet',files['.claude/agents/lp-reviewer.md'].decode())
        self.assertIn('model: sonnet',files['.claude/agents/lp-reviewer-critical.md'].decode())

    def test_no_auth_or_provider_override(self):
        text='\n'.join(d.decode() for d in installer.render().values())
        for forbidden in ['ANTHROPIC_API_KEY=', 'OPENAI_API_KEY=', 'bypassPermissions', 'model_provider =', 'base_url =']:
            self.assertNotIn(forbidden,text)

    def test_installs_both_and_idempotent(self):
        first=installer.install(self.root); second=installer.install(self.root)
        self.assertTrue(first['changed']); self.assertFalse(second['changed'])
        self.assertEqual(installer.install(self.root,check=True)['status'],'pass')
        self.assertEqual(len(list((self.root/'.codex/agents').glob('*.toml'))),16)
        self.assertEqual(len(list((self.root/'.claude/agents').glob('*.md'))),16)

    def test_preserves_owner_instructions(self):
        (self.root/'AGENTS.md').write_text('Owner instruction\n')
        installer.install(self.root)
        text=(self.root/'AGENTS.md').read_text()
        self.assertTrue(text.startswith('Owner instruction\n'))
        self.assertEqual(text.count(installer.MARKER_START),1)

    def test_preserves_existing_config(self):
        (self.root/'.codex').mkdir(); path=self.root/'.codex/config.toml'
        path.write_text('model = "owner-choice"\n[agents]\nmax_threads = 2\n')
        before=path.read_bytes(); installer.install(self.root)
        self.assertEqual(path.read_bytes(),before)

    def test_conflict_fails_before_any_writes(self):
        (self.root/'.claude/agents').mkdir(parents=True)
        (self.root/'.claude/agents/lp-builder.md').write_text('Owner custom agent')
        with self.assertRaises(nr.RoutingError): installer.install(self.root)
        self.assertFalse((self.root/'.codex').exists())
        self.assertFalse((self.root/'AGENTS.md').exists())

    def test_modified_managed_profile_is_preserved(self):
        installer.install(self.root); path=self.root/'.codex/agents/lp-builder.toml'
        path.write_text(path.read_text()+'# owner changes\n')
        with self.assertRaises(nr.RoutingError): installer.install(self.root)
        self.assertTrue(path.read_text().endswith('# owner changes\n'))

    def test_inherit_models_install(self):
        installer.install(self.root); installer.install(self.root,inherit_models=True)
        text=(self.root/'.codex/agents/lp-builder.toml').read_text()
        self.assertNotIn('\nmodel =',text); self.assertNotIn('model_reasoning_effort =',text)
        self.assertIn('model: inherit',(self.root/'.claude/agents/lp-builder.md').read_text())

    def test_checked_in_profiles_can_switch_to_inherit(self):
        for rel,data in installer.render().items():
            path=self.root/rel; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
        installer.install(self.root,inherit_models=True)
        self.assertIn('model: inherit',(self.root/'.claude/agents/lp-builder.md').read_text())

    def test_symlink_target_rejected(self):
        (self.root/'.codex').symlink_to(self.root,target_is_directory=True)
        with self.assertRaises(nr.RoutingError): installer.install(self.root)

    def test_missing_skill_requires_copy(self):
        (self.root/'skills/community-landing-page-builder/SKILL.md').unlink()
        with self.assertRaises(nr.RoutingError): installer.install(self.root)

    def test_copy_excludes_private_runtime(self):
        source=self.root/'source'; source.mkdir()
        (source/'SKILL.md').write_text('fixture skill')
        (source/'.secrets').mkdir(); (source/'.secrets/password.txt').write_text('private')
        (source/'key.pem').write_text('private'); (source/'.env.local').write_text('private')
        (source/'scripts').mkdir(); (source/'scripts/helper.py').write_text('pass\n')
        dest=self.root/'target'; dest.mkdir()
        with patch.object(installer,'SKILL',source): installer.install(dest,copy_skill=True)
        copied=dest/'skills/community-landing-page-builder'
        self.assertTrue((copied/'scripts/helper.py').exists())
        self.assertFalse((copied/'.secrets').exists()); self.assertFalse((copied/'key.pem').exists())

    def test_malformed_instruction_markers_rejected(self):
        (self.root/'AGENTS.md').write_text(installer.MARKER_START)
        with self.assertRaises(nr.RoutingError): installer.install(self.root)

if __name__=='__main__': unittest.main(verbosity=2)
