import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL = Path(__file__).resolve().parents[1]
SCRIPT = SKILL / "scripts" / "build_gtm_container.py"


class GtmBuilderTests(unittest.TestCase):
    def build(self, *extra):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        output = Path(directory.name) / "container.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--gtm-id",
                "GTM-ABC1234",
                "--google-ads-id",
                "10889706069",
                "--google-ads-label",
                "conversionLabel",
                "--output",
                str(output),
                *extra,
            ],
            text=True,
            capture_output=True,
        )
        return result, output

    def test_builds_three_provider_import_with_two_event_contract(self):
        result, output = self.build(
            "--enhanced-conversions",
            "--meta-pixel-id",
            "123456789012345",
            "--microsoft-uet-id",
            "12345678",
            "--hostname",
            "example.com",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        document = json.loads(output.read_text())
        version = document["containerVersion"]
        events = {
            item["customEventFilter"][0]["parameter"][1]["value"]
            for item in version["trigger"]
            if item["type"] == "CUSTOM_EVENT"
        }
        self.assertEqual(events, {"customer_data_ready", "lead_accepted"})
        types = {item["type"] for item in version["tag"]}
        self.assertTrue({"googtag", "gclidw", "awct", "awud", "html"}.issubset(types))
        self.assertNotRegex(output.read_text(), r'"(?:email|phone|user_email|user_phone)"\s*:')

    def test_sensitive_category_rejects_enhanced_customer_data(self):
        result, output = self.build("--enhanced-conversions", "--sensitive-category")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())
        self.assertIn("blocked for sensitive-category", result.stderr)

    def test_sensitive_category_keeps_basic_provider_conversions_without_customer_data(self):
        result, output = self.build(
            "--sensitive-category",
            "--meta-pixel-id",
            "123456789012345",
            "--microsoft-uet-id",
            "12345678",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        raw = output.read_text()
        self.assertNotIn("customer_data_ready", raw)
        self.assertNotIn("Hashed Customer Data", raw)
        self.assertIn("Meta Pixel - Lead", raw)
        self.assertIn("Microsoft UET - Lead", raw)

    def test_documented_synthetic_draft_cli_uses_output_and_is_labeled_not_live(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        output = Path(directory.name) / "gtm-container.synthetic-draft-not-live.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--gtm-id",
                "GTM-SYNTHETIC",
                "--google-ads-id",
                "0000000000",
                "--google-ads-label",
                "SYNTHETIC_DRAFT_NOT_LIVE",
                "--action-name",
                "Synthetic Draft - Not Live",
                "--client-name",
                "SYNTHETIC DRAFT - NOT LIVE",
                "--hostname",
                "attribution-verification.example.invalid",
                "--output",
                str(output),
            ],
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        version = json.loads(output.read_text())["containerVersion"]
        self.assertEqual(version["container"]["publicId"], "GTM-SYNTHETIC")
        self.assertEqual(version["container"]["name"], "SYNTHETIC DRAFT - NOT LIVE")
        self.assertIn("Synthetic Draft - Not Live", output.read_text())


if __name__ == "__main__":
    unittest.main()
