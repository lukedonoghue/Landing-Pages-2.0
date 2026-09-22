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
                               HRFlowable, CondPageBreak)
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
        'body': ParagraphStyle('Body', fontName=regular, fontSize=11, leading=16, textColor=ink, spaceAfter=11),
        'title': ParagraphStyle('Title', fontName=bold, fontSize=30, leading=35, textColor=primary, spaceAfter=18),
        'h1': ParagraphStyle('Heading', fontName=bold, fontSize=24, leading=29, textColor=primary, spaceAfter=16, keepWithNext=True),
        'h2': ParagraphStyle('Subheading', fontName=bold, fontSize=12, leading=17, textColor=primary, spaceBefore=10, spaceAfter=8, keepWithNext=True),
        'caption': ParagraphStyle('Caption', fontName=regular, fontSize=9, leading=13, textColor=typesetter.muted, spaceAfter=15),
        'small': ParagraphStyle('Small', fontName=regular, fontSize=8, leading=11, textColor=typesetter.muted, spaceAfter=6),
    }
    def p(text, kind='body'):
        text = normalize_text(text)
        typesetter.check_glyphs(text, 'bold' if kind in {'title','h1','h2'} else 'regular', 'buyer guide')
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
    story = []
    logo = data.get('brand', {}).get('logo')
    if logo:
        asset = local(root, logo, 'public/assets')
        if not asset or not asset.is_file() or not asset.is_relative_to(root):
            raise ValueError('Use a local, readable brand logo')
        with PILImage.open(asset) as image: iw, ih = image.size
        s = min(145/iw, 54/ih)
        story.extend([Image(str(asset), width=iw*s, height=ih*s, hAlign='LEFT'), Spacer(1, 20)])
    story.extend([p(data['audience'], 'caption'), p(data['title'], 'title'), p(data['subtitle'])])
    story.extend(photo(next(i for i in data['images'] if i['placement']=='cover'), 270))
    story.extend([p('What this guide will help you decide', 'h2'), p(data['reader_promise'])])
    for chapter in data['chapters']:
        story.append(p(chapter['headline'], 'caption'))
    source_order = {s['id']: i+1 for i,s in enumerate(data['sources'])}
    for number, chapter in enumerate(data['chapters'], 1):
        story.extend([PageBreak() if number == 1 else CondPageBreak(245), Spacer(1, 12), p(f'{number:02d} / {chapter["reader_question"]}', 'caption'), p(chapter['headline'], 'h1'), p(chapter['why_it_matters'])])
        images = [i for i in data['images'] if i['placement']==chapter['id']]
        if images: story.extend(photo(images[0], 205))
        for paragraph in chapter['paragraphs']: story.append(p(paragraph))
        story.append(p('Put this to use', 'h2'))
        story.extend(checklist(chapter['takeaways']))
        citations = sorted({source_order[e['source_id']] for e in chapter['evidence']})
        story.append(p('Research notes: '+', '.join('['+str(n)+']' for n in citations), 'small'))
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
