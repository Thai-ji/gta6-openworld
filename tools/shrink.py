"""Turns the raw Chrome PNGs into the four JPEG screenshots the entry gate accepts.

Each image is cropped to the 1280x720 viewport, re-encoded as JPEG, and re-tried at a lower quality
until it fits under 256 KiB. Exits non-zero if an image still does not fit, so a broken capture never
sneaks into a submission.
"""
import sys
from pathlib import Path

from PIL import Image

MAX_BYTES = 262_144
WIDTH, HEIGHT = 1280, 720


SHOTS = [("cover", "01-cover"), ("onfoot", "02-action"), ("map", "03-progression"), ("title", "04-title")]


def main(raw_dir: Path, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    sources = [(raw_dir / f"{stem}.png", name) for stem, name in SHOTS if (raw_dir / f"{stem}.png").exists()]
    if len(sources) != 4:
        print(f"expected 4 raw pngs, found {len(sources)}", file=sys.stderr)
        return 1

    for source, name in sources:
        image = Image.open(source).convert("RGB")
        if image.width < WIDTH or image.height < HEIGHT:
            print(f"{source.name}: too small at {image.size}", file=sys.stderr)
            return 1
        image = image.crop((0, 0, WIDTH, HEIGHT))
        target = out_dir / f"{name}.jpg"
        size = 0
        for quality in (86, 82, 78, 74, 70, 66, 62):
            image.save(target, "JPEG", quality=quality, optimize=True, progressive=True)
            size = target.stat().st_size
            if size <= MAX_BYTES:
                print(f"{target.name}: {size} bytes at quality {quality}")
                break
        else:
            print(f"{target.name}: cannot get under {MAX_BYTES} bytes ({size})", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: shrink.py <raw-dir> <out-dir>", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main(Path(sys.argv[1]), Path(sys.argv[2])))