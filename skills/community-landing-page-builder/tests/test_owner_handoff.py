import json
import tempfile
import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from validate_owner_handoff import CLEANUP_CHECK, validate


class OwnerHandoffCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = {
            "status": "complete",
            "message": "The release is ready.",
            "domains": [],
            "blockers": [],
        }

    def write_report(self, **updates):
        report = {
            "status": "pass",
            "fully_verified": True,
            "cleanup": "synthetic-contact-soft-removed",
            "synthetic_impact": {"lead_id": "lead-123"},
            "checks": [{"name": CLEANUP_CHECK, "status": "pass"}],
        }
        report.update(updates)
        path = self.root / "build/releases/release/package/build/live/001/result.json"
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(report))
        return path.relative_to(self.root).as_posix()

    def test_cleanup_claim_requires_guarded_report(self):
        data = {**self.base, "message": "The synthetic test contact was removed."}
        self.assertIn(
            "cleanup claim requires a structured cleanup disposition",
            validate(data, project=self.root),
        )

    def test_verified_cleanup_report_supports_claim(self):
        note = "The synthetic contact was soft-removed; its historical test metrics remain, so this is not complete erasure."
        data = {
            **self.base,
            "message": "The release is ready. " + note,
            "cleanup": {
                "disposition": "verified_soft_removed",
                "report": self.write_report(),
                "historical_metrics": "retained",
                "owner_note": note,
            },
        }
        self.assertEqual(validate(data, project=self.root), [])

    def test_retained_or_mismatched_report_cannot_support_claim(self):
        note = "The synthetic contact was soft-removed; historical test metrics remain."
        data = {
            **self.base,
            "message": note,
            "cleanup": {
                "disposition": "verified_soft_removed",
                "report": self.write_report(cleanup="retained-synthetic-contact"),
                "historical_metrics": "retained",
                "owner_note": note,
            },
        }
        errors = validate(data, project=self.root)
        self.assertTrue(any("does not record guarded" in error for error in errors))

    def test_negative_and_pending_wording_is_not_a_verified_claim(self):
        for note in (
            "The test contact was not removed.",
            "Synthetic lead cleanup remains pending.",
        ):
            with self.subTest(note=note):
                data = {
                    **self.base,
                    "message": note,
                    "cleanup": {"disposition": "pending", "owner_note": note},
                }
                self.assertEqual(validate(data, project=self.root), [])

    def test_verified_soft_removal_cannot_claim_complete_erasure(self):
        note = "The synthetic contact was removed with zero trace."
        data = {
            **self.base,
            "message": note,
            "cleanup": {
                "disposition": "verified_soft_removed",
                "report": self.write_report(),
                "historical_metrics": "retained",
                "owner_note": note,
            },
        }
        self.assertIn(
            "verified soft-removal cannot be described as complete erasure",
            validate(data, project=self.root),
        )

    def test_malformed_report_is_a_validation_failure(self):
        path = self.root / "build/live/result.json"
        path.parent.mkdir(parents=True)
        path.write_text("[]")
        data = {
            **self.base,
            "message": "The demo lead was soft-removed; historical test metrics remain.",
            "cleanup": {
                "disposition": "verified_soft_removed",
                "report": path.relative_to(self.root).as_posix(),
                "historical_metrics": "retained",
                "owner_note": "The demo lead was soft-removed; historical test metrics remain.",
            },
        }
        self.assertIn("cleanup report must be an object", validate(data, project=self.root))

    def test_crm_cannot_omit_usage_monitoring_handoff(self):
        (self.root / "src").mkdir()
        (self.root / "src/free-usage.js").write_text("// maintained module fixture")
        self.assertIn("CRM handoff requires usage_monitoring status and owner instructions", validate(self.base, project=self.root))
        note = "Automatic usage checks are not connected. Use the hosting dashboard until setup is complete."
        data = {**self.base, "status": "action_required", "message": note,
                "usage_monitoring": {"status": "not_connected", "evidence": "Dedicated token absent", "coverage": "Daily metrics unavailable; storage not monitored", "owner_note": note, "blocker_id": "hosting-usage"},
                "blockers": [{"id": "hosting-usage", "feature": "Hosting usage", "evidence": "Token absent", "completed": "Honest unavailable UI", "preserve": "Keep existing plan", "resume": "Read provider metrics", "steps": [{"action": "Connect read-only analytics privately", "expected": "Provider metrics available"}]}]}
        self.assertEqual(validate(data, project=self.root), [])
        data["usage_monitoring"]["blocker_id"] = "missing"
        self.assertIn("Unconnected usage monitoring requires a linked setup blocker", validate(data, project=self.root))
        data["usage_monitoring"]["status"] = "deferred"
        self.assertIn("usage_monitoring: missing decision", validate(data, project=self.root))


if __name__ == "__main__":
    unittest.main()
