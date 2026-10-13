// 進度儲存（HANDOFF §8）。兩場各一個 localStorage key；不能存時改用記憶體，並讓畫面提醒玩家。
// 不能用 localStorage 時，進度另外備份在 window.name：同一個分頁換到入口頁再回來（「完成遊戲」、
// 「回到場次選擇」）進度還在；關掉分頁才會消失。

export const KEYS = { youth: 'miaomiao:youth:v1', family: 'miaomiao:family:v1' };

export function blankState() {
  return { v: 1, team: '', startedAt: null, storySeen: false, allClearSeen: false, levels: {}, npc: {} };
}

const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);

// 存檔結構檢查：格式不對的關卡／NPC 直接丟掉（當作沒做過），不讓畫面因為壞掉的存檔整頁空白。
export function sanitize(s) {
  if (!isObj(s) || s.v !== 1) return null;
  const out = Object.assign(blankState(), s);
  out.team = typeof s.team === 'string' ? s.team : '';
  out.storySeen = !!s.storySeen;
  out.allClearSeen = !!s.allClearSeen;
  const clean = (src, extra) => {
    const o = {};
    if (!isObj(src)) return o;
    for (const [k, X] of Object.entries(src)) {
      if (!isObj(X) || !Array.isArray(X.results)) continue;
      // 舊版的「揭曉答案」（'revealed'）已改成「跳過此題」，舊存檔一律當作跳過
      const results = X.results.map(r => (r === 'revealed' ? 'skipped' : r));
      o[k] = Object.assign(extra(), X, { results, drafts: isObj(X.drafts) ? X.drafts : {} });
    }
    return o;
  };
  out.levels = clean(s.levels, () => ({ hints: 0, startedAt: null, completedAt: null, attempts: 0 }));
  out.npc = clean(s.npc, () => ({}));
  return out;
}

function parseState(raw) {
  if (!raw) return null;
  try { return sanitize(JSON.parse(raw)); } catch { return null; }
}

/* ---------- 不能用 localStorage 時的備份：window.name ---------- */
function nameBag() {
  try {
    const o = JSON.parse(window.name || '{}');
    return isObj(o) && isObj(o.miaomiao) ? o.miaomiao : {};
  } catch { return {}; }
}
function nameGet(key) {
  if (typeof window === 'undefined') return null;
  const v = nameBag()[key];
  return typeof v === 'string' ? v : null;
}
function nameSet(key, raw) {
  if (typeof window === 'undefined') return;
  try {
    const bag = nameBag();
    if (raw === null) delete bag[key]; else bag[key] = raw;
    window.name = JSON.stringify({ miaomiao: bag });
  } catch { /* ignore */ }
}

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function readRaw(key) {
  return lsGet(key) || nameGet(key);
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
  return parseState(readRaw(KEYS[edition]));
}

export function createStore(edition) {
  const key = KEYS[edition];
  const persistent = canPersist();
  let state = Object.assign(blankState(), parseState(readRaw(key)) || {});
  // lastDisk：上次讀到／寫入的存檔字串；lastSaved：目前 state 對應的字串。沒有真的改變就不寫，
  // 兩個分頁才不會因為重畫而互相覆蓋。
  let lastDisk = persistent ? lsGet(key) : null;
  let lastSaved = JSON.stringify(state);
  const listeners = new Set();
  const externals = new Set();

  function save() {
    const raw = JSON.stringify(state);
    if (raw === lastSaved) return;
    lastSaved = raw;
    if (!persistent) { nameSet(key, raw); return; }
    try {
      localStorage.setItem(key, raw);
      lastDisk = raw;
    } catch { /* 存不下就繼續用記憶體 */ }
  }

  // 同一支手機開了兩個分頁時，別的分頁存的進度比較新：重新讀一次，不要拿舊資料蓋掉它
  function syncFromDisk() {
    if (!persistent) return;
    const raw = lsGet(key);
    if (raw === lastDisk) return;
    lastDisk = raw;
    state = Object.assign(blankState(), parseState(raw) || {});
    lastSaved = JSON.stringify(state);
    externals.forEach(l => l(state));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => { if (e.key === key || e.key === null) syncFromDisk(); });
    window.addEventListener('pageshow', e => { if (e.persisted) syncFromDisk(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncFromDisk(); });
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
      lastDisk = null;
      lastSaved = JSON.stringify(state);
      nameSet(key, null);
      listeners.forEach(l => l(state));
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    // 別的分頁改了這一場的進度（state 已換成新的那一份）
    onExternalChange(l) { externals.add(l); return () => externals.delete(l); },
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
