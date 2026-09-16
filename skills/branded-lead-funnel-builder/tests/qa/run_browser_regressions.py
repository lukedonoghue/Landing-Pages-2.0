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
    for kind in ['neutral', 'broken']:
        root = out / kind
        shutil.copytree(Path(__file__).parent / 'neutral', root, dirs_exist_ok=True)
        if kind == 'broken':
            path = root / 'index.html'
            path.write_text(path.read_text() + '<style>main{width:1900px;max-width:none}body{min-width:1900px}</style><img src="/missing-image.png" width="100" height="100" alt="Broken fixture">')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            subprocess.run([sys.executable, str(skill / 'scripts/check_gates.py'), 'snapshot', str(root), '--mode', 'preview'], check=True, capture_output=True)
            command = [args.node, str(skill / 'scripts/measure_funnel.mjs'), f'http://127.0.0.1:{server.server_port}/', '--project-root', str(root), '--out', str(root / 'build/layout-audit.json'), '--playwright-module', args.playwright_module, '--browser-executable', args.browser_executable, '--form-fixture', str(root / 'form-fixture.json')]
            process = subprocess.run(command, capture_output=True, text=True, timeout=150)
            if not (root / 'build/layout-audit.json').is_file():
                raise RuntimeError(process.stdout + process.stderr)
            report = json.loads((root / 'build/layout-audit.json').read_text())
            if kind == 'neutral':
                assert process.returncode == 0, report['failures']
                assert len(report['viewports']) == 9, 'viewport coverage'
                assert any(item['name'] == 'modal_focus_trap' for item in report['checks']), 'modal coverage'
            else:
                assert process.returncode != 0, 'broken page must fail'
                assert any('page_overflow' in item for item in report['failures']), report['failures']
                assert any('loaded_images' in item for item in report['failures']), report['failures']
            results.append({'fixture': kind, 'expected_status_verified': True, 'status': report['status'], 'viewports': len(report['viewports']), 'report': str(root / 'build/layout-audit.json')})
        finally:
            server.shutdown()
            server.server_close()
    print(json.dumps({'status': 'pass', 'results': results}, indent=2))

if __name__ == '__main__':
    main()
