#!/usr/bin/env python3
"""Run valid and intentionally broken pages through the actual Chromium harness."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
import sys
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
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[2]
    out = args.out or Path(tempfile.mkdtemp(prefix='funnel-browser-regression-'))
    out.mkdir(parents=True, exist_ok=True)
    results = []
    for kind in ['neutral', 'broken', 'contract-broken']:
        root = out / kind
        shutil.copytree(Path(__file__).parent / 'neutral', root, dirs_exist_ok=True)
        page = root / 'index.html'
        page.write_text(page.read_text().replace('A neutral fixture for testing the browser harness.',
            'A neutral local service fixture with a clear consultation process and a written project quotation.'))
        page.write_text(page.read_text().replace('<main>', '<header><p class="phone-fixture">Phone <span>(demo)</span>: (202) 555-0100</p></header><main>'))
        config_path = root / 'funnel.json'
        config = json.loads(config_path.read_text()) if config_path.exists() else {}
        config.setdefault('client', {})['phone_display'] = '(202) 555-0100'
        config_path.write_text(json.dumps(config))
        if kind == 'broken':
            path = root / 'index.html'
            path.write_text(path.read_text() + '<style>main{width:1900px;max-width:none}body{min-width:1900px}</style><img src="/missing-image.png" width="100" height="100" alt="Broken fixture">')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            extraction = subprocess.run([args.node, str(skill / 'scripts/extract_brand.mjs'),
                f'http://127.0.0.1:{server.server_port}/', '--out', str(root / 'build/brand.json'),
                '--playwright-module', args.playwright_module, '--browser-executable', args.browser_executable],
                capture_output=True, text=True, timeout=90)
            assert extraction.returncode == 0, extraction.stdout + extraction.stderr
            if kind == 'contract-broken':
                page.write_text(page.read_text() + '<style>h1{font-family:Georgia,serif}.ratio-fixture{width:200px;aspect-ratio:4/3;object-fit:cover}'
                    '#dialog{position:relative}[data-close-modal]{position:absolute;top:24px;left:24px}.phone-fixture{display:none}</style>'
                    '<img class="ratio-fixture" width="800" height="600" alt="Ratio fixture" '
                    'src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27800%27 height=%27600%27%3E%3Crect width=%27800%27 height=%27600%27 fill=%27green%27/%3E%3C/svg%3E">')
            subprocess.run([sys.executable, str(skill / 'scripts/check_gates.py'), 'snapshot', str(root), '--mode', 'preview'], check=True, capture_output=True)
            command = [args.node, str(skill / 'scripts/measure_funnel.mjs'), f'http://127.0.0.1:{server.server_port}/', '--project-root', str(root), '--out', str(root / 'build/layout-audit.json'), '--playwright-module', args.playwright_module, '--browser-executable', args.browser_executable, '--form-fixture', str(root / 'form-fixture.json')]
            process = subprocess.run(command, capture_output=True, text=True, timeout=150)
            if not (root / 'build/layout-audit.json').is_file():
                raise RuntimeError(process.stdout + process.stderr)
            report = json.loads((root / 'build/layout-audit.json').read_text())
            if kind == 'neutral':
                assert process.returncode == 0, report['failures']
                assert len(report['viewports']) == 10, 'viewport coverage'
                assert any(item['name'] == 'modal_focus_trap' for item in report['checks']), 'modal coverage'
            elif kind == 'broken':
                assert process.returncode != 0, 'broken page must fail'
                assert any('page_overflow' in item for item in report['failures']), report['failures']
                assert any('loaded_images' in item for item in report['failures']), report['failures']
            else:
                assert process.returncode != 0, 'invalid acceptance contract must fail'
                for name in ['source_brand_font_matches', 'explicit_image_ratio_matches_layout', 'modal_close_has_clear_space', 'verified_phone_visible_near_top']:
                    assert any(name in item for item in report['failures']), (name, report['failures'])
            results.append({'fixture': kind, 'expected_status_verified': True, 'status': report['status'], 'viewports': len(report['viewports']), 'report': str(root / 'build/layout-audit.json')})
        finally:
            server.shutdown()
            server.server_close()
    print(json.dumps({'status': 'pass', 'results': results}, indent=2))

if __name__ == '__main__':
    main()
