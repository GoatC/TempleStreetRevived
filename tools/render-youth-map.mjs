// 把青年場地圖原始檔 assets-src/img/youth-map.svg 畫成 assets-src/img/youth-map.png（1050×1920）。
// 之後再跑 tools/compress-images.py 壓成 site/assets/img/youth-map.webp。
//
// 用法：node tools/render-youth-map.mjs
// 需要 Playwright（npm i -D playwright 或全域安裝）。字型和顏色直接用網站的 miao.css，
// 所以青年場地圖和親子場地圖（family.js 的 FAMILY_MAP_SVG）長得一樣。

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, 'site');
const SRC = join(ROOT, 'assets-src/img/youth-map.svg');
const OUT = join(ROOT, 'assets-src/img/youth-map.png');
const SCALE = 1.5; // 700×1280 的 viewBox → 1050×1920

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 試全域安裝的 */ }
  const req = createRequire(join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'x'));
  return req('playwright');
}

// {{STAR A 608 824}} → 和 ui.js 的 npcStar() 一樣的星號
const STAR = 'M0.0 -30.0L7.6 -10.5L28.5 -9.3L12.4 4.0L17.6 24.3L0.0 13.0L-17.6 24.3L-12.4 4.0L-28.5 -9.3L-7.6 -10.5Z';
const svg = readFileSync(SRC, 'utf8')
  .replace(/<!--[\s\S]*?-->\s*/, '')
  .replace(/\{\{STAR (\w) ([\d.]+) ([\d.]+)\}\}/g, (_, k, x, y) =>
    `<g class="npc-star" transform="translate(${x} ${y}) scale(1.2)"><path d="${STAR}"></path><text y="7">${k}</text></g>`);

const TYPES = { '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html' };
const server = createServer((req, res) => {
  if (req.url === '/render.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/miao.css">
<style>body { margin: 0; background: none; } .fmap { width: 700px !important; height: 1280px !important; }</style>${svg}`);
    return;
  }
  const file = normalize(join(SITE, decodeURIComponent(req.url.split('?')[0])));
  if (!file.startsWith(SITE)) { res.writeHead(403); res.end(); return; }
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 700, height: 1280 }, deviceScaleFactor: SCALE });
  await page.goto(`http://127.0.0.1:${server.address().port}/render.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(OUT, await page.locator('svg.fmap').screenshot());
  console.log('寫好了：assets-src/img/youth-map.png');
} finally {
  await browser.close();
  server.close();
}
