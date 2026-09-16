#!/usr/bin/env python3
"""Build a branded services catalogue PDF from JSON configuration."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode import qr
    from reportlab.graphics.shapes import Drawing
    from reportlab.lib.colors import Color, HexColor, white
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfgen import canvas
except ModuleNotFoundError as error:
    raise SystemExit(
        f"Missing PDF dependency: {error.name}. Use the bundled workspace Python "
        "from load_workspace_dependencies or install reportlab and Pillow."
    ) from error


W, H = letter


ASCII_REPLACEMENTS = str.maketrans({
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2026": "...",
    "\u00a0": " ",
})


def normalize_text(value):
    if isinstance(value, str):
        return value.translate(ASCII_REPLACEMENTS)
    if isinstance(value, list):
        return [normalize_text(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_text(item) for key, item in value.items()}
    return value


def color(value: str, fallback: str):
    return HexColor(value or fallback)


class Catalogue:
    def __init__(self, config_path: Path, output: Path):
        self.config_path = config_path.resolve()
        self.base = self.config_path.parent
        self.data = normalize_text(json.loads(self.config_path.read_text(encoding="utf-8")))
        self.output = output.resolve()
        brand = self.data["brand"]
        colors = brand.get("colors", {})
        self.brand = brand
        self.primary = color(colors.get("primary"), "#071B34")
        self.secondary = color(colors.get("secondary"), "#0D2A4A")
        self.accent = color(colors.get("accent"), "#E1B247")
        self.accent_light = color(colors.get("accent_light"), "#F2D58C")
        self.paper = color(colors.get("paper"), "#F7F2E8")
        self.ink = color(colors.get("ink"), "#162536")
        self.muted = color(colors.get("muted"), "#566271")
        self.pale = Color(.87, .9, .92)
        self.canvas = canvas.Canvas(str(self.output), pagesize=letter, pageCompression=1)
        self.canvas.setTitle(f"{brand['name']} - Services Catalogue")
        self.canvas.setAuthor(brand["name"])

    def asset(self, value: str | None) -> Path | None:
        if not value:
            return None
        path = Path(value).expanduser()
        return path.resolve() if path.is_absolute() else (self.base / path).resolve()

    def fit_image(self, value: str | None, x: float, y: float, width: float, height: float, focus_y=.5):
        path = self.asset(value)
        if not path or not path.is_file():
            self.canvas.setFillColor(self.secondary)
            self.canvas.rect(x, y, width, height, stroke=0, fill=1)
            return
        with Image.open(path) as image:
            iw, ih = image.size
        scale = max(width / iw, height / ih)
        dw, dh = iw * scale, ih * scale
        dx = x + (width - dw) / 2
        dy = y + (height - dh) * focus_y
        self.canvas.saveState()
        clipping = self.canvas.beginPath()
        clipping.rect(x, y, width, height)
        self.canvas.clipPath(clipping, stroke=0, fill=0)
        self.canvas.drawImage(str(path), dx, dy, width=dw, height=dh, preserveAspectRatio=True, mask="auto")
        self.canvas.restoreState()

    def logo(self, x: float, y: float, size: float):
        path = self.asset(self.brand.get("logo"))
        if path and path.is_file():
            self.canvas.drawImage(str(path), x, y, width=size, height=size, preserveAspectRatio=True, mask="auto")
        else:
            self.canvas.setFillColor(white)
            self.canvas.setFont("Helvetica-Bold", 13)
            self.canvas.drawString(x, y + size / 2, self.brand["name"][:34])

    def wrapped(self, text, x, y, width, font="Helvetica", size=10, leading=14, fill=None, max_lines=None):
        words = str(text).split()
        lines, line = [], ""
        for word in words:
            trial = f"{line} {word}".strip()
            if stringWidth(trial, font, size) <= width:
                line = trial
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
        if max_lines and len(lines) > max_lines:
            lines = lines[:max_lines]
            while lines[-1] and stringWidth(lines[-1] + "...", font, size) > width:
                lines[-1] = lines[-1][:-1]
            lines[-1] = lines[-1].rstrip() + "..."
        self.canvas.setFillColor(fill or self.ink)
        self.canvas.setFont(font, size)
        for item in lines:
            self.canvas.drawString(x, y, item)
            y -= leading
        return y

    def bullets(self, items, x, y, width, fill=None, size=9, leading=12):
        for item in items:
            self.canvas.setFillColor(self.accent)
            self.canvas.circle(x + 3, y + 3, 2.2, stroke=0, fill=1)
            y = self.wrapped(item, x + 13, y, width - 13, size=size, leading=leading, fill=fill or self.ink)
            y -= 4
        return y

    def pill(self, text, x, y):
        size, pad = 8, 9
        width = stringWidth(text, "Helvetica-Bold", size) + pad * 2
        self.canvas.setFillColor(self.accent)
        self.canvas.roundRect(x, y - 4, width, 20, 10, stroke=0, fill=1)
        self.canvas.setFillColor(self.primary)
        self.canvas.setFont("Helvetica-Bold", size)
        self.canvas.drawString(x + pad, y + 2, text)

    def link(self, url, x, y, width, height):
        if url:
            self.canvas.linkURL(url, (x, y, x + width, y + height), relative=0, thickness=0)

    def qr(self, value, x, y, size=72):
        if not value:
            return
        widget = qr.QrCodeWidget(value)
        x1, y1, x2, y2 = widget.getBounds()
        drawing = Drawing(size, size, transform=[size/(x2-x1), 0, 0, size/(y2-y1), 0, 0])
        drawing.add(widget)
        renderPDF.draw(drawing, self.canvas, x, y)

    def footer(self, page_number: int, dark=False):
        line = Color(1, 1, 1, alpha=.22) if dark else self.pale
        text = Color(1, 1, 1, alpha=.72) if dark else self.muted
        self.canvas.setStrokeColor(line)
        self.canvas.line(42, 28, W - 42, 28)
        self.canvas.setFillColor(text)
        self.canvas.setFont("Helvetica", 7.2)
        self.canvas.drawString(42, 16, self.brand.get("footer", self.brand["name"]).upper())
        self.canvas.drawRightString(W - 42, 16, f"{page_number:02d}")

    def cover_page(self):
        cover = self.data["cover"]
        self.fit_image(cover.get("image"), 0, 0, W, H)
        self.canvas.setFillColor(Color(.01, .05, .1, alpha=.6))
        self.canvas.rect(0, 0, W, H, stroke=0, fill=1)
        self.canvas.setFillColor(Color(.02, .08, .16, alpha=.9))
        self.canvas.rect(0, 0, W, 270, stroke=0, fill=1)
        self.logo(42, H - 150, 100)
        self.canvas.setFillColor(self.accent_light)
        self.canvas.setFont("Helvetica-Bold", 9)
        self.canvas.drawString(42, 235, cover["eyebrow"])
        y = 193
        self.canvas.setFillColor(white)
        self.canvas.setFont("Helvetica-Bold", 30)
        for line in cover["headline"].split("\n"):
            self.canvas.drawString(42, y, line)
            y -= 36
        self.wrapped(cover["body"], 42, 116, 430, size=11, leading=15, fill=self.paper, max_lines=3)
        self.pill(cover.get("label", "SERVICES CATALOGUE"), 42, 56)
        self.canvas.setFillColor(white)
        self.canvas.setFont("Helvetica-Bold", 9)
        self.canvas.drawRightString(W - 42, 67, self.brand.get("phone_display", ""))
        self.canvas.setFont("Helvetica", 7.6)
        self.canvas.drawRightString(W - 42, 51, self.brand.get("website", ""))
        self.link(self.brand.get("phone_uri"), W - 155, 55, 113, 18)
        self.link(self.brand.get("website"), W - 210, 42, 168, 15)

    def contents_page(self):
        self.canvas.setFillColor(self.paper)
        self.canvas.rect(0, 0, W, H, stroke=0, fill=1)
        self.canvas.setFillColor(self.accent)
        self.canvas.setFont("Helvetica-Bold", 8)
        self.canvas.drawString(42, 730, "SERVICES AT A GLANCE")
        self.canvas.setFillColor(self.ink)
        self.canvas.setFont("Helvetica-Bold", 27)
        self.canvas.drawString(42, 687, "The right service for")
        self.canvas.drawString(42, 655, "what comes next.")
        y = 596
        for index, service in enumerate(self.data.get("services", []), start=1):
            self.canvas.setFont("Helvetica-Bold", 10)
            self.canvas.setFillColor(self.primary)
            self.canvas.drawString(42, y, f"{index:02d}")
            self.canvas.setFillColor(self.ink)
            self.canvas.setFont("Helvetica-Bold", 11)
            self.canvas.drawString(82, y, service["name"])
            self.canvas.setFillColor(self.muted)
            self.canvas.setFont("Helvetica", 8.3)
            self.canvas.drawString(215, y, service.get("short", "")[:66])
            self.canvas.setFillColor(self.accent)
            self.canvas.drawRightString(W - 46, y, f"{index + 2:02d}")
            self.canvas.setStrokeColor(self.pale)
            self.canvas.line(42, y - 14, W - 42, y - 14)
            y -= 48
        pillars = self.data.get("proof_pillars", [])[:4]
        if pillars:
            panel_y = 92
            self.canvas.setFillColor(self.primary)
            self.canvas.roundRect(42, panel_y, W - 84, 106, 12, stroke=0, fill=1)
            width = (W - 120) / max(1, len(pillars))
            for index, pillar in enumerate(pillars):
                x = 60 + index * width
                self.canvas.setFillColor(self.accent_light)
                self.canvas.setFont("Helvetica-Bold", 8.5)
                self.canvas.drawString(x, 168, pillar["label"])
                self.wrapped(pillar["detail"], x, 148, width - 14, size=7.4, leading=10, fill=self.paper, max_lines=3)
        self.footer(2)

    def service_page(self, service, page_number, service_number=None):
        dark = service.get("theme") == "dark"
        base = self.primary if dark else self.paper
        foreground = self.paper if dark else self.ink
        body_fill = self.paper if dark else self.muted
        self.canvas.setFillColor(base)
        self.canvas.rect(0, 0, W, H, stroke=0, fill=1)
        self.fit_image(service.get("image"), 0, 470, W, 322)
        self.canvas.setFillColor(Color(.01, .05, .1, alpha=.48))
        self.canvas.rect(0, 470, W, 322, stroke=0, fill=1)
        self.pill(f"{service_number if service_number is not None else page_number - 2:02d}  {service['name'].upper()}", 42, 740)
        self.canvas.setFillColor(white)
        self.canvas.setFont("Helvetica-Bold", 28)
        y = 680
        for line in service["headline"].split("\n"):
            self.canvas.drawString(42, y, line)
            y -= 34
        self.wrapped(service["summary"], 42, y - 4, 440, size=10.5, leading=14, fill=self.paper, max_lines=4)
        self.canvas.setFillColor(self.accent_light if dark else self.primary)
        self.canvas.setFont("Helvetica-Bold", 8)
        self.canvas.drawString(42, 430, service.get("ideal_for_label", "IDEAL FOR").upper())
        self.bullets(service.get("ideal_for", []), 42, 405, 230, fill=body_fill)
        self.canvas.setFillColor(self.accent_light if dark else self.primary)
        self.canvas.setFont("Helvetica-Bold", 8)
        self.canvas.drawString(310, 430, service.get("includes_label", "WHAT THE SERVICE INCLUDES").upper())
        self.bullets(service.get("includes", []), 310, 405, 242, fill=body_fill)
        panel = self.secondary if dark else white
        self.canvas.setFillColor(panel)
        self.canvas.roundRect(42, 104, 510, 126, 12, stroke=0, fill=1)
        self.canvas.setFillColor(self.accent_light if dark else self.primary)
        self.canvas.setFont("Helvetica-Bold", 8)
        self.canvas.drawString(60, 204, service.get("callout_title", "WHY IT MATTERS").upper())
        self.wrapped(service.get("callout_body", ""), 60, 177, 468, font="Helvetica-Bold", size=11, leading=15, fill=foreground, max_lines=5)
        self.footer(page_number, dark=dark)

    def process_page(self, page_number):
        process = self.data["process"]
        self.canvas.setFillColor(self.paper)
        self.canvas.rect(0, 0, W, H, stroke=0, fill=1)
        self.fit_image(process.get("image"), 0, 575, W, 217)
        self.canvas.setFillColor(Color(.01, .05, .1, alpha=.55))
        self.canvas.rect(0, 575, W, 217, stroke=0, fill=1)
        self.pill("OUR PROCESS", 42, 740)
        self.canvas.setFillColor(white)
        self.canvas.setFont("Helvetica-Bold", 27)
        y = 680
        for line in process["headline"].split("\n"):
            self.canvas.drawString(42, y, line)
            y -= 33
        self.wrapped(process.get("summary", ""), 42, 540, 500, size=10, leading=14, fill=self.muted)
        y = 475
        for index, step in enumerate(process.get("steps", []), start=1):
            self.canvas.setFillColor(self.accent)
            self.canvas.circle(58, y + 2, 15, stroke=0, fill=1)
            self.canvas.setFillColor(self.primary)
            self.canvas.setFont("Helvetica-Bold", 8)
            self.canvas.drawCentredString(58, y - 1, f"{index:02d}")
            self.canvas.setFillColor(self.ink)
            self.canvas.setFont("Helvetica-Bold", 12)
            self.canvas.drawString(88, y + 4, step["title"])
            self.wrapped(step["body"], 88, y - 15, 442, size=8.8, leading=11.5, fill=self.muted, max_lines=2)
            y -= 64
        self.footer(page_number)

    def cta_page(self):
        cta = self.data["cta"]
        self.fit_image(cta.get("image"), 0, 0, W, H)
        self.canvas.setFillColor(Color(.01, .05, .1, alpha=.72))
        self.canvas.rect(0, 0, W, H, stroke=0, fill=1)
        self.logo(42, 628, 92)
        self.canvas.setFillColor(self.accent_light)
        self.canvas.setFont("Helvetica-Bold", 9)
        self.canvas.drawString(42, 590, cta["eyebrow"])
        self.canvas.setFillColor(white)
        self.canvas.setFont("Helvetica-Bold", 30)
        self.canvas.drawString(42, 545, cta["headline"])
        self.wrapped(cta.get("body", ""), 42, 508, 500, size=11, leading=15, fill=self.paper, max_lines=4)
        y = 420
        for index, step in enumerate(cta.get("steps", []), start=1):
            self.canvas.setFillColor(self.accent)
            self.canvas.circle(55, y + 2, 13, stroke=0, fill=1)
            self.canvas.setFillColor(self.primary)
            self.canvas.setFont("Helvetica-Bold", 8)
            self.canvas.drawCentredString(55, y - 1, str(index))
            self.canvas.setFillColor(white)
            self.canvas.setFont("Helvetica-Bold", 11)
            self.canvas.drawString(78, y + 3, step["title"])
            self.wrapped(step["body"], 250, y + 3, 292, size=8.5, leading=11, fill=self.paper, max_lines=2)
            y -= 58
        self.canvas.setFillColor(Color(.02, .09, .17, alpha=.94))
        self.canvas.roundRect(42, 105, 510, 90, 14, stroke=0, fill=1)
        self.canvas.setFillColor(white)
        self.canvas.setFont("Helvetica-Bold", 13)
        self.canvas.drawString(60, 168, cta.get("action_label") or "Take the next step")
        self.canvas.setFillColor(self.accent_light)
        self.canvas.setFont("Helvetica-Bold", 11)
        self.canvas.drawString(60, 141, self.brand.get("phone_display", ""))
        self.canvas.setFillColor(self.paper)
        self.canvas.setFont("Helvetica", 8.5)
        self.canvas.drawString(60, 122, self.brand.get("contact_url", ""))
        if cta.get("action_body") and not self.brand.get("phone_display") and not self.brand.get("contact_url"):
            self.wrapped(cta["action_body"], 60, 141, 470, size=9, leading=12, fill=self.paper, max_lines=2)
        self.qr(self.brand.get("contact_url"), 444, 109, 76)
        self.link(self.brand.get("phone_uri"), 58, 132, 130, 24)
        self.link(self.brand.get("contact_url"), 58, 112, 310, 20)
        self.canvas.setFont("Helvetica", 8.5)
        self.canvas.drawString(42, 73, cta.get("follow_up_promise", ""))
        self.footer(len(self.data.get("services", [])) + 3 + int(bool(self.data.get("include_contents", True))), dark=True)

    def build(self):
        self.output.parent.mkdir(parents=True, exist_ok=True)
        self.cover_page()
        page_number = 2
        if self.data.get("include_contents", True):
            self.canvas.showPage()
            self.contents_page()
            page_number += 1
        services = self.data.get("services", [])
        for index, service in enumerate(services, start=1):
            self.canvas.showPage()
            self.service_page(service, page_number, index)
            page_number += 1
        self.canvas.showPage()
        self.process_page(page_number)
        self.canvas.showPage()
        self.cta_page()
        self.canvas.save()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    catalogue = Catalogue(args.config, args.output)
    catalogue.build()
    print(json.dumps({"output": str(catalogue.output), "pages": len(catalogue.data.get("services", [])) + 3 + int(bool(catalogue.data.get("include_contents", True)))}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
