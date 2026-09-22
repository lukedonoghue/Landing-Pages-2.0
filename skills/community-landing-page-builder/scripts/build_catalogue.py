#!/usr/bin/env python3
"""Build a measured, content-preserving services catalogue; publish the PDF atomically."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import unicodedata

try:
    from PIL import Image
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode import qr
    from reportlab.graphics.shapes import Drawing
    from reportlab.lib.colors import Color, HexColor, white
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas
except ModuleNotFoundError as error:
    raise SystemExit(
        f"Missing PDF dependency: {error.name}. Run the skill's local bootstrap with Python/ReportLab/Pillow."
    ) from error

W, H = letter
FONT_DIR = Path(__file__).resolve().parents[1] / "assets/pdf-fonts"
BUNDLED_FONTS = Path(__file__).resolve().parents[1] / ".community-builder/assets/pdf-fonts"
if BUNDLED_FONTS.is_dir():
    FONT_DIR = BUNDLED_FONTS
ASCII_REPLACEMENTS = str.maketrans(
    {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u00a0": " ",
    }
)


def normalize_text(value):
    # Never normalize asset paths, links, or font filenames.
    return unicodedata.normalize("NFC", str(value)).translate(ASCII_REPLACEMENTS)


class LayoutError(ValueError):
    def __init__(
        self,
        field,
        reason,
        action="Adapt the layout or split the content into appropriate pages; keep approved wording and qualifiers intact.",
    ):
        self.field, self.reason, self.action = field, reason, action
        super().__init__(f"{field}: {reason} {action}")


class Catalogue:
    def __init__(self, config_path: Path, output: Path):
        self.config_path = config_path.resolve()
        self.base = self.config_path.parent
        self.data = json.loads(self.config_path.read_text(encoding="utf-8"))
        self.output = output.absolute()
        if self.output.is_symlink():
            raise LayoutError("output", "Output must be a regular PDF path, not a symlink.")
        self.brand = self.data["brand"]
        colors = self.brand.get("colors", {})
        defaults = {
            "primary": "#071B34",
            "secondary": "#0D2A4A",
            "accent": "#E1B247",
            "accent_light": "#F2D58C",
            "paper": "#F7F2E8",
            "ink": "#162536",
            "muted": "#566271",
        }
        for key, value in defaults.items():
            setattr(self, key, HexColor(colors.get(key) or value))
        self.pale = Color(0.87, 0.9, 0.92)
        self.fonts = {}
        self.font_files = {}
        supplied = self.brand.get("fonts", {})
        if supplied and set(supplied) != {"regular", "bold"}:
            raise LayoutError("brand.fonts", "Supply both regular and bold TrueType fonts.")
        for role, filename in [("regular", "DejaVuSans.ttf"), ("bold", "DejaVuSans-Bold.ttf")]:
            path = self.asset(supplied[role]) if supplied else FONT_DIR / filename
            if not path or not path.is_file():
                raise LayoutError(
                    "brand.fonts." + role,
                    "The selected font is missing.",
                    "Restore the bundled font assets or provide a licensed local TrueType font pair.",
                )
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            name = "Catalogue-" + role + "-" + digest[:16]
            if name not in pdfmetrics.getRegisteredFontNames():
                try:
                    pdfmetrics.registerFont(TTFont(name, str(path)))
                except Exception as error:
                    raise LayoutError(
                        "brand.fonts." + role,
                        "The selected file is not a supported readable TrueType font.",
                    ) from error
            self.fonts[role] = name
            self.font_files[role] = digest
        self.stream = io.BytesIO()
        self.canvas = canvas.Canvas(self.stream, pagesize=letter, pageCompression=1)
        self.canvas.setTitle(f"{self.brand['name']} - Services Catalogue")
        self.canvas.setAuthor(self.brand["name"])
        self.page_number = 1
        self.pages = 0

    def asset(self, value):
        if not value:
            return None
        path = Path(value).expanduser()
        return path.resolve() if path.is_absolute() else (self.base / path).resolve()

    def check_glyphs(self, text, role, field):
        # Drawing unshaped RTL/complex-script glyphs would look plausible but be wrong.
        complex_text = any(
            unicodedata.bidirectional(c)
            in {"R", "AL", "RLE", "RLO", "LRE", "LRO", "RLI", "LRI", "FSI", "PDI", "PDF"}
            or 0x0900 <= ord(c) <= 0x109F
            or 0x1780 <= ord(c) <= 0x17FF
            or unicodedata.category(c) in {"Mn", "Mc"}
            for c in text
        )
        if complex_text:
            raise LayoutError(
                field,
                "This text requires shaping or bidirectional layout.",
                "Use a shaping-capable PDF layout and inspect its exact wording; do not transliterate or remove the name.",
            )
        glyphs = pdfmetrics.getFont(self.fonts[role]).face.charToGlyph
        missing = sorted({ord(c) for c in text if not c.isspace() and not glyphs.get(ord(c))})
        if missing:
            codes = ", ".join(f"U+{value:04X}" for value in missing[:8])
            raise LayoutError(
                field,
                "The font cannot render " + codes + ".",
                "Provide a licensed regular/bold font pair covering these characters, then render and inspect every page.",
            )

    def fit(
        self,
        text,
        width,
        height,
        field,
        *,
        size=10,
        role="regular",
        minimum=None,
        leading=1.3,
        single=False,
    ):
        text = normalize_text(text)
        if not text.strip():
            return {"lines": [], "height": 0, "size": size, "leading": size * leading, "role": role}
        self.check_glyphs(text, role, field)
        minimum = size if minimum is None else minimum
        current = size
        while current >= minimum - 0.01:
            lines, too_wide = [], False
            for paragraph in text.split("\n"):
                if single:
                    lines.append(paragraph)
                    too_wide |= pdfmetrics.stringWidth(paragraph, self.fonts[role], current) > width
                    continue
                line = ""
                for word in paragraph.split():
                    if pdfmetrics.stringWidth(word, self.fonts[role], current) > width:
                        too_wide = True
                    trial = (line + " " + word).strip()
                    if line and pdfmetrics.stringWidth(trial, self.fonts[role], current) > width:
                        lines.append(line)
                        line = word
                    else:
                        line = trial
                lines.append(line)
            line_height = current * leading
            if not too_wide and len(lines) * line_height <= height + 0.01:
                return {
                    "lines": lines,
                    "height": len(lines) * line_height,
                    "size": current,
                    "leading": line_height,
                    "role": role,
                }
            current = round(current - 0.5, 3)
        raise LayoutError(
            field,
            f"Text does not fit its {width:g} × {height:g} pt area at the minimum readable size ({minimum:g} pt).",
        )

    def draw(self, block, x, top, *, fill=None, width=None, align="left"):
        self.canvas.setFillColor(fill or self.ink)
        self.canvas.setFont(self.fonts[block["role"]], block["size"])
        y = top - block["size"]
        for line in block["lines"]:
            if align == "right":
                self.canvas.drawRightString(x + width, y, line)
            elif align == "center":
                self.canvas.drawCentredString(x + width / 2, y, line)
            else:
                self.canvas.drawString(x, y, line)
            y -= block["leading"]
        return top - block["height"]

    def box(self, text, x, top, width, bottom, field, *, fill=None, align="left", **kwargs):
        block = self.fit(text, width, top - bottom, field, **kwargs)
        return self.draw(block, x, top, fill=fill, width=width, align=align)

    def image(self, section, x, y, width, height, field):
        value, mode = section.get("image"), section.get("image_mode")
        if mode not in (None, "asset", "none"):
            raise LayoutError(field + ".image_mode", "Use asset or none.")
        if mode == "none":
            if value:
                raise LayoutError(
                    field + ".image", "An image path conflicts with image_mode: none."
                )
            self.canvas.setFillColor(self.secondary)
            self.canvas.rect(x, y, width, height, stroke=0, fill=1)
            return
        if not value:
            raise LayoutError(
                field + ".image",
                "No image was selected.",
                "Supply the intended local asset, or explicitly set image_mode: none for a deliberate colour-only design.",
            )
        path = self.asset(value)
        if not path.is_file():
            raise LayoutError(
                field + ".image",
                "The named image file is missing.",
                "Restore/source the intended image; do not silently replace it with a blank panel.",
            )
        try:
            with Image.open(path) as picture:
                picture.load()
                iw, ih = picture.size
            scale = max(width / iw, height / ih)
            self.canvas.saveState()
            clip = self.canvas.beginPath()
            clip.rect(x, y, width, height)
            self.canvas.clipPath(clip, stroke=0, fill=0)
            self.canvas.drawImage(
                str(path),
                x + (width - iw * scale) / 2,
                y + (height - ih * scale) / 2,
                width=iw * scale,
                height=ih * scale,
                mask="auto",
            )
            self.canvas.restoreState()
        except (OSError, ValueError) as error:
            raise LayoutError(
                field + ".image", "The named file is not a readable supported raster image."
            ) from error

    def logo(self, x, top, size):
        path = self.asset(self.brand.get("logo"))
        if path:
            if not path.is_file():
                raise LayoutError("brand.logo", "The named logo file is missing.")
            try:
                self.canvas.drawImage(
                    str(path),
                    x,
                    top - size,
                    width=size,
                    height=size,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except (OSError, ValueError) as error:
                raise LayoutError(
                    "brand.logo", "The logo is not a readable supported raster image."
                ) from error
        else:
            self.box(
                self.brand["name"],
                x,
                top - 25,
                W - x - 42,
                top - 95,
                "brand.name",
                size=13,
                minimum=11,
                role="bold",
                fill=white,
            )

    def pill(self, text, x, y, field, max_width=W - 84):
        block = self.fit(
            text, max_width - 18, 18, field, size=8, minimum=7.5, role="bold", single=True
        )
        width = pdfmetrics.stringWidth(block["lines"][0], self.fonts["bold"], block["size"]) + 18
        self.canvas.setFillColor(self.accent)
        self.canvas.roundRect(x, y - 4, width, 20, 10, stroke=0, fill=1)
        self.draw(block, x + 9, y + 12, fill=self.primary)
        return width

    def link(self, url, x, y, width, height):
        if url:
            self.canvas.linkURL(url, (x, y, x + width, y + height), relative=0, thickness=0)

    def qr(self, value, x, y, size=72):
        if not value:
            return
        # A QR needs a light quiet zone even on the dark action panel.
        self.canvas.setFillColor(white)
        self.canvas.rect(x, y, size, size, stroke=0, fill=1)
        widget = qr.QrCodeWidget(value)
        x1, y1, x2, y2 = widget.getBounds()
        drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
        drawing.add(widget)
        renderPDF.draw(drawing, self.canvas, x, y)

    def next_page(self):
        self.canvas.showPage()
        self.page_number += 1

    def background(self, fill):
        self.canvas.setFillColor(fill)
        self.canvas.rect(0, 0, W, H, stroke=0, fill=1)

    def footer(self, dark=False):
        self.canvas.setStrokeColor(Color(1, 1, 1, alpha=0.22) if dark else self.pale)
        self.canvas.line(42, 28, W - 42, 28)
        fill = Color(1, 1, 1, alpha=0.72) if dark else self.muted
        self.box(
            self.brand.get("footer", self.brand["name"]).upper(),
            42,
            24,
            W - 130,
            9,
            "brand.footer",
            size=7.2,
            minimum=7.2,
            single=True,
            fill=fill,
        )
        self.box(
            f"{self.page_number:02d}",
            W - 80,
            24,
            38,
            9,
            "page number",
            size=7.2,
            single=True,
            align="right",
            fill=fill,
        )

    @staticmethod
    def batches(rows, capacity, field):
        batches = [[]]
        used = 0
        for row in rows:
            if row["height"] > capacity:
                raise LayoutError(
                    row.get("field", field), "A single item is taller than a page section."
                )
            if batches[-1] and used + row["height"] > capacity:
                batches.append([])
                used = 0
            batches[-1].append(row)
            used += row["height"]
        return batches

    def cover_page(self):
        cover = self.data["cover"]
        self.image(cover, 0, 0, W, H, "cover")
        self.background_overlay(0, 0, W, H, Color(0.01, 0.05, 0.1, alpha=0.6))
        self.background_overlay(0, 0, W, 270, Color(0.02, 0.08, 0.16, alpha=0.9))
        self.logo(42, H - 100, 100)
        self.box(
            self.brand.get("region", ""),
            42,
            H - 212,
            W - 84,
            H - 250,
            "brand.region",
            size=9.5,
            fill=self.accent_light,
        )
        self.box(
            cover["eyebrow"],
            42,
            250,
            W - 84,
            229,
            "cover.eyebrow",
            size=9,
            role="bold",
            fill=self.accent_light,
        )
        end = self.box(
            cover["headline"],
            42,
            224,
            W - 84,
            141,
            "cover.headline",
            size=30,
            minimum=23,
            role="bold",
            fill=white,
            leading=1.2,
        )
        self.box(
            cover["body"],
            42,
            min(131, end - 10),
            430,
            77,
            "cover.body",
            size=11,
            minimum=10,
            fill=self.paper,
        )
        label_width = self.pill(
            cover.get("label", "SERVICES CATALOGUE"), 42, 42, "cover.label", max_width=270
        )
        contact_width = W - 84 - label_width - 16
        self.box(
            self.brand.get("phone_display", ""),
            W - 42 - contact_width,
            68,
            contact_width,
            54,
            "brand.phone_display",
            size=9,
            minimum=8,
            role="bold",
            align="right",
            fill=white,
            single=True,
        )
        self.box(
            self.brand.get("website", ""),
            W - 42 - contact_width,
            51,
            contact_width,
            36,
            "brand.website",
            size=7.6,
            minimum=7.6,
            align="right",
            fill=white,
            single=True,
        )
        self.link(self.brand.get("phone_uri"), W - 42 - contact_width, 53, contact_width, 18)
        self.link(self.brand.get("website"), W - 42 - contact_width, 35, contact_width, 18)

    def background_overlay(self, x, y, width, height, fill):
        self.canvas.setFillColor(fill)
        self.canvas.rect(x, y, width, height, stroke=0, fill=1)

    def contents_rows(self):
        rows = []
        for i, service in enumerate(self.data.get("services", [])):
            field = f"services[{i}]"
            title = self.fit(service["name"], 430, 150, field + ".name", size=11, role="bold")
            body = self.fit(service.get("short", ""), 430, 150, field + ".short", size=9)
            rows.append(
                {
                    "index": i,
                    "title": title,
                    "body": body,
                    "height": max(48, title["height"] + body["height"] + 17),
                    "field": field,
                }
            )
        return self.batches(rows, 596 - 228, "services")

    def contents_page(self, rows, contents_count):
        self.background(self.paper)
        self.box(
            "SERVICES AT A GLANCE",
            42,
            743,
            528,
            727,
            "contents label",
            size=8,
            role="bold",
            fill=self.primary,
        )
        self.box(
            "The right service for\nwhat comes next.",
            42,
            711,
            528,
            625,
            "contents heading",
            size=27,
            role="bold",
        )
        y = 596
        for row in rows:
            i = row["index"]
            self.box(
                f"{i+1:02d}",
                42,
                y,
                30,
                y - 20,
                "service number",
                size=10,
                role="bold",
                fill=self.primary,
            )
            end = self.draw(row["title"], 82, y)
            self.draw(row["body"], 82, end - 4, fill=self.muted)
            self.box(
                f"Page {i+2+contents_count:02d}",
                W - 98,
                y,
                52,
                y - 20,
                "service page number",
                size=9,
                align="right",
                fill=self.primary,
            )
            self.canvas.setStrokeColor(self.pale)
            self.canvas.line(42, y - row["height"] + 9, W - 42, y - row["height"] + 9)
            self.canvas.linkAbsolute(
                "",
                f"service-{i}",
                Rect=(42, y - row["height"] + 10, W - 42, y + 3),
                thickness=0,
            )
            y -= row["height"]
        pillars = self.data.get("proof_pillars", [])
        if len(pillars) > 4:
            raise LayoutError(
                "proof_pillars",
                "The fixed proof panel supports four items.",
                "Create a separate proof section/layout retaining all items; do not silently discard pillars.",
            )
        if pillars:
            self.canvas.setFillColor(self.primary)
            self.canvas.roundRect(42, 92, W - 84, 106, 12, stroke=0, fill=1)
            width = (W - 120) / len(pillars)
            for i, pillar in enumerate(pillars):
                x = 60 + i * width
                self.box(
                    pillar["label"],
                    x,
                    183,
                    width - 14,
                    155,
                    f"proof_pillars[{i}].label",
                    size=8.5,
                    minimum=8,
                    role="bold",
                    fill=self.accent_light,
                )
                self.box(
                    pillar["detail"],
                    x,
                    150,
                    width - 14,
                    102,
                    f"proof_pillars[{i}].detail",
                    size=7.8,
                    minimum=7.8,
                    fill=self.paper,
                )
        self.footer()

    def bullets(self, items, x, top, width, bottom, field, fill):
        for i, item in enumerate(items):
            block = self.fit(item, width - 13, top - bottom, f"{field}[{i}]", size=9)
            self.canvas.setFillColor(self.accent)
            self.canvas.circle(x + 3, top - 5, 2.2, stroke=0, fill=1)
            top = self.draw(block, x + 13, top, fill=fill) - 5

    def service_page(self, service, index):
        self.canvas.bookmarkPage(f"service-{index}")
        field = f"services[{index}]"
        dark = service.get("theme") == "dark"
        self.background(self.primary if dark else self.paper)
        self.image(service, 0, 470, W, 322, field)
        self.background_overlay(0, 470, W, 322, Color(0.01, 0.05, 0.1, alpha=0.48))
        self.pill(f"{index+1:02d}  {service['name'].upper()}", 42, 740, field + ".name")
        end = self.box(
            service["headline"],
            42,
            707,
            528,
            584,
            field + ".headline",
            size=28,
            minimum=22,
            role="bold",
            fill=white,
            leading=1.2,
        )
        self.box(
            service["summary"],
            42,
            end - 9,
            500,
            483,
            field + ".summary",
            size=10.5,
            minimum=9.5,
            fill=self.paper,
        )
        accent = self.accent_light if dark else self.primary
        body = self.paper if dark else self.muted
        self.box(
            service.get("ideal_for_label", "IDEAL FOR").upper(),
            42,
            442,
            230,
            413,
            field + ".ideal_for_label",
            size=8,
            role="bold",
            fill=accent,
        )
        self.bullets(service.get("ideal_for", []), 42, 402, 230, 247, field + ".ideal_for", body)
        self.box(
            service.get("includes_label", "WHAT THE SERVICE INCLUDES").upper(),
            310,
            442,
            242,
            413,
            field + ".includes_label",
            size=8,
            role="bold",
            fill=accent,
        )
        self.bullets(service.get("includes", []), 310, 402, 242, 247, field + ".includes", body)
        self.canvas.setFillColor(self.secondary if dark else white)
        self.canvas.roundRect(42, 104, 510, 126, 12, stroke=0, fill=1)
        self.box(
            service.get("callout_title", "WHY IT MATTERS").upper(),
            60,
            219,
            468,
            190,
            field + ".callout_title",
            size=8,
            role="bold",
            fill=accent,
        )
        self.box(
            service.get("callout_body", ""),
            60,
            183,
            468,
            115,
            field + ".callout_body",
            size=11,
            minimum=9.5,
            role="bold",
            fill=self.paper if dark else self.ink,
        )
        self.footer(dark)

    def step_rows(self, steps, field, cta=False):
        rows = []
        for i, step in enumerate(steps):
            key = f"{field}.steps[{i}]"
            title = self.fit(
                step["title"],
                156 if cta else 442,
                150,
                key + ".title",
                size=10.5 if cta else 12,
                role="bold",
            )
            body = self.fit(step["body"], 292 if cta else 442, 300, key + ".body", size=9)
            height = max(
                58 if cta else 62,
                (
                    max(title["height"], body["height"])
                    if cta
                    else title["height"] + body["height"] + 4
                )
                + 22,
            )
            rows.append({"index": i, "title": title, "body": body, "height": height, "field": key})
        return rows

    def process_page(self, rows):
        process = self.data["process"]
        self.background(self.paper)
        self.image(process, 0, 575, W, 217, "process")
        self.background_overlay(0, 575, W, 217, Color(0.01, 0.05, 0.1, alpha=0.55))
        self.pill("OUR PROCESS", 42, 740, "process label")
        self.box(
            process["headline"],
            42,
            709,
            528,
            590,
            "process.headline",
            size=27,
            minimum=22,
            role="bold",
            fill=white,
            leading=1.2,
        )
        self.box(
            process.get("summary", ""),
            42,
            557,
            500,
            493,
            "process.summary",
            size=10,
            minimum=9,
            fill=self.muted,
        )
        y = 475
        for row in rows:
            self.canvas.setFillColor(self.accent)
            self.canvas.circle(58, y - 6, 15, stroke=0, fill=1)
            self.box(
                f"{row['index']+1:02d}",
                43,
                y,
                30,
                y - 20,
                "step number",
                size=8,
                role="bold",
                align="center",
                fill=self.primary,
            )
            end = self.draw(row["title"], 88, y)
            self.draw(row["body"], 88, end - 4, fill=self.muted)
            y -= row["height"]
        self.footer()

    def cta_header(self, draw=False):
        cta = self.data["cta"]
        title = self.fit(
            cta["headline"], 528, 78, "cta.headline", size=30, minimum=23, role="bold", leading=1.2
        )
        body_top = 558 - title["height"] - 10
        body = self.fit(cta.get("body", ""), 500, body_top - 431, "cta.body", size=11, minimum=10)
        start = min(420, body_top - body["height"] - 24)
        if draw:
            self.image(cta, 0, 0, W, H, "cta")
            self.background_overlay(0, 0, W, H, Color(0.01, 0.05, 0.1, alpha=0.72))
            self.logo(42, 720, 92)
            self.box(
                cta["eyebrow"],
                42,
                602,
                528,
                580,
                "cta.eyebrow",
                size=9,
                role="bold",
                fill=self.accent_light,
            )
            self.draw(title, 42, 558, fill=white)
            self.draw(body, 42, body_top, fill=self.paper)
        return start

    def cta_page(self, rows):
        cta = self.data["cta"]
        y = self.cta_header(draw=True)
        for row in rows:
            self.canvas.setFillColor(self.accent)
            self.canvas.circle(55, y - 6, 13, stroke=0, fill=1)
            self.box(
                str(row["index"] + 1),
                42,
                y,
                26,
                y - 20,
                "step number",
                size=8,
                role="bold",
                align="center",
                fill=self.primary,
            )
            self.draw(row["title"], 78, y, fill=white)
            self.draw(row["body"], 250, y, fill=self.paper)
            y -= row["height"]
        self.canvas.setFillColor(Color(0.02, 0.09, 0.17, alpha=0.94))
        self.canvas.roundRect(42, 105, 510, 90, 14, stroke=0, fill=1)
        width = 370 if self.brand.get("contact_url") else 470
        self.box(
            cta.get("action_label") or "Take the next step",
            60,
            186,
            width,
            151,
            "cta.action_label",
            size=13,
            minimum=11,
            role="bold",
            fill=white,
        )
        self.box(
            self.brand.get("phone_display", ""),
            60,
            151,
            width,
            132,
            "brand.phone_display",
            size=11,
            minimum=9,
            fill=self.accent_light,
            single=True,
        )
        self.box(
            self.brand.get("contact_url", ""),
            60,
            131,
            width,
            113,
            "brand.contact_url",
            size=8.5,
            minimum=7.5,
            fill=self.paper,
            single=True,
        )
        if cta.get("action_body"):
            if self.brand.get("phone_display") or self.brand.get("contact_url"):
                raise LayoutError(
                    "cta.action_body",
                    "The action panel has both delivery instructions and contact rows.",
                    "Adapt this panel to display both; never silently omit supplied instructions.",
                )
            self.box(
                cta["action_body"], 60, 148, 470, 114, "cta.action_body", size=9, fill=self.paper
            )
        self.qr(self.brand.get("contact_url"), 444, 109, 76)
        self.link(self.brand.get("phone_uri"), 58, 132, width, 20)
        self.link(self.brand.get("contact_url"), 58, 112, width, 19)
        self.box(
            cta.get("follow_up_promise", ""),
            42,
            83,
            528,
            42,
            "cta.follow_up_promise",
            size=8.5,
            fill=self.paper,
        )
        self.footer(dark=True)

    def build(self):
        contents = self.contents_rows() if self.data.get("include_contents", True) else []
        if not contents and self.data.get("proof_pillars"):
            raise LayoutError(
                "proof_pillars",
                "Proof pillars were provided while the contents page is disabled.",
                "Enable their section or deliberately place all proof wording in another approved section.",
            )
        process = self.batches(
            self.step_rows(self.data["process"].get("steps", []), "process"), 415, "process.steps"
        )
        cta = self.batches(
            self.step_rows(self.data["cta"].get("steps", []), "cta", cta=True),
            self.cta_header() - 215,
            "cta.steps",
        )
        self.cover_page()
        for rows in contents:
            self.next_page()
            self.contents_page(rows, len(contents))
        for i, service in enumerate(self.data.get("services", [])):
            self.next_page()
            self.service_page(service, i)
        for rows in process:
            self.next_page()
            self.process_page(rows)
        for rows in cta:
            self.next_page()
            self.cta_page(rows)
        self.canvas.save()
        self.pages = self.page_number
        self.output.parent.mkdir(parents=True, exist_ok=True)
        pending = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=self.output.parent, prefix=".catalogue-", suffix=".pdf", delete=False
            ) as handle:
                pending = Path(handle.name)
                handle.write(self.stream.getvalue())
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(pending, self.output)
        finally:
            if pending and pending.exists():
                pending.unlink()
        return {"output": str(self.output), "pages": self.pages, "font_sha256": self.font_files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(
            json.dumps({"status": "pass", **Catalogue(args.config, args.output).build()}, indent=2)
        )
        return 0
    except LayoutError as error:
        print(
            json.dumps(
                {
                    "status": "blocked",
                    "field": error.field,
                    "reason": error.reason,
                    "action": error.action,
                    "existing_pdf": "preserved",
                },
                indent=2,
            )
        )
        return 1
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(
            json.dumps(
                {
                    "status": "blocked",
                    "reason": str(error),
                    "action": "Check the catalogue configuration and assets; the existing PDF was preserved.",
                },
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
