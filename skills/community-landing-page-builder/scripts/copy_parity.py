#!/usr/bin/env python3
"""Compare captured rendered words with the canonical copy; never grants approval."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlsplit

META = {"id", "claim_ids", "source_ids", "cta_role", "role", "notes", "evidence", "source", "source_url", "href"}
UI_TEXT = [
    "Back", "Continue", "Close form", "×", "Home", "Services", "FAQ", "FAQs", "How it works",
    "Contact", "Team login", "Back to the page", "Privacy", "Privacy information",
    "How can we reach you?", "What do you need?", "Confirm the next step",
    "First name", "Last name", "Name", "Email", "Phone", "Service", "Select a service", "Website",
    "Allow visitor measurement to help us improve this page? Your request works either way.",
    "Allow measurement", "Allow optional data", "No optional measurement", "No thanks", "Privacy choices", "All rights reserved.",
    "Allow optional page measurement and campaign details? Your enquiry works either way.",
    "Allow visitor measurement? Campaign details are still included with your enquiry.",
    "Allow campaign details with your enquiry? Your request works either way.",
    "Allow visitor measurement? Campaign details are not saved. Your enquiry works either way.",
    "Visitor measurement is on. You can turn it off; your enquiry works either way.",
    "Campaign details accompany enquiries independently.", "Campaign details are not saved.",
    "Campaign details are added only if you allow optional data.",
    "Contents", "Services at a glance", "Our process", "Ideal for", "What's included"
]
TRANSLATE = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "‐": "-", "‑": "-", "\u00ad": ""})


def normalize(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(text)).translate(TRANSLATE)).strip().casefold()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def leaves(value, prefix=""):
    result = []
    if isinstance(value, str) and value.strip():
        result.append((prefix, value))
    elif isinstance(value, list):
        for i, item in enumerate(value):
            result += leaves(item, f"{prefix}/{i}")
    elif isinstance(value, dict):
        for key, item in value.items():
            if key not in META:
                result += leaves(item, f"{prefix}/{key}")
    return result


def contains(text, phrase):
    phrase = normalize(phrase)
    return bool(phrase and re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text))


def extra_text(text, allowed):
    remainder = normalize(text)
    for phrase in sorted({normalize(value) for value in allowed if normalize(value)}, key=len, reverse=True):
        remainder = re.sub(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", " ", remainder)
    remainder = re.sub(r"\bstep\s+\d+\s+of\s+\d+\b", " ", remainder)
    remainder = re.sub(r"©\s*(?:19|20)\d{2}(?:\s*-\s*(?:19|20)\d{2})?", " ", remainder)
    # Decorative separators are allowed; percentages/currencies/numbers are not.
    return re.sub(r"\s+", " ", re.sub(r"[•·|×→↗›]+", " ", remainder)).strip()


def interface_words(master, funnel, capture):
    words = UI_TEXT + [text for _, text in leaves(master.get("interface_text", []))]
    client = funnel.get("client", {})
    words += [client.get("name", ""), client.get("phone_display", "")]
    for field in funnel.get("form_fields", []):
        words += [field.get("label", field.get("name", "").replace("_", " "))]
        words += [str(option) for option in field.get("options", [])]
    return words


def expected_surfaces(master, catalogue_enabled):
    modal = master.get("modal", {})
    if isinstance(modal, dict):
        # The shared follow-up contract must appear in the confirmation. The
        # modal can explain it in future tense without rendering past-tense copy.
        promise = modal.get("follow_up_promise")
        if promise and promise != master.get("thank_you", {}).get("follow_up_promise"):
            raise ValueError("The modal follow-up contract must match thank_you.follow_up_promise for rendered verification.")
        modal = {key: value for key, value in modal.items()
                 if key not in {"failure", "uncertain", "follow_up_promise"}}
    expected = {
        "landing": leaves({key: master[key] for key in ("h1", "primary_cta", "sections") if key in master}),
        "modal": leaves(modal, "/modal"),
        "thank_you": leaves(master.get("thank_you", {}), "/thank_you")
    }
    if catalogue_enabled:
        brochure = master.get("brochure", {})
        if not brochure.get("approved_asset"):
            if not leaves(brochure.get("text")):
                raise ValueError("The master needs the complete brochure.text before copy approval, or a genuinely supplied approved_asset.")
            expected["brochure"] = leaves(brochure.get("text"), "/brochure/text")
            expected["brochure"] += leaves(brochure.get("cover_promise", ""), "/brochure/cover_promise")
    for surface in ("landing", "modal", "thank_you"):
        if not expected[surface]:
            raise ValueError(f"The canonical copy is missing its {surface} wording.")
    return expected


def pdf_body(text, page_count, footer_labels=()):
    pages = text.split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    if len(pages) != page_count:
        raise ValueError("PDF page boundaries do not match the captured page count.")
    cleaned = []
    for index, page in enumerate(pages, 1):
        # Explicit navigation labels are neutral UI, bounded by the real page count.
        # Never discard bare in-body numbers, prices or percentages.
        lines = [line for line in page.splitlines()
                 if not ((match := re.fullmatch(r'page\s+(\d+)', normalize(line)))
                         and 1 <= int(match[1]) <= page_count)]
        for end in (0, -1):
            while lines and not lines[end].strip():
                lines.pop(end)
            if lines:
                number = normalize(lines[end])
                if number in {str(index), f"{index:02d}", f"page {index}", f"page {index} of {page_count}", f"{index} / {page_count}"}:
                    lines.pop(end)
                elif end == -1:
                    # Poppler may join the approved footer and its page number.
                    # Remove only the current page's suffix after an exact known label.
                    match = re.fullmatch(r'(.+?)\s+(0?' + str(index) + r')', number)
                    if match and match[1] in {normalize(label) for label in footer_labels}:
                        lines[end] = match[1]
        cleaned.append("\n".join(lines))
    return "\n".join(cleaned)


def compare(master, funnel, capture):
    """Text equivalence, coverage and unknown additions, separately per viewport."""
    failures = []
    catalogue_enabled = funnel.get("catalogue", {}).get("enabled", True)
    try:
        expected = expected_surfaces(master, catalogue_enabled)
    except ValueError as error:
        return {"passed": False, "failures": [str(error)], "surfaces": []}
    if capture.get("status") != "pass" or capture.get("execution", {}).get("kind") != "automated" or capture.get("execution", {}).get("exit_code") != 0:
        failures.append("An executed successful browser/PDF capture is required.")
    viewports = capture.get("viewports", [])
    if not isinstance(viewports, list):viewports = []
    if not {390, 1440}.issubset({v.get("width") for v in viewports if isinstance(v, dict)}):
        failures.append("Copy capture must include desktop 1440 and mobile 390 widths.")
    documents = capture.get("documents", [])
    if not isinstance(documents, list) or any(not isinstance(doc, dict) or not isinstance(doc.get('text'), str) for doc in documents):
        failures.append('Capture documents must contain actual text strings.')
        documents = []
    neutral = interface_words(master, funnel, capture)
    state_copy = [value for key in ("failure", "uncertain")
                  if isinstance(master.get("modal", {}), dict)
                  and isinstance((value := master["modal"].get(key)), str) and value.strip()]
    rows = []
    for surface in ("landing", "modal", "thank_you"):
        phrases = [value for _, value in expected[surface]]
        for width in (390, 1440):
            matches = [doc for doc in documents if doc.get("surface") == surface and doc.get("width") == width]
            texts = [normalize(doc.get("text", "")) for doc in matches]
            missing = [key for key, value in expected[surface] if not any(contains(text, value) for text in texts)]
            unexpected = [extra_text(text, phrases + neutral + (state_copy if surface == "modal" and doc.get("state") == "submission-error" else []))
                          for doc, text in zip(matches, texts)]
            unexpected = [value for value in unexpected if value]
            if not matches:
                failures.append(f"{surface} {width}: no captured states")
            if missing:
                failures.append(f"{surface} {width}: approved wording missing or changed at " + ", ".join(missing[:12]))
            if unexpected:
                failures.append(f"{surface} {width}: unapproved rendered text: " + unexpected[0][:240])
            rows.append({"surface": surface, "width": width, "states": len(matches), "missing": missing, "unexpected": unexpected})
    if state_copy:
        for width in (390, 1440):
            initial = [doc for doc in documents if doc.get("surface") == "modal"
                       and doc.get("width") == width and doc.get("state") == "step-0"]
            if len(initial) != 1:
                failures.append(f"modal {width}: one initial step-0 state is required")
            elif any(contains(normalize(initial[0].get("text", "")), value) for value in state_copy):
                failures.append(f"modal {width}: failure or uncertain copy is visible before submission")
            pre_submit = [doc for doc in documents if doc.get("surface") == "modal" and doc.get("width") == width
                          and (str(doc.get("state", "")).startswith("step-") or doc.get("state") == "final")]
            if any(contains(normalize(doc.get("text", "")), value) for doc in pre_submit for value in state_copy):
                failures.append(f"modal {width}: failure or uncertain copy is visible in a pre-submit step")
            if capture.get("synthetic_submissions_attempted", 0) == 0:
                errors = [doc for doc in documents if doc.get("surface") == "modal"
                          and doc.get("width") == width and doc.get("state") == "submission-error"]
                if len(errors) != 1 or not any(contains(normalize(errors[0].get("text", "")), value) for value in state_copy):
                    failures.append(f"modal {width}: read-only capture must show actual failure or uncertain copy after a blocked submission")
        rows.append({"surface": "modal_state_copy", "initial_hidden": True,
                     "read_only_error_captured": capture.get("synthetic_submissions_attempted", 0) == 0})
    if catalogue_enabled:
        pdf = capture.get("pdf", {})
        if not isinstance(pdf,dict):pdf={}
        if not pdf.get("sha256") or pdf.get("sha256") != pdf.get("served_sha256"):
            failures.append("The downloaded brochure does not match the checked local PDF.")
        approved_asset = master.get("brochure", {}).get("approved_asset")
        if approved_asset:
            if approved_asset.get("origin") != "supplied" or pdf.get("sha256") != approved_asset.get("sha256"):
                failures.append("The served PDF differs from the supplied asset recorded in the approved master.")
            rows.append({"surface": "brochure", "mode": "unchanged_supplied_asset"})
        else:
            try:
                phrases = [value for _, value in expected["brochure"]]
                text = normalize(pdf_body(pdf.get("text", ""), pdf.get("page_count", 0), phrases + neutral))
                missing = [key for key, value in expected["brochure"] if not contains(text, value)]
                unexpected = extra_text(text, phrases + neutral)
                if missing:
                    failures.append("brochure: approved wording missing or changed at " + ", ".join(missing[:12]))
                if unexpected:
                    failures.append("brochure: unapproved rendered text: " + unexpected[:240])
                rows.append({"surface": "brochure", "mode": "text", "missing": missing, "unexpected": unexpected})
            except (ValueError, TypeError) as error:
                failures.append(str(error))
    return {"passed": not failures, "failures": failures, "surfaces": rows}


def audit(root, capture_path=None):
    import check_gates
    root = Path(root).resolve()
    master_path = root / "build/page-copy.json"
    capture_path = check_gates.resolve_inside(root, capture_path or "build/rendered-copy/capture.json")
    capture = read(capture_path)
    snapshot = read(root / "build/gate-snapshot.json")
    master = read(master_path)
    result = compare(master, read(root / "funnel.json"), capture)
    failures = result["failures"]
    if capture.get('schema_version') != 1 or capture.get('gate') != 'rendered_copy_capture' or not capture.get('execution',{}).get('command'):
        failures.append('Capture must identify the actual executed browser capture.')
    target = urlsplit(capture.get('target',{}).get('url',''))
    if target.scheme not in {'http','https'} or not target.hostname or target.username or target.password or target.query or target.fragment:
        failures.append('Copy capture needs the actual HTTP(S) destination without credentials or query data.')
    if not capture.get('documents') or any(not doc.get('state') or not str(doc.get('path','')).startswith('/') for doc in capture.get('documents',[])):
        failures.append('Each capture must identify its actual state and public path.')
    if capture.get("copy_sha256") != sha(master_path):
        failures.append("The canonical copy changed after rendered capture.")
    if capture.get("source_fingerprint") != snapshot.get("source_fingerprint") or check_gates.source_snapshot(root)["source_fingerprint"] != snapshot.get("source_fingerprint"):
        failures.append("Rendered capture is not for the current source snapshot.")
    if capture.get("target", {}).get("mode") != snapshot.get("mode"):
        failures.append("Rendered capture and gate snapshot modes differ.")
    if check_gates.parsed_time(capture.get("executed_at", "")) < check_gates.parsed_time(snapshot["created_at"]):
        failures.append("Rendered capture predates the source snapshot.")
    if (check_gates.parsed_time(capture.get('executed_at','')) - datetime.now(timezone.utc)).total_seconds() > 300:
        failures.append('Rendered capture timestamp is in the future.')
    artifacts = [{"type": "copy_master", "path": "build/page-copy.json", "sha256": sha(master_path)},
                 {"type": "rendered_copy_capture", "path": capture_path.relative_to(root).as_posix(), "sha256": sha(capture_path)}]
    if capture.get("pdf"):
        pdf = check_gates.resolve_inside(root, capture["pdf"]["path"])
        if sha(pdf) != capture["pdf"].get("sha256"):
            failures.append("The PDF changed after rendered capture.")
        artifacts.append({"type": "pdf", "path": pdf.relative_to(root).as_posix(), "sha256": sha(pdf)})
    asset = master.get('brochure',{}).get('approved_asset')
    if asset:
        if Path(asset['path']).is_absolute():raise ValueError('Supplied brochure paths must be project-relative.')
        supplied = check_gates.resolve_inside(root,asset['path'])
        if not supplied.read_bytes().startswith(b'%PDF-') or sha(supplied) != asset.get('sha256'):
            failures.append('The supplied approved brochure has changed or is not a PDF.')
        artifacts.append({'type':'supplied_brochure','path':supplied.relative_to(root).as_posix(),'sha256':sha(supplied)})
    result["passed"] = not failures
    return {"schema_version": 1, "gate": "rendered_copy", "status": "blocked" if failures else "pass",
            "source_fingerprint": snapshot["source_fingerprint"], "executed_at": datetime.now(timezone.utc).isoformat(),
            "target": capture["target"], "tool": {"name": "copy_parity", "version": "1.0.0"},
            "execution": {"kind": "automated", "command": ["python3", "scripts/copy_parity.py", str(root)], "exit_code": 1 if failures else 0},
            "checks": {"approved_wording_matches": not failures}, "copy_sha256": sha(master_path),
            "comparison": result, "artifacts": artifacts, "failures": failures, "warnings": [],
            "limits": ["This checks rendered DOM/PDF wording; actual visual review remains required for clipping, contrast, text baked into images, and meaning.",
                       "A parity pass does not grant or authenticate user approval.",
                       "Responsive wording is expected to remain consistent. Reveal custom accordions through the reviewed fixture's copy_interactions."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--capture")
    parser.add_argument("--out", default="build/rendered-copy/result.json")
    args = parser.parse_args()
    try:
        import check_gates
        root = args.project_root.resolve()
        result = audit(root, args.capture)
        output = check_gates.resolve_inside(root, args.out)
        if not output.relative_to(root).as_posix().startswith("build/"):
            raise ValueError("Keep copy comparison evidence under build/.")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps({"status": result["status"], "failures": result["failures"], "report": str(output)}, indent=2))
        return 1 if result["status"] == "blocked" else 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "blocked", "failures": [str(error)]}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
