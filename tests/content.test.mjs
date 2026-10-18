// site/content/*.json 改壞（多一個逗號、少一個引號、欄位拼錯）時擋下部署，
// 免得整個場次一打開就顯示「載入失敗」。直接在 GitHub 網頁上改 JSON 時特別有用。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const DIR = new URL('../site/content/', import.meta.url);
const raw = f => readFileSync(new URL(f, DIR), 'utf8');

test('每個內容檔都是正確的 JSON', () => {
  for (const f of readdirSync(DIR).filter(x => x.endsWith('.json'))) {
    assert.doesNotThrow(() => JSON.parse(raw(f)), `${f} 不是正確的 JSON`);
  }
});

const data = f => JSON.parse(raw(f + '.json')).data;
const nonEmpty = (s, where) => assert.ok(typeof s === 'string' && s.trim(), `${where} 是空的`);

test('youth-story.json：序章與結局台詞', () => {
  const story = JSON.parse(raw('youth-story.json'));
  for (const part of ['prologue', 'ending']) {
    assert.ok(Array.isArray(story[part]), `youth-story.json 的 ${part} 要是陣列（[...]）`);
    story[part].forEach((line, i) => {
      assert.ok(line && typeof line === 'object', `${part} 第 ${i + 1} 段要是 { "speaker": …, "text": … }`);
      nonEmpty(line.text, `${part} 第 ${i + 1} 段的 text`);
      if ('speaker' in line) nonEmpty(line.speaker, `${part} 第 ${i + 1} 段的 speaker`);
    });
  }
});

for (const [ed, count] of [['youth', 6], ['family', 7]]) {
  test(`${ed}：關卡、選單、歷史的數量與欄位一致`, () => {
    const levels = data(`${ed}-levels`);
    const menu = data(`${ed}-menu`);
    const history = data(`${ed}-history`);
    assert.equal(levels.length, count, `${ed}-levels.json 要有 ${count} 關`);
    assert.equal(menu.levels.length, count, `${ed}-menu.json 要有 ${count} 張關卡卡片`);
    assert.equal(history.length, count, `${ed}-history.json 要有 ${count} 關`);
    levels.forEach((lv, i) => {
      const where = `${ed}-levels.json 第 ${i + 1} 關`;
      nonEmpty(lv.no, where + ' no');
      nonEmpty(lv.title, where + ' title');
      assert.ok(Array.isArray(lv.hints) && lv.hints.length === 2, where + ' 要有 2 則提示');
      lv.hints.forEach((h, k) => nonEmpty(h, `${where} 提示${k + 1}`));
      assert.ok(Array.isArray(lv.tasks) && lv.tasks.length > 0, where + ' 沒有任務');
      lv.tasks.forEach((t, k) => nonEmpty(t.title, `${where} 任務${k + 1} title`));
    });
    menu.levels.forEach((c, i) => {
      if ('n' in c) assert.equal(c.n, i + 1, `${ed}-menu.json 第 ${i + 1} 張卡片的 n`);
      nonEmpty(c.place, `${ed}-menu.json 第 ${i + 1} 張卡片 place`);
    });
    history.forEach((h, i) => {
      const where = `${ed}-history.json 第 ${i + 1} 關`;
      nonEmpty(h.title, where + ' title');
      nonEmpty(h.keyline, where + ' keyline');
      assert.ok(Array.isArray(h.answers) && h.answers.every(a => Array.isArray(a) && a.length === 2), where + ' answers 每一列要是 ["題目", "答案"]');
      assert.ok(Array.isArray(h.paras) && h.paras.length > 0, where + ' paras');
    });
    assert.deepEqual(menu.npcs.map(x => x.key), ['A', 'B', 'C'], `${ed}-menu.json 的 NPC 卡片`);
    // 照片路徑寫錯，卡片會變成破圖
    const photos = [...menu.npcs.map(x => x.photo), ...history.map(h => h.photo)].filter(Boolean);
    for (const src of photos) {
      assert.ok(existsSync(new URL(src, new URL(`../site/${ed}/`, import.meta.url))), `${ed}：找不到圖片 ${src}`);
    }
  });
}

test('youth-level-keys.json：每關一筆本關答案', () => {
  const keys = data('youth-level-keys');
  assert.equal(keys.length, 6);
  keys.forEach((k, i) => nonEmpty(k.key, `youth-level-keys.json 第 ${i + 1} 關 key`));
});

test('npc.json：三個 NPC，每題都有題型與標題', () => {
  const npcs = data('npc');
  assert.deepEqual(npcs.map(x => x.key), ['A', 'B', 'C']);
  for (const n of npcs) {
    nonEmpty(n.name, `NPC ${n.key} name`);
    n.tasks.forEach((t, i) => {
      assert.ok(['text', 'multi', 'photo', 'arrive'].includes(t.type), `NPC ${n.key} 任務${i + 1} 題型 ${t.type}`);
      nonEmpty(t.title, `NPC ${n.key} 任務${i + 1} title`);
      if (t.type === 'multi') assert.equal(t.answer.length, t.fields.length, `NPC ${n.key} 任務${i + 1} 每一格都要有答案`);
    });
  }
});
