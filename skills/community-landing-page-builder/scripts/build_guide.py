#!/usr/bin/env python3
"""Build, render and verify the project PDF guide and thank-you delivery link."""

from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import guide_quality as quality


class DeliveryHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.embeds = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag.lower() == "a":
            self.links.append({"href": values.get("href", ""), "guide": "data-guide-download" in values})
        if "data-guide-embed" in values:
            self.embeds.append(values.get("src") or values.get("data") or "")


def inside(root: Path, value: str, expected_parent: Path) -> Path:
    path = (root / value).resolve()
    try:
        path.relative_to(expected_parent.resolve())
    except ValueError as error:
        raise ValueError(f"Path must stay inside {expected_parent.relative_to(root)}: {value}") from error
    return path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise ValueError('Guide report must not be a symlink')
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False, encoding='utf-8') as handle:
        temporary = Path(handle.name)
        handle.write(json.dumps(value, indent=2) + '\n')
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def build_reader(root, config_path, data):
    from build_reader_guide import build
    from PIL import Image
    inputs = quality.validate_content(root, data)
    inputs[config_path.relative_to(root).as_posix()] = sha256(config_path)
    delivery = data.get('delivery', {})
    output = quality.local(root, delivery.get('output'), 'public/assets/brochure')
    if output.suffix.lower() != '.pdf':
        raise ValueError('Generate a real .pdf guide')
    preview = output.with_name(output.stem + '-cover.png')
    if preview.is_symlink():
        raise ValueError('The guide preview cannot be a symlink')
    for binary in ('pdftoppm', 'pdftotext'):
        if not shutil.which(binary):
            raise ValueError('Install Poppler before building the guide: ' + binary)
    fonts = quality.font_hashes(root, config_path, output)
    quality.archive_failed_review(root)
    build(root, config_path, output, data)
    if output.read_bytes()[:5] != b'%PDF-':
        raise ValueError('PDF signature is missing')
    render_dir = quality.local(root, 'build/guide-pages', 'build')
    render_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='guide-render-', dir=root/'build') as directory:
        staging = Path(directory)
        subprocess.run(['pdftoppm', '-png', '-r', '120', str(output), str(staging/'page')], check=True)
        subprocess.run(['pdftotext', '-layout', str(output), str(staging/'text.txt')], check=True)
        pages = sorted(staging.glob('page-*.png'))
        if not pages or not (staging/'text.txt').read_text().strip():
            raise ValueError('Guide page render or extracted text is empty')
        for old in render_dir.glob('page-*.png'):
            if old.is_symlink():
                raise ValueError('Guide render paths cannot be symlinks')
        with Image.open(pages[0]) as cover:
            cover.thumbnail((600, 850))
            cover.convert('RGB').save(staging/'cover.png')
        shutil.copyfile(staging/'cover.png', preview)
        for old in render_dir.glob('page-*.png'): old.unlink()
        for page in pages: shutil.copyfile(page, render_dir/page.name)
        text_path = quality.local(root, 'build/guide-text.txt', 'build')
        shutil.copyfile(staging/'text.txt', text_path)
    pages = sorted(render_dir.glob('page-*.png'))
    artifacts = {p.relative_to(root).as_posix(): sha256(p) for p in [output, preview, text_path, *pages]}
    report = {'schema_version': 2, 'status': 'pass', 'scope': 'mechanical build only; editorial and visual review required',
        'config': config_path.relative_to(root).as_posix(), 'config_sha256': sha256(config_path),
        'output': output.relative_to(root).as_posix(), 'output_sha256': sha256(output),
        'preview': preview.relative_to(root).as_posix(), 'text_output': text_path.relative_to(root).as_posix(),
        'font_hashes': fonts, 'business_fingerprint': quality.business_fingerprint(root), 'inputs': inputs, 'artifacts': artifacts, 'page_count': len(pages),
        'rendered_pages': [p.relative_to(root).as_posix() for p in pages],
        'author_task_ids': data.get('author_task_ids', [])}
    write_json(root/'build/guide-build.json', report)
    print(json.dumps(report, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--config", default="build/guide.json")
    parser.add_argument("--check", action="store_true", help="Validate current build, reader review and shared thank-you delivery without rebuilding")
    args = parser.parse_args()

    root = args.project_root.expanduser().resolve()
    if args.check:
        report = quality.inspect_build(root)
        quality.inspect_review(root, report)
        import thank_you_page
        thank_you_page.inspect(root)
        print(json.dumps({'status': 'pass', 'scope': 'current reader review and local delivery only'}))
        return 0
    config_path = quality.local(root, args.config, 'build')
    data = json.loads(config_path.read_text(encoding="utf-8"))
    if data.get('document_type') == 'buyer_guide':
        return build_reader(root, config_path, data)
    if (root/'funnel.json').is_file() and quality.required(root):
        raise ValueError('This build requires the researched buyer-guide format. Read references/reader-guide-quality.md.')
    if data.get("workflow_ready") is not True:
        raise ValueError("Complete build/guide.json from researched project facts and set workflow_ready to true.")
    serialized = json.dumps(data, ensure_ascii=False)
    if "WORKFLOW_TEMPLATE_INCOMPLETE" in serialized or "Replace " in serialized or "EXAMPLE" in serialized:
        raise ValueError("The guide configuration still contains template instructions or placeholders.")

    delivery = data.get("delivery") or {}
    output = inside(root, delivery.get("output", ""), root / "public" / "assets" / "brochure")
    thank_you = inside(root, delivery.get("thank_you", ""), root / "public")
    if not delivery.get("download_label", "").strip():
        raise ValueError("delivery.download_label is required.")
    if not thank_you.is_file():
        raise ValueError("The configured thank-you page is missing.")

    expected_path = "/" + output.relative_to(root / "public").as_posix()
    delivery_html = DeliveryHTML()
    delivery_html.feed(thank_you.read_text(encoding="utf-8"))
    from thank_you_page import same_local
    def local_delivery(value):
        try: return same_local(root, thank_you, value) == output
        except (ValueError, OSError): return False
    linked = any(
        item["guide"] and local_delivery(item["href"])
        for item in delivery_html.links
    )
    if not linked:
        raise ValueError(f"The thank-you page needs one data-guide-download link to {expected_path}.")
    embedded = any(
        local_delivery(value)
        for value in delivery_html.embeds
    )
    if not embedded:
        raise ValueError(f"The thank-you page needs one data-guide-embed preview of {expected_path}.")

    builder = root / "scripts" / "build_catalogue.py"
    if not builder.is_file():
        raise ValueError("The portable PDF builder is missing from scripts/.")
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, str(builder), "--config", str(config_path), "--output", str(output)], cwd=root, check=True)
    if output.read_bytes()[:5] != b"%PDF-":
        raise ValueError("The guide output is not a valid PDF file.")

    pdftoppm = shutil.which("pdftoppm")
    pdftotext = shutil.which("pdftotext")
    if not pdftoppm or not pdftotext:
        raise ValueError("Poppler pdftoppm and pdftotext are required to verify the guide.")
    render_dir = root / "build" / "guide-pages"
    render_dir.mkdir(parents=True, exist_ok=True)
    for old in render_dir.glob("page-*.png"):
        old.unlink()
    subprocess.run([pdftoppm, "-png", "-r", "120", str(output), str(render_dir / "page")], cwd=root, check=True)
    text_path = root / "build" / "guide-text.txt"
    subprocess.run([pdftotext, str(output), str(text_path)], cwd=root, check=True)
    pages = sorted(render_dir.glob("page-*.png"))
    if not pages or not text_path.read_text(encoding="utf-8", errors="replace").strip():
        raise ValueError("The guide render or extracted text is empty.")

    report = {
        "schema_version": 1,
        "status": "pass",
        "config": config_path.relative_to(root).as_posix(),
        "config_sha256": sha256(config_path),
        "output": output.relative_to(root).as_posix(),
        "output_sha256": sha256(output),
        "thank_you": thank_you.relative_to(root).as_posix(),
        "thank_you_sha256": sha256(thank_you),
        "download_path": expected_path,
        "embed_path": expected_path,
        "download_label": delivery["download_label"],
        "page_count": len(pages),
        "rendered_pages": [page.relative_to(root).as_posix() for page in pages],
        "text_output": text_path.relative_to(root).as_posix(),
    }
    write_json(root / "build" / "guide-build.json", report)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(json.dumps({"status": "blocked", "message": str(error)}))
        raise SystemExit(1)
