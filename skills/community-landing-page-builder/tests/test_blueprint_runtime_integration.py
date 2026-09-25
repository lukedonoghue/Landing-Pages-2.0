"""Exercise scaffolded validators without inheriting the repository import path.

These are synthetic local tests. They do not publish, acquire external evidence,
create client leads, or substitute for the browser/Worker integration suite.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
MODULES = (
    'release_acceptance', 'release_state', 'workflow', 'copy_contract',
    'copy_quality', 'dependency_state', 'research_contract', 'question_log',
    'execution_receipts', 'final_review', 'portable_handoff',
    'validate_required_records',
)


class BlueprintRuntimeIntegrationTests(unittest.TestCase):
    def make_project(self, profile):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        parent = Path(temporary.name)
        root = parent / 'project'
        result = subprocess.run(
            [sys.executable, str(SKILL / 'scripts/scaffold_project.py'),
             str(root), '--client', 'Synthetic runtime fixture', '--profile', profile],
            cwd=parent, text=True, capture_output=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return root

    def check_imports(self, profile):
        root = self.make_project(profile)
        code = (
            'import importlib,json,sys;from pathlib import Path;'
            'root=Path(sys.argv[1]).resolve();sys.path.insert(0,str(root/"scripts"));'
            'names=json.loads(sys.argv[2]);'
            'loaded={n:str(Path(importlib.import_module(n).__file__).resolve()) for n in names};'
            'assert all(Path(p).parent==root/"scripts" for p in loaded.values()),loaded;'
            'print(json.dumps(loaded))'
        )
        result = subprocess.run(
            [sys.executable, '-I', '-c', code, str(root), json.dumps(MODULES)],
            cwd=root.parent, text=True, capture_output=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(set(json.loads(result.stdout)), set(MODULES))
        self.assertTrue((root / 'scripts/capture-final-states.mjs').is_file())
        config = json.loads((root / 'funnel.json').read_text())
        self.assertEqual(config['quality']['contract_version'], 4)

    def check_assertion(self, profile):
        root = self.make_project(profile)
        result = subprocess.run(
            [sys.executable, str(root / 'scripts/release_acceptance.py'),
             str(root), '--require', 'local_final'],
            cwd=root.parent, text=True, capture_output=True, timeout=30,
        )
        # An unfinished scaffold must produce a useful blocked verdict, not an
        # import error, and an inspector's successful execution is not release.
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        verdict = json.loads(result.stdout)
        self.assertNotEqual(verdict['release_class'], 'local_final')
        self.assertTrue(verdict['blockers'])
        self.assertNotIn('Traceback', result.stderr)

    def test_worker_scaffold_has_complete_isolated_validator_runtime(self):
        self.check_imports('lead_inbox')

    def test_static_scaffold_has_complete_isolated_validator_runtime(self):
        self.check_imports('static_action')

    def test_worker_scaffold_cannot_claim_local_final(self):
        self.check_assertion('lead_inbox')

    def test_static_scaffold_cannot_claim_local_final(self):
        self.check_assertion('static_action')


if __name__ == '__main__':
    unittest.main()
