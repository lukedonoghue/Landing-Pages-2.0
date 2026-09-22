"""Cold-start tests execute relocated project CLIs, not the installed modules."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import check_gates
import runtime_context as runtime


class PortableRuntimeTests(unittest.TestCase):
    def run_python(self, *args, cwd=None):
        env = {k: v for k, v in os.environ.items() if k != 'PYTHONPATH'}
        return subprocess.run([sys.executable, *map(str, args)], cwd=cwd, env=env,
                              capture_output=True, text=True, timeout=90)

    def test_relocated_static_project_can_resume_review_and_add_lead_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'original'
            result = self.run_python(SKILL/'scripts/guide.py', 'start', root, '--name', 'Synthetic business')
            self.assertEqual(result.returncode, 0, result.stderr)
            moved = Path(directory) / 'relocated'
            root.rename(moved)
            probe = """import json,sys
from pathlib import Path
sys.path.insert(0,'scripts')
import guide, workflow_runner, control_review, copy_library
from runtime_context import skill_root
print(json.dumps({'root':str(guide.SKILL),'runner':str(workflow_runner.SKILL),
'control':control_review.reference()['url'],'library':str(copy_library.DEFAULT),
'worker_template':(guide.SKILL/'assets/cloudflare/src/worker.js').is_file()}))
"""
            result = self.run_python('-c', probe, cwd=moved)
            self.assertEqual(result.returncode, 0, result.stderr)
            values = json.loads(result.stdout)
            self.assertEqual(values['root'], str(moved/'.community-builder'))
            self.assertEqual(values['root'], values['runner'])
            self.assertEqual(values['control'], 'https://bluemountain1.pagedemo.co/')
            self.assertTrue(values['worker_template'])
            self.assertIn('.community-builder', values['library'])
            result = self.run_python(moved/'scripts/guide.py', 'resume', moved, cwd=moved)
            self.assertEqual(result.returncode, 0, result.stderr)
            result = self.run_python(moved/'scripts/scaffold_project.py', moved,
                                     '--profile', 'lead_inbox', '--client', 'Synthetic business', cwd=moved)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((moved/'src/worker.js').is_file())
            self.assertFalse((moved/'public/.community-builder').exists())
            self.assertFalse((moved/'public/assets/guide').exists())
            self.assertTrue((moved/'references/control-reference.json').is_file())

    def small_skill(self, directory):
        source = directory/'skill'; (source/'scripts').mkdir(parents=True)
        (source/'SKILL.md').write_text('Synthetic skill')
        (source/'scripts/guide.py').write_text('# synthetic helper')
        return source

    def test_bundle_excludes_secrets_and_runtime_caches(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory); source=self.small_skill(base); project=base/'project';project.mkdir()
            for name in ('assets/.env', 'assets/.dev.vars.local', 'assets/credentials.json',
                         'assets/.secrets/password.txt', 'assets/node_modules/cache.js'):
                path=source/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('private fixture')
            target=runtime.bundle_runtime(source,project)
            record=json.loads((target/runtime.MANIFEST).read_text())
            self.assertEqual(set(record['files']), {'SKILL.md','scripts/guide.py'})
            self.assertFalse(any('private fixture' in p.read_text() for p in target.rglob('*') if p.is_file()))

    def test_existing_modified_or_unmanaged_bundle_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory); source=self.small_skill(base); project=base/'project';project.mkdir()
            target=runtime.bundle_runtime(source,project)
            self.assertEqual(runtime.bundle_runtime(source,project),target)
            (target/'SKILL.md').write_text('Owner customization')
            with self.assertRaisesRegex(ValueError,'modified'):runtime.bundle_runtime(source,project)
            self.assertEqual((target/'SKILL.md').read_text(),'Owner customization')
            (target/runtime.MANIFEST).unlink()
            with self.assertRaisesRegex(ValueError,'unmanaged'):runtime.bundle_runtime(source,project)

    def test_symlinked_bundle_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);source=self.small_skill(base);project=base/'project';project.mkdir()
            (project/runtime.BUNDLE).symlink_to(source,target_is_directory=True)
            with self.assertRaisesRegex(ValueError,'symlink'):runtime.bundle_runtime(source,project)

    def test_host_settings_do_not_break_staged_application_fingerprints(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'public').mkdir();(root/'public/index.html').write_text('<h1>Service</h1>')
            before=check_gates.source_snapshot(root)['source_fingerprint']
            for name in ('.codex/config.toml','.claude/settings.json'):
                path=root/name;path.parent.mkdir();path.write_text('host-only configuration')
            self.assertEqual(before,check_gates.source_snapshot(root)['source_fingerprint'])
            (root/'public/index.html').write_text('<h1>A different offer</h1>')
            self.assertNotEqual(before,check_gates.source_snapshot(root)['source_fingerprint'])

    def test_claude_dispatch_preserves_selected_effort(self):
        import workflow_runner as runner
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'public').mkdir();(root/'public/index.html').write_text('Synthetic page')
            captured=[]
            def launch(argv,**kwargs):
                captured.extend(argv)
                raise RuntimeError('Synthetic launch boundary; no provider invoked')
            with patch.object(runner,'probe',return_value='/synthetic/claude'), patch.object(runner.subprocess,'Popen',side_effect=launch):
                with self.assertRaisesRegex(RuntimeError,'Synthetic launch'):runner.native_execute(root,{'stage':'build'},'claude',{'model':'sonnet','effort':'high'},lambda _:None)
            self.assertEqual(captured[captured.index('--effort')+1],'high')
            self.assertNotIn('--bare',captured)


if __name__ == '__main__':
    unittest.main()
