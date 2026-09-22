"""Keep the bounded reader fixture legible without a mostly empty sources page.

This is a fixture regression, not a universal page-count limit or a substitute
for the required visual review of each real client guide.
"""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import build_guide

spec = importlib.util.spec_from_file_location('layout_reader_fixture', SKILL / 'assets/cloudflare/tests/fixtures/reader_guide_fixture.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class ReaderPaginationTests(unittest.TestCase):
    def test_short_guide_does_not_orphan_only_contact_and_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = fixture.fixture(root, SKILL / 'scripts')
            with contextlib.redirect_stdout(io.StringIO()):
                build_guide.build_reader(root, root / 'build/guide.json', data)
            report = json.loads((root / 'build/guide-build.json').read_text())
            self.assertEqual(report['page_count'], 3, 'Do not pad this bounded fixture with a nearly empty fourth page')
            final = subprocess.check_output(['pdftotext', '-f', '3', '-l', '3', str(root / report['output']), '-'], text=True)
            self.assertIn('Sources and scope', final)
            self.assertIn('Your next step', final)
            self.assertGreater(len(final.split()), 150)
            complete = ' '.join((root / report['text_output']).read_text().split())
            for chapter in data['chapters']:
                for paragraph in chapter['paragraphs']:
                    self.assertIn(' '.join(paragraph.split()), complete)


if __name__ == '__main__':
    unittest.main()
