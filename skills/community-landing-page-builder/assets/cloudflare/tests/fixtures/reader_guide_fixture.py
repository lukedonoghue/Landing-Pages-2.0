"""Synthetic reader-guide fixture. Nothing here is real business evidence or approval."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw


def fixture(root, scripts):
    root = Path(root); root.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(scripts))
    import guide_quality as q
    from build_guide import write_json
    for directory in ('build', 'research', 'public/assets/images', 'public/assets/brochure'):
        (root/directory).mkdir(parents=True, exist_ok=True)
    source = ('Synthetic owner-supplied cleaning business test facts. The written scope identifies rooms, tasks and visit frequency. '
              'The walkthrough records access restrictions and surfaces that need a different cleaning method. '
              'The team agrees entry arrangements before the first visit. Feedback is recorded against the agreed task list. '
              'No response-time guarantee, health claim or testimonial is supplied.')
    (root/'research/business.txt').write_text(source)
    (root/'research/image-evidence.txt').write_text('Synthetic test graphics made by the test fixture, not a model or a customer/project photograph. No production reuse claim.')
    images = []
    for i, placement in enumerate(('cover', 'scope')):
        image = Image.new('RGB', (1100, 680), '#e5ebe5')
        draw = ImageDraw.Draw(image)
        # Test-only geometric assets exercise real raster embedding and aspect.
        for n in range(12):
            x = 35+n*87
            draw.rectangle((x, 50+i*35, x+50, 450+n*12), fill=(35+i*40, 85+n*9, 95+n*8))
        draw.text((40, 620), 'SYNTHETIC TEST ILLUSTRATION - NOT CLIENT PROOF', fill='#102e24')
        path = f'public/assets/images/fixture-{i}.png'; image.save(root/path)
        images.append({'id': f'image-{i}', 'placement': placement, 'path': path, 'sha256': q.sha(root/path),
            'source_type': 'supplied', 'role': 'illustration', 'caption': 'Test illustration: a visual aid, not a photograph of a client site.',
            'purpose': 'Show that a relevant high-resolution visual is actually embedded and captioned in the rendered guide.',
            'rights_basis': 'Created within this synthetic test; never claimed as real client imagery.',
            'evidence_path': 'research/image-evidence.txt', 'evidence_sha256': q.sha(root/'research/image-evidence.txt')})
    data = {'schema_version': 1, 'document_type': 'buyer_guide', 'workflow_ready': True,
        'title': 'Choose a cleaning scope that covers the work you need',
        'subtitle': 'A practical checklist for comparing office cleaning proposals before agreeing a service.',
        'audience': 'For office managers comparing cleaning proposals',
        'reader_promise': 'Separate the daily essentials from occasional tasks, agree access, and compare quotes against the same scope.',
        'author_task_ids': ['synthetic-author'],
        'brand': {'name': 'Synthetic Office Care', 'logo': '', 'phone_display': '020 7946 0000', 'phone_uri': 'tel:02079460000',
                  'colors': {'primary': '#174e40', 'accent': '#9bbb67'}},
        'delivery': {'output': 'public/assets/brochure/service-guide.pdf', 'thank_you': 'public/thank-you.html', 'download_label': 'Download your cleaning guide'},
        'sources': [{'id': 'business', 'kind': 'user', 'title': 'Synthetic owner test brief', 'path': 'research/business.txt',
                     'sha256': q.sha(root/'research/business.txt'), 'retrieved_at': '2026-09-22'}],
        'images': images,
        'chapters': [
          {'id': 'scope', 'headline': 'Compare the same work, not just the monthly price',
           'reader_question': 'What does each quote actually include?',
           'why_it_matters': 'A lower price is hard to judge when one proposal includes tasks that another leaves out.',
           'paragraphs': [
             'The written scope identifies rooms, tasks and visit frequency. Start with the places people use each day, then list occasional tasks separately. That lets you see which work is included in the recurring visit and which work needs its own discussion. Use the same list when asking different providers for a proposal.',
             'Make unclear descriptions concrete before agreeing a service. For example, a reference to kitchen cleaning should identify the surfaces and appliances in scope rather than leave both parties to guess. Ask how missed tasks will be reported and how changes to the office will affect the agreed list.'],
           'takeaways': ['List the rooms and tasks you expect on every visit.', 'Ask which occasional tasks require a separate agreement.'],
           'evidence': [{'source_id': 'business', 'excerpt': 'The written scope identifies rooms, tasks and visit frequency.',
                         'claim': 'The written scope identifies rooms, tasks and visit frequency.'}]},
          {'id': 'access', 'headline': 'Agree access before the first visit, not during it',
           'reader_question': 'How will the team work around your office?',
           'why_it_matters': 'A clear entry plan gives both teams a practical starting point and avoids relying on unstated assumptions.',
           'paragraphs': [
             'The team agrees entry arrangements before the first visit. Write down who provides access, which areas are restricted and when the work can take place. Tell the provider about surfaces that need special care so the walkthrough can identify a suitable method before a task is added to the service.',
             'Keep the agreed scope somewhere that the office contact and the cleaning team can both refer to. Feedback is more useful when it names the room and task rather than simply describing the visit as disappointing. Agree who receives that feedback and discuss any requested changes before treating them as part of the regular service.'],
           'takeaways': ['Confirm the entry contact and permitted working times.', 'Record restricted areas and surfaces needing special care.'],
           'evidence': [{'source_id': 'business', 'excerpt': 'The team agrees entry arrangements before the first visit.',
                         'claim': 'The team agrees entry arrangements before the first visit.'}]}],
        'checklist_title': 'Take these questions into the walkthrough',
        'checklist': ['Which tasks are included at each visit?', 'Which tasks and areas are excluded from the quote?',
                      'Who handles access and changes to the agreed task list?', 'How do we report a missed task and review the response?'],
        'next_step': 'Keep this checklist ready for the conversation with the team. Review the written scope before deciding whether the proposal fits your office.',
        'scope_note': 'Synthetic test content only. This is not a real service proposal or evidence of an actual customer outcome.'}
    followup = 'Our team will contact you to discuss the office details and agree the next step.'
    write_json(root/'funnel.json', {'quality': {'reader_guide_version': 1}, 'client': data['brand'], 'follow_up_promise': followup,
                                 'catalogue': {'enabled': True}})
    write_json(root/'build/guide.json', data)
    write_json(root/'build/thank-you.json', {'main_page': 'public/index.html', 'output': 'public/thank-you.html',
        'confirmed_headline': 'Thanks, your cleaning enquiry is with our team', 'follow_up': followup,
        'download_label': 'Download your cleaning guide', 'guide_summary': 'Compare the work included in each quote and prepare the questions that matter for your office.'})
    (root/'public/index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic office page</title><link rel="stylesheet" href="styles.css"></head><body><header><a href="/">Synthetic Office Care</a><a data-open-modal href="#lead-form">Request a quote</a></header><main><section class="hero" data-page-hero><h1>Office care that fits your working day</h1><p>Understand what your proposal covers.</p><button data-open-modal>Request a quote</button></section><section id="benefits"><h2>Keep the agreed work easy to check</h2><p>Start with a clear room-by-room task list. Keep the scope visible when you compare the proposals.</p></section><section id="proof"><h2>Your existing proof stays in place</h2><p>This synthetic fixture has no real testimonials. Approved proof from a real page would be preserved here, not invented.</p></section><section id="process"><h2>What happens next</h2><p>Discuss the office details, review the written scope and choose the service that fits.</p><button data-open-modal>Request a quote</button></section><section id="questions"><h2>Questions before your call?</h2><details><summary>Can the agreed task list change?</summary><p>Discuss a new requirement with the team before treating it as part of the service.</p></details></section><div role="dialog"><form id="lead-form"><input name="email"><button type="submit">Send enquiry</button></form></div></main><footer><a href="/privacy.html">Privacy</a></footer></body></html>''')
    (root/'public/styles.css').write_text('''*{box-sizing:border-box}body{margin:0;color:#143a30;font:17px/1.6 Arial,sans-serif;background:#fafbf8}header,footer{padding:22px max(20px,calc((100vw - 1100px)/2));display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff}main>section{max-width:1100px;margin:auto;padding:48px 24px}h1{font-size:clamp(30px,4vw,52px);line-height:1.1}h2{line-height:1.2}p{max-width:68ch}a{color:inherit}.button{display:inline-block;padding:12px 18px;background:#174e40;color:white;text-decoration:none;border-radius:8px}.hero{background:#edf3e6}img{max-width:100%;height:auto}details{padding:16px;border:1px solid #bccabd}''')
    return data


def synthetic_review(root):
    """Test-only review fixture, never called by production build helpers."""
    import guide_quality as q
    from build_guide import write_json
    report = q.inspect_build(root)
    value = {'schema_version': 1, 'build_sha256': q.sha(root/'build/guide-build.json'),
        'reviewer': {'mode': 'self_review', 'task_id': 'synthetic-author'},
        'pages': [{'page': i+1, 'render_sha256': report['artifacts'][name],
                   'observation': 'Synthetic acceptance fixture exercising source binding; not a claim of human pixel review.'} for i, name in enumerate(report['rendered_pages'])],
        'checks': [{'criterion': c, 'verdict': 'pass', 'excerpt': 'The written scope identifies rooms, tasks and visit frequency.',
                    'observation': 'Synthetic review fixture: assertions validate contract enforcement, not semantic review quality.'} for c in q.CRITERIA],
        'unresolved_findings': [], 'improvements': []}
    write_json(root/'build/guide-review.json', value)
    return value


if __name__ == '__main__':
    import subprocess
    root = Path(sys.argv[1]).resolve(); scripts = Path(sys.argv[2]).resolve()
    fixture(root, scripts)
    subprocess.run([sys.executable, str(scripts/'build_guide.py'), str(root)], check=True, stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable, str(scripts/'thank_you_page.py'), str(root)], check=True, stdout=subprocess.DEVNULL)
    print(json.dumps({'project': str(root), 'scope': 'Synthetic fixture only; no provider calls, client data, approvals or deployments.'}))
