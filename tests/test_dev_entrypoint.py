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

    def test_demo_pdf_delivery_matches_current_confirmation_template(self):
        import json

        demo = json.loads(
            (ROOT / "skills/community-landing-page-builder/assets/demo.json").read_text()
        )
        self.assertEqual(
            demo["fixture"]["pdf_path"],
            "/assets/brochure/service-guide.pdf",
        )
        thank_you = (
            ROOT
            / "skills/community-landing-page-builder/assets/cloudflare/public/thank-you.html"
        ).read_text()
        self.assertIn(
            'href="/assets/brochure/service-guide.pdf"',
            thank_you,
        )
        quickstart = (
            ROOT / "skills/community-landing-page-builder/scripts/quickstart.py"
        ).read_text()
        self.assertIn("public/assets/brochure/service-guide.pdf", quickstart)
        self.assertNotIn("public/assets/brochure/catalogue.pdf", quickstart)

    def test_readme_leads_with_local_dependency_setup(self):
        readme = (ROOT / "README.md").read_text()
        self.assertIn("## Step one install local dependencies", readme)
        self.assertIn("python3 scripts/dev.py bootstrap", readme)


if __name__ == "__main__":
    unittest.main()
