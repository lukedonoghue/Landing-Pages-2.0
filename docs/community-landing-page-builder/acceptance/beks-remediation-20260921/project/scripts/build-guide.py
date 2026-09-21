#!/usr/bin/env python3
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
COPY = json.loads((ROOT / "build/page-copy.json").read_text())
OUTPUT = ROOT / "public/assets/bookkeeping-month-end-clarity-checklist.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

BURGUNDY = colors.HexColor("#5F0B35")
TEAL = colors.HexColor("#2F675D")
INK = colors.HexColor("#211A1E")
MUTED = colors.HexColor("#695E64")
PAPER = colors.HexColor("#FBF8FA")
LINE = colors.HexColor("#D8C6CF")
WHITE = colors.white

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=BURGUNDY, spaceAfter=16, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Times-Bold", fontSize=35, leading=39, textColor=INK, spaceAfter=18, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="CoverBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=13, leading=19, textColor=MUTED, spaceAfter=24, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="PageTitle", parent=styles["Heading1"], fontName="Times-Bold", fontSize=25, leading=29, textColor=INK, spaceAfter=15))
styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=BURGUNDY, spaceBefore=8, spaceAfter=7))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="GuideBullet", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.25, leading=14.5, textColor=INK, leftIndent=16, firstLineIndent=-10, bulletIndent=0, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=5))
styles.add(ParagraphStyle(name="NoteLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9.5, leading=13, textColor=TEAL, spaceAfter=5))
styles.add(ParagraphStyle(name="Footer", parent=styles["Normal"], fontName="Helvetica", fontSize=7.8, leading=10, textColor=MUTED, alignment=TA_CENTER))


def decorate(canvas, doc):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setFillColor(BURGUNDY)
    canvas.rect(0, height - 0.16 * inch, width, 0.16 * inch, stroke=0, fill=1)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.7)
    canvas.line(0.58 * inch, 0.54 * inch, width - 0.58 * inch, 0.54 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.58 * inch, 0.31 * inch, text["running_footer"])
    canvas.drawRightString(width - 0.58 * inch, 0.31 * inch, f"PAGE {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=letter,
    leftMargin=0.68 * inch,
    rightMargin=0.68 * inch,
    topMargin=0.62 * inch,
    bottomMargin=0.98 * inch,
    title=COPY["brochure"]["title"],
    author="Independent Bookkeeping by Beks demonstration",
    subject="QuickBooks month-end preparation checklist",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="guide", frames=[frame], onPage=decorate)])

brochure = COPY["brochure"]
text = brochure["text"]
story = []

story.append(Spacer(1, 0.55 * inch))
story.append(Paragraph(text["cover"][2].upper(), styles["CoverKicker"]))
story.append(Paragraph(text["cover"][0], styles["CoverTitle"]))
story.append(Paragraph(text["cover"][1], styles["CoverBody"]))

summary = Table(
    [
        [Paragraph(f"{index:02d}", styles["NoteLabel"]), Paragraph(label, styles["Body"])]
        for index, label in enumerate(text["summary"], 1)
    ],
    colWidths=[0.48 * inch, 4.5 * inch],
    hAlign="LEFT",
)
summary.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ("BOX", (0, 0), (-1, -1), 0.7, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.append(summary)
story.append(Spacer(1, 0.25 * inch))
story.append(Paragraph(text["cover"][3], styles["Small"]))
story.append(PageBreak())

story.append(Paragraph(text["page_titles"][0], styles["PageTitle"]))
story.append(Paragraph(text["introduction"][0], styles["CoverBody"]))
for section in text["sections"][:2]:
    story.append(Paragraph(section["heading"], styles["SectionTitle"]))
    for item in section["items"]:
        story.append(Paragraph(item, styles["GuideBullet"], bulletText="•"))
    story.append(Spacer(1, 0.08 * inch))
story.append(Spacer(1, 0.18 * inch))
story.append(Paragraph(text["callouts"][0]["heading"], styles["SectionTitle"]))
story.append(Paragraph(text["callouts"][0]["body"], styles["Body"]))
story.append(PageBreak())

story.append(Paragraph(text["page_titles"][1], styles["PageTitle"]))
for section in text["sections"][2:4]:
    story.append(Paragraph(section["heading"], styles["SectionTitle"]))
    for item in section["items"]:
        story.append(Paragraph(item, styles["GuideBullet"], bulletText="•"))
    story.append(Spacer(1, 0.08 * inch))
story.append(Spacer(1, 0.18 * inch))
story.append(Paragraph(text["callouts"][1]["heading"], styles["SectionTitle"]))
story.append(Paragraph(text["callouts"][1]["body"], styles["Body"]))
story.append(PageBreak())

story.append(Paragraph(text["page_titles"][2], styles["PageTitle"]))
section = text["sections"][4]
story.append(Paragraph(section["heading"], styles["SectionTitle"]))
for item in section["items"]:
    story.append(Paragraph(item, styles["GuideBullet"], bulletText="•"))
story.append(Spacer(1, 0.16 * inch))
story.append(Paragraph("Conversation notes", styles["SectionTitle"]))
for item in text["conversation_notes"]:
    story.append(Paragraph(item, styles["NoteLabel"]))
    story.append(Spacer(1, 0.14 * inch))
    story.append(Table([[""]], colWidths=[doc.width], rowHeights=[0.01 * inch], style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.6, LINE)])))
    story.append(Spacer(1, 0.05 * inch))
story.append(Spacer(1, 0.06 * inch))
for line in text["footer"]:
    story.append(Paragraph(line, styles["Footer"]))

doc.build(story)
print(OUTPUT)
