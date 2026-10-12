// 進度儲存（HANDOFF §8）。兩場各一個 localStorage key；不能存時改用記憶體，並讓畫面提醒玩家。

export const KEYS = { youth: 'miaomiao:youth:v1', family: 'miaomiao:family:v1' };

export function blankState() {
  return { v: 1, team: '', startedAt: null, storySeen: false, allClearSeen: false, levels: {}, npc: {} };
}

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === 1 ? s : null;
  } catch { return null; }
}

function canPersist() {
  try {
    const k = 'miaomiao:probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

// 讀某一場的進度（入口頁用；不建立 store）
export function peek(edition) {
  return readRaw(KEYS[edition]);
}

export function createStore(edition) {
  const key = KEYS[edition];
  const persistent = canPersist();
  let state = Object.assign(blankState(), readRaw(key) || {});
  const listeners = new Set();

  function save() {
    if (!persistent) return;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* 存不下就繼續用記憶體 */ }
  }

  return {
    edition,
    persistent,
    get state() { return state; },
    // fn 直接改 state（可回傳值）；改完立刻存檔
    update(fn) {
      const r = fn(state);
      save();
      listeners.forEach(l => l(state));
      return r;
    },
    reset() {
      state = blankState();
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      listeners.forEach(l => l(state));
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}

// 取某關／某 NPC 的狀態，沒有就建立。results 長度跟題目數一致。
export function levelState(state, no, taskCount) {
  const k = String(no);
  if (!state.levels[k]) {
    state.levels[k] = { results: Array(taskCount).fill(null), hints: 0, drafts: {}, startedAt: null, completedAt: null, attempts: 0 };
  }
  const L = state.levels[k];
  while (L.results.length < taskCount) L.results.push(null);
  return L;
}

export function npcState(state, key, taskCount) {
  if (!state.npc[key]) state.npc[key] = { results: Array(taskCount).fill(null), drafts: {} };
  const N = state.npc[key];
  while (N.results.length < taskCount) N.results.push(null);
  return N;
}
