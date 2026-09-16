#!/usr/bin/env python3
"""Repository entry point for the portable skill quickstart."""
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.argv.extend(['--repository', str(ROOT)])
runpy.run_path(str(ROOT / 'skills/branded-lead-funnel-builder/scripts/quickstart.py'), run_name='__main__')
