#!/usr/bin/env python3
"""Repository entry point for community dependency setup, checks and local demos."""

from pathlib import Path
import runpy
import sys


root = Path(__file__).resolve().parents[1]
scripts = root / "skills/community-landing-page-builder/scripts"
sys.path.insert(0, str(scripts))
sys.argv.extend(["--repository", str(root)])
runpy.run_path(str(scripts / "quickstart.py"), run_name="__main__")
