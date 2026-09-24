"""Real local PDF/HTML builds plus adversarial source and receipt-contract tests."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET
from PIL import Image

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL/'scripts'
sys.path.insert(0, str(SCRIPTS))
import build_guide
import guide_quality as q
import thank_you_page as thankyou
import workflow_progress as progress
import workflow_runner as runner
spec = importlib.util.spec_from_file_location('reader_fixture', SKILL/'assets/cloudflare/tests/fixtures/reader_guide_fixture.py')
fixture = importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)


class ReaderGuideTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.data = fixture.fixture(self.root, SCRIPTS)

    def save(self):
        build_guide.write_json(self.root/'build/guide.json', self.data)

    def build(self, delivery=True):
        self.save()
        with contextlib.redirect_stdout(io.StringIO()):
            build_guide.build_reader(self.root, self.root/'build/guide.json', self.data)
            if delivery:
                with patch.object(sys, 'argv', ['thank_you_page.py', str(self.root)]):thankyou.main()
        return q.inspect_build(self.root)

    def test_actual_pdf_has_authored_text_rasters_cover_and_no_overflow(self):
        report = self.build()
        text = q.norm((self.root/report['text_output']).read_text())
        for chapter in self.data['chapters']:
            self.assertIn(chapter['headline'], text)
            for paragraph in chapter['paragraphs']:self.assertIn(q.norm(paragraph), text)
        self.assertGreaterEqual(report['page_count'], 3)
        with Image.open(self.root/report['rendered_pages'][0]) as image:
            image.thumbnail((600,850))
            with Image.open(self.root/report['preview']) as cover:
                self.assertEqual(cover.tobytes(), image.convert('RGB').tobytes())
        pdfimages = subprocess.check_output(['pdfimages', '-list', str(self.root/report['output'])], text=True)
        self.assertGreaterEqual(sum(' image ' in line for line in pdfimages.splitlines()), 2)
        bbox = subprocess.check_output(['pdftotext','-bbox',str(self.root/report['output']),'-'], text=True)
        for page in ET.fromstring(bbox).findall('.//{*}page'):
            for word in page.findall('.//{*}word'):
                self.assertGreaterEqual(float(word.attrib['xMin']), 0)
                self.assertGreaterEqual(float(word.attrib['yMin']), 0)
                self.assertLessEqual(float(word.attrib['xMax']), float(page.attrib['width']))
                self.assertLessEqual(float(word.attrib['yMax']), float(page.attrib['height']))
        self.assertEqual(progress.guide_state(self.root,q.read(self.root,'funnel.json'))['stage'],'guide_review')
        fixture.synthetic_review(self.root)
        self.assertEqual(progress.guide_state(self.root,q.read(self.root,'funnel.json'))['status'],'pass')

    def test_missing_blank_or_repeated_images_cannot_pass(self):
        original = copy.deepcopy(self.data)
        for images in ([], [original['images'][0]], [original['images'][0], dict(original['images'][0], id='other', placement='scope')]):
            self.data['images'] = images
            with self.assertRaises(ValueError):q.validate_content(self.root,self.data)
        self.data = original
        path = self.root/self.data['images'][0]['path'];Image.new('RGB',(1100,680),'white').save(path)
        self.data['images'][0]['sha256']=q.sha(path)
        with self.assertRaisesRegex(ValueError,'blank colour'):q.validate_content(self.root,self.data)

    def test_generated_proof_and_missing_acquisition_are_rejected(self):
        self.data['images'][0].update(source_type='generated',role='proof')
        with self.assertRaisesRegex(ValueError,'illustration'):q.validate_content(self.root,self.data)
        self.data['images'][0]['role']='illustration'
        with self.assertRaisesRegex(ValueError, 'structured retained tool result'):
            q.validate_content(self.root,self.data)
        # The test-created graphics are supplied illustrations, not native output.
        self.data['images'][0]['source_type']='supplied'
        q.validate_content(self.root,self.data)
        (self.root/'research/image-evidence.txt').write_text('changed')
        with self.assertRaisesRegex(ValueError,'acquisition'):q.validate_content(self.root,self.data)

    def test_thin_generic_or_unanchored_copy_is_rejected(self):
        for key,value in [('title','A practical guide to a better fit.'), ('chapters',[])]:
            bad=copy.deepcopy(self.data);bad[key]=value
            with self.assertRaises(ValueError):q.validate_content(self.root,bad)
        self.data['chapters'][0]['evidence'][0]['excerpt']='This was not present in the supplied source at all.'
        with self.assertRaisesRegex(ValueError,'real source excerpt'):q.validate_content(self.root,self.data)

    def test_legitimate_example_wording_is_not_blacklisted(self):
        self.assertIn('For example', self.data['chapters'][0]['paragraphs'][1])
        q.validate_content(self.root,self.data)

    def test_source_and_render_edits_invalidate_acceptance(self):
        report=self.build();fixture.synthetic_review(self.root);q.inspect_review(self.root)
        image=self.root/report['rendered_pages'][-1];image.write_bytes(image.read_bytes()+b'changed')
        with self.assertRaisesRegex(ValueError,'missing or stale'):q.inspect_build(self.root)
        self.build();fixture.synthetic_review(self.root)
        (self.root/'research/business.txt').write_text('new facts')
        with self.assertRaisesRegex(ValueError,'missing or changed'):q.inspect_build(self.root)

    def test_review_requires_all_pages_actual_wording_and_honest_identity(self):
        self.build();review=fixture.synthetic_review(self.root)
        for mutate in (lambda r:r['pages'].pop(), lambda r:r['checks'].pop(),
                       lambda r:r['reviewer'].update(mode='independent'),
                       lambda r:r['checks'][0].update(excerpt='Words that are not present in the document')):
            bad=copy.deepcopy(review);mutate(bad);build_guide.write_json(self.root/'build/guide-review.json',bad)
            with self.assertRaises(ValueError):q.inspect_review(self.root)

    def test_failed_review_dispatches_repair_and_preserves_checklist(self):
        self.build();review=fixture.synthetic_review(self.root)
        before=self.data['chapters'][0]['headline']
        review['checks'][0]['verdict']='improve'
        review['unresolved_findings']=[{'id':'specificity','problem':'The comparison headline needs the office context.',
            'before':before,'acceptance_test':'Mention office cleaning in the replacement headline.'}]
        build_guide.write_json(self.root/'build/guide-review.json',review)
        self.assertEqual(progress.guide_state(self.root,q.read(self.root,'funnel.json'))['stage'],'guide_repair')
        self.data['chapters'][0]['headline']='Compare office cleaning scope before the monthly price'
        self.build()
        history=list((self.root/'build/guide-review-history').glob('*.json'));self.assertEqual(len(history),1)
        fresh=fixture.synthetic_review(self.root)
        with self.assertRaisesRegex(ValueError,'Every preserved guide finding'):q.inspect_review(self.root)
        fresh['improvements']=[{'id':'specificity','review_sha256':history[0].stem,'problem':'The buyer context was too implicit.',
            'before':before,'after':self.data['chapters'][0]['headline'],'verification':'Checked the actual extracted heading and rerendered every guide page.'}]
        build_guide.write_json(self.root/'build/guide-review.json',fresh);q.inspect_review(self.root)

    def test_full_thankyou_preserves_sections_and_removes_repeat_forms(self):
        self.build();report=thankyou.inspect(self.root);html=(self.root/'public/thank-you.html').read_text()
        original=thankyou.Document((self.root/'public/index.html').read_text());derived=thankyou.Document(html)
        for ident in ('benefits','proof','process','questions'):
            self.assertTrue(any(n.attrs.get('id')==ident for n in derived.nodes))
        for ident in ('benefits','proof','questions'):
            n=next(n for n in original.nodes if n.attrs.get('id')==ident);self.assertIn(original.content(n),html)
        self.assertNotIn('<form',html);self.assertNotIn('data-open-modal',html)
        self.assertIn('data-guide-cover',html);self.assertIn('data-confirmed-only hidden',html)
        self.assertIn('confirmation-phone',html);self.assertEqual(report['reused_sections'],4)
        for n in derived.nodes:
            if 'data-guide-download' in n.attrs or 'data-guide-embed' in n.attrs:
                target=thankyou.same_local(self.root,self.root/'public/thank-you.html',n.attrs.get('href') or n.attrs['src'])
                self.assertEqual(target,self.root/'public/assets/brochure/service-guide.pdf')

    def test_main_page_edit_invalidates_and_requires_rederivation(self):
        self.build();path=self.root/'public/index.html';path.write_text(path.read_text().replace('task list','agreed task checklist'))
        with self.assertRaisesRegex(ValueError,'changed'):thankyou.inspect(self.root)
        with contextlib.redirect_stdout(io.StringIO()),patch.object(sys,'argv',['thank_you_page.py',str(self.root)]):thankyou.main()
        self.assertIn('agreed task checklist',(self.root/'public/thank-you.html').read_text());thankyou.inspect(self.root)

    def test_custom_thankyou_is_not_silently_overwritten(self):
        self.build(delivery=False);out=self.root/'public/thank-you.html';out.write_text('<p>Owner content to preserve</p>')
        with self.assertRaisesRegex(ValueError,'customized'),patch.object(sys,'argv',['thank_you_page.py',str(self.root)]):thankyou.main()
        data=q.read(self.root,'build/thank-you.json');data['replace_existing_sha256']=q.sha(out);build_guide.write_json(self.root/'build/thank-you.json',data)
        with contextlib.redirect_stdout(io.StringIO()),patch.object(sys,'argv',['thank_you_page.py',str(self.root)]):thankyou.main()
        thankyou.inspect(self.root)

    def test_no_fake_followup_or_success_box(self):
        self.build(delivery=False);data=q.read(self.root,'build/thank-you.json');data['follow_up']='Request your free quote and get an immediate callback.'
        with self.assertRaisesRegex(ValueError,'post-submission'):thankyou.derive(self.root,data)
        data=q.read(self.root,'build/thank-you.json');data['follow_up']='An unrelated promise not approved by the business.'
        with self.assertRaisesRegex(ValueError,'operational promise'):thankyou.derive(self.root,data)
        path=self.root/'public/index.html';path.write_text('<html><head><title>Page</title></head><body><header>Brand</header><main><section><h1>Only a box</h1></section></main></body></html>')
        with self.assertRaisesRegex(ValueError,'success box alone'):thankyou.derive(self.root,q.read(self.root,'build/thank-you.json'))

    def test_external_same_basename_and_symlink_targets_are_rejected(self):
        page=self.root/'public/thank-you.html'
        for url in ('https://untrusted.invalid/assets/brochure/service-guide.pdf','//untrusted.invalid/assets/brochure/service-guide.pdf','/%2e%2e/research/business.txt'):
            with self.assertRaises(ValueError):thankyou.same_local(self.root,page,url)
        target=self.root/'public/assets/brochure/service-guide.pdf';target.symlink_to(self.root/'research/business.txt')
        with self.assertRaisesRegex(ValueError,'symlinks'):self.build()
        self.assertIn('Synthetic owner', (self.root/'research/business.txt').read_text())

    def test_runtime_assets_cannot_disappear_from_evidence(self):
        self.build();report=q.read(self.root,'build/thank-you-build.json');report['assets']={};build_guide.write_json(self.root/'build/thank-you-build.json',report)
        with self.assertRaisesRegex(ValueError,'both maintained'):thankyou.inspect(self.root)

    def test_changed_business_contract_invalidates_guide(self):
        self.build();fixture.synthetic_review(self.root)
        config=q.read(self.root,'funnel.json');config['offer']='A different service and offer'
        build_guide.write_json(self.root/'funnel.json',config)
        with self.assertRaisesRegex(ValueError,'Business/offer/follow-up changed'):q.inspect_build(self.root)

    def test_omission_requires_real_source_bound_evidence(self):
        catalogue={'enabled':False,'omission_reason':'This buyer explicitly needs a different deliverable, supported by their captured instructions.'}
        with self.assertRaisesRegex(ValueError,'captured source evidence'):q.validate_omission(self.root,catalogue)
        catalogue['omission_evidence']=[{'path':'research/business.txt','sha256':q.sha(self.root/'research/business.txt'),
                                       'excerpt':'The written scope identifies rooms, tasks and visit frequency.'}]
        q.validate_omission(self.root,catalogue)
        catalogue['omission_evidence'][0]['excerpt']='Invented source text does not qualify as real evidence.'
        with self.assertRaisesRegex(ValueError,'unanchored'):q.validate_omission(self.root,catalogue)

    def test_runner_permits_guide_work_but_not_business_or_approvals(self):
        for path in ('build/guide.json','build/guide-build.json','build/guide-review.json','build/guide-review-history/prior.json','build/guide-pages/page-1.png','build/guide-text.txt','build/thank-you.json','build/thank-you-build.json'):
            self.assertTrue(runner.allowed(path),path)
        for path in ('funnel.json','build/guide-business.json','build/workflow.json','scripts/guide.py'):
            self.assertFalse(runner.allowed(path),path)

if __name__=='__main__':unittest.main()
