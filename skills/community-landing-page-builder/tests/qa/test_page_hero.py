#!/usr/bin/env python3
"""Opt-in browser regressions for hero continuation, text and font parity."""
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
        prose = 'A local service team provides a clear quotation after reviewing the property and the work required.'
        brand_path = root / 'brand.json'
        brand_path.write_text(json.dumps({'measurements': [{'viewport': {'width': 390}, 'roles': {
            'hero_heading': [{'fontFamily': 'Georgia, serif', 'text': 'Local service'}],
            'body': [{'fontFamily': 'Arial, sans-serif', 'text': prose}],
        }}]}))
        for name, height in [('visible', '200px'), ('below', '110vh'), ('overlap', '200px'), ('font-drift', '200px')]:
            label_offset = '30px' if name == 'overlap' else '180px'
            body_font = 'Georgia, serif' if name == 'font-drift' else 'Arial, sans-serif'
            (root / f'{name}.html').write_text(
                '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>Hero fixture</title><style>body{margin:0}h1{font-size:24px;margin:0;font-family:Georgia,serif}'
                f'body{{font-family:{body_font}}}'
                f'.hero{{height:{height}}}section+section{{height:200px}}a{{display:inline-block;padding:16px}}'
                '.label-row{position:relative}.category{position:absolute;left:0;top:0;margin:0}'
                f'.label-row h2{{margin:0 0 0 {label_offset};font-size:24px}}</style>'
                '<main><section class="hero"><h1>Local service</h1>'
                f'<p>{prose}</p>'
                '<a href="tel:+15555550100" data-primary-action>Call</a></section>'
                '<section><div class="label-row"><p class="category">SPECIALIST ACCESS</p><h2>Service</h2></div></section></main></html>'
            )
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            for name in ['visible', 'below', 'overlap', 'font-drift']:
                report_path = root / name / 'report.json'
                result = subprocess.run([
                    args.node, str(skill / 'scripts/measure_page.mjs'),
                    f'http://127.0.0.1:{server.server_port}/{name}.html',
                    '--out', str(report_path), '--playwright-module', args.playwright_module,
                    '--browser-executable', args.browser_executable,
                    '--brand-report', str(brand_path),
                ], capture_output=True, text=True, timeout=120)
                assert report_path.is_file(), result.stdout + result.stderr
                report = json.loads(report_path.read_text())
                checks = [c for c in report['checks'] if c['name'] == 'hero_reveals_following_content']
                assert len(checks) == 5, checks
                expected = 'blocked' if name == 'below' else 'pass'
                assert all(c['status'] == expected for c in checks), checks
                collision_checks = [c for c in report['checks'] if c['name'] == 'positioned_text_does_not_overlap_prose']
                assert len(collision_checks) == 5, collision_checks
                expected_collision = 'blocked' if name == 'overlap' else 'pass'
                assert all(c['status'] == expected_collision for c in collision_checks), collision_checks
                font_checks = report['typographyComparison']
                assert len(font_checks) == 10, font_checks
                assert all(c['matches'] for c in font_checks if c['role'] == 'heading'), font_checks
                assert all(c['matches'] == (name != 'font-drift') for c in font_checks if c['role'] == 'body'), font_checks
                assert any('body font differs' in w for w in report['warnings']) == (name == 'font-drift'), report['warnings']
                assert (result.returncode == 0) == (name in ['visible', 'font-drift']), report['failures']
        finally:
            server.shutdown()
            server.server_close()
    print('PASS: hero, positioned-text and source-font parity fixtures at all five viewports')


if __name__ == '__main__':
    main()
