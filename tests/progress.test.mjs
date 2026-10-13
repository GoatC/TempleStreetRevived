import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankState, levelState, npcState } from '../site/assets/js/store.js';
import { levelStatus, summary, stars, progressText, skippedCount, answerTasks } from '../site/assets/js/progress.js';

const load = f => JSON.parse(readFileSync(new URL(`../site/content/${f}.json`, import.meta.url), 'utf8')).data;
const youth = load('youth-levels');
const family = load('family-levels');
const npcs = load('npc');

test('youth: levels 2-6 locked until level 1 is done', () => {
  const s = blankState();
  assert.equal(levelStatus('youth', youth, s, 1), 'todo');
  assert.equal(levelStatus('youth', youth, s, 3), 'locked');
  const L1 = levelState(s, 1, youth[0].tasks.length);
  L1.hints = 1;
  assert.equal(levelStatus('youth', youth, s, 1), 'doing');
  L1.results = L1.results.map(() => 'self');
  L1.results[2] = 'skipped';
  assert.equal(skippedCount(L1), 1);
  assert.equal(levelStatus('youth', youth, s, 1), 'done');
  assert.equal(levelStatus('youth', youth, s, 3), 'todo');
  assert.equal(progressText(summary('youth', youth, npcs, s)), '關卡 1/6、NPC 0/3');
});

test('family: all open; bonus not required; stars counted from data', () => {
  const s = blankState();
  assert.equal(levelStatus('family', family, s, 5), 'todo');
  const L4 = levelState(s, 4, family[3].tasks.length);
  family[3].tasks.forEach((t, i) => { if (!t.bonus) L4.results[i] = 'self'; });
  assert.equal(levelStatus('family', family, s, 4), 'done');
  assert.deepEqual(stars(family, s), { got: 0, max: 1 });
  L4.results[3] = 'self';
  assert.deepEqual(stars(family, s), { got: 1, max: 1 });
});

test('summary: progress and all clear', () => {
  const s = blankState();
  assert.equal(summary('family', family, npcs, s).hasProgress, false);
  s.team = '妙妙一家人';
  assert.equal(summary('family', family, npcs, s).hasProgress, true);
  family.forEach((lv, i) => { levelState(s, i + 1, lv.tasks.length).results.fill('self'); });
  npcs.forEach(n => { npcState(s, n.key, n.tasks.length).results.fill('self'); });
  const sum = summary('family', family, npcs, s);
  assert.equal(sum.allClear, true);
  assert.equal(progressText(sum), '關卡 7/7、NPC 3/3');
});

test('歷史頁「本關答案」每一列都對得到一個任務（跳過的那題才能不顯示答案）', () => {
  for (const [ed, levels] of [['youth', youth], ['family', family]]) {
    const hist = load(ed + '-history');
    levels.forEach((lv, i) => {
      assert.equal(hist[i].answers.length, answerTasks(lv).length,
        `${ed} 第 ${i + 1} 關：本關答案 ${hist[i].answers.length} 列，但非拍照任務有 ${answerTasks(lv).length} 題`);
    });
  }
  // 親子場第一關：任務 0 是拍照，答案第 1 列對應任務 1
  assert.equal(answerTasks(family[0])[0], 1);
});
