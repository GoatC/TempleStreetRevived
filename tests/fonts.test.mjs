// 網站上的字都要在子集化字型裡（HANDOFF §5）。改了文字卻忘了跑 python3 tools/subset-fonts.py，
// 新字會悄悄換成手機內建字體；這個測試會擋下部署，並列出缺的字。
// 只用 Node 內建的 brotli 讀 WOFF2 的 cmap，不需要 Python。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// WOFF2 → 字型裡有字形的 Unicode 碼位
function woff2Codepoints(file) {
  const buf = readFileSync(file);
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2', file);
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
  let p = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[p++];
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error('bad UIntBase128');
  };
  let offset = 0, cmap = null;
  for (let t = 0; t < numTables; t++) {
    const flags = buf[p++];
    let tag = KNOWN[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', p, p + 4); p += 4; }
    const version = flags >> 6;
    const origLength = base128();
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    const length = transformed ? base128() : origLength;
    if (tag === 'cmap') cmap = { offset, length };
    offset += length;
  }
  assert.ok(cmap, 'no cmap in ' + file);
  const data = brotliDecompressSync(buf.subarray(p, p + compressedSize));
  const c = data.subarray(cmap.offset, cmap.offset + cmap.length);
  const cps = new Set();
  const n = c.readUInt16BE(2);
  const subs = [];
  for (let i = 0; i < n; i++) subs.push({ pid: c.readUInt16BE(4 + i * 8), eid: c.readUInt16BE(6 + i * 8), off: c.readUInt32BE(8 + i * 8) });
  for (const s of subs) {
    if (s.pid !== 3 && s.pid !== 0) continue;
    const format = c.readUInt16BE(s.off);
    if (format === 12) {
      const groups = c.readUInt32BE(s.off + 12);
      for (let g = 0; g < groups; g++) {
        const at = s.off + 16 + g * 12;
        for (let cp = c.readUInt32BE(at); cp <= c.readUInt32BE(at + 4); cp++) cps.add(cp);
      }
    } else if (format === 4) {
      const segX2 = c.readUInt16BE(s.off + 6);
      const ends = s.off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let k = 0; k < segX2; k += 2) {
        const end = c.readUInt16BE(ends + k), start = c.readUInt16BE(starts + k);
        const delta = c.readInt16BE(deltas + k), ro = c.readUInt16BE(ranges + k);
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
          let gid;
          if (ro === 0) gid = (cp + delta) & 0xffff;
          else {
            const g = c.readUInt16BE(ranges + k + ro + (cp - start) * 2);
            gid = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (gid !== 0) cps.add(cp);
        }
      }
    }
  }
  return cps;
}

// 和 tools/subset-fonts.py 一樣：site/ 底下的 html、js、json、css 裡出現的每個字
function siteChars() {
  const chars = new Set();
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'fonts') walk(p); continue; }
      if (!['.html', '.js', '.json', '.css'].includes(extname(name))) continue;
      for (const ch of readFileSync(p, 'utf8')) if (ch.codePointAt(0) >= 0x20) chars.add(ch);
    }
  };
  walk(join(ROOT, 'site'));
  return chars;
}

for (const name of ['GenRyuMinTW-Regular', 'GenRyuMinTW-Bold']) {
  test(`字型子集包含網站上所有的字：${name}`, () => {
    const subset = woff2Codepoints(join(ROOT, 'site/assets/fonts', name + '.woff2'));
    const full = woff2Codepoints(join(ROOT, 'assets-src/fonts', name + '.woff2'));
    // 原始字型本來就沒有的字（例如特殊符號），子集化也補不回來，不算
    const missing = [...siteChars()].filter(ch => full.has(ch.codePointAt(0)) && !subset.has(ch.codePointAt(0)));
    assert.deepEqual(missing, [], `字型缺字：${missing.join('')}（請執行 python3 tools/subset-fonts.py）`);
  });
}
