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

    def test_demo_copy_contract_matches_current_confirmation_and_modal_surfaces(self):
        demo_project = (
            ROOT / "skills/community-landing-page-builder/scripts/demo_project.py"
        ).read_text()
        self.assertNotIn(
            "page.replace('<p data-form-error', '<p>'+html.escape(data['follow_up'])+'</p><p data-form-error')",
            demo_project,
        )
        self.assertIn('\"download_label\": \"Download your service guide\"', demo_project)
        self.assertIn('\"reader_heading\": \"Read your guide now\"', demo_project)
        self.assertIn("We could not accept your request. Check your details and try again.", demo_project)
        self.assertIn("We could not confirm whether your request was saved. Retry to check the same request safely; your details are kept unchanged.", demo_project)
        self.assertIn("@media(max-width:340px)", demo_project)
        self.assertIn("@media(min-width:601px) and (max-height:760px)", demo_project)
        quickstart = (ROOT / "skills/community-landing-page-builder/scripts/quickstart.py").read_text()
        self.assertIn('"scripts/extract_brand.mjs", url, "--out", "build/brand.json"', quickstart)

    def test_readme_leads_with_local_dependency_setup(self):
        readme = (ROOT / "README.md").read_text()
        self.assertIn("## Step one install local dependencies", readme)
        self.assertIn("python3 scripts/dev.py bootstrap", readme)


if __name__ == "__main__":
    unittest.main()
