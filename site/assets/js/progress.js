// 進度計算（HANDOFF §7.4、§8）。只讀 state，不改它。
// levels：youth-levels.json / family-levels.json 的 data；npcs：npc.json 的 data。

const isSet = r => r !== null && r !== undefined;

function peekLevel(state, no) {
  return (state && state.levels && state.levels[String(no)]) || null;
}

// 第 n 關（1 起算）是否過關
export function levelDone(edition, level, L) {
  if (!L) return false;
  return level.tasks.every((t, i) => (edition === 'family' && t.bonus) || isSet(L.results[i]));
}

// 跳過（放棄作答）的任務數；0 就是「自行解出」
export function skippedCount(L) {
  return L ? L.results.filter(r => r === 'skipped').length : 0;
}

// 歷史頁「本關答案」第 j 列對應的任務：拍照任務沒有答案，依序對應其餘任務
export function answerTasks(level) {
  return level.tasks.map((t, i) => (t.type === 'photo' ? -1 : i)).filter(i => i >= 0);
}

// 卡片狀態：'locked' | 'todo' | 'doing' | 'done'
export function levelStatus(edition, levels, state, n) {
  const level = levels[n - 1];
  const L = peekLevel(state, n);
  if (levelDone(edition, level, L)) return 'done';
  if (edition === 'youth' && n !== 1 && !levelDone(edition, levels[0], peekLevel(state, 1))) return 'locked';
  if (L && (L.hints > 0 || L.results.some(isSet))) return 'doing';
  return 'todo';
}

export function npcDone(npc, state) {
  const N = state && state.npc && state.npc[npc.key];
  return !!N && npc.tasks.every((t, i) => isSet(N.results[i]));
}

// 拿到的星星數與上限（親子場加分題；上限從資料算）
export function stars(levels, state) {
  let got = 0, max = 0;
  levels.forEach((level, i) => level.tasks.forEach((t, k) => {
    if (!t.bonus) return;
    max++;
    const L = peekLevel(state, i + 1);
    if (L && isSet(L.results[k])) got++;
  }));
  return { got, max };
}

export function summary(edition, levels, npcs, state) {
  const levelsDone = levels.filter((lv, i) => levelDone(edition, lv, peekLevel(state, i + 1))).length;
  const npcsDone = npcs.filter(n => npcDone(n, state)).length;
  const anyResult = !!state && (
    Object.values(state.levels || {}).some(L => L.results.some(isSet)) ||
    Object.values(state.npc || {}).some(N => N.results.some(isSet)));
  return {
    levelsDone, levelsTotal: levels.length,
    npcsDone, npcsTotal: npcs.length,
    allClear: levelsDone === levels.length && npcsDone === npcs.length,
    hasProgress: !!state && (!!state.team || anyResult),
  };
}

// 「關卡 x/6、NPC y/3」
export function progressText(s) {
  return `關卡 ${s.levelsDone}/${s.levelsTotal}、NPC ${s.npcsDone}/${s.npcsTotal}`;
}
