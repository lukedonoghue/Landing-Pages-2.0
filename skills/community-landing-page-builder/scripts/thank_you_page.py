"""Derive a full confirmation page from the current marketing page, safely.

Reuse the actual header, styles, proof and helpful sections; replace only the
hero and enquiry controls. Unknown/malformed structure is an actionable blocker,
never a reason to silently ship an unrelated success card.
"""
from __future__ import annotations
import argparse
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import os
import tempfile
from urllib.parse import urlsplit, unquote
import guide_quality as quality

VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
OPENERS = {'data-open-modal','data-form-open','data-open-form','data-enquiry-cta','data-quote-cta'}


class Node:
    def __init__(self, tag, attrs, start, opening, parent=None):
        self.tag, self.attrs, self.start, self.opening, self.parent = tag, dict(attrs), start, opening, parent
        self.end = opening
        self.children = []


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text, self.nodes, self.stack = text, [], []
        self.lines = [0]
        self.lines += [m.end() for m in re.finditer('\n', text)]
        self.feed(text); self.close()
        if self.stack:
            raise ValueError('Close all HTML elements before deriving the thank-you page')
    def pos(self):
        row, col = self.getpos(); return self.lines[row-1]+col
    def handle_starttag(self, tag, attrs):
        n=Node(tag,attrs,self.pos(),self.pos()+len(self.get_starttag_text()),self.stack[-1] if self.stack else None)
        if n.parent:n.parent.children.append(n)
        self.nodes.append(n)
        if tag not in VOID:self.stack.append(n)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:self.stack.pop()
    def handle_endtag(self, tag):
        if tag in VOID:return
        if not self.stack or self.stack[-1].tag!=tag:
            raise ValueError('Use well-formed generated HTML; unmatched closing '+tag)
        self.stack.pop().end=self.text.index('>',self.pos())+1
    def content(self,n):return self.text[n.start:n.end]


def apply(text, edits):
    # An outer deletion/replacement subsumes nested edits (e.g. a whole dialog).
    chosen=[]
    for start,end,value in sorted(edits,key=lambda e:(e[0],-e[1])):
        if chosen and start < chosen[-1][1]:continue
        chosen.append((start,end,value))
    for start,end,value in reversed(chosen):text=text[:start]+value+text[end:]
    return text


def same_local(root, page, raw):
    """External URLs with a matching basename never qualify as our PDF/image."""
    url=urlsplit(raw)
    if url.scheme or url.netloc or not url.path or '\\' in raw:raise ValueError('Delivery must use the local generated asset')
    decoded=unquote(url.path)
    target=(root/'public'/decoded.lstrip('/')) if decoded.startswith('/') else page.parent/decoded
    relative=target.relative_to(root).as_posix()
    return quality.local(root, relative, 'public').resolve()


def derive(root, data):
    root=Path(root).resolve()
    source=quality.local(root,data.get('main_page','public/index.html'),'public')
    output=quality.local(root,data.get('output','public/thank-you.html'),'public')
    if source.parent != output.parent:raise ValueError('Keep the shared page and thank-you page in the same directory so relative assets keep working')
    if source==output:raise ValueError('Never overwrite the main landing page')
    build=quality.inspect_build(root)
    pdf=quality.local(root,build['output'],'public/assets/brochure')
    cover=quality.local(root,build['preview'],'public/assets/brochure')
    for field in ('confirmed_headline','follow_up','guide_summary'):
        if len(quality.norm(data.get(field,'')))<15:raise ValueError('Complete the approved confirmation '+field)
    if len(quality.norm(data.get('download_label',''))) < 5:raise ValueError('Use a clear guide download label')
    if re.search(r'immediate callback|request your .{0,30}quote',data['follow_up'],re.I):
        raise ValueError('Use a post-submission follow-up, not the pre-submit CTA or an unverified immediate callback')
    config=quality.read(root,'funnel.json')
    if quality.norm(data['follow_up'])!=quality.norm(config.get('follow_up_promise','')):
        raise ValueError('Confirmation follow-up must match the current approved operational promise')
    text=source.read_text();doc=Document(text)
    mains=[n for n in doc.nodes if n.tag=='main']
    heads=[n for n in doc.nodes if n.tag=='head']
    if len(mains)!=1 or len(heads)!=1:raise ValueError('The main page needs one main and one head element')
    main=mains[0]
    heroes=[n for n in main.children if 'data-page-hero' in n.attrs or data.get('hero_id') and n.attrs.get('id')==data['hero_id']]
    if not heroes:heroes=[n for n in main.children if n.tag=='section'][:1]
    if len(heroes)!=1:raise ValueError('Mark one direct main hero with data-page-hero or specify hero_id')
    hero=heroes[0]
    useful=[n for n in main.children if n.start>=hero.end and n.tag in {'section','article'} and not any(q.tag=='form' and q.start>=n.start and q.end<=n.end for q in doc.nodes)]
    if not useful:raise ValueError('Reuse meaningful benefit, proof, process or FAQ sections below the hero; a success box alone is not a full page')
    pdf_url='/'+pdf.relative_to(root/'public').as_posix();cover_url='/'+cover.relative_to(root/'public').as_posix()
    title=escape(data.get('guide_title') or quality.read(root,build['config'])['title'])
    brand=config.get('client',{})
    tel=brand.get('phone_uri','');phone=brand.get('phone_display','')
    if tel and (not phone or not re.fullmatch(r'tel:\+?[0-9 ()-]+',tel)):raise ValueError('Use the verified telephone URI and display number')
    phone_link = f'<p><a href="{escape(tel,quote=True)}">Questions? Call {escape(phone)}</a></p>' if tel and phone else ''
    hero_class=escape(hero.attrs.get('class',''),quote=True)
    new_hero=f'''<section class="{hero_class} thank-you-hero" data-confirmation-hero>
<div class="confirmation-copy">
<p class="label" data-confirmed-only hidden>Your request has been received</p>
<h1 data-confirmed-only hidden>{escape(data['confirmed_headline'])}</h1>
<p data-confirmed-only hidden>{escape(data['follow_up'])}</p>
<h1 data-unconfirmed-only>{title}</h1>
<p data-unconfirmed-only>This page alone does not confirm a request. After a successful form submission, your confirmation will appear here. You can still read the guide below.</p>
<h2>{escape(data['download_label'])}</h2><p>{escape(data['guide_summary'])}</p>
<a class="button" data-guide-download href="{escape(pdf_url,quote=True)}" download>{escape(data['download_label'])}</a>
{phone_link}
</div><a class="guide-cover-link" href="{escape(pdf_url,quote=True)}" aria-label="Open {title}" download>
<img data-guide-cover src="{escape(cover_url,quote=True)}" alt="Cover of {title}" width="480" height="679" fetchpriority="high"></a>
</section>'''
    edits=[(hero.start,hero.end,new_hero)]
    forms=[n for n in doc.nodes if n.tag=='form']
    form_ids={n.attrs.get('id') for n in forms}
    for n in forms:
        enclosing=n
        while enclosing.parent and enclosing.parent is not main:
            if enclosing.parent.attrs.get('role')=='dialog' or enclosing.parent.tag=='dialog':enclosing=enclosing.parent;break
            enclosing=enclosing.parent
        if enclosing.attrs.get('role')!='dialog' and enclosing.tag!='dialog':enclosing=n
        edits.append((enclosing.start,enclosing.end,''))
    for n in doc.nodes:
        attrs=n.attrs
        if n.tag in {'a','button'} and (OPENERS.intersection(attrs) or attrs.get('href','').lstrip('#') in form_ids or attrs.get('type')=='submit'):
            edits.append((n.start,n.end,f'<a class="{escape(attrs.get("class","button"),quote=True)}" data-guide-download href="{escape(pdf_url,quote=True)}" download>{escape(data["download_label"])}</a>'))
        if n.tag=='script' and urlsplit(attrs.get('src','')).path.endswith('/funnel.js') or n.tag=='script' and attrs.get('src')=='funnel.js':
            opening=text[n.start:n.opening]
            opening=re.sub(r'\sdata-measure=(?:"[^"]*"|\x27[^\x27]*\x27)', '',opening)
            edits.append((n.start,n.opening,opening[:-1]+' data-measure="false">'))
        if n.tag=='title':edits.append((n.start,n.end,'<title>'+title+' | Thank you</title>'))
        if n.tag=='meta' and attrs.get('name')=='robots':edits.append((n.start,n.end,''))
        if n.tag=='link' and attrs.get('rel')=='canonical':edits.append((n.start,n.end,''))
    header=[n for n in doc.nodes if n.tag=='header']
    if not header:raise ValueError('Reuse the main page header and telephone contact')
    if tel and phone and not any(n.tag=='a' and n.attrs.get('href')==tel and header[0].start<n.start<header[0].end for n in doc.nodes):
        at=header[0].end-len('</header>');edits.append((at,at,f'<a class="confirmation-phone" href="{escape(tel,quote=True)}">{escape(phone)}</a>'))
    head_at=heads[0].end-len('</head>')
    edits.append((head_at,head_at,'<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/confirmation.css"><script src="/confirmation.js" defer></script>'))
    at=main.end-len('</main>')
    edits.append((at,at,f'<section class="guide-reader" data-guide-reader><h2>Read your guide now</h2><details><summary>Open the on-page reader</summary><iframe data-guide-embed src="{escape(pdf_url,quote=True)}" title="{title}" loading="lazy"></iframe></details><p>Reader unavailable? <a data-guide-download href="{escape(pdf_url,quote=True)}" download>{escape(data["download_label"])}</a></p></section>'))
    result=apply(text,edits)
    final=Document(result)
    if any(n.tag=='form' or OPENERS.intersection(n.attrs) for n in final.nodes):raise ValueError('Remove remaining enquiry forms/actions before delivery')
    return source,output,result,{'source_main_sha256':quality.sha(source),'guide_build_sha256':quality.sha(root/'build/guide-build.json'),
        'reused_sections':len(useful),'download_path':pdf_url,'cover_path':cover_url,'follow_up':data['follow_up']}


def inspect(root):
    root=Path(root).resolve()
    report=quality.read(root,'build/thank-you-build.json')
    data=quality.read(root,'build/thank-you.json')
    source,output,expected,details=derive(root,data)
    if report.get('schema_version') != 1 or report.get('status') != 'pass':raise ValueError('Build the full confirmation page before review')
    if set(report.get('assets',{})) != {'public/confirmation.css','public/confirmation.js'}:raise ValueError('Bind both maintained confirmation assets')
    if report.get('config_sha256')!=quality.sha(root/'build/thank-you.json') or any(report.get(k)!=v for k,v in details.items()):
        raise ValueError('Main page, guide or confirmation copy changed; regenerate the shared thank-you page')
    if not output.is_file() or output.read_text()!=expected or report.get('output_sha256')!=quality.sha(output):
        raise ValueError('Thank-you page differs from its source-bound generated version')
    for name,digest in report.get('assets',{}).items():
        if quality.sha(quality.local(root,name,'public'))!=digest:raise ValueError('Confirmation runtime changed; rebuild and retest')
    return report


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('project',type=Path);p.add_argument('--check',action='store_true');a=p.parse_args();root=a.project.resolve()
    if a.check:print(json.dumps(inspect(root),indent=2));return
    data=quality.read(root,'build/thank-you.json');source,output,text,details=derive(root,data)
    previous=root/'build/thank-you-build.json'
    old=json.loads(previous.read_text()) if previous.is_file() else {}
    if output.exists() and '<!-- COMMUNITY_THANK_YOU_TEMPLATE -->' not in output.read_text() and quality.sha(output) not in {old.get('output_sha256'),data.get('replace_existing_sha256')}:
        raise ValueError('Existing thank-you page is customized. Review it, then bind replace_existing_sha256; never overwrite it blindly')
    from runtime_context import skill_root
    assets={}
    for name in ('confirmation.css','confirmation.js'):
        target=quality.local(root,'public/'+name,'public');source_asset=skill_root(__file__)/'assets/cloudflare/public'/name
        raw=source_asset.read_bytes()
        if target.exists() and target.read_bytes()!=raw and quality.sha(target)!=old.get('assets',{}).get('public/'+name):raise ValueError('Preserve customized confirmation asset: '+name)
        target.write_bytes(raw);assets['public/'+name]=quality.sha(target)
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w',dir=output.parent,delete=False,encoding='utf-8') as handle:
        tmp=Path(handle.name);handle.write(text)
    try:os.replace(tmp,output)
    finally:tmp.unlink(missing_ok=True)
    report={'schema_version':1,'status':'pass',**details,'output':output.relative_to(root).as_posix(),'output_sha256':quality.sha(output),'config_sha256':quality.sha(root/'build/thank-you.json'),'assets':assets}
    from build_guide import write_json
    write_json(root/'build/thank-you-build.json',report)
    import dependency_state
    guide_build=quality.read(root,'build/guide-build.json')
    dependency_state.record(root,'thank_you',[source.relative_to(root).as_posix(),'build/thank-you.json',guide_build['output']],[output.relative_to(root).as_posix(),*assets])
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError,TypeError) as error:
        print(json.dumps({'status':'blocked','error':str(error)}));raise SystemExit(1)
