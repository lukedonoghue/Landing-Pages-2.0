"""Synthetic evidence-contract tests, not editorial approval of a real page."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image

SKILL=Path(__file__).resolve().parents[1];sys.path.insert(0,str(SKILL/'scripts'))
import control_review as control
import workflow_storage as storage
import check_gates


class ControlReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        (self.root/'public').mkdir();(self.root/'build/control-review').mkdir(parents=True)
        storage.write(self.root,'funnel.json',{'backend':{'provider':'none'},'quality':{'contract_version':2}})
        self.before='A generic service overview for your next project.';self.after='See roof problems clearly before choosing repairs.'
        (self.root/'public/index.html').write_text('<h1>'+self.before+'</h1>')
        self.capture('initial',self.before);control.prepare(self.root,'build/control-review/initial-capture.json','initial-builder')
        self.reference=storage.read(self.root,'build/control-review/reference.json')
        self.draft={'baseline_sha256':control.sha(self.root/'build/control-review/baseline.json'),
            'reviewer':{'mode':'independent','task_id':'reviewer-1'},'checks':self.checks(self.before),
            'layout_reference_sha256':self.reference['layout_reference']['sha256'],
            'layout_observation':'Synthetic fixture: compare prominent result headline and the repeated action to the reviewed control layout.',
            'issues':[{'id':'copy-01','criterion':'first_screen_offer','priority':'P1','selector':'h1','before':self.before,
                'problem':'The headline does not explain the customer outcome.','why_it_matters':'The buyer cannot understand what changes for them.',
                'proposed_change':'Replace it with a concrete supported roof-inspection benefit.','acceptance_test':'The rendered H1 identifies the useful inspection result.'}]}
        self.draft['checks'][0]['verdict']='improve';self.save('comparison.json',self.draft)
    def save(self,name,value):
        # Synthetic host records exercise linkage, not a real independent review.
        reviewer=value.get('reviewer',{})
        if reviewer.get('mode')=='independent':
            path='build/control-review/'+reviewer['task_id']+'-synthetic-execution.json'
            storage.write(self.root,path,{'status':'completed','task_id':reviewer['task_id'],
                'host':'synthetic-unit-test','dispatch_id':'synthetic-dispatch','raw_result':'Synthetic test findings; no actual agent ran.'})
            reviewer['execution_artifact']={'path':path,'sha256':control.sha(self.root/path)}
        storage.write(self.root,'build/control-review/'+name,value)
    def checks(self,text):
        excerpt=control.reference()['text'][:70]
        return [{'criterion':c,'verdict':'pass','draft_excerpt':text,'control_excerpt':excerpt,
                 'observation':'Synthetic anchored observation for this mechanical regression.'} for c in control.CRITERIA]
    def capture(self,phase,text):
        views=[]
        for width,height in [(390,844),(1440,900)]:
            name=f'build/control-review/{phase}-{width}.png';Image.new('RGB',(width,height),'white').save(self.root/name)
            views.append({'width':width,'height':height,'text':text,'headings':[{'level':'H1','text':text}],
                'screenshot':name,'sha256':control.sha(self.root/name),'errors':[],'overflow':False})
        value={'schema_version':1,'execution':'playwright','capture_id':phase+'-synthetic','input':control.fingerprint(self.root),'views':views}
        self.save(phase+'-capture.json',value);return value
    def final(self,text=None):
        text=text or self.after;(self.root/'public/index.html').write_text('<h1>'+text+'</h1>');self.capture('final',text)
        resolutions={'comparison_sha256':control.sha(self.root/'build/control-review/comparison.json'),'builder_task_id':'repairer',
            'items':[{'id':'copy-01','status':'fixed','after':text,'verification':'Synthetic final rendering contains the replacement headline.'}]}
        self.save('resolutions.json',resolutions)
        acceptance={'reviewer':{'mode':'independent','task_id':'final-reviewer'},'capture_sha256':control.sha(self.root/'build/control-review/final-capture.json'),
            'resolutions_sha256':control.sha(self.root/'build/control-review/resolutions.json'),'checks':self.checks(text),'unresolved_findings':[],
            'headline_only_story':'Synthetic review: the headline explains the useful roof-inspection result.',
            'cold_reader_summary':'Synthetic review: homeowners receive a clear inspection report before choosing repairs.'}
        self.save('acceptance.json',acceptance);return acceptance
    def test_first_build_requires_checklist_then_repair(self):
        result=control.inspect(self.root);self.assertEqual(result['stage'],'control_repair');self.assertEqual(result['status'],'blocked')
    def test_preserved_baseline_and_fresh_resolved_checklist_pass(self):
        original=(self.root/'build/control-review/baseline.json').read_bytes();self.final()
        self.assertEqual(control.inspect(self.root)['status'],'pass');self.assertEqual(original,(self.root/'build/control-review/baseline.json').read_bytes())
    def test_cannot_replace_initial_draft(self):
        with self.assertRaises(ValueError):control.prepare(self.root,'build/control-review/initial-capture.json','someone-else')
    def test_zero_boolean_checks_never_pass(self):
        self.draft['checks']=[{'pass':True}];self.save('comparison.json',self.draft)
        self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_unanchored_excerpt_or_missing_criterion_block(self):
        for mutate in (lambda d:d['checks'][0].update(draft_excerpt='Not on this page'),lambda d:d['checks'].pop()):
            value=copy.deepcopy(self.draft);mutate(value);self.save('comparison.json',value)
            self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_no_change_is_not_a_copy_fix(self):
        self.final(self.before);self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_changed_source_invalidates_acceptance(self):
        self.final();(self.root/'public/index.html').write_text('<h1>Changed after review</h1>')
        self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_missing_or_reused_final_capture_blocks(self):
        self.final();path=self.root/'build/control-review/final-capture.json';value=json.loads(path.read_text());value['capture_id']='initial-synthetic';self.save('final-capture.json',value)
        self.assertEqual(control.inspect(self.root)['status'],'blocked');path.unlink();self.assertEqual(control.inspect(self.root)['stage'],'control_retest')
    def test_every_issue_needs_a_disposition(self):
        self.final();self.save('resolutions.json',{'comparison_sha256':control.sha(self.root/'build/control-review/comparison.json'),'items':[]})
        self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_builder_cannot_claim_independent_review(self):
        acceptance=self.final();acceptance['reviewer']['task_id']='repairer';self.save('acceptance.json',acceptance)
        self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_stale_final_evidence_dispatches_retest_not_initial_comparison(self):
        self.final();(self.root/'public/index.html').write_text('<h1>Changed after review</h1>')
        self.assertEqual(control.inspect(self.root)['stage'],'control_retest')
    def test_tiny_placeholder_cannot_claim_desktop_pixels(self):
        self.final();Image.new('RGB',(1,1),'white').save(self.root/'build/control-review/final-1440.png')
        cap=storage.read(self.root,'build/control-review/final-capture.json');cap['views'][1]['sha256']=control.sha(self.root/'build/control-review/final-1440.png');self.save('final-capture.json',cap)
        self.assertIn('dimensions',' '.join(control.inspect(self.root)['failures']))
    def test_mobile_overflow_blocks_acceptance(self):
        self.final();value=storage.read(self.root,'build/control-review/final-capture.json');value['views'][0]['overflow']=True;self.save('final-capture.json',value)
        self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_gate_cannot_be_omitted_for_new_or_guided_contract(self):
        self.assertIn('control_review',check_gates.required_gates(self.root,'handoff'))
        config=storage.read(self.root,'funnel.json');config['quality']={};config['guided_workflow']={'schema_version':1};storage.write(self.root,'funnel.json',config)
        self.assertIn('control_review',check_gates.required_gates(self.root,'handoff'))
    def test_missing_reference_layout_comparison_blocks(self):
        self.draft.pop('layout_reference_sha256');self.save('comparison.json',self.draft)
        self.assertEqual(control.inspect(self.root)['status'],'blocked')
    def test_report_registers_existing_gate_engine(self):
        self.final();snapshot={'schema_version':1,'created_at':check_gates.now(),'mode':'handoff',**check_gates.source_snapshot(self.root)}
        storage.write(self.root,'build/gate-snapshot.json',snapshot)
        result=control.report(self.root)
        self.assertEqual(result['status'],'pass');self.assertIn('control_review',storage.read(self.root,'build/gates.json')['gates'])


if __name__=='__main__':unittest.main()
