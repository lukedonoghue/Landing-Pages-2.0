#!/usr/bin/env python3
"""Opt-in browser regression for first-viewport continuation measurements."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
from threading import Thread


class QuietHandler(SimpleHTTPRequestHandler):
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
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        for name, height in [('visible', '200px'), ('below', '110vh')]:
            (root / f'{name}.html').write_text(
                '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>Hero fixture</title><style>body{margin:0}h1{font-size:24px;margin:0}'
                f'.hero{{height:{height}}}section+section{{height:200px}}a{{display:inline-block;padding:16px}}</style>'
                '<main><section class="hero"><h1>Local service</h1>'
                '<a href="tel:+15555550100" data-primary-action>Call</a></section>'
                '<section><h2>More information</h2></section></main></html>'
            )
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            for name in ['visible', 'below']:
                report_path = root / name / 'report.json'
                result = subprocess.run([
                    args.node, str(skill / 'scripts/measure_page.mjs'),
                    f'http://127.0.0.1:{server.server_port}/{name}.html',
                    '--out', str(report_path), '--playwright-module', args.playwright_module,
                    '--browser-executable', args.browser_executable,
                ], capture_output=True, text=True, timeout=120)
                assert report_path.is_file(), result.stdout + result.stderr
                report = json.loads(report_path.read_text())
                checks = [c for c in report['checks'] if c['name'] == 'hero_reveals_following_content']
                assert len(checks) == 5, checks
                expected = 'pass' if name == 'visible' else 'blocked'
                assert all(c['status'] == expected for c in checks), checks
                assert (result.returncode == 0) == (name == 'visible'), report['failures']
        finally:
            server.shutdown()
            server.server_close()
    print('PASS: visible and below-fold hero fixtures at all five viewports')


if __name__ == '__main__':
    main()
