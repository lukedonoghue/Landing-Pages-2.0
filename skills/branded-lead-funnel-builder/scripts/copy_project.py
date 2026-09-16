#!/usr/bin/env python3
"""Start a copy-only project and collect bounded, source-linked website research.

Does not generate copy, call an LLM, submit forms, or create infrastructure.
The skill's writer and reviewer perform the semantic work after inspecting sources.
"""
import argparse,concurrent.futures,datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,unquote

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def clean(s):
    s=re.sub(r'!\[[^\]]*\]\([^\n]*\)','',s)
    s=re.sub(r'\[([^\]]+)\]\([^\n]*?\)',r'\1',s)
    return re.sub(r'[ \t]+',' ',re.sub(r'[*_~]','',s).replace('\xa0',' ')).strip()
def normalized(url):
    p=urlsplit(url)
    if p.scheme not in ('http','https') or not p.hostname or p.username or p.password:raise ValueError('Provide a normal HTTP(S) website URL without embedded credentials')
    return urlunsplit((p.scheme,p.netloc,p.path or '/',p.query,''))
def choose_links(home,links,limit):
    hostname=urlsplit(home).hostname;ranked={}
    for item in links:
        url=item.get('url','') if isinstance(item,dict) else item
        if not isinstance(url,str):continue
        try:p=urlsplit(normalized(url))
        except ValueError:continue
        if p.hostname!=hostname or p.query:continue
        path=unquote(p.path).lower()
        if re.search(r'privacy|terms|login|sign.in|cart|checkout|unsubscribe|logout|wp.admin|\.(?:pdf|png|jpg|mp4|zip)$',path):continue
        score=max(1,sum(weight for word,weight in [('service',9),('process',9),('how-it-works',9),('faq',8),('testimonial',8),('review',8),('about',6),('project',5),('case-stud',5),('contact',4),('location',3)] if word in path))
        if score and normalized(url).rstrip('/')!=home.rstrip('/'):ranked[normalized(url)]=score
    ordered=[url for url,_ in sorted(ranked.items(),key=lambda x:-x[1])]
    chosen=[]
    for category in ('service','process|how-it-works','faq','testimonial|review','about','project|case-stud','contact'):
        match=next((u for u in ordered if u not in chosen and re.search(category,urlsplit(u).path,re.I)),None)
        if match:chosen.append(match)
    return (chosen+[u for u in ordered if u not in chosen])[:max(0,limit)]
def capture(root,url,index):
    sid=f'S{index:03d}';raw=root/'.firecrawl'/f'{sid}.json';raw.parent.mkdir(parents=True,exist_ok=True)
    result=dict(id=sid,url=url,retrieved_at=now(),raw_path=str(raw.relative_to(root)),status='unavailable')
    try:
        run=subprocess.run(['firecrawl','scrape',url,'--format','markdown,links','--json','-o',str(raw)],capture_output=True,text=True,timeout=120)
        if run.returncode:result['error']=run.stderr[-400:];return result,[]
        data=json.loads(raw.read_text());md=data.get('markdown','');meta=data.get('metadata',{})
        result['http_status']=meta.get('statusCode');result['title']=meta.get('title','')
        text=clean(md)
        if (meta.get('statusCode') or 0)>=400 or len(text.split())<40 or re.search(r'^(?:# )?(?:Looks Like You.re Lost|Access Denied|404 Not Found)',text,re.I):
            result['error']='HTTP error, blocked page or insufficient page content';return result,[]
        dest=root/'research'/f'{sid}.txt';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text+'\n')
        result.update(status='captured',text_path=str(dest.relative_to(root)),sha256=digest(dest),words=len(text.split()))
        return result,data.get('links',[])
    except (OSError,ValueError,subprocess.TimeoutExpired) as e:result['error']=str(e)[:400];return result,[]
def collect(root,website,explicit=(),max_pages=8):
    root=Path(root).resolve();url=normalized(website)
    if (root/'research/sources.json').exists():raise ValueError('Research already exists. Use a new run directory to preserve the earlier evidence.')
    root.mkdir(parents=True,exist_ok=True)
    first,links=capture(root,url,1);records=[first]
    if first['status']!='captured':
        write(root/'research/sources.json',{'schema_version':1,'website':url,'sources':records,'status':'blocked','captured_at':now()})
        raise ValueError('Homepage could not be captured. Inspect the saved error; do not draft from missing evidence.')
    candidates=[]
    for u in list(explicit)+choose_links(url,links,max_pages-1):
        u=normalized(u)
        if urlsplit(u).hostname!=urlsplit(url).hostname:raise ValueError('Additional client-page URLs must be on the supplied website')
        if u.rstrip('/')!=url.rstrip('/') and u not in candidates:candidates.append(u)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures=[pool.submit(capture,root,u,i+2) for i,u in enumerate(candidates[:max_pages-1])]
        records += [f.result()[0] for f in futures]
    manifest={'schema_version':1,'project_root':str(root),'website':url,'captured_at':now(),'sources':records,'status':'ready_for_research_review','external_reviews':'not_collected_by_this_helper','industry_research':'not_collected_by_this_helper'}
    write(root/'research/sources.json',manifest)
    ignore=root/'.gitignore';existing=ignore.read_text() if ignore.exists() else ''
    if '.firecrawl/' not in existing.splitlines():ignore.write_text(existing.rstrip()+'\n.firecrawl/\n')
    lines=['# Website research index','','This is source collection, not a completed strategy or approval. Read the sources, verify the business identity, and add targeted public-review and industry research where useful.','','| ID | Page | Words | Status |','|---|---|---:|---|']
    for r in records:lines.append(f"| {r['id']} | [{r['title'] or r['url']}]({r['url']}) | {r.get('words',0)} | {r['status']} |")
    lines+=['','Next: create the client copy brief from inspected facts. Link each website claim to a source_id and verbatim evidence. Record audience/service/offer assumptions separately; do not invent a brochure, price, review, warranty or response time.','']
    (root/'research/INDEX.md').write_text('\n'.join(lines))
    return dict(project=str(root),captured=sum(r['status']=='captured' for r in records),unavailable=sum(r['status']!='captured' for r in records),manifest=str(root/'research/sources.json'))
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--website',required=True);p.add_argument('--project',required=True);p.add_argument('--page',action='append',default=[]);p.add_argument('--max-pages',type=int,default=8);a=p.parse_args()
    try:print(json.dumps(collect(a.project,a.website,a.page,min(max(a.max_pages,1),12)),indent=2));return 0
    except (ValueError,OSError) as e:print(str(e),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
