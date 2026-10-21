// 青年場專屬畫面：序章、關卡選單（含全破彈窗）、地圖、關卡頁、本關完成、結局。
//
// registerYouth(app) 由 site/youth/index.html 呼叫。共用畫面（'/', '/name', '/npc/:key',
// '/level/:n/history', '/summary'）由 screens-common.js / npc.js 註冊。
// 畫面規則、app API 見 app.js 檔頭；UI 小工具見 ui.js 檔頭。
//
// 關卡頁進度（store：state.levels[n]，HANDOFF §8）
//   results[i]  null | 'self' | 'skipped'（提示用完後「跳過此題」：放棄作答，不顯示答案）
//   taskHints   各任務已看的提示數 { 任務 i: 0～2 }。提示跟著任務走（tasks[i].hints，最多兩則）；
//               看完（或這個任務沒有提示）才出現「跳過此題」。
//   drafts[i]   作答中：{ text, vals: [], order: [], choice }；答對後改成 { got: 列上顯示的答案 }，跳過後改成 {}
//   startedAt / completedAt / attempts
// 錯誤訊息（還沒改輸入前的紅字）只存在記憶體，不存檔（同原型 draft.error / draft.bad）。

import { esc, ICONS, CARD_ICONS, icon, npcTile, topbar, verTag, openDialog, openZoom, onUiReset } from './ui.js';
import { checkYouth, stripYouth } from './answers.js';
import { levelState } from './store.js';
import { levelStatus, levelDone, npcDone } from './progress.js';
import { openRules, rulesButton } from './screens-common.js';

const isSet = r => r !== null && r !== undefined;
const INPUT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"';
const IMG = '../assets/img/';

// 附圖（HANDOFF §7.1、§10；alt 照 T08Level 的 zoom-img）
const FIGS = {
  zodiac: {
    src: IMG + 'youth-L1-zodiac-chart.webp',
    title: '現場參考圖｜慈祐宮生肖沖煞表',
    alt: '慈祐宮生肖沖煞表（民國 115 年）：生肖、地支、年齡與時辰對照',
  },
  shops: {
    src: IMG + 'youth-L2-fig1-shop-positions.webp',
    title: '附圖｜A～E 在廟街上的位置',
    alt: '中正路、景德路與新莊路的示意圖，標出 A～E 五個位置',
  },
  arrows: {
    src: IMG + 'youth-L2-fig2-4x4-arrows.webp',
    title: '附圖｜A～E 的數字藏在哪裡？',
    alt: '4×4 方格與箭頭：從 1 出發依箭頭前進，每走一格加一，直到 16；A～E 位在其中五格',
  },
};

/* ======================================================================
   序章（T05Story / T05StoryLast）與結局（沿用序章版面，§6.2）
   ====================================================================== */

// 只在這次瀏覽有效的段落位置
const talkStep = { story: 0, ending: 0 };
onUiReset(() => { talkStep.story = 0; talkStep.ending = 0; });

// 台詞：{team} 換成隊名並套 .mark
function lineHtml(text, team) {
  return String(text ?? '').split('{team}').map(esc).join(`<span class="mark">${esc(team)}</span>`);
}

function talkScreen(app, kind) {
  const lines = kind === 'story' ? (app.content.story.prologue || []) : (app.content.story.ending || []);
  const total = lines.length;
  const step = Math.max(0, Math.min(total - 1, talkStep[kind]));
  talkStep[kind] = step;
  const line = lines[step] || {};
  const last = step === total - 1;
  const team = app.state.team || '';
  const word = kind === 'story' ? '序章' : '結局';
  const finishLabel = kind === 'story' ? '開始探索' : '查看完成摘要';
  const finish = () => {
    talkStep[kind] = 0;
    if (kind === 'story') {
      app.store.update(s => { s.storySeen = true; });
      app.go('/menu');
    } else {
      app.go('/summary');
    }
  };
  const speaker = `<span class="speaker">${esc(line.speaker || '妙妙貓')}</span>`;
  const box = last
    ? `<div class="dialog" style="cursor: default;">
        ${speaker}
        <p class="dialog-text">${lineHtml(line.text, team)}</p>
      </div>
      <button class="btn btn-primary" id="talk-finish" type="button" data-action="finish">${esc(finishLabel)}
        ${ICONS.arrow}
      </button>`
    : `<button class="dialog" id="talk-next" type="button" data-action="next" aria-label="點擊繼續下一段" aria-describedby="talk-text">
        ${speaker}
        <span class="dialog-text" id="talk-text">${lineHtml(line.text, team)}</span>
        <span class="dialog-foot">
          <span></span>
          <span style="display: flex; align-items: center; gap: 4px;">點擊繼續
            ${ICONS.chevDown}
          </span>
        </span>
      </button>`;
  // 設計稿頂部列左邊是 span.topbar-tag；這頁沒有其他標題，所以改用同樣 class 的 h1（外觀不變）
  return {
    title: word,
    html: `<div class="screen">
  <div class="topbar" style="border-bottom: 0; padding-left: 20px;">
    <h1 class="topbar-tag" style="margin: 0;">${word}　${step + 1} / ${total}</h1>
    <div class="topbar-right">
      <button class="btn btn-text" type="button" data-action="finish" style="text-decoration: none; gap: 4px;">跳過劇情
        ${ICONS.skip}
      </button>
      ${verTag(app.edition)}
    </div>
  </div>
  <div class="ph story-ph" style="flex: 1 1 auto; position: relative; justify-content: flex-end;">
    <svg viewBox="0 0 320 120" aria-hidden="true" style="position: absolute; left: 50%; top: 40px; transform: translateX(-50%); width: min(320px, calc(100% - 32px)); height: auto; stroke-width: 2.4;">
      <path d="M10 70 C40 70 60 52 70 34 L250 34 C260 52 280 70 310 70"></path>
      <path d="M18 70 H302"></path>
      <path d="M70 34 C66 24 58 18 48 18"></path>
      <path d="M250 34 C254 24 262 18 272 18"></path>
      <path d="M40 70 V120 M280 70 V120"></path>
      <path d="M130 34 V20 H190 V34"></path>
    </svg>
    <!-- 妙妙貓角色插畫（Hugo 2026-10-12 提供；原圖 assets-src/img/story-miaomiao.png） -->
    <img src="../assets/img/story-miaomiao.webp" width="468" height="480" alt="" style="position: relative; width: 184px; height: auto; display: block;">
  </div>
  <div style="flex: none; padding: 0 20px max(28px, env(safe-area-inset-bottom)); margin-top: -40px; display: flex; flex-direction: column; gap: 12px; position: relative;">
    ${box}
  </div>
</div>`,
    actions: {
      next: () => {
        talkStep[kind] = Math.min(total - 1, step + 1);
        app.refresh({ focus: talkStep[kind] === total - 1 ? '#talk-finish' : '#talk-next' });
      },
      finish,
    },
  };
}

function storyScreen(params, app) {
  // 暫定：還沒取隊名就打開序章 → 先去取名（台詞要用隊名）
  if (!app.state.team) return app.redirect('/name');
  const lines = app.content.story.prologue || [];
  if (!lines.length) {
    app.store.update(s => { s.storySeen = true; });
    return app.redirect('/menu');
  }
  return talkScreen(app, 'story');
}

function endingScreen(params, app) {
  // 暫定：還沒全破就打開結局網址 → 回關卡選單
  if (!app.summary().allClear) return app.redirect(app.state.team ? '/menu' : '/');
  const lines = app.content.story.ending || [];
  // 結局台詞還沒提供（§12 問題 4）→ 直接到完成摘要
  if (!lines.length) return app.redirect('/summary');
  return talkScreen(app, 'ending');
}

/* ======================================================================
   關卡選單（T06Menu / T06Menu1 / T06MenuNpcLeft / T06Menu3）
   ====================================================================== */

const STATUS_LABEL = { todo: '未完成', doing: '進行中', done: '已完成', locked: '完成第一關後開放' };

function statusTags(s) {
  if (s === 'doing') return '<span class="tag tag-doing">進行中</span>';
  if (s === 'done') return `<span class="tag tag-done">${ICONS.check}已完成</span>`;
  if (s === 'locked') return `<span class="tag tag-lock">${ICONS.lock}未開放</span>`;
  return '<span class="tag tag-todo">未完成</span>';
}
const statusCls = s => (s === 'doing' ? ' is-doing' : s === 'done' ? ' is-done' : s === 'locked' ? ' is-locked' : '');

function openAllClear(app) {
  const team = app.state.team || '';
  return openDialog({
    topHtml: `<div style="display: flex; justify-content: center;">
        <div class="seal" style="width: 96px; height: 96px;">
          <div class="seal-ring" style="width: 80px; height: 80px; font-size: 22px; line-height: 26px;">全破</div>
        </div>
      </div>`,
    headHtml: '<h2 class="h2" id="dlg-title" style="text-align: center;">全部解開了！</h2>',
    bodyHtml: `<p class="p" style="text-align: center;">六個關卡和三個 NPC 任務都完成了。<br>${esc(team)}，最後的故事要揭曉了。</p>`,
    buttons: [
      { label: '前往結局', value: 'ending', kind: 'primary' },
      { label: '稍後查看', value: null, kind: 'secondary' },
    ],
  });
}

function menuScreen(params, app) {
  // 暫定：還沒取隊名就打開選單 → 先去取名
  if (!app.state.team) return app.redirect('/name');
  const st = app.state;
  const { levels } = app.content;
  const cards = app.content.menu.levels;
  const sum = app.summary();
  const status = cards.map(c => levelStatus('youth', levels, st, c.n));
  const doneCount = sum.levelsDone;
  const npcCards = app.content.menu.npcs;
  const npcStatus = npcCards.map(c => {
    const npc = app.content.npc.find(x => x.key === c.key);
    if (npc && npcDone(npc, st)) return 'done';
    const N = st.npc && st.npc[c.key];
    return N && N.results.some(isSet) ? 'doing' : 'todo';
  });
  const npcCount = npcStatus.filter(s => s === 'done').length;
  const levelsAll = doneCount >= cards.length;
  const all = sum.allClear;
  const levelsOnly = levelsAll && !all;
  const npcLeft = npcCards.length - npcCount;

  const dots = status.map(s => `<span class="dot${s === 'done' ? ' is-done' : ''}">${s === 'done' ? `<svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"></path></svg>` : ''}</span>`).join('');
  const npcDots = npcCards.map((c, i) => `<span class="dot${npcStatus[i] === 'done' ? ' is-done' : ''}">${esc(c.key)}</span>`).join('');

  const levelCards = cards.map((c, i) => {
    const s = status[i];
    const aria = `${c.no}，${c.place}，${c.task}，${STATUS_LABEL[s]}`;
    return `<button class="lv lv-sm${statusCls(s)}" id="menu-lv${c.n}" type="button" data-go="/level/${c.n}" aria-label="${esc(aria)}" aria-disabled="${s === 'locked' ? 'true' : 'false'}">
        <span class="lv-img">
          ${CARD_ICONS[c.icon] || ''}
        </span>
        <span class="lv-main">
          <span class="lv-top">
            <span class="lv-no">${esc(c.no)}</span>
            <span class="lv-flags">
              ${statusTags(s)}
            </span>
          </span>
          <span class="lv-place">${esc(c.place)}</span>
          <span class="lv-task">${esc(c.task)}</span>
        </span>
        ${s !== 'locked' ? `<svg class="ico lv-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>` : ''}
      </button>`;
  }).join('');

  const npcList = npcCards.map((c, i) => {
    const s = npcStatus[i];
    const aria = `NPC ${c.key}，${c.name}，${c.who}，${STATUS_LABEL[s]}`;
    return `<button class="lv lv-sm${statusCls(s)}" id="menu-npc${esc(c.key)}" type="button" data-go="/npc/${esc(c.key)}" aria-label="${esc(aria)}">
        ${npcTile(c)}
        <span class="lv-main">
          <span class="lv-top">
            <span class="lv-no">NPC ${esc(c.key)}</span>
            <span class="lv-flags">
              ${statusTags(s)}
            </span>
          </span>
          <span class="lv-place">${esc(c.name)}</span>
          <span class="lv-task">${esc(c.who)}</span>
        </span>
        <svg class="ico lv-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>
      </button>`;
  }).join('');

  const bannerLevels = levelsOnly ? `
    <div class="pass-banner">
      <div class="pass-head">
        <span class="mini-seal"><span>六關</span></span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <p class="p" style="font-weight: 700;">六關都完成了！</p>
          <p class="small">再完成 ${npcLeft} 個 NPC 任務就全破。</p>
        </div>
      </div>
    </div>` : '';
  const bannerAll = all ? `
    <div class="pass-banner">
      <div class="pass-head">
        <span class="mini-seal"><span>全破</span></span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <p class="p" style="font-weight: 700;">恭喜全破！</p>
          <p class="small">六關和 NPC 任務都完成了。</p>
        </div>
      </div>
    </div>` : '';
  const safety = !all ? `
    <p class="small" style="display: flex; gap: 8px; align-items: flex-start; margin-top: 4px;">
      ${icon('warn', 'margin-top: 1px;')}
      過馬路請注意安全。只需要用眼睛觀察，不必攀爬或觸摸廟裡的文物。
    </p>` : '';
  const actions = all ? `
  <div class="actions">
    <button class="btn btn-primary" type="button" data-go="/ending">前往結局
      ${ICONS.arrow}
    </button>
  </div>` : '';

  return {
    title: '關卡選單',
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '首頁', to: '/' }, right: rulesButton('padding-right: 4px;') })}
  <main class="content" style="gap: 12px;">
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <p class="label">隊伍</p>
      <h1 class="h2" style="font-size: 24px;">${esc(st.team)}</h1>
    </div>
    <div class="prog2">
      <div class="prog2-row">
        <p class="prog2-label">關卡 <span class="prog2-n">${doneCount}/${cards.length}</span></p>
        <div class="dots7" aria-hidden="true">
          ${dots}
        </div>
      </div>
      <div class="prog2-row">
        <p class="prog2-label">NPC <span class="prog2-n">${npcCount}/${npcCards.length}</span></p>
        <div class="dots3" aria-hidden="true">
          ${npcDots}
        </div>
      </div>
    </div>
    ${bannerLevels}
    ${bannerAll}
    <button class="map-entry" type="button" data-go="/map">
      <span class="map-thumb"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 12l12-5 16 5 12-5v29l-12 5-16-5-12 5z"></path><path d="M16 7v29M32 12v29"></path></svg></span>
      <span class="map-entry-main">
        <span class="map-entry-title">查看地圖</span>
        <span class="map-entry-sub">關卡和集合點的位置</span>
      </span>
      ${ICONS.go}
    </button>
    <p class="route-note">${ICONS.route}六個關卡順序不限，從哪一關開始都可以。</p>
    ${levelCards}
    <h2 class="h2" style="font-size: 20px; line-height: 28px; margin-top: 8px;">NPC 任務</h2>
    <p class="small">題目由 NPC 在現場口頭說明，沒有提示。六關和三個 NPC 任務都完成，才算全破。</p>
    ${npcList}
    ${safety}
  </main>
  ${actions}
</div>`,
    bind() {
      // 全破彈窗（T06Menu3）：全破後第一次回到選單時跳出一次（state.allClearSeen）
      if (all && !st.allClearSeen) {
        app.store.update(s => { s.allClearSeen = true; });
        setTimeout(async () => {
          if (app.path !== '/menu') return;
          const v = await openAllClear(app);
          if (v === 'ending' && app.path === '/menu') app.go('/ending');
        }, 0);
      }
    },
    actions: {
      rules: () => openRules(app.edition),
    },
  };
}

/* ======================================================================
   地圖（T06Map）
   ====================================================================== */

function mapScreen(params, app) {
  const src = IMG + 'youth-map.webp';
  return {
    title: '廟街地圖',
    html: `<div class="screen">
  <div class="topbar">
    <button class="btn btn-back" type="button" data-go="/menu">${ICONS.back}關卡選單</button>
    <div class="topbar-right">
      <h1 class="topbar-tag" style="margin: 0;">廟街地圖</h1>
      ${verTag(app.edition)}
    </div>
  </div>
  <main class="content" style="gap: 12px;">
    <p class="route-note">${ICONS.compass}東在上、北在左；沿新莊路的距離依比例</p>
    <button class="map-fig" id="map-fig" type="button" data-action="zoom">
      <img src="${src}" width="875" height="1600" alt="廟街地圖示意圖，東在上、北在左。沿新莊路由上往下依序是：6 廣福宮、1 慈祐宮與斜對面的集合點林協記文化館、3 戲館巷、4 米市巷、5 武聖廟。">
      <span class="fig-cap">${ICONS.zoom}點開放大</span>
    </button>
    <h2 class="h2" style="font-size: 20px; line-height: 28px; margin-top: 4px;">圖例</h2>
    <ul class="legend2">
      <li class="lg-item"><span class="lg-mark lg-pin">1</span><span><b>慈祐宮</b><span class="lg-addr">（新莊路 218 號）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">3</span><span><b>戲館巷</b><span class="lg-addr">（新莊路 359 巷）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">4</span><span><b>米市巷</b><span class="lg-addr">（新莊路 387 巷）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">5</span><span><b>武聖廟</b><span class="lg-addr">（新莊路 340 號）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">6</span><span><b>廣福宮</b><span class="lg-addr">（新莊路 150 號）</span></span></li>
      <li class="lg-item"><span class="lg-meet" aria-hidden="true"></span><span><b>集合點：林協記文化館</b><span class="lg-addr">（新莊路 317 號 2 樓，慈祐宮斜對面）</span></span></li>
    </ul>
    <p class="route-note">${ICONS.info}第二關「五間老店」的位置是謎題的一部分，地圖上不標示。</p>
  </main>
</div>`,
    actions: {
      zoom: () => openZoom(src, '廟街地圖示意圖（放大）', '廟街地圖', '廟街地圖（放大）'),
    },
  };
}

/* ======================================================================
   關卡頁（T08Level ＋ T08L* 狀態板、T09* 彈窗）
   ====================================================================== */

const levelUi = {}; // { [n]: { error: '' | 'empty' | 'wrong', bad: [] } }：目前任務的錯誤（不存檔）
onUiReset(() => { for (const k in levelUi) delete levelUi[k]; });

function typeName(t) {
  if (t.type === 'number') return '數字題';
  if (t.type === 'select') return '對照題';
  if (t.type === 'order') return '點選排序';
  if (t.type === 'choice') return '選擇題';
  if (t.type === 'fields') return t.fields.length + ' 格填空';
  return '文字題';
}

function errorFor(t, kind) {
  if (kind === 'empty') {
    return t.type === 'order' ? '請先排好全部角色，再按「送出順序」。' : '請先填完，再按「送出答案」。';
  }
  if (t.type === 'order') return '順序似乎不正確，再對照一次線索吧。';
  if (t.type === 'select') return '有幾格對不上，再對照一次附圖和線索吧。';
  return '答案似乎不正確，再觀察一次現場吧。';
}

// 下拉選單的選項：五間老店全名。原型寫死在 HTML，這裡從資料產生：
// 優先沿用同一關「依線索填店名」題的順序（= 設計稿的選項順序，不會洩漏 A～E 的答案順序），
// 找不到才退回 answer 本身。
function selectOptions(lv, t) {
  const want = Array.from(new Set(t.answer));
  for (const other of lv.tasks) {
    if (other === t || other.type !== 'fields') continue;
    const names = other.fields.map(f => (f.answer && f.answer[0]) || '');
    if (names.length === want.length && want.every(w => names.includes(w))) return names;
  }
  return want;
}

// 答對時列上顯示的文字（原型 complete('self', res.hit || t.show)）：文字／數字題顯示玩家對到的那一種寫法
function hitText(t, d) {
  if (t.type === 'text' || t.type === 'number') {
    const v = stripYouth(d.text);
    const hit = (t.answer || []).find(a => stripYouth(a) === v);
    if (hit) return hit;
  }
  return t.show;
}

// 任務自己的提示（最多兩則）與已看的則數
const taskHints = t => (Array.isArray(t.hints) ? t.hints.filter(Boolean).slice(0, 2) : []);
function usedHints(L, i, list) {
  const T = L && L.taskHints && typeof L.taskHints === 'object' ? L.taskHints : {};
  return Math.max(0, Math.min(list.length, Number(T[i]) || 0));
}

function blankDraft() {
  return { text: '', vals: ['', '', '', '', ''], order: [], choice: null };
}

function levelScreen(params, app) {
  const n = Number(params.n);
  const lv = app.content.levels[n - 1];
  if (!Number.isInteger(n) || !lv) return app.redirect('/menu');
  // #/level/01 這類寫法 → 換成標準網址（提示、跳過要用 app.path 比對）
  if (String(n) !== params.n) return app.redirect('/level/' + n);

  const tasks = lv.tasks;
  const L = app.store.update(s => {
    const x = levelState(s, n, tasks.length);
    if (!x.startedAt) x.startedAt = new Date().toISOString();
    return x;
  });
  const results = L.results;
  const current = results.findIndex(r => !isSet(r));
  const hintList = current >= 0 ? taskHints(tasks[current]) : [];
  const hints = usedHints(L, current, hintList);
  const hintsOut = hints >= hintList.length;
  const U = levelUi[n] || (levelUi[n] = { task: -1, error: '', bad: [] });
  if (U.task !== current) { U.task = current; U.error = ''; U.bad = []; }
  const pips = hintList.map((h, k) => `<span class="pip${hints > k ? ' is-used' : ''}"></span>`).join('');
  const id = (i, suffix) => `yl-task${i}-${suffix}`;

  const clueBox = t => `<div class="clue-box">
            ${t.cluesTitle ? `<p class="label">${esc(t.cluesTitle)}</p>` : ''}
            <ul class="clue-list">
              ${t.clues.map(c => `<li>${esc(c)}</li>`).join('')}
            </ul>
          </div>`;

  const items = tasks.map((t, i) => {
    const r = results[i];
    const num = i + 1;
    const rowTitle = num + '．' + t.title;
    if (isSet(r)) {
      const d = L.drafts[i] || {};
      const skipped = r === 'skipped';
      return `<div class="task-row" id="${id(i, 'row')}" tabindex="-1">
          <span class="task-check">${ICONS.check}</span>
          <span class="task-row-main">
            <span class="task-row-title">${esc(rowTitle)}</span>
            <span class="task-row-sub">${skipped ? '放棄作答' : esc(d.got || t.show)}</span>
          </span>
          ${skipped
            ? `<span class="tag tag-res">${ICONS.skip}已跳過</span>`
            : '<span class="tag tag-res">自行解出</span>'}
        </div>`;
    }
    if (i !== current) {
      return `<div class="task-row is-locked">
          <span class="task-lock">${ICONS.lock}</span>
          <span class="task-row-main">
            <span class="task-row-title">${esc(rowTitle)}</span>
            <span class="task-row-sub">完成上一個任務後開啟</span>
          </span>
        </div>`;
    }

    // ---- 目前任務（展開作答） ----
    const raw = L.drafts[i];
    const d = Object.assign(blankDraft(), raw && raw.got === undefined ? raw : {});
    const wrong = U.error === 'wrong';
    const badAt = k => wrong && U.bad && U.bad[k];
    const errId = id(i, 'err');
    const invalid = on => (on ? ` aria-invalid="true" aria-describedby="${errId}"` : '');
    const hasClues = (t.clues || []).length > 0;
    let body = '';

    if (hasClues && t.cluesFirst) body += clueBox(t);
    if (t.prompt) body += `<p class="task-body">${esc(t.prompt)}</p>`;
    if (hasClues && !t.cluesFirst) body += clueBox(t);

    if (t.figure && FIGS[t.figure]) {
      const f = FIGS[t.figure];
      body += `<div class="fig-wrap">
            <button class="fig" id="${id(i, 'fig')}" type="button" data-action="fig" data-fig="${esc(t.figure)}" aria-label="點開放大：${esc(f.title)}">
              <img class="fig-img" src="${f.src}" alt="">
              <span class="fig-cap">${ICONS.zoom}點開放大</span>
            </button>
            <p class="fig-title">${esc(f.title)}</p>
          </div>`;
    }

    if (t.type === 'text' || t.type === 'number') {
      const mode = t.type === 'number' ? 'numeric' : 'text';
      body += `<div class="field">
            <label class="field-label" for="${id(i, 'answer')}">你的答案</label>
            <input id="${id(i, 'answer')}" class="input${wrong ? ' is-error' : ''}" type="text" inputmode="${mode}" value="${esc(d.text)}" placeholder="${esc(t.placeholder || '輸入你的答案')}" ${INPUT_ATTRS}
              data-i="${i}" data-enter="submit"${invalid(wrong)}>
          </div>`;
    }

    if (t.type === 'fields') {
      const layout = t.layout || 'stack';
      const val = k => esc((d.vals && d.vals[k]) || '');
      const input = (f, k, extra) => `<input id="${id(i, 'field' + k)}" class="input${badAt(k) ? ' is-error' : ''}" type="text" ${extra} value="${val(k)}" ${INPUT_ATTRS}
                data-i="${i}" data-k="${k}" data-enter="submit"${invalid(badAt(k))}>`;
      if (layout === 'grid2' || layout === 'grid3' || layout === 'row') {
        const gridCls = layout === 'grid3' ? 'mfields is-3' : (layout === 'row' ? 'mfields is-5' : 'mfields');
        body += `<div class="${gridCls}">
            ${t.fields.map((f, k) => `<div class="field">
              <label class="field-label" for="${id(i, 'field' + k)}">${esc(f.label)}</label>
              ${input(f, k, `inputmode="${f.numeric ? 'numeric' : 'text'}" placeholder="${esc(f.numeric ? '' : (t.placeholder || ''))}"`)}
            </div>`).join('')}
          </div>`;
      } else if (layout === 'inline') {
        body += `<div class="fld-stack">
            ${t.fields.map((f, k) => `<div class="fld-inline">
              <label class="fld-label" for="${id(i, 'field' + k)}"><span class="field-label">${esc(f.label)}</span><span class="fld-clue">${esc(f.clue || '')}</span></label>
              ${input(f, k, `inputmode="${f.numeric ? 'numeric' : 'text'}" placeholder="一字"`)}
            </div>`).join('')}
          </div>`;
      } else {
        body += `<div class="fld-stack">
            ${t.fields.map((f, k) => `<div class="field">
              <label class="fld-label" for="${id(i, 'field' + k)}"><span class="field-label">${esc(f.label)}</span>${f.clue ? `<span class="fld-clue">${esc(f.clue)}</span>` : ''}</label>
              ${input(f, k, `inputmode="${f.numeric ? 'numeric' : 'text'}" placeholder="${esc(f.numeric ? '' : (t.placeholder || ''))}"`)}
            </div>`).join('')}
          </div>`;
      }
    }

    if (t.type === 'select') {
      const opts = selectOptions(lv, t);
      body += `<div class="fld-stack" style="gap: 10px;">
            ${(t.letters || []).map((l, k) => {
              const v = (d.vals && d.vals[k]) || '';
              return `<div class="sel-row">
              <label class="sel-key" for="${id(i, 'pick' + k)}">${esc(l)}</label>
              <div class="sel-wrap">
                <select id="${id(i, 'pick' + k)}" class="input sel${badAt(k) ? ' is-error' : ''}" data-i="${i}" data-k="${k}"${invalid(badAt(k))}>
                  <option value=""${v ? '' : ' selected'}>選擇老店</option>
                  ${opts.map(o => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}
                </select>
                ${ICONS.chevDown}
              </div>
            </div>`;
            }).join('')}
          </div>`;
    }

    let orderFull = true;
    if (t.type === 'order') {
      const order = d.order || [];
      const total = (t.items || []).length;
      orderFull = order.length >= total;
      body += `<div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="order-head" style="display: flex; align-items: center; justify-content: space-between;">
              <p class="label" style="font-size: 18px;">目前順序　<span style="font-weight: 400; font-size: 16px;">已選 ${order.length}/${total}</span></p>
              <button class="btn btn-text" id="${id(i, 'clear')}" type="button" data-action="clearOrder" data-i="${i}" style="min-height: 48px; padding: 0 4px 0 8px; gap: 6px; text-decoration: none;">
                ${ICONS.retry}清除重來
              </button>
            </div>
            <div class="slots is-5" aria-live="polite">
              ${t.items.map((it, k) => {
                const label = order[k] || '';
                return `<div class="slot${label ? ' is-filled' : ''}">
                <span class="slot-n">${k + 1}</span>
                ${label ? `<span class="slot-label">${esc(label)}</span>` : '<span>－</span>'}
              </div>`;
              }).join('')}
            </div>
          </div>
          <div class="chips is-1">
            ${t.items.map((it, k) => {
              const idx = order.indexOf(it[0]);
              const sel = idx >= 0;
              return `<button class="chip${sel ? ' is-on' : ''}" id="${id(i, 'chip' + k)}" type="button" data-action="pick" data-i="${i}" data-k="${k}"${!sel && orderFull ? ' disabled' : ''} aria-pressed="${sel ? 'true' : 'false'}"><span class="chip-num">${sel ? idx + 1 : ''}</span><span>${esc(it[0])}</span><span class="chip-sub">${esc(it[1])}</span></button>`;
            }).join('')}
          </div>`;
    }

    if (t.type === 'choice') {
      body += `<div class="opts">
            ${t.options.map((o, k) => {
              const on = d.choice === o[0];
              return `<button class="opt is-long${on ? ' is-on' : ''}" id="${id(i, 'opt' + k)}" type="button" data-action="choose" data-i="${i}" data-k="${k}" aria-pressed="${on ? 'true' : 'false'}"><span class="opt-key">${esc(o[0])}</span><span>${esc(o[1])}</span></button>`;
            }).join('')}
          </div>`;
    }

    if (U.error) body += `<p class="err" id="${errId}" role="alert">${ICONS.warn}${esc(errorFor(t, U.error))}</p>`;

    // 「查看提示」與「跳過此題」共用同一個 id，換成跳過按鈕後焦點仍能回到這裡
    const help = hintsOut
      ? `<button class="btn btn-skip" id="lv-help" type="button" data-action="skip">
              <span class="btn-left">${ICONS.skip}跳過此題</span>
              <span class="meta">${hintList.length ? '提示已用完' : '這題沒有提示'}</span>
            </button>`
      : `<button class="btn btn-hint" id="lv-help" type="button" data-action="hint">
              <span class="btn-left">${ICONS.hint}查看提示</span>
              <span class="meta">已用 ${hints}/${hintList.length}<span class="pips">${pips}</span></span>
            </button>`;
    const submitLabel = t.type === 'order' ? '送出順序' : '送出答案';
    const submitDisabled = t.type === 'order' && !orderFull;

    return `<div class="task" id="${id(i, 'open')}" tabindex="-1">
          <div class="task-head-static">
            <span class="num is-on">${num}</span>
            <span class="task-row-main">
              <span class="task-type">任務 ${num}・${esc(typeName(t))}</span>
              <span class="task-title">${esc(t.title)}</span>
            </span>
          </div>
          ${body}
          <div class="task-actions">
            ${help}
            <button class="btn btn-primary" id="${id(i, 'submit')}" type="button" data-action="submit" data-i="${i}"${submitDisabled ? ' disabled' : ''}>${submitLabel}</button>
          </div>
        </div>`;
  }).join('');

  const doneCount = results.filter(isSet).length;
  const skippedCount = results.filter(r => r === 'skipped').length;
  const allDone = current < 0;
  const segs = tasks.map((t, i) => `<span class="seg-i${isSet(results[i]) ? ' is-done' : (i === current ? ' is-now' : '')}"></span>`).join('');
  // 只列目前這個任務看過的提示
  const seen = hints > 0 ? `
    <div class="hint-list">
      ${hintList.slice(0, hints).map((h, k) => `<p class="hint-item">${ICONS.hint}<span><b>任務 ${current + 1}・${k === 0 ? '提示一' : '提示二'}</b>　${esc(h)}</span></p>`).join('')}
    </div>` : '';
  const banner = allDone ? `
    <div class="pass-banner" id="lv-done" tabindex="-1">
      <div class="pass-head">
        <span class="mini-seal"><span>過關</span></span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <p class="p" style="font-weight: 700;">本關任務全部完成！</p>
          ${skippedCount > 0 ? `<p class="small">有 ${skippedCount} 個任務跳過，一樣算過關。</p>` : ''}
        </div>
      </div>
      <button class="btn btn-primary" type="button" data-go="/level/${n}/result">查看本關結果
        ${ICONS.arrow}
      </button>
    </div>` : '';

  /* ---- 動作 ---- */
  const draftOf = (s, i) => {
    const X = levelState(s, n, tasks.length);
    const cur = X.drafts[i];
    if (!cur || cur.got !== undefined) X.drafts[i] = blankDraft();
    const dd = X.drafts[i];
    if (!Array.isArray(dd.vals)) dd.vals = ['', '', '', '', ''];
    if (!Array.isArray(dd.order)) dd.order = [];
    return dd;
  };
  const clearErr = () => { U.error = ''; U.bad = []; };

  // 完成目前任務（答對或跳過），焦點移到下一個任務或過關橫幅
  const complete = (i, result, got) => {
    app.store.update(s => {
      const X = levelState(s, n, tasks.length);
      if (isSet(X.results[i])) return;
      X.results[i] = result;
      X.drafts[i] = { got };
      if (X.results.every(isSet) && !X.completedAt) X.completedAt = new Date().toISOString();
    });
    clearErr();
    const next = app.state.levels[String(n)].results.findIndex(r => !isSet(r));
    const sel = next < 0 ? '#lv-done' : '#' + id(next, 'open');
    app.refresh({ focus: sel });
    // 讓剛完成的那一列（「自行解出／已跳過」）和下一個任務的開頭一起出現在頂部列下方
    const row = app.root.querySelector('#' + id(i, 'row'));
    const el = app.root.querySelector(sel);
    const bar = app.root.querySelector('.topbar');
    if (row && el && bar) {
      const top = bar.getBoundingClientRect().bottom + 8;
      const r = row.getBoundingClientRect(), e = el.getBoundingClientRect();
      if (r.top < top || e.top > window.innerHeight - 160) window.scrollBy(0, r.top - top);
    }
  };

  const showHint = async () => {
    const i = app.state.levels[String(n)].results.findIndex(r => !isSet(r));
    if (i < 0) return;
    const list = taskHints(tasks[i]);
    const used = usedHints(app.state.levels[String(n)], i, list);
    if (used >= list.length) return;
    const last = used === list.length - 1;
    const ok = await openDialog({
      title: !last ? '要查看提示一嗎？' : (list.length === 1 ? '要查看提示嗎？' : '這是這個任務最後一則提示'),
      body: !last ? '這個任務有兩則提示，看完還剩 1 則。' : '確定要查看嗎？看完之後，如果還是想不出來，可以跳過這個任務。',
      icon: 'hint',
      buttons: [
        { label: last ? '查看最後提示' : '確認查看', value: true, kind: 'primary' },
        { label: '取消', value: false, kind: 'secondary' },
      ],
    });
    if (ok !== true || app.path !== '/level/' + n) return;
    if (app.state.levels[String(n)].results.findIndex(r => !isSet(r)) !== i) return;
    const h = app.store.update(s => {
      const X = levelState(s, n, tasks.length);
      if (!X.taskHints || typeof X.taskHints !== 'object') X.taskHints = {};
      X.taskHints[i] = Math.min(list.length, usedHints(X, i, list) + 1);
      return X.taskHints[i];
    });
    app.refresh({ focus: '#lv-help' });
    await openDialog({
      headHtml: `<div class="modal-head" style="justify-content: space-between;">
          <h2 class="h2" id="dlg-title">${h >= 2 ? '提示二' : '提示一'}</h2>
          <span class="tag tag-done">${h >= list.length ? '提示已用完' : '剩餘 ' + (list.length - h) + ' 則提示'}</span>
        </div>`,
      body: list[Math.max(0, h - 1)] || '',
      buttons: [{ label: '我知道了', value: true, kind: 'primary' }],
    });
    // 看過的提示加在頁面上方、下面的內容往下移：把提示／跳過按鈕捲回畫面內
    if (app.path === '/level/' + n) app.reveal(app.root.querySelector('#lv-help'), { block: 'nearest' });
  };

  // 跳過：不顯示答案，記成「已跳過」（以前的「揭曉答案」會被拿來先看答案、再重新開始作弊）
  const showSkip = async () => {
    const i = app.state.levels[String(n)].results.findIndex(r => !isSet(r));
    if (i < 0) return;
    const ok = await openDialog({
      title: '要跳過這個任務嗎？',
      body: `跳過後不會顯示「${tasks[i].title}」的答案，這個任務會記錄為「已跳過」，接著就能繼續下一個任務。`,
      icon: 'skip',
      buttons: [
        { label: '跳過此題', value: true, kind: 'primary' },
        { label: '再想一下', value: false, kind: 'secondary' },
      ],
    });
    if (ok !== true || app.path !== '/level/' + n) return;
    complete(i, 'skipped');
  };

  return {
    title: lv.no,
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '關卡選單', to: '/menu' }, tag: lv.no })}
  <div class="lvbar">
    <div class="lvbar-row">
      <p class="lvbar-count">任務 ${doneCount}/${tasks.length}</p>
      ${hintList.length ? `<span class="lvbar-hint">本題提示 已用 ${hints}/${hintList.length}<span class="pips" aria-hidden="true">${pips}</span></span>` : ''}
    </div>
    <div class="seg" role="img" aria-label="任務進度 ${doneCount}/${tasks.length}">
      ${segs}
    </div>
  </div>
  <main class="content" style="gap: 10px;">
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <p class="kicker">${ICONS.pin}${esc(lv.place)}</p>
      <h1 class="h1" style="font-size: 26px; line-height: 36px;">${esc(lv.title)}</h1>
    </div>
    ${lv.intro ? `<div class="panel"><p class="p">${esc(lv.intro)}</p></div>` : ''}
    ${seen}
    ${items}
    ${banner}
  </main>
</div>`,
    bind(root) {
      // 輸入只存草稿、不重畫（打字和焦點不會跑掉）；一改輸入就清掉錯誤（同原型 error: ''）
      const onEdit = el => {
        const i = Number(el.dataset.i);
        app.store.update(s => {
          const dd = draftOf(s, i);
          if (el.dataset.k !== undefined) {
            const vals = dd.vals.slice();
            vals[Number(el.dataset.k)] = el.value;
            dd.vals = vals;
          } else {
            dd.text = el.value;
          }
        });
        if (U.error) {
          clearErr();
          const task = el.closest('.task');
          task.querySelectorAll('.err').forEach(e => e.remove());
          task.querySelectorAll('.input').forEach(x => {
            x.classList.remove('is-error');
            x.removeAttribute('aria-invalid');
            x.removeAttribute('aria-describedby');
          });
        }
      };
      root.querySelectorAll('input[data-i]').forEach(el => el.addEventListener('input', () => onEdit(el)));
      root.querySelectorAll('select[data-i]').forEach(el => el.addEventListener('change', () => onEdit(el)));
    },
    actions: {
      submit: el => {
        const i = Number(el.dataset.i);
        const t = tasks[i];
        if (!t || i !== app.state.levels[String(n)].results.findIndex(r => !isSet(r))) return;
        const raw = app.state.levels[String(n)].drafts[i];
        const d = Object.assign(blankDraft(), raw && raw.got === undefined ? raw : {});
        app.store.update(s => { const X = levelState(s, n, tasks.length); X.attempts = (X.attempts || 0) + 1; });
        const r = checkYouth(t, d);
        if (r.ok) { complete(i, 'self', hitText(t, d)); return; }
        U.error = r.empty ? 'empty' : 'wrong';
        U.bad = r.bad || [];
        const firstBad = !r.empty ? U.bad.findIndex(Boolean) : -1;
        let focus = null;
        if (firstBad >= 0) focus = '#' + id(i, (t.type === 'select' ? 'pick' : 'field') + firstBad);
        else if (el.tagName === 'INPUT') focus = '#' + el.id;
        app.refresh({ focus });
      },
      fig: el => {
        const f = FIGS[el.dataset.fig];
        if (f) openZoom(f.src, f.alt, f.title);
      },
      pick: el => {
        const i = Number(el.dataset.i);
        const it = tasks[i].items[Number(el.dataset.k)];
        const total = tasks[i].items.length;
        app.store.update(s => {
          const dd = draftOf(s, i);
          if (dd.order.indexOf(it[0]) >= 0 || dd.order.length >= total) return;
          dd.order = dd.order.concat([it[0]]);
        });
        clearErr();
        const full = app.state.levels[String(n)].drafts[i].order.length >= total;
        app.refresh({ focus: full ? '#' + id(i, 'submit') : '#' + el.id });
      },
      clearOrder: el => {
        const i = Number(el.dataset.i);
        app.store.update(s => { draftOf(s, i).order = []; });
        clearErr();
        app.refresh({ focus: '#' + el.id });
      },
      choose: el => {
        const i = Number(el.dataset.i);
        const o = tasks[i].options[Number(el.dataset.k)];
        app.store.update(s => { draftOf(s, i).choice = o[0]; });
        clearErr();
        app.refresh({ focus: '#' + el.id });
      },
      hint: () => showHint(),
      skip: () => showSkip(),
    },
  };
}

/* ======================================================================
   本關完成（T10Correct / T10Revealed；有跳過的任務就不顯示「本關答案」）
   ====================================================================== */

function resultScreen(params, app) {
  const n = Number(params.n);
  const lv = app.content.levels[n - 1];
  if (!Number.isInteger(n) || !lv) return app.redirect('/menu');
  const L = app.state.levels[String(n)];
  // 還沒過關就打開結果網址 → 回關卡頁（關卡頁會再處理未開放的情況）
  if (!levelDone('youth', lv, L)) return app.redirect('/level/' + n);
  const skipped = L.results.some(r => r === 'skipped');
  const k = (app.content.levelKeys || [])[n - 1] || {};
  const key = k.key || '';
  const big = Array.from(key).length <= 6;
  const title = k.title || lv.title;
  const sealText = skipped ? '本關\n完成' : '解謎\n成功';
  const sealAria = skipped ? '本關完成' : '解謎成功';
  const heading = skipped ? '本關完成' : '本關解開了！';
  const message = skipped
    ? '這一關有跳過的任務，一樣算過關。一起來認識它背後的故事吧！'
    : '你們自己解開了「' + title + '」，觀察得真仔細！';
  return {
    title: lv.no + ' 完成',
    html: `<div class="screen">
  <div class="topbar" style="justify-content: center; padding: env(safe-area-inset-top) 20px 0;">
    <span class="topbar-tag">${esc((k.no || lv.no) + '・' + (k.place || lv.place))}</span>
    <span class="ver-tag is-youth" style="position: absolute; right: 16px; top: calc(18px + env(safe-area-inset-top));">青年場</span>
  </div>
  <main class="content" style="align-items: center; justify-content: center; text-align: center; gap: 20px; padding: 24px 24px;">
    <div class="seal" role="img" aria-label="${sealAria}">
      <div class="seal-ring">${esc(sealText)}</div>
    </div>
    <h1 class="h1">${heading}</h1>
    ${skipped ? '' : `<div class="panel" style="width: 100%; align-items: center; padding: 20px 16px; gap: 4px;">
      <p class="label">本關答案</p>
      ${big
        ? `<p style="margin: 0; font-size: 34px; line-height: 44px; font-weight: 700; color: #a42006;">${esc(key)}</p>`
        : `<p style="margin: 0; font-size: 22px; line-height: 32px; font-weight: 700; color: #a42006;">${esc(key)}</p>`}
    </div>`}
    <p class="p" style="max-width: 320px;">${esc(message)}</p>
  </main>
  <div class="actions">
    <button class="btn btn-primary" type="button" data-go="/level/${n}/history">查看歷史補充
      ${ICONS.arrow}
    </button>
  </div>
</div>`,
  };
}

export function registerYouth(app) {
  app.route('/story', storyScreen);
  app.route('/menu', menuScreen);
  app.route('/map', mapScreen);
  app.route('/level/:n', levelScreen);
  app.route('/level/:n/result', resultScreen);
  app.route('/ending', endingScreen);
}
