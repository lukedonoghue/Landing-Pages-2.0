"""Copy parity invariants; synthetic snapshots never imply a real user approval."""
import copy
import json
import tempfile
import sys
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1] / "skills/branded-lead-funnel-builder"
sys.path.insert(0, str(SKILL / "scripts"))
import copy_parity as parity


class CopyParityTests(unittest.TestCase):
    def setUp(self):
        self.master = {
            "h1": "Plan your project.", "primary_cta": "Request the guide",
            "sections": [{"id": "hero", "headline": "Choose a useful next step.",
                          "body": "An estimate follows a site review.", "claim_ids": ["C1"]}],
            "modal": {"headline": "Your project guide", "submit_label": "Request the guide",
                      "follow_up_promise": "The team will discuss your project."},
            "thank_you": {"headline": "Your enquiry is saved.", "body": "Download the guide below."},
            "brochure": {"cover_promise": "Plan your project.", "delivery": "Delivered after a saved enquiry.",
                         "text": ["Plan your project.", "An estimate follows a site review.", "The team will discuss your project."]}
        }
        self.funnel = {"client": {"name": "Example Workshop"}, "form_fields": []}
        self.capture = {
            "status": "pass", "execution": {"kind": "automated", "exit_code": 0},
            "viewports": [{"width": 390}, {"width": 1440}], "documents": [],
            "pdf": {"sha256": "pdf-hash", "served_sha256": "pdf-hash", "page_count": 2,
                    "text": "Example Workshop\nPlan your project.\nAn estimate follows a site review.\n01\fThe team will discuss your project.\n02\f"}
        }
        for width in (390, 1440):
            for surface, text in [
                ("landing", "Example Workshop\nPlan your project.\nChoose a useful next step.\nAn estimate follows a site review.\nRequest the guide\nPrivacy information"),
                ("modal", "Your project guide\nStep 1 of 3\nFirst name\nThe team will discuss your project.\nRequest the guide\nBack\nContinue"),
                ("thank_you", "Example Workshop\nYour enquiry is saved.\nDownload the guide below.\nBack to the page")
            ]:
                self.capture["documents"].append({"surface": surface, "width": width, "text": text})

    def result(self):
        return parity.compare(self.master, self.funnel, self.capture)

    def test_all_approved_surfaces_match(self):
        self.assertTrue(self.result()["passed"], self.result())

    def test_removing_a_qualifier_blocks_only_the_affected_mobile_surface(self):
        self.capture["documents"][0]["text"] = self.capture["documents"][0]["text"].replace(
            "An estimate follows a site review.", "Get an instant estimate.")
        result = self.result()
        self.assertFalse(result["passed"])
        self.assertTrue(any("landing 390" in failure for failure in result["failures"]))
        self.assertFalse(any("landing 1440" in failure for failure in result["failures"]))

    def test_unapproved_addition_is_rejected_even_if_original_copy_remains(self):
        self.capture["documents"][0]["text"] += "\nGuaranteed 50% more revenue."
        self.assertTrue(any("unapproved rendered text" in failure for failure in self.result()["failures"]))

    def test_pdf_truncation_or_extra_claim_is_rejected(self):
        original = self.capture["pdf"]["text"]
        self.capture["pdf"]["text"] = self.capture["pdf"]["text"].replace(
            "An estimate follows a site review.", "An estimate follows...")
        self.assertFalse(self.result()["passed"])

        self.capture["pdf"]["text"] = original.replace("\n02\f", "\nGuaranteed results.\n02\f")
        self.assertFalse(self.result()["passed"])

    def test_pdf_page_number_can_share_a_line_with_approved_footer_only(self):
        self.capture['pdf']['text']=self.capture['pdf']['text'].replace('\n01\f','\nExample Workshop 01\f').replace('\n02\f','\nExample Workshop 02\f')
        self.assertTrue(self.result()['passed'],self.result())
        self.capture['pdf']['text']=self.capture['pdf']['text'].replace('Example Workshop 02','Guaranteed results 02')
        self.assertFalse(self.result()['passed'])

    def test_explicit_pdf_navigation_labels_are_bounded_by_actual_pages(self):
        original = self.capture['pdf']['text']
        self.capture['pdf']['text'] = original.replace('Plan your project.', 'Page 02\nPlan your project.')
        self.assertTrue(self.result()['passed'], self.result())
        for invalid in ['Page 99', 'Page 0', '99%', '$100', '99']:
            self.capture['pdf']['text'] = original.replace('Plan your project.', invalid+'\nPlan your project.')
            self.assertFalse(self.result()['passed'], invalid)

    def test_typographic_case_whitespace_and_smart_punctuation_are_supported(self):
        self.master["h1"] = "Plan your project — with care."
        for document in self.capture["documents"]:
            if document["surface"] == "landing":
                document["text"] = document["text"].replace("Plan your project.", "PLAN YOUR PROJECT -\nWITH CARE.")
        self.assertTrue(self.result()["passed"], self.result())

    def test_brochure_requires_complete_copy_or_unchanged_supplied_asset(self):
        self.master["brochure"].pop("text")
        self.assertFalse(self.result()["passed"])
        self.master["brochure"]["approved_asset"] = {"origin": "supplied", "path": "research/guide.pdf", "sha256": "pdf-hash"}
        self.assertTrue(self.result()["passed"], self.result())
        self.capture["pdf"]["served_sha256"] = "different"
        self.assertFalse(self.result()["passed"])

    def test_extra_numbers_and_percentages_are_not_discarded_as_decoration(self):
        for extra in ["99%", "$100", "10", "1,000"]:
            changed = copy.deepcopy(self.capture)
            changed["documents"][0]["text"] += "\n" + extra
            self.assertFalse(parity.compare(self.master, self.funnel, changed)["passed"], extra)

    def test_missing_or_unexecuted_mobile_capture_is_not_a_pass(self):
        self.capture["documents"] = [doc for doc in self.capture["documents"] if doc["width"] != 390]
        self.assertFalse(self.result()["passed"])
        self.capture["execution"]["kind"] = "manual"
        self.assertFalse(self.result()["passed"])

    def test_recorded_fixture_values_cannot_hide_unapproved_marketing(self):
        self.capture["synthetic_fixture"] = True
        self.capture["fixture_display_values"] = ["Guaranteed 50% more revenue."]
        self.capture["documents"][0]["text"] += "\nGuaranteed 50% more revenue."
        self.assertFalse(self.result()["passed"])

    def test_disabled_brochure_does_not_require_a_pdf(self):
        self.funnel["catalogue"] = {"enabled": False}
        self.capture.pop("pdf")
        self.master.pop("brochure")
        self.assertTrue(self.result()["passed"], self.result())


class CopyParityGateTests(unittest.TestCase):
    def setUp(self):
        CopyParityTests.setUp(self)
        import check_gates
        self.gates = check_gates
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'build/rendered-copy').mkdir(parents=True)
        (self.root/'public').mkdir()
        self.save('funnel.json',self.funnel)
        self.save('build/page-copy.json',self.master)
        pdf = self.root/'public/guide.pdf';pdf.write_bytes(b'%PDF-synthetic-test-evidence')
        self.snapshot = {'mode':'handoff','created_at':check_gates.now(),**check_gates.source_snapshot(self.root)}
        self.save('build/gate-snapshot.json',self.snapshot)
        self.capture.update(schema_version=1,gate='rendered_copy_capture',executed_at=check_gates.now(),
            source_fingerprint=self.snapshot['source_fingerprint'],copy_sha256=parity.sha(self.root/'build/page-copy.json'),
            target={'mode':'handoff','url':'http://127.0.0.1:8787/'})
        self.capture['execution']['command']=['synthetic-validator-fixture']
        self.capture['pdf'].update(path='public/guide.pdf',sha256=parity.sha(pdf),served_sha256=parity.sha(pdf))
        for d in self.capture['documents']:d.update(state='fixture',path='/')
        self.save('build/rendered-copy/capture.json',self.capture)

    def save(self,name,value):
        (self.root/name).write_text(json.dumps(value))

    def test_saved_capture_is_recomputed_when_gate_is_recorded(self):
        report = parity.audit(self.root)
        self.assertEqual(self.gates.validate_report(self.root,report,self.snapshot,'rendered_copy'),[])
        self.capture['documents'][0]['text'] += ' Guaranteed 80% increase.'
        self.save('build/rendered-copy/capture.json',self.capture)
        # A fresh artifact hash and a claimed green status cannot waive the actual mismatch.
        for a in report['artifacts']:
            a['sha256']=parity.sha(self.root/a['path'])
        self.assertTrue(self.gates.validate_report(self.root,report,self.snapshot,'rendered_copy'))

    def test_changed_master_and_replaced_pdf_invalidate_saved_capture(self):
        report=parity.audit(self.root)
        self.master['h1']='A different promise.';self.save('build/page-copy.json',self.master)
        self.assertTrue(self.gates.validate_report(self.root,report,self.snapshot,'rendered_copy'))
        (self.root/'public/guide.pdf').write_bytes(b'%PDF-replaced')
        self.assertEqual(parity.audit(self.root)['status'],'blocked')

    def test_gate_cannot_point_at_an_alternative_master(self):
        report=parity.audit(self.root)
        self.save('build/alternative-copy.json',self.master)
        next(a for a in report['artifacts'] if a['type']=='copy_master')['path']='build/alternative-copy.json'
        self.assertTrue(self.gates.validate_report(self.root,report,self.snapshot,'rendered_copy'))

    def test_complete_worker_release_requires_parity(self):
        self.funnel.update(quality={'complete_workflow':True},backend={'provider':'cloudflare-d1'})
        self.save('funnel.json',self.funnel)
        for mode in ('preview','handoff','live'):
            self.assertIn('rendered_copy',self.gates.required_gates(self.root,mode))
        self.funnel['backend']['provider']='none';self.save('funnel.json',self.funnel)
        self.assertNotIn('rendered_copy',self.gates.required_gates(self.root,'handoff'))


if __name__ == "__main__":
    unittest.main()
