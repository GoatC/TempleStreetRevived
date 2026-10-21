// NPC 出沒提示（2026-10-21 Hugo 要求）：每天到 CONFIG.npcAlert.time（手機時間）跳出提醒。
//
// - 一天只跳一次（記在 localStorage 'miaomiao:{場次}:npcAlert'，「重新開始」不會清掉）。
// - 取好隊名、NPC 任務還沒全部完成才跳。
// - 時間到時如果開著別的彈窗或放大圖，等它關掉再跳；手機鎖屏期間錯過的，回到畫面時補跳。
// - 時間之後才打開網站，也會跳（當天還沒跳過的話）。

import { CONFIG } from '../../config.js';
import { openDialog } from './ui.js';
import { npcDone } from './progress.js';

const MAX_DELAY = 2147483647; // setTimeout 上限

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startNpcAlert(app) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String((CONFIG.npcAlert && CONFIG.npcAlert.time) || ''));
  if (!m) return;
  const key = `miaomiao:${app.edition}:npcAlert`;
  let shown = ''; // 不能存 localStorage 時，至少這次瀏覽不重複跳
  const alertAt = (d = new Date()) => { const x = new Date(d); x.setHours(Number(m[1]), Number(m[2]), 0, 0); return x; };
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
    if (now >= alertAt(now) && !shownToday() && wanted()) {
      if (document.querySelector('.scrim, .zoom-scrim')) { timer = setTimeout(check, 3000); return; }
      markShown();
      const go = await openDialog({
        icon: 'speech',
        title: 'NPC 出沒提示',
        body: 'NPC 已經在廟街出沒了！到關卡選單的「NPC 任務」看看要找誰，完成他們的任務吧。',
        buttons: [
          { label: '查看 NPC 任務', value: true, kind: 'primary' },
          { label: '我知道了', value: false, kind: 'secondary' },
        ],
      });
      if (go === true) {
        app.go('/menu');
        setTimeout(() => {
          const card = app.root.querySelector('[data-go^="/npc/"]');
          if (card) app.reveal(card, { block: 'start' });
        }, 100);
      }
    }
    // 下一次檢查：今天的時間還沒到就等到那時候，否則等明天
    let next = alertAt(now).getTime() - now.getTime();
    if (next <= 0) { const t = new Date(now); t.setDate(t.getDate() + 1); next = alertAt(t).getTime() - now.getTime(); }
    timer = setTimeout(check, Math.min(next, MAX_DELAY));
  };

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('hashchange', () => check()); // 例如時間過後才取好隊名
  check();
}
