#!/usr/bin/env python3
"""Create deterministic responsive WebP variants with cwebp."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--widths", default="480,960,1600")
    parser.add_argument("--quality", type=int, default=82)
    args = parser.parse_args()

    source = args.input.expanduser().resolve()
    output = args.output_dir.expanduser().resolve()
    cwebp = shutil.which("cwebp")
    if not cwebp:
        raise SystemExit("Required command not found: cwebp")
    if not source.is_file():
        raise SystemExit(f"Input image not found: {source}")

    widths = sorted({int(item) for item in args.widths.split(",") if item.strip()})
    output.mkdir(parents=True, exist_ok=True)
    generated: list[dict[str, object]] = []
    for width in widths:
        target = output / f"{source.stem}-{width}.webp"
        subprocess.run(
            [cwebp, "-quiet", "-q", str(args.quality), "-resize", str(width), "0", str(source), "-o", str(target)],
            check=True,
        )
        generated.append({"path": str(target), "width": width, "bytes": target.stat().st_size})

    print(json.dumps({"source": str(source), "generated": generated}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
