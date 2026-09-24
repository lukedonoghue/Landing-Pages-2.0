from pathlib import Path
import re
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
        self.assertIn('"download_label": "Download your service guide"', demo_project)
        self.assertIn('"reader_heading": "Read your guide now"', demo_project)
        self.assertIn("We could not accept your request. Check your details and try again.", demo_project)
        self.assertIn("We could not confirm whether your request was saved. Retry to check the same request safely; your details are kept unchanged.", demo_project)
        self.assertIn("@media(max-width:340px)", demo_project)
        self.assertIn("@media(min-width:601px) and (max-height:760px)", demo_project)
        quickstart = (ROOT / "skills/community-landing-page-builder/scripts/quickstart.py").read_text()
        self.assertIn('"scripts/extract_brand.mjs", url, "--out", "build/brand.json"', quickstart)

    def test_readme_documents_setup_before_running_the_local_demo(self):
        readme = (ROOT / "README.md").read_text()
        # Check the runnable instructions rather than freezing editorial headings.
        blocks = re.findall(r"```(?:sh|bash)\s*\n(.*?)```", readme, re.DOTALL)
        demo_blocks = [block for block in blocks if "python3 scripts/dev.py demo" in block]
        self.assertEqual(len(demo_blocks), 1, "Document one unambiguous local demo sequence")
        commands = [line.strip() for line in demo_blocks[0].splitlines() if line.strip()]
        self.assertEqual(commands, [
            "python3 scripts/dev.py doctor",
            "python3 scripts/dev.py bootstrap",
            "python3 scripts/dev.py doctor",
            "python3 scripts/dev.py demo",
            "python3 scripts/dev.py verify-demo --full",
            "python3 scripts/dev.py serve",
        ])


if __name__ == "__main__":
    unittest.main()
