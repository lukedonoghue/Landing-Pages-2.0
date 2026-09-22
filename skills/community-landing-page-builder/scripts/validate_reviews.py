#!/usr/bin/env python3
"""Validate current review intelligence, testimonial provenance and rendered use."""
from pathlib import Path
import argparse
import json
import sys
import review_workflow

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    parser.add_argument("--expected-fingerprint")
    parser.add_argument("--no-render", action="store_true")
    args = parser.parse_args()
    result = review_workflow.audit_project(
        args.project_root.expanduser().resolve(),
        args.expected_fingerprint,
        rendered=not args.no_render,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["status"] == "blocked" else 0

if __name__ == "__main__":
    sys.exit(main())
