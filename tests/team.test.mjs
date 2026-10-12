import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTeam } from '../site/assets/js/screens-common.js';

test('隊名驗證（HANDOFF §7.6）', () => {
  assert.deepEqual(validateTeam('  廟口探險隊 '), { ok: true, name: '廟口探險隊', count: 5, error: '' });
  assert.equal(validateTeam('').error, '請輸入隊伍名稱');
  assert.equal(validateTeam('   ').error, '請輸入隊伍名稱');
  assert.equal(validateTeam('妙').error, '名稱至少要 2 個字');
  assert.equal(validateTeam('廟口最強探險隊妙妙貓粉絲團').error, '名稱請勿超過 12 個字');
  assert.equal(validateTeam('妙妙!').error, '名稱只能使用中英文與數字');
  assert.equal(validateTeam('妙妙 一家').error, '名稱只能使用中英文與數字');
  assert.equal(validateTeam('Team42').ok, true);
  assert.equal(validateTeam('妙妙貓１２').ok, true);
  assert.equal(validateTeam('一二三四五六七八九十ab').ok, true);
});
