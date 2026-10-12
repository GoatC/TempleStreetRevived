# 妙妙廟實境解謎網站｜專案規則 / Project rules

新莊廟街的手機實境解謎網站：入口頁 `/`、青年場 `/youth/`、親子場 `/family/`，放在 GitHub Pages。
A mobile puzzle-trail site for Xinzhuang Temple Street: entry `/`, youth `/youth/`, family `/family/`, hosted on GitHub Pages.

## 開工前 / Before you start

- **先完整讀 `HANDOFF.md`**，裡面是全部規格。
- 開工前，把 `HANDOFF.md` §12 的待確認事項整理好，**一次**問 Hugo。他沒空回覆的題目，照表上的預設做法進行。
- 第一場活動是 **2026-10-18**。10/17 起只修 bug，不改內容。

## 跟 Hugo 說話 / Talking to Hugo

- 用繁體中文、白話。Hugo 沒有資訊背景：一次只請他做一件事，GitHub 網頁操作要寫清楚每一步。
- 需要他決定的事，給選項並附上你的建議。
- 每完成一段，給他一個手機能直接打開的網址，並說明要測什麼。

## 資料夾 / Folders

- `site/`：要部署的網站，在這裡施工。
- `site/content/*.json`：題目、答案、提示、歷史文字。**內容以這裡為準。**
- `design/`：Claude 設計畫布的原型（只讀參考，不部署，不能直接執行）。
- `assets-src/`：原始圖片和完整字型（不部署）。壓縮後放到 `site/assets/`。
- `tools/`：輔助腳本。

## 不能做 / Don't

- 不要自己改題目、答案、提示、歷史文字或畫面文案。有疑問就列出來問 Hugo。
- 不要合併三套答案判定規則（青年場、NPC、親子場各不相同），照 `HANDOFF.md` §7.3 逐字移植。
- 不要新增顏色、陰影或 emoji；沿用 `design/miao.css` 的 tokens 和 class。品牌規範：`design/ds/templestreetrevived/README.md`（不畫神像）。
- 不要引入框架、建置步驟或外部 CDN，除非先跟 Hugo 說明理由並得到同意。
- 不要用絕對路徑（`/youth/`），網站會在 GitHub Pages 的子路徑下；一律用相對路徑。
- 不要在 viewport 關掉縮放。

## 指令 / Commands

- 本機預覽：`npx serve site`（或 `python3 -m http.server 8080 --directory site`）
- 單元測試：`node --test tests/`
- 從設計稿重新抽出內容：`node tools/extract-content.js`
- 字型子集化（建好後）：`python3 tools/subset-fonts.py`
