"""Category fit and media strategy: would the page read as this kind of business?

A clean, responsive layout can still look like a software product when the page is
for a plumber. These checks make the reviewer answer that question explicitly and
keep the answer consistent with the image plan's first-party proof ledger. They
record a reviewer's judgment; they cannot make the judgment.
"""
from __future__ import annotations
import json
from pathlib import Path

ARCHETYPES = {"local_trade", "professional_service", "retail", "other"}
# Trades that work on customers' homes and sites are judged on photos of real jobs.
PHOTO_LED = {"local_trade"}


def text(value, minimum=1):
    return isinstance(value, str) and len(value.strip()) >= minimum


def config(root):
    path = Path(root) / "funnel.json"
    return json.loads(path.read_text()) if path.is_file() else {}


def archetype(root):
    return (config(root).get("business") or {}).get("archetype")


def required(root):
    value = config(root)
    if value.get("development_fixture"):
        return False
    return value.get("quality", {}).get("contract_version", 0) >= 4 or archetype(root) in PHOTO_LED


def proof(root):
    path = Path(root) / "image-plan.json"
    if not path.is_file():
        return {"status": "none_identified", "candidates": 0, "used": [], "unresolved": []}
    import image_workflow
    return image_workflow.proof_role(json.loads(path.read_text()), root)


def category_fit_errors(root, report, review_mode):
    """Checks build/visual-review.json category_fit."""
    if not required(root):
        return []
    errors = []
    # The local-trade sign-off below depends on the archetype, so an unset one must not switch it off.
    if config(root).get("quality", {}).get("contract_version", 0) >= 4 and archetype(root) not in ARCHETYPES:
        errors.append("Record business.archetype (" + ", ".join(sorted(ARCHETYPES)) + ") from research or the owner's business_type answer before accepting the visual direction")
    fit = report.get("category_fit")
    if not isinstance(fit, dict):
        return errors + ["Visual acceptance must answer category fit: would this page read as the intended kind of business to its buyer without the brand name? Record category_fit (references/quality-gates.md)."]
    for key, minimum in (("category", 4), ("target_buyer", 8), ("reasoning", 40), ("media_strategy", 20)):
        if not text(fit.get(key), minimum):
            errors.append(f"category_fit.{key} needs a specific answer about this page")
    if fit.get("reads_as_category_without_brand") is not True:
        errors.append("The page does not yet read as a " + str(fit.get("category") or "category") + " business without its name; change the media, palette, type or iconography before accepting the direction")
    ledger = proof(root)
    expected = "used" if ledger["status"] == "proof_used" else "none_available"
    if ledger["status"] == "unresolved":
        errors.append("Resolve every first-party proof candidate before accepting the visual direction")
    elif fit.get("first_party_proof") != expected:
        errors.append(f"category_fit.first_party_proof must be '{expected}' to match the image plan's proof ledger")
    abandoned = ledger["candidates"] and not ledger["used"]
    if archetype(root) in PHOTO_LED and abandoned and review_mode == "self_review":
        signoff = fit.get("owner_visual_signoff") or {}
        if not (text(signoff.get("message_id")) and text(signoff.get("statement"), 10)):
            errors.append("The builder reviewed its own design and it uses none of the business's own job photos; record an independent visual review, or the owner's explicit visual sign-off in category_fit.owner_visual_signoff {message_id, statement}")
    return errors


def media_strategy_errors(root, acceptance):
    """Checks build/control-review/acceptance.json media_strategy alongside copy/layout criteria."""
    if not required(root):
        return []
    strategy = acceptance.get("media_strategy")
    if not isinstance(strategy, dict):
        return ["The control comparison must record media_strategy {first_party_proof, photo_vs_illustration_fit, category_authenticity} separately from copy and layout"]
    return [f"media_strategy.{key} needs a specific judgment" for key in ("first_party_proof", "photo_vs_illustration_fit", "category_authenticity") if not text(strategy.get(key), 20)]
