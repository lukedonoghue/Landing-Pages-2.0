#!/usr/bin/env python3
"""Source entrance animations and below-fold prose must not lose font evidence."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
from threading import Thread


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--playwright-module', required=True)
    parser.add_argument('--browser-executable', required=True)
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        (root / 'index.html').write_text(
            '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Brand sample fixture</title><style>body{margin:0;font-family:Arial,sans-serif}'
            'h1{font-family:Georgia,serif;opacity:0}section{height:1200px}p{margin:0;padding:20px}</style>'
            '<main><section><h1>Garden rooms</h1></section><p>Our team designs and builds practical rooms '
            'with a clear consultation process and a written project quotation.</p></main>'
            '<script>setTimeout(()=>document.querySelector("h1").style.opacity=1,900)</script></html>'
        )
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            path = root / 'evidence/brand.json'
            result = subprocess.run(['node', str(skill / 'scripts/extract_brand.mjs'),
                f'http://127.0.0.1:{server.server_port}/', '--out', str(path),
                '--playwright-module', args.playwright_module, '--browser-executable', args.browser_executable],
                capture_output=True, text=True, timeout=60)
            assert result.returncode == 0, result.stdout + result.stderr
            report = json.loads(path.read_text())
            assert len(report['measurements']) == 2
            for view in report['measurements']:
                assert view['roles']['hero_heading'][0]['text'] == 'Garden rooms', view
                assert not view['roles']['body'], 'First-viewport roles must not be overwritten by below-fold samples'
                for role, family in [('heading', 'Georgia'), ('body', 'Arial')]:
                    sample = view['typography'][role]
                    assert sample['fontFamily'].startswith(family), sample
                    assert sample['renderedFonts'], sample
                body = view['typography']['body']
                assert body['sampleScrollY'] > 0, body
                assert (path.parent / body['screenshot']).is_file(), body
        finally:
            server.shutdown()
            server.server_close()
    print('PASS: delayed source heading and below-fold body have rendered-font evidence at both source widths')


if __name__ == '__main__':
    main()
