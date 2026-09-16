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
if __name__=='__main__':unittest.main(verbosity=2)
