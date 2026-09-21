"""Regression for portable copy-acceptance evidence in handoffs and releases."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / "scripts"))

import check_gates
import copy_acceptance
import portable_handoff
import process_contract
import release_state
import workflow
import workflow_storage


RELEASE_ID = "11111111-1111-4111-8111-111111111111"


class CopyEvidencePortabilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="copy-evidence-portability-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "project"
        (self.root / "build").mkdir(parents=True)
        self.root = self.root.resolve()
        (self.root / "docs").mkdir()

        copy_text = "Accounting support with an agreed scope and fee. Request a consultation."
        brief_text = "Small businesses need clarity on price and included work."
        source_text = "Synthetic evidence: the provider agrees scope and a fixed fee before work."
        draft = {
            "h1": copy_text,
            "primary_cta": "Request a consultation",
            "sections": [
                {
                    "id": "hero",
                    "headline": "Accounting support",
                    "body": copy_text,
                }
            ],
        }
        brief = {
            "client_name": "Synthetic",
            "audience": brief_text,
            "primary_cta": draft["primary_cta"],
            "follow_up_promise": "",
            "output_mode": "copy_only",
            "claims": [],
        }
        self.write_json("build/page-copy.json", draft)
        self.write_json("build/client-copy-brief.json", brief)
        self.write_json(
            "build/copy-context.json",
            {
                "brief_sha256": self.digest("build/client-copy-brief.json"),
                "editorial_contract_version": 2,
            },
        )

        for name in process_contract.COPY_GATE_DOCS:
            minimum = process_contract.MINIMUM_MEANINGFUL_CHARACTERS[name]
            content = source_text if name == "RESEARCH-BRIEF.md" else "Synthetic researched evidence. "
            repeats = minimum // len(content) + 2
            (self.root / "docs" / name).write_text("# Fixture\n\n" + content * repeats)

        snapshot = copy_acceptance.prepare(
            self.root,
            "build/page-copy.json",
            "build/client-copy-brief.json",
            ["docs/RESEARCH-BRIEF.md"],
        )
        self.write_json("build/copy-review-inputs.json", snapshot)
        review = {
            "inputs_sha256": self.digest("build/copy-review-inputs.json"),
            "copy_sha256": self.digest("build/page-copy.json"),
            "brief_sha256": self.digest("build/client-copy-brief.json"),
            "context_sha256": self.digest("build/copy-context.json"),
            "reviewer": {
                "mode": "self_review",
                "identity": "Synthetic regression fixture, not editorial approval",
            },
            "decision": "pass",
            "unresolved_findings": [],
            "checks": [
                {
                    "criterion": criterion,
                    "verdict": "pass",
                    "evidence": {
                        "copy_excerpt": copy_text,
                        "brief_excerpt": brief_text,
                        "explanation": "Synthetic mechanical portability fixture.",
                        "source_refs": [{"id": "source1", "excerpt": source_text}],
                    },
                }
                for criterion in sorted(copy_acceptance.CRITERIA)
            ],
            "reader_summary": {
                key: {"answer": "Synthetic answer", "copy_excerpt": copy_text}
                for key in ("offer", "buyer_benefit", "reason_to_choose", "next_step")
            },
            "strongest_challenge": {
                "copy_excerpt": copy_text,
                "risk": "No exclusivity evidence.",
                "resolution": "The copy makes no exclusivity claim.",
                "status": "accepted_with_reason",
            },
        }
        self.write_json("build/copy-editorial-review.json", review)
        self.write_json(
            "funnel.json",
            {
                "approvals": {"copy_before_design": False},
                "catalogue": {"enabled": False},
                "images": {"enabled": False},
                "quality": {"complete_workflow": False},
            },
        )
        self.write_json("test-fixture.json", {"synthetic": True})
        self.write_json(
            "build/workflow.json",
            {
                "schema_version": 1,
                "approvals": {
                    "publish": {
                        "actor": "user",
                        "message": "Synthetic protocol fixture only",
                        "fingerprint": "synthetic",
                    }
                },
            },
        )
        gate_snapshot = {
            "schema_version": 1,
            "created_at": check_gates.now(),
            "mode": "handoff",
            **check_gates.source_snapshot(self.root),
        }
        self.write_json("build/gate-snapshot.json", gate_snapshot)

    def write_json(self, relative, value):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2) + "\n")

    def digest(self, relative):
        return hashlib.sha256((self.root / relative).read_bytes()).hexdigest()

    def test_standard_record_export_and_freeze_preserve_review_inputs(self):
        expected = self.digest("build/copy-review-inputs.json")
        recorded = subprocess.run(
            [
                sys.executable,
                str(SKILL / "scripts" / "workflow.py"),
                "record-copy-evidence",
                str(self.root),
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(recorded.returncode, 0, recorded.stdout + recorded.stderr)
        report = json.loads((self.root / "build/copy-audit.json").read_text())
        artifact = next(
            item for item in report["artifacts"]
            if item["path"] == "build/copy-review-inputs.json"
        )
        self.assertEqual(artifact["sha256"], expected)

        check_gates.record_report(self.root, "copy", "build/copy-audit.json")
        archive = Path(self.temp.name) / "handoff.zip"
        portable_handoff.export_bundle(
            self.root, archive, "Synthetic portability fixture", in_progress=True
        )
        extracted = Path(
            portable_handoff.extract_archive(
                archive, Path(self.temp.name) / "extracted"
            )["project"]
        )
        self.assertEqual(
            hashlib.sha256(
                (extracted / "build/copy-review-inputs.json").read_bytes()
            ).hexdigest(),
            expected,
        )
        self.assertIn(workflow.copy_state(extracted)["status"], {"pass", "pass_with_warnings"})

        def portable_copy_approval(root):
            current = workflow.copy_state(Path(root))
            return {
                "status": current["status"],
                "failures": current.get("failures", []),
            }

        with patch.object(
            workflow, "check_publish_approval", side_effect=portable_copy_approval
        ):
            release_state.freeze(self.root, RELEASE_ID, "test-fixture.json")
        frozen = self.root / "build/releases" / RELEASE_ID / "package"
        self.assertEqual(
            hashlib.sha256(
                (frozen / "build/copy-review-inputs.json").read_bytes()
            ).hexdigest(),
            expected,
        )


if __name__ == "__main__":
    unittest.main()
