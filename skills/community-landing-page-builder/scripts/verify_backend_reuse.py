"""Detect unintended rewrites or outdated copies of the shared CRM core."""
import argparse
import hashlib
import json
from pathlib import Path


def admin_files(root):
    base = root / 'public/admin'
    return {p.relative_to(root) for p in base.rglob('*') if p.is_file()} if base.is_dir() else set()


def verify(project, template):
    # Every CRM file (any depth or type under admin/) and both CRM shells: an edited
    # shell or an extra admin file can load unreviewed script on the CRM origin.
    paths = sorted({p.relative_to(template) for pattern in
        ('src/*.js', 'migrations/*.sql', 'public/login.html', 'public/account-action.html',
         'public/login.js', 'public/login.css', 'public/account-action.js')
        for p in template.glob(pattern)} | admin_files(template) | {Path(p) for p in
        ('public/funnel.js', 'public/privacy-controls.js', 'public/privacy-controls.css')})
    paths += sorted(admin_files(project) - set(paths))
    files = []
    for relative in paths:
        source, target = template / relative, project / relative
        expected = hashlib.sha256(source.read_bytes()).hexdigest() if source.is_file() else None
        actual = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() and not target.is_symlink() else None
        files.append({'path': relative.as_posix(), 'expected_sha256': expected,
                      'actual_sha256': actual, 'matches': actual == expected})
    return {'status': 'pass' if all(item['matches'] for item in files) else 'blocked',
            'files': files, 'limits': 'Code identity only. Configuration, UI integration and persisted attribution still need their own tests.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = verify(args.project.resolve(), Path(__file__).resolve().parents[1] / 'assets/cloudflare')
    output = json.dumps(report, indent=2) + '\n'
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output)
    print(output)
    return report['status'] != 'pass'


if __name__ == '__main__':
    raise SystemExit(main())
