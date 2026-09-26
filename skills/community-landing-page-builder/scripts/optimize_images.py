#!/usr/bin/env python3
"""Create deterministic responsive WebP variants with cwebp."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def normalized_input(source: Path) -> tuple[Path, Path | None]:
    """cwebp cannot read CMYK or unusual JPEG/PNG modes; convert a copy to RGB(A) PNG.

    The original stays byte-identical for provenance; only the encoder input changes.
    """
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return source, None
    with Image.open(source) as image:
        if image.mode in {"RGB", "RGBA", "L"} and image.format in {"JPEG", "PNG", "WEBP"}:
            return source, None
        converted = ImageOps.exif_transpose(image)
        profile = image.info.get("icc_profile")
        if converted.mode == "CMYK" and profile:
            try:
                import io
                from PIL import ImageCms
                converted = ImageCms.profileToProfile(converted, io.BytesIO(profile), ImageCms.createProfile("sRGB"), outputMode="RGB")
            except Exception:
                converted = converted.convert("RGB")
        converted = converted.convert("RGBA" if "A" in converted.getbands() or converted.mode in {"P", "LA"} else "RGB")
        converted.info.pop("icc_profile", None)
        handle = tempfile.NamedTemporaryFile(prefix="optimize-", suffix=".png", delete=False)
        handle.close()
        temporary = Path(handle.name)
        converted.save(temporary, format="PNG", icc_profile=None)
        return temporary, temporary


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
    encoder_input, temporary = normalized_input(source)
    generated: list[dict[str, object]] = []
    for width in widths:
        target = output / f"{source.stem}-{width}.webp"
        subprocess.run(
            [cwebp, "-quiet", "-q", str(args.quality), "-resize", str(width), "0", str(encoder_input), "-o", str(target)],
            check=True,
        )
        generated.append({"path": str(target), "width": width, "bytes": target.stat().st_size})

    if temporary:
        temporary.unlink(missing_ok=True)
    print(json.dumps({"source": str(source), "generated": generated}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
