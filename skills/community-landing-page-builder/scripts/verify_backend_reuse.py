"""Detect unintended rewrites or outdated copies of the shared CRM core."""
import argparse
import hashlib
import json
from pathlib import Path


def verify(project, template):
    paths = sorted({p.relative_to(template) for pattern in
        ('src/*.js', 'migrations/*.sql', 'public/admin/*.js', 'public/admin/*.css',
         'public/login.js', 'public/login.css', 'public/account-action.js')
        for p in template.glob(pattern)} | {Path(p) for p in
        ('public/funnel.js', 'public/privacy-controls.js', 'public/privacy-controls.css')})
    files = []
    for relative in paths:
        source, target = template / relative, project / relative
        expected = hashlib.sha256(source.read_bytes()).hexdigest()
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
