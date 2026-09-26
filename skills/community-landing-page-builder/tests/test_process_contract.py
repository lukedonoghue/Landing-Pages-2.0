#!/usr/bin/env python3
import json
from pathlib import Path
import tempfile
import unittest

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import process_contract


class ProcessContractTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "docs").mkdir()
        (self.root / "build").mkdir()

    def write_complete_fidelity(self, include_all=True):
        reference_sections = [{"id": "hero"}, {"id": "proof"}, {"id": "offer"}]
        coverage = [
            {"reference_id": item["id"], "disposition": "adapted", "rationale": "Preserves the persuasive job with client-specific evidence."}
            for item in reference_sections[:None if include_all else 2]
        ]
        comparison = {
            key: {"status": "equal_or_stronger", "evidence": "Verified against full-page desktop and mobile captures."}
            for key in ("content_depth", "media_cadence", "proof_density", "visual_variety", "cta_journey")
        }
        (self.root / "build/reference-fidelity.json").write_text(json.dumps({"schema_version": 1, "reference_sections": reference_sections, "coverage": coverage, "comparison": comparison}))

    def test_scaffold_level_documents_are_blocked(self):
        for name in process_contract.COPY_GATE_DOCS:
            (self.root / "docs" / name).write_text(
                "# Heading\n\n<!-- WORKFLOW_TEMPLATE_INCOMPLETE -->\n\n## Empty\n"
            )
        result = process_contract.check_copy_documents(self.root)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(len(result["failures"]), len(process_contract.COPY_GATE_DOCS))

    def test_headings_and_empty_tables_are_not_substantive(self):
        path = self.root / "docs" / "OBJECTION-MAP.md"
        path.write_text(
            "# Objection Map\n\n| Objection | Fear or cost | Evidence | Page location | Status |\n"
            "|---|---|---|---|---|\n"
        )
        failures = process_contract.validate_documents(self.root, ("OBJECTION-MAP.md",))
        self.assertTrue(any("placeholder-level" in item for item in failures))

    def test_substantive_documents_pass_and_build_requires_image_plan(self):
        for name in process_contract.BUILD_GATE_DOCS:
            minimum = process_contract.MINIMUM_MEANINGFUL_CHARACTERS[name]
            (self.root / "docs" / name).write_text("# Complete\n\n" + ("researched evidence " * (minimum // 10 + 3)))
        self.assertEqual(process_contract.check_copy_documents(self.root)["status"], "pass")
        self.assertEqual(process_contract.check_build_documents(self.root)["status"], "blocked")
        self.write_complete_fidelity()
        (self.root / "image-plan.json").write_text(json.dumps({"schema_version": 1, "assets": [], "no_images_reason": "The verified brand treatment uses typography and CSS only."}))
        self.assertEqual(process_contract.check_build_documents(self.root)["status"], "pass")

    def test_unmapped_reference_section_is_blocked(self):
        self.write_complete_fidelity(include_all=False)
        failures = process_contract.validate_reference_fidelity(self.root)
        self.assertTrue(any("missing from the final coverage" in item for item in failures))


if __name__ == "__main__":
    unittest.main()
