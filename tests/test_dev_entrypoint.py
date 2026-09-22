from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DevEntrypointTests(unittest.TestCase):
    def test_help_reaches_the_community_quickstart(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts/dev.py"), "--help"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("bootstrap", result.stdout)
        self.assertIn("doctor", result.stdout)

    def test_readme_leads_with_local_dependency_setup(self):
        readme = (ROOT / "README.md").read_text()
        self.assertIn("## Step one install local dependencies", readme)
        self.assertIn("python3 scripts/dev.py bootstrap", readme)


if __name__ == "__main__":
    unittest.main()
