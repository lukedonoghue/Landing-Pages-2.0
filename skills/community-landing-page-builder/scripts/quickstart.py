#!/usr/bin/env python3
"""Local setup, checks and an owned fictional demo. Never deploys to Cloudflare."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid
import tempfile
from urllib.error import URLError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_check
from demo_project import SKILL, assert_demo, seed_sql, write_demo_sources, write_json

TEMPLATE = SKILL / "assets/cloudflare"


def run(command, cwd, node=None, label="Command", env=None, timeout=600):
    with subprocess.Popen([str(value) for value in command], cwd=cwd, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          env=env or runtime_check.run_env(node), start_new_session=True) as process:
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.communicate()
            if sys.exc_info()[0] is KeyboardInterrupt:
                raise
            raise ValueError(f"{label} exceeded its local time limit. Its owned process group was stopped; completed files were preserved.")
    if process.returncode:
        private = Path(cwd) / ".secrets"
        private.mkdir(exist_ok=True, parents=True, mode=0o700)
        log = private / "last-tool-error.log"
        fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(stdout + stderr)
        raise ValueError(f"{label} failed. Private diagnostic: {log}")
    return stdout + stderr


def require_node(requested):
    node = runtime_check.node_path(requested)
    code, version = runtime_check.probe([node, "--version"]) if node else (1, "")
    if code or not runtime_check.supported_node(version):
        raise ValueError("Use Node 24 (minimum 22.19); pass --node or set FUNNEL_NODE to the available runtime.")
    return node


def npm(node, arguments, project):
    executable = shutil.which("npm", path=runtime_check.run_env(node)["PATH"])
    if not executable:
        raise ValueError("npm is missing from the supported Node installation.")
    return run([executable, *arguments], project, node, "Dependency installation")


def bootstrap(node, project):
    """Install only local dependencies; OS tools are reported, never sudo-installed."""
    for name in ("package.json", "package-lock.json"):
        if not (project / name).is_file():
            raise ValueError("Bootstrap --project requires an existing generated project with package.json and package-lock.json. For a new demo, run bootstrap without --project, then demo --project <new-directory>.")
    python = Path(sys.executable)
    try:
        import reportlab
        import PIL
    except ImportError:
        environment = SKILL / ".venv"
        if environment.exists() and not (environment / "pyvenv.cfg").is_file():
            raise ValueError("An unrelated .venv directory exists; it was not modified.")
        subprocess.run([sys.executable, "-m", "venv", str(environment)], check=True)
        python = environment / "bin/python"
        run([python, "-m", "pip", "install", "-r", SKILL / "requirements-build.txt"],
            SKILL, label="Private Python environment setup")
    npm(node, ["ci"], project)
    executable = shutil.which("npx", path=runtime_check.run_env(node)["PATH"])
    if not executable:
        raise ValueError("npx is missing from the supported Node installation.")
    run([executable, "playwright-core", "install", "chromium", "webkit"], project, node, "Browser installation")
    print("Local dependencies installed. Run doctor next; OS image/PDF libraries and account capabilities are checked separately.")
    print("Python runtime:", python)


def ensure_ready(node, project=TEMPLATE):
    report = runtime_check.inspect(project, node)
    if report["status"] != "ready":
        runtime_check.display(report)
        raise ValueError("Local setup is incomplete. Resolve the listed setup items before continuing.")
    return report


def parse_node_summary(output):
    fields = {}
    for name in ("tests", "pass", "fail", "cancelled", "skipped"):
        match = re.search(r"^# " + name + r" (\d+)\s*$", output, re.M)
        if not match:
            raise ValueError("The test runner did not return a complete TAP summary.")
        fields[name] = int(match.group(1))
    if not fields["tests"] or fields["tests"] != fields["pass"] or any(fields[name] for name in ("fail", "cancelled", "skipped")):
        raise ValueError("Every application regression must run and pass; skipped tests are incomplete verification.")
    return fields


def check(node, repository=None):
    ensure_ready(node)
    suites = []
    if repository:
        repository = Path(repository).resolve()
        if (repository / "skills/community-landing-page-builder").resolve() != SKILL:
            raise ValueError("The repository test path does not match this skill.")
    if not (SKILL / "tests").is_dir():
        raise ValueError("Regression tests live in the skill repository; run check from a repository checkout.")
    output = run([sys.executable, "-m", "unittest", "discover", "-s", SKILL / "tests", "-p", "test_*.py"], SKILL, node, "skill tests")
    match = re.search(r"Ran (\d+) tests?", output)
    if not match or re.search(r"skipped[= ]", output, re.I):
        raise ValueError("skill: missing or skipped test results.")
    suites.append({"suite": "skill", "passed": int(match.group(1))})
    env = runtime_check.run_env(node)
    code, browser_path = runtime_check.probe(
        [node, "-e", "console.log(require('playwright-core').chromium.executablePath())"], TEMPLATE)
    if code:
        raise ValueError("Cannot select the installed Chromium browser.")
    env["CHROME_BIN"] = browser_path
    tests = sorted((TEMPLATE / "tests").glob("*.test.mjs"))
    output = run([node, "--test", "--test-reporter=tap", *tests], TEMPLATE, node, "Application regressions", env)
    suites.append({"suite": "application", "passed": parse_node_summary(output)["pass"]})
    return {"status": "pass", "suites": suites, "total_passed": sum(item["passed"] for item in suites),
            "scope": "repository regressions"}


@contextmanager
def demo_lock(project):
    import fcntl
    private = project / ".secrets"
    private.mkdir(exist_ok=True, mode=0o700)
    with (private / "demo.lock").open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError("This demo is already in use. Stop its quickstart server/verification before resetting or starting another.") from error
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def local_env(node):
    env = runtime_check.run_env(node)
    for key in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL"):
        env.pop(key, None)
    return env


def setup_database(project, node):
    assert_demo(project)
    run([node, "scripts/setup.mjs", "--admin-username", "owner"], project, node, "Local database setup", local_env(node))
    sql = project / "build/demo-seed.sql"
    sql.write_text(seed_sql())
    run([node, "node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--file", sql, "--yes"],
        project, node, "Synthetic database seeding", local_env(node))


def build_demo(project, node):
    ensure_ready(node)
    project = Path(project).expanduser().resolve()
    if (project / '.landing-pages-demo.json').is_file():
        assert_demo(project)
        for required in ['build/demo-catalogue.json', 'test-fixture.json', 'public/index.html']:
            if not (project / required).is_file():
                raise ValueError('The demo source is incomplete. Use a new demo directory; existing files were preserved.')
    else:
        project = write_demo_sources(project)
    npm(node, ["ci"], project)
    run([sys.executable, SKILL / "scripts/build_catalogue.py", "--config", project / "build/demo-catalogue.json",
         "--output", project / "public/assets/brochure/service-guide.pdf"], project, node, "Demo brochure generation")
    run([sys.executable, SKILL / "scripts/render_catalogue_cover.py", project / "public/assets/brochure/service-guide.pdf",
         project / "public/assets/brochure"], project, node, "Demo brochure cover")
    with demo_lock(project):
        setup_database(project, node)
    return {"status": "ready", "project": str(project), "kind": "fictional-local-demo",
            "username": "owner", "password_file": str(project / ".secrets/local-admin-password.txt"),
            "next": "serve or verify-demo", "publication": "disabled"}


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@contextmanager
def demo_server(project, node, port=None):
    project = assert_demo(project)
    with demo_lock(project):
        port = port or free_port()
        if not 1024 <= port <= 65535:
            raise ValueError("Use an unprivileged local port from 1024 to 65535.")
        build = project / "build"
        build.mkdir(exist_ok=True)
        with (project / ".secrets/demo-server.log").open("w") as log:
            process = subprocess.Popen([node, "node_modules/wrangler/bin/wrangler.js", "dev", "--local",
                                        "--ip", "127.0.0.1", "--port", str(port)],
                                       cwd=project, env=local_env(node), stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            url = f"http://127.0.0.1:{port}"
            try:
                deadline = time.monotonic() + 45
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise ValueError("Local server stopped. Inspect the private demo-server.log.")
                    try:
                        with urlopen(url + "/api/health", timeout=1) as response:
                            if json.load(response).get("ok") is True:
                                break
                    except (URLError, TimeoutError, OSError, ValueError):
                        time.sleep(0.2)
                else:
                    raise ValueError("The local server did not become healthy in time.")
                yield url, process
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()


def local_verification_access(project):
    """Resolve private local recovery references without exposing their values."""
    reference = project / '.secrets/current-local-admin-access.json'
    setup = project / '.secrets/local.json'
    initial = json.loads(setup.read_text()) if setup.is_file() else {'ADMIN_USERNAME': 'owner'}
    if not reference.is_file():
        return ['--password-file', '.secrets/local-admin-password.txt'], initial['ADMIN_USERNAME']
    value = json.loads(reference.read_text())
    config = json.loads((project / 'wrangler.jsonc').read_text())
    target = value.get('target', {})
    if value.get('needs_password') or target.get('mode') != 'local' or target.get('worker') != config.get('name') or target.get('database_id') != config['d1_databases'][0]['database_id']:
        raise ValueError('Current local owner credentials are missing or belong to another database. Resolve the private access reference before verification.')
    key = 'credentials_file' if value.get('credentials_file') else 'password_file'
    file = (project / value[key]).resolve()
    if not file.is_file():
        raise ValueError('The current local owner credential file is missing. Preserve the recovery operation and restore its private handoff.')
    return ['--' + key.replace('_', '-'), str(file)], value.get('username') or initial['ADMIN_USERNAME']


def verify_demo(project, node, full=False):
    project = assert_demo(project)
    required = ['build/page-copy.json', 'scripts/copy_parity.py', 'scripts/capture-rendered-copy.mjs']
    if any(not (project / name).is_file() for name in required):
        raise ValueError('This demo predates rendered-copy verification or has missing evidence. Generate a new demo directory with the current skill; existing source and local data were preserved.')
    ensure_ready(node, project)
    access_args, owner = local_verification_access(project)
    journey_output = 'build/live-verification/' + uuid.uuid4().hex
    with demo_server(project, node) as (url, _):
        # Brand/font research is a canonical source input, not a QA output.
        # Acquire it before the shared snapshot so every following check tests
        # the same source identity; do not refresh snapshots around stale QA.
        if full:
            run([node, "scripts/extract_brand.mjs", url, "--out", "build/brand.json"],
                project, node, "Rendered demo brand and font evidence")
        run([sys.executable, project / "scripts/check_gates.py", "snapshot", project, "--mode", "handoff"],
            project, node, "Source snapshot")
        run([node, "scripts/browser-compat.mjs", "--url", url, "--fixture", "test-fixture.json", "--project-root", "."],
            project, node, "Chromium and WebKit journey")
        run([sys.executable, "scripts/check_gates.py", "record", ".", "--gate", "browser_compat",
             "--report", "build/browser-compat/result.json"], project, node, "Record the newly executed browser checks")
        env = local_env(node)
        env["ADMIN_USERNAME"] = owner
        run([node, "scripts/live-verify.mjs", "--url", url, "--fixture", "test-fixture.json", "--allow-test-lead",
             *access_args, "--project-root", ".", "--out", journey_output],
            project, node, "Actual local form-to-CRM journey", env)
        run([sys.executable, "scripts/check_gates.py", "record", ".", "--gate", "local_journey",
             "--report", journey_output + "/local-journey.json"], project, node, "Local journey release evidence")
        run([node, "scripts/capture-rendered-copy.mjs", "--url", url, "--fixture", "test-fixture.json", "--project-root", "."],
            project, node, "Rendered copy capture without form writes")
        run([sys.executable, "scripts/copy_parity.py", "."], project, node, "Page and brochure copy comparison")
        run([sys.executable, "scripts/check_gates.py", "record", ".", "--gate", "rendered_copy",
             "--report", "build/rendered-copy/result.json"], project, node, "Rendered copy release evidence")
        if full:
            run([node, "scripts/measure_funnel.mjs", url, "--out", "build/layout/result.json",
                 "--project-root", ".", "--mode", "handoff", "--thank-you", "/thank-you.html"],
                project, node, "Nine-viewport layout verification")
            # Benchmark regression: the template hero must keep one unobscured action
            # fully above the fold at every viewport, as on the control page.
            hero = [w for w in json.loads((project / "build/layout/result.json").read_text()).get("warnings", []) if "above the fold" in w]
            if hero:
                raise ValueError("The benchmark hero regressed: " + "; ".join(hero))
            run([sys.executable, "scripts/check_gates.py", "record", ".", "--gate", "browser",
                 "--report", "build/layout/result.json"], project, node, "Record the newly measured layout")
            ci_profile = ['--isolated-ci-fixture'] if os.environ.get('CI') == 'true' else []
            run([node, "scripts/performance-audit.mjs", "--url", url, "--project-root", ".", *ci_profile],
                project, node, "Mobile performance audit")
            run([sys.executable, "scripts/check_gates.py", "record", ".", "--gate", "performance",
                 "--report", "build/performance/result.json"], project, node, "Record the newly measured performance")
    pdf_dir = project / "build/pdf"
    pdf_dir.mkdir(exist_ok=True)
    pdf = project / "public/assets/brochure/service-guide.pdf"
    run(["pdftoppm", "-scale-to", "1000", "-png", pdf, pdf_dir / "page"], project, node, "All brochure page renders")
    run(["pdftotext", pdf, pdf_dir / "text.txt"], project, node, "Brochure text extraction")
    extracted = (pdf_dir / "text.txt").read_text()
    if "Request your project guide" not in extracted or "Harbor Services" not in extracted:
        raise ValueError("The generated PDF did not preserve its core demo content.")
    compat = json.loads((project / "build/browser-compat/result.json").read_text())
    journey = json.loads((project / journey_output / "result.json").read_text())
    if compat["status"] != "pass" or journey.get("fully_verified") is not True:
        raise ValueError("Local integration is incomplete; inspect the reports.")
    progress = json.loads(run([sys.executable, "scripts/workflow.py", "resume", "."], project, node,
                              "Resume the verified local demo from its existing reports"))
    if progress.get('stage') != 'demo' or progress.get('publication') != 'disabled':
        raise ValueError('The fictional demo lost its workflow/publication boundary.')
    import portable_handoff
    with tempfile.TemporaryDirectory(prefix='funnel-handoff-smoke-') as temporary:
        archive = Path(temporary) / 'demo.zip'
        exported = portable_handoff.export_bundle(project, archive, 'Fictional portability test', in_progress=True)
        imported = portable_handoff.extract_archive(archive, Path(temporary) / 'receiver')
        if exported['source_fingerprint'] != imported['source_fingerprint']:
            raise ValueError('The portable demo changed its source identity.')
        import check_gates
        extracted_gates = check_gates.check(Path(imported['project']), 'handoff', Path(imported['project']) / 'build/gates.json')
        for gate in ('local_journey', 'rendered_copy', 'browser_compat'):
            if extracted_gates.get('gates', {}).get(gate, {}).get('status') not in {'pass','pass_with_warnings'}:
                raise ValueError('The portable demo lost current evidence: ' + gate)
    result = {"status": "pass", "scope": "synthetic local integration only",
              "handoff_roundtrip": "in-progress archive extracted with identical source and retained verified gates; not publishing approval",
              "workflow_stage": progress['stage'],
              "reused_reports": progress['registered_existing_reports'],
              "local_journey_gate": "recorded",
              "journey_report": journey_output + '/result.json',
              "rendered_copy_gate": "recorded",
              "browser_checks": len(compat["checks"]), "journey_checks": len(journey["checks"]),
              "full_layout_and_performance": full, "pdf_pages_rendered": len(list(pdf_dir.glob("page-*.png"))),
              "visual_review": "pending actual agent inspection; screenshots alone are not approval",
              "publication": "disabled", "reports": "build/", "synthetic_metrics_impact": "One test lead/visit remains after this run."}
    write_json(project / "build/demo-verification.json", result)
    return result


def reset_demo(project, node):
    project = assert_demo(project)
    with demo_lock(project):
        state = project / ".wrangler/state"
        backup = None
        private_state = [project / '.secrets/current-local-admin-access.json', project / '.secrets/account-recovery', project / '.secrets/journeys']
        if any(item.is_symlink() for item in private_state):
            raise ValueError('Private demo recovery paths must not be symlinks. Preserve them for inspection before reset.')
        if state.exists():
            backup = project / ".secrets/demo-backups" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            backup.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.move(str(state), str(backup))
        for item in private_state:
            if item.exists():
                if backup is None:
                    backup = project / '.secrets/demo-backups' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
                    backup.mkdir(parents=True, mode=0o700)
                shutil.move(str(item), str(backup / item.name))
        setup_database(project, node)
    return {"status": "ready", "previous_local_state_preserved": str(backup) if backup else None,
            "scope": "owned fictional local database only"}


def main():
    if len(sys.argv)>1 and sys.argv[1]=='ship':
        import ship
        return ship.main(sys.argv[2:])
    environment = SKILL / ".venv"
    python = environment / "bin/python"
    if python.is_file() and Path(sys.prefix).resolve() != environment.resolve():
        os.execv(str(python), [str(python), __file__, *sys.argv[1:]])
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["doctor", "bootstrap", "check", "demo", "serve", "verify-demo", "reset-demo", "verify", "preview"],
                        help="verify/preview act on a generated project (--project, default: current folder)")
    parser.add_argument("--node", help="Supported Node executable; otherwise FUNNEL_NODE or PATH.")
    parser.add_argument("--project", type=Path, help="Demo output for demo/serve/verify/reset; existing application for doctor/bootstrap. Omit when bootstrapping a new skill installation.")
    parser.add_argument("--repository", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--port", type=int)
    parser.add_argument("--full", action="store_true", help="Include the nine-viewport matrix and three-run Lighthouse audit.")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--mode", choices=["preview", "handoff"], default="preview", help="verify: evidence mode")
    parser.add_argument("--runs", type=int, default=1, help="verify: Lighthouse runs (1-5)")
    args = parser.parse_args()
    try:
        if args.command == "doctor":
            report = runtime_check.inspect(args.project, args.node)
            print(json.dumps(report, indent=2)) if args.json else runtime_check.display(report)
            return 0 if report["status"] == "ready" else 1
        if sys.platform not in {"darwin", "linux"}:
            raise ValueError("The initial local quickstart supports macOS/Linux. Use doctor to inspect capabilities; this host needs a tested adapter.")
        node = require_node(args.node)
        project = (args.project or Path.cwd() / ".development/demo").expanduser().resolve()
        if args.command == "bootstrap":
            bootstrap(node, args.project or TEMPLATE)
            return 0
        if args.command in {"verify", "preview"}:
            import project_verify
            target = (args.project or Path.cwd()).expanduser().resolve()
            ensure_ready(node, target)
            if args.command == "verify":
                result = project_verify.verify_project(target, node, args.mode, max(1, min(5, args.runs)), args.port)
                print(json.dumps(result, indent=2))
                return 0 if result["status"] == "pass" else 1
            with project_verify.project_server(target, node, args.port or 8788) as (url, process):
                print(f"Local preview: {url}\nPrivate lead inbox: {url}/login.html (password in .secrets/local-admin-password.txt)\nNothing is published. Press Ctrl+C to stop.", flush=True)
                process.wait()
            return 0
        if args.command == "check":
            result = check(node, args.repository)
        elif args.command == "demo":
            result = build_demo(project, node)
        elif args.command == "verify-demo":
            result = verify_demo(project, node, args.full)
        elif args.command == "reset-demo":
            result = reset_demo(project, node)
        else:
            ensure_ready(node, project)
            with demo_server(project, node, args.port or 8787) as (url, process):
                print(f"Fictional local demo: {url}\nAdmin: {url}/login.html\nUsername: owner\nPassword stays in {project}/.secrets/local-admin-password.txt\nPress Ctrl+C to stop.", flush=True)
                process.wait()
            return 0
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(json.dumps({"status": "blocked", "message": str(error)}))
        return 1
    except KeyboardInterrupt:
        print("Local demo stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
