#!/usr/bin/env python3
"""Meaningful regression checks for retrieval, isolation, and stale review rejection."""
import copy,importlib.util,json,sqlite3,tempfile,unittest,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SKILL=ROOT.parent/'skills/branded-lead-funnel-builder'
LIB=SKILL/'references/copy-library'
spec=importlib.util.spec_from_file_location('copy_library',SKILL/'scripts/copy_library.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class LibraryTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);(self.root/'build').mkdir()
  self.brief=dict(client_name='Example Workshop',service='custom storage',audience='B2C',sector='home improvement',offer_type='brochure_quote',intent='planned_project',primary_cta='Get the Storage Guide & Estimate',follow_up_promise='The team will contact you to discuss the project.',required_sections=['hero','faq'],claims=[dict(id='C1',text='The business designs fitted storage.',source='client supplied brief',evidence='We design fitted storage.',approved=True)],forbidden_claims=['guaranteed for life'])
  self.b=self.root/'build/brief.json';self.c=self.root/'build/copy.json';self.ctx=self.root/'build/context.json';self.r=self.root/'build/review.json'
  self.save(self.b,self.brief)
  m.prepare(LIB,self.b,self.ctx,3)
  self.copy=dict(h1='Make Room for What You Use Every Day',primary_cta=self.brief['primary_cta'],sections=[dict(id='hero',headline='Storage Designed for Your Home',body='Discuss a fitted storage layout for your space.',claim_ids=['C1'],cta=self.brief['primary_cta']),dict(id='faq',headline='Plan Your Storage Project',questions=[dict(question='What happens next?',answer='The team will discuss the project with you.')],claim_ids=[])],modal=dict(submit_label=self.brief['primary_cta'],follow_up_promise=self.brief['follow_up_promise']),thank_you=dict(follow_up_promise=self.brief['follow_up_promise'],download_label='Download the Storage Guide'))
  self.save(self.c,self.copy)
 def tearDown(self):self.tmp.cleanup()
 def save(self,p,d):p.write_text(json.dumps(d,indent=2)+'\n')
 def review(self):
  # Synthetic protocol fixture: tests format/freshness, never presented as editorial assessment.
  d=dict(copy_sha256=m.sha(self.c),brief_sha256=m.sha(self.b),context_sha256=m.sha(self.ctx),decision='pass',unresolved_findings=[],checks=[dict(criterion=k,verdict='pass',evidence=dict(copy_excerpt=self.copy['h1'],explanation='Synthetic regression fixture for review protocol only.')) for k in m.CRITERIA]);self.save(self.r,d);return d
 def audit(self,review=False):return m.audit(self.c,self.b,self.ctx,self.r if review else None)
 def test_curated_only_and_family_diversity(self):
  x=m.select(LIB,self.brief,5);self.assertTrue(x);self.assertEqual(len(x),len({v['family'] for v in x}));self.assertEqual(len(x),len({v['leakage_group'] for v in x}))
  conn=m.db_at(LIB)
  for v in x:self.assertEqual(conn.execute('SELECT partition,status FROM sources WHERE id=?',(v['source_id'],)).fetchone(),('train','curated'))
  conn.close()
 def test_explicit_reference_prioritized(self):
  self.brief['primary_reference_url']='https://bluemountain1.pagedemo.co/'
  self.assertEqual(m.select(LIB,self.brief)[0]['source_id'],'6aebe071e132')
 def test_sensitive_consultation_routes_to_consultation(self):
  q=dict(audience='B2C',sector='mental health',offer_type='consultation',intent='high_anxiety')
  self.assertEqual(m.select(LIB,q)[0]['source_id'],'9db61c7bad1f')
 def test_search_is_parameterized(self):
  self.assertIsInstance(m.search(LIB,'" OR 1=1; DROP TABLE sources; --',5),list)
  conn=m.db_at(LIB);self.assertGreater(conn.execute('SELECT count(*) FROM sources').fetchone()[0],100);conn.close()
 def test_holdouts_and_ocr_excluded_from_default(self):
  for q in ('pilot','brochure','legal consultation','Quality Hoops','healthcare','design'):
   for x in m.search(LIB,q,25):self.assertEqual(x['status'],'curated');self.assertEqual(x['partition'],'train')
 def test_all_anchors_and_hashes_match(self):
  conn=m.db_at(LIB)
  for row in conn.execute('SELECT s.record,a.record FROM sources s JOIN annotations a ON s.id=a.source_id'):
   s,a=map(json.loads,row);self.assertEqual(s['text_sha256'],a['source_text_sha256'])
   for e in a['examples']:self.assertIn(e['anchor'].lower(),s['text'].lower())
  conn.close()
 def test_automatic_pass_cannot_approve_editorially(self):
  r=self.audit();self.assertEqual(r['automated_status'],'pass');self.assertEqual(r['overall_status'],'blocked')
 def test_current_review_protocol_is_accepted(self):
  self.review();self.assertEqual(self.audit(True)['overall_status'],'pass')
 def test_copy_change_invalidates_review(self):
  self.review();self.copy['h1']='A different heading';self.save(self.c,self.copy);self.assertIn('Editorial review is stale or missing input hashes',self.audit(True)['editorial_requirements'])
 def test_brief_change_invalidates_context(self):
  self.review();self.brief['follow_up_promise']='We call within an hour.';self.save(self.b,self.brief);self.assertIn('Writer context is stale for the current client brief',self.audit(True)['failures'])
 def test_context_change_invalidates_review(self):
  self.review();v=m.read(self.ctx);v['instructions'].append('Changed');self.save(self.ctx,v);self.assertTrue(self.audit(True)['editorial_requirements'])
 def test_missing_faq_answers_block(self):
  self.copy['sections'][1]['questions']=[dict(question='How much?')];self.save(self.c,self.copy);self.assertIn('FAQ needs complete questions and answers',self.audit()['failures'])
 def test_unapproved_claim_and_imported_brand_block(self):
  self.copy['sections'][0]['claim_ids']=['UNKNOWN'];self.copy['sections'][0]['body']=m.read(self.ctx)['reference_examples'][0]['name'];self.save(self.c,self.copy);r=self.audit();self.assertTrue(any('Unknown' in x or 'unknown claim' in x for x in r['failures']));self.assertTrue(any('brand leaked' in x for x in r['failures']))
 def test_fabricated_review_evidence_blocks(self):
  d=self.review();d['checks'][0]['evidence']['copy_excerpt']='This phrase does not exist';self.save(self.r,d);self.assertTrue(self.audit(True)['editorial_requirements'])
 def test_different_control_labels_are_valid(self):
  self.copy['modal']['back_label']='Back';self.copy['modal']['next_label']='Continue';self.save(self.c,self.copy);self.assertEqual(self.audit()['automated_status'],'pass')
 def test_funnel_offer_mismatch_rejected(self):
  self.save(self.root/'funnel.json',dict(cta='Different offer',follow_up_promise=self.brief['follow_up_promise']))
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def test_funnel_change_invalidates_context(self):
  self.save(self.root/'funnel.json',dict(cta=self.brief['primary_cta'],follow_up_promise=self.brief['follow_up_promise']));m.prepare(LIB,self.b,self.ctx,3)
  self.save(self.root/'funnel.json',dict(cta='Changed',follow_up_promise=self.brief['follow_up_promise']));self.assertIn('Funnel contract changed after copy context was prepared',self.audit()['failures'])
 def test_generated_document_contains_complete_faq_and_next_steps(self):
  text=m.render_document(self.copy);self.assertIn(self.copy['sections'][1]['questions'][0]['answer'],text);self.assertIn('Download the Storage Guide',text);self.assertIn('Evidence IDs: C1',text)
 def test_requested_unreviewed_reference_is_not_silently_replaced(self):
  self.brief['primary_reference_url']='https://qualityhoops1.pagedemo.co/';self.save(self.b,self.brief)
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def test_calibration_is_relevant_and_explicitly_fictional(self):
  cases=m.read(self.ctx)['calibration_examples'];self.assertTrue(cases)
  self.assertTrue(all(c['sector'] in ('all','home improvement') and 'fictional' in c['provenance'] for c in cases))
 def test_editorial_warning_status_is_preserved(self):
  d=self.review();d['decision']='pass_with_warnings';d['warnings']=['Rendered copy has not been inspected.'];self.save(self.r,d)
  self.assertEqual(self.audit(True)['overall_status'],'pass_with_warnings')
 def test_duplicate_editorial_checks_are_rejected(self):
  d=self.review();d['checks'].append(d['checks'][0]);self.save(self.r,d);self.assertTrue(self.audit(True)['editorial_requirements'])
 def test_copy_only_does_not_require_unrequested_funnel_components(self):
  self.brief['output_mode']='copy_only';self.save(self.b,self.brief);m.prepare(LIB,self.b,self.ctx,3)
  self.copy.pop('modal');self.copy.pop('thank_you');self.save(self.c,self.copy);self.assertEqual(self.audit()['automated_status'],'pass')
 def test_explicitly_requested_brochure_is_checked(self):
  self.brief['required_components']=['page','brochure'];self.save(self.b,self.brief);m.prepare(LIB,self.b,self.ctx,3)
  self.assertIn('Missing brochure',self.audit()['failures'])
 def test_brochure_full_text_is_reviewed_before_approval(self):
  self.copy['brochure']=dict(cover_promise='Your storage guide',delivery='Download after your request')
  self.save(self.c,self.copy);self.assertIn('Complete brochure.text is required before copy approval',self.audit()['failures'])
  self.copy['brochure']['text']=['Your storage guide','The estimate follows a site review.'];self.save(self.c,self.copy)
  self.assertEqual(self.audit()['automated_status'],'pass')
  self.assertIn('The estimate follows a site review.',m.render_document(self.copy,include_evidence=False))
 def test_supplied_pdf_must_exist_and_remain_unchanged(self):
  pdf=self.root/'supplied.pdf';pdf.write_bytes(b'%PDF-synthetic')
  self.copy['brochure']=dict(cover_promise='Your supplied guide',delivery='Download after request',approved_asset=dict(origin='supplied',path='supplied.pdf',sha256=m.sha(pdf)))
  self.save(self.c,self.copy);self.assertEqual(self.audit()['automated_status'],'pass')
  shown=m.render_document(self.copy,include_evidence=False);self.assertIn('supplied.pdf',shown);self.assertNotIn(m.sha(pdf),shown)
  pdf.write_bytes(b'%PDF-changed');self.assertEqual(self.audit()['automated_status'],'blocked')
 def test_no_matching_job_does_not_return_audience_only_examples(self):
  self.assertEqual(m.select(LIB,dict(audience='B2C',sector='unrelated xyz',offer_type='unknown xyz',intent='unknown xyz')),[])
 def test_empty_brief_and_duplicate_claims_are_rejected(self):
  self.brief['service']='';self.save(self.b,self.brief)
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
  self.brief['service']='custom storage';self.brief['claims'].append(self.brief['claims'][0]);self.save(self.b,self.brief)
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def research_fixture(self):
  research=self.root/'research';research.mkdir();source=research/'S001.txt';source.write_text('We design fitted storage.\n')
  self.save(research/'sources.json',dict(sources=[dict(id='S001',status='captured',text_path='research/S001.txt',sha256=m.sha(source))]))
  self.brief['source_manifest']='research/sources.json';self.brief['claims'][0]['source_id']='S001';self.save(self.b,self.brief)
  return source
 def test_real_source_excerpt_links_are_verified(self):
  self.research_fixture();m.prepare(LIB,self.b,self.ctx,3);self.assertEqual(len(m.read(self.ctx)['source_evidence']['artifacts']),1)
 def project_reference_fixture(self):
  self.research_fixture()
  text=self.root/'research/R001.txt';text.write_text('Reference Brand\nChoose a layout before discussing the price.\nRead the process and decide your next step.\n')
  manifest=m.read(self.root/'research/sources.json')
  manifest['sources'].append(dict(id='R001',role='reference',url='https://new-reference.example/offer',status='captured',text_path='research/R001.txt',sha256=m.sha(text)))
  self.save(self.root/'research/sources.json',manifest)
  self.brief['primary_reference_url']='https://new-reference.example/offer';self.save(self.b,self.brief)
  review=dict(schema_version=1,source_id='R001',source_url=self.brief['primary_reference_url'],source_sha256=m.sha(text),name='Reference Brand',reviewer='Synthetic test reviewer',reviewed_at='2026-09-16T12:00:00Z',decision='use_as_reference',client_claims_allowed=False,lessons=[dict(source_excerpt='Choose a layout before discussing the price.',persuasive_job='Introduce the first buying decision.',adaptation='Explain the client service fit before asking for contact details.',caution='Do not import the reference company scope or promises.')])
  self.save(self.root/'research/reference-review.json',review)
  return text,review
 def test_new_reference_is_project_local_and_does_not_change_library(self):
  self.project_reference_fixture();before=m.sha(LIB/'library.sqlite3')
  result=m.prepare(LIB,self.b,self.ctx,3);context=m.read(self.ctx)
  self.assertEqual(result['primary_reference']['source_id'],'R001')
  self.assertEqual(context['project_reference']['url'],self.brief['primary_reference_url'])
  self.assertEqual(context['project_reference']['role'],'user_supplied_primary')
  self.assertFalse(context['project_reference']['client_claims_allowed'])
  self.assertEqual(m.sha(LIB/'library.sqlite3'),before)
  self.review();self.assertEqual(self.audit(True)['overall_status'],'pass')
 def test_reference_review_needs_actual_matching_source_excerpts(self):
  text,review=self.project_reference_fixture();review['lessons'][0]['source_excerpt']='This quote is not on the page.'
  self.save(self.root/'research/reference-review.json',review)
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def test_reference_cannot_supply_client_claim_evidence(self):
  text,review=self.project_reference_fixture();self.brief['claims'][0].update(source_id='R001',evidence='Choose a layout before discussing the price.')
  self.save(self.b,self.brief)
  with self.assertRaisesRegex(ValueError,'reference'):m.prepare(LIB,self.b,self.ctx,3)
 def test_changed_reference_review_invalidates_prepared_context(self):
  text,review=self.project_reference_fixture();m.prepare(LIB,self.b,self.ctx,3);self.review()
  review['lessons'][0]['adaptation']='A different adaptation.';self.save(self.root/'research/reference-review.json',review)
  self.assertTrue(any('reference review changed' in x.lower() for x in self.audit(True)['failures']))
 def test_reference_name_does_not_leak_into_client_copy(self):
  self.project_reference_fixture();m.prepare(LIB,self.b,self.ctx,3)
  self.copy['sections'][0]['body']='Get your service from Reference Brand.';self.save(self.c,self.copy)
  self.assertTrue(any('Reference brand leaked' in x for x in self.audit()['failures']))
 def test_client_research_can_proceed_without_an_irrelevant_library_example(self):
  self.research_fixture();self.brief.update(sector='unrelated xyz',offer_type='unknown xyz',intent='unknown xyz');self.save(self.b,self.brief)
  m.prepare(LIB,self.b,self.ctx,3);context=m.read(self.ctx)
  self.assertEqual(context['reference_examples'],[])
  self.assertTrue(context['selection_warnings'])
  self.review();self.assertEqual(self.audit(True)['overall_status'],'pass_with_warnings')
 def test_reference_requires_review_even_when_no_library_example_matches(self):
  self.project_reference_fixture();(self.root/'research/reference-review.json').unlink()
  self.brief.update(sector='unrelated xyz',offer_type='unknown xyz',intent='unknown xyz');self.save(self.b,self.brief)
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def test_prepared_project_moves_without_losing_evidence_or_review(self):
  self.research_fixture();self.save(self.root/'funnel.json',dict(cta=self.brief['primary_cta'],follow_up_promise=self.brief['follow_up_promise']))
  m.prepare(LIB,self.b,self.ctx,3);self.review();self.assertEqual(self.audit(True)['overall_status'],'pass')
  with tempfile.TemporaryDirectory() as tmp:
   moved=Path(tmp)/'moved';shutil.copytree(self.root,moved);shutil.rmtree(self.root)
   args=[moved/'build'/p.name for p in [self.c,self.b,self.ctx,self.r]]
   result=m.audit(*args);self.assertEqual(result['overall_status'],'pass',result)
   (moved/'research/S001.txt').write_text('Changed after the handoff.')
   self.assertIn('Research source changed: S001',m.audit(*args)['failures'])
 def test_context_cannot_read_evidence_from_another_project(self):
  self.research_fixture();m.prepare(LIB,self.b,self.ctx,3)
  context=m.read(self.ctx);context['path_basis']='project';context['source_evidence']['manifest_path']='../another-project/sources.json';self.save(self.ctx,context);self.review()
  self.assertTrue(any('inside the current project' in failure for failure in self.audit(True)['failures']))
 def test_legacy_absolute_context_still_works_only_at_its_original_project(self):
  self.research_fixture();m.prepare(LIB,self.b,self.ctx,3)
  context=m.read(self.ctx);context.pop('path_basis',None)
  context['source_evidence']['manifest_path']=str(self.root/'research/sources.json')
  context['source_evidence']['artifacts'][0]['path']=str(self.root/'research/S001.txt')
  self.save(self.ctx,context);self.review();self.assertEqual(self.audit(True)['overall_status'],'pass')
  with tempfile.TemporaryDirectory() as tmp:
   moved=Path(tmp)/'moved';shutil.copytree(self.root,moved)
   result=m.audit(*[moved/'build'/p.name for p in [self.c,self.b,self.ctx,self.r]])
   self.assertTrue(any('inside the current project' in failure for failure in result['failures']),result)
 def test_wrong_quote_cannot_use_a_valid_source_id(self):
  self.research_fixture();self.brief['claims'][0]['evidence']='We guarantee perfect results.';self.save(self.b,self.brief)
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def test_source_change_invalidates_review(self):
  source=self.research_fixture();m.prepare(LIB,self.b,self.ctx,3);self.review();source.write_text('Changed service scope.')
  self.assertIn('Research source changed: S001',self.audit(True)['failures'])
 def test_source_path_cannot_escape_project(self):
  self.research_fixture();self.save(self.root/'research/sources.json',dict(sources=[dict(id='S001',status='captured',text_path='../outside.txt',sha256='x')]))
  with self.assertRaises(ValueError):m.prepare(LIB,self.b,self.ctx,3)
 def test_client_document_omits_evidence_ids(self):
  text=m.render_document(self.copy,include_evidence=False);self.assertNotIn('Evidence IDs',text);self.assertNotIn('## Section:',text);self.assertIn('### What happens next?',text)
 def test_pattern_excerpts_are_limited_to_selected_references(self):
  context=m.read(self.ctx);allowed={r['source_id'] for r in context['reference_examples']}
  self.assertTrue(all(e['source_id'] in allowed for p in context['pattern_cards'] for e in p['evidence']))

if __name__=='__main__':unittest.main(verbosity=2)
