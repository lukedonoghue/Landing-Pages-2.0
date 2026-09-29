"""Regressions for the final-review template findings (Worker template, helpers, validators)."""
import contextlib
from html.parser import HTMLParser
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

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / 'scripts'
TEMPLATE = SKILL / 'assets/cloudflare'
sys.path.insert(0, str(SCRIPTS))
import build_guide  # noqa: E402
import self_contained_preview as preview  # noqa: E402
import thank_you_page as thankyou  # noqa: E402
import validate_funnel  # noqa: E402

spec = importlib.util.spec_from_file_location('final_review_reader_fixture', TEMPLATE / 'tests/fixtures/reader_guide_fixture.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class TemplateThankYou(unittest.TestCase):
    """A reader-guide project whose main page is the unmodified benchmark template."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        data = fixture.fixture(self.root, SCRIPTS)
        with contextlib.redirect_stdout(io.StringIO()):
            build_guide.build_reader(self.root, self.root / 'build/guide.json', data)
        for name in ('index.html', 'styles.css', 'funnel.js'):
            shutil.copy(TEMPLATE / 'public' / name, self.root / 'public' / name)

    def derive(self):
        with patch.object(sys, 'argv', ['thank_you_page.py', str(self.root)]), contextlib.redirect_stdout(io.StringIO()):
            thankyou.main()
        return (self.root / 'public/thank-you.html').read_text()


@unittest.skipUnless(shutil.which('node'), 'node runs npm run configure')
class ConfigureAfterDerivingTests(TemplateThankYou):
    def configure(self):
        funnel = json.loads((self.root / 'funnel.json').read_text())
        funnel.update(form_fields=[{'name': 'email', 'type': 'email', 'required': True}],
                      analytics={'mode': 'disabled', 'attribution_mode': 'lead', 'required_attribution_mode': 'lead'})
        (self.root / 'funnel.json').write_text(json.dumps(funnel))
        (self.root / 'scripts').mkdir(exist_ok=True)
        shutil.copy(TEMPLATE / 'scripts/sync-config.mjs', self.root / 'scripts/sync-config.mjs')
        (self.root / 'src').mkdir(exist_ok=True)
        shutil.copy(TEMPLATE / 'src/site-config.json', self.root / 'src/site-config.json')
        return subprocess.run(['node', 'scripts/sync-config.mjs'], cwd=self.root, capture_output=True, text=True, check=True).stdout

    def test_configure_after_deriving_keeps_one_phone_and_a_regenerable_page(self):
        derived = self.derive()
        # Derived while the header phone slot was still the hidden placeholder.
        self.assertIn('class="confirmation-phone"', derived)
        output = self.configure()
        self.assertIn('data-header-phone href="tel:02079460000">020 7946 0000</a>', (self.root / 'public/index.html').read_text())
        self.assertEqual((self.root / 'public/thank-you.html').read_text(), derived, 'configure must not edit the derived page')
        self.assertIn('thank_you_page.py', output)
        with self.assertRaisesRegex(ValueError, 'regenerate'):
            thankyou.inspect(self.root)
        header = self.derive().split('<header>', 1)[1].split('</header>', 1)[0]
        thankyou.inspect(self.root)
        self.assertEqual(header.count('href="tel:'), 1, header)
        self.assertNotIn('confirmation-phone', header)
        self.configure()
        thankyou.inspect(self.root)


class DerivedThankYouContractTests(TemplateThankYou):
    def test_approved_thank_you_wording_the_page_cannot_show_is_reported_when_deriving(self):
        config = json.loads((self.root / 'build/thank-you.json').read_text())
        shown = {'label': 'Your request has been received', 'headline': config['confirmed_headline'], 'follow_up_promise': config['follow_up'],
                 'download_label': config['download_label'], 'reader_heading': 'Read your guide now', 'delivery': 'Not rendered: the delivery contract'}
        (self.root / 'build/page-copy.json').write_text(json.dumps({'thank_you': {**shown, 'eyebrow': 'Thanks for getting in touch', 'body': 'We will call you today.'}}))
        # Previously this surfaced only at the rendered-copy gate, after a browser capture.
        with self.assertRaisesRegex(ValueError, r'build/page-copy\.json /thank_you/eyebrow, /thank_you/body\. It shows confirmed_headline'):
            self.derive()
        (self.root / 'build/page-copy.json').write_text(json.dumps({'thank_you': shown}))
        self.assertIn(config['confirmed_headline'], self.derive())

    def test_guide_cover_satisfies_the_static_image_contract(self):
        self.derive()
        shutil.copy(TEMPLATE / 'public/privacy.html', self.root / 'public/privacy.html')
        run = subprocess.run([sys.executable, str(SCRIPTS / 'validate_page.py'), str(self.root)], capture_output=True, text=True)
        self.assertEqual(json.loads(run.stdout)['checks']['image_issues'], [])


class FunnelFormBehaviorTests(unittest.TestCase):
    PAGE = ('<!doctype html><html><head><script src="funnel.js" defer></script><script src="script.js" defer></script></head><body><form>'
            '<select name="reason" required><option value="">Choose one</option><option>New project</option></select>'
            '<label><input type="radio" name="contact_method" value="Phone" required> Phone</label>'
            '<label><input type="radio" name="contact_method" value="Email" required> Email</label></form></body></html>')
    THANKS = ('<!doctype html><html><head><script src="/funnel.js"></script><script src="/confirmation.js"></script></head>'
              '<body><p data-confirmed-only hidden>Done</p><a data-guide-download href="/g.pdf">Download</a></body></html>')

    def failures(self, page=PAGE, thanks=THANKS, defaults=()):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / 'src').mkdir()
        (root / 'src/site-config.json').write_text('{}')
        (root / 'funnel.json').write_text(json.dumps({'form_fields': [{'name': name, 'default': value} for name, value in defaults]}))
        return validate_funnel.form_behavior_failures(root, page, thanks, True)

    def preselects(self, page, **options):
        return [failure for failure in self.failures(page, **options) if 'preselects' in failure]

    def test_required_select_uses_the_option_the_browser_selects(self):
        self.assertEqual(self.failures(), [])
        later = self.PAGE.replace('<option>New project</option>', '<option selected>New project</option>')
        self.assertEqual(len(self.preselects(later)), 1)
        self.assertEqual(self.preselects(later, defaults=[('reason', 'New project')]), [])
        self.assertTrue(self.preselects(self.PAGE.replace('<option>New project</option>', '<option SELECTED="selected">New project</option>')))
        # A disabled prompt is skipped, so the browser preselects the first enabled option, unless the prompt is selected.
        self.assertTrue(self.preselects(self.PAGE.replace('<option value="">', '<option value="" disabled>')))
        self.assertEqual(self.preselects(self.PAGE.replace('<option value="">', '<option value="" disabled selected>')), [])

    def test_required_radio_group_must_arrive_unanswered(self):
        checked = self.PAGE.replace('value="Email" required>', 'value="Email" required checked>')
        self.assertEqual(self.preselects(checked), ["Required radio group 'contact_method' preselects 'Email'; leave it unchecked, or declare \"default\": 'Email' for it in funnel.json form_fields"])
        self.assertEqual(self.preselects(checked, defaults=[('contact_method', 'Email')]), [])
        # `required` on any member makes the whole group required.
        self.assertTrue(self.preselects(checked.replace('value="Email" required checked', 'value="Email" checked')))

    def test_select_attributes_follow_html_case_and_spacing(self):
        for prompt in ('<option VALUE="">', '<option value = "">', "<option value=''>", '<option value>'):
            self.assertEqual(self.failures(self.PAGE.replace('<option value="">', prompt)), [], prompt)
        named = self.PAGE.replace('<option value="">Choose one</option>', '').replace('<select name="reason"', '<select NAME = "reason"')
        self.assertTrue(any("'reason' preselects" in failure for failure in self.failures(named)))
        self.assertEqual(self.failures(named, defaults=[('reason', 'New project')]), [])

    def test_confirmation_check_reads_elements_not_comments_or_script_text(self):
        mentions = self.THANKS.replace('</body>', '<!-- Each CTA used data-open-modal and <form id="lead-modal"> on the landing page. -->'
                                       "<script>document.querySelectorAll('[data-open-modal]');const markup='<form>';</script></body>")
        self.assertEqual(self.failures(thanks=mentions), [])
        self.assertTrue(any('#lead-modal' in failure for failure in self.failures(thanks=self.THANKS.replace('<p ', "<div id='lead-modal'></div><p "))))


class SelfContainedPreviewTests(unittest.TestCase):
    def build(self, page, files):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / 'public/assets').mkdir(parents=True)
        (root / 'public/index.html').write_text(page)
        for name, body in files.items():
            (root / 'public' / name).write_bytes(body if isinstance(body, bytes) else body.encode())
        return Path(preview.build(root)['preview']).read_text()

    def test_inlined_script_and_style_cannot_close_their_element_in_any_case(self):
        html = self.build('<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><p>Page</p><script src="a.js"></script></body></html>',
                          {'a.js': 'const snippet = "</SCRIPT><img src=x onerror=alert(1)>" + "</Script >";',
                           'styles.css': 'p::after{content:"</STYLE><i>leak</i>"}'})
        tags, parser = [], HTMLParser()
        parser.handle_starttag = lambda tag, attrs: tags.append(tag)
        parser.feed(html)
        self.assertNotIn('img', tags, 'Inlined script text became markup')
        self.assertNotIn('i', tags, 'Inlined stylesheet text became markup')
        self.assertIn('"<\\/SCRIPT><img', html)
        self.assertIn('"<\\/STYLE><i>', html)

    def test_embedded_guide_reader_is_inlined_and_checked(self):
        page = ('<!doctype html><html><body><details><summary>Read</summary><iframe data-guide-embed src="/assets/guide.pdf" title="Guide"></iframe></details>'
                '<object data="assets/plan.pdf" type="application/pdf"></object><embed src="assets/plan.pdf" type="application/pdf"></body></html>')
        # The raw page cannot open on its own: its reader loads a sibling file.
        self.assertEqual(preview.local_references(page), ['/assets/guide.pdf', 'assets/plan.pdf'])
        html = self.build(page, {'assets/guide.pdf': b'%PDF-1.7 guide fixture', 'assets/plan.pdf': b'%PDF-1.7 plan fixture'})
        self.assertEqual(preview.local_references(html), [])
        self.assertIn('iframe data-guide-embed src="data:application/pdf;base64,', html)
        self.assertIn('object data="data:application/pdf;base64,', html)
        self.assertIn('embed src="data:application/pdf;base64,', html)


if __name__ == '__main__':
    unittest.main()
