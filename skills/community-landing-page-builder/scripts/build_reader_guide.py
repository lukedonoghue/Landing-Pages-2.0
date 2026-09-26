"""A readable, image-led buyer guide, rather than a padded services catalogue.

All copy is authored from research before rendering. This module never invents
business facts, fetches images, calls a model or substitutes generic filler.
"""
from __future__ import annotations
import os
from pathlib import Path
import tempfile
from xml.sax.saxutils import escape
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak,
                               HRFlowable, CondPageBreak, Table, TableStyle)
from build_catalogue import Catalogue, normalize_text
from guide_quality import local


def build(root, config_path, output, data):
    root, output = Path(root).resolve(), Path(output)
    # Reuse the maintained font registration, glyph coverage and brand palette.
    typesetter = Catalogue(Path(config_path), output)
    regular, bold = typesetter.fonts['regular'], typesetter.fonts['bold']
    width = A4[0] - 88
    primary, ink = typesetter.primary, typesetter.ink
    styles = {
        'body': ParagraphStyle('Body', fontName=regular, fontSize=11, leading=15, textColor=ink, spaceAfter=8),
        'title': ParagraphStyle('Title', fontName=bold, fontSize=30, leading=35, textColor=primary, spaceAfter=18),
        'h1': ParagraphStyle('Heading', fontName=bold, fontSize=24, leading=29, textColor=primary, spaceAfter=14, keepWithNext=True),
        'h2': ParagraphStyle('Subheading', fontName=bold, fontSize=12, leading=17, textColor=primary, spaceBefore=8, spaceAfter=6, keepWithNext=True),
        'caption': ParagraphStyle('Caption', fontName=regular, fontSize=9, leading=13, textColor=typesetter.muted, spaceAfter=10),
        'small': ParagraphStyle('Small', fontName=regular, fontSize=8, leading=11, textColor=typesetter.muted, spaceAfter=6),
        # Designed cover band and chapter blocks.
        'band_caption': ParagraphStyle('BandCaption', fontName=regular, fontSize=10, leading=14, textColor=typesetter.accent_light, spaceAfter=10),
        'band_title': ParagraphStyle('BandTitle', fontName=bold, fontSize=30, leading=35, textColor=colors.white, spaceAfter=12),
        'band_body': ParagraphStyle('BandBody', fontName=regular, fontSize=12, leading=17, textColor=colors.white),
        'contents': ParagraphStyle('Contents', fontName=bold, fontSize=11, leading=15, textColor=ink),
        'callout_title': ParagraphStyle('CalloutTitle', fontName=bold, fontSize=11, leading=15, textColor=primary, spaceAfter=4),
        'cell_head': ParagraphStyle('CellHead', fontName=bold, fontSize=10, leading=13, textColor=colors.white),
        'cell': ParagraphStyle('Cell', fontName=regular, fontSize=10, leading=13, textColor=ink),
    }
    BOLD = {'title', 'h1', 'h2', 'band_title', 'contents', 'callout_title', 'cell_head'}
    def p(text, kind='body'):
        text = normalize_text(text)
        typesetter.check_glyphs(text, 'bold' if kind in BOLD else 'regular', 'buyer guide')
        return Paragraph(escape(text).replace('\n', '<br/>'), styles[kind])
    def photo(item, max_height=220):
        path = local(root, item['path'], 'public/assets')
        with PILImage.open(path) as image:
            iw, ih = image.size
        scale = min(width/iw, max_height/ih)
        visual = Image(str(path), width=iw*scale, height=ih*scale, hAlign='LEFT')
        return [visual, Spacer(1, 6), p(item['caption'], 'caption')]
    def checklist(items):
        # Real text bullets, not rasterized copy. Rows split at sensible boundaries.
        return [p(f'{i+1}. {text}') for i, text in enumerate(items)]
    def boxed(rows, style, **options):
        table = Table(rows, colWidths=options.pop('widths', [width]), **options)
        table.setStyle(TableStyle(style))
        return table
    def callout(item):
        return [Spacer(1, 4), boxed([[[p(item['title'], 'callout_title'), p(item['body'])]]],
            [('BACKGROUND', (0, 0), (-1, -1), typesetter.paper), ('LINEBEFORE', (0, 0), (0, -1), 4, typesetter.accent),
             ('LEFTPADDING', (0, 0), (-1, -1), 16), ('RIGHTPADDING', (0, 0), (-1, -1), 16), ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]), Spacer(1, 10)]
    def price_table(item):
        columns = len(item['columns'])
        rows = [[p(c, 'cell_head') for c in item['columns']], *[[p(c, 'cell') for c in row] for row in item['rows']]]
        block = [p(item['caption'], 'h2'), boxed(rows,
            [('BACKGROUND', (0, 0), (-1, 0), primary), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, typesetter.paper]),
             ('LINEBELOW', (0, 0), (-1, -1), .5, typesetter.pale), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
             ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)], widths=[width / columns] * columns, repeatRows=1)]
        if item.get('note'): block.append(p(item['note'], 'small'))
        return block + [Spacer(1, 8)]
    story = []
    logo = data.get('brand', {}).get('logo')
    if logo:
        asset = local(root, logo, 'public/assets')
        if not asset or not asset.is_file() or not asset.is_relative_to(root):
            raise ValueError('Use a local, readable brand logo')
        with PILImage.open(asset) as image: iw, ih = image.size
        s = min(145/iw, 54/ih)
        story.extend([Image(str(asset), width=iw*s, height=ih*s, hAlign='LEFT'), Spacer(1, 20)])
    # Cover band in the brand colour; its height follows the approved title length.
    story.append(boxed([[[p(data['audience'], 'band_caption'), p(data['title'], 'band_title'), p(data['subtitle'], 'band_body')]]],
        [('BACKGROUND', (0, 0), (-1, -1), primary), ('LEFTPADDING', (0, 0), (-1, -1), 26), ('RIGHTPADDING', (0, 0), (-1, -1), 26),
         ('TOPPADDING', (0, 0), (-1, -1), 22), ('BOTTOMPADDING', (0, 0), (-1, -1), 24), ('ROUNDEDCORNERS', [8, 8, 8, 8])]))
    story.append(Spacer(1, 16))
    story.extend(photo(next(i for i in data['images'] if i['placement']=='cover'), 250))
    story.extend([p('What this guide will help you decide', 'h2'), p(data['reader_promise'])])
    story.append(boxed([[p(chapter['headline'], 'contents')] for chapter in data['chapters']],
        [('LINEBEFORE', (0, 0), (0, -1), 3, typesetter.accent), ('LEFTPADDING', (0, 0), (-1, -1), 12), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    source_order = {s['id']: i+1 for i,s in enumerate(data['sources'])}
    for number, chapter in enumerate(data['chapters'], 1):
        story.extend([PageBreak() if number == 1 else CondPageBreak(245), Spacer(1, 12), p(f'{number:02d} / {chapter["reader_question"]}', 'caption'), p(chapter['headline'], 'h1'), p(chapter['why_it_matters'])])
        images = [i for i in data['images'] if i['placement']==chapter['id']]
        if images: story.extend(photo(images[0], 205))
        for paragraph in chapter['paragraphs']: story.append(p(paragraph))
        if chapter.get('price_table'): story.extend(price_table(chapter['price_table']))
        if chapter.get('callout'): story.extend(callout(chapter['callout']))
        story.append(p('Put this to use', 'h2'))
        story.extend(checklist(chapter['takeaways']))
        for image in images[1:]: story.extend(photo(image, 180))
    story.extend([CondPageBreak(245), Spacer(1, 20), p(data.get('checklist_title', 'Keep these questions handy'), 'h1')])
    story.extend(checklist(data['checklist']))
    story.extend([Spacer(1, 12), HRFlowable(width='100%', color=typesetter.accent), p('Your next step', 'h2'), p(data['next_step'])])
    phone = data.get('brand', {}).get('phone_display')
    if phone: story.append(p('Questions? '+phone, 'h2'))
    story.append(p('Sources and scope', 'h2'))
    for i, source in enumerate(data['sources'], 1):
        story.append(p(f'[{i}] {source["title"]}. {source["kind"].capitalize()} source, reviewed {source["retrieved_at"]}.', 'small'))
    story.append(p(data.get('scope_note', 'Use this guide to prepare questions. The written recommendation and agreed scope for your situation remain authoritative.'), 'small'))
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.reader-guide-', suffix='.pdf', dir=output.parent)
    os.close(fd)
    count = [0]
    def page(canvas, doc):
        count[0] += 1
        canvas.saveState()
        canvas.setStrokeColor(typesetter.accent)
        canvas.line(44, 37, A4[0]-44, 37)
        canvas.setFillColor(typesetter.muted); canvas.setFont(regular, 8)
        footer = normalize_text(data['brand']['name'])
        if len(footer) > 75: raise ValueError('Use a concise brand footer; do not silently truncate its name')
        typesetter.check_glyphs(footer, 'regular', 'brand footer')
        canvas.drawString(44, 24, footer)
        canvas.drawRightString(A4[0]-44, 24, str(doc.page))
        canvas.restoreState()
    try:
        doc = SimpleDocTemplate(name, pagesize=A4, rightMargin=44, leftMargin=44,
                               topMargin=40, bottomMargin=53, title=data['title'], author=data['brand']['name'])
        doc.build(story, onFirstPage=page, onLaterPages=page)
        os.replace(name, output)
    finally:
        Path(name).unlink(missing_ok=True)
    return {'page_count': count[0]}
