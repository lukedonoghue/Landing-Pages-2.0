#!/usr/bin/env python3
"""Aggregate review intelligence and select publishable testimonial candidates."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ANALYSIS_FIELDS = (
    "problems", "desired_outcomes", "buying_triggers", "objections_resolved",
    "praised_capabilities", "practical_benefits", "emotional_benefits",
    "voice_phrases", "differentiator_signals", "testimonial_roles",
)

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def source_map(manifest):
    return {item["id"]: item for item in manifest.get("sources", [])}

def matched_reviews(manifest):
    sources = source_map(manifest)
    for review in manifest.get("reviews", []):
        source = sources.get(review.get("source_id"))
        if not source:
            continue
        if source.get("business_match", {}).get("status") != "matched":
            continue
        if not source.get("terms", {}).get("research_allowed", False):
            continue
        if review.get("publication", {}).get("status") == "blocked":
            continue
        yield review

def aggregate(manifest, manifest_sha):
    reviews = list(matched_reviews(manifest))
    themes = {}
    for field in ANALYSIS_FIELDS:
        counts = Counter()
        support = defaultdict(list)
        for review in reviews:
            for value in dict.fromkeys(review.get("analysis", {}).get(field, []) or []):
                key = str(value).strip()
                if not key:
                    continue
                counts[key] += 1
                support[key].append(review.get("id"))
        themes[field] = [
            {"value": value, "count": count, "review_ids": support[value]}
            for value, count in counts.most_common()
        ]

    return {
        "schema_version": 1,
        "review_manifest_sha256": manifest_sha,
        "review_count": len(reviews),
        "themes": themes,
        "instructions": (
            "Use repeated review themes to understand customer language and valued capabilities. "
            "Do not convert aggregate or paraphrased findings into testimonial quotations. "
            "Uniqueness and comparative claims require separate comparable evidence."
        ),
    }

def candidate_score(review):
    analysis = review.get("analysis", {})
    strength = analysis.get("proof_strength", 0)
    try:
        strength = max(0, min(5, int(strength)))
    except (TypeError, ValueError):
        strength = 0
    text = (review.get("text") or "").strip()
    specificity = 2 if len(text) >= 80 else 1 if len(text) >= 35 else 0
    roles = len(set(analysis.get("testimonial_roles", []) or []))
    return strength * 10 + specificity + min(roles, 3)

def select(manifest, manifest_sha, limit=4):
    eligible = []
    for review in matched_reviews(manifest):
        state = review.get("publication", {}).get("status")
        if state not in {"publishable_text", "publishable_full"}:
            continue
        if not (review.get("text") or "").strip():
            continue
        roles = list(dict.fromkeys(review.get("analysis", {}).get("testimonial_roles", []) or []))
        eligible.append((candidate_score(review), review, roles))

    eligible.sort(key=lambda item: (-item[0], item[1].get("id", "")))
    selected = []
    used_roles = set()

    for score, review, roles in eligible:
        if len(selected) >= limit:
            break
        if roles and any(role not in used_roles for role in roles):
            selected.append((score, review, roles))
            used_roles.update(roles)

    selected_ids = {review.get("id") for _, review, _ in selected}
    for score, review, roles in eligible:
        if len(selected) >= limit:
            break
        if review.get("id") in selected_ids:
            continue
        selected.append((score, review, roles))
        selected_ids.add(review.get("id"))
        used_roles.update(roles)

    return {
        "schema_version": 1,
        "review_manifest_sha256": manifest_sha,
        "selection_policy": "Prefer exact-match publishable reviews with strong proof and distinct testimonial roles.",
        "selected": [
            {
                "review_id": review.get("id"),
                "source_id": review.get("source_id"),
                "publication_status": review.get("publication", {}).get("status"),
                "testimonial_roles": roles,
                "score": score,
            }
            for score, review, roles in selected
        ],
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["analyze", "select", "all"])
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--limit", type=int, default=4)
    args = parser.parse_args()

    root = args.project_root.expanduser().resolve()
    manifest_path = root / "research/reviews/review-manifest.json"
    if not manifest_path.exists():
        raise SystemExit("Missing research/reviews/review-manifest.json")
    manifest = load(manifest_path)
    manifest_sha = sha(manifest_path)

    outputs = {}
    if args.command in {"analyze", "all"}:
        out = root / "build/review-insights.json"
        write(out, aggregate(manifest, manifest_sha))
        outputs["insights"] = str(out)
    if args.command in {"select", "all"}:
        out = root / "build/testimonial-selection.json"
        write(out, select(manifest, manifest_sha, max(0, args.limit)))
        outputs["selection"] = str(out)

    print(json.dumps({"manifest": str(manifest_path), "manifest_sha256": manifest_sha, "outputs": outputs}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
