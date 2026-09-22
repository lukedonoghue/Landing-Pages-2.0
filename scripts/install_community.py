#!/usr/bin/env python3
"""Install the current community skill and its native Codex/Claude profiles."""
from pathlib import Path
import runpy
import sys

scripts = Path(__file__).resolve().parents[1] / "skills/community-landing-page-builder/scripts"
sys.path.insert(0, str(scripts))
runpy.run_path(str(scripts / "install_native.py"), run_name="__main__")
