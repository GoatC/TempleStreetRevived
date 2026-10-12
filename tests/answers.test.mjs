import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripYouth, stripNpc, normFamily, checkYouth, checkNpc, checkFamily } from '../site/assets/js/answers.js';

const load = f => JSON.parse(readFileSync(new URL(`../site/content/${f}.json`, import.meta.url), 'utf8')).data;
const youth = load('youth-levels');
const family = load('family-levels');
const npcs = load('npc');

// 全形化：英數與標點轉全形
const toFull = s => s.replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 65248));

test('normalizers: three rules differ on purpose', () => {
  assert.equal(stripYouth('２４'), '24');
  assert.equal(stripNpc('２４'), '２４');            // NPC 不轉全形數字
  assert.equal(stripYouth(' 天上，聖母！ '), '天上聖母');
  assert.equal(stripNpc('潮江寺。'), '潮江寺');
  assert.equal(normFamily('媽 祖。'), '媽祖');
  assert.equal(normFamily('媽祖！'), '媽祖！');        // 親子場不去掉驚嘆號
  assert.equal(stripYouth(null), '');
});

test('youth: every accepted answer passes, with spaces / full-width variants', () => {
  for (const L of youth) L.tasks.forEach((t, i) => {
    const name = `${L.no} 任務${i + 1}`;
    if (t.type === 'text' || t.type === 'number') {
      for (const a of t.answer) {
        assert.ok(checkYouth(t, { text: a }).ok, `${name} ${a}`);
        assert.ok(checkYouth(t, { text: ` ${a.split('').join(' ')}。` }).ok, `${name} spaced ${a}`);
        assert.ok(checkYouth(t, { text: toFull(a) + '！' }).ok, `${name} full-width ${a}`);
      }
      assert.ok(!checkYouth(t, { text: '錯誤答案' }).ok, `${name} wrong`);
      assert.ok(checkYouth(t, { text: '  ' }).empty, `${name} empty`);
    } else if (t.type === 'fields') {
      const n = t.fields.length;
      const maxAlt = Math.max(...t.fields.map(f => f.answer.length));
      for (let j = 0; j < maxAlt; j++) {
        const vals = t.fields.map(f => f.answer[Math.min(j, f.answer.length - 1)]);
        assert.ok(checkYouth(t, { vals }).ok, `${name} alt ${j}`);
        assert.ok(checkYouth(t, { vals: vals.map(v => ' ' + toFull(v) + '、') }).ok, `${name} variant ${j}`);
      }
      const good = t.fields.map(f => f.answer[0]);
      for (let k = 0; k < n; k++) {
        const vals = good.slice(); vals[k] = '錯';
        const r = checkYouth(t, { vals });
        assert.ok(!r.ok && !r.empty, `${name} wrong field ${k}`);
        assert.deepEqual(r.bad, good.map((_, x) => x === k), `${name} marks only field ${k}`);
      }
      const partial = good.slice(); partial[n - 1] = '';
      assert.ok(checkYouth(t, { vals: partial }).empty, `${name} empty`);
    } else if (t.type === 'select') {
      assert.ok(checkYouth(t, { vals: t.answer.slice() }).ok, name);
      const swapped = t.answer.slice(); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      assert.deepEqual(checkYouth(t, { vals: swapped }).bad, [true, true, false, false, false]);
      assert.ok(checkYouth(t, { vals: ['', ...t.answer.slice(1)] }).empty);
    } else if (t.type === 'order') {
      assert.ok(checkYouth(t, { order: t.answer.slice() }).ok, name);
      assert.ok(!checkYouth(t, { order: t.answer.slice().reverse() }).ok, `${name} reversed`);
      assert.ok(checkYouth(t, { order: t.answer.slice(0, 4) }).empty, `${name} not full`);
    } else if (t.type === 'choice') {
      assert.ok(checkYouth(t, { choice: t.answer }).ok, name);
      for (const [code] of t.options) if (code !== t.answer) assert.ok(!checkYouth(t, { choice: code }).ok);
      assert.ok(checkYouth(t, {}).empty);
    } else {
      assert.fail(`${name}: unknown type ${t.type}`);
    }
  });
});

test('youth: design error example T08L4Error (米市興旺 is wrong)', () => {
  const t = youth[3].tasks[1];
  assert.ok(!checkYouth(t, { text: '米市興旺' }).ok);
  assert.ok(checkYouth(t, { text: '米市興盛' }).ok);
});

test('npc: every accepted answer passes; homophones fail', () => {
  for (const n of npcs) n.tasks.forEach((t, i) => {
    const name = `NPC ${n.key} 任務${i + 1}`;
    if (t.type === 'text') {
      for (const a of t.answer) {
        assert.ok(checkNpc(t, { text: a }).ok, `${name} ${a}`);
        assert.ok(checkNpc(t, { text: ` ${a}！` }).ok, `${name} punct ${a}`);
      }
      assert.ok(!checkNpc(t, { text: '錯誤答案' }).ok);
      assert.ok(checkNpc(t, { text: '' }).empty);
    } else if (t.type === 'multi') {
      assert.ok(checkNpc(t, { fields: [t.answer[0][0], t.answer[1][0]] }).ok, name);
      assert.ok(checkNpc(t, { fields: ['', t.answer[1][0]] }).empty);
    }
  });
  // FNpcAField：福德寺／朝江寺 → 樁尾錯
  const r = checkNpc(npcs[0].tasks[3], { fields: ['福德寺', '朝江寺'] });
  assert.ok(!r.ok);
  assert.deepEqual(r.bad, [false, true]);
  // 「他」「祂」都算對（Hugo 2026-10-12）
  assert.ok(checkNpc(npcs[0].tasks[2], { text: '因為面對米市街，祂是商業神' }).ok);
  assert.ok(checkNpc(npcs[0].tasks[2], { text: '因為面對米市街他是商業神' }).ok);
});

test('family: every accepted answer passes', () => {
  for (const L of family) L.tasks.forEach((t, i) => {
    const name = `${L.no} 任務${i + 1}`;
    if (t.type === 'text') {
      for (const a of t.answer || []) {
        assert.ok(checkFamily(t, { text: a }).ok, `${name} ${a}`);
        assert.ok(checkFamily(t, { text: ` ${a}。` }).ok, `${name} spaced ${a}`);
      }
      for (const c of t.contains || []) {
        assert.ok(checkFamily(t, { text: c }).ok, `${name} ${c}`);
        assert.ok(checkFamily(t, { text: `是${c}啦` }).ok, `${name} contains ${c}`);
      }
      assert.ok(!checkFamily(t, { text: '不知道' }).ok, `${name} wrong`);
      assert.ok(checkFamily(t, { text: ' ' }).empty);
    } else if (t.type === 'number') {
      assert.ok(checkFamily(t, { digits: String(t.answer) }).ok, name);
      assert.ok(!checkFamily(t, { digits: String(Number(t.answer) + 1) }).ok);
      assert.ok(checkFamily(t, { digits: '' }).empty);
    } else if (t.type === 'choice') {
      assert.ok(checkFamily(t, { choice: t.answer }).ok, name);
      for (const [code] of t.options) if (code !== t.answer) assert.ok(!checkFamily(t, { choice: code }).ok);
    } else if (t.type === 'multi') {
      const a = t.answer[0][0], b = t.answer[1][0];
      assert.ok(checkFamily(t, { fields: [a, b] }).ok, name);
      assert.equal(checkFamily(t, { fields: [b, a] }).ok, !!t.anyOrder, `${name} swapped`);
      assert.ok(checkFamily(t, { fields: [a, ''] }).empty);
    } else {
      assert.equal(t.type, 'photo', name);
    }
  });
});

test('family: design error example F07MishiNumber (6 boats is wrong)', () => {
  const t = family[3].tasks[1];
  assert.equal(t.unit, '艘');
  assert.ok(!checkFamily(t, { digits: '6' }).ok);
  assert.ok(checkFamily(t, { digits: '7' }).ok);
});
