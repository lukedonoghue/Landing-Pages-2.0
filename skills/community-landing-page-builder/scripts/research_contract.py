"""Structured research completeness. Evidence records do not authenticate publishers."""
from pathlib import Path
from urllib.parse import urlsplit
import json

SECTIONS = ('business_identity','service_offer','conversion_path','contact_details','service_area',
            'proof_credentials','first_party_assets','review_discovery','brand','source_qualifiers',
            'material_unknowns','positioning','stop_rule')
REVIEW_STATES = {'researched','unavailable','identity_unresolved','not_applicable'}


def inspect(root):
    import completion_contract as c
    import check_gates
    import review_workflow
    root=Path(root).resolve();errors=[]
    try: record=c.read(root/'build/research-acceptance.json')
    except (OSError,ValueError) as error:return ['Research contract: '+str(error)]
    sections=record.get('sections',{})
    for name in SECTIONS:
        try:
            row=sections.get(name,{})
            if row.get('status') not in {'pass','not_applicable'} or not c.text(row.get('reason')):
                raise ValueError(name+': record a resolved result or an evidence-backed not-applicable reason')
            if not isinstance(row.get('evidence'),list) or not row['evidence']:
                raise ValueError(name+': retain the evidence actually inspected')
            for item in row['evidence']:c.evidence(root,item)
            if row.get('unresolved_material_facts'):
                raise ValueError(name+': material unknowns remain unresolved')
        except (OSError,ValueError,TypeError,AttributeError,KeyError) as error:errors.append('Research contract: '+str(error))
    try:
        manifest=c.read(root/'research/reviews/review-manifest.json')
        state=manifest.get('research_status',manifest.get('status'))
        if state not in REVIEW_STATES:raise ValueError('Every complete build needs an explicit review research state')
        searches=manifest.get('discovery',[])
        if not isinstance(searches,list) or not searches:raise ValueError('Review discovery needs actual searched sources, dates, identity signals and outcomes')
        for row in searches:
            if any(not c.text(row.get(k)) for k in ('source','identity_signals','outcome','searched_at')):
                raise ValueError('Review discovery record is incomplete')
            check_gates.parsed_time(row['searched_at']);c.evidence(root,row.get('evidence'))
        usable=list(review_workflow.matched_reviews(manifest))
        if state=='researched' and not usable:raise ValueError('A researched review state needs usable identity-matched reviews')
        if state!='researched' and usable:raise ValueError('Usable reviews cannot be hidden behind an unavailable/not-applicable state')
        if state!='researched' and not c.text(manifest.get('reason')):raise ValueError('Unavailable review research needs its concrete reason')
        for review in usable:
            analysis=review.get('analysis',{})
            for field in review_workflow.ANALYSIS_FIELDS:
                if not isinstance(analysis.get(field),list):
                    raise ValueError('Review '+str(review.get('id'))+' has not assessed '+field+'; use [] for no supported theme')
        # Existing validate_reviews and aggregate verify identities, terms, exact
        # source bytes and insights. This closes omission as an escape route.
    except (OSError,ValueError,TypeError,AttributeError,KeyError) as error:errors.append('Review research: '+str(error))
    try:
        brand=c.read(root/'build/brand.json')
        decisions=record.get('brand_decisions',{})
        for key in ('logo','colors','heading_font','body_font'):
            row=decisions.get(key,{})
            if not c.text(row.get('observed')) or not c.text(row.get('selected')):
                raise ValueError('Brand '+key+' needs observed and selected values')
            c.evidence(root,row.get('evidence'))
            if row['observed']!=row['selected'] and not c.text(row.get('fallback_reason')):
                raise ValueError('Brand '+key+' fallback needs an explicit reason')
        if brand.get('kind')!='rendered_brand_measurement' or not brand.get('measurements'):
            raise ValueError('Retain the actual rendered brand measurement even when fonts need a fallback')
    except (OSError,ValueError,TypeError,AttributeError,KeyError) as error:errors.append('Brand contract: '+str(error))
    for angle in record.get('positioning_angles',[]):
        if any(not c.text(angle.get(k)) for k in ('differentiation','review_support','claim_risk','placement')):
            errors.append('Positioning: '+str(angle.get('id'))+' needs differentiation, review support, claim risk and placement')
    try:
        plan=c.read(root/'image-plan.json') if (root/'image-plan.json').is_file() else {}
        assets={a.get('id'):a for a in plan.get('assets',[])}
        for attempt in record.get('first_party_image_attempts',[]):
            if attempt.get('status')=='acquired':
                asset=assets.get(attempt.get('asset_id'),{})
                acquisition=asset.get('provenance',{}).get('acquisition',{})
                image_path=c.evidence(root,asset.get('source'))
                import image_workflow
                actual=image_workflow.image_info(image_path.read_bytes())
                if actual['width']!=acquisition.get('width') or actual['height']!=acquisition.get('height'):
                    raise ValueError('Acquisition dimensions differ from actual retained image bytes')
                if acquisition.get('status')!='acquired' or acquisition.get('sha256')!=asset['source']['sha256']:
                    raise ValueError('Acquired first-party image must link to the actual acquisition event and bytes')
                if not acquisition.get('retrieved_at') or not acquisition.get('content_type') or not acquisition.get('width') or not acquisition.get('height'):
                    raise ValueError('Acquisition needs time, MIME and measured dimensions')
            elif not c.text(attempt.get('source_url')) or not c.text(attempt.get('error',attempt.get('reason'))):
                raise ValueError('Failed/rejected first-party acquisition needs a source and concrete outcome')
    except (OSError,ValueError,TypeError,AttributeError,KeyError) as error:errors.append('Image acquisition: '+str(error))
    try:
        import question_log
        errors+=question_log.validate(root)
    except (OSError,ValueError,TypeError,KeyError) as error:errors.append('Question history: '+str(error))
    return errors


def conversion_errors(root, check_page=False):
    """One source conversion contract, compared to chosen configuration and DOM."""
    import completion_contract as c
    from html.parser import HTMLParser
    root=Path(root).resolve();errors=[]
    try:
        record=c.read(root/'build/conversion-contract.json');config=c.read(root/'funnel.json')
        for key in ('source_conversion_type','source_offer','source_success_behavior','secondary_action','local_implementation','production_wiring'):
            if not c.text(record.get(key)):raise ValueError('Conversion contract needs '+key)
        for item in record.get('evidence',[]):c.evidence(root,item)
        if not record.get('evidence'):raise ValueError('Conversion contract needs captured source evidence')
        selected=config.get('conversion',{}).get('type') or ('enquire' if config.get('backend',{}).get('provider')!='none' else None)
        if record.get('selected_conversion_type')!=selected:raise ValueError('Selected conversion differs from the source conversion contract')
        destination=config.get('conversion',{}).get('destination')
        if selected!='enquire' and (not c.text(destination) or record.get('selected_destination')!=destination):
            raise ValueError('Non-form conversion must preserve the selected actual destination URI')
        fields=record.get('selected_fields')
        if not isinstance(fields,list) or fields!=config.get('form_fields',[]):raise ValueError('Selected form fields differ from the source conversion contract')
        if record.get('selected_offer')!=config.get('offer'):raise ValueError('Selected offer differs from the conversion contract')
        source_fields=record.get('source_fields')
        if not isinstance(source_fields,list):raise ValueError('Record source form fields, including an explicit empty array when absent')
        changes=record.get('allowed_changes',[])
        if record['source_conversion_type']!=selected or source_fields!=fields or record['source_offer']!=record['selected_offer']:
            if not changes:raise ValueError('Changing the source offer, action or fields requires evidence-backed authorization')
            for change in changes:
                if not c.text(change.get('reason')):raise ValueError('Conversion change needs a reason')
                c.evidence(root,change.get('evidence'))
        if check_page:
            class Page(HTMLParser):
                def __init__(self):super().__init__();self.fields={};self.forms=0;self.links=[]
                def handle_starttag(self,tag,attrs):
                    a=dict(attrs)
                    if tag=='form':self.forms+=1
                    if tag=='a':self.links.append(a.get('href'))
                    if tag in {'input','select','textarea'} and a.get('name'):
                        self.fields[a['name']]={'required':'required' in a,'type':a.get('type',tag)}
            path=root/'public/index.html' if (root/'public/index.html').is_file() else root/'index.html'
            page=Page();page.feed(path.read_text())
            if selected!='enquire' and destination not in page.links:raise ValueError('Selected conversion destination is absent from the page')
            if selected=='enquire' and not page.forms:raise ValueError('The source enquiry journey cannot be replaced with only a phone action')
            for field in fields:
                actual=page.fields.get(field.get('name'))
                if actual is None or field.get('required') and not actual['required']:
                    raise ValueError('A required source field is absent or optional in the rendered form: '+str(field.get('name')))
    except (OSError,ValueError,TypeError,AttributeError,KeyError) as error:errors.append('Conversion contract: '+str(error))
    return errors
