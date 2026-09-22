#!/usr/bin/env python3
"""Validate and compile rights-aware review intelligence and testimonial evidence."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime
import hashlib
import html as html_lib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

MANIFEST = "research/reviews/review-manifest.json"
INSIGHTS = "build/review-insights.json"
SELECTION = "build/testimonial-selection.json"
GATE = "build/reviews/result.json"

SOURCE_KINDS = {"user_supplied", "first_party", "licensed_platform", "other_permitted"}
PUBLICATION = {"research_only", "publishable_text", "publishable_full", "blocked"}
DISCOVERY = {"complete", "no_sources", "blocked"}
ANALYSIS_FIELDS = (
    "problems",
    "desired_outcomes",
    "buying_triggers",
    "praised_capabilities",
    "practical_benefits",
    "emotional_benefits",
    "objections_resolved",
    "differentiator_signals",
    "voice_phrases",
    "testimonial_roles",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def text_sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def nonempty(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def http_url(value) -> bool:
    if not nonempty(value):
        return False
    parsed = urlsplit(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.hostname) and not parsed.username and not parsed.password


def iso_time(value) -> bool:
    if not nonempty(value):
        return False
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is not None
    except ValueError:
        return False


def config(root: Path):
    path = root / "funnel.json"
    return read(path) if path.is_file() else {}


def required(root: Path) -> bool:
    return config(root).get("quality", {}).get("review_intelligence_version", 0) >= 1


def _string_list(value, label, errors):
    if not isinstance(value, list):
        errors.append(label + " must be a list")
        return []
    result = []
    for item in value:
        if not nonempty(item):
            errors.append(label + " contains an empty/non-string value")
        else:
            result.append(item.strip())
    return result


def validate_manifest(root: Path, expected_fingerprint: str | None = None):
    path = root / MANIFEST
    errors, warnings = [], []
    if not path.is_file():
        return {"status": "blocked", "errors": ["Missing " + MANIFEST], "warnings": []}
    try:
        data = read(path)
    except (OSError, ValueError, TypeError) as error:
        return {"status": "blocked", "errors": ["Invalid review manifest: " + str(error)], "warnings": []}

    if data.get("schema_version") != 1:
        errors.append("Review manifest requires schema_version 1")
    fingerprint = data.get("input_fingerprint", "")
    if expected_fingerprint is not None and fingerprint != expected_fingerprint:
        errors.append("Review research belongs to a different business input fingerprint")
    elif required(root) and not nonempty(fingerprint):
        errors.append("Review manifest needs the current research input fingerprint")

    business = data.get("business")
    if not isinstance(business, dict) or not (nonempty(business.get("name")) or nonempty(business.get("website"))):
        errors.append("Review manifest must identify the researched business")

    discovery = data.get("discovery")
    if not isinstance(discovery, dict) or discovery.get("status") not in DISCOVERY:
        errors.append("Review discovery must be complete, no_sources, or blocked")
        discovery = {}
    if discovery.get("status") in {"complete", "no_sources"}:
        if not iso_time(discovery.get("searched_at")):
            errors.append("Completed review discovery needs a timezone-aware searched_at time")
        checks = discovery.get("sources_checked")
        if not isinstance(checks, list) or not checks:
            errors.append("Completed review discovery must record at least one checked source")
        else:
            for index, source in enumerate(checks):
                if not isinstance(source, dict) or not nonempty(source.get("name")):
                    errors.append(f"sources_checked[{index}] needs a source name")
                if source.get("url") and not http_url(source.get("url")):
                    errors.append(f"sources_checked[{index}] has an invalid URL")
                if source.get("identity_match") not in {"matched", "not_matched", "ambiguous", "not_applicable"}:
                    errors.append(f"sources_checked[{index}] needs an identity_match decision")
    if discovery.get("status") == "blocked":
        errors.append("Review discovery is explicitly blocked: " + str(discovery.get("notes", "")).strip())

    providers = data.get("providers", [])
    if not isinstance(providers, list):
        errors.append("providers must be a list")
        providers = []
    provider_ids = set()
    for index, provider in enumerate(providers):
        if not isinstance(provider, dict):
            errors.append(f"providers[{index}] must be an object")
            continue
        pid = provider.get("id")
        if not nonempty(pid) or pid in provider_ids:
            errors.append(f"providers[{index}] needs a unique id")
        else:
            provider_ids.add(pid)
        if provider.get("kind") != "google_places":
            errors.append(f"providers[{index}] uses an unsupported provider kind")
            continue
        if type(provider.get("enabled")) is not bool:
            errors.append(f"providers[{index}].enabled must be boolean")
        if provider.get("enabled"):
            if not nonempty(provider.get("place_id")):
                errors.append(f"providers[{index}] enabled Google Places provider needs place_id")
            if not http_url(provider.get("source_url")):
                errors.append(f"providers[{index}] needs the public Google Maps source URL")
            if not iso_time(provider.get("terms_checked_at")):
                errors.append(f"providers[{index}] needs terms_checked_at")
            if not nonempty(provider.get("display_notice")):
                errors.append(f"providers[{index}] needs an ordering/filtering display notice")
        forbidden = {"reviews", "review_text", "avatar_bytes", "cached_reviews", "analysis"}
        if forbidden.intersection(provider):
            errors.append(f"providers[{index}] must not cache or derive content from Google Maps reviews")

    reviews = data.get("reviews", [])
    if not isinstance(reviews, list):
        errors.append("reviews must be a list")
        reviews = []
    ids = set()
    usable_analysis = 0
    publishable = 0
    for index, review in enumerate(reviews):
        prefix = f"reviews[{index}]"
        if not isinstance(review, dict):
            errors.append(prefix + " must be an object")
            continue
        rid = review.get("id")
        if not nonempty(rid) or rid in ids:
            errors.append(prefix + " needs a unique nonempty id")
            continue
        ids.add(rid)
        if review.get("source_kind") not in SOURCE_KINDS:
            errors.append(prefix + " must use a rights-cleared stored source kind; Google belongs in providers")
        if not nonempty(review.get("source_name")) or not http_url(review.get("source_url")):
            errors.append(prefix + " needs source_name and an HTTP(S) source_url")

        identity = review.get("business_identity")
        if not isinstance(identity, dict) or identity.get("status") != "matched":
            errors.append(prefix + " must be matched to the exact business/location")
        elif not _string_list(identity.get("evidence", []), prefix + ".business_identity.evidence", errors):
            errors.append(prefix + " needs concrete business identity evidence")

        reviewer = review.get("reviewer")
        if not isinstance(reviewer, dict) or not nonempty(reviewer.get("display_name")):
            errors.append(prefix + " needs the source-displayed reviewer name")
            reviewer = {}
        if reviewer.get("profile_url") and not http_url(reviewer.get("profile_url")):
            errors.append(prefix + " has an invalid reviewer profile URL")
        avatar = reviewer.get("avatar", {})
        if avatar and not isinstance(avatar, dict):
            errors.append(prefix + ".reviewer.avatar must be an object")
            avatar = {}

        body = review.get("review")
        if not isinstance(body, dict):
            errors.append(prefix + ".review must be an object")
            body = {}
        rating = body.get("rating")
        if rating is not None and (not isinstance(rating, (int, float)) or isinstance(rating, bool) or rating < 0 or rating > 5):
            errors.append(prefix + " rating must be between 0 and 5")
        if body.get("published_at") and not iso_time(body.get("published_at")):
            errors.append(prefix + " published_at must be a timezone-aware ISO timestamp when supplied")

        permissions = review.get("permissions")
        if not isinstance(permissions, dict):
            errors.append(prefix + ".permissions must be an object")
            permissions = {}
        if type(permissions.get("analysis_allowed")) is not bool:
            errors.append(prefix + " needs boolean analysis_allowed")
        publication = permissions.get("publication_status")
        if publication not in PUBLICATION:
            errors.append(prefix + " has an unsupported publication_status")
        if not nonempty(permissions.get("rights_basis")):
            errors.append(prefix + " needs a concrete rights_basis")
        if permissions.get("storage_mode") != "project":
            errors.append(prefix + " stored rights-cleared reviews use storage_mode=project")

        if permissions.get("analysis_allowed") is True:
            analysis = review.get("analysis")
            if not isinstance(analysis, dict):
                errors.append(prefix + ".analysis must be an object when analysis is allowed")
            else:
                for field in ANALYSIS_FIELDS:
                    _string_list(analysis.get(field, []), prefix + ".analysis." + field, errors)
                strength = analysis.get("proof_strength")
                if not isinstance(strength, int) or isinstance(strength, bool) or not 1 <= strength <= 5:
                    errors.append(prefix + ".analysis.proof_strength must be an integer from 1 to 5")
                usable_analysis += 1
        elif review.get("analysis"):
            warnings.append(prefix + " has analysis fields but analysis_allowed is false; compile ignores them")

        if publication in {"publishable_text", "publishable_full"}:
            if not nonempty(body.get("text")):
                errors.append(prefix + " publishable testimonial needs exact review text")
            publishable += 1
        if publication == "publishable_full":
            if not avatar or avatar.get("display_allowed") is not True:
                errors.append(prefix + " publishable_full needs an approved reviewer avatar")
            if not (http_url(avatar.get("url")) or nonempty(avatar.get("local_path"))):
                errors.append(prefix + " publishable_full needs avatar url or local_path")
            if not nonempty(avatar.get("provenance")):
                errors.append(prefix + " publishable_full needs avatar provenance")
            if nonempty(avatar.get("local_path")):
                candidate = (root / avatar["local_path"]).resolve()
                if not candidate.is_relative_to(root.resolve()) or not candidate.is_file():
                    errors.append(prefix + " local reviewer avatar must exist inside the project")
                elif not nonempty(avatar.get("sha256")) or sha(candidate) != avatar.get("sha256"):
                    errors.append(prefix + " local reviewer avatar needs its current sha256")
        elif avatar and avatar.get("display_allowed") is True:
            warnings.append(prefix + " avatar is approved but publication_status does not permit full display")

    if discovery.get("status") == "complete" and not reviews and not any(p.get("enabled") for p in providers if isinstance(p, dict)):
        warnings.append("Review discovery completed but found no rights-cleared reviews or enabled provider-dynamic source")
    return {
        "status": "blocked" if errors else ("pass_with_warnings" if warnings else "pass"),
        "errors": errors,
        "warnings": warnings,
        "manifest": data,
        "usable_analysis_reviews": usable_analysis,
        "publishable_reviews": publishable,
        "manifest_sha256": sha(path),
    }


def _aggregate(reviews):
    buckets = {field: defaultdict(lambda: {"count": 0, "review_ids": []}) for field in ANALYSIS_FIELDS if field != "testimonial_roles"}
    for review in reviews:
        permissions = review.get("permissions", {})
        if not permissions.get("analysis_allowed"):
            continue
        rid = review["id"]
        analysis = review.get("analysis", {})
        for field in buckets:
            seen = set()
            for value in analysis.get(field, []):
                key = re.sub(r"\s+", " ", value).strip()
                folded = key.casefold()
                if not key or folded in seen:
                    continue
                seen.add(folded)
                row = buckets[field][key]
                row["count"] += 1
                row["review_ids"].append(rid)
    result = {}
    for field, values in buckets.items():
        rows = [{"text": key, **value} for key, value in values.items()]
        rows.sort(key=lambda item: (-item["count"], item["text"].casefold()))
        result[field] = rows
    return result


def _select_static(reviews, limit=4):
    candidates = []
    for review in reviews:
        permissions = review.get("permissions", {})
        if permissions.get("publication_status") not in {"publishable_text", "publishable_full"}:
            continue
        analysis = review.get("analysis") if permissions.get("analysis_allowed") else {}
        roles = list(dict.fromkeys(analysis.get("testimonial_roles", []) if isinstance(analysis, dict) else []))
        candidates.append((-(analysis.get("proof_strength", 1) if isinstance(analysis, dict) else 1), review["id"], review, roles))
    candidates.sort(key=lambda item: (item[0], item[1]))
    selected, used_roles = [], set()
    while candidates and len(selected) < limit:
        best_index = 0
        for i, (_, _, _, roles) in enumerate(candidates):
            if any(role not in used_roles for role in roles):
                best_index = i
                break
        _, _, review, roles = candidates.pop(best_index)
        permissions = review["permissions"]
        reviewer = review["reviewer"]
        body = review["review"]
        avatar = reviewer.get("avatar", {})
        item = {
            "id": review["id"],
            "source_name": review["source_name"],
            "source_url": review["source_url"],
            "quote": body["text"].strip(),
            "quote_sha256": text_sha(body["text"].strip()),
            "reviewer_name": reviewer["display_name"].strip(),
            "reviewer_profile_url": reviewer.get("profile_url", ""),
            "rating": body.get("rating"),
            "published_at": body.get("published_at", ""),
            "publication_status": permissions["publication_status"],
            "rights_basis": permissions["rights_basis"],
            "testimonial_roles": roles,
            "proof_strength": (review.get("analysis") or {}).get("proof_strength", 1),
        }
        if permissions["publication_status"] == "publishable_full":
            item["avatar"] = {
                "url": avatar.get("url", ""),
                "local_path": avatar.get("local_path", ""),
                "provenance": avatar.get("provenance", ""),
                "sha256": avatar.get("sha256", ""),
            }
        selected.append(item)
        used_roles.update(roles)
    return selected


def _compiled_records(checked):
    manifest = checked["manifest"]
    aggregates = _aggregate(manifest.get("reviews", []))
    insights = {
        "schema_version": 1,
        "manifest": MANIFEST,
        "manifest_sha256": checked["manifest_sha256"],
        "input_fingerprint": manifest.get("input_fingerprint", ""),
        "analysis_scope": "rights-cleared stored reviews with analysis_allowed=true; provider-dynamic Google content is excluded",
        "review_count": checked["usable_analysis_reviews"],
        "themes": aggregates,
        "warnings": checked["warnings"],
    }
    static = _select_static(manifest.get("reviews", []))
    dynamic = []
    for provider in manifest.get("providers", []):
        if isinstance(provider, dict) and provider.get("kind") == "google_places" and provider.get("enabled"):
            dynamic.append({
                "id": provider["id"],
                "kind": "google_places",
                "place_id": provider["place_id"],
                "source_url": provider["source_url"],
                "display_notice": provider["display_notice"],
                "mode": "provider_dynamic",
            })
    selection = {
        "schema_version": 1,
        "manifest": MANIFEST,
        "manifest_sha256": checked["manifest_sha256"],
        "input_fingerprint": manifest.get("input_fingerprint", ""),
        "static_testimonials": static,
        "dynamic_providers": dynamic,
        "selection_rule": "proof-strength first with testimonial-role diversity; exact source text only",
    }
    return insights, selection


def compile_project(root: Path, expected_fingerprint: str | None = None):
    checked = validate_manifest(root, expected_fingerprint)
    if checked["status"] == "blocked":
        raise ValueError("; ".join(checked["errors"]))
    insights, selection = _compiled_records(checked)
    write(root / INSIGHTS, insights)
    write(root / SELECTION, selection)
    return {"status": checked["status"], "insights": INSIGHTS, "selection": SELECTION, "static_count": len(selection["static_testimonials"]), "dynamic_count": len(selection["dynamic_providers"]), "warnings": checked["warnings"]}


def _normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _web_root(root: Path) -> Path:
    return root / "public" if (root / "public" / "index.html").is_file() else root


def validate_rendered(root: Path, selection):
    errors, warnings = [], []
    index = _web_root(root) / "index.html"
    if not index.is_file():
        return ["Landing page is missing for testimonial render validation"], []
    html = index.read_text(encoding="utf-8", errors="replace")
    flat = _normalized(html_lib.unescape(re.sub(r"<[^>]+>", " ", html)))
    for item in selection.get("static_testimonials", []):
        rid = item["id"]
        if f'data-testimonial-id="{rid}"' not in html and f"data-testimonial-id='{rid}'" not in html:
            errors.append("Selected testimonial is not bound to data-testimonial-id=" + rid)
        if _normalized(item["quote"]) not in flat:
            errors.append("Rendered testimonial quote differs or is missing: " + rid)
        if _normalized(item["reviewer_name"]) not in flat:
            errors.append("Rendered reviewer name is missing: " + rid)
        source = item.get("source_name", "")
        if source and _normalized(source) not in flat:
            errors.append("Rendered testimonial source is missing: " + rid)
        if item.get("rating") is not None and str(item["rating"]) not in flat:
            warnings.append("Selected testimonial rating is not visibly rendered: " + rid)
        if item.get("publication_status") == "publishable_full":
            avatar = item.get("avatar", {})
            expected = avatar.get("local_path") or avatar.get("url")
            if expected and expected not in html:
                errors.append("Approved reviewer avatar is not rendered with its testimonial: " + rid)
    for provider in selection.get("dynamic_providers", []):
        place = provider["place_id"]
        has_widget = "data-google-reviews-widget" in html and place in html
        if not has_widget:
            errors.append("Enabled Google Places review provider lacks its provider-dynamic widget")
        if "google-reviews-widget.js" not in html:
            errors.append("Enabled Google Places review provider lacks the maintained widget script")
        if provider.get("display_notice") and _normalized(provider["display_notice"]) not in flat:
            errors.append("Google review ordering/filter notice is not visible")
    return errors, warnings


def audit_project(root: Path, expected_fingerprint: str | None = None, rendered: bool = True):
    checked = validate_manifest(root, expected_fingerprint)
    errors = list(checked["errors"])
    warnings = list(checked["warnings"])
    artifacts = []
    if checked.get("manifest_sha256"):
        artifacts.append({"path": MANIFEST, "type": "review_manifest", "sha256": checked["manifest_sha256"]})
    insights_path, selection_path = root / INSIGHTS, root / SELECTION
    insights = selection = None
    for path, label in ((insights_path, "review insights"), (selection_path, "testimonial selection")):
        if not path.is_file():
            errors.append("Missing compiled " + label)
    expected_insights = expected_selection = None
    if checked.get("manifest") and checked["status"] != "blocked":
        expected_insights, expected_selection = _compiled_records(checked)
    if insights_path.is_file():
        try:
            insights = read(insights_path)
            if insights.get("schema_version") != 1 or insights.get("manifest_sha256") != checked.get("manifest_sha256"):
                errors.append("Review insights are stale for the current manifest")
            elif expected_insights is not None and insights != expected_insights:
                errors.append("Review insights differ from the deterministic current manifest aggregation; recompile them")
            artifacts.append({"path": INSIGHTS, "type": "review_insights", "sha256": sha(insights_path)})
        except (OSError, ValueError, TypeError):
            errors.append("Review insights are invalid JSON")
    if selection_path.is_file():
        try:
            selection = read(selection_path)
            if selection.get("schema_version") != 1 or selection.get("manifest_sha256") != checked.get("manifest_sha256"):
                errors.append("Testimonial selection is stale for the current manifest")
            elif expected_selection is not None and selection != expected_selection:
                errors.append("Testimonial selection differs from the current source records; recompile instead of editing proof")
            artifacts.append({"path": SELECTION, "type": "testimonial_selection", "sha256": sha(selection_path)})
        except (OSError, ValueError, TypeError):
            errors.append("Testimonial selection is invalid JSON")
    if selection and rendered:
        render_errors, render_warnings = validate_rendered(root, selection)
        errors.extend(render_errors)
        warnings.extend(render_warnings)
        index = _web_root(root) / "index.html"
        if index.is_file():
            artifacts.append({"path": index.relative_to(root).as_posix(), "type": "landing_page", "sha256": sha(index)})
        if selection.get("dynamic_providers"):
            widget = _web_root(root) / "assets" / "google-reviews-widget.js"
            if not widget.is_file():
                errors.append("Google provider is enabled but the runtime widget asset is missing")
            else:
                artifacts.append({"path": widget.relative_to(root).as_posix(), "type": "google_review_widget", "sha256": sha(widget)})
    return {
        "status": "blocked" if errors else ("pass_with_warnings" if warnings else "pass"),
        "failures": errors,
        "warnings": sorted(set(warnings)),
        "artifacts": artifacts,
        "manifest_sha256": checked.get("manifest_sha256"),
        "static_testimonial_count": len(selection.get("static_testimonials", [])) if isinstance(selection, dict) else 0,
        "dynamic_provider_count": len(selection.get("dynamic_providers", [])) if isinstance(selection, dict) else 0,
    }


def research_ready(root: Path, expected_fingerprint: str | None = None):
    if not required(root):
        return {"ready": True, "status": "not_required", "failures": []}
    result = audit_project(root, expected_fingerprint, rendered=False)
    return {"ready": result["status"] != "blocked", "status": result["status"], "failures": result["failures"], "warnings": result["warnings"]}


def gate_report(root: Path, snapshot_path: Path):
    snapshot = read(snapshot_path)
    result = audit_project(root, rendered=True)
    return {
        "schema_version": 1,
        "gate": "reviews",
        "status": result["status"],
        "source_fingerprint": snapshot["source_fingerprint"],
        "executed_at": datetime.now().astimezone().isoformat(),
        "target": {"mode": snapshot["mode"], "url": ""},
        "tool": {"name": "review_workflow", "version": "1"},
        "checks": {
            "manifest_current": not any("manifest" in f.lower() and "stale" in f.lower() for f in result["failures"]),
            "testimonial_render_integrity": not any("testimonial" in f.lower() or "reviewer" in f.lower() for f in result["failures"]),
            "provider_dynamic_integrity": not any("google" in f.lower() for f in result["failures"]),
        },
        "review_intelligence": {
            "manifest_sha256": result["manifest_sha256"],
            "static_testimonial_count": result["static_testimonial_count"],
            "dynamic_provider_count": result["dynamic_provider_count"],
        },
        "artifacts": result["artifacts"],
        "failures": result["failures"],
        "warnings": result["warnings"],
    }


def initialize(root: Path, fingerprint: str = ""):
    path = root / MANIFEST
    if path.exists():
        raise ValueError(MANIFEST + " already exists")
    cfg = config(root)
    client = cfg.get("client", {})
    value = {
        "schema_version": 1,
        "input_fingerprint": fingerprint,
        "business": {"name": client.get("name", ""), "website": client.get("website", ""), "location": client.get("region", ""), "identity_evidence": []},
        "discovery": {"status": "pending", "searched_at": "", "sources_checked": [], "notes": ""},
        "providers": [{"id": "google-primary", "kind": "google_places", "enabled": False, "place_id": "", "source_url": "", "terms_checked_at": "", "display_notice": "Google reviews are shown in the order returned by Google; no additional filtering is applied."}],
        "reviews": [],
    }
    write(path, value)
    return {"status": "pass", "created": MANIFEST}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init"); init.add_argument("project_root", type=Path); init.add_argument("--input-fingerprint", default="")
    compile_p = sub.add_parser("compile"); compile_p.add_argument("project_root", type=Path); compile_p.add_argument("--expected-fingerprint")
    audit = sub.add_parser("audit"); audit.add_argument("project_root", type=Path); audit.add_argument("--expected-fingerprint"); audit.add_argument("--no-render", action="store_true")
    gate = sub.add_parser("gate"); gate.add_argument("project_root", type=Path); gate.add_argument("--snapshot", default="build/gate-snapshot.json"); gate.add_argument("--out", default=GATE)
    args = parser.parse_args()
    root = args.project_root.expanduser().resolve()
    try:
        if args.command == "init":
            result = initialize(root, args.input_fingerprint)
        elif args.command == "compile":
            result = compile_project(root, args.expected_fingerprint)
        elif args.command == "audit":
            result = audit_project(root, args.expected_fingerprint, rendered=not args.no_render)
        else:
            result = gate_report(root, root / args.snapshot)
            write(root / args.out, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if result.get("status") == "blocked" else 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "blocked", "failures": [str(error)]}, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
