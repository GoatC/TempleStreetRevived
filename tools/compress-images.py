#!/usr/bin/env python3
"""把青年場的地圖與附圖壓成 WebP，放到 site/assets/img/。原圖換過就重跑。

用法：tools/.venv/bin/python tools/compress-images.py
需要 Pillow：tools/.venv/bin/pip install Pillow

- 長邊縮到 1600 px（原圖比較小就保持原尺寸，不放大）。
- 地圖和附圖要能放大看清楚小字（HANDOFF §5），壓完請親眼看一次生肖沖煞表。
"""
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('需要 Pillow：tools/.venv/bin/pip install Pillow，再用 tools/.venv/bin/python 執行。')

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'img'
OUT = ROOT / 'site' / 'assets' / 'img'

LONG_EDGE = 1600
QUALITY = 82

FILES = [
    'youth-map.png',
    'youth-L1-zodiac-chart.jpg',
    'youth-L2-fig1-shop-positions.jpg',
    'youth-L2-fig2-4x4-arrows.png',
]


def kb(n):
    return f'{n / 1024:.0f} KB'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        src = SRC / name
        dst = OUT / (src.stem + '.webp')
        with Image.open(src) as im:
            im.load()
            w, h = im.size
            scale = min(1.0, LONG_EDGE / max(w, h))
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA' if 'A' in im.getbands() or 'transparency' in im.info else 'RGB')
            if scale < 1.0:
                im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
            im.save(dst, 'WEBP', quality=QUALITY, method=6)
            nw, nh = im.size
        print(f'{name:36s} {w}×{h} {kb(src.stat().st_size):>8s}  →  {dst.name:38s} {nw}×{nh} {kb(dst.stat().st_size):>8s}')


if __name__ == '__main__':
    main()
