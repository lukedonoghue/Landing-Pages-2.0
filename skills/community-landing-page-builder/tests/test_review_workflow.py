from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("review_workflow", SKILL / "scripts" / "review_workflow.py")
review_workflow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review_workflow)


def base_manifest():
    return {
        "schema_version": 1,
        "input_fingerprint": "business-v1",
        "business": {"name": "Synthetic Co", "website": "https://example.test/", "location": "Test City", "identity_evidence": ["Website and phone matched"]},
        "discovery": {
            "status": "complete",
            "searched_at": "2026-09-22T12:00:00+00:00",
            "sources_checked": [{"name": "Owner supplied review export", "url": "https://example.test/reviews", "identity_match": "matched"}],
            "notes": "Synthetic fixture only",
        },
        "providers": [{"id": "google-primary", "kind": "google_places", "enabled": False, "place_id": "", "source_url": "", "terms_checked_at": "", "display_notice": "Google reviews are shown in the order returned by Google; no additional filtering is applied."}],
        "reviews": [
            {
                "id": "r1",
                "source_kind": "user_supplied",
                "source_name": "Owner supplied review",
                "source_url": "https://example.test/reviews/r1",
                "business_identity": {"status": "matched", "evidence": ["Owner supplied for Synthetic Co"]},
                "reviewer": {"display_name": "Alex Example", "profile_url": "", "avatar": {"url": "", "local_path": "", "provenance": "", "display_allowed": False}},
                "review": {"rating": 5, "published_at": "2026-08-01T00:00:00+00:00", "text": "They explained every option clearly before we decided.", "language": "en"},
                "permissions": {"analysis_allowed": True, "publication_status": "publishable_text", "rights_basis": "Owner supplied with permission for marketing reuse", "storage_mode": "project"},
                "analysis": {
                    "problems": ["Unclear options"],
                    "desired_outcomes": ["Confidence before committing"],
                    "buying_triggers": ["Needed expert guidance"],
                    "praised_capabilities": ["Clear explanations"],
                    "practical_benefits": ["Understand options before deciding"],
                    "emotional_benefits": ["More confidence"],
                    "objections_resolved": ["Fear of choosing the wrong option"],
                    "differentiator_signals": ["Explains options clearly before commitment"],
                    "voice_phrases": ["explained every option clearly"],
                    "testimonial_roles": ["clarity"],
                    "proof_strength": 5,
                },
            }
        ],
    }


class ReviewWorkflowTests(unittest.TestCase):
    def project(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / "research/reviews").mkdir(parents=True)
        (root / "build").mkdir()
        (root / "public/assets").mkdir(parents=True)
        (root / "funnel.json").write_text(json.dumps({"quality": {"review_intelligence_version": 1}, "client": {"name": "Synthetic Co", "website": "https://example.test/"}}))
        return root

    def write_manifest(self, root, value=None):
        (root / review_workflow.MANIFEST).write_text(json.dumps(value or base_manifest(), indent=2))

    def test_compile_aggregates_rights_cleared_analysis_and_selects_exact_quote(self):
        root = self.project(); self.write_manifest(root)
        result = review_workflow.compile_project(root, "business-v1")
        self.assertEqual(result["static_count"], 1)
        insights = json.loads((root / review_workflow.INSIGHTS).read_text())
        self.assertEqual(insights["themes"]["praised_capabilities"][0]["text"], "Clear explanations")
        selection = json.loads((root / review_workflow.SELECTION).read_text())
        self.assertEqual(selection["static_testimonials"][0]["quote"], "They explained every option clearly before we decided.")

    def test_google_maps_review_content_cannot_be_stored_as_a_review(self):
        root = self.project()
        value = base_manifest()
        value["reviews"][0]["source_kind"] = "google_places"
        self.write_manifest(root, value)
        result = review_workflow.validate_manifest(root, "business-v1")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("Google belongs in providers" in item for item in result["errors"]))

    def test_enabled_google_provider_is_dynamic_and_requires_terms_metadata(self):
        root = self.project()
        value = base_manifest()
        value["providers"][0].update(enabled=True, place_id="ChIJSynthetic", source_url="https://maps.google.com/?cid=1", terms_checked_at="2026-09-22T12:00:00+00:00")
        self.write_manifest(root, value)
        review_workflow.compile_project(root, "business-v1")
        selection = json.loads((root / review_workflow.SELECTION).read_text())
        self.assertEqual(selection["dynamic_providers"][0]["mode"], "provider_dynamic")

    def test_mismatched_business_blocks_review_use(self):
        root = self.project()
        value = base_manifest()
        value["reviews"][0]["business_identity"]["status"] = "ambiguous"
        self.write_manifest(root, value)
        result = review_workflow.validate_manifest(root, "business-v1")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("exact business" in item for item in result["errors"]))

    def test_publishable_full_requires_approved_matching_avatar(self):
        root = self.project()
        value = base_manifest()
        value["reviews"][0]["permissions"]["publication_status"] = "publishable_full"
        self.write_manifest(root, value)
        result = review_workflow.validate_manifest(root, "business-v1")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("approved reviewer avatar" in item for item in result["errors"]))

    def test_compiled_selection_cannot_be_tampered_without_manifest_change(self):
        root = self.project(); self.write_manifest(root); review_workflow.compile_project(root, "business-v1")
        selection_path = root / review_workflow.SELECTION
        selection = json.loads(selection_path.read_text())
        selection["static_testimonials"][0]["reviewer_name"] = "Different person"
        selection_path.write_text(json.dumps(selection))
        result = review_workflow.audit_project(root, "business-v1", rendered=False)
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("differs from the current source records" in item for item in result["failures"]))

    def test_publishable_full_local_avatar_is_hash_bound(self):
        root = self.project()
        value = base_manifest()
        avatar = root / "assets/reviews/alex.webp"; avatar.parent.mkdir(parents=True); avatar.write_bytes(b"synthetic-avatar")
        value["reviews"][0]["permissions"]["publication_status"] = "publishable_full"
        value["reviews"][0]["reviewer"]["avatar"] = {"url":"","local_path":"assets/reviews/alex.webp","sha256":review_workflow.sha(avatar),"provenance":"Owner supplied with marketing permission","display_allowed":True}
        self.write_manifest(root, value)
        self.assertNotEqual(review_workflow.validate_manifest(root, "business-v1")["status"], "blocked")
        avatar.write_bytes(b"changed")
        self.assertEqual(review_workflow.validate_manifest(root, "business-v1")["status"], "blocked")

    def test_rendered_static_testimonial_must_keep_id_quote_name_and_source(self):
        root = self.project(); self.write_manifest(root); review_workflow.compile_project(root, "business-v1")
        (root / "public/index.html").write_text(
            '<main><article data-testimonial-id="r1" data-testimonial-source="Owner supplied review">'
            '<blockquote>They explained every option clearly before we decided.</blockquote>'
            '<p>Alex Example</p><p>Owner supplied review</p><p>5 / 5</p></article></main>'
        )
        result = review_workflow.audit_project(root, "business-v1", rendered=True)
        self.assertNotEqual(result["status"], "blocked")
        (root / "public/index.html").write_text("<main>No proof</main>")
        result = review_workflow.audit_project(root, "business-v1", rendered=True)
        self.assertEqual(result["status"], "blocked")

    def test_google_widget_uses_provider_runtime_and_author_attribution_fields(self):
        script = (SKILL / "assets/google-reviews-widget.js").read_text()
        self.assertIn('google.maps.importLibrary("places")', script)
        self.assertIn("authorAttribution", script)
        self.assertIn("photoURI", script)
        self.assertIn("googleMapsURI", script)
        self.assertIn("Google Maps", script)
        self.assertNotIn("localStorage", script)
        self.assertNotIn("indexedDB", script)


if __name__ == "__main__":
    unittest.main()
