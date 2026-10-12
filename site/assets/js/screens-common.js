// 兩場共用的畫面：開始頁、隊伍名稱、歷史補充／介紹、完成摘要，以及遊戲說明、重新開始。
//
// registerCommon(app)
//   註冊 '/'、'/name'、'/level/:n/history'、'/summary'。
//   場次檔（youth.js / family.js）可以用 app.route() 註冊同一個 pattern 覆寫。
//
// 給場次檔重用的 helper
//   openRules(edition) → Promise        §6.5 遊戲說明彈窗（按「遊戲說明」才開，不會自動跳出）
//   restart(app) → Promise<boolean>     §6.6 重新開始：確認彈窗 → 只清這一場 → 前往 '#/name'
//   rulesButton(style?) → string        「遊戲說明」文字按鈕（data-action="rules"；
//                                       畫面 actions 裡要有 rules: () => openRules(app.edition)）
//   validateTeam(raw) → { ok, name, count, error }   §7.6 隊名驗證（可單元測試）
//   resultOf(app, n) → 'self' | 'revealed' | null    第 n 關結果（未過關 null）

import { CONFIG } from '../../config.js';
import { esc, ICONS, topbar, openDialog, confirmRestart, starSvg, onUiReset, resetUi } from './ui.js';
import { progressText, levelDone, levelRevealed, stars as countStars } from './progress.js';

/* ---------- 遊戲說明（§6.5） ---------- */
// 暫定：§6.5 草稿文案，Hugo 決定先用草稿
const RULES = {
  youth: [
    '每隊 2～4 人，共用一支手機。',
    '第一關請先到慈祐宮；解開後，其他五關的順序由你們決定。',
    '每關可以看兩次提示；提示用完後可以揭曉答案，一樣算過關。',
    'NPC 任務由現場的 NPC 口頭出題，沒有提示。',
    '六關和三個 NPC 任務都完成，就能看到結局。',
    '過馬路請注意安全；只需要用眼睛觀察，不必攀爬或觸摸廟裡的文物。',
  ],
  family: [
    '一家人共用一支手機，請大人陪著小朋友。',
    '七個關卡順序自由；每關完成必答任務就過關，答對加分題可以得到星星。',
    '每關可以看兩次提示；提示用完後可以揭曉答案。',
    '拍照任務在店家外面拍就好，不用進店，也不要打擾營業。',
    'NPC 任務由現場的 NPC 口頭出題，沒有提示。',
    '七關和三個 NPC 任務都完成後，把完成畫面拿給工作人員看。',
  ],
};

export function openRules(edition) {
  const items = (RULES[edition] || RULES.youth).map(t => `<li class="p">${esc(t)}</li>`).join('');
  return openDialog({
    title: '遊戲說明',
    bodyHtml: `<ul style="margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 8px;">${items}</ul>`,
    buttons: [{ label: '我知道了', value: true, kind: 'primary' }],
  });
}

export function rulesButton(style = 'align-self: center;') {
  return `<button class="btn btn-text" type="button" data-action="rules" style="${style}">遊戲說明</button>`;
}

/* ---------- 重新開始（§6.6） ---------- */
export async function restart(app) {
  const ok = await confirmRestart();
  if (!ok) return false;
  app.store.reset();
  resetUi();
  app.go('/name');
  return true;
}

/* ---------- 開始頁（Main / T02Continue / F02Start / F02StartContinue） ---------- */
function startScreen(params, app) {
  const s = app.summary();
  const st = app.state;
  const family = app.edition === 'family';
  const lead = family ? '七個關卡、三個 NPC 任務，' : '六個關卡、三個 NPC 任務，';
  const arrow = ICONS.arrow;
  const progress = s.hasProgress;
  const noSave = app.store.persistent ? '' :
    `<p class="err" role="status">${ICONS.warn}這個瀏覽器無法儲存進度，請不要關閉這個分頁。</p>`;
  const buttons = progress
    ? `<div class="panel" style="flex-direction: row; align-items: center; gap: 12px; padding: 12px 16px;">
        ${ICONS.okCircle}
        <p class="small" style="text-align: left;">${st.team ? `<b>${esc(st.team)}</b>　` : ''}${esc(progressText(s))}</p>
      </div>
      <button class="btn btn-primary" type="button" data-action="continue">繼續遊戲
        ${arrow}
      </button>
      <button class="btn btn-secondary" type="button" data-action="restart">開始探索</button>`
    : `<button class="btn btn-primary" type="button" data-go="/name">開始探索
        ${arrow}
      </button>`;
  return {
    title: '開始',
    html: `<div class="screen">
  <main class="content" style="padding: 40px 24px 24px; align-items: center; text-align: center; gap: 20px;">
    <img src="../assets/img/logo.webp" width="184" height="188" alt="新莊妙妙廟 Temple Street Revived 標誌" style="width: 184px; height: auto; display: block;">
    <p class="caps" style="font-weight: 700; color: #a42006;">新莊廟街・實境解謎</p>
    <h1 class="h1" style="font-size: 34px; line-height: 44px;">妙妙貓的廟街委託</h1>
    <p class="p" style="max-width: 320px;">${lead}<br>用眼睛在老街裡找出答案。</p>
    <p class="small" style="display: flex; align-items: center; gap: 8px;">
      ${ICONS.team}
      建議 2～4 人一組，共用一支手機
    </p>
    ${noSave}
  </main>
  <div class="actions">
    ${buttons}
    ${rulesButton()}
    <a class="btn btn-text" href="../" style="align-self: center; font-size: 16px; font-weight: 400;">不是這個場次？回到場次選擇</a>
  </div>
</div>`,
    actions: {
      continue: () => app.go(app.ed.continuePath(app.state)),
      restart: () => restart(app),
      rules: () => openRules(app.edition),
    },
  };
}

/* ---------- 隊伍名稱（T03Name / T03NameError，§7.6） ---------- */
export function validateTeam(raw) {
  const name = String(raw ?? '').trim();
  const count = Array.from(name).length;
  let error = '';
  if (count === 0) error = '請輸入隊伍名稱';
  else if (count > 12) error = '名稱請勿超過 12 個字';
  // 暫定：「中英文與數字」= Unicode 字母（含中日韓文字）與數字；名稱中間的空白也算不合法符號
  else if (/[^\p{L}\p{N}]/u.test(name)) error = '名稱只能使用中英文與數字';
  else if (count < 2) error = '名稱至少要 2 個字';
  return { ok: !error, name, count, error };
}

function nameScreen(params, app) {
  const family = app.edition === 'family';
  const placeholder = family ? '例如：妙妙一家人' : '例如：廟口探險隊';
  const value = app.state.team || '';
  const count = Array.from(value.trim()).length;
  return {
    title: '隊伍名稱',
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '返回', to: '/' } })}
  <main class="content" style="padding-top: 32px; gap: 24px;">
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <h1 class="h1">幫你的隊伍取個名字</h1>
      <p class="p">妙妙貓會在故事裡叫你們這個名字。</p>
    </div>
    <div class="field">
      <label class="field-label" for="team-name">隊伍名稱</label>
      <input id="team-name" class="input" type="text" placeholder="${esc(placeholder)}" value="${esc(value)}"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"
        data-enter="submit" aria-invalid="false" aria-describedby="team-name-help">
      <p class="err" id="team-name-err" role="alert" hidden></p>
      <p class="help" id="team-name-help"><span>2～12 個字，可用中英文與數字</span><span id="team-name-count">${count}/12</span></p>
    </div>
  </main>
  <div class="actions">
    <button class="btn btn-primary" type="button" data-action="submit">確認名稱</button>
  </div>
</div>`,
    bind(root) {
      const input = root.querySelector('#team-name');
      const err = root.querySelector('#team-name-err');
      const cnt = root.querySelector('#team-name-count');
      const paintCount = () => {
        const n = Array.from(input.value.trim()).length;
        cnt.textContent = n + '/12';
        // T03NameError：超過 12 字時字數變紅、粗體
        cnt.style.cssText = n > 12 ? 'font-weight: 700; color: #a42006;' : '';
      };
      paintCount();
      input.addEventListener('input', () => {
        paintCount();
        if (!err.hidden) {
          err.hidden = true;
          err.textContent = '';
          input.classList.remove('is-error');
          input.setAttribute('aria-invalid', 'false');
          input.setAttribute('aria-describedby', 'team-name-help');
        }
      });
    },
    actions: {
      submit: () => {
        const input = app.root.querySelector('#team-name');
        const err = app.root.querySelector('#team-name-err');
        const v = validateTeam(input.value);
        if (!v.ok) {
          err.innerHTML = ICONS.warn + esc(v.error);
          err.hidden = false;
          input.classList.add('is-error');
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', 'team-name-err team-name-help');
          input.focus();
          return;
        }
        app.store.update(s => {
          s.team = v.name;
          if (!s.startedAt) s.startedAt = new Date().toISOString();
        });
        resetUi(); // 序章從第 1 句（含隊名）開始，舊的錯誤訊息也不留
        app.go(app.ed.afterName);
      },
    },
  };
}

/* ---------- 歷史補充／介紹（T11History / F11History） ---------- */
export function resultOf(app, n) {
  const level = app.content.levels[n - 1];
  const L = app.state.levels[String(n)];
  if (!level || !levelDone(app.edition, level, L)) return null;
  return levelRevealed(L) ? 'revealed' : 'self';
}

const historyOpen = {}; // 「看更多」展開狀態（只在這次瀏覽有效）
onUiReset(() => { for (const k in historyOpen) delete historyOpen[k]; });

function historyScreen(params, app) {
  const n = Number(params.n);
  const h = app.content.history[n - 1];
  if (!Number.isInteger(n) || !h) return app.redirect('/menu');
  const res = resultOf(app, n);
  // 暫定：還沒過關就打開歷史頁 → 回關卡選單
  if (!res) return app.redirect('/menu');
  const family = app.edition === 'family';
  const tag = family ? `${h.no}・已完成` : `${h.no}・${res === 'revealed' ? '揭曉過關' : '自行解出'}`;
  const key = app.edition + n;
  const open = !!historyOpen[key];
  // 暫定（待問 Hugo）：設計稿的「現場照片：{place}」是佔位框；沒有照片時整塊不顯示。§10 只核准拿掉親子場拍照範例圖，這裡要不要顯示佔位框還沒確認。
  // 之後若在 history JSON 加 photo（圖片路徑）與 photoAlt，就會顯示。
  const photo = h.photo
    ? `<img src="${esc(h.photo)}" alt="${esc(h.photoAlt || '現場照片：' + h.place)}" style="display: block; width: 100%; height: auto;">`
    : '';
  const more = open ? `
    <section id="history-more" style="display: flex; flex-direction: column; gap: 4px;">
      <h2 class="h2">本關答案</h2>
      ${h.answers.map(a => `<div class="ans-row"><span class="ans-q">${esc(a[0])}</span><span class="ans-a">${esc(a[1])}</span></div>`).join('')}
    </section>
    <section style="display: flex; flex-direction: column; gap: 12px;">
      <h2 class="h2">歷史補充</h2>
      ${h.paras.map(p => `<p class="p">${esc(p)}</p>`).join('')}
      <p class="small">${esc(h.source)}</p>
    </section>` : '';
  return {
    title: h.no + (family ? ' 歷史介紹' : ' 歷史補充'),
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '關卡選單', to: '/menu' }, tag })}
  <main class="content" style="gap: 20px; padding-top: 24px;">
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <p class="kicker">${ICONS.pin}${esc(h.place)}</p>
      <h1 class="h1" style="font-size: 26px; line-height: 36px;">${esc(h.title)}</h1>
    </div>
    ${photo}
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <p class="label" style="color: #a42006;">一句話重點</p>
      <p class="keypoint">${esc(h.keyline)}</p>
    </div>
    ${more}
    <button id="history-toggle" class="btn btn-secondary" type="button" data-action="toggle" aria-expanded="${open}" aria-controls="history-more">${open ? '收合' : '看更多'}
      ${open ? ICONS.chevUp : ICONS.chevDown}
    </button>
  </main>
  <div class="actions">
    <button class="btn btn-primary" type="button" data-go="/menu">返回關卡選單</button>
  </div>
</div>`,
    actions: {
      toggle: () => { historyOpen[key] = !open; app.refresh({ focus: '#history-toggle' }); },
    },
  };
}

/* ---------- 完成摘要（F12Summary；青年場沿用同版面，沒有星星） ---------- */
function summaryScreen(params, app) {
  const s = app.summary();
  // 暫定：還沒全破就打開摘要網址 → 回關卡選單（避免提早看到通關碼）
  if (!s.allClear) return app.redirect(app.state.team ? '/menu' : '/');
  const family = app.edition === 'family';
  const { levels, npc } = app.content;
  const passcode = (CONFIG.passcode && CONFIG.passcode[app.edition]) || '';
  const st = countStars(levels, app.state);
  const rows = levels.map((lv, i) => {
    const n = i + 1;
    const revealed = resultOf(app, n) === 'revealed';
    const bonusIdx = lv.tasks.map((t, k) => (t.bonus ? k : -1)).filter(k => k >= 0);
    let star = '';
    if (family && bonusIdx.length) {
      const L = app.state.levels[String(n)];
      const got = !!L && bonusIdx.every(k => L.results[k] !== null && L.results[k] !== undefined);
      star = starSvg({ cls: got ? '' : 'is-empty', aria: got ? '加分題答對' : '加分題未完成' });
    }
    const tag = revealed
      ? `<span class="tag tag-res">${ICONS.eye}揭曉過關</span>`
      : `<span class="tag tag-res">${ICONS.check}自行解出</span>`;
    return `<div class="res-row">
            <span class="num">${n}</span>
            <span class="res-place">${esc(lv.place)}</span>
            ${tag}
            <span class="res-star">${star}</span>
          </div>`;
  }).join('');
  const npcRows = npc.map(x => `<div class="res-row">
            <span class="num npc-mini">${esc(x.key)}</span>
            <span class="res-place">${esc(x.name)}</span>
            <span class="tag tag-res">${ICONS.check}已完成</span>
            <span class="res-star"></span>
          </div>`).join('');
  const starPanel = family ? `
    <div class="panel" style="flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px;">
      ${starSvg({ cls: 'star-lg' })}
      <div style="display: flex; flex-direction: column;">
        <p class="label">加分星星</p>
        <p style="margin: 0; font-size: 26px; line-height: 34px; font-weight: 700;">${st.got} <span style="font-size: 18px;">／ ${st.max} 顆</span></p>
      </div>
      <p class="small" style="margin-left: auto; max-width: 150px;">答對加分題得到星星，不影響過關。</p>
    </div>` : '';
  const feedback = CONFIG.feedbackUrl
    ? `<a class="btn btn-primary" href="${esc(CONFIG.feedbackUrl)}" target="_blank" rel="noopener">填寫遊戲回饋</a>`
    : '';
  return {
    title: '完成摘要',
    html: `<div class="screen">
  <main class="content" style="gap: 20px; padding-top: 32px;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;">
      <div class="seal" style="width: 128px; height: 128px;" role="img" aria-label="全破">
        <div class="seal-ring" style="width: 106px; height: 106px; font-size: 34px; line-height: 40px;">全破</div>
      </div>
      <p class="label">${esc(app.state.team)}</p>
      <h1 class="h1">新莊廟街任務完成！</h1>
    </div>
    <div class="passcode">
      <p class="passcode-label">通關碼</p>
      <p class="passcode-code">${esc(passcode)}</p>
      <p class="passcode-note">請把這個畫面拿給工作人員看</p>
    </div>
    ${starPanel}
    <section style="display: flex; flex-direction: column; gap: 4px;">
      <h2 class="h2">${app.ed.levelsWord}成果</h2>
      <div>${rows}</div>
    </section>
    <section style="display: flex; flex-direction: column; gap: 4px;">
      <h2 class="h2">NPC 任務</h2>
      <div>${npcRows}</div>
    </section>
  </main>
  <div class="actions">
    ${feedback}
    <a class="btn btn-secondary" href="../">完成遊戲</a>
    <button class="btn btn-text" type="button" data-action="restart" style="align-self: center;">重新開始</button>
  </div>
</div>`,
    actions: {
      restart: () => restart(app),
    },
  };
}

export function registerCommon(app) {
  app.route('/', startScreen);
  app.route('/name', nameScreen);
  app.route('/level/:n/history', historyScreen);
  app.route('/summary', summaryScreen);
}
