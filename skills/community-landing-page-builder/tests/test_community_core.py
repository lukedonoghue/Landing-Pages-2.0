from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL = Path(__file__).resolve().parents[1]
SCAN = SKILL / "scripts" / "scan_surfaces.py"
VALIDATE = SKILL / "scripts" / "validate_page.py"
CATALOGUE = SKILL / "scripts" / "validate_catalogue_review.py"


CLEAN_HTML = """<!doctype html>
<html lang="en">
<head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Example</title></head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<main id="main"><h1>Clear local service</h1>
<img src="assets/team.webp" width="800" height="600" data-image-role="proof" alt="The service team at work">
<a data-primary-action href="tel:+15555550100">Call the team</a></main>
<footer><a href="privacy.html">Privacy</a></footer>
</body></html>
"""


class CommunityCoreTests(unittest.TestCase):
    def run_script(self, script: Path, *args: str):
        return subprocess.run(
            [sys.executable, str(script), *map(str, args)],
            check=False,
            text=True,
            capture_output=True,
        )

    def make_clean_project(self, root: Path):
        (root / "assets").mkdir()
        (root / "assets" / "team.webp").write_bytes(b"fake-webp-for-static-path-test")
        (root / "privacy.html").write_text("<main><h1>Privacy</h1></main>", encoding="utf-8")
        (root / "index.html").write_text(CLEAN_HTML, encoding="utf-8")

    def test_surface_scan_blocks_characters_and_entities(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bad_text = "<p>Bad " + chr(0x2014) + " mark and &" + "ndash; entity</p>"
            (root / "index.html").write_text(bad_text, encoding="utf-8")
            result = self.run_script(SCAN, root)
            self.assertNotEqual(result.returncode, 0)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["status"], "blocked")
            self.assertEqual(len(payload["findings"]), 2)
            self.assertNotIn("\u2014", result.stdout)

    def test_static_validator_accepts_small_honest_page(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            result = self.run_script(VALIDATE, root)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn(json.loads(result.stdout)["status"], {"pass", "pass_with_warnings"})

    def test_static_validator_catches_research_voice_in_collapsed_faq(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            for phrase in ("The published service list includes", "The <strong>published</strong> service range includes", "The official service range describes"):
                with self.subTest(phrase=phrase):
                    faq = f'<details><summary>Can you help?</summary><p>{phrase} bookkeeping.</p></details>'
                    (root / "index.html").write_text(CLEAN_HTML.replace('</main>', faq + '</main>'), encoding="utf-8")
                    result = self.run_script(VALIDATE, root)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertTrue(json.loads(result.stdout)["checks"]["research_voice_copy"])

    def test_research_voice_check_preserves_prices_quotes_and_internal_notes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            content = '''<p>Published fees are indicative. We provide bookkeeping.</p>
<blockquote>The published service range includes bookkeeping.</blockquote>
<script>const sourceNote = "The published service range includes bookkeeping";</script>
<template><p>The official service list includes bookkeeping.</p></template>'''
            (root / "index.html").write_text(CLEAN_HTML.replace('</main>', content + '</main>'), encoding="utf-8")
            (root / "research.md").write_text("The published service list includes bookkeeping.", encoding="utf-8")
            result = self.run_script(VALIDATE, root)
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertEqual(json.loads(result.stdout)["checks"]["research_voice_copy"], [])

    def test_report_paths_are_relative_to_invocation_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            project = workspace / "project with spaces"
            project.mkdir()
            self.make_clean_project(project)
            for script, filename in ((SCAN, "surface-scan.json"), (VALIDATE, "static-review.json")):
                with self.subTest(script=script.name):
                    relative_report = Path(project.name) / "build" / filename
                    result = subprocess.run(
                        [sys.executable, str(script), project.name, "--report", str(relative_report)],
                        cwd=workspace, text=True, capture_output=True, check=False,
                    )
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    report = workspace / relative_report
                    self.assertTrue(report.is_file())
                    self.assertEqual(json.loads(report.read_text()), json.loads(result.stdout))
                    self.assertFalse((project / relative_report).exists())
                    absolute_report = workspace / "absolute-output" / filename
                    result = self.run_script(script, project, "--report", absolute_report)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertTrue(absolute_report.is_file())

    def test_static_validator_rejects_failed_license_download(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            license_file = root / "assets" / "Example-LICENSE.txt"
            for content in ("404: Not Found", "403 Forbidden", ""):
                license_file.write_text(content, encoding="utf-8")
                result = self.run_script(VALIDATE, root)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertEqual(json.loads(result.stdout)["checks"]["invalid_license_downloads"], ["assets/Example-LICENSE.txt"])
            license_file.write_text("Example permissive license. Permission is granted to use this fixture.", encoding="utf-8")
            result = self.run_script(VALIDATE, root)
            self.assertEqual(result.returncode, 0, result.stdout)

    def test_static_validator_blocks_dead_action_and_unclassified_image(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            broken = CLEAN_HTML.replace('data-image-role="proof" ', "").replace('href="tel:+15555550100"', 'href="#"')
            (root / "index.html").write_text(broken, encoding="utf-8")
            result = self.run_script(VALIDATE, root)
            self.assertNotEqual(result.returncode, 0)
            payload = json.loads(result.stdout)
            self.assertTrue(any("Image contract failures" in item for item in payload["failures"]))
            self.assertTrue(any("Dead links" in item for item in payload["failures"]))

    def test_form_entry_rejects_section_jump_but_allows_content_navigation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            form = '<section id="enquire"><form id="lead"><button type="submit">Send</button></form></section>'
            for target in ("#enquire", "#lead"):
                with self.subTest(target=target):
                    html = CLEAN_HTML.replace('</main>', form + '</main>').replace(
                        'href="tel:+15555550100"', f'href="{target}"')
                    (root / "index.html").write_text(html, encoding="utf-8")
                    result = self.run_script(VALIDATE, root)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(json.loads(result.stdout)["checks"]["primary_form_section_jumps"], [target])
            html = CLEAN_HTML.replace('</main>', form + '<a href="#enquire">Contact section</a></main>')
            (root / "index.html").write_text(html, encoding="utf-8")
            result = self.run_script(VALIDATE, root)
            self.assertEqual(result.returncode, 0, result.stdout)

    def test_popup_marker_requires_dialog_but_does_not_prove_runtime_behavior(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_clean_project(root)
            opener = '<button type="button" data-primary-action data-open-modal>Enquire</button>'
            html = CLEAN_HTML.replace('</main>', opener + '</main>')
            (root / "index.html").write_text(html, encoding="utf-8")
            result = self.run_script(VALIDATE, root)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(any("no dialog markup" in f for f in json.loads(result.stdout)["failures"]))
            dialog = '<dialog><form><button type="submit">Send</button></form></dialog>'
            (root / "index.html").write_text(html.replace('</main>', dialog + '</main>'), encoding="utf-8")
            result = self.run_script(VALIDATE, root)
            self.assertEqual(result.returncode, 0, result.stdout)

    def test_catalogue_review_requires_every_page_and_clear_findings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "build" / "catalogue-pages").mkdir(parents=True)
            (root / "public").mkdir()
            (root / "public" / "guide.pdf").write_bytes(b"%PDF-1.4")
            pages = []
            for number in (1, 2):
                rendered = root / "build" / "catalogue-pages" / f"page-{number:02}.png"
                rendered.write_bytes(b"png")
                pages.append({
                    "page": number,
                    "rendered_path": rendered.relative_to(root).as_posix(),
                    "reviewed_at_readable_size": True,
                    "no_clipping": True,
                    "no_truncation": True,
                    "no_text_image_collision": True,
                    "no_text_on_face_or_subject": True,
                    "information_bearing_images_complete": True,
                    "links_and_contact_checked": True,
                    "findings": [],
                })
            review = root / "build" / "catalogue-review.json"
            review.write_text(json.dumps({
                "pdf": "public/guide.pdf",
                "page_count": 2,
                "reviewer": "independent review",
                "pages": pages,
                "unresolved_findings": [],
            }), encoding="utf-8")
            result = self.run_script(CATALOGUE, root, review)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            pages[1]["no_clipping"] = False
            review.write_text(json.dumps({
                "pdf": "public/guide.pdf",
                "page_count": 2,
                "reviewer": "independent review",
                "pages": pages,
                "unresolved_findings": [],
            }), encoding="utf-8")
            result = self.run_script(CATALOGUE, root, review)
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
