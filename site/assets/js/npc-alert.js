// NPC 出沒提示（2026-10-21 Hugo 要求）：每天到 CONFIG.npcAlert.time（手機時間）跳出提醒，
// 到 CONFIG.npcAlert.until 自動關掉、之後不再跳（2026-10-22 Hugo 要求，預設 17:00）。
//
// - 一天只跳一次（記在 localStorage 'miaomiao:{場次}:npcAlert'，「重新開始」不會清掉）。
// - 取好隊名、NPC 任務還沒全部完成才跳。
// - 時間到時如果開著別的彈窗或放大圖，等它關掉再跳；手機鎖屏期間錯過的，回到畫面時補跳。
// - 時間之後才打開網站，也會跳（當天還沒跳過的話）。

import { CONFIG } from '../../config.js';
import { openDialog, closeLayers } from './ui.js';
import { npcDone } from './progress.js';

const MAX_DELAY = 2147483647; // setTimeout 上限

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startNpcAlert(app) {
  const hm = v => /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
  const m = hm(CONFIG.npcAlert && CONFIG.npcAlert.time);
  if (!m) return;
  const u = hm(CONFIG.npcAlert && CONFIG.npcAlert.until); // 沒設定就不自動關
  const key = `miaomiao:${app.edition}:npcAlert`;
  let shown = ''; // 不能存 localStorage 時，至少這次瀏覽不重複跳
  const at = (d, t) => { const x = new Date(d); x.setHours(Number(t[1]), Number(t[2]), 0, 0); return x; };
  const alertAt = (d = new Date()) => at(d, m);
  const endAt = (d = new Date()) => (u ? at(d, u) : null);
  let alertOpen = false;
  const shownToday = () => {
    if (shown === todayKey()) return true;
    try { return localStorage.getItem(key) === todayKey(); } catch { return false; }
  };
  const markShown = () => {
    shown = todayKey();
    try { localStorage.setItem(key, shown); } catch { /* 存不了就算了 */ }
  };
  const wanted = () => !!app.state.team && !app.content.npc.every(x => npcDone(x, app.state));

  let timer = 0;
  const check = async () => {
    clearTimeout(timer);
    const now = new Date();
    const end = endAt(now);
    if (end && now >= end && alertOpen) { alertOpen = false; closeLayers(); } // 時間到還開著 → 自動關掉
    if (now >= alertAt(now) && (!end || now < end) && !shownToday() && wanted()) {
      if (document.querySelector('.scrim, .zoom-scrim')) { timer = setTimeout(check, 3000); return; }
      markShown();
      alertOpen = true;
      if (end) timer = setTimeout(check, Math.min(end.getTime() - now.getTime(), MAX_DELAY)); // 開著也要在關掉的時間醒來
      const go = await openDialog({
        icon: 'speech',
        title: 'NPC 出沒提示',
        body: 'NPC 已經在廟街出沒了！回到選單地圖頁面看看要找誰，完成他們的「NPC 任務」吧。',
        buttons: [
          { label: '查看地圖', value: true, kind: 'primary' },
          { label: '我知道了', value: false, kind: 'secondary' },
        ],
      });
      if (!alertOpen) return; // 已經被自動關掉（那次 check 會排好下一次）
      alertOpen = false;
      clearTimeout(timer);
      if (go === true) app.go('/map'); // 地圖上用星號標出 NPC 出沒的地點
    }
    // 下一次檢查：今天跳出的時間還沒到就等到那時候；還沒到關掉的時間就等到那時候；否則等明天
    let next = alertAt(now).getTime() - now.getTime();
    if (next <= 0 && end && now < end) next = end.getTime() - now.getTime();
    if (next <= 0) { const t = new Date(now); t.setDate(t.getDate() + 1); next = alertAt(t).getTime() - now.getTime(); }
    timer = setTimeout(check, Math.min(next, MAX_DELAY));
  };

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('hashchange', () => check()); // 例如時間過後才取好隊名
  check();
}
