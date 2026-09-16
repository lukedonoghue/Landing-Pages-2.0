#!/usr/bin/env python3
"""Install this repository's skill without copying local runtimes or credentials."""
from pathlib import Path
import argparse
import hashlib
import os
import shutil
import tempfile

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination',type=Path)
    args=parser.parse_args()
    source=Path(__file__).resolve().parents[1]/'skills/branded-lead-funnel-builder'
    target=args.destination or Path(os.environ.get('CODEX_HOME',str(Path.home()/'.codex')))/'skills/branded-lead-funnel-builder'
    target=target.expanduser().resolve()
    skip={'node_modules','.wrangler','.git','.secrets','__pycache__','build','screenshots'}
    files=[p for p in source.rglob('*') if p.is_file() and not any(x in skip for x in p.relative_to(source).parts) and not p.name.startswith(('.env','.dev.vars'))]
    if target.exists():
        backup=Path(tempfile.mkdtemp(prefix='landing-pages-skill-backup-'))/target.name
        shutil.copytree(target,backup,ignore=shutil.ignore_patterns(*skip,'.env*','.dev.vars*'))
        print('Previous skill backed up:',backup)
    for item in files:
        dest=target/item.relative_to(source);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(item,dest)
        if hashlib.sha256(item.read_bytes()).digest()!=hashlib.sha256(dest.read_bytes()).digest():raise RuntimeError('Installation checksum mismatch')
    print(f'Installed and verified {len(files)} files: {target}')

if __name__=='__main__':main()
