// 答案判定。三套規則刻意不同（HANDOFF §7.3），請不要合併。
// 每個 check 回傳 { ok, empty, bad }：empty = 沒填完；bad = 哪幾格錯（只有需要標格子的題型才有意義）。

// 青年場關卡：全形數字轉半形，再去掉所有空白與標點；與 answer 陣列裡任一寫法相同即正確
export function stripYouth(x) {
  return String(x ?? '')
    .replace(/[\uFF10-\uFF19]/g, c => String.fromCharCode(c.charCodeAt(0) - 65248))
    .replace(/[\s\u200B-\u200F!-\/:-@\[-\x60{-~\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u2010-\u205E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30FB\uFE10-\uFE19\uFE30-\uFE6B\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/g, '');
}

// NPC 任務（兩場共用）：同一個標點規則，但「沒有」全形數字轉換
export function stripNpc(x) {
  return String(x ?? '')
    .replace(/[\s\u200B-\u200F!-\/:-@\[-\x60{-~\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u2010-\u205E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30FB\uFE10-\uFE19\uFE30-\uFE6B\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/g, '');
}

// 親子場關卡：只去掉空白和少數標點；answer 要完全相同，contains 只要包含
export function normFamily(x) {
  return String(x ?? '').replace(/[\s\u3000\uFF0C\u3001\u3002\uFF0E\u30FB\u00B7\/\uFF0F\-\uFF0D:\uFF1A\uFF08\uFF09()]/g, '');
}

function matchWith(strip, value, answers) {
  const v = strip(value);
  if (!v) return null;
  for (const a of answers || []) if (strip(a) === v) return a;
  return null;
}

/* ---------- 青年場關卡（原型 T08Level check()） ----------
   draft: { text, vals: [], order: [], choice } */
export function checkYouth(t, d = {}) {
  const n = t.type === 'fields' ? t.fields.length : t.type === 'select' ? (t.letters || t.answer).length : 0;
  const none = Array(n).fill(false);
  if (t.type === 'text' || t.type === 'number') {
    if (!stripYouth(d.text)) return { ok: false, empty: true, bad: none };
    return { ok: matchWith(stripYouth, d.text, t.answer) !== null, empty: false, bad: none };
  }
  if (t.type === 'fields' || t.type === 'select') {
    const bad = none.slice();
    let empty = false, ok = true;
    for (let k = 0; k < n; k++) {
      const v = (d.vals && d.vals[k]) || '';
      if (t.type === 'fields') {
        if (!stripYouth(v)) { empty = true; continue; }
        if (matchWith(stripYouth, v, t.fields[k].answer) === null) { ok = false; bad[k] = true; }
      } else {
        if (!v) { empty = true; continue; }
        if (v !== t.answer[k]) { ok = false; bad[k] = true; }
      }
    }
    if (empty) return { ok: false, empty: true, bad: none };
    return { ok, empty: false, bad };
  }
  if (t.type === 'order') {
    const order = d.order || [];
    if (order.length < t.answer.length) return { ok: false, empty: true, bad: none };
    return { ok: order.join('|') === t.answer.join('|'), empty: false, bad: none };
  }
  if (t.type === 'choice') {
    if (!d.choice) return { ok: false, empty: true, bad: none };
    return { ok: d.choice === t.answer, empty: false, bad: none };
  }
  return { ok: false, empty: true, bad: none };
}

/* ---------- NPC 任務（原型 FNpc submit） ----------
   draft: { text, fields: [a, b] } */
export function checkNpc(t, d = {}) {
  if (t.type === 'text') {
    if (!stripNpc(d.text)) return { ok: false, empty: true, bad: [] };
    return { ok: matchWith(stripNpc, d.text, t.answer) !== null, empty: false, bad: [] };
  }
  if (t.type === 'multi') {
    const a = (d.fields && d.fields[0]) || '';
    const b = (d.fields && d.fields[1]) || '';
    if (!stripNpc(a) || !stripNpc(b)) return { ok: false, empty: true, bad: [false, false] };
    const okA = matchWith(stripNpc, a, t.answer[0]) !== null;
    const okB = matchWith(stripNpc, b, t.answer[1]) !== null;
    return { ok: okA && okB, empty: false, bad: [!okA, !okB] };
  }
  return { ok: false, empty: true, bad: [] };
}

/* ---------- 親子場關卡（原型 F07Level submit） ----------
   draft: { text, digits, choice, fields: [a, b] } */
function familyAccepts(t, value) {
  const v = normFamily(value);
  if (!v) return false;
  return (t.answer || []).some(a => normFamily(a) === v) ||
    (t.contains || []).some(c => v.indexOf(normFamily(c)) >= 0);
}
function familyFieldOk(t, idx, value) {
  const v = normFamily(value);
  if (!v) return false;
  return ((t.answer && t.answer[idx]) || []).some(a => normFamily(a) === v);
}
export function checkFamily(t, d = {}) {
  let filled = true, ok = false;
  if (t.type === 'choice') {
    filled = !!d.choice;
    ok = d.choice === t.answer;
  } else if (t.type === 'number') {
    const digits = d.digits || '';
    filled = digits !== '';
    ok = digits === String(t.answer);
  } else if (t.type === 'text') {
    filled = normFamily(d.text) !== '';
    ok = familyAccepts(t, d.text);
  } else if (t.type === 'multi') {
    const a = (d.fields && d.fields[0]) || '';
    const b = (d.fields && d.fields[1]) || '';
    filled = normFamily(a) !== '' && normFamily(b) !== '';
    ok = (familyFieldOk(t, 0, a) && familyFieldOk(t, 1, b)) ||
      (!!t.anyOrder && familyFieldOk(t, 0, b) && familyFieldOk(t, 1, a));
  }
  if (!filled) return { ok: false, empty: true, bad: [] };
  return { ok, empty: false, bad: [] };
}
