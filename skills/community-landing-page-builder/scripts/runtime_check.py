#!/usr/bin/env python3
"""Inspect local build capabilities without installing tools or reading credentials."""
from __future__ import annotations

import argparse
import importlib.metadata
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

SKILL = Path(__file__).resolve().parents[1]
NODE_MINIMUM = (22, 19, 0)


def supported_node(version):
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?", version.strip())
    return bool(match and tuple(map(int, match.groups())) >= NODE_MINIMUM)


def node_path(requested=None):
    candidate = requested or os.environ.get("FUNNEL_NODE") or shutil.which("node")
    if not candidate:
        return None
    resolved = shutil.which(str(candidate))
    return str(Path(resolved or candidate).expanduser().absolute())


def run_env(node=None):
    env = dict(os.environ)
    if node:
        env["PATH"] = str(Path(node).parent) + os.pathsep + env.get("PATH", "")
    env["WRANGLER_SEND_METRICS"] = "false"
    return env


def probe(command, cwd=None, timeout=30):
    try:
        result = subprocess.run(command, cwd=cwd, text=True, capture_output=True,
                                timeout=timeout, env=run_env(command[0] if command else None))
        return result.returncode, result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return 1, ""


def inspect(project=None, node=None, launch_browsers=True):
    project = Path(project or SKILL / "assets/cloudflare").expanduser().resolve()
    node = node_path(node)
    checks = []

    def add(name, ready, detail, action):
        checks.append({"name": name, "status": "ready" if ready else "missing",
                       "detail": detail, "action": "" if ready else action})

    add("Python", sys.version_info >= (3, 10), sys.version.split()[0],
        "Use Python 3.10 or newer. A supported bundled runtime is also suitable.")
    add("Operating system", sys.platform in {"darwin", "linux"}, sys.platform,
        "The initial local helper supports macOS/Linux. Other hosts need a tested runtime adapter.")
    for package in ("reportlab", "Pillow"):
        try:
            version = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            version = ""
        add(package, bool(version), version or "Not installed in this Python environment",
            "Run the quickstart bootstrap, or install requirements-build.txt in a private virtual environment.")

    try:
        directory = SKILL / 'assets/pdf-fonts'
        manifest = json.loads((directory / 'provenance.json').read_text())
        fonts_ok = all(hashlib.sha256((directory / name).read_bytes()).hexdigest() == manifest['files'][name]
                       for name in ('DejaVuSans.ttf','DejaVuSans-Bold.ttf','LICENSE'))
    except (OSError,ValueError,KeyError,TypeError):
        fonts_ok = False
    add('Bundled PDF fonts', fonts_ok, 'Font and license hashes match' if fonts_ok else 'Font assets are missing or changed',
        'Reinstall the complete skill including assets/pdf-fonts. Custom client fonts belong in catalogue configuration, not in the shared defaults.')

    code, version = probe([node, "--version"]) if node else (1, "")
    node_ok = code == 0 and supported_node(version)
    add("Node.js", node_ok, version or "Not found",
        "Use Node 24 (minimum 22.19). Set FUNNEL_NODE or pass --node to use an available runtime.")
    npm = shutil.which("npm", path=run_env(node).get("PATH")) if node else None
    add("npm", bool(npm), "Found" if npm else "Not found", "Install npm with the supported Node runtime.")

    for binary, label in (("cwebp", "WebP optimizer"), ("pdftoppm", "PDF renderer"),
                          ("pdftotext", "PDF text extraction"), ("pdffonts", "PDF font inspection"),
                          ("pdftohtml", "PDF navigation inspection")):
        found = shutil.which(binary)
        add(label, bool(found), found or "Not found",
            "macOS: brew install webp poppler. Ubuntu/Debian: install webp and poppler-utils using the system package manager.")

    package_file = project / "package.json"
    lock_file = project / "package-lock.json"
    dependencies_ok = all((project / "node_modules" / name / "package.json").is_file()
                          for name in ("wrangler", "playwright-core", "miniflare", "esbuild", "lighthouse"))
    add("Application dependencies", package_file.is_file() and lock_file.is_file() and dependencies_ok,
        "Installed" if dependencies_ok else "Locked application dependencies need installation",
        "Run quickstart bootstrap, or npm ci in the generated project/template directory.")

    browser_results = {}
    if node_ok and dependencies_ok:
        script = """
const {createRequire} = require('node:module');
const fs = require('node:fs');
(async () => {
 const req = createRequire(process.argv[1]);
 const {chromium, webkit} = req('playwright-core');
 const result = {};
 for (const [name, engine] of Object.entries({chromium, webkit})) {
  try {
   const executable = engine.executablePath();
   fs.accessSync(executable, fs.constants.X_OK);
   if (process.argv[2] === 'launch') { const browser = await engine.launch({headless:true}); await browser.close(); }
   result[name] = {ready:true, detail:process.argv[2] === 'launch' ? 'Installed and launches' : 'Executable exists'};
  } catch { result[name] = {ready:false, detail:'Missing executable or required browser runtime libraries'}; }
 }
 console.log(JSON.stringify(result));
})().catch(() => { process.exitCode = 1; });
"""
        code, stdout = probe([node, "-e", script, str(package_file), "launch" if launch_browsers else "files"], timeout=60)
        if code == 0:
            try:
                browser_results = json.loads(stdout)
            except ValueError:
                pass
    for engine in ("chromium", "webkit"):
        result = browser_results.get(engine, {})
        add(engine.title(), result.get("ready", False),
            result.get("detail", "Cannot inspect until Node and application dependencies are ready"),
            "Run npx playwright-core install chromium webkit in the project. On Linux, install the browser OS libraries too (the supported Playwright --with-deps option).")

    ready = all(item["status"] == "ready" for item in checks)
    return {"schema_version": 1, "scope": "local_build_tools", "status": "ready" if ready else "blocked",
            "project": str(project), "python": sys.executable, "node": node, "checks": checks,
            "agent_capabilities": {
                "research": "The agent must verify source access when researching the supplied site.",
                "visual_review": "The agent must actually inspect rendered pages and PDF images.",
                "image_generation": "Verify the chosen tool/model when needed; no image API was called by this check.",
                "cloudflare": "Not required for local work. Verify the intended account when publication is requested."
            }}


def display(report):
    print("Local build tools: " + report["status"])
    for item in report["checks"]:
        print(f"  {'OK' if item['status'] == 'ready' else 'NEEDS SETUP'} - {item['name']}: {item['detail']}")
        if item["action"]:
            print("    " + item["action"])
    print("Research, visual review, image-model access and Cloudflare access are separate agent/account checks.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path)
    parser.add_argument("--node")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--no-browser-launch", action="store_true",
                        help="Check browser executable presence only; does not prove runtime libraries work.")
    args = parser.parse_args()
    report = inspect(args.project, args.node, not args.no_browser_launch)
    print(json.dumps(report, indent=2)) if args.json else display(report)
    return 0 if report["status"] == "ready" else 1


if __name__ == "__main__":
    raise SystemExit(main())
