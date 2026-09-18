"""Real PDF/text regressions. Fixture content is fictional, never client approval."""

import copy
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

from PIL import Image

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / "scripts"))
from build_catalogue import Catalogue, LayoutError
import copy_parity


def words(value):
    return re.sub(r"\s+", " ", value).strip()


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / "catalogue.json"
        self.pdf = self.root / "guide.pdf"
        self.data = json.loads((SKILL / "assets/catalogue.example.json").read_text())

    def build(self):
        self.config.write_text(json.dumps(self.data, ensure_ascii=False))
        c = Catalogue(self.config, self.pdf)
        result = c.build()
        self.text = subprocess.run(
            ["pdftotext", "-raw", str(self.pdf), "-"], capture_output=True, text=True, check=True
        ).stdout
        return result

    def blocks(self):
        result = subprocess.run(
            ["pdftotext", "-bbox", str(self.pdf), "-"], capture_output=True, text=True, check=True
        )
        return ET.fromstring(result.stdout).findall(".//{*}page")

    def assert_page_bounds(self):
        for page in self.blocks():
            width, height = float(page.attrib["width"]), float(page.attrib["height"])
            for word in page.findall(".//{*}word"):
                box = {k: float(v) for k, v in word.attrib.items()}
                self.assertGreaterEqual(box["xMin"], -0.1, word.text)
                self.assertGreaterEqual(box["yMin"], -0.1, word.text)
                self.assertLessEqual(box["xMax"], width + 0.1, word.text)
                self.assertLessEqual(box["yMax"], height + 0.1, word.text)
            boxes = page.findall(".//{*}word")
            for i, a in enumerate(boxes):
                for b in boxes[i + 1 :]:
                    dx = min(float(a.attrib["xMax"]), float(b.attrib["xMax"])) - max(
                        float(a.attrib["xMin"]), float(b.attrib["xMin"])
                    )
                    dy = min(float(a.attrib["yMax"]), float(b.attrib["yMax"])) - max(
                        float(a.attrib["yMin"]), float(b.attrib["yMin"])
                    )
                    self.assertFalse(
                        dx > 0.4 and dy > 0.4, f"Overlapping words: {a.text} / {b.text}"
                    )

    def assert_preserved_failure(self, field):
        sentinel = b"%PDF-previous-approved-output"
        self.pdf.write_bytes(sentinel)
        self.config.write_text(json.dumps(self.data, ensure_ascii=False))
        with self.assertRaises(LayoutError) as raised:
            Catalogue(self.config, self.pdf).build()
        self.assertIn(field, raised.exception.field)
        self.assertEqual(self.pdf.read_bytes(), sentinel)
        self.assertFalse(list(self.root.glob(".catalogue-*")))
        return raised.exception

    def test_example_keeps_complete_copy_and_page_bounds(self):
        result = self.build()
        self.assertEqual(result["pages"], 6)
        for section in [
            self.data["cover"],
            self.data["process"],
            self.data["cta"],
            *self.data["services"],
        ]:
            self.assertIn(words(section["headline"]), words(self.text))
        self.assertIn(self.data["cta"]["follow_up_promise"], words(self.text))
        self.assertIn(self.data["brand"]["region"], words(self.text))
        self.assert_page_bounds()

    def test_long_service_name_and_cta_wrap_without_ellipsis_or_slicing(self):
        name = "Specialist assessment and planning for complex residential properties"
        label = "Request your complete property planning and assessment guide"
        self.data["services"][0]["name"] = name
        self.data["cta"]["headline"] = label
        self.data["cta"]["action_label"] = label
        self.build()
        self.assertIn(name, words(self.text))
        self.assertIn(label, words(self.text))
        self.assertNotIn("...", self.text)
        self.assert_page_bounds()

    def test_long_qualifier_remains_complete(self):
        text = (
            "The proposed scope depends on access, ground conditions and the written site assessment. "
            "A photograph alone cannot confirm the final method, timing, suitability or price. "
            "Discuss these conditions with the team before making a commitment."
        )
        self.data["services"][0]["summary"] = text
        self.data["services"][0]["callout_body"] = text
        self.build()
        self.assertGreaterEqual(words(self.text).count(text), 2)
        self.assert_page_bounds()

    def test_many_services_and_steps_paginate_and_contents_numbers_match(self):
        self.data["proof_pillars"] = []
        self.data["services"] = [
            dict(
                copy.deepcopy(self.data["services"][0]),
                name=f"Planning service {i+1}",
                headline=f"Service {i+1} outcome.",
                short=f"Scope for service {i+1}.",
            )
            for i in range(12)
        ]
        steps = [
            {
                "title": f"Checkpoint {i+1}",
                "body": f"Confirm condition {i+1} before the next action.",
            }
            for i in range(12)
        ]
        self.data["process"]["steps"] = steps
        self.data["cta"]["steps"] = steps
        result = self.build()
        pages = [words(p) for p in self.text.split("\f") if p.strip()]
        self.assertEqual(len(pages), result["pages"])
        self.assertGreater(result["pages"], 18)
        first_service = next(i + 1 for i, p in enumerate(pages) if "Service 1 outcome." in p)
        for i, service in enumerate(self.data["services"]):
            self.assertIn(
                f"{service['name']} {service['short']} Page {first_service+i:02d}", words(self.text)
            )
            self.assertIn(service["headline"], pages[first_service + i - 1])
        for step in steps:
            self.assertGreaterEqual(words(self.text).count(step["body"]), 2)
        navigation = subprocess.run(
            ["pdftohtml", "-i", "-stdout", "-xml", str(self.pdf)],
            capture_output=True,
            text=True,
            check=True,
        )
        anchors = ET.fromstring(navigation.stdout).findall(".//a")
        page_links = [a for a in anchors if "".join(a.itertext()).startswith("Page ")]
        self.assertEqual(len(page_links), len(self.data["services"]))
        for link in page_links:
            label = int("".join(link.itertext()).split()[1])
            self.assertEqual(int(link.attrib["href"].rsplit("#", 1)[1]), label)
        self.assert_page_bounds()

    def test_complete_generated_text_works_with_the_rendered_copy_comparison(self):
        result = self.build()
        # Authored fixture wording plus the intended template labels/ordinals.
        # No expected marketing text is scraped from the finished PDF.
        excluded = {"colors", "logo", "image", "image_mode", "theme", "fonts", "phone_uri"}

        def strings(value):
            if isinstance(value, str):
                return [value] if value else []
            if isinstance(value, list):
                return [s for v in value for s in strings(v)]
            if isinstance(value, dict):
                return [s for k, v in value.items() if k not in excluded for s in strings(v)]
            return []

        expected = strings(self.data)
        expected += [
            "SERVICES AT A GLANCE",
            "The right service for what comes next.",
            "OUR PROCESS",
            "IDEAL FOR",
            "WHAT THE SERVICE INCLUDES",
            "01",
            "02",
            "03",
            "04",
            "1",
            "2",
            "3",
        ]
        body = copy_parity.normalize(copy_parity.pdf_body(self.text, result["pages"], expected))
        for phrase in expected:
            self.assertTrue(copy_parity.contains(body, phrase), phrase)
        self.assertEqual(copy_parity.extra_text(body, expected), "")

    def test_unicode_names_survive_extraction_and_font_embedding(self):
        self.data["brand"]["name"] = "Łódź · Zoë · José · Київ · Αθήνα"
        self.data["brand"]["footer"] = "Łódź · Zoë · José · Київ · Αθήνα"
        self.build()
        self.assertIn(self.data["brand"]["name"], self.text)
        fonts = subprocess.run(
            ["pdffonts", str(self.pdf)], capture_output=True, text=True, check=True
        ).stdout
        self.assertIn("DejaVuSans", fonts)
        self.assert_page_bounds()

    def test_qr_has_a_light_quiet_zone_on_the_dark_action_panel(self):
        result = self.build()
        prefix = self.root / "qr-page"
        subprocess.run(
            [
                "pdftoppm",
                "-f",
                str(result["pages"]),
                "-singlefile",
                "-r",
                "72",
                "-png",
                str(self.pdf),
                str(prefix),
            ],
            capture_output=True,
            check=True,
        )
        with Image.open(prefix.with_suffix(".png")) as image:
            crop = image.convert("L").crop((444, 792 - 185, 520, 792 - 109))
            low, high = crop.getextrema()
            self.assertLess(low, 30)
            self.assertGreater(high, 240)
            self.assertGreater(sum(crop.histogram()[241:]) / (crop.width * crop.height), 0.3)
            self.assertGreater(crop.getpixel((2, 2)), 240)

    def test_unsupported_glyph_and_complex_script_block_without_losing_name(self):
        for name in ["東京", "العربية"]:
            with self.subTest(name=name):
                self.data["brand"]["name"] = name
                self.assert_preserved_failure("brand.name")

    def test_named_missing_image_is_never_a_blank_panel(self):
        for key in ["cover", "process", "cta"]:
            with self.subTest(key=key):
                original = copy.deepcopy(self.data[key])
                self.data[key].update(image="missing.png", image_mode="asset")
                self.assert_preserved_failure(key + ".image")
                self.data[key] = original

    def test_omitted_image_requires_an_explicit_colour_only_choice(self):
        self.data["cover"].pop("image_mode")
        self.data["cover"]["image"] = ""
        error = self.assert_preserved_failure("cover.image")
        self.assertIn("image_mode: none", error.action)

    def test_corrupt_image_and_missing_logo_are_actionable(self):
        image = self.root / "corrupt.png"
        image.write_bytes(b"not a raster image")
        self.data["cover"].update(image=str(image), image_mode="asset")
        self.assert_preserved_failure("cover.image")
        self.data["cover"].update(image="", image_mode="none")
        self.data["brand"]["logo"] = "missing-logo.png"
        self.assert_preserved_failure("brand.logo")

    def test_unicode_asset_filename_is_not_normalized_or_renamed(self):
        image = self.root / "Zoë-garden.png"
        Image.new("RGB", (100, 150), "#204050").save(image)
        self.data["cover"].update(image=image.name, image_mode="asset")
        self.build()
        self.assertTrue(self.pdf.is_file())

    def test_oversized_text_bullets_and_single_step_fail_atomically(self):
        cases = [
            ("cover.body", lambda d: d["cover"].update(body="Important condition. " * 100)),
            (
                "services[0].includes",
                lambda d: d["services"][0].update(includes=["A complete condition."] * 30),
            ),
            (
                "process.steps",
                lambda d: d["process"].update(
                    steps=[{"title": "A checkpoint", "body": "Keep this full qualifier. " * 200}]
                ),
            ),
            ("cta.action_label", lambda d: d["cta"].update(action_label="A" * 500)),
            (
                "cta.follow_up_promise",
                lambda d: d["cta"].update(
                    follow_up_promise="A detailed operational promise. " * 100
                ),
            ),
        ]
        original = copy.deepcopy(self.data)
        for field, change in cases:
            with self.subTest(field=field):
                self.data = copy.deepcopy(original)
                change(self.data)
                self.assert_preserved_failure(field)

    def test_proof_and_delivery_instructions_cannot_be_silently_omitted(self):
        self.data["proof_pillars"] *= 2
        self.assert_preserved_failure("proof_pillars")
        self.data["proof_pillars"] = []
        self.data["cta"]["action_body"] = "Download after your request is saved."
        self.assert_preserved_failure("cta.action_body")

    def test_custom_font_pair_is_explicit_and_missing_fonts_fail(self):
        self.data["brand"]["fonts"] = {"regular": "missing.ttf", "bold": "missing-bold.ttf"}
        self.assert_preserved_failure("brand.fonts.regular")
        fonts = SKILL / "assets/pdf-fonts"
        self.data["brand"]["fonts"] = {
            "regular": str(fonts / "DejaVuSans.ttf"),
            "bold": str(fonts / "DejaVuSans-Bold.ttf"),
        }
        self.build()
        self.assertIn("Specific outcome headline.", words(self.text))

    def test_cli_reports_the_field_and_keeps_previous_output(self):
        self.data["cover"]["body"] = "Qualifier. " * 100
        self.config.write_text(json.dumps(self.data))
        self.pdf.write_bytes(b"original")
        result = subprocess.run(
            [
                sys.executable,
                str(SKILL / "scripts/build_catalogue.py"),
                "--config",
                str(self.config),
                "--output",
                str(self.pdf),
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 1)
        report = json.loads(result.stdout)
        self.assertEqual(report["field"], "cover.body")
        self.assertEqual(report["existing_pdf"], "preserved")
        self.assertEqual(self.pdf.read_bytes(), b"original")
        self.assertNotIn("Traceback", result.stderr)

    def test_output_symlink_does_not_overwrite_its_target(self):
        self.config.write_text(json.dumps(self.data))
        target = self.root / "keep.pdf"
        target.write_bytes(b"keep")
        self.pdf.symlink_to(target)
        with self.assertRaises(LayoutError):
            Catalogue(self.config, self.pdf).build()
        self.assertEqual(target.read_bytes(), b"keep")

    def test_distributed_font_bytes_match_the_upstream_license_manifest(self):
        root = SKILL / "assets/pdf-fonts"
        manifest = json.loads((root / "provenance.json").read_text())
        for name, digest in manifest["files"].items():
            self.assertEqual(hashlib.sha256((root / name).read_bytes()).hexdigest(), digest)
        self.assertIn("Bitstream", (root / "LICENSE").read_text())


if __name__ == "__main__":
    unittest.main()
