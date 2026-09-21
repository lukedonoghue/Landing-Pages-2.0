import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/copy_parity.py'
SPEC = importlib.util.spec_from_file_location('copy_parity_states', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CopyParityStateTests(unittest.TestCase):
    def master(self):
        return {
            'h1': 'Clear accounting support',
            'primary_cta': 'Discuss your needs',
            'sections': [{'headline': 'Know what is included'}],
            'modal': {
                'title': 'Tell us what you need',
                'failure': 'We could not save your enquiry. Please try again.',
                'uncertain': 'The result is not confirmed yet.',
            },
            'thank_you': {'headline': 'Your enquiry is saved'},
        }

    def capture(self, initial_error=False, later_error=False, include_error_state=True):
        documents = []
        for width in (390, 1440):
            documents += [
                {'surface':'landing','state':'initial','width':width,'text':'Clear accounting support Discuss your needs Know what is included'},
                {'surface':'modal','state':'step-0','width':width,'text':'Tell us what you need' + (' We could not save your enquiry. Please try again.' if initial_error else '')},
                {'surface':'modal','state':'step-2','width':width,'text':'Tell us what you need' + (' We could not save your enquiry. Please try again.' if later_error else '')},
                {'surface':'thank_you','state':'confirmation','width':width,'text':'Your enquiry is saved'},
            ]
            if include_error_state:
                documents.append({'surface':'modal','state':'submission-error','width':width,
                                  'text':'Tell us what you need We could not save your enquiry. Please try again.'})
        return {'status':'pass','execution':{'kind':'automated','exit_code':0},
                'viewports':[{'width':390},{'width':1440}], 'documents':documents,
                'synthetic_submissions_attempted':0}

    def test_failure_copy_is_absent_initially_and_captured_after_submit(self):
        result = MODULE.compare(self.master(), {'catalogue':{'enabled':False}}, self.capture())
        self.assertTrue(result['passed'], result['failures'])

    def test_initial_failure_copy_and_missing_error_state_both_block(self):
        visible = MODULE.compare(self.master(), {'catalogue':{'enabled':False}}, self.capture(initial_error=True))
        self.assertTrue(any('visible before submission' in failure for failure in visible['failures']))
        missing = MODULE.compare(self.master(), {'catalogue':{'enabled':False}}, self.capture(include_error_state=False))
        self.assertTrue(any('after a blocked submission' in failure for failure in missing['failures']))

    def test_later_pre_submit_step_cannot_expose_failure_copy(self):
        result = MODULE.compare(self.master(), {'catalogue':{'enabled':False}}, self.capture(later_error=True))
        self.assertTrue(any('pre-submit step' in failure for failure in result['failures']))


if __name__ == '__main__':
    unittest.main()
