// 從 repo 產生編輯台的資料（每個畫面一張 artboard，每段文字／答案／圖片一個可編輯項目），
// 再把資料嵌進 template.html，輸出 妙妙廟內容編輯台.html。
// 用法：node tools/content-editor/build.mjs [repoDir] [輸出檔]（預設輸出 tools/content-editor/editor.html，不進 git）
// 發佈：Artifact 發佈 editor.html，files 附上 site/assets/img/*.webp（路徑 img/…），capabilities {db, user, assets}。
// 編輯台網址：https://claude.ai/artifact/5w3jCxC5k1zDc6ZRLYmzur（修改存在它的資料庫 edits、requests 兩個集合）
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const REPO = process.argv[2] || new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const HERE = new URL('./', import.meta.url).pathname;
const read = f => readFileSync(`${REPO}/${f}`, 'utf8');
const C = f => { const j = JSON.parse(read('site/content/' + f)); return 'data' in j ? j.data : j; };
const commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();

const yl = C('youth-levels.json'), yk = C('youth-level-keys.json'), ym = C('youth-menu.json'), yh = C('youth-history.json'), ys = C('youth-story.json');
const fl = C('family-levels.json'), fm = C('family-menu.json'), fh = C('family-history.json'), npc = C('npc.json');

const screens = [];
const keyOf = (file, path) => file + '~' + path.join('.');
// role：在 artboard 裡長什麼樣子（kicker, h1, h2, p, small, hint, clue, label, chip, err, btn, key, code）
const T = (file, path, original, label, role = 'p', extra = {}) => ({ kind: 'text', key: keyOf(file, path), file, path, original, label, role, ...extra });
const L = (file, path, original, label, extra = {}) => ({ kind: 'list', key: keyOf(file, path), file, path, original, label, ...extra });
const IMG = (key, file, original, label, extra = {}) => ({ kind: 'image', key, file, original, label, ...extra });

// 程式裡的畫面文字：一定要能在檔案裡找到原文，之後才套用得回去
function UI(file, slug, original, label, role = 'p', extra = {}) {
  const src = read(file);
  const probe = extra.probe || original;
  if (!src.includes(probe)) throw new Error(`找不到：${file} ${original}`);
  return { kind: 'text', key: 'ui~' + file.split('/').pop() + '~' + slug, file, path: null, original, label, role, ...extra };
}
function UIL(file, slug, original, label, extra = {}) {
  const src = read(file);
  for (const s of original) if (!src.includes(extra.probeFn ? extra.probeFn(s) : s)) throw new Error(`找不到：${file} ${s}`);
  return { kind: 'list', key: 'ui~' + file.split('/').pop() + '~' + slug, file, path: null, original, label, ...extra };
}

/* ---------------- 青年場 ---------------- */
const Y = 'site/content/youth-levels.json', YH = 'site/content/youth-history.json', YK = 'site/content/youth-level-keys.json', YM = 'site/content/youth-menu.json', YS = 'site/content/youth-story.json';

screens.push({
  id: 'youth-story', tab: 'youth', title: '序章與結局', where: '#/story',
  sections: [
    { items: [IMG('img~story-illustration', 'site/assets/img/', null, '妙妙貓角色插畫（目前先用 logo）', { slot: 'new', hint: '透明背景 PNG，寬至少 480 px' })] },
    { heading: '序章台詞', items: [L(YS, ['prologue'], ys.prologue.map(x => x.text), '序章（每一行是一段對話，{team} 會換成隊名）', { lines: true })] },
    { heading: '結局台詞（目前是空的：沒有台詞時全破後直接到完成摘要）', items: [L(YS, ['ending'], (ys.ending || []).map(x => x.text), '結局（每一行是一段對話）', { lines: true })] },
  ],
});

screens.push({
  id: 'youth-menu', tab: 'youth', title: '關卡選單', where: '#/menu',
  sections: [
    { heading: '關卡卡片', items: ym.levels.flatMap((c, i) => [
      T(YM, ['levels', i, 'place'], c.place, `${c.no}・地點`, 'card-place', { group: c.no }),
      T(YM, ['levels', i, 'task'], c.task, `${c.no}・任務說明`, 'card-task', { group: c.no }),
    ]) },
    { heading: 'NPC 卡片', items: ym.npcs.flatMap((c, i) => [
      T(YM, ['npcs', i, 'name'], c.name, `NPC ${c.key}・名字`, 'card-place', { group: 'NPC ' + c.key }),
      T(YM, ['npcs', i, 'who'], c.who, `NPC ${c.key}・角色簡介`, 'card-task', { group: 'NPC ' + c.key }),
    ]) },
    { heading: '選單上的說明', items: [
      UI('site/assets/js/youth.js', 'menu-route', '第一關慈祐宮完成後，才會開放第二到第六關；之後順序不限。', '鎖關說明', 'small'),
      UI('site/assets/js/youth.js', 'menu-npc', '題目由 NPC 在現場口頭說明，沒有提示。六關和三個 NPC 任務都完成，才算全破。', 'NPC 區塊說明', 'small'),
      UI('site/assets/js/youth.js', 'menu-safety', '過馬路請注意安全。只需要用眼睛觀察，不必攀爬或觸摸廟裡的文物。', '安全提醒', 'small'),
    ] },
    { heading: '全破彈窗', items: [
      UI('site/assets/js/youth.js', 'allclear-title', '全部解開了！', '彈窗標題', 'h2'),
      UI('site/assets/js/youth.js', 'allclear-body1', '六個關卡和三個 NPC 任務都完成了。', '內文第一句', 'p'),
      UI('site/assets/js/youth.js', 'allclear-body2', '{隊名}，最後的故事要揭曉了。', '內文第二句（{隊名} 會換成隊名）', 'p', { probe: '，最後的故事要揭曉了。' }),
      UI('site/assets/js/youth.js', 'allclear-go', '前往結局', '主要按鈕', 'btn'),
    ] },
  ],
});

screens.push({
  id: 'youth-map', tab: 'youth', title: '廟街地圖', where: '#/map',
  sections: [
    { items: [IMG('img~youth-map', 'site/assets/img/youth-map.webp', 'img/youth-map.webp', '青年場地圖')] },
    { heading: '圖例', items: [UIL('site/assets/js/youth.js', 'map-legend', [
      '慈祐宮（新莊路 218 號）', '戲館巷（新莊路 359 巷）', '米市巷（新莊路 387 巷）', '武聖廟（新莊路 340 號）', '廣福宮（新莊路 150 號）',
      '集合點：林協記文化館（新莊路 317 號 2 樓，慈祐宮斜對面）'], '圖例（每一行一個地點）', { probeFn: s => s.split('（')[0] }),
      UI('site/assets/js/youth.js', 'map-note', '第二關「五間老店」的位置是謎題的一部分，地圖上不標示。', '地圖下方說明', 'small')] },
  ],
});

const FIG = { zodiac: ['youth-L1-zodiac-chart.webp', '現場參考圖｜慈祐宮生肖沖煞表'], shops: ['youth-L2-fig1-shop-positions.webp', '附圖｜A～E 在廟街上的位置'], arrows: ['youth-L2-fig2-4x4-arrows.webp', '附圖｜A～E 的數字藏在哪裡？'] };
const figDone = new Set();

yl.forEach((lv, li) => {
  const sections = [];
  sections.push({ items: [
    T(Y, [li, 'place'], lv.place, '地點', 'kicker'),
    T(Y, [li, 'title'], lv.title, '關卡名稱', 'h1'),
    ...(lv.intro ? [T(Y, [li, 'intro'], lv.intro, '關卡介紹', 'panel')] : []),
  ] });
  sections.push({ heading: '提示（整關共用，依序給）', items: lv.hints.map((h, k) => T(Y, [li, 'hints', k], h, k ? '提示二' : '提示一', 'hint')) });
  lv.tasks.forEach((t, ti) => {
    const P = [li, 'tasks', ti];
    const items = [T(Y, [...P, 'title'], t.title, '任務名稱', 'task-title')];
    if (t.cluesTitle) items.push(T(Y, [...P, 'cluesTitle'], t.cluesTitle, '線索框標題', 'label'));
    if (t.clues && t.cluesFirst) items.push(L(Y, [...P, 'clues'], t.clues, '線索（每一行一條）', { role: 'clues' }));
    if (t.prompt) items.push(T(Y, [...P, 'prompt'], t.prompt, '題目', 'p'));
    if (t.clues && !t.cluesFirst) items.push(L(Y, [...P, 'clues'], t.clues, '線索（每一行一條）', { role: 'clues' }));
    if (t.figure && FIG[t.figure] && !figDone.has(t.figure)) {
      figDone.add(t.figure);
      items.push(IMG('img~' + t.figure, 'site/assets/img/' + FIG[t.figure][0], 'img/' + FIG[t.figure][0], FIG[t.figure][1]));
    } else if (t.figure) items.push({ kind: 'note', text: '附圖：' + FIG[t.figure][1] + '（同上一題）' });
    if (t.placeholder) items.push(T(Y, [...P, 'placeholder'], t.placeholder, '輸入框裡的灰字', 'placeholder'));
    if (t.type === 'text' || t.type === 'number') items.push(L(Y, [...P, 'answer'], t.answer, '可接受的答案', { role: 'answers' }));
    if (t.type === 'fields') t.fields.forEach((f, k) => {
      items.push(T(Y, [...P, 'fields', k, 'label'], f.label, `第 ${k + 1} 格・標籤`, 'label'));
      if (f.clue) items.push(T(Y, [...P, 'fields', k, 'clue'], f.clue, `第 ${k + 1} 格・線索`, 'small'));
      items.push(L(Y, [...P, 'fields', k, 'answer'], f.answer, `第 ${k + 1} 格・可接受的答案`, { role: 'answers' }));
    });
    if (t.type === 'select') items.push({ kind: 'note', text: '正解：' + t.letters.map((l, k) => l + '＝' + t.answer[k]).join('、') + '（選項來自上一題的店名）' });
    if (t.type === 'order') {
      t.items.forEach((it, k) => items.push(T(Y, [...P, 'items', k, 1], it[1], `角色「${it[0]}」的說明`, 'small')));
      items.push({ kind: 'note', text: '正確順序：' + t.answer.join('、') });
    }
    if (t.type === 'choice') {
      t.options.forEach((o, k) => items.push(T(Y, [...P, 'options', k, 1], o[1], `選項 ${o[0]}${o[0] === t.answer ? '（正解）' : ''}`, 'option')));
    }
    if (t.show) items.push(T(Y, [...P, 'show'], t.show, '揭曉／答對後顯示的答案', 'show'));
    sections.push({ heading: `任務 ${ti + 1}`, task: true, items });
  });
  const k = yk[li];
  sections.push({ heading: '本關完成畫面', items: [T(YK, [li, 'key'], k.key, '本關答案（大字）', 'key')] });
  const h = yh[li];
  sections.push({ heading: '歷史補充頁', items: [
    IMG('img~history-youth-' + (li + 1), 'site/assets/img/', null, '現場照片（目前沒有，整塊不顯示）', { slot: 'new' }),
    T(YH, [li, 'title'], h.title, '標題', 'h2'),
    T(YH, [li, 'keyline'], h.keyline, '一句話重點', 'keypoint'),
    ...h.answers.flatMap((a, ai) => [T(YH, [li, 'answers', ai, 0], a[0], `本關答案 ${ai + 1}・題目`, 'label'), T(YH, [li, 'answers', ai, 1], a[1], `本關答案 ${ai + 1}・答案`, 'small')]),
    ...h.paras.map((p, pi) => T(YH, [li, 'paras', pi], p, `看更多・第 ${pi + 1} 段`, 'p')),
    T(YH, [li, 'source'], h.source, '資料來源', 'small'),
  ] });
  screens.push({ id: 'youth-L' + (li + 1), tab: 'youth', title: lv.no + '・' + lv.place, where: `#/level/${li + 1}`, sections });
});

/* ---------------- 親子場 ---------------- */
const F = 'site/content/family-levels.json', FH = 'site/content/family-history.json', FM = 'site/content/family-menu.json';
screens.push({
  id: 'family-menu', tab: 'family', title: '關卡選單', where: '#/menu',
  sections: [
    { heading: '關卡卡片', items: fm.levels.flatMap((c, i) => [
      T(FM, ['levels', i, 'place'], c.place, `${c.no}・地點`, 'card-place', { group: c.no }),
      T(FM, ['levels', i, 'task'], c.task, `${c.no}・任務說明`, 'card-task', { group: c.no }),
    ]) },
    { heading: 'NPC 卡片', items: fm.npcs.flatMap((c, i) => [
      T(FM, ['npcs', i, 'name'], c.name, `NPC ${c.key}・名字`, 'card-place', { group: 'NPC ' + c.key }),
      T(FM, ['npcs', i, 'who'], c.who, `NPC ${c.key}・角色簡介`, 'card-task', { group: 'NPC ' + c.key }),
    ]) },
    { heading: '選單上的說明', items: [
      UI('site/assets/js/family.js', 'menu-intro', '共七關，每關有 2～7 個小任務，完成必答任務就能過關。', '關卡說明', 'small'),
      UI('site/assets/js/family.js', 'menu-npc', '題目由 NPC 在現場口頭說明，沒有提示。七關和三個 NPC 任務都完成，才算全破。', 'NPC 區塊說明', 'small'),
      UI('site/assets/js/family.js', 'menu-safety', '過馬路請牽好小朋友。在店家前拍照不用進店，也請不要打擾營業。', '安全提醒', 'small'),
      UI('site/assets/js/family.js', 'level-route', '清單順序是建議路線，可自由選擇任務。', '關卡頁上方說明', 'small'),
      UI('site/assets/js/family.js', 'pass', '必答任務都完成了，本關過關！', '必答完成時的橫幅', 'p'),
      UI('site/assets/js/family.js', 'pass-sub', '加分題可以挑戰，也可以直接看歷史故事。', '必答完成時的小字', 'small'),
      UI('site/assets/js/family.js', 'bonus-note', '答對可以得到一顆星；不答也不影響過關。', '加分題說明', 'small'),
    ] },
  ],
});
screens.push({
  id: 'family-map', tab: 'family', title: '廟街地圖', where: '#/map',
  sections: [
    { items: [{ kind: 'note', text: '親子場地圖是網站裡畫的線條圖，不是圖片。要加地點或改位置，請在下面的圖例或「其他想改的地方」寫給 Claude。' }] },
    { heading: '圖例', items: [UIL('site/assets/js/family.js', 'map-legend', [
      '1 慈祐宮（新莊路 218 號）', '2 五間老店（方形標記）', '翁裕美商行（新莊路 128 號）', '金合和糕餅（新莊路 269 號）', '億德堂蔘藥行（新莊路 325 號）',
      '日日用打鐵舖（新莊路 414 號）', '响仁和（中正路 173 號）', '3 戲館巷（新莊路 359 巷）', '4 米市巷（新莊路 387 巷）', '5 武聖廟（新莊路 340 號）',
      '6 廣福宮（新莊路 150 號）', '7 潮江寺（碧江街 47 號，米市巷底）', '集合點：林協記文化館（新莊路 317 號 2 樓，慈祐宮斜對面）'],
      '圖例（每一行一個地點）', { probeFn: s => s.replace(/^\d /, '').split('（')[0] })] },
  ],
});

fl.forEach((lv, li) => {
  const sections = [];
  sections.push({ items: [T(F, [li, 'place'], lv.place, '地點', 'kicker'), T(F, [li, 'title'], lv.title, '關卡名稱', 'h1')] });
  sections.push({ heading: '提示（整關共用，依序給）', items: lv.hints.map((h, k) => T(F, [li, 'hints', k], h, k ? '提示二' : '提示一', 'hint')) });
  lv.tasks.forEach((t, ti) => {
    const P = [li, 'tasks', ti];
    const items = [T(F, [...P, 'title'], t.title, '任務名稱' + (t.bonus ? '（加分題）' : ''), 'task-title')];
    if (t.prompt) items.push(T(F, [...P, 'prompt'], t.prompt, '題目', 'p'));
    if (t.photo) items.push(T(F, [...P, 'photo'], t.photo, '拍照步驟', 'p'));
    if (t.photoNote) items.push(T(F, [...P, 'photoNote'], t.photoNote, '拍照提醒', 'small'));
    if (t.after) items.push(T(F, [...P, 'after'], t.after, '拍好之後要做的事', 'small'));
    if (t.placeholder) items.push(T(F, [...P, 'placeholder'], t.placeholder, '輸入框裡的灰字', 'placeholder'));
    if (t.type === 'text') {
      if (t.answer && t.answer.length) items.push(L(F, [...P, 'answer'], t.answer, '可接受的答案（要完全一樣）', { role: 'answers' }));
      if (t.contains && t.contains.length) items.push(L(F, [...P, 'contains'], t.contains, '答案裡只要包含其中一個就算對', { role: 'answers' }));
    }
    if (t.type === 'number') {
      items.push(T(F, [...P, 'answer'], String(t.answer), '正確數字（最多 4 位）', 'code', { numeric: true }));
      if (t.unit) items.push(T(F, [...P, 'unit'], t.unit, '單位', 'small'));
    }
    if (t.type === 'choice') t.options.forEach((o, k) => items.push(T(F, [...P, 'options', k, 1], o[1], `選項 ${o[0]}${o[0] === t.answer ? '（正解）' : ''}`, 'option')));
    if (t.type === 'multi') t.fields.forEach((f, k) => {
      items.push(T(F, [...P, 'fields', k], f, `第 ${k + 1} 格・標籤`, 'label'));
      if (t.placeholders && t.placeholders[k]) items.push(T(F, [...P, 'placeholders', k], t.placeholders[k], `第 ${k + 1} 格・灰字`, 'placeholder'));
      items.push(L(F, [...P, 'answer', k], t.answer[k], `第 ${k + 1} 格・可接受的答案${t.anyOrder ? '（兩格可對調）' : ''}`, { role: 'answers' }));
    });
    if (t.show) items.push(T(F, [...P, 'show'], t.show, '揭曉／答對後顯示的答案', 'show'));
    sections.push({ heading: `任務 ${ti + 1}${t.bonus ? '・加分題' : ''}`, task: true, items });
  });
  const h = fh[li];
  sections.push({ heading: '歷史介紹頁', items: [
    IMG('img~history-family-' + (li + 1), 'site/assets/img/', null, '現場照片（目前沒有，整塊不顯示）', { slot: 'new' }),
    T(FH, [li, 'title'], h.title, '標題', 'h2'),
    T(FH, [li, 'keyline'], h.keyline, '一句話重點', 'keypoint'),
    ...h.answers.flatMap((a, ai) => [T(FH, [li, 'answers', ai, 0], a[0], `本關答案 ${ai + 1}・題目`, 'label'), T(FH, [li, 'answers', ai, 1], a[1], `本關答案 ${ai + 1}・答案`, 'small')]),
    ...h.paras.map((p, pi) => T(FH, [li, 'paras', pi], p, `看更多・第 ${pi + 1} 段`, 'p')),
    T(FH, [li, 'source'], h.source, '資料來源', 'small'),
  ] });
  screens.push({ id: 'family-L' + (li + 1), tab: 'family', title: lv.no + '・' + lv.place, where: `#/level/${li + 1}`, sections });
});

/* ---------------- NPC ---------------- */
const N = 'site/content/npc.json';
npc.forEach((n, ni) => {
  const sections = [{ items: [T(N, [ni, 'name'], n.name, '名字', 'h1'), T(N, [ni, 'role'], n.role, '角色設定（畫面最上方）', 'panel')] }];
  n.tasks.forEach((t, ti) => {
    const P = [ni, 'tasks', ti];
    const items = [T(N, [...P, 'title'], t.title, '任務名稱', 'task-title')];
    if (t.prompt) items.push(T(N, [...P, 'prompt'], t.prompt, '說明', 'p'));
    else if (t.type === 'text') items.push({ kind: 'add', key: keyOf(N, [...P, 'prompt']), file: N, path: [...P, 'prompt'], label: '說明（目前沒有：玩家只看到「答案」輸入框）', role: 'p' });
    if (t.label) items.push(T(N, [...P, 'label'], t.label, '輸入框標籤', 'label'));
    if (t.type === 'text') items.push(L(N, [...P, 'answer'], t.answer, '可接受的答案（只忽略空白和標點）', { role: 'answers' }));
    if (t.type === 'multi') t.fields.forEach((f, k) => {
      items.push(T(N, [...P, 'fields', k], f, `第 ${k + 1} 格・標籤`, 'label'));
      items.push(L(N, [...P, 'answer', k], t.answer[k], `第 ${k + 1} 格・可接受的答案`, { role: 'answers' }));
    });
    if (t.doneText) items.push(T(N, [...P, 'doneText'], t.doneText, '完成後顯示', 'show'));
    sections.push({ heading: `任務 ${ti + 1}`, task: true, items });
  });
  screens.push({ id: 'npc-' + n.key, tab: 'npc', title: `NPC ${n.key}・${n.name}`, where: `#/npc/${n.key}`, sections });
});
screens.push({
  id: 'npc-common', tab: 'npc', title: 'NPC 頁共用文字', where: '#/npc/A',
  sections: [{ items: [
    UI('site/assets/js/npc.js', 'route', '題目由 NPC 在現場口頭說明，順序不限。', '任務清單上方說明', 'small'),
    UI('site/assets/js/npc.js', 'wrong', '和 NPC 說的不太一樣，注意同音字，再確認一次吧。', '答錯時的紅字', 'err'),
  ] }],
});

/* ---------------- 共用文字 ---------------- */
const SC = 'site/assets/js/screens-common.js';
screens.push({
  id: 'shared-entry', tab: 'shared', title: '入口頁', where: '/',
  sections: [{ items: [
    IMG('img~logo', 'site/assets/img/logo.webp', 'img/logo.webp', 'logo（入口頁、開始頁）', { hint: '品牌規範：不可裁切、不可改色' }),
    UI('site/index.html', 'kicker', '新莊廟街・實境解謎', '小標', 'kicker'),
    UI('site/index.html', 'title', '妙妙貓的廟街委託', '大標題', 'h1'),
    UI('site/index.html', 'lead', '請選擇你們今天參加的場次。', '說明', 'p'),
    UI('site/index.html', 'youth-desc', '六個關卡、三個 NPC 任務，以推理解謎為主', '青年場按鈕說明', 'small', { probe: '以推理解謎為主' }),
    UI('site/index.html', 'family-desc', '七個關卡、三個 NPC 任務，以觀察和拍照為主', '親子場按鈕說明', 'small', { probe: '以觀察和拍照為主' }),
    UI('site/index.html', 'foot', '請依工作人員告知的場次選擇', '按鈕下方小字', 'small'),
  ] }],
});
screens.push({
  id: 'shared-start', tab: 'shared', title: '開始頁與取名', where: '#/、#/name',
  sections: [
    { heading: '開始頁', items: [
      UI(SC, 'lead-youth', '六個關卡、三個 NPC 任務，用眼睛在老街裡找出答案。', '青年場說明', 'p', { probe: '六個關卡、三個 NPC 任務，' }),
      UI(SC, 'lead-family', '七個關卡、三個 NPC 任務，用眼睛在老街裡找出答案。', '親子場說明', 'p', { probe: '七個關卡、三個 NPC 任務，' }),
      UI(SC, 'team-size', '建議 2～4 人一組，共用一支手機', '人數提醒', 'small'),
      UI('site/youth/index.html', 'loading', '載入中，請稍候…', '網路慢時顯示', 'small'),
    ] },
    { heading: '取隊名', items: [
      UI(SC, 'name-title', '幫你的隊伍取個名字', '標題', 'h1'),
      UI(SC, 'name-lead', '妙妙貓會在故事裡叫你們這個名字。', '說明（兩場共用；親子場沒有故事）', 'p'),
      UI(SC, 'name-ph-youth', '例如：廟口探險隊', '青年場輸入框灰字', 'placeholder'),
      UI(SC, 'name-ph-family', '例如：妙妙一家人', '親子場輸入框灰字', 'placeholder'),
      UI(SC, 'name-help', '2～12 個字，可用中英文與數字', '輸入框下方說明', 'small'),
      UI(SC, 'name-err-empty', '請輸入隊伍名稱', '錯誤：空白', 'err'),
      UI(SC, 'name-err-long', '名稱請勿超過 12 個字', '錯誤：太長', 'err'),
      UI(SC, 'name-err-char', '名稱只能使用中英文與數字', '錯誤：有符號或空格', 'err'),
      UI(SC, 'name-err-short', '名稱至少要 2 個字', '錯誤：只有 1 個字', 'err'),
    ] },
  ],
});
const RULES_SRC = read(SC);
const rules = ed => {
  const m = RULES_SRC.match(new RegExp(ed + ': \\[([\\s\\S]*?)\\]'));
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};
screens.push({
  id: 'shared-rules', tab: 'shared', title: '遊戲說明', where: '「遊戲說明」按鈕',
  sections: [
    { heading: '青年場', items: [UIL(SC, 'rules-youth', rules('youth'), '每一行一條說明')] },
    { heading: '親子場', items: [UIL(SC, 'rules-family', rules('family'), '每一行一條說明')] },
  ],
});
screens.push({
  id: 'shared-play', tab: 'shared', title: '關卡頁訊息', where: '關卡頁',
  sections: [
    { heading: '青年場', items: [
      UI('site/assets/js/youth.js', 'err-empty', '請先填完，再按「送出答案」。', '沒填完', 'err'),
      UI('site/assets/js/youth.js', 'err-wrong', '答案似乎不正確，再觀察一次現場吧。', '答錯', 'err'),
      UI('site/assets/js/youth.js', 'err-select', '有幾格對不上，再對照一次附圖和線索吧。', '對照題答錯', 'err'),
      UI('site/assets/js/youth.js', 'err-order', '順序似乎不正確，再對照一次線索吧。', '排序題答錯', 'err'),
      UI('site/assets/js/youth.js', 'hint1-body', '本關共有兩次提示機會，看完還剩 1 次。', '第一次提示的確認文字', 'small'),
      UI('site/assets/js/youth.js', 'hint2-body', '確定要查看嗎？看完之後，如果還是想不出來，可以揭曉這個任務的答案。', '最後一次提示的確認文字', 'small'),
      UI('site/assets/js/youth.js', 'result-self', '你們自己解開了「{關卡名}」，觀察得真仔細！', '本關完成：自己解出', 'p', { probe: '，觀察得真仔細！' }),
      UI('site/assets/js/youth.js', 'result-revealed', '這一關有揭曉答案，一樣算過關。一起來認識它背後的故事吧！', '本關完成：有揭曉', 'p'),
    ] },
    { heading: '親子場', items: [
      UI('site/assets/js/family.js', 'err-empty', '請先作答，再按「送出答案」。', '沒作答', 'err'),
      UI('site/assets/js/family.js', 'err-wrong', '答案似乎不正確，再觀察一次現場吧。', '答錯', 'err'),
      UI('site/assets/js/family.js', 'hint2-body', '確定要查看嗎？看完之後，還沒完成的任務可以選擇揭曉答案。', '最後一次提示的確認文字', 'small'),
      UI('site/assets/js/family.js', 'photo-note', '照片存在你們自己的手機裡，不需要上傳。', '拍照任務的小字', 'small'),
    ] },
  ],
});
screens.push({
  id: 'shared-summary', tab: 'shared', title: '完成摘要', where: '#/summary',
  sections: [{ items: [
    UI(SC, 'summary-title', '新莊廟街任務完成！', '大標題', 'h1'),
    UI('site/config.js', 'passcode-youth', '3916', '青年場通關碼', 'code', { probe: "youth: '3916'" }),
    UI('site/config.js', 'passcode-family', '4827', '親子場通關碼', 'code', { probe: "family: '4827'" }),
    UI(SC, 'summary-note', '請把這個畫面拿給工作人員看', '通關碼下方', 'small'),
    UI(SC, 'summary-stars', '答對加分題得到星星，不影響過關。', '親子場星星說明', 'small'),
    UI('site/config.js', 'feedback', read('site/config.js').match(/feedbackUrl: '([^']*)'/)[1], '「填寫遊戲回饋」連到的表單網址', 'code'),
    UI(SC, 'summary-done', '完成遊戲', '按鈕', 'btn'),
    UI('site/assets/js/ui.js', 'restart-title', '確定要重新開始？', '重新開始彈窗標題', 'h2'),
    UI('site/assets/js/ui.js', 'restart-body', '重新開始會清除目前所有關卡進度，無法復原。', '重新開始彈窗內文', 'p'),
  ] }],
});

/* ---------------- 圖片總覽 ---------------- */
const allImgs = screens.flatMap(s => s.sections.flatMap(sec => sec.items.filter(i => i.kind === 'image').map(i => ({ ...i, screen: s.title, tab: s.tab }))));

const data = { commit, builtAt: new Date().toISOString(), screens, imageCount: allImgs.length };
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const tpl = readFileSync(HERE + 'template.html', 'utf8');
writeFileSync(process.argv[3] || HERE + 'editor.html', tpl.replace('__DATA__', () => json));
const count = screens.reduce((n, s) => n + s.sections.reduce((m, sec) => m + sec.items.filter(i => i.key).length, 0), 0);
console.log(`screens ${screens.length}, editable items ${count}, images ${allImgs.length}, json ${json.length} bytes, commit ${commit}`);
