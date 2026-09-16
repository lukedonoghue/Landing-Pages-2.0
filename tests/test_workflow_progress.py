"""Progress/resumption protocol tests. All approval and QA records here are synthetic."""

import json
import multiprocessing
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

import test_approvals as approval_fixtures

SKILL = Path(__file__).resolve().parents[1] / "skills/branded-lead-funnel-builder"
sys.path.insert(0, str(SKILL / "scripts"))
import workflow
import workflow_progress as progress
import workflow_storage as storage
import check_gates


def note_worker(root, index):
    progress.checkpoint(
        Path(root),
        "design_and_build",
        "started",
        f"Synthetic worker {index} retained its work note.",
    )


class ProgressTests(unittest.TestCase):
    def setUp(self):
        self.fixture = approval_fixtures.ApprovalTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.root = self.fixture.root

    def save(self, path, value):
        storage.write(self.root, path, value)

    def approve(self):
        workflow.record(
            self.root,
            "copy",
            "Synthetic protocol approval containing PRIVATE-MESSAGE; not a real user approval",
            "fixture-only",
        )

    def snapshot(self):
        value = {
            "schema_version": 1,
            "created_at": check_gates.now(),
            "mode": "handoff",
            **check_gates.source_snapshot(self.root),
        }
        self.save("build/gate-snapshot.json", value)
        return value

    def performance(self, snapshot, status="pass"):
        self.save("build/lighthouse.json", {"synthetic_protocol_fixture": True})
        report = {
            "schema_version": 1,
            "gate": "performance",
            "status": status,
            "source_fingerprint": snapshot["source_fingerprint"],
            "target": {"mode": "handoff", "url": "http://127.0.0.1:8787"},
            "executed_at": check_gates.now(),
            "tool": {"name": "synthetic protocol fixture", "version": "1"},
            "execution": {"kind": "automated", "exit_code": 0},
            "checks": {"fixture": status == "pass"},
            "metrics": {"performance": 99},
            "failures": [] if status == "pass" else ["Synthetic measured failure"],
            "artifacts": [
                {
                    "path": "build/lighthouse.json",
                    "type": "lighthouse_json",
                    "sha256": progress.digest(self.root / "build/lighthouse.json"),
                }
            ],
        }
        self.save("build/performance/result.json", report)
        return report

    def test_stage_distinguishes_research_draft_review_and_actual_copy_approval(self):
        self.assertEqual(progress.inspect(self.root)["stage"], "awaiting_copy_approval")
        (self.root / workflow.COPY_FILES["review"]).unlink()
        self.assertEqual(progress.inspect(self.root)["stage"], "copy_review")
        (self.root / workflow.COPY_FILES["copy"]).unlink()
        self.assertEqual(progress.inspect(self.root)["stage"], "copy_drafting")
        (self.root / workflow.COPY_FILES["brief"]).unlink()
        self.assertEqual(progress.inspect(self.root)["stage"], "research")
        (self.root / "funnel.json").unlink()
        self.assertEqual(progress.inspect(self.root)["stage"], "setup")

    def test_stale_editorial_work_is_not_a_request_for_another_user_approval(self):
        self.approve()
        master = json.loads((self.root / workflow.COPY_FILES["copy"]).read_text())
        master["h1"] = "Changed fixture wording."
        self.save(workflow.COPY_FILES["copy"], master)
        report = progress.inspect(self.root)
        self.assertEqual(report["stage"], "copy_review")
        self.assertTrue(any("stale" in x for x in report["blockers"]))
        self.assertNotEqual(report["next_action"]["kind"], "user_review")

    def test_resume_preserves_unchanged_approval_and_does_not_echo_private_message(self):
        self.approve()
        approval = (self.root / "build/workflow.json").read_bytes()
        source = check_gates.source_snapshot(self.root)
        for _ in range(2):
            result = progress.resume(self.root)
            self.assertEqual(result["stage"], "design_and_build")
            self.assertNotIn("PRIVATE-MESSAGE", json.dumps(result))
        self.assertEqual((self.root / "build/workflow.json").read_bytes(), approval)
        self.assertEqual(check_gates.source_snapshot(self.root), source)
        self.assertEqual(len(progress.record(self.root)["observations"]), 2)

    def test_status_is_read_only_and_tampered_stage_labels_cannot_grant_progress(self):
        self.save(
            progress.PROGRESS,
            {
                "schema_version": 1,
                "events": [],
                "observations": [],
                "latest": {"stage": "complete", "status": "pass"},
            },
        )
        original = (self.root / progress.PROGRESS).read_bytes()
        result = progress.inspect(self.root)
        self.assertEqual(result["stage"], "awaiting_copy_approval")
        self.assertEqual((self.root / progress.PROGRESS).read_bytes(), original)

    def test_pending_generation_is_exposed_without_another_request_or_plan_mutation(self):
        self.approve()
        config = json.loads((self.root / "funnel.json").read_text())
        config["images"]["enabled"] = True
        # Refresh the actual contract and synthetic editorial hashes after this fixture configuration change.
        self.save("funnel.json", config)
        context = json.loads((self.root / workflow.COPY_FILES["context"]).read_text())
        context["funnel_contract"]["sha256"] = progress.digest(self.root / "funnel.json")
        self.save(workflow.COPY_FILES["context"], context)
        review = json.loads((self.root / workflow.COPY_FILES["review"]).read_text())
        review["context_sha256"] = progress.digest(self.root / workflow.COPY_FILES["context"])
        self.save(workflow.COPY_FILES["review"], review)
        plan = {
            "assets": [],
            "no_images_reason": "Synthetic protocol fixture only",
            "generation_attempts": [
                {
                    "id": "attempt-1",
                    "asset_id": "hero",
                    "status": "pending",
                    "mode": "native",
                    "requested_model": "requested-model",
                    "request": {"secret": "NEVER-ECHO"},
                }
            ],
        }
        self.save("image-plan.json", plan)
        before = (self.root / "image-plan.json").read_bytes()
        report = progress.resume(self.root)
        self.assertEqual(report["stage"], "image_generation_pending")
        self.assertEqual(report["images"]["pending"][0]["id"], "attempt-1")
        self.assertEqual((self.root / "image-plan.json").read_bytes(), before)
        self.assertNotIn("NEVER-ECHO", json.dumps(report))

    def test_resume_registers_existing_current_reports_without_rerunning_checks(self):
        self.approve()
        snapshot = self.snapshot()
        self.performance(snapshot)
        original = (self.root / "build/performance/result.json").read_bytes()
        result = progress.resume(self.root)
        self.assertEqual(result["registered_existing_reports"], ["performance"])
        self.assertEqual(result["stage"], "local_verification")
        self.assertIn("performance_evidence_verified", result["completed"])
        self.assertEqual((self.root / "build/performance/result.json").read_bytes(), original)
        self.assertEqual(progress.resume(self.root)["registered_existing_reports"], [])

    def test_failing_or_stale_candidate_cannot_be_promoted(self):
        self.approve()
        snapshot = self.snapshot()
        self.performance(snapshot, "blocked")
        self.assertEqual(progress.resume(self.root)["registered_existing_reports"], [])
        self.performance(snapshot)
        (self.root / "changed-source.txt").write_text("An actual source change")
        self.assertEqual(progress.resume(self.root)["registered_existing_reports"], [])

    def test_existing_failed_gate_is_not_replaced_by_an_older_green_candidate(self):
        self.approve()
        snapshot = self.snapshot()
        report = self.performance(snapshot, "blocked")
        self.save("build/failed-performance.json", report)
        check_gates.record_report(self.root, "performance", "build/failed-performance.json")
        self.performance(snapshot)
        result = progress.resume(self.root)
        self.assertEqual(result["registered_existing_reports"], [])
        self.assertEqual(result["quality"]["gates"]["performance"]["status"], "blocked")

    def test_new_snapshot_can_use_new_evidence_after_old_manifest_expires(self):
        self.approve()
        old = self.snapshot()
        self.performance(old)
        progress.resume(self.root)
        (self.root / "revision.txt").write_text("new revision")
        current = self.snapshot()
        self.performance(current)
        result = progress.resume(self.root)
        self.assertEqual(result["registered_existing_reports"], ["performance"])
        self.assertEqual(
            storage.read(self.root, "build/gates.json")["snapshot"]["source_fingerprint"],
            current["source_fingerprint"],
        )

    def test_failure_checkpoints_survive_a_new_process_and_do_not_count_as_QA(self):
        self.approve()
        progress.checkpoint(
            self.root, "design_and_build", "blocked", "The modal layout needs an actual repair."
        )
        result = progress.resume(self.root)
        self.assertEqual(result["operator_blocker"]["event"], "blocked")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("Operator checkpoint" in item for item in result["blockers"]))
        self.assertEqual(result["stage"], "design_and_build")
        self.assertEqual(len(progress.record(self.root)["events"]), 1)
        self.assertNotIn("local_quality_verified", result["completed"])

    def test_concurrent_checkpoint_writers_do_not_lose_events(self):
        ctx = multiprocessing.get_context("spawn")
        workers = [ctx.Process(target=note_worker, args=(str(self.root), i)) for i in range(4)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(15)
            self.assertEqual(worker.exitcode, 0)
        self.assertEqual(len(progress.record(self.root)["events"]), 4)

    def test_failed_serialization_preserves_existing_state(self):
        self.save(progress.PROGRESS, {"schema_version": 1, "events": [], "observations": []})
        before = (self.root / progress.PROGRESS).read_bytes()
        with self.assertRaises(TypeError):
            storage.write(self.root, progress.PROGRESS, {"cannot-serialize": object()})
        self.assertEqual((self.root / progress.PROGRESS).read_bytes(), before)
        self.assertEqual(list((self.root / "build").glob(".workflow-*")), [])

    def test_unsupported_history_schema_is_not_reset_or_overwritten(self):
        self.save(progress.PROGRESS, {"schema_version": 99, "events": [], "observations": []})
        before = (self.root / progress.PROGRESS).read_bytes()
        with self.assertRaises(ValueError):
            progress.resume(self.root)
        self.assertEqual((self.root / progress.PROGRESS).read_bytes(), before)

    def test_symlinked_records_and_secret_artifacts_are_rejected(self):
        target = self.root / "keep.json"
        target.write_text("{}")
        (self.root / progress.PROGRESS).symlink_to(target)
        with self.assertRaises(ValueError):
            progress.resume(self.root)
        (self.root / progress.PROGRESS).unlink()
        with self.assertRaises(ValueError):
            progress.checkpoint(
                self.root, "research", "started", "Synthetic note", [".secrets/password.txt"]
            )
        self.assertEqual(target.read_text(), "{}")

    def test_external_checkpoint_needs_reconciliation_not_blind_retry(self):
        self.approve()
        progress.checkpoint(
            self.root, "publishing", "started", "A synthetic interrupted operation is recorded."
        )
        report = progress.resume(self.root)
        self.assertEqual(report["stage"], "publishing_outcome_unknown")
        self.assertIsNone(report["next_action"]["command"])
        with self.assertRaises(ValueError):
            progress.checkpoint(self.root, "publishing", "resolved", "Inspected actual outcome.")
        self.save(
            "build/provider-observation.json",
            {"scope": "synthetic protocol fixture; no external call made"},
        )
        progress.checkpoint(
            self.root,
            "publishing",
            "resolved",
            "Synthetic outcome evidence saved.",
            ["build/provider-observation.json"],
        )
        self.assertEqual(progress.resume(self.root)["stage"], "design_and_build")
        self.save("build/provider-observation.json", {"changed": True})
        self.assertEqual(progress.resume(self.root)["stage"], "publishing_outcome_unknown")

    def test_uploaded_and_old_verifier_success_are_never_complete_or_redeployed(self):
        self.save(
            "build/deployment-record.json",
            {
                "url": "https://synthetic.example",
                "database_id": "11111111-1111-4111-8111-111111111111",
                "worker": "synthetic",
                "verification_pending": True,
            },
        )
        report = progress.resume(self.root)
        self.assertEqual(report["stage"], "deployed_unverified")
        self.assertIsNone(report["next_action"]["command"])
        self.save(
            "build/live-verification/result.json",
            {"status": "pass", "fully_verified": True, "readiness": "live-journey-verified"},
        )
        report = progress.resume(self.root)
        self.assertEqual(report["stage"], "deployed_unverified")
        self.assertFalse(report["deployment"]["identity_finalized"])
        self.assertNotEqual(report["status"], "complete")

    def test_invalid_saved_target_is_not_echoed_or_contacted(self):
        self.save(
            "build/deployment-record.json",
            {"url": "https://user:private-password@synthetic.example"},
        )
        with self.assertRaisesRegex(ValueError, "destination is invalid"):
            progress.resume(self.root)

    def test_demo_does_not_request_client_copy_approval_or_allow_publishing(self):
        config = json.loads((self.root / "funnel.json").read_text())
        config["development_fixture"] = True
        self.save("funnel.json", config)
        result = progress.resume(self.root)
        self.assertEqual(result["stage"], "demo")
        self.assertEqual(result["publication"], "disabled")
        self.assertNotEqual(result["next_action"]["kind"], "user_review")

    def test_publishing_setup_review_and_ready_stages_are_separate(self):
        self.approve()
        self.snapshot()
        quality = {"status": "pass", "gates": {}, "failures": [], "warnings": []}
        missing = {"status": "blocked", "failures": ["Final publish approval is missing or stale."]}
        with patch.object(progress, "gate_state", return_value=quality), patch.object(
            workflow, "check_publish_approval", return_value=missing
        ) as publish:
            self.assertEqual(progress.inspect(self.root)["stage"], "publishing_setup")
            self.save(
                "wrangler.jsonc",
                {
                    "name": "synthetic-fixture",
                    "account_id": "a" * 32,
                    "d1_databases": [{"database_id": "11111111-1111-4111-8111-111111111111"}],
                },
            )
            self.assertEqual(progress.inspect(self.root)["stage"], "awaiting_publish_approval")
            publish.return_value = {"status": "pass", "failures": []}
            self.assertEqual(progress.inspect(self.root)["stage"], "ready_to_publish")
            publish.return_value = {
                "status": "blocked",
                "failures": ["Source changed during inspection"],
            }
            self.assertEqual(progress.inspect(self.root)["stage"], "local_verification")

    def test_checkpoints_reject_obvious_credentials(self):
        with self.assertRaises(ValueError):
            progress.checkpoint(self.root, "research", "blocked", "api_key=do-not-record-this")


if __name__ == "__main__":
    unittest.main()
