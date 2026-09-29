#!/usr/bin/env python3
"""Build or check a single-file HTML preview for viewers that isolate one file.

Chat and file viewers often open an HTML file without its sibling CSS, scripts
and images, so a multi-file page renders unstyled or blank. `build` inlines
every local stylesheet, script, image, font and embedded document (such as the
guide reader's PDF) as the page would load it and adds a visible preview-only
notice. `check` reports the relative resources a file still depends on, so it
is never presented as a standalone preview while it would break. The multi-file
project remains the editable handoff.
"""
from __future__ import annotations
import argparse
import base64
import json
import mimetypes
from pathlib import Path
import re
import sys

EXTRA_TYPES = {".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".woff": "font/woff",
               ".svg": "image/svg+xml", ".ico": "image/x-icon"}
REMOTE = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", re.I)
STYLESHEET = re.compile(r"<link\b[^>]*\brel=[\"']?stylesheet[\"']?[^>]*>", re.I)
SCRIPT = re.compile(r"<script\b([^>]*)\bsrc=[\"']([^\"']+)[\"']([^>]*)>\s*</script>", re.I)
# Embedded documents (the thank-you guide reader) load like media, so they are inlined too.
MEDIA = re.compile(r"<(?:img|source|video|audio|iframe|embed|object)\b[^>]*>", re.I)
CSS_URL = re.compile(r"url\(\s*([\"']?)([^\"')]+)\1\s*\)", re.I)
NOTICE = ('<div data-preview-notice style="position:sticky;top:0;z-index:2147483647;padding:6px 12px;'
          'background:#fff3cd;color:#3d2e00;font:13px/1.4 system-ui,sans-serif;text-align:center">'
          'Self-contained preview: forms are disabled. The project files are the working version.</div>')


def attribute(tag, name):
    match = re.search(r"\b" + name + r"=[\"']([^\"']*)[\"']", tag, re.I)
    return match.group(1) if match else None


def local_references(html):
    """Relative resources an isolated viewer could not load (links to other pages are not resources)."""
    found = []
    for tag in STYLESHEET.findall(html):
        found.append(attribute(tag, "href"))
    found += [match.group(2) for match in SCRIPT.finditer(html)]
    for tag in MEDIA.findall(html):
        found += [attribute(tag, "src"), attribute(tag, "data")]
        for candidates in (attribute(tag, "srcset"), attribute(tag, "poster")):
            # Candidates are comma+space separated; a data: URI contains a bare comma.
            found += [part.strip().split()[0] for part in re.split(r",\s+", candidates or "") if part.strip()]
    for style in re.findall(r"<style\b[^>]*>(.*?)</style>", html, re.I | re.S) + re.findall(r"\bstyle=[\"']([^\"']*)[\"']", html, re.I):
        found += [match.group(2) for match in CSS_URL.finditer(style)]
    return sorted({value for value in found if value and not REMOTE.match(value.strip())})


class Inliner:
    def __init__(self, web_root):
        self.web_root = Path(web_root).resolve()

    def resolve(self, reference, base):
        clean = reference.split("#", 1)[0].split("?", 1)[0]
        path = (self.web_root / clean.lstrip("/")) if clean.startswith("/") else (base / clean)
        path = path.resolve()
        if not path.is_relative_to(self.web_root) or not path.is_file():
            raise ValueError("Preview resource is missing or outside the web root: " + reference)
        return path

    def data_uri(self, reference, base):
        path = self.resolve(reference, base)
        kind = EXTRA_TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return f"data:{kind};base64," + base64.b64encode(path.read_bytes()).decode()

    def css(self, text, base):
        def swap(match):
            value = match.group(2).strip()
            return match.group(0) if REMOTE.match(value) else f'url("{self.data_uri(value, base)}")'
        return CSS_URL.sub(swap, text)

    def page(self, path):
        path = Path(path).resolve()
        html = path.read_text(encoding="utf-8")
        base = path.parent

        def stylesheet(match):
            href = attribute(match.group(0), "href")
            if not href or REMOTE.match(href):
                return match.group(0)
            sheet = self.resolve(href, base)
            # HTML ends raw text on </style or </script in any letter case; <\/ is the same text in CSS and JS.
            return "<style>" + re.sub(r"</(style)", r"<\\/\1", self.css(sheet.read_text(encoding="utf-8"), sheet.parent), flags=re.I) + "</style>"

        html = STYLESHEET.sub(stylesheet, html)
        deferred = []

        def script(match):
            src = match.group(2)
            if REMOTE.match(src):
                return match.group(0)
            body = re.sub(r"</(script)", r"<\\/\1", self.resolve(src, base).read_text(encoding="utf-8"), flags=re.I)
            attributes = (match.group(1) + match.group(3)).strip()
            keep = re.sub(r"\b(?:defer|async)\b", "", attributes).strip()
            tag = f"<script {keep}>".replace("<script >", "<script>") + body + "</script>"
            # Deferred scripts run after parsing; inline them at the end to keep that order.
            if re.search(r"\b(?:defer|async)\b", attributes) or re.search(r"type=[\"']module", attributes):
                deferred.append(tag)
                return ""
            return tag

        html = SCRIPT.sub(script, html)

        def media(match):
            tag = match.group(0)
            for name in ("src", "poster", "data"):
                value = attribute(tag, name)
                if value and not REMOTE.match(value):
                    tag = tag.replace(f'{name}="{value}"', f'{name}="{self.data_uri(value, base)}"').replace(f"{name}='{value}'", f"{name}='{self.data_uri(value, base)}'")
            srcset = attribute(tag, "srcset")
            if srcset:
                parts = []
                for item in srcset.split(","):
                    bits = item.strip().split()
                    if bits and not REMOTE.match(bits[0]):
                        bits[0] = self.data_uri(bits[0], base)
                    parts.append(" ".join(bits))
                tag = tag.replace(srcset, ", ".join(parts))
            return tag

        html = MEDIA.sub(media, html)
        html = re.sub(r"(<style\b[^>]*>)(.*?)(</style>)", lambda m: m.group(1) + self.css(m.group(2), base) + m.group(3), html, flags=re.I | re.S)
        html = re.sub(r"<body\b[^>]*>", lambda m: m.group(0) + NOTICE, html, count=1, flags=re.I)
        # No network: an isolated preview must never submit a real enquiry.
        guard = "<script>document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);window.fetch=()=>Promise.reject(new Error('Preview only: forms are disabled'));</script>"
        tail = guard + "".join(deferred)
        html = re.sub(r"</body>", lambda m: tail + m.group(0), html, count=1, flags=re.I) if re.search(r"</body>", html, re.I) else html + tail
        return html


def build(project, page="public/index.html", out=None):
    project = Path(project).resolve()
    source = (project / page).resolve()
    if not source.is_relative_to(project) or not source.is_file():
        raise ValueError("Choose an existing page inside the project: " + page)
    html = Inliner(project / "public").page(source)
    remaining = local_references(html)
    if remaining:
        raise ValueError("These resources could not be inlined: " + ", ".join(remaining))
    target = Path(out) if out else project / "build/preview" / (source.stem + "-self-contained.html")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8")
    return {"status": "pass", "preview": str(target), "bytes": target.stat().st_size,
            "scope": "Visual preview for viewers that isolate one file; forms and links to other pages do not work in it."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    make = sub.add_parser("build", help="write build/preview/<page>-self-contained.html")
    make.add_argument("project", type=Path)
    make.add_argument("--page", default="public/index.html")
    make.add_argument("--out", type=Path)
    verify = sub.add_parser("check", help="fail if an HTML file still depends on relative resources")
    verify.add_argument("file", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "build":
            result = build(args.project, args.page, args.out)
        else:
            remaining = local_references(args.file.read_text(encoding="utf-8"))
            result = {"status": "blocked" if remaining else "pass", "relative_resources": remaining,
                      "note": "Do not present this file as a standalone preview; build a self-contained one." if remaining else "Opens without sibling files."}
    except (OSError, ValueError) as error:
        result = {"status": "blocked", "message": str(error)}
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
