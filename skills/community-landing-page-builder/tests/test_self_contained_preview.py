from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import self_contained_preview as preview

PAGE = '''<!doctype html><html><head><link rel="stylesheet" href="styles.css"><script src="funnel.js" defer></script></head>
<body><img src="/assets/photo.png" srcset="/assets/photo.png 1x" alt="Job"><a href="/thank-you.html">Next</a><script src="script.js" defer></script></body></html>'''


class SelfContainedPreviewTests(unittest.TestCase):
    def test_chat_preview_isolated_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'public/assets').mkdir(parents=True)
            (root / 'public/index.html').write_text(PAGE)
            (root / 'public/styles.css').write_text('body{background:url(assets/photo.png)}')
            (root / 'public/funnel.js').write_text('window.LeadFunnel={};')
            (root / 'public/script.js').write_text('if(!window.LeadFunnel)throw Error("order");')
            (root / 'public/assets/photo.png').write_bytes(b'\x89PNG fixture')
            # The raw page is not a standalone preview: it needs its sibling files.
            self.assertEqual(preview.local_references(PAGE), ['/assets/photo.png', 'funnel.js', 'script.js', 'styles.css'])
            result = preview.build(root)
            html = Path(result['preview']).read_text()
            self.assertEqual(preview.local_references(html), [])
            self.assertIn('data-preview-notice', html)
            self.assertIn('href="/thank-you.html"', html, 'Page links are not resources')
            self.assertLess(html.index('window.LeadFunnel={}'), html.index('if(!window.LeadFunnel)'), 'Deferred scripts keep their order')
            (root / 'public/assets/photo.png').unlink()
            with self.assertRaisesRegex(ValueError, 'missing'):
                preview.build(root)


if __name__ == '__main__':
    unittest.main()
