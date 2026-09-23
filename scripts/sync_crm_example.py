#!/usr/bin/env python3
"""Regenerate or compare the reusable CRM example against the maintained source."""
from pathlib import Path
import argparse, shutil, hashlib, json
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"skills/community-landing-page-builder/assets/cloudflare"
DEST=ROOT/"examples/crm-demo"
DIRS=("src","migrations","scripts","public","google-apps-script","pages-gateway","tests")
FILES=("package.json","package-lock.json","wrangler.jsonc","funnel.json",".gitignore")
def files():
    for name in DIRS:
        for p in sorted((SOURCE/name).rglob("*")):
            if p.is_file() and not p.is_symlink() and not {".secrets",".wrangler","node_modules","__pycache__"}.intersection(p.parts): yield p.relative_to(SOURCE)
    for name in FILES:
        if (SOURCE/name).is_file(): yield Path(name)
def main(check=False):
    manifest={str(p):hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in files()}
    if check:
        stale=[p for p,h in manifest.items() if not (DEST/p).is_file() or hashlib.sha256((DEST/p).read_bytes()).hexdigest()!=h]
        extras=[str(p.relative_to(DEST)) for name in DIRS for p in (DEST/name).rglob("*") if p.is_file() and str(p.relative_to(DEST)) not in manifest]
        stale.extend(extras)
        if stale:raise SystemExit("CRM example differs from maintained source: "+", ".join(stale))
        return
    for name in DIRS:
        if (DEST/name).exists():shutil.rmtree(DEST/name)
    for rel in files():
        (DEST/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(SOURCE/rel,DEST/rel)
    (DEST/"source-manifest.json").write_text(json.dumps({"source":"skills/community-landing-page-builder/assets/cloudflare","files":manifest},indent=2)+"\n")
    (DEST/"README.md").write_text("# Maintained CRM example\n\nGenerated from the maintained community skill; never copy an older example over it. Run `python scripts/sync_crm_example.py` at the repository root after changing the template, and `--check` in CI. All checked-in configuration is generic. No client domains, credentials, lead data or production deployments are included.\n\nFor secure Google Sheets setup and the required operator rollout, read the skill references `google-sheets.md` and `security-operations.md`. The old token-based connector must be upgraded, not silently enabled. Identity-attribution migrations 0009/0010 from the former example branch remain a separate reviewed feature. Do not deploy an old example branch.\n")
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--check",action="store_true");main(parser.parse_args().check)
