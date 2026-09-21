#!/usr/bin/env python3
"""Static checks for the lightweight landing-page core."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
REMOTE = {"http", "https", "mailto", "tel", "data", "javascript"}
IMAGE_ROLES = {"decorative", "proof", "portrait", "diagram", "screenshot", "illustrative"}
RESEARCH_VOICE = re.compile(
    r"\bthe\s+(?:published|official)\s+service\s+(?:list|range)\s+(?:includes|lists|describes)\b",
    re.I,
)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.headings: list[tuple[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.forms: list[dict[str, object]] = []
        self.form_targets: set[str] = set()
        self.dialogs: list[dict[str, str]] = []
        self.fields: list[dict[str, object]] = []
        self.labels_for: set[str] = set()
        self.links: list[dict[str, str]] = []
        self.buttons: list[dict[str, str]] = []
        self.local_refs: list[str] = []
        self.meta: list[dict[str, str]] = []
        self.ids: set[str] = set()
        self.landmarks: set[str] = set()
        self.current_heading: dict[str, object] | None = None
        self.visitor_text: list[str] = []
        self.base_url = ""

    def handle_starttag(self, tag: str, attrs) -> None:
        data = {key: (value or "") for key, value in attrs}
        if tag == "base" and not self.base_url:
            self.base_url = data.get("href", "")
        ancestors = list(self.stack)
        if data.get("id"):
            self.ids.add(data["id"])
        if tag in {"main", "header", "footer", "nav"}:
            self.landmarks.add(tag)
        if tag == "meta":
            self.meta.append(data)
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.current_heading = {"tag": tag, "text": []}
        if tag == "img":
            self.images.append(data)
        if tag == "form":
            self.forms.append({"attrs": data, "fields": []})
            self.form_targets.update(parent["id"] for _, parent in ancestors if parent.get("id"))
            if data.get("id"):
                self.form_targets.add(data["id"])
        if tag == "dialog" or data.get("role") == "dialog":
            self.dialogs.append(data)
        if tag in {"input", "select", "textarea"}:
            parent_label = any(parent_tag == "label" for parent_tag, _ in ancestors)
            field = {"tag": tag, "attrs": data, "parent_label": parent_label}
            self.fields.append(field)
            if self.forms:
                self.forms[-1]["fields"].append(field)
        if tag == "label" and data.get("for"):
            self.labels_for.add(data["for"])
        if tag == "a":
            self.links.append(data)
        if tag == "button":
            self.buttons.append(data)
        for attr in ("src", "href", "poster"):
            if data.get(attr):
                self.local_refs.append(data[attr])
        if data.get("srcset"):
            for part in data["srcset"].split(","):
                candidate = part.strip().split()[0] if part.strip() else ""
                if candidate:
                    self.local_refs.append(candidate)
        if tag not in VOID:
            self.stack.append((tag, data))

    def handle_endtag(self, tag: str) -> None:
        if self.current_heading and self.current_heading["tag"] == tag:
            text = re.sub(r"\s+", " ", "".join(self.current_heading["text"])).strip()
            self.headings.append((tag, text))
            self.current_heading = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if self.current_heading:
            self.current_heading["text"].append(data)
        tags = {tag for tag, _ in self.stack}
        if tags.intersection({"body", "main"}) and not tags.intersection({"script", "style", "template", "blockquote"}):
            self.visitor_text.append(data)


def parse(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def is_local(value: str) -> bool:
    if not value or value.startswith(("#", "//")):
        return False
    return urlsplit(value).scheme.lower() not in REMOTE


def resolve_ref(root: Path, document: Path, value: str) -> Path:
    clean = unquote(urlsplit(value).path)
    return root / clean.lstrip("/") if clean.startswith("/") else document.parent / clean


def has_label(field: dict[str, object], labels_for: set[str]) -> bool:
    attrs = field["attrs"]
    if field["parent_label"]:
        return True
    if attrs.get("aria-label") or attrs.get("aria-labelledby"):
        return True
    return bool(attrs.get("id") and attrs["id"] in labels_for)


def main() -> int:
    argp = argparse.ArgumentParser(description=__doc__)
    argp.add_argument("project_root", type=Path)
    argp.add_argument("--report", type=Path, help="Output path, relative to the current working directory or absolute")
    argp.add_argument("--allow-multiple-forms", action="store_true")
    argp.add_argument("--source-site", action="append", default=[], help="Official business URL whose visitor-facing links are prohibited; repeat for additional domains")
    argp.add_argument("--omit-brochure-reason", default="", help="Source-supported buyer rationale, also recorded in the strategy brief")
    args = argp.parse_args()

    project = args.project_root.expanduser().resolve()
    root = project / "public" if (project / "public" / "index.html").is_file() else project
    index_path = root / "index.html"
    failures: list[str] = []
    warnings: list[str] = []
    checks: dict[str, object] = {}
    source_hosts = set()
    for site in args.source_site:
        parsed_site = urlsplit(site)
        if parsed_site.scheme not in {"http", "https"} or not parsed_site.hostname:
            failures.append("--source-site must be a complete http(s) business URL")
            continue
        source_hosts.add(parsed_site.hostname.lower().rstrip(".").removeprefix("www."))
    if not index_path.is_file():
        failures.append("Missing index.html")
        documents: list[tuple[Path, PageParser]] = []
    else:
        documents = [(path, parse(path)) for path in sorted(root.rglob("*.html"))]

    index = documents[0][1] if documents and documents[0][0] == index_path else (parse(index_path) if index_path.is_file() else None)
    if index:
        h1s = [text for tag, text in index.headings if tag == "h1"]
        checks["h1_count"] = len(h1s)
        if len(h1s) != 1:
            failures.append(f"Expected one H1 in index.html; found {len(h1s)}")
        if any(not text for text in h1s):
            failures.append("The H1 is empty")

        viewport = next((meta.get("content", "") for meta in index.meta if meta.get("name", "").lower() == "viewport"), "")
        checks["viewport"] = viewport
        if "width=device-width" not in viewport.replace(" ", "").lower():
            failures.append("Viewport meta must include width=device-width")
        if re.search(r"user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0+)?(?:\D|$)", viewport, re.I):
            failures.append("Viewport settings disable or severely limit zoom")

        if "main" not in index.landmarks:
            failures.append("index.html needs a main landmark")
        if "footer" not in index.landmarks:
            warnings.append("index.html has no footer landmark")
        has_skip = any(link.get("href", "").startswith("#") and "skip" in (link.get("class", "") + " " + link.get("aria-label", "")).lower() for link in index.links)
        if not has_skip:
            failures.append("No keyboard skip link found")

        if len(index.forms) > 1 and not args.allow_multiple_forms:
            failures.append(f"Found {len(index.forms)} forms; use one conversion form unless multiple forms are intentional")

        form_jumps = [
            link.get("href", "") for link in index.links
            if "data-primary-action" in link
            and link.get("href", "").startswith("#")
            and unquote(link["href"][1:]) in index.form_targets
            and "data-open-modal" not in link
        ]
        checks["primary_form_section_jumps"] = form_jumps
        if form_jumps:
            failures.append("Form-entry CTAs must open the shared popup, not jump to a form section: " + "; ".join(form_jumps))
        openers = [control for control in index.links + index.buttons if "data-open-modal" in control]
        if openers and not index.dialogs:
            failures.append("Modal openers are present but no dialog markup was found; browser behavior still requires verification")

    missing_assets: list[str] = []
    image_issues: list[str] = []
    form_issues: list[str] = []
    dead_links: list[str] = []
    privacy_present = False
    contact_fields = False
    raw_scripts: list[str] = []
    research_voice: list[str] = []
    main_site_exits: list[str] = []
    linked_pdfs: set[str] = set()

    for document, parser in documents:
        rel = document.relative_to(root).as_posix()
        for match in RESEARCH_VOICE.finditer(" ".join(parser.visitor_text)):
            research_voice.append(f"{rel}: {match.group(0)}")
        for reference in parser.local_refs:
            if is_local(reference) and not resolve_ref(root, document, reference).exists():
                missing_assets.append(f"{rel}: {reference}")
        for link in parser.links:
            href = link.get("href", "").strip()
            destination = urljoin(parser.base_url, href) if parser.base_url else href
            host = (urlsplit(destination).hostname or "").lower().rstrip(".")
            if any(host == source or host.endswith("." + source) for source in source_hosts):
                main_site_exits.append(f"{rel}: {href}")
            if not rel.startswith("admin/") and is_local(destination) and urlsplit(destination).path.lower().endswith(".pdf"):
                pdf = resolve_ref(root, document, destination).resolve()
                if pdf.is_relative_to(root) and pdf.is_file():
                    with pdf.open("rb") as stream:
                        if stream.read(5) == b"%PDF-":
                            linked_pdfs.add(pdf.relative_to(root).as_posix())
            if href.lower().startswith(("privacy", "/privacy")) or "privacy" in href.lower():
                privacy_present = True
            if not href or href == "#":
                dead_links.append(f"{rel}: empty or hash-only link")
            if link.get("target") == "_blank" and "noopener" not in link.get("rel", "").split():
                warnings.append(f"{rel}: target=_blank link should include rel=noopener")
        for button in parser.buttons:
            if not button.get("type"):
                warnings.append(f"{rel}: button without explicit type")
        for image in parser.images:
            src = image.get("src", "<unknown>")
            role = image.get("data-image-role", "")
            alt_present = "alt" in image
            alt = image.get("alt", "")
            if role not in IMAGE_ROLES:
                image_issues.append(f"{rel}: {src} lacks a valid data-image-role")
            if not alt_present:
                image_issues.append(f"{rel}: {src} lacks alt")
            elif role == "decorative" and alt:
                image_issues.append(f"{rel}: decorative image {src} must use empty alt")
            elif role and role != "decorative" and not alt.strip():
                image_issues.append(f"{rel}: meaningful image {src} needs alt text")
            if image.get("data-content-bearing", "").lower() == "true" and role == "decorative":
                image_issues.append(f"{rel}: content-bearing image {src} cannot be decorative")
            if not image.get("width") or not image.get("height"):
                warnings.append(f"{rel}: image missing explicit dimensions: {src}")
        for field in parser.fields:
            attrs = field["attrs"]
            if attrs.get("type", "").lower() == "hidden" or attrs.get("name") == "website":
                continue
            if not has_label(field, parser.labels_for):
                form_issues.append(f"{rel}: unlabeled field {attrs.get('name') or attrs.get('id') or field['tag']}")
            if attrs.get("required") is not None and not (attrs.get("aria-describedby") or attrs.get("data-native-validation") == "true"):
                warnings.append(f"{rel}: required field {attrs.get('name', '<unnamed>')} has no described custom error marker")
            if attrs.get("name", "").lower() in {"name", "first_name", "last_name", "email", "phone", "address"}:
                contact_fields = True

    for script in root.rglob("*.js"):
        try:
            raw_scripts.append(script.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError):
            pass
    for stylesheet in root.rglob("*.css"):
        try:
            css = stylesheet.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for match in re.finditer(r"url\(\s*['\"]?([^)\'\"]+)", css):
            reference = match.group(1).strip()
            if is_local(reference) and not resolve_ref(root, stylesheet, reference).exists():
                missing_assets.append(f"{stylesheet.relative_to(root).as_posix()}: {reference}")

    checks["missing_local_assets"] = sorted(set(missing_assets))
    checks["image_issues"] = sorted(set(image_issues))
    checks["form_issues"] = sorted(set(form_issues))
    checks["dead_links"] = sorted(set(dead_links))
    checks["research_voice_copy"] = sorted(set(research_voice))
    checks["main_site_exits"] = sorted(set(main_site_exits))
    checks["source_site_hosts_checked"] = sorted(source_hosts)
    checks["linked_pdfs"] = sorted(linked_pdfs)
    checks["brochure_omission_reason"] = args.omit_brochure_reason.strip()
    if main_site_exits:
        failures.append("Paid-ad funnel links back to the main business website: " + "; ".join(sorted(set(main_site_exits))))
    if not linked_pdfs:
        if args.omit_brochure_reason.strip():
            warnings.append("PDF omitted: independently review the source-supported rationale in the strategy brief")
        else:
            failures.append("No linked local PDF with a valid PDF signature; provide the useful document or a researched omission reason")
    if not source_hosts:
        warnings.append("Main-site exit check needs --source-site with the official business URL")
    if research_voice:
        failures.append("Source-research phrasing in visitor copy; state the business service directly: " + "; ".join(sorted(set(research_voice))))
    invalid_downloads = []
    for asset in (root / "assets").rglob("*"):
        if not asset.is_file() or asset.suffix.lower() not in {".txt", ".md"}:
            continue
        if not re.search(r"(?:^|[-_.])(?:licen[sc]e|ofl|copying)(?:[-_.]|$)", asset.name, re.I):
            continue
        text = asset.read_text(encoding="utf-8", errors="replace").strip()
        if not text or re.match(r"(?:404[ :]|403[ :]|not found$|access denied$)", text, re.I):
            invalid_downloads.append(asset.relative_to(root).as_posix())
    checks["invalid_license_downloads"] = invalid_downloads
    if invalid_downloads:
        failures.append("Licence files contain an empty or failed download: " + "; ".join(invalid_downloads))
    if missing_assets:
        failures.append("Missing local assets: " + "; ".join(sorted(set(missing_assets))))
    if image_issues:
        failures.append("Image contract failures: " + "; ".join(sorted(set(image_issues))))
    if form_issues:
        failures.append("Form accessibility failures: " + "; ".join(sorted(set(form_issues))))
    if dead_links:
        failures.append("Dead links: " + "; ".join(sorted(set(dead_links))))
    if contact_fields and not privacy_present:
        failures.append("A contact form is present but no privacy destination was found")

    corpus = "\n".join(raw_scripts)
    pii_keys: list[str] = []
    for argument in re.findall(r"(?:window\.)?dataLayer\s*\.\s*push\s*\(([^;]+?)\)\s*;", corpus, re.I | re.S):
        pii_keys.extend(re.findall(r"(?:^|[,\{])\s*['\"]?(email|phone|name|first_name|last_name|address)['\"]?\s*:", argument, re.I))
    pii_keys = sorted(set(key.lower() for key in pii_keys))
    if pii_keys:
        failures.append("Potential raw contact fields in an analytics payload: " + ", ".join(pii_keys))
    checks["potential_raw_analytics_fields"] = pii_keys

    status = "blocked" if failures else ("pass_with_warnings" if warnings else "pass")
    result = {
        "schema_version": 1,
        "gate": "static-page",
        "status": status,
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "failures": failures,
        "warnings": sorted(set(warnings)),
    }
    rendered = json.dumps(result, indent=2, ensure_ascii=True) + "\n"
    if args.report:
        report = args.report.resolve()
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(rendered, encoding="utf-8")
    sys.stdout.write(rendered)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
