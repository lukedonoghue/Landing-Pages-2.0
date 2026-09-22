"""Locate and preserve the versioned skill used by a generated project.

The owner-only bundle is never public. Copying a CLI without its references and
scaffold templates is not a portable installation. Existing bundles are retained,
never silently overwritten with a different release.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile

BUNDLE = '.community-builder'
MANIFEST = 'runtime-manifest.json'
PARTS = ('SKILL.md', 'requirements-build.txt', 'scripts', 'references', 'assets', 'config', 'agents')
EXCLUDED = {'.git', '.secrets', '.wrangler', 'node_modules', '__pycache__', '.pytest_cache', '.venv', 'build', 'screenshots', 'test-results', 'playwright-report', BUNDLE}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def skill_root(script):
    parent = Path(script).resolve().parents[1]
    bundled = parent / BUNDLE
    if bundled.is_symlink():
        raise ValueError('The private builder runtime must not be a symlink')
    if (bundled / 'SKILL.md').is_file() and (bundled / MANIFEST).is_file():
        return bundled
    if (parent / 'SKILL.md').is_file():
        return parent
    raise ValueError('The project is missing its portable builder runtime. Re-scaffold from the installed community skill without overwriting client files.')


def bundle_runtime(source, project):
    source, project = Path(source).resolve(), Path(project).resolve()
    target = project / BUNDLE
    if target.is_symlink():
        raise ValueError('Refusing a symlinked builder runtime')
    if source == target:
        return target
    if target.exists():
        marker = target / MANIFEST
        if not target.is_dir() or not marker.is_file():
            raise ValueError('An unmanaged builder runtime exists; preserve it and reconcile before scaffolding')
        record = json.loads(marker.read_text())
        if record.get('schema_version') != 1 or not record.get('files'):
            raise ValueError('Invalid builder runtime manifest')
        for name, expected in record['files'].items():
            path = target / name
            if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(target) or sha(path) != expected:
                raise ValueError('Existing builder runtime was modified; do not overwrite it: ' + name)
        return target
    temp = Path(tempfile.mkdtemp(prefix='.community-builder-', dir=project))
    try:
        hashes = {}
        for part in PARTS:
            base = source / part
            entries = [base] if base.is_file() else sorted(base.rglob('*'))
            for path in entries:
                relative = path.relative_to(source)
                if any(p in EXCLUDED for p in relative.parts) or path.name.startswith(('.env', '.dev.vars')) or path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.db', '.sqlite', '.sqlite3'} or path.name in {'credentials.json', 'secrets.json'}:
                    continue
                # Reference search indexes are rebuildable; databases and journals
                # never belong in a portable source bundle. Keep normalized JSON.
                if any(path.name.lower().endswith(ext + suffix) for ext in ('.db', '.sqlite', '.sqlite3') for suffix in ('-wal', '-shm', '-journal')):
                    continue
                if path.is_symlink():
                    raise ValueError('Builder source contains a symlink: ' + str(relative))
                if not path.is_file():
                    continue
                destination = temp / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, destination)
                hashes[relative.as_posix()] = sha(destination)
        if 'SKILL.md' not in hashes or 'scripts/guide.py' not in hashes:
            raise ValueError('The source is not a complete community builder runtime')
        (temp / MANIFEST).write_text(json.dumps({'schema_version': 1, 'files': hashes}, indent=2) + '\n')
        os.replace(temp, target)
    finally:
        if temp.exists():
            shutil.rmtree(temp)
    return target
