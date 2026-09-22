"""Offline image workflow regressions; no model calls and no external downloads."""
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

SKILL = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("image_workflow", SKILL / "scripts/image_workflow.py")
workflow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(workflow)


def png(width=1200, height=800, color=(50, 120, 70)):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    rows = (b"\0" + bytes(color) * width) * height
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


class ImageWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name).resolve()
        (self.root / "public").mkdir()
        self.plan = json.loads((SKILL / "assets/image-plan.example.json").read_text())
        self.plan["minimum_distinct_content_originals"] = 1
        self.plan["assets"] = self.plan["assets"][:1]
        self.image_id = self.plan["assets"][0]["id"]
        self.supplied = self.root / "supplied.png"
        self.supplied.write_bytes(png())
        self.evidence = self.root / "source-instruction.txt"
        self.evidence.write_text("Client supplied this photo of their real land-clearing project and authorized its use.")
        self.plan["content_minimum_exception"] = {"reason": "Focused one-asset workflow fixture, not a complete page.", "evidence": workflow.artifact(self.root, self.evidence)}
        self.plan["inventory"] = [{"id": "supplied-1", "local_file": str(self.supplied), "source_sha256": workflow.sha(self.supplied.read_bytes()), "origin": "client-supplied", "evidence": workflow.artifact(self.root, self.evidence)}]

    def tearDown(self):
        self.temporary.cleanup()

    def acquire(self):
        return workflow.acquire(self.plan, self.root, self.image_id, "supplied-1", "client-provided", "source-instruction.txt", "Client identifies this as its project")

    def allow_generation(self):
        item = self.plan["assets"][0]
        item["trust_class"] = "illustrative"
        item["allow_generation"] = True
        item["generation"] = {"requested_model": "gpt-image-2.5-sunburst", "allow_unverified_native_model": False, "allow_source_fallback": True}
        return item

    def allow_cli(self):
        item = self.allow_generation()
        item["generation"].update({"mode": "bundled-cli", "authorization_evidence": "User explicitly selected the CLI/API path to request exact GPT Image 2.5."})
        cli = self.root / "installed/imagegen/scripts/image_gen.py"
        cli.parent.mkdir(parents=True, exist_ok=True)
        # Deliberately not executable: a metadata fixture for inspecting accepted controls.
        cli.write_text('"--model" "--prompt-file" "--out" "--dry-run"\nGPT_IMAGE_MODEL_PREFIX\ndef _validate_model(model):\n')
        return cli

    def cli_fixture_run(self):
        cli = self.allow_cli()
        prepared = workflow.prepare_generation(self.plan, self.image_id, "Editorial illustration", root=self.root, imagegen_cli=cli)
        attempt = self.plan["generation_attempts"][-1]
        output = self.root / attempt["output_path"]
        output.write_bytes(png())
        evidence = self.root / "cli-execution.json"
        recorded = {"mode": "bundled-cli", "argv": prepared["argv"], "exit_code": 0, "dry_run": False, "api_call_completed": True, "requested_model": prepared["requested_model"], "output_sha256": workflow.sha(output.read_bytes()), "reported_model": None}
        evidence.write_text(json.dumps(recorded))
        return prepared, output, evidence, recorded

    def create_review(self):
        item = self.plan["assets"][0]
        report = {"reviewer": "Automated fixture exercising evidence validation, not a client visual review", "source_sha256": item["source"]["sha256"], "variant_sha256": {v["path"]: v["sha256"] for v in item["variants"]}}
        for device, width in (("desktop", 1200), ("mobile", 390)):
            screenshot = self.root / (device + ".png")
            screenshot.write_bytes(png(width, 900, (90, 40, 120)))
            report[device] = {"screenshot": screenshot.name, "viewport": {"width": width, "height": 900}, "served_variant": item["variants"][0]["path"], "subject_visible": True, "crop_appropriate": True, "alt_appropriate": True, "no_false_claim": True, "page_layout_checked": True}
        report_path = self.root / "image-review.json"
        report_path.write_text(json.dumps(report))
        return report_path, report

    def test_example_validates(self):
        workflow.validate_plan(self.plan)

    def test_new_plan_requires_explicit_lineage_and_documented_minimum_exception(self):
        item = self.plan["assets"][0]
        del item["source_original_ids"]
        with self.assertRaisesRegex(workflow.WorkflowError, "explicitly record"):
            workflow.validate_plan(self.plan)
        item["source_original_ids"] = [item["id"]]
        del self.plan["content_minimum_exception"]
        with self.assertRaisesRegex(workflow.WorkflowError, "documented existing scope exception"):
            workflow.validate_plan(self.plan)

    def test_proof_cannot_be_enabled_for_generation(self):
        self.plan["assets"][0]["allow_generation"] = True
        with self.assertRaisesRegex(workflow.WorkflowError, "never generated"):
            workflow.validate_plan(self.plan)

    def test_proof_generation_rejected_even_if_manifest_changed(self):
        with self.assertRaisesRegex(workflow.WorkflowError, "Never generate"):
            workflow.prepare_generation(self.plan, self.image_id, "Fake successful project")

    def test_source_requires_specific_proof_evidence(self):
        with self.assertRaisesRegex(workflow.WorkflowError, "require evidence"):
            workflow.acquire(self.plan, self.root, self.image_id, "supplied-1", "client-provided", "authorized")

    def test_reference_images_are_not_client_proof(self):
        self.plan["inventory"][0]["origin"] = "reference-website"
        with self.assertRaisesRegex(workflow.WorkflowError, "client source"):
            self.acquire()

    def test_source_record_and_non_overwrite(self):
        first = self.acquire()
        second = self.acquire()
        self.assertEqual(first, second)
        self.assertEqual(self.plan["assets"][0]["provenance"]["kind"], "actual")
        self.assertEqual(first["width"], 1200)
        self.assertEqual(first["sha256"], workflow.sha(self.supplied.read_bytes()))
        (self.root / first["path"]).write_bytes(b"modified by someone else")
        with self.assertRaisesRegex(workflow.WorkflowError, "Refusing to overwrite"):
            self.acquire()

    def test_changed_supplied_asset_blocks(self):
        self.supplied.write_bytes(png(color=(255, 0, 0)))
        with self.assertRaisesRegex(workflow.WorkflowError, "changed since inventory"):
            self.acquire()

    def test_html_inventory_only_observed_urls(self):
        parser = workflow.ImageInventory("https://client.example/services/")
        parser.feed('<img src="../real.jpg" srcset="/small.webp 480w, https://cdn.example/big.webp 1600w" alt="actual"><img src="data:image/png;base64,AA"><script src="/script.js"></script>')
        self.assertEqual([i["source_url"] for i in parser.images], ["https://client.example/real.jpg", "https://client.example/small.webp", "https://cdn.example/big.webp"])

    def test_payload_has_only_supported_native_arguments(self):
        self.allow_generation()
        output = workflow.prepare_generation(self.plan, self.image_id, "Editorial illustration of the service process")
        self.assertEqual(set(output["arguments"]), {"prompt"})
        self.assertNotIn("model", output["arguments"])
        self.assertEqual(output["requested_model"], "gpt-image-2.5-sunburst")
        self.assertEqual(self.plan["assets"][0]["stage"], "generation-pending")
        self.assertFalse(workflow.gate(self.plan, self.root)["passed"])

    def test_pending_attempt_cannot_duplicate(self):
        self.allow_generation()
        workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        with self.assertRaisesRegex(workflow.WorkflowError, "pending generation"):
            workflow.prepare_generation(self.plan, self.image_id, "Try again")

    def test_failed_attempts_still_consume_budget(self):
        self.allow_generation()
        self.plan["generation_budget"]["max_attempts_per_asset"] = 1
        workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        self.plan["generation_attempts"][0]["status"] = "failed"
        with self.assertRaisesRegex(workflow.WorkflowError, "attempt budget exhausted"):
            workflow.prepare_generation(self.plan, self.image_id, "Try again")

    def test_generated_asset_and_total_budget(self):
        self.allow_generation()
        self.plan["generation_budget"]["max_assets"] = 0
        with self.assertRaisesRegex(workflow.WorkflowError, "asset budget exhausted"):
            workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        self.plan["generation_budget"]["max_assets"] = 1
        self.plan["generation_budget"]["max_total_attempts"] = 0
        with self.assertRaisesRegex(workflow.WorkflowError, "Total generation"):
            workflow.prepare_generation(self.plan, self.image_id, "Illustration")

    def test_generation_missing_file_never_completes(self):
        self.allow_generation()
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        with self.assertRaisesRegex(workflow.WorkflowError, "no output file"):
            workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.root / "missing.png", self.evidence)
        self.assertEqual(self.plan["generation_attempts"][0]["status"], "pending")

    def test_model_mismatch_is_not_silently_accepted(self):
        self.allow_generation()
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        with self.assertRaisesRegex(workflow.WorkflowError, "differs from the requested"):
            workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.supplied, self.evidence, "gpt-image-2.5-flare")

    def test_reported_model_must_appear_in_tool_evidence(self):
        self.allow_generation()
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        with self.assertRaisesRegex(workflow.WorkflowError, "absent from the tool-result"):
            workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.supplied, self.evidence, "gpt-image-2.5-sunburst")

    def test_native_unknown_model_is_recorded_honestly(self):
        self.allow_generation()
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.supplied, self.evidence)
        provenance = self.plan["assets"][0]["provenance"]
        self.assertEqual(provenance["model_verification"], "unverified")
        self.assertIsNone(provenance["actual_model"])
        self.assertEqual(self.plan["generation_attempts"][0]["status"], "registered")

    def test_unverified_model_exception_needs_user_evidence(self):
        item = self.allow_generation()
        item["generation"]["allow_unverified_native_model"] = True
        with self.assertRaisesRegex(workflow.WorkflowError, "user instruction"):
            workflow.validate_plan(self.plan)

    def test_native_default_does_not_invent_a_requested_model(self):
        item = self.allow_generation()
        item["generation"] = {"mode": "native"}
        workflow.validate_plan(self.plan)
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        self.assertIsNone(attempt["requested_model"])
        workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.supplied, self.evidence)
        self.assertIsNone(item["provenance"]["actual_model"])

    @unittest.skipUnless(shutil.which("cwebp"), "cwebp is required for real optimization")
    def test_native_default_unreported_model_allows_real_rendered_review(self):
        item = self.allow_generation()
        item["generation"] = {"mode": "native"}
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.supplied, self.evidence)
        workflow.optimize(self.plan, self.root, self.image_id)
        report_path, _ = self.create_review()
        review = workflow.review_asset(self.plan, self.root, self.image_id, report_path)
        self.assertIn("model was not reported", review["result"]["warnings"][0])
        self.assertTrue(workflow.gate(self.plan, self.root)["passed"])
        self.plan["generation_attempts"][0]["requested_model"] = "gpt-image-2.5-sunburst"
        with self.assertRaisesRegex(workflow.WorkflowError, "exact GPT Image 2.5 remains unverified"):
            workflow.review_asset(self.plan, self.root, self.image_id, report_path)

    def test_fallback_requires_plan_permission(self):
        item = self.allow_generation()
        item["stage"] = "generation-failed"
        item["generation"]["allow_source_fallback"] = False
        with self.assertRaisesRegex(workflow.WorkflowError, "fallback after generation failure"):
            self.acquire()

    def test_unsafe_or_mislabelled_raster_rejected(self):
        for data in (b'<svg xmlns="http://www.w3.org/2000/svg"/>', b"<html>not an image</html>", b"\x89PNG\r\n\x1a\n"):
            with self.assertRaises(workflow.WorkflowError):
                workflow.image_info(data)
        with self.assertRaisesRegex(workflow.WorkflowError, "megapixels"):
            huge = png(1, 1)
            workflow.image_info(huge[:16] + struct.pack(">II", 99999, 99999) + huge[24:])

    def test_project_path_cannot_escape(self):
        with self.assertRaisesRegex(workflow.WorkflowError, "inside the project"):
            workflow.safe_path(self.root, "../secret.png")

    def test_empty_plan_cannot_bypass_complete_page_image_minimum(self):
        self.plan["assets"] = []
        self.assertFalse(workflow.gate(self.plan, self.root)["passed"])
        self.plan["no_images_reason"] = "A text-only campaign was explicitly requested."
        result = workflow.gate(self.plan, self.root)
        self.assertFalse(result["passed"])
        self.assertTrue(any("required 1" in error for error in result["errors"]))

    def test_derived_document_preview_does_not_create_a_fourth_original(self):
        self.plan["minimum_distinct_content_originals"] = 4
        self.plan["assets"] = []
        for image_id in ("hero", "records", "consultation"):
            self.plan["assets"].append({
                "id": image_id, "trust_class": "illustrative", "required": True,
                "counts_toward_content_minimum": True, "source_original_ids": [image_id],
            })
        self.plan["assets"].append({
            "id": "guide-cover", "trust_class": "illustrative", "required": True,
            "counts_toward_content_minimum": False, "source_original_ids": ["hero"],
        })
        result = workflow.gate(self.plan, self.root)
        self.assertFalse(result["passed"])
        self.assertEqual(result["distinct_content_original_count"], 3)
        self.assertTrue(any("required 4" in error for error in result["errors"]))

    def test_identical_source_bytes_cannot_claim_different_original_ids(self):
        self.acquire()
        duplicate = dict(self.plan["assets"][0])
        duplicate.update({"id": "same-photo-renamed", "source_original_ids": ["invented-second-original"]})
        self.plan["assets"].append(duplicate)
        result = workflow.gate(self.plan, self.root)
        self.assertTrue(any("conflicting source_original_ids" in error for error in result["errors"]), result)

    @unittest.skipUnless(shutil.which("cwebp"), "cwebp is required for real optimization")
    def test_full_source_optimize_review_and_stale_gate(self):
        self.acquire()
        variants = workflow.optimize(self.plan, self.root, self.image_id)
        self.assertEqual([v["width"] for v in variants], [480, 960, 1200])
        report_path, _ = self.create_review()
        workflow.review_asset(self.plan, self.root, self.image_id, report_path)
        self.assertTrue(workflow.gate(self.plan, self.root)["passed"])
        (self.root / variants[0]["path"]).write_bytes(b"stale")
        self.assertFalse(workflow.gate(self.plan, self.root)["passed"])

    @unittest.skipUnless(shutil.which("cwebp"), "cwebp is required for real optimization")
    def test_missing_mobile_review_or_changed_screenshot_fails(self):
        self.acquire()
        workflow.optimize(self.plan, self.root, self.image_id)
        report_path, report = self.create_review()
        report["mobile"]["crop_appropriate"] = False
        report_path.write_text(json.dumps(report))
        with self.assertRaisesRegex(workflow.WorkflowError, "crop_appropriate"):
            workflow.review_asset(self.plan, self.root, self.image_id, report_path)
        report["mobile"]["crop_appropriate"] = True
        report_path.write_text(json.dumps(report))
        workflow.review_asset(self.plan, self.root, self.image_id, report_path)
        (self.root / "mobile.png").write_bytes(png(390, 900, (255, 0, 0)))
        self.assertFalse(workflow.gate(self.plan, self.root)["passed"])

    @unittest.skipUnless(shutil.which("cwebp"), "cwebp is required for real optimization")
    def test_file_weights_are_checked_against_real_bytes(self):
        self.acquire()
        workflow.optimize(self.plan, self.root, self.image_id)
        report_path, _ = self.create_review()
        self.plan["assets"][0]["max_bytes"]["mobile"] = 1
        with self.assertRaisesRegex(workflow.WorkflowError, "byte budget"):
            workflow.review_asset(self.plan, self.root, self.image_id, report_path)

    @unittest.skipUnless(shutil.which("cwebp"), "cwebp is required for real optimization")
    def test_unknown_native_model_blocks_exact_model_review(self):
        self.allow_generation()
        attempt = workflow.prepare_generation(self.plan, self.image_id, "Illustration")
        workflow.register_generation(self.plan, self.root, self.image_id, attempt["attempt_id"], self.supplied, self.evidence)
        workflow.optimize(self.plan, self.root, self.image_id)
        report_path, _ = self.create_review()
        with self.assertRaisesRegex(workflow.WorkflowError, "exact GPT Image 2.5 remains unverified"):
            workflow.review_asset(self.plan, self.root, self.image_id, report_path)

    def test_cli_dry_run_does_not_reserve_budget(self):
        self.allow_generation()
        path = self.root / "image-plan.json"
        path.write_text(json.dumps(self.plan))
        original = path.read_bytes()
        prompt = self.root / "prompt.txt"
        prompt.write_text("Editorial illustration")
        result = subprocess.run([sys.executable, str(SKILL / "scripts/image_workflow.py"), "--plan", str(path), "prepare-generation", "--id", self.image_id, "--prompt-file", str(prompt), "--dry-run"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["dry_run"])
        self.assertEqual(path.read_bytes(), original)

    def test_bundled_cli_requires_explicit_mode_and_evidence(self):
        cli = self.allow_cli()
        self.plan["assets"][0]["generation"].pop("mode")
        with self.assertRaisesRegex(workflow.WorkflowError, "not authorization"):
            workflow.prepare_generation(self.plan, self.image_id, "Illustration", root=self.root, imagegen_cli=cli)
        self.plan["assets"][0]["generation"]["mode"] = "bundled-cli"
        self.plan["assets"][0]["generation"]["authorization_evidence"] = ""
        with self.assertRaisesRegex(workflow.WorkflowError, "explicit CLI/API/model-path authorization"):
            workflow.prepare_generation(self.plan, self.image_id, "Illustration", root=self.root, imagegen_cli=cli)
        with self.assertRaisesRegex(workflow.WorkflowError, "explicit CLI/API/model-path authorization"):
            workflow.validate_plan(self.plan)

    def test_bundled_cli_exact_model_payload_no_execution_or_secret(self):
        cli = self.allow_cli()
        self.plan["assets"][0]["generation"]["requested_model"] = "gpt-image-2.5-flare"
        output = workflow.prepare_generation(self.plan, self.image_id, "Editorial illustration", root=self.root, imagegen_cli=cli)
        argv = output["argv"]
        self.assertEqual(argv[argv.index("--model") + 1], "gpt-image-2.5-flare")
        self.assertEqual(argv[:3], [sys.executable, str(cli), "generate"])
        self.assertFalse(output["executed"])
        self.assertNotIn("OPENAI_API_KEY", json.dumps(argv))
        self.assertNotIn("--force", argv)
        for flag in ("--prompt-file", "--out"):
            self.assertTrue(Path(argv[argv.index(flag) + 1]).is_relative_to(self.root))
        self.assertTrue(Path(argv[argv.index("--prompt-file") + 1]).is_file())
        self.assertFalse(Path(argv[argv.index("--out") + 1]).exists())
        self.assertEqual(cli.read_text(), '"--model" "--prompt-file" "--out" "--dry-run"\nGPT_IMAGE_MODEL_PREFIX\ndef _validate_model(model):\n')

    def test_bundled_cli_output_cannot_escape_project_via_symlink(self):
        cli = self.allow_cli()
        with tempfile.TemporaryDirectory() as outside:
            (self.root / "output").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(workflow.WorkflowError, "inside the project"):
                workflow.prepare_generation(self.plan, self.image_id, "Illustration", root=self.root, imagegen_cli=cli)
        self.assertEqual(self.plan["generation_attempts"], [])

    def test_bundled_cli_rejects_other_runner_or_unknown_model(self):
        cli = self.allow_cli()
        wrong = cli.with_name("custom_runner.py")
        wrong.write_text(cli.read_text())
        with self.assertRaisesRegex(workflow.WorkflowError, "not a custom runner"):
            workflow.prepare_generation(self.plan, self.image_id, "Illustration", root=self.root, imagegen_cli=wrong)
        self.plan["assets"][0]["generation"]["requested_model"] = "gpt-image-1.5"
        with self.assertRaisesRegex(workflow.WorkflowError, "requested GPT Image 2.5"):
            workflow.prepare_generation(self.plan, self.image_id, "Illustration", root=self.root, imagegen_cli=cli)

    def test_bundled_cli_success_records_selection_not_provider_attestation(self):
        prepared, output, evidence, _ = self.cli_fixture_run()
        workflow.register_generation(self.plan, self.root, self.image_id, prepared["attempt_id"], output, evidence)
        value = self.plan["assets"][0]["provenance"]
        self.assertEqual(value["tool"], "imagegen-bundled-cli")
        self.assertEqual(value["provider"], "openai-api")
        self.assertEqual(value["selected_model"], "gpt-image-2.5-sunburst")
        self.assertIsNone(value["actual_model"])
        self.assertEqual(value["model_verification"], "selected-in-cli-request")

    def test_bundled_cli_rejects_dry_run_or_wrong_argv_evidence(self):
        prepared, output, evidence, recorded = self.cli_fixture_run()
        recorded["dry_run"] = True
        evidence.write_text(json.dumps(recorded))
        with self.assertRaisesRegex(workflow.WorkflowError, "non-dry-run"):
            workflow.register_generation(self.plan, self.root, self.image_id, prepared["attempt_id"], output, evidence)
        recorded["dry_run"] = False
        recorded["argv"] = recorded["argv"] + ["--model", "gpt-image-1.5"]
        evidence.write_text(json.dumps(recorded))
        with self.assertRaisesRegex(workflow.WorkflowError, "exact prepared argv"):
            workflow.register_generation(self.plan, self.root, self.image_id, prepared["attempt_id"], output, evidence)

    def test_bundled_cli_rejects_wrong_file_hash_and_model_attestation(self):
        prepared, output, evidence, recorded = self.cli_fixture_run()
        recorded["output_sha256"] = "0" * 64
        evidence.write_text(json.dumps(recorded))
        with self.assertRaisesRegex(workflow.WorkflowError, "different output bytes"):
            workflow.register_generation(self.plan, self.root, self.image_id, prepared["attempt_id"], output, evidence)
        recorded["output_sha256"] = workflow.sha(output.read_bytes())
        recorded["reported_model"] = "gpt-image-2.5-flare"
        evidence.write_text(json.dumps(recorded))
        with self.assertRaisesRegex(workflow.WorkflowError, "Provider reported a different model"):
            workflow.register_generation(self.plan, self.root, self.image_id, prepared["attempt_id"], output, evidence)
        recorded["reported_model"] = None
        evidence.write_text(json.dumps(recorded))
        with self.assertRaisesRegex(workflow.WorkflowError, "not provider attestation"):
            workflow.register_generation(self.plan, self.root, self.image_id, prepared["attempt_id"], output, evidence, "gpt-image-2.5-sunburst")

    def test_bundled_cli_dry_run_does_not_write_prompt_or_call_cli(self):
        cli = self.allow_cli()
        output = workflow.prepare_generation(self.plan, self.image_id, "Illustration", root=self.root, imagegen_cli=cli, dry_run=True)
        self.assertFalse((self.root / "output").exists())
        self.assertFalse((self.root / "research").exists())
        self.assertFalse(output["executed"])


class DownloadTests(unittest.TestCase):
    @staticmethod
    def resolver(host, port, **kwargs):
        return [(2, 1, 6, "", ("93.184.216.34", port))]

    def test_exact_allowlist_and_https(self):
        with self.assertRaisesRegex(workflow.WorkflowError, "allowlisted"):
            workflow.validate_url("https://evil.example/x.png", ["client.example"], self.resolver)
        for url in ("http://client.example/x.png", "https://user:pass@client.example/x.png", "https://client.example:444/x.png"):
            with self.assertRaises(workflow.WorkflowError):
                workflow.validate_url(url, ["client.example"], self.resolver)

    def test_private_dns_blocked_before_connection(self):
        for address in ("127.0.0.1", "10.0.0.1", "169.254.169.254", "224.0.0.1", "::1", "fc00::1", "ff00::1"):
            resolver = lambda *args, **kwargs: [(2, 1, 6, "", (address, 443))]
            with self.assertRaisesRegex(workflow.WorkflowError, "non-public"):
                workflow.validate_url("https://client.example/x.png", ["client.example"], resolver)

    def factory(self, responses):
        class Connection:
            def __init__(inner, host, address):
                self.assertEqual(address, "93.184.216.34")
                inner.response = responses.pop(0)
            def request(inner, *args, **kwargs):
                pass
            def getresponse(inner):
                return inner.response
            def close(inner):
                pass
        return Connection

    @staticmethod
    def response(status=200, headers=None, body=None):
        class Response:
            def getheader(self, name):
                return (headers or {}).get(name)
            def read(self, limit):
                return (body or b"")[:limit]
        value = Response()
        value.status = status
        return value

    def test_valid_download_checks_bytes_and_mime(self):
        body = png(32, 32)
        responses = [self.response(headers={"Content-Type": "image/png", "Content-Length": str(len(body))}, body=body)]
        data, final_url = workflow.fetch_image("https://client.example/photo.png", ["client.example"], self.resolver, self.factory(responses))
        self.assertEqual(data, body)
        self.assertEqual(final_url, "https://client.example/photo.png")

    def test_redirect_revalidates_allowlist(self):
        responses = [self.response(302, {"Location": "https://evil.example/photo.png"})]
        with self.assertRaisesRegex(workflow.WorkflowError, "allowlisted"):
            workflow.fetch_image("https://client.example/photo.png", ["client.example"], self.resolver, self.factory(responses))

    def test_server_mime_cannot_disguise_html_or_other_format(self):
        for headers, body in (({"Content-Type": "image/png"}, b"<html>error</html>"), ({"Content-Type": "image/jpeg"}, png(32, 32)), ({"Content-Type": "text/html"}, png(32, 32))):
            with self.assertRaises(workflow.WorkflowError):
                workflow.fetch_image("https://client.example/photo.png", ["client.example"], self.resolver, self.factory([self.response(headers=headers, body=body)]))

    def test_oversized_response_is_rejected(self):
        headers = {"Content-Type": "image/png", "Content-Length": str(workflow.MAX_BYTES + 1)}
        with self.assertRaisesRegex(workflow.WorkflowError, "too large"):
            workflow.fetch_image("https://client.example/photo.png", ["client.example"], self.resolver, self.factory([self.response(headers=headers, body=png(1, 1))]))


if __name__ == "__main__":
    unittest.main()
