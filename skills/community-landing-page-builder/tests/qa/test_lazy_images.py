#!/usr/bin/env python3
"""Verify delayed lazy images recover without hiding genuinely broken assets."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
from threading import Thread


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--playwright-module', required=True)
    parser.add_argument('--browser-executable', required=True)
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="green"/></svg>'
        (root / 'photo.svg').write_text(svg)
        for mode in ['delayed', 'broken']:
            script = '' if mode == 'broken' else (
                '<script>const image=document.querySelector("img");'
                'const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){'
                'observer.disconnect();setTimeout(()=>image.src="photo.svg",900)}});observer.observe(image);</script>'
            )
            src = ' src="missing.png"' if mode == 'broken' else ''
            (root / f'{mode}.html').write_text(
                '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>Image fixture</title><style>body{margin:0}section{min-height:200px}img{display:block;'
                'width:200px;height:150px;margin-top:6000px}a{display:inline-block;padding:16px}</style>'
                '<main><section class="hero"><h1>Local service</h1><a data-primary-action href="tel:+15555550100">Call</a>'
                '</section><section><h2>Our work</h2>'
                f'<img{src} width="400" height="300" alt="Service illustration" data-image-role="illustrative">'
                '</section></main>' + script + '</html>'
            )
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(root)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            for mode in ['delayed', 'broken']:
                report_path = root / mode / 'report.json'
                result = subprocess.run([
                    'node', str(skill / 'scripts/measure_page.mjs'),
                    f'http://127.0.0.1:{server.server_port}/{mode}.html', '--out', str(report_path),
                    '--playwright-module', args.playwright_module, '--browser-executable', args.browser_executable,
                ], capture_output=True, text=True, timeout=150)
                assert report_path.exists(), result.stdout + result.stderr
                report = json.loads(report_path.read_text())
                checks = [c for c in report['checks'] if c['name'] == 'images_loaded']
                assert len(checks) == 5, checks
                assert all(c['status'] == ('pass' if mode == 'delayed' else 'blocked') for c in checks), checks
                assert (result.returncode == 0) == (mode == 'delayed'), report['failures']
                if mode == 'delayed':
                    assert any(i['decoded'] for v in report.get('imageLoadRechecks', []) for i in v['images']), report
        finally:
            server.shutdown()
            server.server_close()
    print('PASS: delayed image recovery and genuine broken-image rejection at all five viewports')


if __name__ == '__main__':
    main()
