"""Portable handoff integrity fixtures. Synthetic QA/approvals never authorize launch."""

import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch

import test_approvals

SKILL = Path(__file__).resolve().parents[1] / "skills/branded-lead-funnel-builder"
sys.path.insert(0, str(SKILL / "scripts"))
import portable_handoff as bundle
import workflow
import workflow_storage as storage
import check_gates as gates
import workflow_progress as progress


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.approvals = test_approvals.ApprovalTests()
        self.approvals.setUp()
        self.addCleanup(self.approvals.tearDown)
        self.root = self.approvals.root.resolve()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.archive = Path(self.temp.name) / "bundle.zip"
        self.destination = Path(self.temp.name) / "receiver"
        # Actual copy audit, deliberately synthetic editorial protocol fixture.
        self.assertIn(workflow.copy_state(self.root)["status"], {"pass", "pass_with_warnings"})
        storage.write(
            self.root, "test-fixture.json", {"synthetic": True, "fields": {"name": "Synthetic"}}
        )
        storage.write(
            self.root, "image-plan.json", {"enabled": False, "reason": "Synthetic fixture"}
        )
        storage.write(
            self.root,
            "build/workflow.json",
            {
                "schema_version": 1,
                "approvals": {
                    "copy": {
                        "actor": "fixture",
                        "fingerprint": workflow.copy_state(self.root)["fingerprint"],
                        "message": "PRIVATE COPY MESSAGE",
                        "message_id": "synthetic-test-only",
                    },
                    "publish": {
                        "actor": "fixture",
                        "fingerprint": "not-a-real-approval",
                        "message": "PRIVATE PUBLISH MESSAGE",
                        "message_id": "synthetic-test-only",
                    },
                },
            },
        )
        self.snapshot = {
            "schema_version": 1,
            "mode": "handoff",
            "created_at": gates.now(),
            **gates.source_snapshot(self.root),
        }
        storage.write(self.root, "build/gate-snapshot.json", self.snapshot)
        storage.write(
            self.root,
            "build/gates.json",
            {"schema_version": 1, "snapshot": self.snapshot, "gates": {}},
        )
        storage.write(
            self.root,
            ".secrets/account-recovery/id/intent.json",
            {"generated_password": "PRIVATE-SECRET-VALUE-123456789"},
        )
        storage.write(
            self.root,
            ".secrets/journeys/id/submission.json",
            {"form_data": {"email": "private@example.invalid"}},
        )
        (self.root / ".wrangler").mkdir()
        (self.root / ".wrangler/private.sqlite").write_bytes(b"PRIVATE DATABASE")

    def export(self):
        return bundle.export_bundle(self.root, self.archive, "Synthetic Fixture", in_progress=True)

    def test_round_trip_preserves_source_and_actual_copy_audit_without_original_directory(self):
        before = gates.source_snapshot(self.root)
        self.export()
        moved = bundle.extract_archive(self.archive, self.destination)
        project = Path(moved["project"])
        original = self.root.with_name(self.root.name + "-unavailable")
        self.root.rename(original)
        try:
            self.assertEqual(gates.source_snapshot(project), before)
            self.assertIn(workflow.copy_state(project)["status"], {"pass", "pass_with_warnings"})
            self.assertEqual(
                workflow.check_copy_approval(project, allow_fixture=True)["status"], "pass"
            )
            self.assertEqual(workflow.check_publish_approval(project)["status"], "blocked")
            self.assertTrue((project / "test-fixture.json").is_file())
            self.assertTrue((project / "image-plan.json").is_file())
            self.assertFalse((project / "START-HERE.txt").exists())
            self.assertTrue((project.parent / "START-HERE.txt").is_file())
        finally:
            original.rename(self.root)

    def test_private_files_and_raw_approval_text_are_excluded_and_publish_is_historical(self):
        raw = storage.read(self.root, "build/workflow.json")
        raw["conversation"] = ["PRIVATE UNRELATED CHAT"]
        raw["approvals"]["copy"]["operator_chat"] = "PRIVATE EXTRA APPROVAL CHAT"
        storage.write(self.root, "build/workflow.json", raw)
        self.export()
        bundle.extract_archive(self.archive, self.destination)
        project = self.destination / "project"
        self.assertFalse((project / ".secrets").exists())
        self.assertFalse((project / ".wrangler").exists())
        state = storage.read(project, "build/workflow.json")
        self.assertNotIn("publish", state["approvals"])
        self.assertIn("publish", state["historical_approvals"])
        with zipfile.ZipFile(self.archive) as archive:
            for name in archive.namelist():
                data = archive.read(name)
                for value in [
                    b"PRIVATE-SECRET-VALUE",
                    b"PRIVATE DATABASE",
                    b"PRIVATE COPY MESSAGE",
                    b"PRIVATE PUBLISH MESSAGE",
                    b"private@example.invalid",
                    b"PRIVATE UNRELATED CHAT",
                    b"PRIVATE EXTRA APPROVAL CHAT",
                ]:
                    self.assertNotIn(value, data)
        self.assertTrue(
            storage.read(project, "build/handoff-import.json")["publication_context_pending"]
        )

    def test_nested_secret_value_in_source_blocks_even_under_an_innocent_filename(self):
        (self.root / "innocent.txt").write_text("PRIVATE-SECRET-VALUE-123456789")
        with self.assertRaisesRegex(ValueError, "private credential"):
            self.export()
        self.assertFalse(self.archive.exists())

    def test_customer_export_or_secret_link_cannot_be_added_as_evidence(self):
        storage.write(
            self.root,
            "build/export.json",
            {"leads": [{"name": "Real person", "email": "private@example.invalid"}]},
        )
        with self.assertRaisesRegex(ValueError, "Raw contact"):
            bundle.export_bundle(self.root, self.archive, "Fixture", True, ["build/export.json"])
        with self.assertRaisesRegex(ValueError, "Private/runtime"):
            bundle.export_bundle(
                self.root, self.archive, "Fixture", True, [".secrets/journeys/id/submission.json"]
            )

    def test_erasure_records_cannot_enter_a_source_handoff(self):
        storage.write(self.root, "build/innocent.json", {"entries": [{"lead_id": "opaque", "key_hash": "a" * 64}]})
        with self.assertRaisesRegex(ValueError, "Raw erasure"):
            bundle.export_bundle(self.root, self.archive, "Fixture", True, ["build/innocent.json"])
        storage.write(self.root, "build/erasure-record.json", {"complete": True, "entries": []})
        with self.assertRaisesRegex(ValueError, "separate private"):
            bundle.export_bundle(self.root, self.archive, "Fixture", True, ["build/erasure-record.json"])

    def test_symlink_source_and_output_inside_source_are_rejected(self):
        (self.root / "linked.txt").symlink_to(self.root / "funnel.json")
        with self.assertRaises(ValueError):
            self.export()
        (self.root / "linked.txt").unlink()
        with self.assertRaisesRegex(ValueError, "outside project source"):
            bundle.export_bundle(self.root, self.root / "handoff.zip", "Fixture", True)

    def test_omission_or_tamper_in_zip_fails_verification(self):
        self.export()
        original = self.archive.read_bytes()
        for mode in ("omit", "change", "extra", "traversal", "symlink", "case-collision"):
            self.archive.write_bytes(original)
            with zipfile.ZipFile(self.archive) as z:
                rows = {i.filename: (z.read(i.filename), i) for i in z.infolist()}
            file = next(name for name in rows if name.endswith("/project/test-fixture.json"))
            if mode == "omit":
                del rows[file]
            elif mode == "change":
                rows[file] = (b'{"changed":true}', zipfile.ZipInfo(file))
            else:
                name = {
                    "extra": file + ".unexpected",
                    "traversal": "../escape.txt",
                    "symlink": file + ".link",
                    "case-collision": file.upper(),
                }[mode]
                info = zipfile.ZipInfo(name)
                if mode == "symlink":
                    info.external_attr = 0o120777 << 16
                rows[name] = (b"payload", info)
            with zipfile.ZipFile(self.archive, "w") as z:
                for name, (data, info) in rows.items():
                    z.writestr(info, data)
            with self.assertRaises((ValueError, KeyError)):
                bundle.verify_archive(self.archive)
            self.assertFalse((Path(self.temp.name) / "escape.txt").exists())

    def test_failed_replacement_preserves_the_prior_archive_and_existing_receiver(self):
        self.export()
        original = self.archive.read_bytes()
        with patch.object(
            bundle, "verify_archive", side_effect=ValueError("Synthetic interrupted verification")
        ):
            with self.assertRaises(ValueError):
                self.export()
        self.assertEqual(self.archive.read_bytes(), original)
        self.destination.mkdir()
        (self.destination / "keep.txt").write_text("preserve")
        with self.assertRaisesRegex(ValueError, "new directory"):
            bundle.extract_archive(self.archive, self.destination)
        self.assertEqual((self.destination / "keep.txt").read_text(), "preserve")

    def test_reviewed_export_cannot_use_missing_quality_as_an_override(self):
        with self.assertRaisesRegex(ValueError, "Reviewed handoff"):
            bundle.export_bundle(self.root, self.archive, "Fixture")

    def test_reviewed_protocol_fixture_keeps_valid_gates_and_rejects_later_artifact_drift(self):
        # Deliberately synthetic report inputs test the reviewed-package protocol;
        # they are not represented as real visual/browser approval of a page.
        config = storage.read(self.root, "funnel.json")
        config["quality"]["complete_workflow"] = False
        storage.write(self.root, "funnel.json", config)
        test_approvals.m.prepare(
            SKILL / "references/copy-library",
            self.approvals.paths["brief"],
            self.approvals.paths["context"],
            3,
        )
        review = storage.read(self.root, "build/copy-editorial-review.json")
        review["context_sha256"] = gates.file_hash(self.approvals.paths["context"])
        storage.write(self.root, "build/copy-editorial-review.json", review)
        snapshot = {
            "schema_version": 1,
            "mode": "handoff",
            "created_at": gates.now(),
            **gates.source_snapshot(self.root),
        }
        storage.write(self.root, "build/gate-snapshot.json", snapshot)
        image = self.root / "build/synthetic.png"
        image.write_bytes(b"SYNTHETIC protocol screenshot, not visual evidence")
        artifact = {
            "path": "build/synthetic.png",
            "type": "screenshot",
            "sha256": gates.file_hash(image),
        }
        manifest = {"schema_version": 1, "snapshot": snapshot, "gates": {}}
        for gate in ["static", "browser", "visual"]:
            report = {
                "schema_version": 1,
                "gate": gate,
                "status": "pass",
                "source_fingerprint": snapshot["source_fingerprint"],
                "target": {"mode": "handoff"},
                "executed_at": gates.now(),
                "tool": {"name": "Synthetic protocol fixture only", "version": "1"},
                "checks": {"synthetic": True},
            }
            if gate == "browser":
                report.update(
                    execution={"kind": "automated"},
                    viewports=[
                        {"width": w, "height": 600} for w in [360, 390, 768, 1024, 1180, 1280, 1440]
                    ],
                    artifacts=[artifact],
                )
            if gate == "visual":
                report.update(
                    reviewer="Synthetic fixture",
                    observations=["Protocol fixture, not real page review"],
                    artifacts=[artifact],
                )
            name = f"build/{gate}.json"
            storage.write(self.root, name, report)
            manifest["gates"][gate] = {
                "report": name,
                "status": "pass",
                "report_sha256": gates.file_hash(self.root / name),
            }
        storage.write(self.root, "build/gates.json", manifest)
        result = bundle.export_bundle(self.root, self.archive, "Synthetic reviewed protocol")
        self.assertEqual(result["scope"], "reviewed")
        target = Path(bundle.extract_archive(self.archive, self.destination)["project"])
        self.assertEqual(bundle.audit(target)["quality"]["status"], "pass")
        (target / "build/synthetic.png").write_bytes(b"changed")
        self.assertEqual(bundle.audit(target)["quality"]["status"], "blocked")

    def test_reviewed_label_cannot_hide_blocked_validation(self):
        self.export()
        with zipfile.ZipFile(self.archive) as z:
            rows = {name: z.read(name) for name in z.namelist()}
        name = next(name for name in rows if name.endswith("/FILE-MANIFEST.json"))
        manifest = json.loads(rows[name])
        manifest["scope"] = "reviewed"
        rows[name] = json.dumps(manifest).encode()
        with zipfile.ZipFile(self.archive, "w") as z:
            for name, data in rows.items():
                z.writestr(name, data)
        with self.assertRaisesRegex(ValueError, "classification contradicts"):
            bundle.verify_archive(self.archive)
        self.assertFalse(self.destination.exists())

    def test_database_disguise_and_state_file_output_are_rejected(self):
        (self.root / "unexpected.bin").write_bytes(b"SQLite format 3\x00PRIVATE DATA")
        with self.assertRaisesRegex(ValueError, "Runtime database"):
            self.export()
        (self.root / "unexpected.bin").unlink()
        before = (self.root / "build/workflow.json").read_bytes()
        with self.assertRaisesRegex(ValueError, ".zip output"):
            bundle.export_bundle(self.root, self.root / "build/workflow.json", "Fixture", True)
        self.assertEqual((self.root / "build/workflow.json").read_bytes(), before)

    def test_catalogue_inputs_and_private_publication_history_survive_a_second_transfer(self):
        storage.write(
            self.root,
            "catalogue.json",
            {"brand": {}, "cover": {"image": "build/artwork.png"}, "services": []},
        )
        (self.root / "build/artwork.png").write_bytes(b"SYNTHETIC artwork fixture")
        storage.write(
            self.root,
            "build/deployment-record.json",
            {"url": "https://synthetic.example", "verification_pending": True},
        )
        self.export()
        bundle.extract_archive(self.archive, self.destination)
        project = self.destination / "project"
        self.assertTrue((project / "build/artwork.png").is_file())
        self.assertFalse((project / "build/deployment-record.json").exists())
        second = Path(self.temp.name) / "second.zip"
        bundle.export_bundle(project, second, "Second", True)
        restored = bundle.extract_archive(second, Path(self.temp.name) / "second")["project"]
        self.assertEqual(
            len(list((Path(restored) / "build/handoff-history").glob("*deployment-record.json"))), 1
        )

    def test_required_catalogue_assets_cannot_depend_on_original_absolute_paths(self):
        storage.write(
            self.root,
            "catalogue.json",
            {"brand": {}, "cover": {"image": str(self.root / "private-image.png")}, "services": []},
        )
        with self.assertRaisesRegex(ValueError, "relative project-local"):
            self.export()

    def test_linked_artifacts_keep_relative_paths_and_are_checked_after_extraction(self):
        storage.write(self.root, "build/linked.json", {"synthetic": True})
        state = storage.read(
            self.root,
            "build/progress.json",
            {"schema_version": 1, "events": [], "observations": []},
        )
        state["events"].append(
            {
                "id": "synthetic",
                "stage": "design_and_build",
                "event": "blocked",
                "summary": "Synthetic checkpoint",
                "artifacts": [
                    {
                        "path": "build/linked.json",
                        "sha256": gates.file_hash(self.root / "build/linked.json"),
                    }
                ],
            }
        )
        storage.write(self.root, "build/progress.json", state)
        self.export()
        bundle.extract_archive(self.archive, self.destination)
        self.assertEqual(
            (self.destination / "project/build/linked.json").read_bytes(),
            (self.root / "build/linked.json").read_bytes(),
        )

    def test_completed_unregistered_qa_is_preserved_and_resumed(self):
        storage.write(
            self.root, "build/performance/lighthouse.json", {"synthetic_protocol_fixture": True}
        )
        artifact = {
            "type": "lighthouse_json",
            "path": "build/performance/lighthouse.json",
            "sha256": gates.file_hash(self.root / "build/performance/lighthouse.json"),
        }
        report = {
            "schema_version": 1,
            "gate": "performance",
            "status": "pass",
            "source_fingerprint": self.snapshot["source_fingerprint"],
            "target": {"mode": "handoff", "url": "http://127.0.0.1:8787"},
            "executed_at": gates.now(),
            "tool": {"name": "Synthetic protocol fixture, not a measured page", "version": "1"},
            "execution": {"kind": "automated", "exit_code": 0},
            "checks": [{"name": "Synthetic", "status": "pass"}],
            "metrics": {"performance": 100},
            "artifacts": [artifact],
        }
        storage.write(self.root, "build/performance/result.json", report)
        self.export()
        bundle.extract_archive(self.archive, self.destination)
        result = progress.resume(self.destination / "project")
        self.assertIn("performance", result["registered_existing_reports"])
        self.assertEqual(
            gates.check(
                self.destination / "project",
                "handoff",
                self.destination / "project/build/gates.json",
            )["gates"]["performance"]["status"],
            "pass",
        )


if __name__ == "__main__":
    unittest.main()
