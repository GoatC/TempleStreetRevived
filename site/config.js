// 活動設定。改完存檔、上傳，網站就會更新。
export const CONFIG = {
  // 通關碼：全破後給工作人員看。兩場各一組固定 4 位數（Hugo 2026-10-12 同意）。
  passcode: { youth: '3916', family: '4827' },
  // 回饋表單網址；空白就不顯示「填寫遊戲回饋」按鈕。
  feedbackUrl: 'https://forms.gle/Li9he5gCWXmQbnKU6',
  // NPC 出沒提示：每天 time 到 until 之間（玩家手機的時間，24 小時制）跳出提醒，一天只跳一次；
  // 到 until 還開著就自動關掉，之後也不再跳。time 改成 '' 就不跳。
  npcAlert: { time: '14:00', until: '17:00' },
};
