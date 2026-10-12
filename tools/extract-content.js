// 從設計原型（design/*.dc.html）重新抽出題目資料到 site/content/*.json。
// Extract content data from the Design Component prototypes into JSON.
// 用法 Usage:  node tools/extract-content.js [designDir] [outDir]
// 預設 Defaults: design → site/content （不會動到 youth-story.json）
const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'design');
const out = process.argv[3] || path.join(__dirname, '..', 'site', 'content');
fs.mkdirSync(out, { recursive: true });

function scriptOf(file) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const m = src.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no script in ' + file);
  return m[1];
}
function load(file) {
  const code = scriptOf(file);
  const f = new Function('class DCLogic { constructor(){ this.props = {}; this.state = null; } setState(s){ this.state = Object.assign({}, this.state || {}, s); } }\n' + code + '\nreturn Component;');
  const C = f();
  return new C();
}
// pull a literal like `var base = [ ... ];` out of a function body and evaluate it
function literal(file, name) {
  const code = scriptOf(file);
  const start = code.indexOf('var ' + name + ' = [');
  if (start < 0) throw new Error(name + ' not found in ' + file);
  let i = code.indexOf('[', start), depth = 0, j = i;
  for (; j < code.length; j++) {
    const ch = code[j];
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) break; }
    else if (ch === "'" ) { // skip string
      j++; while (j < code.length && code[j] !== "'") { if (code[j] === '\\') j++; j++; }
    }
  }
  return (new Function('return ' + code.slice(i, j + 1)))();
}
// 設計稿之後才另外加進 site/content 的可接受寫法（例如 NPC A 問答三的「祂」、問答四的「福德祠」），
// 重新抽出時保留下來：同一題的 answer／contains 取聯集（設計稿的寫法在前），不會被設計稿悄悄洗掉。
const isStrList = a => Array.isArray(a) && a.every(x => typeof x === 'string');
function unionList(fresh, old) {
  const out = fresh.slice();
  old.forEach(x => { if (!out.includes(x)) out.push(x); });
  return out;
}
function keepExtras(fresh, old) {
  if (Array.isArray(fresh) && Array.isArray(old)) {
    return fresh.map((x, i) => (i < old.length ? keepExtras(x, old[i]) : x));
  }
  if (!fresh || !old || typeof fresh !== 'object' || typeof old !== 'object') return fresh;
  const out = {};
  for (const k of Object.keys(fresh)) {
    const f = fresh[k], o = old[k];
    if ((k === 'answer' || k === 'contains') && isStrList(f) && isStrList(o)) out[k] = unionList(f, o);
    else if (k === 'answer' && Array.isArray(f) && Array.isArray(o) && f.every(isStrList) && o.every(isStrList)) {
      out[k] = f.map((x, i) => (o[i] ? unionList(x, o[i]) : x));
    } else out[k] = keepExtras(f, o);
  }
  return out;
}
function save(name, data, note) {
  const prev = path.join(out, name);
  if (fs.existsSync(prev)) {
    try { data = keepExtras(data, JSON.parse(fs.readFileSync(prev, 'utf8')).data); } catch (e) { /* 舊檔壞掉就整個重寫 */ }
  }
  const body = { _source: note, data };
  fs.writeFileSync(path.join(out, name), JSON.stringify(body, null, 2) + '\n');
  console.log('wrote', name, Array.isArray(data) ? data.length + ' items' : '');
}

save('youth-levels.json', load('T08Level.dc.html').levels(), 'design/T08Level.dc.html → levels() — 青年場 6 關的題目、任務、答案、提示');
save('youth-level-keys.json', literal('T10Correct.dc.html', 'data'), 'design/T10Correct.dc.html → data — 青年場各關「本關答案」顯示文字');
save('youth-menu.json', { levels: literal('T06Menu.dc.html', 'base'), npcs: literal('T06Menu.dc.html', 'npcBase') }, 'design/T06Menu.dc.html → base / npcBase — 青年場關卡選單卡片');
save('youth-history.json', load('T11History.dc.html').data(), 'design/T11History.dc.html → data() — 青年場歷史補充（沿用親子場文字）');
save('family-levels.json', load('F07Level.dc.html').levels(), 'design/F07Level.dc.html → levels() — 親子場 7 關的任務、答案、提示、加分題');
save('family-menu.json', { levels: literal('F06Menu.dc.html', 'base'), npcs: literal('F06Menu.dc.html', 'npcBase') }, 'design/F06Menu.dc.html → base / npcBase — 親子場關卡選單卡片');
save('family-history.json', load('F11History.dc.html').data(), 'design/F11History.dc.html → data() — 親子場歷史介紹');
save('npc.json', load('FNpc.dc.html').npcs(), 'design/FNpc.dc.html → npcs() — 兩場共用的 3 個 NPC 任務');
