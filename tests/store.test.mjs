// 進度儲存（HANDOFF §8）：兩場分開、重新開始只清一場、壞掉的存檔不會讓畫面空白。
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, peek, sanitize, levelState, KEYS } from '../site/assets/js/store.js';

// Node 沒有 localStorage：用一個簡單的假的
function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
  };
}
beforeEach(() => { globalThis.localStorage = fakeStorage(); });

test('兩場各存各的；重新開始只清這一場', () => {
  const y = createStore('youth');
  const f = createStore('family');
  y.update(s => { s.team = '廟口探險隊'; levelState(s, 1, 4).results[0] = 'self'; });
  f.update(s => { s.team = '妙妙一家人'; });
  assert.equal(peek('youth').team, '廟口探險隊');
  assert.equal(peek('family').team, '妙妙一家人');
  y.reset();
  assert.equal(peek('youth'), null);
  assert.equal(peek('family').team, '妙妙一家人');
  assert.equal(y.state.team, '');
});

test('重新開啟時讀回存檔', () => {
  createStore('youth').update(s => { s.team = '測試隊'; s.storySeen = true; });
  const again = createStore('youth');
  assert.equal(again.state.team, '測試隊');
  assert.equal(again.state.storySeen, true);
  assert.equal(again.persistent, true);
});

test('壞掉的存檔：不是 JSON、版本不對 → 當作新遊戲', () => {
  localStorage.setItem(KEYS.youth, 'garbage{');
  assert.equal(createStore('youth').state.team, '');
  localStorage.setItem(KEYS.youth, JSON.stringify({ v: 2, team: 'x' }));
  assert.equal(createStore('youth').state.team, '');
});

test('壞掉的存檔：缺欄位的關卡／NPC 丟掉，其餘保留', () => {
  localStorage.setItem(KEYS.family, JSON.stringify({
    v: 1, team: '妙妙一家人',
    levels: { 1: {}, 2: { results: ['self', null] }, 3: null },
    npc: { A: {}, B: { results: ['self'], drafts: 'oops' } },
  }));
  const s = createStore('family').state;
  assert.equal(s.team, '妙妙一家人');
  assert.deepEqual(Object.keys(s.levels), ['2']);
  assert.deepEqual(s.levels[2].drafts, {});
  assert.equal(s.levels[2].hints, 0);
  assert.deepEqual(Object.keys(s.npc), ['B']);
  assert.deepEqual(s.npc.B.drafts, {});
  assert.equal(sanitize({ v: 1, levels: [], npc: 'x' }).levels.constructor, Object);
});

test('不能存檔的瀏覽器：照樣可以玩（存在記憶體）', () => {
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const y = createStore('youth');
  assert.equal(y.persistent, false);
  y.update(s => { s.team = '記憶體隊'; });
  assert.equal(y.state.team, '記憶體隊');
});
