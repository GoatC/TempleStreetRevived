// 共用 UI 小工具：HTML 跳脫、圖示、頂部列、彈窗、全螢幕看圖。
//
// API
// ---
// esc(x) → string
//   把任何值轉成可以安全放進 HTML（文字或屬性值）的字串。所有來自內容 JSON、
//   玩家輸入（隊名、草稿）的字都要先 esc() 再放進 HTML 字串。
//
// ICONS.<name> → string
//   設計稿裡的 24×24 線條圖示（<svg class="ico" …>），逐字複製自 design/*.dc.html。
//   名稱：back, go, arrow, check, chevDown, chevUp, hint, eye, warn, trash, close,
//   zoom, pin, lock, camera, route, compass, speech, skip, retry, team, okCircle, info。
//   icon(name, style) → 同一個圖示，但可以加 style（例如 'width: 28px; height: 28px;'，彈窗圖示用）。
//
// CARD_ICONS.<icon> → string
//   關卡卡片 .lv-img 裡的 64×64 圖示（staff, gate, drum, mask, boat, door, board, window），
//   對應 youth-menu.json / family-menu.json 的 icon 欄位。
//
// starSvg({ cls = '', aria = '' }) → string
//   星星（.star）。cls 例如 'star-lg'、'is-empty'；有 aria 時是 role="img"，否則 aria-hidden。
//
// topbar({ edition, back, tag, right, left, style }) → string
//   產生 <div class="topbar">。
//   - edition: 'youth' | 'family' → 右側場次標籤 .ver-tag.is-youth / .is-family（§6.6）
//   - back: { label: '關卡選單', to: '/menu' } → 左側返回鍵（button.btn-back[data-go]）
//   - left: 自訂左側 HTML（沒有 back 時用，例如序章的「序章 1 / 2」）
//   - tag: 右側 .topbar-tag 文字（會 esc）
//   - right: 放在 tag 和場次標籤中間的自訂 HTML（例如「遊戲說明」按鈕）
//   - style: topbar 的 inline style
//   沒有 tag 也沒有 right 時，場次標籤直接放在右邊（同 T03Name）。
//
// verTag(edition) → '<span class="ver-tag is-youth">青年場</span>'
//
// openDialog(opts) → Promise<value | null>
//   Components.dc.html 的一般彈窗（.modal）／危險操作彈窗（.modal-danger）。
//   opts:
//     title       標題文字（h2，會 esc）
//     body        內文文字（<p class="p">，會 esc）；或
//     bodyHtml    內文 HTML（自己負責 esc）
//     icon        圖示名稱（ICONS 的 key，例如 'hint'、'eye'、'warn'）；省略就沒有圓形圖示
//     headHtml    整個 .modal-head 換成自訂 HTML（例如提示內容彈窗：標題＋右側 tag）。
//                 自訂時請讓標題元素有 id="dlg-title"，或傳 labelledBy。
//     topHtml     放在 modal-head 前面的 HTML（例如全破彈窗的印章）
//     danger      true → .modal-danger、role="alertdialog"
//     buttons     [{ label, value, kind: 'primary'|'secondary'|'destructive'|'text', icon }]
//                 依陣列順序由上往下排。按下就關閉並 resolve(value)。
//   關閉方式：按任一按鈕 → resolve(該按鈕 value)；瀏覽器「上一頁」或 Esc → resolve(null)。
//   打開時焦點移到第一個按鈕；關閉後焦點回到打開它的元素（如果還在畫面上），
//   否則移到頁面 h1。Promise 是在瀏覽器歷史紀錄整理好之後才 resolve，
//   所以 resolve 後可以直接 go('/xxx') 換頁。
//
// confirmRestart() → Promise<boolean>
//   §6.6 重新開始確認（危險彈窗）。只回傳是否確認，不清資料。
//
// openZoom(src, alt, title, label) → Promise<null>（label：dialog 的 aria-label，省略時用 title 或 alt）
//   T08L1Zoom 全螢幕看圖：上方標題＋「關閉」，圖片可捲動、可兩指放大，下方「可以用兩指放大、拖曳查看細節。」
//
// closeLayers()
//   關掉所有開著的彈窗／看圖（不動歷史紀錄；換頁時 app.js 會呼叫）。
//
// isLayerOpen() → boolean

export function esc(x) {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const svg = (inner, style) =>
  `<svg class="ico" ${style ? `style="${style}" ` : ''}viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"></path>',
  go: '<path d="M9 5l7 7-7 7"></path>',
  arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
  check: '<path d="M5 12l5 5 9-10"></path>',
  chevDown: '<path d="M6 9l6 6 6-6"></path>',
  chevUp: '<path d="M6 15l6-6 6 6"></path>',
  hint: '<path d="M9 4h6"></path><path d="M9 4c-4 3-4 12 0 15h6c4-3 4-12 0-15"></path><path d="M12 1.5V4M12 19v3M7 11.5h10"></path>',
  eye: '<path d="M2 12c3-6 17-6 20 0-3 6-17 6-20 0z"></path><circle cx="12" cy="12" r="3"></circle>',
  warn: '<path d="M12 3l10 17H2z"></path><path d="M12 10v4"></path><path d="M12 17.2v.3"></path>',
  trash: '<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path>',
  close: '<path d="M6 6l12 12M18 6L6 18"></path>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"></path>',
  pin: '<path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"></path><circle cx="12" cy="9" r="2.5"></circle>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  camera: '<path d="M4 8h3.5l2-3h5l2 3H20v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>',
  route: '<circle cx="5" cy="19" r="2"></circle><circle cx="19" cy="5" r="2"></circle><path d="M7 19h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7"></path>',
  compass: '<circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5l-2 5-5 2 2-5z"></path>',
  speech: '<path d="M4 5h16v11H10l-6 4z"></path><path d="M8 9.5h8M8 12.5h5"></path>',
  skip: '<path d="M5 6l7 6-7 6"></path><path d="M13 6l7 6-7 6"></path>',
  retry: '<path d="M4 12a8 8 0 1 0 2.5-5.8"></path><path d="M4 4v5h5"></path>',
  team: '<circle cx="8" cy="8" r="3"></circle><circle cx="16" cy="8" r="3"></circle><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5"></path><path d="M11 20c0-3 2.5-5 5-5s5 2 5 5"></path>',
  okCircle: '<circle cx="12" cy="12" r="9"></circle><path d="M8 12l3 3 5-6"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.5"></path>',
};

export const ICONS = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [k, svg(v)]));
export function icon(name, style) { return svg(PATHS[name] || '', style); }

// 關卡卡片圖示（T06Menu / F06Menu）
const card = inner => `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
export const CARD_ICONS = {
  staff: card('<path d="M26 30v28"></path><path d="M26 30c-8 0-12-5-12-11 0-6 5-11 12-15 7 4 12 9 12 15 0 6-4 11-12 11z"></path><path d="M26 8v22"></path><circle cx="14" cy="23" r="3"></circle><circle cx="38" cy="23" r="3"></circle><circle cx="48" cy="46" r="7"></circle><path d="M45 44a3 3 0 0 1 3-2"></path>'),
  drum: card('<ellipse cx="32" cy="22" rx="20" ry="7"></ellipse><path d="M12 22v20c0 4 9 7 20 7s20-3 20-7V22"></path><path d="M20 28v19M44 28v19"></path><path d="M42 10l12-8M22 10L10 2"></path>'),
  mask: card('<path d="M14 12c8-4 28-4 36 0 2 16-3 32-18 40C17 44 12 28 14 12z"></path><path d="M21 25c3-3 7-3 9 0M34 25c2-3 6-3 9 0"></path><path d="M27 39c3 2 7 2 10 0"></path><path d="M32 14v7"></path>'),
  boat: card('<path d="M6 38h52l-9 12H15z"></path><path d="M30 38V8"></path><path d="M30 10l16 22H30"></path><path d="M6 58c5-3 9 3 14 0s9 3 14 0 9 3 14 0 9 3 12 0"></path>'),
  door: card('<path d="M12 58V8h40v50"></path><path d="M32 8v50"></path><path d="M6 58h52"></path><path style="stroke-width: 4.5;" d="M19 16h0M25 16h0M39 16h0M45 16h0M19 24h0M25 24h0M39 24h0M45 24h0M19 32h0M25 32h0M39 32h0M45 32h0M19 40h0M25 40h0M39 40h0M45 40h0"></path>'),
  gate: card('<path d="M4 30c8 0 14-6 16-12h24c2 6 8 12 16 12"></path><path d="M20 18c-1-5-5-8-10-8M44 18c1-5 5-8 10-8"></path><path d="M8 34h48M14 34v22M50 34v22M6 56h52M27 56V44h10v12"></path>'),
  board: card('<rect x="8" y="8" width="48" height="32" rx="2"></rect><path d="M16 18h32M16 25h24M16 32h28"></path><path d="M18 40v18M46 40v18"></path>'),
  window: card('<rect x="12" y="8" width="40" height="48" rx="2"></rect><path d="M32 8v48M12 32h40"></path><path d="M17 14h10v12H17zM37 38h10v12H37z"></path>'),
};

const STAR_PATH = '<path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>';
export function starSvg({ cls = '', aria = '' } = {}) {
  const a = aria ? `role="img" aria-label="${esc(aria)}"` : 'aria-hidden="true"';
  return `<svg class="star${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" ${a}>${STAR_PATH}</svg>`;
}

/* ---------- 頂部列 ---------- */
export const EDITION_LABEL = { youth: '青年場', family: '親子場' };

export function verTag(edition) {
  return `<span class="ver-tag is-${edition === 'family' ? 'family' : 'youth'}">${EDITION_LABEL[edition] || ''}</span>`;
}

export function topbar({ edition, back, left = '', tag = '', right = '', style = '' } = {}) {
  const leftHtml = back
    ? `<button class="btn btn-back" type="button" data-go="${esc(back.to)}">${ICONS.back}${esc(back.label)}</button>`
    : left;
  const inner = (tag || right)
    ? `<div class="topbar-right">${right}${tag ? `<span class="topbar-tag">${esc(tag)}</span>` : ''}${verTag(edition)}</div>`
    : verTag(edition);
  return `<div class="topbar"${style ? ` style="${style}"` : ''}>${leftHtml}${inner}</div>`;
}

/* ---------- 只在這次瀏覽有效的畫面狀態：重新開始／重新取名時一起清掉 ---------- */
// 各畫面模組用 onUiReset(fn) 登記清除函式；restart() 與隊名送出時呼叫 resetUi()。
const uiResetters = [];
export function onUiReset(fn) { uiResetters.push(fn); }
export function resetUi() { uiResetters.forEach(fn => fn()); }

/* ---------- 圖層（彈窗、看圖）共用：焦點、上一頁、inert ---------- */
// 每開一層就 pushState 一筆（網址不變）。玩家按「上一頁」→ popstate → 關掉最上層。
// 自己按按鈕關閉時，用 history.back() 把那一筆拿掉，等 popstate 回來才 resolve。
const layers = [];      // { el, close(value, opts), dismiss() }
const backWaiters = []; // 等待自己發出的 history.back() 完成

function appRoot() { return document.getElementById('app'); }

function focusables(el) {
  return Array.from(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(x => !x.disabled && !x.hidden);
}

function trapKeys(e) {
  const top = layers[layers.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); top.dismiss(); return; }
  if (e.key !== 'Tab') return;
  const f = focusables(top.el);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1];
  if (!top.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function setBackground(on) {
  const root = appRoot();
  if (root) root.inert = on;
  document.body.style.overflow = on ? 'hidden' : '';
}

if (typeof window !== 'undefined') window.addEventListener('popstate', () => {
  if (backWaiters.length) { backWaiters.shift()(); return; }
  const top = layers[layers.length - 1];
  if (top) { top.close(null, { popped: true }); return; }
  // 開著彈窗時重新整理，會留下一筆網址相同的圖層紀錄；退到它時再退一次，「上一頁」才有反應
  if (history.state && history.state.miaoLayer) history.back();
});

// 載入時如果停在上次留下的圖層紀錄上（開著彈窗時重新整理），先退掉它
export function dropStaleLayerEntry() {
  if (typeof window === 'undefined' || !history.state || !history.state.miaoLayer) return;
  history.replaceState(null, '', location.href);
  history.back();
}

function openLayer(el, firstFocus) {
  let resolveFn;
  const promise = new Promise(r => { resolveFn = r; });
  const opener = document.activeElement;
  let done = false;
  const layer = { el };

  layer.close = (value, { popped = false, silent = false } = {}) => {
    if (done) return;
    done = true;
    el.remove();
    const i = layers.indexOf(layer);
    if (i >= 0) layers.splice(i, 1);
    if (!layers.length) {
      setBackground(false);
      document.removeEventListener('keydown', trapKeys, true);
    }
    const target = opener && opener !== document.body && document.contains(opener)
      ? opener : document.querySelector('#app h1');
    if (target && target.focus) target.focus({ preventScroll: true });
    if (popped || silent) { resolveFn(value); return; }
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolveFn(value); } };
    backWaiters.push(finish);
    history.back();
    setTimeout(() => {
      const k = backWaiters.indexOf(finish);
      if (k >= 0) backWaiters.splice(k, 1);
      finish();
    }, 700);
  };
  layer.dismiss = () => layer.close(null);

  layers.push(layer);
  if (layers.length === 1) {
    setBackground(true);
    document.addEventListener('keydown', trapKeys, true);
  }
  document.body.appendChild(el);
  history.pushState({ miaoLayer: true }, '', location.href);
  const f = firstFocus || focusables(el)[0];
  // 焦點放在最下面的按鈕時不要順勢捲到底：內容比畫面長時，標題和第一段要先看得到
  if (f) f.focus({ preventScroll: true });
  el.querySelectorAll('.modal').forEach(m => { m.scrollTop = 0; });
  return { promise, layer };
}

export function isLayerOpen() {
  return layers.length > 0;
}

export function closeLayers() {
  layers.slice().forEach(l => l.close(null, { silent: true }));
}

/* ---------- 彈窗 ---------- */
const BTN_KIND = { primary: 'btn-primary', secondary: 'btn-secondary', destructive: 'btn-destructive', text: 'btn-text' };

export function openDialog({ title = '', body = '', bodyHtml = '', icon: iconName = '', headHtml = '', topHtml = '',
  danger = false, buttons = [{ label: '我知道了', value: true, kind: 'primary' }], labelledBy = 'dlg-title' } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const head = headHtml || `<div class="modal-head">${iconName ? `<span class="modal-icon">${icon(iconName, 'width: 28px; height: 28px;')}</span>` : ''}<h2 class="h2" id="dlg-title">${esc(title)}</h2></div>`;
  const content = bodyHtml || (body ? `<p class="p">${esc(body)}</p>` : '');
  const btns = buttons.map((b, i) =>
    `<button class="btn ${BTN_KIND[b.kind] || 'btn-secondary'}" type="button" data-dlg="${i}">${b.icon ? ICONS[b.icon] || '' : ''}${esc(b.label)}</button>`).join('');
  scrim.innerHTML = `<div class="modal${danger ? ' modal-danger' : ''}" role="${danger ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="${esc(labelledBy)}">${topHtml}${head}${content}<div class="modal-actions">${btns}</div></div>`;
  // 讀屏：打開時除了標題，也念出內文（提示內容、說明）
  const desc = scrim.querySelector('.modal > p, .modal > ul');
  if (desc) {
    if (!desc.id) desc.id = 'dlg-desc';
    scrim.firstElementChild.setAttribute('aria-describedby', desc.id);
  }
  const { promise, layer } = openLayer(scrim);
  scrim.addEventListener('click', e => {
    const b = e.target.closest('[data-dlg]');
    if (b) layer.close(buttons[Number(b.dataset.dlg)].value);
  });
  return promise;
}

export function confirmRestart() {
  return openDialog({
    title: '確定要重新開始？',
    body: '重新開始會清除目前所有關卡進度，無法復原。',
    icon: 'warn',
    danger: true,
    buttons: [
      { label: '取消', value: false, kind: 'secondary' },
      { label: '清除進度並重新開始', value: true, kind: 'destructive', icon: 'trash' },
    ],
  }).then(v => v === true);
}

/* ---------- 全螢幕看圖（T08L1Zoom） ---------- */
export function openZoom(src, alt = '', title = '', label = '') {
  const el = document.createElement('div');
  el.className = 'zoom-scrim';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', label || title || alt);
  el.innerHTML = `<div class="zoom-head"><p class="zoom-title">${esc(title)}</p><button class="btn zoom-close" type="button" data-zoom-close>${ICONS.close}關閉</button></div>`
    + `<div class="zoom-body"><img class="zoom-img" src="${esc(src)}" alt="${esc(alt)}">`
    + `<p class="zoom-note">${ICONS.zoom}可以用兩指放大、拖曳查看細節。</p></div>`;
  const btn = el.querySelector('[data-zoom-close]');
  const { promise, layer } = openLayer(el, btn);
  btn.addEventListener('click', () => layer.close(null));
  return promise;
}
