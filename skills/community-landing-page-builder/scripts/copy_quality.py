#!/usr/bin/env python3
"""Deterministic copy findings plus evidence-bound semantic review, not a quality score."""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import re
import sys

SEMANTIC_DOMAINS=('claim_boundaries','section_purposes','cta_support','benefits','removable_sections','offer_repetition','research_narration')
RISK=re.compile(r'\b(?:no upsell\w*|only (?:the )?work you need|work you actually need|without making the project bigger|lowest price|same.day|guarantee\w*|insured|licensed|fastest)\b',re.I)
JARGON=re.compile(r'\b(?:local (?:demo )?CRM|D1 receipt|source.fingerprint|backend persistence|operator workflow)\b',re.I)


def lint(root):
    import copy_contract
    import copy_acceptance
    root=Path(root).resolve();name=copy_contract.copy_files(root)['copy'];path=root/name
    corpus=copy_acceptance.text(path);findings=[];words=re.findall(r"[\w']+",corpus.lower())
    counts=Counter(tuple(words[i:i+5]) for i in range(max(0,len(words)-4)))
    for phrase,count in sorted(counts.items()):
        if count>=3:findings.append({'kind':'repeated_phrase','excerpt':' '.join(phrase),'count':count})
    for pattern,kind in ((JARGON,'implementation_jargon'),(RISK,'claim_risk')):
        for match in pattern.finditer(corpus):findings.append({'kind':kind,'excerpt':match.group(0)})
    for issue in copy_acceptance.customer_copy_issues(path):findings.append({'kind':'research_narration','excerpt':issue})
    for finding in findings:
        finding['id']=hashlib.sha256(json.dumps(finding,sort_keys=True).encode()).hexdigest()[:16]
    return {'schema_version':1,'copy':{'path':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},
            'findings':findings,'scope':'Mechanical review prompts, not automatic semantic judgments'}


def inspect(root):
    import completion_contract as c
    import copy_acceptance
    root=Path(root).resolve();errors=[]
    try:
        measured=lint(root);report=c.read(root/'build/copy-quality-review.json')
        if report.get('copy')!=measured['copy']:raise ValueError('Copy-quality review is stale or uses a different canonical master')
        if not c.text(report.get('reviewer')) or report.get('status')!='pass':raise ValueError('Copy quality needs an actual reviewer and resolved findings')
        dispositions=report.get('findings',[])
        for finding in measured['findings']:
            rows=[r for r in dispositions if r.get('id')==finding['id']]
            if len(rows)!=1 or rows[0].get('disposition') not in {'accepted_limit','not_applicable'} or not c.text(rows[0].get('reason')):
                raise ValueError('Unresolved current copy-quality finding: '+finding['kind']+' '+finding['excerpt'])
            c.evidence(root,rows[0].get('evidence'))
            if finding['kind'] in {'implementation_jargon','research_narration'}:
                raise ValueError('Visitor implementation/research narration must be repaired, not waived')
        for key in SEMANTIC_DOMAINS:
            row=report.get('checks',{}).get(key,{})
            if row.get('status')!='pass' or not c.text(row.get('observations')):raise ValueError('Copy review must inspect '+key)
            c.evidence(root,row.get('evidence'))
        corpus=copy_acceptance.text(root/measured['copy']['path'])
        claims=c.read(root/'build/claim-review.json')
        if claims.get('copy')!=measured['copy'] or claims.get('coverage',{}).get('status')!='pass' or not c.text(claims.get('coverage',{}).get('observations')):
            raise ValueError('Semantic claim review must cover the current complete copy')
        rows=claims.get('claims')
        if not isinstance(rows,list):raise ValueError('Semantic claim review needs explicit claim rows')
        if not rows and not c.text(claims.get('no_material_claims_reason')):raise ValueError('An empty claim ledger needs a reviewed reason')
        ids=set()
        for row in rows:
            if not c.text(row.get('id')) or row['id'] in ids:raise ValueError('Claim IDs must be unique')
            ids.add(row['id'])
            for key in ('wording','qualifier','paraphrase_boundary','reviewer_judgment'):
                if not c.text(row.get(key)):raise ValueError('Claim '+row['id']+' needs '+key)
            if row['wording'] not in corpus:raise ValueError('Claim wording is not in current copy: '+row['id'])
            if row.get('truth_class') not in {'direct_fact','qualified_fact','review_theme','marketing_interpretation'} or row.get('status')!='pass':raise ValueError('Unsupported or unresolved claim: '+row['id'])
            if not row.get('locations'):raise ValueError('Claim needs permitted locations')
            source=c.evidence(root,row.get('evidence'))
            excerpt=row.get('source_excerpt')
            if not c.text(excerpt) or excerpt not in source.read_text():raise ValueError('Claim evidence excerpt is unanchored')
            # String anchoring is not semantic truth: require a separate explicit
            # judgment against the exact claim and permitted paraphrase boundary.
        for finding in measured['findings']:
            if finding['kind']=='claim_risk' and not any(finding['excerpt'].lower() in row.get('wording','').lower() for row in rows):
                raise ValueError('Risky wording is missing from the semantic claim ledger: '+finding['excerpt'])
        config=c.read(root/'funnel.json')
        promise=config.get('business_follow_up_promise')
        if not c.text(promise):raise ValueError('Separate business_follow_up_promise from preview_disclosure and local_test_behavior')
        for key in ('preview_disclosure','local_test_behavior'):
            if not isinstance(config.get(key),str):raise ValueError('Missing separate '+key)
        if config.get('follow_up_promise',promise)!=promise:raise ValueError('Legacy follow-up alias differs from the business promise; technical preview behavior is not a business promise')
        if JARGON.search(promise):raise ValueError('Business follow-up promise contains technical implementation wording')
        if config['local_test_behavior'] and config['local_test_behavior'] in corpus:raise ValueError('Technical local-test behavior leaked into visitor copy')
        insights=c.read(root/'build/review-insights.json')
        use=report.get('review_theme_use',[])
        for field,rows in insights.get('themes',{}).items():
            for theme in rows:
                matches=[r for r in use if r.get('dimension')==field and r.get('value')==theme.get('value')]
                if len(matches)!=1 or matches[0].get('disposition') not in {'used','omitted'} or not c.text(matches[0].get('reason')):
                    raise ValueError('Decide how review theme informs strategy even without publishable testimonials: '+field)
                row=matches[0]
                if row.get('review_ids')!=theme.get('review_ids'):raise ValueError('Strategy theme uses different supporting reviews')
                if row['disposition']=='used' and (not c.text(row.get('copy_excerpt')) or row['copy_excerpt'] not in corpus):raise ValueError('Used review theme needs a current copy excerpt')
    except (OSError,ValueError,TypeError,AttributeError,KeyError) as error:errors.append('Copy quality: '+str(error))
    return errors


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['lint','verify']);p.add_argument('project',type=Path)
    a=p.parse_args()
    try:
        result=lint(a.project) if a.command=='lint' else {'failures':inspect(a.project)}
        if a.command=='verify':result['status']='blocked' if result['failures'] else 'pass'
        print(json.dumps(result,indent=2));return bool(result.get('failures'))
    except (OSError,ValueError,KeyError,TypeError) as error:
        print(json.dumps({'status':'blocked','failures':[str(error)]}));return 1
if __name__=='__main__':sys.exit(main())
