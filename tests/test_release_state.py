"""Synthetic offline release protocol fixtures; never user approval or live evidence."""

import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import os
import signal
import subprocess
import time
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1] / "skills/branded-lead-funnel-builder"
sys.path.insert(0, str(SKILL / "scripts"))
import check_gates as gates
import release_state as release
import workflow
import workflow_storage as storage
import workflow_progress as progress

ID = "11111111-1111-4111-8111-111111111111"
VERSION = "22222222-2222-4222-8222-222222222222"
DB = "33333333-3333-4333-8333-333333333333"


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="synthetic-release-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = release.directory(self.root, ID)
        self.package = self.base / "package"
        for name in workflow.COPY_FILES.values():
            storage.write(self.root, name, {"synthetic_protocol_fixture": True})
        storage.write(self.root, "test-fixture.json", {"synthetic": True})
        storage.write(self.root, "public/index.html", {"synthetic": True})
        storage.write(self.root, "funnel.json", {"images": {"enabled": False}})
        storage.write(
            self.root,
            "build/workflow.json",
            {
                "approvals": {
                    "publish": {
                        "actor": "synthetic-test-only",
                        "message": "PRIVATE TEST MESSAGE",
                        "allow_test_lead": True,
                    }
                }
            },
        )
        storage.write(self.root, "build/artifact.json", {"synthetic": True})
        storage.write(
            self.root,
            "build/report.json",
            {
                "artifacts": [
                    {
                        "path": "build/artifact.json",
                        "sha256": release.sha(self.root / "build/artifact.json"),
                    }
                ]
            },
        )
        storage.write(
            self.root, "build/gates.json", {"gates": {"synthetic": {"report": "build/report.json"}}}
        )
        storage.write(
            self.root,
            "build/gate-snapshot.json",
            {"mode": "handoff", **gates.source_snapshot(self.root)},
        )
        storage.write(self.root, ".secrets/private.json", {"secret": "SYNTHETIC PRIVATE"})
        # Only the source approval precondition is injected. Production CLI exposes no bypass.
        self.approval = patch.object(
            workflow, "check_publish_approval", return_value={"status": "pass"}
        )
        self.approval.start()
        self.addCleanup(self.approval.stop)

    def freeze(self):
        release.freeze(self.root, ID, "test-fixture.json")
        return release.validate(self.root, ID)

    def completed_journey(self):
        manifest = self.freeze()
        release.live_snapshot(self.root, ID)
        identity = {
            "schema_version": 1,
            "evidence_source": "cloudflare-wrangler-deployments-and-version-api",
            "account_id": "a" * 32,
            "worker": "synthetic-fixture",
            "version_id": VERSION,
            "database_id": DB,
            "release_id": ID,
            "source_fingerprint": manifest["source_fingerprint"],
            "active_versions": [{"version_id": VERSION, "percentage": 100}],
            "script_etag": "synthetic",
            "url": "https://protocol.example",
        }
        storage.write(
            self.root,
            f"build/releases/{ID}/state.json",
            {
                "id": ID,
                "source_fingerprint": manifest["source_fingerprint"],
                "phase": "verification_started",
                "identity": identity,
            },
        )
        proof = {"database_id": DB, "receipt_id": ID, "stored_receipt_id": ID}
        runtime = {
            when: {key: identity[key] for key in ("version_id", "release_id", "source_fingerprint")}
            | {"observed_at": gates.now()}
            for when in ("before", "after")
        }
        artifacts = []
        for kind, value in {
            "http_trace": [],
            "db_receipt": proof,
            "event_trace": [],
            "dashboard_result": {},
            "deployment_record": identity,
            "deployment_identity": identity,
            "runtime_identity": runtime,
        }.items():
            relative = (
                f'build/live/001/{"identity" if kind == "deployment_identity" else kind}.json'
            )
            storage.write(self.package, relative, value)
            artifacts.append(
                {"type": kind, "path": relative, "sha256": release.sha(self.package / relative)}
            )
        report = {
            "schema_version": 1,
            "gate": "deployment",
            "status": "pass",
            "fully_verified": True,
            "source_fingerprint": manifest["source_fingerprint"],
            "executed_at": gates.now(),
            "tool": {"name": "SYNTHETIC protocol fixture", "version": "1"},
            "target": {"mode": "live", "url": identity["url"]},
            "execution": {"kind": "automated", "command": "synthetic", "exit_code": 0},
            "checks": [{"name": "Synthetic only, not launch evidence", "status": "pass"}],
            "artifacts": artifacts,
            "observations": proof,
            "deployment_identity": identity,
        }
        storage.write(self.package, "build/live/001/result.json", report)
        return manifest, report

    def test_archive_is_portable_sealed_and_excludes_private_runtime(self):
        manifest = self.freeze()
        self.assertTrue((self.package / "build/artifact.json").is_file())
        self.assertFalse((self.package / ".secrets/private.json").exists())
        self.assertNotIn("PRIVATE TEST MESSAGE", (self.package / "build/workflow.json").read_text())
        self.assertIn("message_sha256", manifest["approval"])
        with tempfile.TemporaryDirectory() as destination:
            moved = Path(destination) / "moved"
            shutil.copytree(self.root, moved)
            self.assertEqual(
                release.validate(moved, ID)["source_fingerprint"], manifest["source_fingerprint"]
            )

    def test_handoff_evidence_is_unchanged_and_live_snapshot_reused(self):
        self.freeze()
        before = (self.package / "build/gates.json").read_bytes()
        release.live_snapshot(self.root, ID)
        saved = (self.package / "build/live/snapshot.json").read_bytes()
        release.live_snapshot(self.root, ID)
        self.assertEqual(saved, (self.package / "build/live/snapshot.json").read_bytes())
        self.assertEqual(before, (self.package / "build/gates.json").read_bytes())
        self.assertEqual(storage.read(self.package, "build/gate-snapshot.json")["mode"], "handoff")

    def test_changed_inputs_and_changed_scope_are_rejected(self):
        self.freeze()
        storage.write(self.package, "test-fixture.json", {"changed": True})
        with self.assertRaisesRegex(ValueError, "input changed"):
            release.validate(self.root, ID)

    def test_resume_rechecks_actual_approval_not_just_saved_flags(self):
        self.freeze()
        self.approval.stop()
        with self.assertRaises((ValueError, KeyError)):
            release.validate(self.root, ID)

    def test_existing_release_is_never_overwritten(self):
        self.freeze()
        with self.assertRaisesRegex(ValueError, "already exists"):
            release.freeze(self.root, ID, "test-fixture.json")
        self.assertTrue((self.base / "inputs.json").is_file())

    def test_missing_derived_reports_recover_without_changing_original_result(self):
        _, report = self.completed_journey()
        original = (self.package / "build/live/001/result.json").read_bytes()
        proof = release.finalize(self.root, ID, "001")
        self.assertEqual(release.verified(self.root, ID), proof)
        self.assertEqual(original, (self.package / "build/live/001/result.json").read_bytes())
        for gate in ("crm", "tracking", "deployment"):
            self.assertEqual(
                storage.read(self.package, f"build/live/001/{gate}.json"), {**report, "gate": gate}
            )

    def test_conflicting_derived_report_is_preserved_and_blocks_finalization(self):
        self.completed_journey()
        conflict = {"gate": "crm", "status": "fail", "synthetic": True}
        storage.write(self.package, "build/live/001/crm.json", conflict)
        with self.assertRaisesRegex(ValueError, "conflicts"):
            release.finalize(self.root, ID, "001")
        self.assertEqual(storage.read(self.package, "build/live/001/crm.json"), conflict)
        self.assertFalse((self.base / "verification.json").exists())

    def test_bare_success_flag_cannot_reconstruct_live_proof(self):
        self.completed_journey()
        storage.write(
            self.package, "build/live/001/result.json", {"status": "pass", "fully_verified": True}
        )
        with self.assertRaises(ValueError):
            release.finalize(self.root, ID, "001")
        self.assertFalse((self.base / "verification.json").exists())

    def test_different_running_version_or_changed_artifact_blocks(self):
        self.completed_journey()
        state = storage.read(self.root, f"build/releases/{ID}/state.json")
        state["identity"]["version_id"] = DB
        storage.write(self.root, f"build/releases/{ID}/state.json", state)
        with self.assertRaisesRegex(ValueError, "version_id"):
            release.finalize(self.root, ID, "001")

    def test_retained_verified_proof_rechecks_artifact_hashes(self):
        self.completed_journey()
        release.finalize(self.root, ID, "001")
        storage.write(
            self.package, "build/live/001/runtime_identity.json", {"synthetic": "changed"}
        )
        with self.assertRaises(ValueError):
            release.verified(self.root, ID)

    def test_progress_reports_saved_verification_and_detects_unpublished_source_changes(self):
        self.completed_journey()
        release.finalize(self.root, ID, "001")
        relative = f"build/releases/{ID}/state.json"
        state = storage.read(self.root, relative)
        state["phase"] = "verified"
        storage.write(self.root, relative, state)
        storage.write(self.root, "build/current-release.json", {"id": ID})
        result = progress.guarded_release_state(self.root)
        self.assertTrue(result["verified"])
        self.assertTrue(result["source_current"])
        storage.write(self.root, "public/new.json", {"synthetic": True})
        result = progress.guarded_release_state(self.root)
        self.assertTrue(result["verified"])
        self.assertFalse(result["source_current"])

    def test_progress_never_trusts_a_verified_phase_without_completed_proof(self):
        manifest = self.freeze()
        storage.write(self.root, "build/current-release.json", {"id": ID})
        storage.write(
            self.root,
            f"build/releases/{ID}/state.json",
            {"id": ID, "phase": "verified", "source_fingerprint": manifest["source_fingerprint"]},
        )
        result = progress.guarded_release_state(self.root)
        self.assertFalse(result["verified"])
        self.assertTrue(result["failures"])

    def test_real_process_lock_survives_parent_interruption_until_child_exits(self):
        marker = self.root / "child.pid"
        script = 'import os,time,pathlib; pathlib.Path("child.pid").write_text(str(os.getpid())); time.sleep(15)'
        command = [
            sys.executable,
            str(SKILL / "scripts/release_state.py"),
            "run",
            str(self.root),
            "--",
            sys.executable,
            "-c",
            script,
        ]
        parent = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        child = None
        try:
            deadline = time.monotonic() + 5
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(marker.exists(), "The isolated lock holder started")
            child = int(marker.read_text())
            parent.kill()
            parent.wait(timeout=5)
            attempt = subprocess.run(
                command[:-1] + ["pass"], capture_output=True, text=True, timeout=5
            )
            self.assertNotEqual(attempt.returncode, 0)
            self.assertIn("still holds this project lock", attempt.stdout)
            os.kill(child, signal.SIGTERM)
            child = None
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                attempt = subprocess.run(
                    command[:-1] + ["pass"], capture_output=True, text=True, timeout=5
                )
                if attempt.returncode == 0:
                    break
                time.sleep(0.02)
            self.assertEqual(attempt.returncode, 0, attempt.stdout + attempt.stderr)
        finally:
            if child:
                try:
                    os.kill(child, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            if parent.poll() is None:
                parent.kill()
            parent.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
