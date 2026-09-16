#!/usr/bin/env python3
import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('copy_project',ROOT.parent/'skills/branded-lead-funnel-builder/scripts/copy_project.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ResearchTests(unittest.TestCase):
 def test_link_selection_diversifies_and_avoids_side_effect_routes(self):
  home='https://client.example/'
  links=[home+'services/'+str(i) for i in range(15)]+[home+x for x in ('about','faq','process','reviews','contact','checkout','logout')]+['https://other.example/service',home+'service?delete=1']
  chosen=m.choose_links(home,links,7)
  self.assertIn(home+'faq',chosen);self.assertIn(home+'reviews',chosen);self.assertIn(home+'process',chosen)
  self.assertTrue(all('?' not in u and 'other.example' not in u and 'logout' not in u and 'checkout' not in u for u in chosen))
 def test_credentials_and_non_http_urls_rejected(self):
  for u in ('file:///etc/passwd','javascript:alert(1)','https://user:secret@example.com'):
   with self.assertRaises(ValueError):m.normalized(u)
 def test_named_service_paths_are_not_missed(self):
  home='https://client.example/';links=[home+x for x in ('ourprocess','testimonials','faq','landclearing','grading','forestrymulching')]
  chosen=m.choose_links(home,links,7);self.assertIn(home+'landclearing',chosen);self.assertIn(home+'grading',chosen)
 def test_existing_research_is_preserved(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t)/'research/sources.json';p.parent.mkdir();p.write_text('original')
   with self.assertRaises(ValueError):m.collect(t,'https://example.com')
   self.assertEqual(p.read_text(),'original')
 def test_failed_homepage_cannot_be_marked_ready(self):
  with tempfile.TemporaryDirectory() as t, patch.object(m,'capture',return_value=({'id':'S001','status':'unavailable'},[])):
   with self.assertRaises(ValueError):m.collect(t,'https://example.com')
   self.assertEqual(json.loads((Path(t)/'research/sources.json').read_text())['status'],'blocked')

 def test_reference_pages_are_collected_separately_without_expanding_client_crawl(self):
  calls=[]
  def capture(root,url,index,role='client'):
   calls.append((url,role));sid=('R' if role=='reference' else 'S')+f'{index:03d}'
   text=Path(root)/'research'/f'{sid}.txt';text.parent.mkdir(parents=True,exist_ok=True);text.write_text('Fictional source for bounded collection tests.')
   return dict(id=sid,url=url,title='Synthetic source',status='captured',text_path=str(text.relative_to(root)),sha256=m.digest(text)), ['https://reference.example/do-not-follow']
  with tempfile.TemporaryDirectory() as t, patch.object(m,'capture',side_effect=capture):
   m.collect(t,'https://client.example',max_pages=1,references=['https://reference.example/offer'])
   sources=json.loads((Path(t)/'research/sources.json').read_text())['sources']
   self.assertEqual(calls,[('https://client.example/','client'),('https://reference.example/offer','reference')])
   self.assertEqual([s['role'] for s in sources],['client','reference'])
   self.assertEqual(sources[1]['id'],'R001')
 def test_invalid_reference_or_client_page_fails_before_any_capture(self):
  with tempfile.TemporaryDirectory() as t, patch.object(m,'capture') as capture:
   with self.assertRaises(ValueError):m.collect(t,'https://client.example',references=['file:///private/data'])
   with self.assertRaises(ValueError):m.collect(t,'https://client.example',explicit=['https://other.example/'])
   capture.assert_not_called()
 def test_unavailable_reference_stays_visible_and_is_not_silently_replaced(self):
  def capture(root,url,index,role='client'):
   return dict(id=('R' if role=='reference' else 'S')+f'{index:03d}',url=url,title='Fixture',status='unavailable' if role=='reference' else 'captured'),[]
  with tempfile.TemporaryDirectory() as t, patch.object(m,'capture',side_effect=capture):
   result=m.collect(t,'https://client.example',references=['https://reference.example/'])
   self.assertEqual(result['unavailable'],1)
   source=json.loads((Path(t)/'research/sources.json').read_text())['sources'][1]
   self.assertEqual(source['url'],'https://reference.example/')
   self.assertEqual(source['status'],'unavailable')
if __name__=='__main__':unittest.main(verbosity=2)
