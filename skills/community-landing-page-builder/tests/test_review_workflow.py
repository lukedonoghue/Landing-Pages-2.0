from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module

workflow = load_module("review_workflow", ROOT / "scripts/review_workflow.py")
validator = load_module("validate_reviews", ROOT / "scripts/validate_reviews.py")

def manifest():
    return {
        "schema_version": 1,
        "business": {"name": "Example", "website": "https://example.com"},
        "sources": [{
            "id": "owned",
            "provider": "first_party",
            "source_url": "https://example.com/reviews",
            "retrieved_at": "2026-09-22",
            "business_match": {"status": "matched", "evidence": ["domain"]},
            "terms": {
                "research_allowed": True,
                "publish_text_allowed": True,
                "publish_avatar_allowed": True,
                "attribution_required": False,
                "storage_policy": "project",
            },
        }],
        "reviews": [
            {
                "id": "r1", "source_id": "owned", "source_url": "https://example.com/reviews",
                "reviewer": {"display_name": "A Customer", "avatar": {"url": "https://example.com/a.jpg", "local_path": None, "provenance": "owned", "generated": False}},
                "rating": 5, "published_date": "2026-09-01",
                "text": "They explained every option clearly before we chose what to do.",
                "publication": {"status": "publishable_full", "rights_basis": "client-owned", "attribution_text": ""},
                "analysis": {
                    "problems": ["Unclear options"], "desired_outcomes": ["Understand choices"],
                    "buying_triggers": [], "objections_resolved": ["Decision uncertainty"],
                    "praised_capabilities": ["Clear explanation"], "practical_benefits": ["Informed decision"],
                    "emotional_benefits": [], "voice_phrases": ["explained every option clearly"],
                    "differentiator_signals": ["Clear explanation"], "testimonial_roles": ["clarity"], "proof_strength": 5,
                },
            },
            {
                "id": "r2", "source_id": "owned", "source_url": "https://example.com/reviews",
                "reviewer": {"display_name": "B Customer", "avatar": {"url": None, "local_path": None, "provenance": None, "generated": False}},
                "rating": 5, "published_date": "2026-09-02",
                "text": "The team kept us updated and always called back quickly.",
                "publication": {"status": "publishable_text", "rights_basis": "client-owned", "attribution_text": ""},
                "analysis": {
                    "problems": ["Poor communication"], "desired_outcomes": ["Know what is happening"],
                    "buying_triggers": [], "objections_resolved": [], "praised_capabilities": ["Responsive communication"],
                    "practical_benefits": ["Fewer unanswered questions"], "emotional_benefits": [],
                    "voice_phrases": ["always called back quickly"], "differentiator_signals": ["Responsive communication"],
                    "testimonial_roles": ["communication"], "proof_strength": 4,
                },
            },
        ],
    }

class ReviewWorkflowTests(unittest.TestCase):
    def test_aggregate_tracks_supporting_review_ids(self):
        data = manifest()
        result = workflow.aggregate(data, "abc")
        clarity = result["themes"]["praised_capabilities"][0]
        self.assertEqual(clarity["count"], 1)
        self.assertTrue(clarity["review_ids"])

    def test_selection_prefers_distinct_roles(self):
        data = manifest()
        result = workflow.select(data, "abc", 2)
        self.assertEqual({x["review_id"] for x in result["selected"]}, {"r1", "r2"})

    def test_generated_reviewer_avatar_blocks(self):
        data = manifest()
        data["reviews"][0]["reviewer"]["avatar"]["generated"] = True
        errors, _, _, _ = validator.validate_manifest(data)
        self.assertTrue(any("generated reviewer avatars" in e for e in errors))

    def test_rendered_quote_must_match_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "research/reviews").mkdir(parents=True)
            (root / "build").mkdir()
            data = manifest()
            (root / "research/reviews/review-manifest.json").write_text(json.dumps(data))
            (root / "build/rendered-testimonials.json").write_text(json.dumps({
                "testimonials": [{
                    "review_id": "r1",
                    "quote": "Totally different invented claim.",
                    "display_name": "A Customer",
                    "rating": 5,
                    "published_date": "2026-09-01",
                    "avatar": {"url": "https://example.com/a.jpg", "local_path": None, "generated": False},
                    "attribution_required": False,
                }]
            }))
            errors, _ = validator.validate_rendered(root, {x["id"]: x for x in data["reviews"]})
            self.assertTrue(any("quote is not" in e for e in errors))

    def test_duplicate_tags_do_not_inflate_independent_customer_support(self):
        data = manifest();data['reviews'][0]['analysis']['problems'] *= 3
        row = workflow.aggregate(data, 'abc')['themes']['problems'][0]
        self.assertEqual(row['count'], 1)
        self.assertEqual(row['review_ids'], ['r1'])

    def test_missing_rights_basis_blocks_publication(self):
        data = manifest();data['reviews'][0]['publication']['rights_basis'] = ''
        self.assertTrue(any('rights basis' in e for e in validator.validate_manifest(data)[0]))

    def test_required_attribution_cannot_be_disabled_by_rendered_data(self):
        data = manifest();source = data['sources'][0];source['terms']['attribution_required'] = True
        with tempfile.TemporaryDirectory() as d:
            root = Path(d);(root/'build').mkdir()
            item = {'review_id': 'r1', 'quote': data['reviews'][0]['text'], 'display_name': 'A Customer',
                    'attribution_required': False, 'source_id': 'unrelated', 'source_url': 'https://unrelated.invalid'}
            (root/'build/rendered-testimonials.json').write_text(json.dumps({'testimonials': [item]}))
            errors, _ = validator.validate_rendered(root, {r['id']: r for r in data['reviews']}, {'owned': source})
            self.assertTrue(any('required attribution' in e for e in errors))
            self.assertTrue(any('source URL' in e for e in errors))
            self.assertTrue(any('source identity' in e for e in errors))

    def test_rendered_acceptance_needs_evidence_and_a_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d);(root/'build').mkdir();(root/'research/reviews').mkdir(parents=True)
            (root/'research/reviews/review-manifest.json').write_text(json.dumps(manifest()))
            self.assertEqual(validator.validate_project(root, 'rendered')['status'], 'blocked')
            (root/'research/reviews/review-manifest.json').unlink()
            (root/'build/rendered-testimonials.json').write_text(json.dumps({'testimonials':[{'review_id':'invented'}]}))
            self.assertEqual(validator.validate_project(root, 'rendered')['status'], 'blocked')

    def test_nonmatched_source_must_be_blocked(self):
        data = manifest()
        data["sources"][0]["business_match"]["status"] = "ambiguous"
        errors, _, _, _ = validator.validate_manifest(data)
        self.assertTrue(any("non-matched source" in e for e in errors))

if __name__ == "__main__":
    unittest.main()
