// 親子場專屬畫面（HANDOFF §6.3、§7.2、§7.4）。
//
// registerFamily(app) 由 site/family/index.html 呼叫，註冊：
//   '/menu'       關卡選單  F06Menu / F06MenuMid / F06MenuNpcLeft / F06MenuClear
//   '/map'        廟街地圖  F06Map（內嵌 SVG，逐字複製）
//   '/level/:n'   關卡頁    F07Level ＋ F07Ciyou / F07Shop / F07MishiNumber / F07MishiBonus /
//                           F07ChaoReveal / F07WushengDone、FComponents
// 共用畫面（'/', '/name', '/npc/:key', '/level/:n/history', '/summary'）沿用 screens-common.js / npc.js。
//
// 關卡頁規則（原型 F07Level renderVals() 逐項移植）
// - 7 關全部開放；關內任務全部開放、預設收合、一次只展開一個（展開狀態不存檔）。
// - 判定一律用 answers.js 的 checkFamily()。
// - 進度存在 state.levels[n]：results（null | 'self' | 'revealed'）、hints（整關共用，最多 2）、
//   drafts[i] = { photoOk, choice, digits, fields: [a, b], text }（完成後刪除）、startedAt、completedAt、attempts。
// - 加分題（bonus）：沒有提示、不能揭曉；答對得一顆星。拍照任務（photo）也沒有提示、不能揭曉。
// - 兩次提示用完後，還沒完成的非加分、非拍照任務（拍照＋文字題要先按「我拍好了」）出現「揭曉答案」。

import { esc, ICONS, icon, CARD_ICONS, starSvg, topbar, openDialog, onUiReset } from './ui.js';
import { openRules, rulesButton } from './screens-common.js';
import { checkFamily } from './answers.js';
import { levelState } from './store.js';
import { levelStatus, levelDone, npcDone, stars as countStars } from './progress.js';

const HMAX = 2;
const isSet = r => r !== null && r !== undefined;
const STAR_PATH = '<path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>';
const INPUT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"';
const ERR_EMPTY = '請先作答，再按「送出答案」。';
const ERR_WRONG = '答案似乎不正確，再觀察一次現場吧。';

/* ====================================================================
   關卡選單（F06Menu）
   ==================================================================== */
const STATUS_LABEL = { todo: '未完成', doing: '進行中', done: '已完成' };

function statusTags(s) {
  if (s === 'done') return `<span class="tag tag-done">${ICONS.check}已完成</span>`;
  if (s === 'doing') return '<span class="tag tag-doing">進行中</span>';
  return '<span class="tag tag-todo">未完成</span>';
}

// 這一關的加分題是否全部答對（有加分題才有意義）
function bonusEarned(level, L) {
  const idx = level.tasks.map((t, k) => (t.bonus ? k : -1)).filter(k => k >= 0);
  return idx.length > 0 && !!L && idx.every(k => L.results[k] === 'self');
}

function menuScreen(params, app) {
  const st = app.state;
  // 暫定：還沒取隊名就打開選單 → 先去取名（選單頂端要顯示隊名）
  if (!st.team) return app.redirect('/name');
  const { levels, menu, npc } = app.content;
  const s = app.summary();
  const starCount = countStars(levels, st).got;

  const cards = menu.levels.map((c, i) => {
    const n = i + 1;
    const level = levels[i];
    const status = levelStatus('family', levels, st, n);
    const hasBonus = level ? level.tasks.some(t => t.bonus) : !!c.bonus;
    const starOn = hasBonus && bonusEarned(level, st.levels[String(n)]);
    const cls = status === 'doing' ? ' is-doing' : (status === 'done' ? ' is-done' : '');
    const aria = c.no + '，' + c.place + '，' + c.task + (hasBonus ? '，有加分題' : '') + '，' + STATUS_LABEL[status]
      + (starOn ? (status === 'done' ? '並得到星星' : '，已得到星星') : '');
    return `<button class="lv lv-sm${cls}" type="button" data-go="/level/${n}" aria-label="${esc(aria)}">
        <span class="lv-img">
          ${CARD_ICONS[c.icon] || ''}
        </span>
        <span class="lv-main">
          <span class="lv-top">
            <span class="lv-no">${esc(c.no)}</span>
            <span class="lv-flags">
              ${hasBonus ? starSvg({ cls: starOn ? '' : 'is-empty' }) : ''}
              ${statusTags(status)}
            </span>
          </span>
          <span class="lv-place">${esc(c.place)}</span>
          <span class="lv-task">${esc(c.task)}</span>
        </span>
        <svg class="ico lv-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>
      </button>`;
  }).join('\n      ');

  const npcStatus = m => {
    const data = npc.find(x => x.key === m.key);
    if (data && npcDone(data, st)) return 'done';
    const N = st.npc && st.npc[m.key];
    return N && N.results.some(isSet) ? 'doing' : 'todo';
  };
  const npcCards = menu.npcs.map(m => {
    const status = npcStatus(m);
    const cls = status === 'doing' ? ' is-doing' : (status === 'done' ? ' is-done' : '');
    const aria = 'NPC ' + m.key + '，' + m.name + '，' + m.who + '，' + STATUS_LABEL[status];
    return `<button class="lv lv-sm${cls}" type="button" data-go="/npc/${esc(m.key)}" aria-label="${esc(aria)}">
        <span class="lv-img npc-letter" aria-hidden="true">${esc(m.key)}</span>
        <span class="lv-main">
          <span class="lv-top">
            <span class="lv-no">NPC ${esc(m.key)}</span>
            <span class="lv-flags">
              ${statusTags(status)}
            </span>
          </span>
          <span class="lv-place">${esc(m.name)}</span>
          <span class="lv-task">${esc(m.who)}</span>
        </span>
        <svg class="ico lv-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>
      </button>`;
  }).join('\n      ');

  const dots = levels.map((lv, i) => {
    const done = levelDone('family', lv, st.levels[String(i + 1)]);
    return `<span class="dot${done ? ' is-done' : ''}">${done ? ICONS.check : ''}</span>`;
  }).join('');
  const npcDots = menu.npcs.map(m =>
    `<span class="dot${npcStatus(m) === 'done' ? ' is-done' : ''}">${esc(m.key)}</span>`).join('');

  const levelsAll = s.levelsDone >= s.levelsTotal;
  const all = s.allClear;
  const npcLeft = s.npcsTotal - s.npcsDone;
  const levelsOnlyBanner = levelsAll && !all ? `
    <div class="pass-banner">
      <div class="pass-head">
        <span class="mini-seal"><span>七關</span></span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <p class="p" style="font-weight: 700;">七關都完成了！</p>
          <p class="small">再完成 ${npcLeft} 個 NPC 任務就全破。</p>
        </div>
      </div>
    </div>` : '';
  const allBanner = all ? `
    <div class="pass-banner">
      <div class="pass-head">
        <span class="mini-seal"><span>全破</span></span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <p class="p" style="font-weight: 700;">恭喜全破！</p>
          <p class="small">七關和 NPC 任務都完成了。</p>
        </div>
      </div>
    </div>` : '';
  const safety = all ? '' : `
    <p class="small" style="display: flex; gap: 8px; align-items: flex-start; margin-top: 4px;">
      ${icon('warn', 'margin-top: 1px;')}
      過馬路請牽好小朋友。在店家前拍照不用進店，也請不要打擾營業。
    </p>`;
  const bottom = all ? `
  <div class="actions">
    <button class="btn btn-primary" type="button" data-go="/summary">查看完成摘要
      ${ICONS.arrow}
    </button>
  </div>` : '';

  return {
    title: '關卡選單',
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '首頁', to: '/' }, right: rulesButton('padding-right: 4px;') })}
  <main class="content" style="gap: 12px;">
    <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
        <p class="label">隊伍</p>
        <h1 class="h2" style="font-size: 24px;">${esc(st.team)}</h1>
      </div>
      <p class="label"><span style="display: flex; align-items: center; gap: 4px;" role="img" aria-label="加分星星 ${starCount} 顆"><svg class="star" style="width: 20px; height: 20px;" viewBox="0 0 24 24" aria-hidden="true">${STAR_PATH}</svg>${starCount}</span></p>
    </div>
    <div class="prog2">
      <div class="prog2-row">
        <p class="prog2-label">關卡 <span class="prog2-n">${s.levelsDone}/${s.levelsTotal}</span></p>
        <div class="dots7" aria-hidden="true">${dots}</div>
      </div>
      <div class="prog2-row">
        <p class="prog2-label">NPC <span class="prog2-n">${s.npcsDone}/${s.npcsTotal}</span></p>
        <div class="dots3" aria-hidden="true">${npcDots}</div>
      </div>
    </div>${levelsOnlyBanner}${allBanner}
    <button class="map-entry" type="button" data-go="/map">
      <span class="map-thumb"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 12l12-5 16 5 12-5v29l-12 5-16-5-12 5z"></path><path d="M16 7v29M32 12v29"></path></svg></span>
      <span class="map-entry-main">
        <span class="map-entry-title">查看地圖</span>
        <span class="map-entry-sub">七個關卡在廟街上的位置</span>
      </span>
      ${ICONS.go}
    </button>
    <p class="small">共七關，每關有 2～7 個小任務，完成必答任務就能過關。</p>
    ${cards}
    <h2 class="h2" style="font-size: 20px; line-height: 28px; margin-top: 8px;">NPC 任務</h2>
    <p class="small">題目由 NPC 在現場口頭說明，沒有提示。七關和三個 NPC 任務都完成，才算全破。</p>
    ${npcCards}${safety}
  </main>${bottom}
</div>`,
    actions: {
      rules: () => openRules(app.edition),
    },
  };
}

/* ====================================================================
   廟街地圖（F06Map）— SVG 與圖例逐字複製；只把固定 350×640 的外框改成可縮放
   ==================================================================== */
const FAMILY_MAP_SVG = `<svg class="fmap" viewBox="0 0 700 1280" width="350" height="640" role="img" aria-label="廟街地圖，東在上、北在左。沿新莊路由上往下依序是：翁裕美商行、6 廣福宮、金合和糕餅、1 慈祐宮與斜對面的集合點林協記文化館、億德堂蔘藥行、3 戲館巷、4 米市巷與巷底的 7 潮江寺、5 武聖廟、日日用打鐵舖；响仁和在中正路上。">
        <rect class="bg" x="0" y="0" width="700" height="1280"></rect>

        <rect class="street" x="94" y="148" width="20" height="244"></rect>
        <path class="street-edge" d="M92.5 148V392M115.5 148V392"></path>
        <path class="street-dash" d="M104 104V144M104 396V436"></path>

        <rect class="street" x="366" y="695" width="81" height="21"></rect>
        <path class="lane-edge" d="M366 694H447M366 717H447"></path>
        <rect class="street" x="366" y="801" width="232" height="21"></rect>
        <path class="lane-edge" d="M366 800H596.5M366 823H596.5"></path>

        <rect class="street" x="598" y="776" width="20" height="264"></rect>
        <path class="street-edge" d="M596.5 776V800M596.5 823V1040M619.5 776V1040"></path>
        <path class="street-dash" d="M608 732V772M608 1044V1084"></path>

        <path class="road-dash" d="M316.5 28V68M362.5 28V68M316.5 1256V1280M362.5 1256V1280"></path>
        <rect class="road" x="316" y="72" width="48" height="1180"></rect>

        <rect class="knock" x="552" y="866" width="112" height="42"></rect>

        <rect class="tagbox" x="16.5" y="16.5" width="127" height="47" rx="10"></rect>
        <path class="shaft" d="M628 60H586"></path>
        <path class="solid" d="M558 60L592 45L585 60L592 75Z"></path>
        <path class="bar" d="M624 1096.5H648M636 1096.5V1227.5M624 1227.5H648"></path>

        <circle class="pin" cx="280" cy="207" r="27.5"></circle>
        <circle class="pin" cx="280" cy="566" r="27.5"></circle>
        <circle class="pin" cx="472" cy="706" r="27.5"></circle>
        <circle class="pin" cx="472" cy="812" r="27.5"></circle>
        <circle class="pin" cx="608" cy="824" r="27.5"></circle>
        <circle class="pin" cx="280" cy="943" r="27.5"></circle>
        <rect class="pin" x="258.5" y="118.5" width="43" height="43" rx="10"></rect>
        <rect class="pin" x="82.5" y="237.5" width="43" height="43" rx="10"></rect>
        <rect class="pin" x="378.5" y="409.5" width="43" height="43" rx="10"></rect>
        <rect class="pin" x="378.5" y="615.5" width="43" height="43" rx="10"></rect>
        <rect class="pin" x="258.5" y="1170.5" width="43" height="43" rx="10"></rect>
        <rect class="meet" x="372" y="555" width="128" height="51" rx="8"></rect>

        <text class="mid" x="80" y="51">示意圖</text>
        <text class="mid" x="660" y="73">北</text>

        <text class="end" x="244" y="151">翁裕美</text>
        <text class="end big" x="240" y="220">廣福宮</text>
        <text x="141" y="271">响仁和</text>
        <text x="438" y="442">金合和</text>
        <text class="end big" x="240" y="579">慈祐宮</text>
        <text class="mid light" x="436" y="592">集合點</text>
        <text x="514" y="592">林協記</text>
        <text x="438" y="648">億德堂</text>
        <text class="big" x="514" y="718">戲館巷</text>
        <text class="mid big" x="472" y="884">米市巷</text>
        <text class="mid big" x="608" y="900">潮江寺</text>
        <text class="end big" x="240" y="955">武聖廟</text>
        <text class="end" x="244" y="1204">日日用</text>

        <text class="mid" x="52" y="300">中</text>
        <text class="mid" x="52" y="336">正</text>
        <text class="mid" x="52" y="372">路</text>
        <text class="mid" x="340" y="301">新</text>
        <text class="mid" x="340" y="337">莊</text>
        <text class="mid" x="340" y="373">路</text>
        <text class="mid" x="340" y="1057">新</text>
        <text class="mid" x="340" y="1093">莊</text>
        <text class="mid" x="340" y="1129">路</text>
        <text class="mid" x="664" y="951">碧</text>
        <text class="mid" x="664" y="987">江</text>
        <text class="mid" x="664" y="1023">街</text>

        <text class="end reg" x="611" y="1156">沿街</text>
        <text class="end reg" x="611" y="1192">100 公尺</text>

        <text class="mid fig" x="280" y="218">6</text>
        <text class="mid fig" x="280" y="577">1</text>
        <text class="mid fig" x="472" y="717">3</text>
        <text class="mid fig" x="472" y="823">4</text>
        <text class="mid fig" x="608" y="835">7</text>
        <text class="mid fig" x="280" y="954">5</text>
        <text class="mid fig-sq" x="280" y="151">2</text>
        <text class="mid fig-sq" x="104" y="270">2</text>
        <text class="mid fig-sq" x="400" y="442">2</text>
        <text class="mid fig-sq" x="400" y="648">2</text>
        <text class="mid fig-sq" x="280" y="1203">2</text>
      </svg>`;

function mapScreen(params, app) {
  return {
    title: '廟街地圖',
    // 設計稿這頁沒有 h1：把頂部列的「廟街地圖」標籤做成 h1（外觀不變），換頁時焦點才有地方去
    html: `<div class="screen">
  <div class="topbar">
    <button class="btn btn-back" type="button" data-go="/menu">${ICONS.back}關卡選單</button>
    <div class="topbar-right">
      <h1 class="topbar-tag" style="margin: 0;">廟街地圖</h1>
      <span class="ver-tag is-family">親子場</span>
    </div>
  </div>
  <main class="content" style="gap: 12px; overflow: visible;">
    <p class="route-note">${ICONS.compass}東在上、北在左；沿新莊路的距離依比例</p>
    <div style="flex: none; width: 100%; max-width: 350px;">
      ${FAMILY_MAP_SVG}
    </div>
    <p class="route-note">${ICONS.zoom}可以用兩指放大地圖</p>
    <h2 class="h2" style="font-size: 20px; line-height: 28px; margin-top: 4px;">圖例</h2>
    <ul class="legend2">
      <li class="lg-item"><span class="lg-mark lg-pin">1</span><span><b>慈祐宮</b><span class="lg-addr">（新莊路 218 號）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-sq">2</span><span><b>五間老店</b><span class="lg-addr">（方形標記）</span>
        <ul class="lg-sub">
          <li>翁裕美商行（新莊路 128 號）</li>
          <li>金合和糕餅（新莊路 269 號）</li>
          <li>億德堂蔘藥行（新莊路 325 號）</li>
          <li>日日用打鐵舖（新莊路 414 號）</li>
          <li>响仁和（中正路 173 號）</li>
        </ul>
      </span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">3</span><span><b>戲館巷</b><span class="lg-addr">（新莊路 359 巷）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">4</span><span><b>米市巷</b><span class="lg-addr">（新莊路 387 巷）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">5</span><span><b>武聖廟</b><span class="lg-addr">（新莊路 340 號）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">6</span><span><b>廣福宮</b><span class="lg-addr">（新莊路 150 號）</span></span></li>
      <li class="lg-item"><span class="lg-mark lg-pin">7</span><span><b>潮江寺</b><span class="lg-addr">（碧江街 47 號，米市巷底）</span></span></li>
      <li class="lg-item"><span class="lg-meet" aria-hidden="true"></span><span><b>集合點：林協記文化館</b><span class="lg-addr">（新莊路 317 號 2 樓，慈祐宮斜對面）</span></span></li>
    </ul>
  </main>
</div>`,
  };
}

/* ====================================================================
   關卡頁（F07Level）
   ==================================================================== */
const ui = {}; // 只在這次瀏覽有效：{ [n]: { open, errs: { [i]: 'empty' | 'wrong' } } }
onUiReset(() => { for (const k in ui) delete ui[k]; });

function typeName(t) {
  if (t.type === 'photo') return '拍照任務';
  if (t.photo) return '拍照＋文字題';
  if (t.type === 'number') return '數字題';
  if (t.type === 'choice') return '選擇題';
  if (t.type === 'multi') return '填空題';
  return '文字題';
}

// 完成後列上顯示的答案（原型 summary()）
function doneSummary(t) {
  if (t.type === 'photo') return '已拍照';
  if (t.type === 'choice') {
    const o = (t.options || []).find(x => x[0] === t.answer);
    return o ? o[0] + '．' + o[1] : '';
  }
  if (t.type === 'number') return String(t.answer) + ' ' + (t.unit || '');
  return t.show || '';
}

const blankDraft = () => ({ photoOk: false, choice: null, digits: '', fields: ['', ''], text: '' });

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

function displayInner(digits, unit) {
  return digits !== ''
    ? `<span>${esc(digits)}</span><span class="numpad-unit">${esc(unit || '')}</span>`
    : '<span class="numpad-ph">用下方的數字鍵輸入</span>';
}

function levelScreen(params, app) {
  const n = Number(params.n);
  const lv = app.content.levels[n - 1];
  if (!Number.isInteger(n) || n < 1 || !lv || String(n) !== String(params.n)) return app.redirect('/menu');
  const myPath = '/level/' + n;
  const tasks = lv.tasks;
  const total = tasks.length;
  const U = ui[n] || (ui[n] = { open: -1, errs: {} });
  // 只讀：還沒互動前不在存檔裡建立這一關
  const L = app.state.levels[String(n)] || { results: Array(total).fill(null), hints: 0, drafts: {} };
  const results = tasks.map((t, i) => (isSet(L.results[i]) ? L.results[i] : null));
  const hints = Math.max(0, Math.min(HMAX, Number(L.hints) || 0));
  const hintsOut = hints >= HMAX;
  if (U.open >= 0 && (U.open >= total || isSet(results[U.open]))) U.open = -1;
  const id = (i, suffix) => `task${i}-${suffix}`;
  const pip = k => (hints >= k ? 'is-used' : '');

  const items = tasks.map((t, i) => {
    const r = results[i];
    const num = i + 1;
    const helpable = !t.bonus && t.type !== 'photo';
    const bonusTag = t.bonus ? `<span class="tag tag-bonus">${starSvg()}加分題</span>` : '';

    if (isSet(r)) {
      let tag = '';
      if (r === 'revealed') tag = `<span class="tag tag-res">${ICONS.eye}已揭曉</span>`;
      else if (t.bonus) tag = `<span class="tag tag-bonus">${starSvg()}加分</span>`;
      else tag = `<span class="tag tag-res">${t.type === 'photo' ? '已完成' : '自行解出'}</span>`;
      return `<div class="task-row" id="${id(i, 'row')}" tabindex="-1">
          <span class="task-check">${ICONS.check}</span>
          <span class="task-row-main">
            <span class="task-row-title">${num}．${esc(t.title)}</span>
            <span class="task-row-sub">${esc(doneSummary(t))}</span>
          </span>
          ${tag}
        </div>`;
    }

    if (U.open !== i) {
      const sub = typeName(t) + (hintsOut && helpable ? '・可揭曉答案' : '');
      const aria = '任務 ' + num + '，' + t.title + '，' + typeName(t) + (t.bonus ? '，加分題' : '') + '，點開作答';
      return `<button class="task-toggle" id="${id(i, 'head')}" type="button" data-action="toggle" data-i="${i}" aria-expanded="false" aria-controls="${id(i, 'panel')}" aria-label="${esc(aria)}">
          <span class="num">${num}</span>
          <span class="task-row-main">
            <span class="task-row-title">${esc(t.title)}</span>
            <span class="task-row-sub">${esc(sub)}</span>
          </span>
          ${bonusTag}
          ${ICONS.chevDown}
        </button>`;
    }

    // 展開中的任務
    const d = Object.assign(blankDraft(), L.drafts && L.drafts[i]);
    if (!Array.isArray(d.fields)) d.fields = ['', ''];
    const err = U.errs[i] || '';
    const wrong = err === 'wrong';
    const showAnswer = t.type !== 'photo' && (!t.photo || !!d.photoOk);
    const errAttr = wrong ? ` aria-invalid="true" aria-describedby="${id(i, 'err')}"` : '';
    let body = `<p class="task-body">${esc(t.prompt)}</p>`;
    if (t.bonus) {
      body += `<p class="task-note">${starSvg()}答對可以得到一顆星；不答也不影響過關。</p>`;
    }
    if (t.type === 'photo') {
      // 「拍照範例圖（選填）」：目前沒有範例圖，整塊不顯示（HANDOFF §10）
      body += '<p class="task-note">照片存在你們自己的手機裡，不需要上傳。</p>';
    }
    if (t.photo && !d.photoOk) {
      body += `<div class="step">
            <p class="step-title"><span class="num">1</span>${esc(t.photo)}</p>
            ${t.photoNote ? `<p class="task-note">${ICONS.warn}${esc(t.photoNote)}</p>` : ''}
            <p class="task-note">照片存在你們自己的手機裡，不需要上傳。</p>
            <button class="btn btn-primary" id="${id(i, 'photo')}" type="button" data-action="photo" data-i="${i}">
              ${ICONS.camera}我拍好了
            </button>
          </div>
          <p class="step-next"><span class="num is-off">2</span>拍好照片後，再${esc(t.after || '作答')}</p>`;
    }
    if (t.photo && d.photoOk) {
      body += `<p class="task-note" style="font-weight: 700; align-items: center;"><span class="task-check" style="width: 28px; height: 28px;">${ICONS.check}</span>已拍照，接著${esc(t.after || '作答')}</p>`;
    }
    if (showAnswer && t.type === 'choice') {
      const opts = t.options || [];
      const grid = opts.length === 4 && opts.every(o => Array.from(o[1]).length <= 4);
      body += `<div class="${grid ? 'opts opts-grid' : 'opts'}" role="group" aria-label="${esc(t.title)}">
            ${opts.map(o => {
              const on = d.choice === o[0];
              return `<button class="opt${on ? ' is-on' : ''}" id="${id(i, 'opt-' + o[0])}" type="button" data-action="pick" data-i="${i}" data-k="${esc(o[0])}" aria-pressed="${on}"><span class="opt-key">${esc(o[0])}</span><span>${esc(o[1])}</span></button>`;
            }).join('\n            ')}
          </div>`;
    }
    if (showAnswer && t.type === 'multi') {
      body += `<div class="${t.stack ? 'mfields is-stack' : 'mfields'}">
            ${(t.fields || []).map((label, k) => `<div class="field">
              <label class="field-label" for="${id(i, 'field' + k)}">${esc(label)}</label>
              <input id="${id(i, 'field' + k)}" class="input${wrong ? ' is-error' : ''}" type="text" inputmode="${t.numeric ? 'numeric' : 'text'}" value="${esc(d.fields[k] || '')}" placeholder="${esc((t.placeholders || [])[k] || '')}" ${INPUT_ATTRS}
                data-i="${i}" data-k="${k}" data-enter="submit"${errAttr}>
            </div>`).join('\n            ')}
          </div>`;
    }
    if (showAnswer && t.type === 'number') {
      body += `<div class="numpad-display ${wrong ? 'is-error' : 'is-focus'}" id="${id(i, 'display')}" aria-live="polite">${displayInner(d.digits || '', t.unit)}</div>
          <div class="numpad">
            ${KEYS.map(k => {
              if (k === 'clear') return `<button class="key key-fn" id="${id(i, 'key-clear')}" type="button" data-action="key" data-i="${i}" data-k="clear" aria-label="清除全部">清除</button>`;
              if (k === 'back') return `<button class="key key-fn" id="${id(i, 'key-back')}" type="button" data-action="key" data-i="${i}" data-k="back" aria-label="刪除一個數字">刪除</button>`;
              return `<button class="key" id="${id(i, 'key-' + k)}" type="button" data-action="key" data-i="${i}" data-k="${k}" aria-label="數字 ${k}">${k}</button>`;
            }).join('\n            ')}
          </div>`;
    }
    if (showAnswer && t.type === 'text') {
      body += `<div class="field">
            <label class="field-label" for="${id(i, 'answer')}">你的答案</label>
            <input id="${id(i, 'answer')}" class="input${wrong ? ' is-error' : ''}" type="text" value="${esc(d.text || '')}" placeholder="${esc(t.placeholder || '輸入你的答案')}" ${INPUT_ATTRS}
              data-i="${i}" data-enter="submit"${errAttr}>
          </div>`;
    }
    if (err) {
      body += `<p class="err" id="${id(i, 'err')}" role="alert">${ICONS.warn}${err === 'empty' ? ERR_EMPTY : ERR_WRONG}</p>`;
    }

    let acts = '';
    if (helpable && !hintsOut) {
      acts += `<button class="btn btn-hint" id="${id(i, 'hint')}" type="button" data-action="hint" data-i="${i}">
              <span class="btn-left">${ICONS.hint}查看提示</span>
              <span class="meta">已用 ${hints}/${HMAX}<span class="pips" aria-hidden="true"><span class="pip ${pip(1)}"></span><span class="pip ${pip(2)}"></span></span></span>
            </button>`;
    }
    if (helpable && showAnswer && hintsOut) {
      acts += `<button class="btn btn-reveal" id="${id(i, 'reveal')}" type="button" data-action="reveal" data-i="${i}">
              <span class="btn-left">${ICONS.eye}揭曉答案</span>
              <span class="meta">提示已用完</span>
            </button>`;
    }
    if (t.type === 'photo') {
      acts += `<button class="btn btn-primary" id="${id(i, 'photo')}" type="button" data-action="photo" data-i="${i}">
              ${ICONS.camera}我拍好了
            </button>`;
    }
    if (showAnswer) {
      acts += `<button class="btn btn-primary" id="${id(i, 'submit')}" type="button" data-action="submit" data-i="${i}">送出答案</button>`;
    }

    return `<div class="task" id="${id(i, 'panel')}">
          <button class="task-head-btn" id="${id(i, 'head')}" type="button" data-action="toggle" data-i="${i}" aria-expanded="true" aria-controls="${id(i, 'panel')}" aria-label="收合任務 ${num}">
            <span class="num is-on">${num}</span>
            <span class="task-row-main">
              <span class="task-type">任務 ${num}・${typeName(t)}</span>
              <span class="task-title">${esc(t.title)}</span>
            </span>
            ${bonusTag}
            ${ICONS.chevUp}
          </button>
          ${body}
          ${acts ? `<div class="task-actions">
            ${acts}
          </div>` : ''}
        </div>`;
  }).join('\n    ');

  const doneCount = results.filter(isSet).length;
  const requiredDone = tasks.every((t, i) => !!t.bonus || isSet(results[i]));
  const starsGot = tasks.filter((t, i) => !!t.bonus && results[i] === 'self').length;
  const hasBonus = tasks.some(t => !!t.bonus);
  const segs = tasks.map((t, i) => {
    const r = results[i];
    const c = [];
    if (t.bonus) c.push('is-bonus');
    if (r === 'self' && t.bonus) c.push('is-star');
    else if (isSet(r)) c.push('is-done');
    else if (i === U.open) c.push('is-now');
    return `<span class="seg-i${c.length ? ' ' + c.join(' ') : ''}"></span>`;
  }).join('');

  const passBanner = requiredDone && doneCount < total ? `
    <div class="pass-banner" id="lv-pass" tabindex="-1">
      <div class="pass-head">
        <span class="mini-seal"><span>過關</span></span>
        <p class="p" style="font-weight: 700;">必答任務都完成了，本關過關！</p>
      </div>
      <p class="small">加分題可以挑戰，也可以直接看歷史故事。</p>
      <button class="btn btn-secondary" type="button" data-go="/level/${n}/history">查看歷史故事</button>
    </div>` : '';
  const allBanner = doneCount === total ? `
    <div class="pass-banner" id="lv-all" tabindex="-1">
      <div class="pass-head">
        <span class="mini-seal"><span>完成</span></span>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <p class="p" style="font-weight: 700;">本關任務全部完成！</p>
          ${starsGot > 0 ? `<p class="small" style="display: flex; align-items: center; gap: 6px;">${starSvg()}加分題答對，得到 ${starsGot} 顆星</p>` : ''}
        </div>
      </div>
      <button class="btn btn-primary" type="button" data-go="/level/${n}/history">查看歷史故事
        ${ICONS.arrow}
      </button>
    </div>` : '';
  const seen = hints > 0 ? `
    <div class="hint-list">
      ${lv.hints.slice(0, hints).map((h, k) =>
        `<p class="hint-item">${ICONS.hint}<span><b>${k === 0 ? '提示一' : '提示二'}</b>　${esc(h)}</span></p>`).join('\n      ')}
    </div>` : '';

  /* ---------- 動作 ---------- */
  const here = () => app.path === myPath;

  // 改存檔：取得（必要時建立）這一關的狀態
  function mutate(fn) {
    return app.store.update(s => {
      const M = levelState(s, n, total);
      if (!M.drafts) M.drafts = {};
      return fn(M, s);
    });
  }
  function touch(M) {
    if (!M.startedAt) M.startedAt = new Date().toISOString();
  }
  function draftOf(M, i) {
    const cur = M.drafts[i];
    const dd = Object.assign(blankDraft(), cur);
    if (!Array.isArray(dd.fields)) dd.fields = ['', ''];
    M.drafts[i] = dd;
    return dd;
  }

  // 重畫後把焦點放到第一個存在的元素
  function refreshTo(...sels) {
    app.refresh();
    for (const sel of sels) {
      const el = sel && app.root.querySelector(sel);
      if (el) { el.focus({ preventScroll: true }); return el; }
    }
    return null;
  }

  // 讓元素出現在畫面內（扣掉固定的頂部列與進度列）
  function reveal(el) {
    if (!el) return;
    const bar = app.root.querySelector('.lvbar');
    const top = bar ? bar.getBoundingClientRect().bottom : 0;
    const r = el.getBoundingClientRect();
    if (r.top < top + 8) window.scrollBy(0, r.top - top - 8);
    else if (r.top > window.innerHeight - 80) window.scrollBy(0, r.top - top - 8);
  }

  // 原型的「一改輸入就清掉錯誤」：不重畫，直接改 DOM
  function clearErrorInPlace(i) {
    if (!U.errs[i]) return;
    delete U.errs[i];
    const panel = app.root.querySelector('#' + id(i, 'panel'));
    if (!panel) return;
    panel.querySelectorAll('.err').forEach(e => e.remove());
    panel.querySelectorAll('input').forEach(x => {
      x.classList.remove('is-error');
      x.removeAttribute('aria-invalid');
      x.removeAttribute('aria-describedby');
    });
    const disp = panel.querySelector('.numpad-display');
    if (disp) disp.className = 'numpad-display is-focus';
  }

  function complete(i, result) {
    const lvDef = lv;
    const before = levelDone('family', lvDef, app.state.levels[String(n)]);
    mutate(M => {
      touch(M);
      M.results[i] = result;
      delete M.drafts[i];
      if (!M.completedAt && levelDone('family', lvDef, M)) M.completedAt = new Date().toISOString();
    });
    delete U.errs[i];
    U.open = -1;
    const M = app.state.levels[String(n)];
    const allDone = tasks.every((t, k) => isSet(M.results[k]));
    const passedNow = !before && levelDone('family', lvDef, M);
    const el = refreshTo(allDone ? '#lv-all' : (passedNow ? '#lv-pass' : '#' + id(i, 'row')));
    reveal(el);
  }

  return {
    title: lv.no,
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '關卡選單', to: '/menu' }, tag: lv.no })}
  <div class="lvbar" style="position: sticky; top: calc(64px + env(safe-area-inset-top)); z-index: 4;">
    <div class="lvbar-row">
      <p class="lvbar-count">任務 ${doneCount}/${total}</p>
      <span class="lvbar-hint">提示 已用 ${hints}/${HMAX}<span class="pips" aria-hidden="true"><span class="pip ${pip(1)}"></span><span class="pip ${pip(2)}"></span></span></span>
    </div>
    <div class="seg" role="img" aria-label="任務進度 ${doneCount}/${total}">
      ${segs}${hasBonus ? starSvg({ cls: starsGot > 0 ? '' : 'is-empty' }) : ''}
    </div>
  </div>
  <main class="content" style="gap: 10px;">
    <div style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px;">
      <p class="kicker">${ICONS.pin}${esc(lv.place)}</p>
      <h1 class="h2">${esc(lv.title)}</h1>
    </div>
    <p class="route-note">${ICONS.route}清單順序是建議路線，可自由選擇任務。</p>
    ${passBanner}${allBanner}${seen}
    ${items}
  </main>
</div>`,

    bind(root) {
      root.querySelectorAll('input[data-i]').forEach(input => {
        input.addEventListener('input', () => {
          const i = Number(input.dataset.i);
          mutate(M => {
            const dd = draftOf(M, i);
            if (input.dataset.k !== undefined) dd.fields[Number(input.dataset.k)] = input.value;
            else dd.text = input.value;
          });
          clearErrorInPlace(i);
        });
      });
    },

    actions: {
      toggle: el => {
        const i = Number(el.dataset.i);
        U.open = U.open === i ? -1 : i;
        const head = refreshTo('#' + id(i, 'head'));
        reveal(U.open === i ? app.root.querySelector('#' + id(i, 'panel')) : head);
      },

      pick: el => {
        const i = Number(el.dataset.i);
        const k = el.dataset.k;
        mutate(M => { draftOf(M, i).choice = k; });
        clearErrorInPlace(i);
        const group = el.closest('.opts');
        if (group) group.querySelectorAll('.opt').forEach(o => {
          const on = o === el;
          o.classList.toggle('is-on', on);
          o.setAttribute('aria-pressed', String(on));
        });
      },

      key: el => {
        const i = Number(el.dataset.i);
        const k = el.dataset.k;
        const digits = mutate(M => {
          const dd = draftOf(M, i);
          const cur = String(dd.digits || '');
          if (k === 'clear') dd.digits = '';
          else if (k === 'back') dd.digits = cur.slice(0, -1);
          else if (cur.length < 4) dd.digits = cur + k; // 最多 4 位數
          return dd.digits;
        });
        clearErrorInPlace(i);
        const disp = app.root.querySelector('#' + id(i, 'display'));
        if (disp) {
          disp.className = 'numpad-display is-focus';
          disp.innerHTML = displayInner(digits, tasks[i].unit);
        }
      },

      photo: el => {
        const i = Number(el.dataset.i);
        const t = tasks[i];
        if (!t || isSet(results[i])) return;
        if (t.type === 'photo') { complete(i, 'self'); return; }
        mutate(M => { touch(M); draftOf(M, i).photoOk = true; });
        delete U.errs[i];
        // 拍好之後焦點移到作答區（文字題的輸入框）
        refreshTo('#' + id(i, 'answer'), '#' + id(i, 'field0'), '#' + id(i, 'head'));
      },

      submit: el => {
        const i = Number(el.dataset.i);
        const t = tasks[i];
        if (!t || isSet((app.state.levels[String(n)] || { results: [] }).results[i])) return;
        const d = Object.assign(blankDraft(), (app.state.levels[String(n)] || { drafts: {} }).drafts[i]);
        if (t.photo && !d.photoOk) return;
        const r = checkFamily(t, d);
        mutate(M => { touch(M); M.attempts = (M.attempts || 0) + 1; });
        if (r.ok) { complete(i, 'self'); return; }
        U.errs[i] = r.empty ? 'empty' : 'wrong';
        const sel = el.tagName === 'INPUT' ? '#' + el.id : '#' + id(i, 'submit');
        refreshTo(sel);
      },

      hint: async el => {
        const i = Number(el.dataset.i);
        const h = Math.min(HMAX, Number((app.state.levels[String(n)] || {}).hints) || 0);
        if (h >= HMAX) return;
        const ok = await openDialog({
          icon: 'hint',
          title: h === 0 ? '要查看提示一嗎？' : '這是本關最後一次提示',
          body: h === 0 ? '本關共有兩次提示機會，看完還剩 1 次。' : '確定要查看嗎？看完之後，還沒完成的任務可以選擇揭曉答案。',
          buttons: [
            { label: h === 0 ? '確認查看' : '查看最後提示', value: true, kind: 'primary' },
            { label: '取消', value: false, kind: 'secondary' },
          ],
        });
        if (ok !== true || !here()) return;
        const nh = mutate(M => {
          touch(M);
          M.hints = Math.min(HMAX, (Number(M.hints) || 0) + 1);
          return M.hints;
        });
        await openDialog({
          headHtml: `<div class="modal-head" style="justify-content: space-between;">
          <h2 class="h2" id="dlg-title">${nh >= 2 ? '提示二' : '提示一'}</h2>
          <span class="tag tag-done">${nh >= HMAX ? '提示已用完' : '剩餘 ' + (HMAX - nh) + ' 次提示'}</span>
        </div>`,
          body: lv.hints[Math.max(0, nh - 1)] || '',
          buttons: [{ label: '我知道了', value: true, kind: 'primary' }],
        });
        if (!here()) return;
        refreshTo('#' + id(i, 'hint'), '#' + id(i, 'reveal'), '#' + id(i, 'submit'), '#' + id(i, 'head'));
      },

      reveal: async el => {
        const i = Number(el.dataset.i);
        const ok = await openDialog({
          icon: 'eye',
          title: '要揭曉這題的答案嗎？',
          body: '揭曉後會直接顯示答案，這個任務一樣算完成。',
          buttons: [
            { label: '揭曉答案', value: true, kind: 'primary' },
            { label: '再觀察一下', value: false, kind: 'secondary' },
          ],
        });
        if (ok !== true || !here()) return;
        const t = tasks[i];
        const M = app.state.levels[String(n)];
        if (!t || t.bonus || t.type === 'photo' || (M && isSet(M.results[i]))) return;
        complete(i, 'revealed');
      },
    },
  };
}

export function registerFamily(app) {
  app.route('/menu', menuScreen);
  app.route('/map', mapScreen);
  app.route('/level/:n', levelScreen);
}
