#!/usr/bin/env python3
"""Static integrity checks for a branded lead-funnel project."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


REMOTE_SCHEMES = {"http", "https", "mailto", "tel", "data", "javascript"}


class FunnelParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.forms: list[dict[str, object]] = []
        self.images: list[dict[str, str]] = []
        self.fields: list[dict[str, str]] = []
        self.local_refs: list[str] = []
        self.cta_stack: list[dict[str, object]] = []
        self.cta_texts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        data = {key: (value or "") for key, value in attrs}
        ancestors = list(self.stack)
        if tag == "form":
            in_modal = any(
                item_attrs.get("id") == "lead-modal"
                or "modal" in item_attrs.get("class", "").split()
                for _, item_attrs in ancestors
            )
            self.forms.append({"attrs": data, "in_modal": in_modal})
        if tag in {"input", "select", "textarea"} and data.get("name") and data["name"] != "website":
            self.fields.append(data)
        if tag == "img":
            self.images.append(data)
        if tag in {"a", "button"} and ("data-open-modal" in data or "data-submit" in data):
            self.cta_stack.append({"tag": tag, "text": []})
        for attr in ("src", "href", "poster"):
            if data.get(attr):
                self.local_refs.append(data[attr])
        if data.get("srcset"):
            for part in data["srcset"].split(","):
                candidate = part.strip().split()[0] if part.strip() else ""
                if candidate:
                    self.local_refs.append(candidate)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append((tag, data))

    def handle_endtag(self, tag: str) -> None:
        if self.cta_stack and self.cta_stack[-1]["tag"] == tag:
            capture = self.cta_stack.pop()
            text = re.sub(r"\s+", " ", "".join(capture["text"])).strip()
            if text:
                self.cta_texts.append(text)
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        for capture in self.cta_stack:
            capture["text"].append(data)


def is_local_reference(value: str) -> bool:
    if not value or value.startswith(("#", "//")):
        return False
    return urlsplit(value).scheme.lower() not in REMOTE_SCHEMES


def resolve_reference(root: Path, document: Path, value: str) -> Path:
    clean = unquote(urlsplit(value).path)
    if clean.startswith("/"):
        return root / clean.lstrip("/")
    return document.parent / clean


def parse_html(path: Path) -> FunnelParser:
    parser = FunnelParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


# Scaffold wording that must never reach a visitor (Absolute rule 5: no visible sample content).
PLACEHOLDER_TEXT = re.compile(r"This is a development template|Replace this starter with your approved client content|Replace it with the client's approved privacy policy|WORKFLOW_TEMPLATE_INCOMPLETE|lorem ipsum", re.I)


# Attributes that open the enquiry form; the confirmation page must not keep any.
ENQUIRY_OPENERS = ("data-open-modal", "data-form-open", "data-open-form", "data-enquiry-cta", "data-quote-cta")


def script_sources(html: str) -> list[str]:
    return [src.split("?")[0].rsplit("/", 1)[-1] for src in re.findall(r"<script\b[^>]*\bsrc=[\"']([^\"']+)[\"']", html, re.I)]


def form_behavior_failures(project_root: Path, index_text: str, thank_text: str, has_form: bool) -> list[str]:
    """Behavior the page must share with its conversion contract and the Worker."""
    failures = []
    funnel_path = project_root / "funnel.json"
    funnel = json.loads(funnel_path.read_text()) if funnel_path.is_file() else {}
    defaults = {field.get("name"): field.get("default") for field in funnel.get("form_fields", []) if isinstance(field, dict)}
    for tag in re.findall(r"<input\b[^>]*>", index_text, re.I):
        if not re.search(r"\btype=[\"']tel[\"']", tag, re.I):
            continue
        pattern = re.search(r"\bpattern=[\"']([^\"']*)[\"']", tag, re.I)
        if not pattern:
            continue
        try:
            accepts = [value for value in ("-------", "(((  )))", "+ + + +") if re.fullmatch(pattern.group(1), value)]
        except re.error:
            continue
        if accepts:
            failures.append(f"The phone pattern {pattern.group(1)!r} accepts {accepts[0]!r}; count digits (at least 7) the way the Worker does, or remove the pattern and rely on the bundled script")
    for attrs, body in re.findall(r"<select\b([^>]*)>(.*?)</select>", index_text, re.I | re.S):
        if not re.search(r"\brequired\b", attrs, re.I):
            continue
        name = (re.search(r"\bname=[\"']([^\"']+)[\"']", attrs) or [None, "select"])[1]
        first = re.search(r"<option\b([^>]*)>(.*?)</option>", body, re.I | re.S)
        if not first:
            continue
        value_attr = re.search(r"\bvalue=[\"']([^\"']*)[\"']", first.group(1))
        value = value_attr.group(1) if value_attr else re.sub(r"<[^>]+>", "", first.group(2)).strip()
        if value and defaults.get(name) != value:
            failures.append(f"Required select {name!r} preselects {value!r}; start with an empty prompt option, or declare \"default\": {value!r} for it in funnel.json form_fields")
    crm = (project_root / "src/site-config.json").is_file()
    if has_form:
        kept = [name for name in ENQUIRY_OPENERS if name in thank_text] + (["<form>"] if re.search(r"<form\b", thank_text, re.I) else []) + (["#lead-modal"] if 'id="lead-modal"' in thank_text else [])
        if kept:
            failures.append("thank-you.html still offers the enquiry (" + ", ".join(kept) + "); a confirmation page links to the guide instead of reopening the form")
    if crm and has_form:
        scripts = script_sources(index_text)
        if "funnel.js" not in scripts or ("script.js" in scripts and scripts.index("funnel.js") > scripts.index("script.js")):
            failures.append("index.html must load funnel.js before script.js; without it the form sends no attribution and never writes the confirmation receipt")
        thank_scripts = script_sources(thank_text)
        if "funnel.js" not in thank_scripts:
            failures.append("thank-you.html must load funnel.js so the confirmation can read the receipt")
        if "data-confirmed-only" in thank_text and "confirmation.js" not in thank_scripts:
            failures.append("thank-you.html has confirmed-only content but does not load confirmation.js, so it can never show")
    return failures


def main() -> int:
    argp = argparse.ArgumentParser(description=__doc__)
    argp.add_argument("project_root", type=Path)
    argp.add_argument("--cta", default="")
    argp.add_argument("--brochure", default="")
    argp.add_argument("--allow-inline-form", action="store_true")
    argp.add_argument("--require-webhook", action="store_true")
    argp.add_argument("--report", type=Path)
    argp.add_argument("--snapshot", type=Path)
    args = argp.parse_args()

    project_root = args.project_root.expanduser().resolve()
    root = project_root / "public" if (project_root / "public").is_dir() else project_root
    gate_meta = {}
    if args.snapshot:
        snapshot_path = args.snapshot if args.snapshot.is_absolute() else project_root / args.snapshot
        snapshot = json.loads(snapshot_path.read_text())
        gate_meta = {"gate": "static", "schema_version": 1, "source_fingerprint": snapshot["source_fingerprint"], "executed_at": datetime.now(timezone.utc).isoformat(), "tool": {"name": "validate_funnel", "version": "2.0"}, "target": {"mode": snapshot["mode"], "url": ""}}
    failures: list[str] = []
    warnings: list[str] = []
    checks: dict[str, object] = {}

    required = ["index.html", "thank-you.html", "styles.css", "script.js"]
    missing_required = [name for name in required if not (root / name).is_file()]
    checks["required_files"] = not missing_required
    if missing_required:
        failures.append("Missing required files: " + ", ".join(missing_required))

    if missing_required:
        result = {**gate_meta, "status": "blocked", "checks": checks, "failures": failures, "warnings": warnings}
        print(json.dumps(result, indent=2))
        return 1

    index_path = root / "index.html"
    thank_path = root / "thank-you.html"
    index_text = index_path.read_text(encoding="utf-8")
    thank_text = thank_path.read_text(encoding="utf-8")
    css_text = (root / "styles.css").read_text(encoding="utf-8")
    js_text = (root / "script.js").read_text(encoding="utf-8")
    index = parse_html(index_path)
    thank = parse_html(thank_path)

    server_config = project_root / "src/site-config.json"
    if server_config.exists():
        site = json.loads(server_config.read_text())
        client_names = {field["name"] for field in index.fields}
        server_names = {field["name"] for field in site["formFields"]}
        checks["form_schema_matches"] = client_names == server_names
        if client_names != server_names:
            failures.append(f"Browser/server form fields differ: browser-only={sorted(client_names-server_names)}, server-only={sorted(server_names-client_names)}")
        configured_mode = site.get("analyticsMode", "consent")
        mode_match = re.search(r'data-analytics-mode=["\']([^"\']+)', index_text)
        if not mode_match or mode_match.group(1) != configured_mode:
            failures.append("Browser analytics mode differs from the server configuration")
    checks["form_count"] = len(index.forms)
    if len(index.forms) != 1:
        failures.append(f"Expected exactly one form in index.html; found {len(index.forms)}")
    elif not args.allow_inline_form and not index.forms[0]["in_modal"]:
        failures.append("The only form is not inside the lead modal")

    if index.forms:
        attrs = index.forms[0]["attrs"]
        action = str(attrs.get("action", ""))
        checks["form_action"] = action
        if "thank-you" not in action and "thank-you" not in js_text:
            failures.append("No thank-you destination found in the form or script")
        webhook = str(attrs.get("data-endpoint") or attrs.get("data-webhook", "")).strip()
        local_preview = str(attrs.get("data-local-preview", "")).lower() == "true"
        checks["webhook_configured"] = bool(webhook)
        if not webhook:
            message = "Lead endpoint is not configured"
            if args.require_webhook:
                failures.append(message)
            else:
                warnings.append(message + ("; local preview is explicit" if local_preview else ""))

    failures += form_behavior_failures(project_root, index_text, thank_text, bool(index.forms))

    if args.cta:
        cta_texts = index.cta_texts
        checks["cta_texts"] = cta_texts
        checks["cta_count"] = len(cta_texts)
        if len(cta_texts) < 2:
            failures.append(f"Found only {len(cta_texts)} CTA control(s)")
        variants = sorted({text for text in cta_texts if text != args.cta})
        if variants:
            failures.append("CTA controls use inconsistent text: " + "; ".join(variants))

    if args.brochure:
        brochure = root / args.brochure
        checks["brochure_exists"] = brochure.is_file()
        if not brochure.is_file():
            failures.append(f"Brochure missing: {args.brochure}")
        if args.brochure not in thank_text:
            failures.append("Thank-you page does not link the expected brochure")

    documents = [(path, parse_html(path)) for path in sorted(root.rglob("*.html"))]
    for path, _ in documents:
        content = path.read_text()
        stripped = re.sub(r"<!--.*?-->", "", content, flags=re.S)
        if re.search(r"\{\{\s*[A-Z][A-Z0-9_]*\s*\}\}|\[\[(?:HEADLINE|CTA|CLIENT_NAME)\]\]", stripped):
            failures.append(f"Unresolved template marker in {path.name}")
        # Browsers recover from a repeated declaration, so only a structural check catches an export that concatenated pages.
        structure = {name: len(re.findall(pattern, stripped, re.I)) for name, pattern in
                     (("<!DOCTYPE html>", r"<!doctype\s+html\b"), ("<html>", r"<html\b"), ("<head>", r"<head\b"), ("<body>", r"<body\b"))}
        # HTML5 allows omitted <head>/<body> tags, but never a missing or repeated declaration or a second document.
        repeated = [name for name, count in structure.items() if count > 1 or (name == "<!DOCTYPE html>" and count != 1)]
        if repeated:
            failures.append(f"{path.relative_to(root)} must be one well-formed document; found " + ", ".join(f"{name} x{structure[name]}" for name in repeated))
        placeholder = PLACEHOLDER_TEXT.search(re.sub(r"<[^>]+>", " ", stripped))
        if placeholder:
            failures.append(f"Visible starter/placeholder text in {path.name}: {placeholder.group(0)!r}. Replace it with the business's approved content before QA.")
    if not re.search(r'<meta[^>]+(?:name=[\"\']robots[\"\'][^>]+content=[\"\'][^\"\']*noindex|content=[\"\'][^\"\']*noindex[^>]+name=[\"\']robots)', thank_text, re.I):
        warnings.append("Thank-you page should declare noindex")
    missing_assets: list[str] = []
    for document, parser in documents:
        for reference in parser.local_refs:
            if not is_local_reference(reference):
                continue
            if reference.startswith(("/api/", "/admin", "/login")) and (project_root / "wrangler.jsonc").exists():
                continue
            target = resolve_reference(root, document, reference)
            if not target.exists():
                missing_assets.append(f"{document.name}: {reference}")
    for css_path in root.rglob("*.css"):
        for match in re.finditer(r"url\(\s*['\"]?([^)'\"]+)", css_path.read_text()):
            reference = match.group(1).strip()
            if is_local_reference(reference) and not resolve_reference(root, css_path, reference).exists():
                missing_assets.append(f"{css_path.relative_to(root)}: {reference}")
    checks["missing_local_assets"] = missing_assets
    if missing_assets:
        failures.append("Missing local assets: " + "; ".join(sorted(set(missing_assets))))

    undimensioned = [
        image.get("src", "<unknown>")
        for parser in (index, thank)
        for image in parser.images
        if not image.get("width") or not image.get("height")
    ]
    checks["images_without_dimensions"] = undimensioned
    if undimensioned:
        warnings.append("Images missing explicit dimensions: " + ", ".join(undimensioned))

    external_font_hosts = [host for host in ("fonts.googleapis.com", "fonts.gstatic.com") if host in index_text + thank_text + css_text]
    checks["external_font_hosts"] = external_font_hosts
    if external_font_hosts:
        warnings.append("External font hosts remain: " + ", ".join(external_font_hosts))

    extra_scripts = []
    for document, parser in ((index_path, index), (thank_path, thank)):
        for reference in parser.local_refs:
            if is_local_reference(reference) and urlsplit(reference).path.endswith(".js"):
                candidate = resolve_reference(root, document, reference)
                if candidate.is_file(): extra_scripts.append(candidate.read_text())
    script_corpus = "\n".join((index_text, thank_text, js_text, *extra_scripts))
    raw_pii_findings: list[str] = []
    ambiguous_pushes: list[str] = []
    push_args = re.findall(r"(?:window\.)?dataLayer\s*\.\s*push\s*\(([^;]+?)\)\s*;", script_corpus, re.S)
    for argument in push_args:
        stripped = argument.strip()
        if stripped == "arguments" and re.search(r"window\.gtag\s*=\s*window\.gtag\s*\|\|\s*function\(\)\s*\{\s*window\.dataLayer\.push\(arguments\)", script_corpus):
            continue
        bodies = [stripped] if stripped.startswith("{") else []
        if re.fullmatch(r"[A-Za-z_$][\w$]*", stripped):
            assignments = re.findall(
                rf"(?:const|let|var)\s+{re.escape(stripped)}\s*=\s*\{{(.*?)\}}\s*;",
                script_corpus,
                re.S,
            )
            if assignments:
                bodies.extend(assignments)
            else:
                ambiguous_pushes.append(stripped)
        for body in bodies:
            keys = re.findall(r"(?:^|[,{{])\s*['\"]?(email|phone|name|first_name|last_name|address)['\"]?\s*:", body, re.I)
            raw_pii_findings.extend(key.lower() for key in keys)
            shorthand = re.findall(r"(?:^|[,{{])\s*(email|phone|name|first_name|last_name|address)\s*(?=[,}}]|$)", body, re.I)
            raw_pii_findings.extend(key.lower() for key in shorthand)
    raw_pii_findings.extend(
        key for key in ("user_email", "user_phone", "user_name", "raw_email", "raw_phone")
        if key in script_corpus
    )
    checks["raw_pii_analytics_keys"] = sorted(set(raw_pii_findings))
    checks["ambiguous_datalayer_pushes"] = sorted(set(ambiguous_pushes))
    if raw_pii_findings:
        failures.append("Potential raw PII in analytics payloads: " + ", ".join(sorted(set(raw_pii_findings))))
    if ambiguous_pushes:
        warnings.append("Could not prove these dataLayer payloads exclude raw PII: " + ", ".join(sorted(set(ambiguous_pushes))))

    checks["modal_hooks"] = all(token in index_text + js_text for token in ("lead-modal", "data-open-modal", "Escape"))
    if not checks["modal_hooks"]:
        failures.append("Modal open/close/Escape hooks are incomplete")

    status = "blocked" if failures else ("pass_with_warnings" if warnings else "pass")
    result = {**gate_meta, "status": status, "checks": checks, "failures": failures, "warnings": warnings}
    rendered = json.dumps(result, indent=2) + "\n"
    if args.report:
        report_path = args.report if args.report.is_absolute() else project_root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(rendered, encoding="utf-8")
    sys.stdout.write(rendered)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
