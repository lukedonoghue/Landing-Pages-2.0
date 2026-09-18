#!/usr/bin/env python3
"""Render the first PDF page to lightweight WebP cover variants."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def require(command: str) -> str:
    path = shutil.which(command)
    if not path:
        raise SystemExit(f"Required command not found: {command}")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--sizes", default="320,600", help="Comma-separated output widths")
    parser.add_argument("--quality", type=int, default=84)
    args = parser.parse_args()

    pdf = args.pdf.expanduser().resolve()
    output = args.output_dir.expanduser().resolve()
    if not pdf.is_file():
        raise SystemExit(f"PDF not found: {pdf}")

    pdftoppm = require("pdftoppm")
    cwebp = require("cwebp")
    widths = sorted({int(value) for value in args.sizes.split(",") if value.strip()})
    output.mkdir(parents=True, exist_ok=True)
    generated: list[dict[str, object]] = []

    with tempfile.TemporaryDirectory(prefix="catalogue-cover-") as temp:
        prefix = Path(temp) / "cover"
        subprocess.run(
            [pdftoppm, "-f", "1", "-singlefile", "-r", "150", "-png", str(pdf), str(prefix)],
            check=True,
        )
        source = prefix.with_suffix(".png")
        for width in widths:
            target = output / f"cover-{width}.webp"
            subprocess.run(
                [cwebp, "-quiet", "-q", str(args.quality), "-resize", str(width), "0", str(source), "-o", str(target)],
                check=True,
            )
            generated.append({"path": str(target), "width": width, "bytes": target.stat().st_size})

    print(json.dumps({"source": str(pdf), "generated": generated}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
