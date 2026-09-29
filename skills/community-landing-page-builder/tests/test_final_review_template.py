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
    def test_guide_cover_satisfies_the_static_image_contract(self):
        self.derive()
        shutil.copy(TEMPLATE / 'public/privacy.html', self.root / 'public/privacy.html')
        run = subprocess.run([sys.executable, str(SCRIPTS / 'validate_page.py'), str(self.root)], capture_output=True, text=True)
        self.assertEqual(json.loads(run.stdout)['checks']['image_issues'], [])


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
