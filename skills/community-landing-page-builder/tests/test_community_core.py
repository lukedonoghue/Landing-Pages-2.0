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
