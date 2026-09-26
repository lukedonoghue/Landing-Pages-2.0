#!/usr/bin/env python3
"""Validate review provenance, testimonial selection, and rendered testimonial evidence."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

VALID_MATCH = {"matched", "ambiguous", "mismatch"}
VALID_PUBLICATION = {"research_only", "publishable_text", "publishable_full", "blocked"}

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def file_hash(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def normalize_space(value):
    return " ".join((value or "").split())

def allowed_shortening(quote, original):
    q = normalize_space(quote)
    o = normalize_space(original)
    if not q or not o:
        return False
    return q == o or q in o

def validate_manifest(manifest):
    errors, warnings = [], []
    if manifest.get("schema_version") != 1:
        errors.append("review manifest schema_version must be 1")

    sources = {}
    for source in manifest.get("sources", []):
        sid = source.get("id")
        if not sid or sid in sources:
            errors.append(f"duplicate or missing source id: {sid!r}")
            continue
        sources[sid] = source
        status = source.get("business_match", {}).get("status")
        if status not in VALID_MATCH:
            errors.append(f"source {sid}: invalid business_match status")
        terms = source.get("terms", {})
        for key in ("research_allowed", "publish_text_allowed", "publish_avatar_allowed"):
            if key not in terms or not isinstance(terms[key], bool):
                errors.append(f"source {sid}: terms.{key} must be boolean")

    providers = {}
    for provider in manifest.get("providers", []):
        pid = provider.get("id") if isinstance(provider, dict) else None
        if not pid or pid in providers:
            errors.append(f"duplicate or missing provider id: {pid!r}")
            continue
        providers[pid] = provider
        if provider.get("kind") != "google_places":
            errors.append(f"provider {pid}: unsupported kind; only google_places live reviews are supported")
        if not isinstance(provider.get("enabled"), bool):
            errors.append(f"provider {pid}: enabled must be boolean")
        if provider.get("enabled"):
            if not normalize_space(provider.get("place_id")):
                errors.append(f"provider {pid}: an enabled Google Places provider needs place_id")
            if not str(provider.get("source_url", "")).startswith("https://"):
                errors.append(f"provider {pid}: record the public Google Maps listing URL")
            if not normalize_space(provider.get("terms_checked_at")):
                errors.append(f"provider {pid}: record when the current Google Maps Platform terms were checked")

    reviews = {}
    for review in manifest.get("reviews", []):
        rid = review.get("id")
        if not rid or rid in reviews:
            errors.append(f"duplicate or missing review id: {rid!r}")
            continue
        reviews[rid] = review
        sid = review.get("source_id")
        source = sources.get(sid)
        if not source:
            errors.append(f"review {rid}: unknown source_id {sid!r}")
            continue

        publication = review.get("publication", {})
        state = publication.get("status")
        if state in {"publishable_text", "publishable_full"} and not normalize_space(publication.get("rights_basis")):
            errors.append(f"review {rid}: publication rights basis is missing")
        if state not in VALID_PUBLICATION:
            errors.append(f"review {rid}: invalid publication status")
            continue

        if source.get("business_match", {}).get("status") != "matched" and state != "blocked":
            errors.append(f"review {rid}: non-matched source must be blocked")

        terms = source.get("terms", {})
        if state != "blocked" and not terms.get("research_allowed"):
            errors.append(f"review {rid}: source does not permit research use")
        if state in {"publishable_text", "publishable_full"} and not terms.get("publish_text_allowed"):
            errors.append(f"review {rid}: source does not permit testimonial text publication")
        if state == "publishable_full" and not terms.get("publish_avatar_allowed"):
            errors.append(f"review {rid}: source does not permit avatar publication")

        reviewer = review.get("reviewer", {})
        avatar = reviewer.get("avatar", {}) or {}
        if avatar.get("generated"):
            errors.append(f"review {rid}: generated reviewer avatars are prohibited")
        if avatar.get("local_path") and not normalize_space(avatar.get("sha256")):
            errors.append(f"review {rid}: a local reviewer avatar needs its sha256 so a swapped file is detected")
        if state == "publishable_full" and not (avatar.get("url") or avatar.get("local_path")):
            warnings.append(f"review {rid}: publishable_full has no avatar; render without image or downgrade status")

        strength = review.get("analysis", {}).get("proof_strength")
        if strength is not None:
            try:
                if not 1 <= int(strength) <= 5:
                    raise ValueError
            except (TypeError, ValueError):
                errors.append(f"review {rid}: proof_strength must be 1..5")

    return errors, warnings, sources, reviews

def validate_selection(root, manifest_path, reviews):
    errors, warnings = [], []
    selection_path = root / "build/testimonial-selection.json"
    if not selection_path.exists():
        return errors, warnings
    selection = load(selection_path)
    if selection.get("review_manifest_sha256") != file_hash(manifest_path):
        errors.append("testimonial selection is stale relative to review manifest")
    seen = set()
    for item in selection.get("selected", []):
        rid = item.get("review_id")
        if rid in seen:
            errors.append(f"testimonial selection duplicates {rid}")
            continue
        seen.add(rid)
        review = reviews.get(rid)
        if not review:
            errors.append(f"testimonial selection references unknown review {rid}")
            continue
        state = review.get("publication", {}).get("status")
        if state not in {"publishable_text", "publishable_full"}:
            errors.append(f"testimonial {rid}: selected from non-publishable review")
    return errors, warnings

def validate_rendered(root, reviews, sources=None):
    errors, warnings = [], []
    rendered_path = root / "build/rendered-testimonials.json"
    if not rendered_path.exists():
        errors.append("build/rendered-testimonials.json is required for rendered testimonial acceptance")
        return errors, warnings

    rendered = load(rendered_path)
    for item in rendered.get("testimonials", []):
        rid = item.get("review_id")
        review = reviews.get(rid)
        if not review:
            errors.append(f"rendered testimonial references unknown review {rid}")
            continue
        state = review.get("publication", {}).get("status")
        if state not in {"publishable_text", "publishable_full"}:
            errors.append(f"rendered testimonial {rid}: source is not publishable")
            continue

        if not allowed_shortening(item.get("quote"), review.get("text")):
            errors.append(f"rendered testimonial {rid}: quote is not a verbatim review or allowed shortening")

        expected_name = normalize_space(review.get("reviewer", {}).get("display_name"))
        actual_name = normalize_space(item.get("display_name"))
        if expected_name != actual_name:
            errors.append(f"rendered testimonial {rid}: reviewer display name mismatch")

        if item.get("rating") is not None and item.get("rating") != review.get("rating"):
            errors.append(f"rendered testimonial {rid}: rating mismatch")
        if item.get("published_date") is not None and item.get("published_date") != review.get("published_date"):
            errors.append(f"rendered testimonial {rid}: published date mismatch")
        details = normalize_space(review.get("reviewer", {}).get("public_details"))
        if item.get("public_details") is not None and normalize_space(item.get("public_details")) != details:
            errors.append(f"rendered testimonial {rid}: reviewer public details differ from the source")

        avatar = item.get("avatar") or {}
        source_avatar = review.get("reviewer", {}).get("avatar", {}) or {}
        if avatar.get("generated"):
            errors.append(f"rendered testimonial {rid}: generated avatar prohibited")
        if avatar and state != "publishable_full":
            errors.append(f"rendered testimonial {rid}: avatar rendered without publishable_full status")
        if avatar:
            for key in ("url", "local_path"):
                if avatar.get(key) and avatar.get(key) != source_avatar.get(key):
                    errors.append(f"rendered testimonial {rid}: avatar {key} mismatch")

        source = (sources or {}).get(review.get("source_id"), {})
        if item.get("source_id") and item["source_id"] != review.get("source_id"):
            errors.append(f"rendered testimonial {rid}: source identity mismatch")
        if item.get("source_url") and item["source_url"] != review.get("source_url"):
            errors.append(f"rendered testimonial {rid}: source URL mismatch")
        required = bool(source.get("terms", {}).get("attribution_required") or item.get("attribution_required"))
        if required and not normalize_space(item.get("attribution")):
            errors.append(f"rendered testimonial {rid}: required attribution missing")
        if required and not item.get("source_url"):
            errors.append(f"rendered testimonial {rid}: required source access missing")

    return errors, warnings

def business_errors(root, business):
    """The review manifest must describe the business this page is for."""
    from urllib.parse import urlsplit
    funnel_path = root / "funnel.json"
    client = load(funnel_path).get("client", {}) if funnel_path.is_file() else {}
    host = lambda url: (urlsplit(str(url or "")).hostname or "").removeprefix("www.")
    errors = []
    if host(client.get("website")) and host(business.get("website")) and host(client["website"]) != host(business["website"]):
        errors.append("review manifest business website does not match funnel.json client.website")
    if normalize_space(client.get("name")) and normalize_space(business.get("name")) and normalize_space(client["name"]).lower() != normalize_space(business["name"]).lower():
        errors.append("review manifest business name does not match funnel.json client.name")
    return errors


def widget_errors(root, providers):
    """An enabled live-review provider must render the maintained widget and its notice."""
    enabled = [p for p in providers if isinstance(p, dict) and p.get("enabled") and p.get("id")]
    if not enabled:
        return []
    page = root / "public/index.html"
    html = page.read_text(encoding="utf-8") if page.is_file() else ""
    errors = []
    for provider in enabled:
        pid = provider["id"]
        if "data-google-reviews-widget" not in html or str(provider.get("place_id")) not in html:
            errors.append(f"provider {pid}: the page lacks the live Google reviews widget for this place_id")
        if "google-reviews-widget.js" not in html:
            errors.append(f"provider {pid}: the page does not load assets/google-reviews-widget.js")
        notice = normalize_space(provider.get("display_notice"))
        if notice and notice not in normalize_space(html):
            errors.append(f"provider {pid}: the review ordering/filter notice is not on the page")
    return errors


def validate_project(root, stage="research"):
    root = Path(root).resolve()
    manifest_path = root / "research/reviews/review-manifest.json"
    if not manifest_path.exists():
        if (root / "build/rendered-testimonials.json").exists() and load(root / "build/rendered-testimonials.json").get("testimonials"):
            return {"status": "blocked", "errors": ["Rendered testimonials require their source review manifest"], "warnings": []}
        return {"status": "not_applicable", "errors": [], "warnings": []}

    manifest = load(manifest_path)
    errors, warnings, sources, reviews = validate_manifest(manifest)
    errors += business_errors(root, manifest.get("business", {}))
    for rid, review in reviews.items():
        avatar = review.get("reviewer", {}).get("avatar", {}) or {}
        if avatar.get("local_path") and avatar.get("sha256"):
            path = (root / avatar["local_path"]).resolve()
            if not path.is_relative_to(root) or not path.is_file() or file_hash(path) != avatar["sha256"]:
                errors.append(f"review {rid}: local reviewer avatar is missing or changed")
    more_errors, more_warnings = validate_selection(root, manifest_path, reviews)
    errors += more_errors
    warnings += more_warnings

    insights_path = root / "build/review-insights.json"
    if insights_path.exists():
        insights = load(insights_path)
        if insights.get("review_manifest_sha256") != file_hash(manifest_path):
            errors.append("review insights are stale relative to review manifest")
    else:
        warnings.append("build/review-insights.json not present")

    if stage == "rendered":
        errors += widget_errors(root, manifest.get("providers", []))
        more_errors, more_warnings = validate_rendered(root, reviews, sources)
        errors += more_errors
        warnings += more_warnings

    result = {
        "schema_version": 1,
        "stage": stage,
        "status": "blocked" if errors else ("pass_with_warnings" if warnings else "pass"),
        "manifest": str(manifest_path.relative_to(root)),
        "source_count": len(sources),
        "review_count": len(reviews),
        "errors": errors,
        "warnings": warnings,
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--stage", choices=["research", "rendered"], default="research")
    args = parser.parse_args()
    try:
        result = validate_project(args.project_root.expanduser(), args.stage)
    except (OSError, ValueError, KeyError, TypeError) as error:
        result = {"status": "blocked", "errors": [str(error)], "warnings": []}
    print(json.dumps(result, indent=2))
    return 1 if result["status"] == "blocked" else 0

if __name__ == "__main__":
    raise SystemExit(main())
