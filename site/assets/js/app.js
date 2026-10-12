// 單頁應用外殼：載入內容 JSON → 建立 store → 註冊路由 → 畫面渲染、焦點與捲動。
//
// 用法（site/youth/index.html）：
//   import { createApp } from '../assets/js/app.js';
//   import { registerCommon } from '../assets/js/screens-common.js';
//   import { registerNpc } from '../assets/js/npc.js';
//   import { registerYouth } from '../assets/js/youth.js';
//   createApp({ edition: 'youth', register: [registerCommon, registerNpc, registerYouth] });
//
// createApp({ edition, register, root = '#app' }) → Promise<app | null>
//   內容載入失敗時顯示「重新載入」畫面並回傳 null。
//
// app 物件
//   app.edition          'youth' | 'family'
//   app.ed               EDITIONS[edition]：{ label, tagCls, total, levelsWord, afterName, continuePath(state) }
//   app.content          { levels, menu, history, npc, story?, levelKeys? }（已拆掉 {_source, data} 外層）
//                        青年場另有 story（youth-story.json 整個物件：{prologue, ending}）、levelKeys
//   app.store            createStore(edition) 的結果（state、persistent、update(fn)、reset()）
//   app.state            = app.store.state（getter）
//   app.summary()        progress.summary(edition, levels, npc, state)
//   app.route(pattern, handler)
//                        註冊路由。pattern 例如 '/level/:n/result'。同一個 pattern 後註冊的會取代先註冊的，
//                        所以場次檔可以覆寫共用畫面。
//   app.go(path, {replace})  換頁（hash 路由）
//   app.redirect(path)   在 handler 裡導向別頁（replace，不留歷史），之後 handler 要 return null
//   app.refresh({ focus }) 重畫目前畫面（同一個 handler、同一組 params），不捲回頂端。
//                        focus：CSS selector，重畫後把焦點放到那裡；省略時嘗試放回原本有焦點的元素（依 id）。
//   app.path / app.params  目前路徑與參數
//
// 畫面（handler）規則
//   handler(params, app) → view | null
//   view = {
//     html: string,                 整頁 HTML（通常是 <div class="screen">…</div>），所有動態文字先 esc()
//     title?: string,               分頁標題的前半（例如 '第一關'）
//     actions?: { name(el, event) }, 點到 [data-action="name"] 的元素時呼叫（事件委派，重畫後仍有效）
//     bind?(root, app),             渲染後呼叫：綁定 input 事件等（root 的子元素每次重畫都是新的）
//   }
//   - 頁面要有一個 <h1 class="h1">；換頁後焦點會移到它（自動加 tabindex="-1"），並捲到頂端。
//   - [data-go="/menu"] 的元素點了就換頁（topbar 的返回鍵就是這樣）。
//   - <input data-enter="submit"> 在輸入框按 Enter 會呼叫 actions.submit(input, event)。
//   - 輸入框在 'input' 事件裡用 app.store.update() 存草稿，「不要」重畫（打字、焦點才不會跑掉）。
//     按按鈕送出等動作之後再 app.refresh()。
//   - 找不到的路徑 → 導回 '#/'。

import { createStore } from './store.js';
import { summary as progressSummary } from './progress.js';
import { startRouter, go, match, parse } from './router.js';
import { closeLayers, dropStaleLayerEntry } from './ui.js';

export const EDITIONS = {
  youth: {
    key: 'youth',
    label: '青年場',
    tagCls: 'is-youth',
    total: 6,
    levelsWord: '六關',
    afterName: '/story',
    continuePath: s => (!s.team ? '/name' : (!s.storySeen ? '/story' : '/menu')),
    files: {
      levels: 'youth-levels.json',
      menu: 'youth-menu.json',
      history: 'youth-history.json',
      levelKeys: 'youth-level-keys.json',
      story: 'youth-story.json',
      npc: 'npc.json',
    },
  },
  family: {
    key: 'family',
    label: '親子場',
    tagCls: 'is-family',
    total: 7,
    levelsWord: '七關',
    afterName: '/menu',
    continuePath: s => (!s.team ? '/name' : '/menu'),
    files: {
      levels: 'family-levels.json',
      menu: 'family-menu.json',
      history: 'family-history.json',
      npc: 'npc.json',
    },
  },
};

const SITE_TITLE = '妙妙貓的廟街委託';

async function loadContent(files) {
  const entries = await Promise.all(Object.entries(files).map(async ([k, f]) => {
    const res = await fetch(new URL('../content/' + f, location.href));
    if (!res.ok) throw new Error(f + ' ' + res.status);
    const j = await res.json();
    // youth-story.json 沒有 data 外層（{prologue, ending}），其餘都是 {_source, data}
    return [k, j && 'data' in j ? j.data : j];
  }));
  return Object.fromEntries(entries);
}

// 暫定：載入失敗畫面的文案（P1），Hugo 尚未確認
function renderLoadError(root) {
  root.innerHTML = `<div class="screen"><main class="content" style="padding: 40px 24px 24px; gap: 20px; align-items: center; text-align: center;">
    <h1 class="h1" tabindex="-1">載入失敗，請檢查網路後重新載入。</h1>
  </main><div class="actions"><button class="btn btn-primary" type="button" data-reload>重新載入</button></div></div>`;
  root.querySelector('[data-reload]').addEventListener('click', () => location.reload());
  root.querySelector('h1').focus();
}

export async function createApp({ edition, register = [], root: rootSel = '#app' }) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  const ed = EDITIONS[edition];
  let content;
  try {
    content = await loadContent(ed.files);
  } catch (err) {
    console.error(err);
    renderLoadError(root);
    return null;
  }

  const store = createStore(edition);
  const routes = [];
  let current = null; // { handler, params, path, view }

  const app = {
    edition,
    ed,
    content,
    store,
    root,
    get state() { return store.state; },
    get path() { return current && current.path; },
    get params() { return current && current.params; },
    summary: () => progressSummary(edition, content.levels, content.npc, store.state),
    route(pattern, handler) {
      const i = routes.findIndex(r => r[0] === pattern);
      if (i >= 0) routes[i] = [pattern, handler]; else routes.push([pattern, handler]);
    },
    go,
    redirect(path) { go(path, { replace: true }); return null; },
    refresh({ focus } = {}) {
      if (!current) return;
      const active = document.activeElement;
      const activeId = active && root.contains(active) ? active.id : '';
      const y = window.scrollY;
      paint(current.handler, current.params, current.path, false);
      window.scrollTo(0, y);
      const target = (focus && root.querySelector(focus)) || (activeId && document.getElementById(activeId));
      if (target) target.focus({ preventScroll: true });
    },
  };

  function paint(handler, params, path, isNav) {
    current = { handler, params, path, view: null };
    const view = handler(params, app);
    if (!view || current.path !== path) return; // 已導向別頁
    current.view = view;
    root.innerHTML = view.html;
    document.title = (view.title ? view.title + '｜' : '') + ed.label + '｜' + SITE_TITLE;
    if (view.bind) view.bind(root, app);
    const h1 = root.querySelector('h1');
    if (h1 && !h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    if (isNav) {
      window.scrollTo(0, 0);
      if (h1) h1.focus({ preventScroll: true });
    }
  }

  // 事件委派：data-go、data-action、data-enter
  root.addEventListener('click', e => {
    const goEl = e.target.closest('[data-go]');
    if (goEl && root.contains(goEl)) {
      if (goEl.getAttribute('aria-disabled') === 'true') return;
      e.preventDefault();
      go(goEl.dataset.go);
      return;
    }
    const act = e.target.closest('[data-action]');
    if (act && root.contains(act) && current && current.view && current.view.actions) {
      if (act.getAttribute('aria-disabled') === 'true') return;
      const fn = current.view.actions[act.dataset.action];
      if (fn) fn(act, e);
    }
  });
  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; // 注音選字中的 Enter 不算
    const el = e.target.closest('[data-enter]');
    if (!el || !current || !current.view || !current.view.actions) return;
    const fn = current.view.actions[el.dataset.enter];
    if (fn) { e.preventDefault(); fn(el, e); }
  });

  register.forEach(fn => fn(app));

  dropStaleLayerEntry(); // 開著彈窗時重新整理留下的紀錄（網址相同，不影響路由）
  startRouter(
    routes.map(([pattern, handler]) => [pattern, (params, path) => { closeLayers(); paint(handler, params, path, true); }]),
    path => { if (path !== '/') go('/', { replace: true }); },
  );
  return app;
}

// 方便場次檔用：找出某個 pattern 是否符合目前路徑
export { match, parse };
