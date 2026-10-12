// NPC 任務頁（兩場共用，FNpc.dc.html ＋ FNpcAField / FNpcB / FNpcCDone，HANDOFF §6.4）
//
// registerNpc(app)  註冊 '/npc/:key'（A／B／C；其他字母 → 回 '#/menu'）
//
// - 資料：app.content.npc（content/npc.json）。進度存在該場 store 的 state.npc[key]
//   （results：null | 'self'；drafts[i]：{ text, fields: [a, b] }，完成後改成 { got: 顯示文字 }）。
// - 任務全部開放、順序不限；一次只展開一個（展開狀態不存檔）。
// - 判定一律用 answers.js 的 checkNpc()。沒有提示、沒有揭曉、沒有歷史介紹。

import { esc, ICONS, topbar, onUiReset } from './ui.js';
import { checkNpc, stripNpc } from './answers.js';
import { npcState } from './store.js';

const ERR_EMPTY = '請先作答，再按「送出答案」。';
const ERR_WRONG = '和 NPC 說的不太一樣，注意同音字，再確認一次吧。';

const ui = {}; // 只在這次瀏覽有效的畫面狀態：{ [edition+key]: { open, errs: { [i]: { error, bad } } } }
onUiReset(() => { for (const k in ui) delete ui[k]; });

const isSet = r => r !== null && r !== undefined;

function typeName(t) {
  if (t.type === 'photo') return '拍照任務';
  if (t.type === 'arrive') return '抵達任務';
  if (t.type === 'multi') return '填空題';
  return '文字題';
}

// 完成後列上顯示的文字（原型 shown()）
function shown(t) {
  if (t.type === 'photo') return '已拍合照';
  if (t.type === 'arrive') return t.doneText || '已抵達';
  if (t.type === 'multi') {
    return (t.fields || []).map((f, k) => f + ' ' + ((t.answer && t.answer[k] && t.answer[k][0]) || '')).join('・');
  }
  return (t.answer && t.answer[0]) || '';
}

// 文字題答對時顯示玩家對到的那一種寫法（原型顯示 match() 的結果）；判定本身仍由 checkNpc 決定
function hitText(t, text) {
  const v = stripNpc(text);
  return (t.answer || []).find(a => stripNpc(a) === v) || shown(t);
}

const INPUT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"';

function npcScreen(params, app) {
  const key = String(params.key || '').toUpperCase();
  const npc = app.content.npc.find(n => n.key === key);
  if (!npc) return app.redirect('/menu');
  if (params.key !== key) return app.redirect('/npc/' + key);
  const tasks = npc.tasks;
  const uk = app.edition + key;
  const U = ui[uk] || (ui[uk] = { open: -1, errs: {} });
  // 只讀：還沒互動前不在存檔裡建立這個 NPC（和 family.js 關卡頁一致）
  const saved = app.store.state.npc[key];
  const savedResults = (saved && saved.results) || [];
  const N = {
    results: tasks.map((t, i) => (isSet(savedResults[i]) ? savedResults[i] : null)),
    drafts: (saved && saved.drafts) || {},
  };
  const results = N.results;
  if (U.open >= 0 && isSet(results[U.open])) U.open = -1;
  const id = (i, suffix) => `npc-${key}-task${i}-${suffix}`;

  const items = tasks.map((t, i) => {
    const n = i + 1;
    if (isSet(results[i])) {
      const d = N.drafts[i] || {};
      const res = (t.type === 'photo' || t.type === 'arrive') ? '已完成' : '答對';
      return `<div class="task-row" id="${id(i, 'row')}" tabindex="-1">
          <span class="task-check">${ICONS.check}</span>
          <span class="task-row-main">
            <span class="task-row-title">${n}．${esc(t.title)}</span>
            <span class="task-row-sub">${esc(d.got || shown(t))}</span>
          </span>
          <span class="tag tag-res">${res}</span>
        </div>`;
    }
    if (U.open !== i) {
      return `<button class="task-toggle" id="${id(i, 'head')}" type="button" data-action="toggle" data-i="${i}" aria-expanded="false" aria-label="${esc(`任務 ${n}，${t.title}，${typeName(t)}，點開作答`)}">
          <span class="num">${n}</span>
          <span class="task-row-main">
            <span class="task-row-title">${esc(t.title)}</span>
            <span class="task-row-sub">${typeName(t)}</span>
          </span>
          ${ICONS.chevDown}
        </button>`;
    }
    const d = N.drafts[i] || {};
    const E = U.errs[i] || null;
    const wrong = E && E.error === 'wrong';
    let body = '';
    if (t.prompt) body += `<p class="task-body">${esc(t.prompt)}</p>`;
    if (t.type === 'photo') {
      // 拍照範例圖（選填）：沒有圖就整塊不顯示（HANDOFF §10）
      body += `<p class="task-note">照片存在你們自己的手機裡，不需要上傳。</p>`;
    }
    if (t.type === 'multi') {
      body += `<div class="mfields">${(t.fields || []).map((label, k) => {
        const bad = wrong && E.bad && E.bad[k];
        return `<div class="field">
            <label class="field-label" for="${id(i, 'field' + k)}">${esc(label)}</label>
            <input id="${id(i, 'field' + k)}" class="input${bad ? ' is-error' : ''}" type="text" value="${esc((d.fields && d.fields[k]) || '')}" placeholder="輸入答案" ${INPUT_ATTRS}
              data-i="${i}" data-k="${k}" data-enter="submit"${bad ? ` aria-invalid="true" aria-describedby="${id(i, 'err')}"` : ''}>
          </div>`;
      }).join('')}</div>`;
    }
    if (t.type === 'text') {
      const errAttr = wrong ? ` aria-invalid="true" aria-describedby="${id(i, 'err')}"` : '';
      const input = `<input id="${id(i, 'answer')}" class="input${wrong ? ' is-error' : ''}" type="text" value="${esc(d.text || '')}" placeholder="輸入答案" ${INPUT_ATTRS}
              data-i="${i}" data-enter="submit"${t.label ? '' : ` aria-label="${esc(t.title)}"`}${errAttr}>`;
      body += t.label
        ? `<div class="field">
            <label class="field-label" for="${id(i, 'answer')}">${esc(t.label)}</label>
            ${input}
          </div>`
        : input;
    }
    if (E) {
      body += `<p class="err" id="${id(i, 'err')}" role="alert">${ICONS.warn}${E.error === 'empty' ? ERR_EMPTY : ERR_WRONG}</p>`;
    }
    let btn = '';
    if (t.type === 'photo') btn = `<button class="btn btn-primary" type="button" data-action="finish" data-i="${i}">${ICONS.camera}我拍好了</button>`;
    else if (t.type === 'arrive') btn = `<button class="btn btn-primary" type="button" data-action="finish" data-i="${i}">${ICONS.pin}我們到了</button>`;
    else btn = `<button class="btn btn-primary" type="button" data-action="submit" data-i="${i}">送出答案</button>`;
    return `<div class="task">
          <button class="task-head-btn" id="${id(i, 'head')}" type="button" data-action="toggle" data-i="${i}" aria-expanded="true" aria-label="收合任務 ${n}">
            <span class="num is-on">${n}</span>
            <span class="task-row-main">
              <span class="task-type">任務 ${n}・${typeName(t)}</span>
              <span class="task-title">${esc(t.title)}</span>
            </span>
            ${ICONS.chevUp}
          </button>
          ${body}
          <div class="task-actions">
            ${btn}
          </div>
        </div>`;
  }).join('');

  const doneCount = results.filter(isSet).length;
  const allDone = doneCount === tasks.length;
  const sep = /[A-Za-z0-9]$/.test(npc.name) ? ' ' : '';
  const banner = allDone ? `
    <div class="pass-banner" id="npc-done" tabindex="-1">
      <div class="pass-head">
        <span class="mini-seal"><span>完成</span></span>
        <p class="p" style="font-weight: 700;">${esc(npc.name + sep + '的任務全部完成！')}</p>
      </div>
      <button class="btn btn-primary" type="button" data-go="/menu">回到關卡選單
        ${ICONS.arrow}
      </button>
    </div>` : '';

  function draftOf(s, i) {
    const M = npcState(s, key, tasks.length);
    if (!M.drafts[i] || M.drafts[i].got !== undefined) M.drafts[i] = { text: '', fields: ['', ''] };
    if (!M.drafts[i].fields) M.drafts[i].fields = ['', ''];
    return M.drafts[i];
  }

  function complete(i, got) {
    app.store.update(s => {
      const M = npcState(s, key, tasks.length);
      M.results[i] = 'self';
      M.drafts[i] = { got };
    });
    delete U.errs[i];
    U.open = -1;
    const nowDone = app.store.state.npc[key].results.every(isSet);
    app.refresh({ focus: nowDone ? '#npc-done' : '#' + id(i, 'row') });
  }

  return {
    title: 'NPC ' + key,
    html: `<div class="screen">
  ${topbar({ edition: app.edition, back: { label: '關卡選單', to: '/menu' }, tag: 'NPC 任務' })}
  <main class="content" style="gap: 10px;">
    <h1 class="h1 npc-head"><span class="npc-badge">${esc(npc.key)}</span><span>${esc(npc.name)}</span></h1>
    <div class="panel" style="gap: 4px;">
      <p class="kicker">角色設定</p>
      <p class="p">${esc(npc.role)}</p>
    </div>
    <div class="npc-list-head">
      <h2 class="h2" style="font-size: 20px; line-height: 28px;">任務</h2>
      <p class="label">已完成 ${doneCount}/${tasks.length}</p>
    </div>
    <p class="route-note">${ICONS.speech}題目由 NPC 在現場口頭說明，順序不限。</p>
    ${items}
    ${banner}
  </main>
</div>`,
    bind(root) {
      root.querySelectorAll('input[data-i]').forEach(input => {
        input.addEventListener('input', () => {
          const i = Number(input.dataset.i);
          app.store.update(s => {
            const d = draftOf(s, i);
            if (input.dataset.k !== undefined) d.fields[Number(input.dataset.k)] = input.value;
            else d.text = input.value;
          });
          // 原型：一改輸入就清掉錯誤（不重畫，保留焦點）
          if (U.errs[i]) {
            delete U.errs[i];
            const task = input.closest('.task');
            task.querySelectorAll('.err').forEach(e => e.remove());
            task.querySelectorAll('input').forEach(x => {
              x.classList.remove('is-error');
              x.removeAttribute('aria-invalid');
              x.removeAttribute('aria-describedby');
            });
          }
        });
      });
    },
    actions: {
      toggle: el => {
        const i = Number(el.dataset.i);
        U.open = U.open === i ? -1 : i;
        app.refresh({ focus: '#' + id(i, 'head') });
      },
      submit: el => {
        const i = Number(el.dataset.i);
        const t = tasks[i];
        const d = (app.store.state.npc[key].drafts[i]) || {};
        const r = checkNpc(t, d.got !== undefined ? {} : d);
        if (r.ok) {
          complete(i, t.type === 'text' ? hitText(t, d.text) : shown(t));
          return;
        }
        U.errs[i] = { error: r.empty ? 'empty' : 'wrong', bad: r.bad };
        const firstBad = t.type === 'multi' && !r.empty ? r.bad.findIndex(Boolean) : -1;
        app.refresh({ focus: firstBad >= 0 ? '#' + id(i, 'field' + firstBad) : (el.tagName === 'INPUT' ? '#' + el.id : null) });
      },
      finish: el => {
        const i = Number(el.dataset.i);
        complete(i, shown(tasks[i]));
      },
    },
  };
}

export function registerNpc(app) {
  app.route('/npc/:key', npcScreen);
}
