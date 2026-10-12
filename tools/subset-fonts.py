#!/usr/bin/env python3
"""把源流明體縮成只含網站用到的字（WOFF2）。內容改過就重跑。

用法：python3 tools/subset-fonts.py
需要 fonttools 和 brotli：python3 -m venv tools/.venv && tools/.venv/bin/pip install fonttools brotli
（沒有裝的話，這個腳本會自動改用 tools/.venv 裡的 Python。）
"""
import os, sys, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
VENV_PY = ROOT / 'tools' / '.venv' / 'bin' / 'python'

try:
    from fontTools import subset  # noqa: F401
    import brotli  # noqa: F401
except ImportError:
    if VENV_PY.exists() and pathlib.Path(sys.prefix).resolve() != VENV_PY.parent.parent.resolve():
        os.execv(str(VENV_PY), [str(VENV_PY), __file__, *sys.argv[1:]])
    sys.exit('需要 fonttools 和 brotli，請看檔案開頭的安裝說明。')

from fontTools import subset

SRC = ROOT / 'assets-src' / 'fonts'
OUT = ROOT / 'site' / 'assets' / 'fonts'
# site/ 是正式內容；design/ 是定稿畫面，一起掃可以確保還沒移植的文案也有字。
SCAN = [(ROOT / 'site', ('.html', '.js', '.json', '.css')), (ROOT / 'design', ('.html',))]
EXTRA = (
    ''.join(chr(c) for c in range(0x20, 0x7F))            # 英數與半形符號
    + ''.join(chr(c) for c in range(0xFF01, 0xFF5F))      # 全形英數與符號
    + '，。、；：？！「」『』（）《》〈〉…—～・·　％＋－＝／'
)

def collect():
    chars = set(EXTRA)
    for base, exts in SCAN:
        for p in base.rglob('*'):
            if p.suffix in exts and p.is_file() and 'fonts' not in p.parts:
                chars.update(p.read_text(encoding='utf-8', errors='ignore'))
    return ''.join(sorted(c for c in chars if ord(c) >= 0x20))

def main():
    text = collect()
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ('GenRyuMinTW-Regular', 'GenRyuMinTW-Bold'):
        src, dst = SRC / f'{name}.woff2', OUT / f'{name}.woff2'
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        font = subset.load_font(str(src), opts)
        s = subset.Subsetter(opts)
        s.populate(text=text)
        s.subset(font)
        subset.save_font(font, str(dst), opts)
        print(f'{dst.relative_to(ROOT)}  {dst.stat().st_size // 1024} KB')
    print(f'共 {len(text)} 個字元')

if __name__ == '__main__':
    main()
