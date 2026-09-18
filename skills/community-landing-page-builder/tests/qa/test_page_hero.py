#!/usr/bin/env python3
"""Opt-in browser regressions for composition, font parity and modal focus."""
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
        cases = ['visible', 'below', 'overlap', 'font-drift', 'modal-covered', 'modal-clear', 'font-fallback', 'font-loaded']
        for name in cases:
            height = '110vh' if name == 'below' else '200px'
            label_offset = '30px' if name == 'overlap' else '180px'
            body_font = 'Georgia, serif' if name == 'font-drift' else 'Arial, sans-serif'
            heading_font = 'FixtureWebFont, Georgia, serif' if name in ['font-fallback', 'font-loaded'] else 'Georgia, serif'
            font_face = '@font-face{font-family:FixtureWebFont;src:local("Arial"),local("Liberation Sans"),local("DejaVu Sans")}' if name == 'font-loaded' else ''
            modal = ''
            trigger = '<a href="tel:+15555550100" data-primary-action>Call</a>'
            if name.startswith('modal-'):
                trigger = '<button type="button" data-open-modal data-primary-action>Get a quote</button>'
                fields = ''.join(f'<label>Field {n}<input id="field-{n}" name="field-{n}"></label>' for n in range(14))
                action = '<div class="actions"><button type="submit">Request quote</button></div>'
                body = f'<div class="fields">{fields}{action if name == "modal-covered" else ""}</div>'
                modal = (
                    '<style>button{min-height:48px;padding:12px}dialog{padding:0;width:min(90vw,700px)}'
                    '.shell{height:min(70vh,480px);display:flex;flex-direction:column;overflow:hidden}'
                    '.fields{overflow:auto;min-height:0;flex:1}label{display:block;margin:18px}'
                    'input{display:block;width:80%;height:44px}.actions{position:sticky;bottom:0;'
                    'background:white;min-height:120px;flex-shrink:0;display:flex;align-items:center;justify-content:center}'
                    '</style><dialog><form class="shell"><button type="button" class="close">Close</button>'
                    + body + (action if name == 'modal-clear' else '') + '</form></dialog>'
                    '<script>const d=document.querySelector("dialog"),t=document.querySelector("[data-open-modal]");'
                    't.onclick=()=>d.showModal();d.querySelector(".close").onclick=()=>d.close();'
                    'd.addEventListener("close",()=>t.focus());'
                    'd.addEventListener("keydown",e=>{if(e.key!=="Tab")return;'
                    'const f=[...d.querySelectorAll("button,input")],a=document.activeElement;'
                    'if(!e.shiftKey&&a===f.at(-1)){e.preventDefault();f[0].focus()}'
                    'else if(e.shiftKey&&a===f[0]){e.preventDefault();f.at(-1).focus()}});</script>'
                )
            (root / f'{name}.html').write_text(
                '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>Hero fixture</title><style>body{margin:0}h1{font-size:24px;margin:0}'
                f'h1{{font-family:{heading_font}}}{font_face}'
                f'body{{font-family:{body_font}}}'
                f'.hero{{height:{height}}}section+section{{height:200px}}a{{display:inline-block;padding:16px}}'
                '.label-row{position:relative}.category{position:absolute;left:0;top:0;margin:0}'
                f'.label-row h2{{margin:0 0 0 {label_offset};font-size:24px}}</style>'
                '<main><section class="hero"><h1>Local service</h1>'
                f'<p>{prose}</p>'
                + trigger + '</section>'
                '<section><div class="label-row"><p class="category">SPECIALIST ACCESS</p><h2>Service</h2></div></section></main>'
                + modal + '</html>'
            )
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            for source_name, source_report in [('visible', brand_path), ('font-loaded', root / 'loaded-brand.json')]:
                extraction = subprocess.run([
                    args.node, str(skill / 'scripts/extract_brand.mjs'),
                    f'http://127.0.0.1:{server.server_port}/{source_name}.html',
                    '--out', str(source_report), '--playwright-module', args.playwright_module,
                    '--browser-executable', args.browser_executable,
                ], capture_output=True, text=True, timeout=120)
                assert extraction.returncode == 0, extraction.stdout + extraction.stderr
            for name in cases:
                report_path = root / name / 'report.json'
                result = subprocess.run([
                    args.node, str(skill / 'scripts/measure_page.mjs'),
                    f'http://127.0.0.1:{server.server_port}/{name}.html',
                    '--out', str(report_path), '--playwright-module', args.playwright_module,
                    '--browser-executable', args.browser_executable,
                    '--brand-report', str(root / 'loaded-brand.json' if name in ['font-fallback', 'font-loaded'] else brand_path),
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
                assert all(c['renderedMatches'] == (name != 'font-fallback') for c in font_checks if c['role'] == 'heading'), font_checks
                assert all(c['matches'] == (name != 'font-drift') for c in font_checks if c['role'] == 'body'), font_checks
                assert any('body font differs' in w for w in report['warnings']) == (name == 'font-drift'), report['warnings']
                keyboard = [c for c in report['checks'] if c['name'] == 'modal_tab_focus_unobscured']
                if name.startswith('modal-'):
                    assert len(keyboard) == 5, keyboard
                    expected_keyboard = 'blocked' if name == 'modal-covered' else 'pass'
                    assert all(c['status'] == expected_keyboard for c in keyboard), keyboard
                else:
                    assert not keyboard, keyboard
                assert (result.returncode == 0) == (name in ['visible', 'font-drift', 'modal-clear', 'font-loaded']), report['failures']
        finally:
            server.shutdown()
            server.server_close()
    print('PASS: eight hero, text, CSS/rendered-font and modal keyboard fixtures at all five viewports')


if __name__ == '__main__':
    main()
