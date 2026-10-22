# 妙妙廟實境解謎網站｜Claude Code 施工交接
# Miaomiao Temple Street Puzzle Site — Implementation Handoff

- 交接日期：2026-10-12（設計畫布 Version 34）
- 設計畫布（視覺參考，需要 Hugo 的 Claude 帳號登入）：https://claude.ai/artifact/AdqeLvQ3ssTTCRk1LzVBHZ
- 窗口：Hugo（Goat），妙妙廟團隊 PM。沒有資訊背景，請用繁體中文、白話說明。

---

## 0. 一分鐘摘要 / TL;DR

- 要做一個**手機用的靜態網站**，放在 GitHub Pages，同一個網站底下三個網址：
  - `/`：入口頁，玩家選場次
  - `/youth/`：青年場，6 個關卡＋3 個 NPC 任務，以推理解謎為主
  - `/family/`：親子場，7 個關卡＋3 個 NPC 任務，以觀察和拍照為主
- 每隊 2～4 人**共用一支手機**。沒有後端、沒有登入。進度存在手機瀏覽器（localStorage），**兩場分開存**。
- 畫面、文案、互動規則都已經在 `design/` 定稿，題目與答案已抽成 `site/content/*.json`。你的工作是**把原型做成真正能用的網站**，不是重新設計。
- **第一場活動是 2026-10-18（六）**，13:00 在林協記文化館集合、13:15 開始。之後還有 10/24、10/25、10/31 三場。時程見 §1。

---

## 1. 時程與範圍 / Timeline & scope

| 日期 | 目標 |
| --- | --- |
| 10/12～10/14 | P0 全部完成並部署到 GitHub Pages：兩場都能從頭玩到尾 |
| 10/15～10/16 | 團隊拿手機到廟街實地走一次（每一關、每個 NPC），依結果修正 |
| 10/17 | 凍結：只修 bug，不改內容 |
| 10/18 | 第一場活動 |

**P0（活動前一定要有）**

1. 入口頁 `/`，兩場的開始頁，以及有進度時的「繼續遊戲」
2. 青年場：隊伍名稱、序章、關卡選單（六關都開放）、6 關（任務依序開啟、每個任務自己的提示、跳過此題、附圖放大）、本關完成、歷史補充、全破彈窗、結局、完成摘要
3. 親子場：關卡選單、7 關（順序不限、拍照、數字鍵盤、加分題星星、提示、跳過此題）、歷史介紹、完成摘要＋通關碼
4. NPC 任務 A／B／C（兩場共用元件，進度分開）
5. 兩張地圖（青年場用圖片，親子場用內嵌 SVG）
6. 答案判定（三套規則，§7.3），並附單元測試
7. 進度儲存、重新開始（含二次確認）
8. 遊戲說明（設計稿沒有畫，§6.5 有草稿）
9. 字型子集化、圖片壓縮（12 MB 的字型在廟街用 4G 載不動，所以列 P0）
10. 部署：GitHub Actions 把 `site/` 發佈到 GitHub Pages

**P1（P0 都穩了再做）**

- Service worker 離線快取（第一次載入後，訊號差也能玩）
- 載入失敗畫面（「重新載入」）
- 關卡深層連結的友善處理（例如第一關還沒過就掃到第三關的 QR code）

**不做**：見 §15。

---

## 2. 資料夾裡有什麼 / What's in this folder

```
miaomiao-site/
├─ CLAUDE.md                 Claude Code 每次開啟都會自動讀的專案規則
├─ HANDOFF.md                這份文件：完整施工規格
├─ 開始使用.md                給 Hugo 的操作說明（怎麼打開 Claude Code）
├─ design/                   Claude 設計畫布的原始檔（只讀參考，不部署）
│  ├─ canvas.json            畫布索引：每個畫面的標題、所在分頁（入口／青年場／親子場）
│  ├─ miao.css               全部視覺樣式：色彩 tokens、按鈕、卡片、彈窗、地圖、鍵盤……
│  ├─ *.dc.html              54 個畫面與狀態（怎麼讀見 §4）
│  └─ ds/templestreetrevived/ 品牌設計系統：README.md（語氣、色彩、logo 規範）、tokens.json
├─ assets-src/               原始素材（未壓縮，不部署）
│  ├─ img/                   logo、青年場地圖、青年場三張附圖
│  └─ fonts/                 源流明體 GenRyuMin TW Regular／Bold（各約 6 MB，SIL OFL 授權）
├─ site/                     要部署的網站（在這裡施工）
│  └─ content/               已從設計稿逐字抽出的題目、答案、提示、歷史文字（JSON）
└─ tools/
   └─ extract-content.js     設計稿更新後，重新抽出 site/content/*.json 的腳本
```

---

## 3. 以什麼為準 / Sources of truth

依優先順序：

1. **`site/content/*.json`**：題目、答案（含可接受的寫法）、提示、歷史文字、選單卡片文字。逐字從設計稿抽出，內容以這裡為準。
2. **`design/*.dc.html`**：每個畫面的版面、文案、狀態和互動邏輯。原型的邏輯寫在每個檔案最底部 `<script type="text/x-dc">` 裡的 `class Component`。
3. **`design/miao.css`**：所有視覺樣式。直接沿用 class 名稱和 tokens，只把固定 390×844 的畫框改成可伸縮版面（§5）。
4. **這份文件**：畫面之間怎麼跳、真實環境要補的行為（存檔、網址、重新開始、設定值）。
5. **`design/ds/templestreetrevived/README.md`**：品牌規範。重點：不畫神像；temple-red 一個畫面只當一個重點色；不用陰影；不用 emoji。
6. Google Drive 背景文件（一般不用讀，對內容有疑問時再請 Hugo 提供）：「遊戲結構」（早期 UX 規劃）、「新莊廟街實境解謎_青年場關卡設計稿_v5_NPC」、「新莊廟街實境解謎_親子場關卡設計稿_v4_NPC」。設計稿和這些文件不一致時，**以設計稿為準**，把差異列給 Hugo。

> **規則：不要自己改題目、答案、提示、歷史文字或任何畫面文案。** 發現錯字、矛盾或覺得題目有問題，列成清單問 Hugo。

---

## 4. 怎麼讀設計檔 / Reading the `.dc.html` prototypes

- 一個檔案就是一個畫面或一個狀態，畫框是手機尺寸 390×844。比 844 高的畫框（例如 1880）代表「整頁捲動下來的完整長度」。
- 語法：
  - `{{ name }}`：值來自 `renderVals()` 的回傳
  - `<sc-if value="{{ x }}">`：條件顯示
  - `<sc-for list="{{ items }}" as="it">`：迴圈
  - `<dc-import name="X" some-prop="…">`：把 `X.dc.html` 當元件引入，kebab-case 屬性等於 camelCase 的 props
- **只有一個 `<dc-import>` 的檔案是「狀態板」**：同一個元件套上預設 props，用來展示某個狀態。例如 `F07Shop.dc.html` = `F07Level` 第 2 關、任務 0～1 已完成、任務 2 展開中。它們是狀態的視覺規格，不是要另外做的頁面。
- `data-props` 裡的 `fillA`、`doneAt`、`openAt`、`hintUsed`、`modal`、`frameH` 等，只是讓設計畫布切換狀態用的旋鈕，正式網站改由真實進度驅動。
- 圖片網址 `/_blob/<id>` 對應 `assets-src/img/` 的檔案，對照表在 §10。
- 原型需要畫布的執行環境（`support.js`），這裡沒有附，不要試著直接執行原型。要看畫面長相，請 Hugo 打開上面的設計畫布連結，或從畫布匯出 PDF 放進資料夾。
- 檔名開頭：`T` = 青年場（T00 入口頁是兩場共用），`F` = 親子場，`FNpc` = 兩場共用的 NPC 頁，`Main` = 兩場共用的開始頁（`edition` prop 切換）。

### 4.1 設計檔與正式網址對照

| 設計檔 | 內容 | 正式網址 |
| --- | --- | --- |
| `T00Entry`、`T00EntryProgress` | 入口頁：預設／青年場有進度 | `/` |
| `Main`（edition=youth）、`T02Continue` | 青年場開始頁：無進度／有進度 | `/youth/#/` |
| `T03Name`、`T03NameError` | 隊伍名稱：預設／錯誤 | `/youth/#/name` |
| `T05Story`、`T05StoryLast` | 序章對話：一般段落／最後一段 | `/youth/#/story` |
| `T06Menu`、`T06Menu1`、`T06MenuNpcLeft`、`T06Menu3` | 關卡選單：開始時／第一關完成後／六關完成但 NPC 未完／全破彈窗 | `/youth/#/menu` |
| `T06Map` | 青年場地圖（PNG＋圖例，可點開放大） | `/youth/#/map` |
| `T08Level` ＋ `T08L1Zodiac`、`T08L1Zoom`、`T08L2Select`、`T08L2Grid`、`T08L3Order`、`T08L4Error`、`T08L5Orders`、`T08L6Choice` | 關卡頁與各題型狀態（附圖題、附圖放大、下拉對照、五格數字＋揭曉、點選排序、答錯、四道軍令、五選一） | `/youth/#/level/1`～`6` |
| `T09Hint1`、`T09HintLast`、`T09HintContent`、`T09Reveal` | 提示確認、最後提示、提示內容、揭曉確認（都是彈窗；揭曉已改成跳過，見 §7.1） | 關卡頁上的彈窗 |
| `T10Correct`、`T10Revealed` | 本關完成：自行解出／有跳過（`T10Revealed` 的版面，見 §7.1） | `/youth/#/level/N/result` |
| `T11History`、`T11HistoryOpen` | 歷史補充：一句話重點／看更多展開 | `/youth/#/level/N/history` |
| `T07Npc`（= `FNpc` edition=youth） | 青年場 NPC 任務 | `/youth/#/npc/A`～`C` |
| `Components` | 青年場元件表：按鈕、輸入框、排序選項、關卡卡片、一般彈窗、**重新開始確認彈窗** | — |
| `F02Start`、`F02StartContinue`（= `Main` edition=family） | 親子場開始頁：無進度／有進度 | `/family/#/` |
| `F06Menu`、`F06MenuMid`、`F06MenuNpcLeft`、`F06MenuClear` | 親子場關卡選單：開始／4 關＋1 NPC／七關完成但 NPC 未完／全破 | `/family/#/menu` |
| `F06Map` | 親子場地圖（內嵌 SVG＋圖例） | `/family/#/map` |
| `F07Level` ＋ `F07Ciyou`、`F07Shop`、`F07MishiNumber`、`F07MishiBonus`、`F07ChaoReveal`、`F07WushengDone` | 親子場關卡頁與各狀態 | `/family/#/level/1`～`7` |
| `F11History`、`F11HistoryOpen` | 歷史介紹 | `/family/#/level/N/history` |
| `FNpc` ＋ `FNpcAField`、`FNpcB`、`FNpcCDone` | NPC 任務頁（兩場共用元件）與狀態 | `/family/#/npc/A`～`C` |
| `F12Summary` | 親子場完成摘要＋通關碼 | `/family/#/summary` |
| `FComponents` | 親子場元件表：任務卡各題型、數字鍵盤、選擇題、揭曉狀態 | — |

---

## 5. 技術做法 / Technical approach

以下是預設做法。若你有更好的理由要改，先用白話跟 Hugo 說明。

- **純 HTML＋CSS＋JavaScript（ES modules），不用框架、不需要建置步驟。** 理由：GitHub Pages 直接放就能跑；團隊成員之後可以直接改 JSON；活動前只剩幾天，零件越少越穩。
- 建議結構：

```
site/
├─ index.html             入口頁 /
├─ youth/index.html       青年場（單頁應用）
├─ family/index.html      親子場（單頁應用）
├─ 404.html               導回入口頁
├─ config.js              活動設定：通關碼、回饋表單網址（§7.5）
├─ assets/css/miao.css    由 design/miao.css 改成可伸縮版面
├─ assets/js/             共用模組：router、store（存檔）、answers（判定）、ui（彈窗、鍵盤、圖片放大）
├─ assets/img/            壓縮後的圖片
├─ assets/fonts/          子集化後的字型
└─ content/*.json         題目資料（已提供）
```

- **路由用 hash**（`#/menu`、`#/level/3`）。GitHub Pages 沒有伺服器端轉址；hash 路由讓重新整理、上一頁、深層連結都正常。站牌 QR code 若要直接連到某一關，可以用 `/youth/#/level/3`。
- **所有連結都用相對路徑**（`./`、`../`）。網站會先放在 `https://<帳號>.github.io/<repo 名稱>/` 這種子路徑下。
- `<html lang="zh-Hant-TW">`；viewport 用 `width=device-width, initial-scale=1, viewport-fit=cover`，**不要**加 `maximum-scale=1` 或 `user-scalable=no`，地圖頁寫著「可以用兩指放大地圖」。
- **把固定畫框改成可伸縮**：
  - `.screen`：`width: 100%; max-width: 480px; min-height: 100dvh; margin: 0 auto;`，拿掉所有固定高度（`frameH`）
  - `.topbar` 固定在上方（sticky）；`.actions` 固定在下方，`padding-bottom: max(16px, env(safe-area-inset-bottom))`
  - `.scrim`、`.zoom-scrim` 改 `position: fixed; inset: 0;`
  - 在 320、360、390、430 px 寬度測試，不能出現橫向捲動
- **字型（P0）**：源流明體各約 6 MB。用 fonttools 的 `pyftsubset` 只保留網站實際用到的字（掃 `site/` 裡所有 HTML、JS、JSON 的文字，再加上英數與常用標點），輸出 WOFF2，目標每個檔案 300 KB 以內。寫成 `tools/subset-fonts.py`，內容改過就重跑。保留 `font-display: swap` 和 miao.css 裡的備用字體。
- **圖片（P0）**：
  - logo：1203×1226、769 KB → 縮到寬 480 px 左右（顯示寬度 184 px 的 2.5 倍），PNG 或 WebP
  - 地圖和附圖：要能放大看清楚小字，長邊保留約 1600 px，再壓縮；壓完要親眼確認生肖沖煞表的小字還看得清楚
  - macOS 內建 `sips` 可以縮圖
- 不用外部 CDN、不放追蹤碼（廟街訊號不穩，也避免個資問題）。
- **本機預覽**：`npx serve site` 或 `python3 -m http.server 8080 --directory site`。用同一個 Wi-Fi 的手機連電腦的區網 IP 實測。
- **部署**：GitHub Actions workflow，用 `actions/upload-pages-artifact` 上傳 `site/`、`actions/deploy-pages` 發佈。帶 Hugo 一步一步在 GitHub 網頁上操作（建帳號、建 repo、Settings → Pages → Source 選 GitHub Actions）。

---

## 6. 畫面與流程 / Screens & flows

### 6.1 入口頁 `/`（T00Entry）

- 內容照 `T00Entry.dc.html`：logo、「新莊廟街・實境解謎」、「妙妙貓的廟街委託」、「請選擇你們今天參加的場次。」、兩個場次按鈕、「請依工作人員告知的場次選擇」。
- 兩個按鈕是整塊可點的 `<a class="ver-btn">`：青年場 → `./youth/`，親子場 → `./family/`。
- 某一場有進度時，該按鈕多一行「進行中：關卡 x/6、NPC y/3」（親子場是 x/7）。進度從 localStorage 讀（§8）。
- 這頁沒有頂部列，也沒有場次標籤。

### 6.2 青年場 `/youth/`

流程：開始頁 → 隊伍名稱 → 序章 → 關卡選單 ⇄ 關卡頁 → 本關完成 → 歷史補充 → 關卡選單 → ……六關＋三個 NPC 都完成 → 全破彈窗 → 結局 → 完成摘要

| 畫面 | 設計檔 | 內容與按鈕 |
| --- | --- | --- |
| 開始頁 `#/` | `Main`（youth）、`T02Continue` | **無進度**：「開始探索」→ `#/name`。**有進度**：資訊列「{隊名}　關卡 x/6、NPC y/3」；「繼續遊戲」→ 還沒取名去 `#/name`，序章沒看完去 `#/story`，否則 `#/menu`；「開始探索」（次要按鈕）→ 重新開始確認彈窗（§6.6）。兩種狀態都有「遊戲說明」（§6.5）和「不是這個場次？回到場次選擇」→ `../`。 |
| 隊伍名稱 `#/name` | `T03Name`、`T03NameError` | 「返回」→ `#/`。「確認名稱」→ 驗證（§7.6）→ 存隊名 → `#/story`。 |
| 序章 `#/story` | `T05Story`、`T05StoryLast` | 台詞在 `content/youth-story.json` 的 `prologue`，`{team}` 換成隊名並套 `.mark`。頂部列「序章　n / N」。點對話框到下一段；最後一段改顯示「開始探索」。「跳過劇情」和「開始探索」都記為已看完並前往 `#/menu`。角色插畫目前是設計稿的佔位框，沒有插畫前先放 logo（§12）。 |
| 關卡選單 `#/menu` | `T06Menu`、`T06Menu1`、`T06MenuNpcLeft`、`T06Menu3` | 「首頁」→ `#/`。隊名、進度（關卡 x/6 圓點、NPC y/3 的 A／B／C 圓點）。「查看地圖」→ `#/map`。6 張關卡卡片 → `#/level/N`；六關一開始就全部開放（2026-10-21 Hugo 取消「先破第一關」）。NPC 卡片 → `#/npc/A`～`C`。六關完成但 NPC 未完成：顯示「六關都完成了！再完成 n 個 NPC 任務就全破。」全部完成：第一次回到選單時跳出 `T06Menu3` 彈窗「全部解開了！」（「前往結局」→ `#/ending`；「稍後查看」關閉彈窗），之後選單顯示「恭喜全破！」橫幅，底部固定「前往結局」。還沒全破時，底部顯示安全提醒。 |
| 地圖 `#/map` | `T06Map` | 「關卡選單」返回。地圖圖片＋「點開放大」→ 全螢幕看圖（可兩指放大）＋「關閉」。下方圖例照設計稿。2026-10-21 起地圖圖片改由 `assets-src/img/youth-map.svg` 產生（`node tools/render-youth-map.mjs` → `tools/compress-images.py`），加上米市巷底的潮江寺與 NPC 出沒地點（紅色星號 A／B／C，圖例在最後）。 |
| 關卡頁 `#/level/N` | `T08Level` 與各狀態板 | 規則見 §7.1。已完成的任務列顯示答案；目前任務展開作答；後面的任務是鎖住的列。附圖點一下 → 全螢幕看圖（`T08L1Zoom`）。「查看提示」→ 確認彈窗 → 提示內容彈窗 →「我知道了」；看過的提示留在頁面上。兩次提示用完後，按鈕變成「跳過此題」→ 確認彈窗。全部任務完成：橫幅「本關任務全部完成！」（有跳過時加一行「有 n 個任務跳過，一樣算過關。」）＋「查看本關結果」→ `#/level/N/result`。「關卡選單」返回時保留還沒送出的輸入。直接打開還沒開放的關卡網址 → 導回 `#/menu`。 |
| 本關完成 `#/level/N/result` | `T10Correct`、`T10Revealed` | 本關沒有跳過：印章「解謎成功」、「本關解開了！」、「你們自己解開了「{關卡名}」，觀察得真仔細！」。有跳過：印章「本關完成」、「這一關有跳過的任務，一樣算過關。一起來認識它背後的故事吧！」。「本關答案」用 `content/youth-level-keys.json`，有跳過時不顯示。「查看歷史補充」→ `#/level/N/history`。 |
| 歷史補充 `#/level/N/history` | `T11History`、`T11HistoryOpen` | 本關答案列表（跳過的任務顯示「已跳過，不顯示答案」；親子場還沒答的加分題顯示「未作答，不顯示答案」，2026-10-13 Hugo 決定）、結果標籤「自行解出／跳過 n 題」、一句話重點、「看更多」展開段落與資料來源。「返回關卡選單」→ `#/menu`。 |
| NPC 任務 `#/npc/X` | `T07Npc`（= `FNpc` youth） | 見 §6.4。 |
| 結局 `#/ending` | **未設計** | 預設：沿用序章的對話版面，台詞放 `youth-story.json` 的 `ending`，最後一段按鈕「查看完成摘要」→ `#/summary`。`ending` 是空的就直接到完成摘要。（§12 問題 4） |
| 完成摘要 `#/summary` | **未設計** | 預設：沿用親子場 `F12Summary` 版面，改成「六關成果」、沒有星星區塊、通關碼用 `config.passcode.youth`。（§12 問題 4） |

### 6.3 親子場 `/family/`

流程：開始頁 → 隊伍名稱（§12 問題 1）→ 關卡選單 ⇄ 關卡頁 → 歷史介紹 → 關卡選單 → ……七關＋三個 NPC 都完成 → 完成摘要。親子場**沒有序章和結局**。

| 畫面 | 設計檔 | 內容與按鈕 |
| --- | --- | --- |
| 開始頁 `#/` | `F02Start`、`F02StartContinue`（= `Main` family） | 同青年場開始頁，文案是「七個關卡、三個 NPC 任務，用眼睛在老街裡找出答案。」，進度是「關卡 x/7、NPC y/3」。「開始探索」→ `#/name`；「繼續遊戲」→ 還沒取名去 `#/name`，否則 `#/menu`。 |
| 隊伍名稱 `#/name` | 沿用 `T03Name` | 標籤改「親子場」，placeholder 改「例如：妙妙一家人」。確認後 → `#/menu`。 |
| 關卡選單 `#/menu` | `F06Menu`、`F06MenuMid`、`F06MenuNpcLeft`、`F06MenuClear` | 「首頁」→ `#/`、「遊戲說明」、親子場標籤。隊名＋右上角加分星星數。關卡 x/7（7 個圓點）、NPC y/3。「查看地圖」→ `#/map`。說明「共七關，每關有 2～7 個小任務，完成必答任務就能過關。」**7 張關卡卡片全部開放，順序不限**；有加分題的關卡顯示星星（拿到時填滿）。NPC 區塊與說明。七關完成但 NPC 未完：「七關都完成了！再完成 n 個 NPC 任務就全破。」全破：「恭喜全破！」＋底部「查看完成摘要」→ `#/summary`。還沒全破時顯示安全提醒「過馬路請牽好小朋友。在店家前拍照不用進店，也請不要打擾營業。」 |
| 地圖 `#/map` | `F06Map` | 內嵌 SVG 地圖（東在上、北在左）＋圖例，直接照設計稿的 SVG。2026-10-21 加上 NPC 出沒地點（紅色星號 A／B／C，`ui.js` 的 `npcStar()`；圖例 `npcLegend()`）。 |
| 關卡頁 `#/level/N` | `F07Level` 與各狀態板 | 規則見 §7.2。上方是關卡資訊與任務進度格；「清單順序是建議路線，可自由選擇任務。」；任務預設收合，一次只展開一個。必答完成：橫幅「必答任務都完成了，本關過關！」＋「查看歷史故事」（次要按鈕）。全部完成：橫幅「本關任務全部完成！」（拿到星星時加一行）＋「查看歷史故事」→ `#/level/N/history`。 |
| 歷史介紹 `#/level/N/history` | `F11History`、`F11HistoryOpen` | 同青年場歷史補充的結構。「返回關卡選單」→ `#/menu`。 |
| NPC 任務 `#/npc/X` | `FNpc`（family） | 見 §6.4。 |
| 完成摘要 `#/summary` | `F12Summary` | 全破印章、隊名、「新莊廟街任務完成！」、**通關碼**（`config.passcode.family`）與「請把這個畫面拿給工作人員看」、加分星星 n／最多 m 顆（m 從資料算，不要寫死）、七關成果（自行解出／跳過 n 題＋星星）、NPC 任務（已完成）。按鈕：「填寫遊戲回饋」→ `config.feedbackUrl` 開新分頁（網址空白就不顯示）；「完成遊戲」→ 回入口頁 `../`，進度保留；「重新開始」→ 重新開始確認彈窗（§6.6）。 |

### 6.4 NPC 任務頁（兩場共用）

- 元件：`FNpc.dc.html`，資料：`content/npc.json`。`edition` 只影響頂部列的場次標籤和返回的關卡選單。
- 頂部列：「關卡選單」返回、「NPC 任務」標籤、場次標籤。頁首只有字母徽章、名字和角色說明。
- 任務全部開放、順序不限。題型：
  - `text`：一個只標「答案」的輸入框
  - `multi`：兩個有標籤的輸入框（例如「樁頭」「樁尾」）
  - `photo`：「我拍好了」（不上傳照片）
  - `arrive`：「我們到了」，完成後顯示 `doneText`
- 答錯訊息：「和 NPC 說的不太一樣，注意同音字，再確認一次吧。」
- **沒有提示、沒有跳過、沒有歷史介紹。**
- 全部完成：橫幅「{名字}的任務全部完成！」＋「回到關卡選單」。
- 兩場的 NPC 進度分開存。

### 6.5 遊戲說明（設計稿沒有畫）

- 開始頁和關卡選單都有「遊戲說明」文字按鈕。預設做成彈窗，用 Components 裡一般彈窗的樣式：標題「遊戲說明」、4～6 條短句、按鈕「我知道了」。不是必經步驟。
- 以下文案是**草稿，請 Hugo 確認**後再用：

青年場：
- 每隊 2～4 人，共用一支手機。
- 六個關卡的順序由你們決定，從哪一關開始都可以。
- 有提示的任務最多兩則提示，看完還想不出來就可以跳過；沒有提示的任務可以直接跳過。跳過一樣算過關，但不會顯示答案。
- NPC 任務由現場的 NPC 口頭出題，沒有提示。
- 六關和三個 NPC 任務都完成，就能看到結局。
- 過馬路請注意安全；只需要用眼睛觀察，不必攀爬或觸摸廟裡的文物。

親子場：
- 一家人共用一支手機，請大人陪著小朋友。
- 七個關卡順序自由；每關完成必答任務就過關，答對加分題可以得到星星。
- 每關可以看兩次提示；提示用完後，想不出來的任務可以跳過，但不會顯示答案。
- 拍照任務在店家外面拍就好，不用進店，也不要打擾營業。
- NPC 任務由現場的 NPC 口頭出題，沒有提示。
- 七關和三個 NPC 任務都完成後，把完成畫面拿給工作人員看。

### 6.6 共用行為

- **NPC 出沒提示**（2026-10-21 Hugo 要求）：每天到 `config.js` 的 `npcAlert.time`（預設 14:00，玩家手機時間）跳出彈窗「NPC 出沒提示」，到 `npcAlert.until`（預設 17:00，2026-10-22 Hugo 要求）還開著就自動關掉，之後也不再跳，按「查看地圖」到地圖頁（地圖上有 NPC 出沒地點的星號）。一天只跳一次；要取好隊名、NPC 任務還沒全部完成才跳；時間過後才打開也會補跳；有別的彈窗時等它關掉。程式在 `npc-alert.js`。
- **重新開始**：用 `Components.dc.html` 的危險操作彈窗：「確定要重新開始？」／「重新開始會清除目前所有關卡進度，無法復原。」／「取消」「清除進度並重新開始」。確認後只清除**這一場**的進度，回到該場的 `#/name`。
- **彈窗**：`role="dialog"`、`aria-modal="true"`，打開時焦點移進去、關閉後回到原按鈕；按瀏覽器「上一頁」先關彈窗。
- **輸入保留**：在關卡頁或 NPC 頁輸入到一半離開，回來時輸入框內容還在（不需要「確定離開嗎」的確認）。
- **頂部列標籤**：有頂部列的頁面右側都有場次標籤（青年場：深棕底白字；親子場：白底深棕框），CSS 是 `.ver-tag.is-youth`／`.is-family`。

---

## 7. 遊戲規則 / Game rules

兩場的規則**刻意不同**，請分開實作。原型的 `renderVals()` 裡有完整邏輯和所有提示、彈窗、錯誤訊息文案，**文案照原型逐字使用**。

### 7.1 青年場

- **關卡開放**：六關一開始就全部開放、順序不限（2026-10-21 Hugo 取消「先破第一關」，序章台詞與關卡選單說明一起改）。
- **關內任務依序開啟**：任務 n 答對或跳過後，任務 n+1 才開放。
- **提示**（2026-10-21 Hugo 決定改成跟著任務走）：每個任務自己的提示寫在 `tasks[i].hints`（0～2 則），只給目前這個任務。第一次和最後一次的確認彈窗文案不同；只有一則時直接是最後一則。目前任務看過的提示列在關卡頁上方（「任務 n・提示一」），進度列顯示「本題提示 已用 x/n」，沒有提示的任務不顯示。
- **跳過此題**（2026-10-13 Hugo 決定，取代設計稿的「揭曉答案」：玩家會先揭曉看答案、再重新開始，把答案當成自己解出）：這個任務的提示都看完後，提示按鈕變成「跳過此題　提示已用完」；沒有提示的任務直接顯示「跳過此題　這題沒有提示」。跳過的是**目前這個任務**：**不顯示答案**、標記為 `skipped`、開放下一個任務；任務列顯示「放棄作答」＋「已跳過」。之後每個還沒解的任務都可以跳過。確認彈窗：「要跳過這個任務嗎？」／「跳過此題」「再想一下」。跳過的任務在本關完成頁（不顯示「本關答案」）和歷史頁「本關答案」列表（顯示「已跳過，不顯示答案」）都不會出現答案；歷史頁答案第 j 列對應第 j 個非拍照任務。
- **本關完成**：所有任務都答對或跳過。結果分「自行解出」（沒有跳過）和「跳過 n 題」（至少跳過一題）。
- **全破**：六關＋NPC A、B、C 都完成。
- **錯誤訊息**：
  - 沒填完：「請先填完，再按「送出答案」。」（排序題：「請先排好全部角色，再按「送出順序」。」）
  - 答錯：「答案似乎不正確，再觀察一次現場吧。」（排序題：「順序似乎不正確，再對照一次線索吧。」）
  - 多欄位題（`fields`）要標出**哪幾格**錯了（原型的 `bad[]`）。
- **題型**（`youth-levels.json` 的 `type`）：
  - `text`、`number`：一個輸入框，`number` 用數字鍵盤（`inputmode="numeric"`）
  - `fields`：多個輸入框，版面由 `layout` 決定（`grid3`、`grid2`、`stack`、`row`、`inline`）；`numeric: true` 的欄位用數字鍵盤；有 `clue` 的欄位在標籤下顯示線索
  - `select`：A～E 各一個下拉選單，選項是五間老店全名（原型因畫布限制把選項寫死在 HTML 裡，正式版請從資料產生）
  - `order`：點選角色依序排列（`items` 是角色與說明），可「清除重來」，排滿 5 個才能送出
  - `choice`：五選一（`options`）
- `cluesFirst`、`cluesTitle`、`clues`：線索框，照原型位置顯示。
- **附圖**：`figure` 的值對應圖片和說明文字（§10）：`zodiac` →「現場參考圖｜慈祐宮生肖沖煞表」、`shops` →「附圖｜A～E 在廟街上的位置」、`arrows` →「附圖｜A～E 的數字藏在哪裡？」。點圖 → 全螢幕看圖，可兩指放大，有「關閉」。

### 7.2 親子場

- **關卡開放**：7 關全部開放、順序不限。
- **關內任務**：全部開放、順序不限；預設收合，點開一個會收起其他。
- **題型**（`family-levels.json`）：
  - `photo`：只有「我拍好了」，按了就完成（信任制，不上傳照片）
  - `text` 且有 `photo` 欄位：先顯示拍照步驟（`photo` 文字、`photoNote` 提醒），按「我拍好了」後才出現輸入框（`after` 是接下來要做的事）
  - `text`：一個輸入框，可接受 `answer`（完全相同）或 `contains`（包含即可）
  - `number`：畫面上的數字鍵盤（1～9、清除、0、刪除），**最多 4 位數**，顯示單位 `unit`
  - `choice`：選項 A／B／C……，選項文字都很短又剛好 4 個時排成 2×2
  - `multi`：兩個輸入框；`anyOrder: true` 時兩格可以對調；`numeric: true` 用數字鍵盤
- **加分題**（`bonus: true`）：不是必答、不能看提示也不能跳過；答對得一顆星。目前只有第四關「斗笠與辮子」是加分題，但星星上限要從資料計算，不要寫死。
- **提示**：每關 2 次，整關共用。兩次用完後，還沒完成的**非加分、非拍照**任務展開時出現「跳過此題」（規則同 §7.1，不顯示答案，任務列「放棄作答」＋「已跳過」）。確認彈窗：「要跳過這題嗎？」／「跳過此題」「再觀察一下」。
- **過關**：所有必答任務完成（答對或跳過）就算本關完成；加分題可以之後再挑戰。
- **全破**：七關＋NPC A、B、C 都完成。
- **錯誤訊息**：沒作答「請先作答，再按「送出答案」。」；答錯「答案似乎不正確，再觀察一次現場吧。」

### 7.3 答案判定（照抄，三套規則不同）/ Answer checking

這三個函式從原型逐字移植，**不要合併成一套**。全部放在 `assets/js/answers.js`，並寫單元測試（`node --test`）。

```js
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
```

比對方式：

| 場次／題型 | 正確條件 |
| --- | --- |
| 青年場 `text`、`number` | `stripYouth(輸入)` 等於 `answer` 任一項的 `stripYouth` |
| 青年場 `fields` | 每一格各自比對自己的 `answer` 陣列；錯的格子個別標紅 |
| 青年場 `select` | 每個下拉選單的值等於 `answer[k]`（完全相同） |
| 青年場 `order` | 排出的順序等於 `answer` 陣列 |
| 青年場 `choice` | 選到的代號等於 `answer` |
| NPC `text` | `stripNpc(輸入)` 等於 `answer` 任一項的 `stripNpc` |
| NPC `multi` | 每格各自比對 `answer[k]` |
| 親子場 `text` | `normFamily(輸入)` 等於任一 `answer`，或包含任一 `contains`（都先 `normFamily`） |
| 親子場 `number` | 鍵盤輸入的數字字串等於 `String(answer)` |
| 親子場 `choice` | 選到的代號等於 `answer` |
| 親子場 `multi` | 兩格各自比對；`anyOrder` 時對調也算對 |

單元測試至少要涵蓋：每一題的每一種可接受寫法；加空白、全形標點、全形數字（青年場）的寫法；以及設計稿刻意展示的錯誤例子：
- `FNpcAField`：NPC A 問答四輸入「福德寺」「朝江寺」→ 樁尾錯（正解「潮江寺」，同音字）
- `T08L4Error`：青年場第四關輸入「米市興旺」→ 錯
- `F07MishiNumber`：親子場第四關「數一數船」輸入 6 → 錯

### 7.4 關卡卡片狀態

- 未完成：還沒開始
- 進行中：有任何任務完成、或用過提示，但還沒過關
- 已完成：過關（青年場：全部任務完成；親子場：必答任務完成）
- 未開放：目前不會出現（2026-10-21 取消先破第一關）

### 7.5 活動設定 `site/config.js`

```js
export const CONFIG = {
  passcode: { youth: '', family: '4827' }, // 4827 是設計稿的範例，Hugo 確認後再定
  feedbackUrl: '',                          // 回饋表單網址；空白就不顯示「填寫遊戲回饋」
};
```

### 7.6 隊伍名稱驗證

- 先去掉前後空白，再用 `Array.from()` 計算字數（中文一個字算 1）。
- 2～12 個字，可用中英文與數字。下方說明「2～12 個字，可用中英文與數字」＋字數「n/12」。
- 錯誤訊息（顯示在輸入框下方，不另開頁面）：
  - 超過 12 個字：「名稱請勿超過 12 個字」（設計稿已有，見 `T03NameError`）
  - 以下三句是**建議文案**，設計稿沒有，請 Hugo 確認：空白「請輸入隊伍名稱」、只有 1 個字「名稱至少要 2 個字」、有其他符號「名稱只能使用中英文與數字」
- 隊名會出現在序章、關卡選單、完成摘要，以及開始頁的進度列。

---

## 8. 進度儲存 / Persistence

- 用 localStorage，**兩場各一個 key**：`miaomiao:youth:v1`、`miaomiao:family:v1`。入口頁兩個都讀。
- 每次狀態改變就寫入。讀寫都包在 `try/catch` 裡；如果瀏覽器不能存（例如某些 App 內建瀏覽器），改用記憶體繼續玩，並在開始頁顯示一行提醒（建議文案：「這個瀏覽器無法儲存進度，請不要關閉這個分頁。」）。
- 建議資料格式：

```json
{
  "v": 1,
  "team": "廟口探險隊",
  "startedAt": "2026-10-18T05:20:00.000Z",
  "storySeen": true,
  "allClearSeen": false,
  "levels": {
    "1": {
      "results": ["self", "self", "revealed", null],
      "hints": 2,
      "drafts": { "3": { "text": "門" } },
      "startedAt": "2026-10-18T05:25:00.000Z",
      "completedAt": null,
      "attempts": 4
    }
  },
  "npc": {
    "A": { "results": ["self", null, null, null, null], "drafts": {} }
  }
}
```

- `results` 每一格是 `null`（未完成）、`"self"`（自己答對）、`"skipped"`（跳過，不顯示答案）。舊存檔的 `"revealed"` 讀進來一律改成 `"skipped"`。親子場「拍照＋文字題」的拍照步驟記在 `drafts[i].photoOk`。青年場各任務看過的提示數記在 `taskHints`（`{ 任務 i: 次數 }`），親子場仍是整關的 `hints`。
- 「有進度」的定義：存了隊名，或任何關卡／NPC 有結果。
- 進度文字：關卡 x/6（或 x/7）= 已完成的關卡數；NPC y/3 = 三個任務都完成的 NPC 數。
- 「重新開始」只刪除該場的 key。
- 如果之後內容改版造成舊進度對不上，把 key 改成 `v2`，舊進度直接忽略。
- 時間戳記和作答次數只存在手機裡（「遊戲結構」文件建議記錄，方便日後測試），不上傳。
- 除了隊名，不存任何個人資料；不用 cookie。

---

## 9. 內容檔案 / Content files（`site/content/`）

每個檔案最外層都是 `{ "_source": "從哪個設計檔抽出", "data": … }`。

| 檔案 | 內容 |
| --- | --- |
| `youth-levels.json` | 青年場 6 關：`no`、`place`、`title`、`intro`（部分關卡）、`tasks`（題型、題目、每個任務的 `hints`（0～2 則）、線索、附圖、`answer` 可接受寫法、`show` 答對後任務列顯示的答案） |
| `youth-level-keys.json` | 青年場「本關完成」畫面的「本關答案」 |
| `youth-menu.json` | 青年場關卡選單卡片（`n`、`no`、`place`、`task`、`icon`）與 NPC 卡片 |
| `youth-history.json` | 青年場歷史補充：`keyline` 一句話重點、`answers` 本關答案列表、`paras` 看更多段落、`source` 資料來源 |
| `youth-story.json` | 序章（目前 2 句）與結局（目前空的）台詞，`{team}` 會換成隊名 |
| `family-levels.json` | 親子場 7 關：`hints`、`tasks`（含 `contains`、`photo`、`bonus`、`unit`、`anyOrder` 等） |
| `family-menu.json` | 親子場關卡選單卡片與 NPC 卡片 |
| `family-history.json` | 親子場歷史介紹，結構同青年場 |
| `npc.json` | 三個 NPC：`key`、`name`、`role`、`tasks` |

- 卡片圖示（`icon`：`staff`、`gate`、`drum`、`mask`、`boat`、`door`、`board`、`window`）的 SVG 都在 `T06Menu.dc.html`、`F06Menu.dc.html` 裡，直接複製。
- **交接後以 `site/content/` 為內容主檔。** 如果 Hugo 之後又在設計畫布改了內容，請他把新的 `.dc.html` 放進 `design/`，執行 `node tools/extract-content.js` 重新抽出，再用 `git diff` 看改了什麼。這個腳本不會動到 `youth-story.json`。

---

## 10. 素材 / Assets

| 設計稿裡的網址 | 檔案（`assets-src/img/`） | 原始尺寸 | 用在哪裡 |
| --- | --- | --- | --- |
| `/_blob/a9caf96e60f7e7300f4a7fd20a0e970f` | `logo.png` | 1203×1226 | 入口頁、兩場開始頁（顯示寬 184 px；品牌規範最小 160 px，不可裁切、不可改色） |
| `/_blob/bef2c340dcc90c382e7f9044f05449f3` | `youth-map.png` | 1050×1920 | 青年場地圖 |
| `/_blob/cdc8c0c453baa0e1b255bab377a687d2` | `youth-L1-zodiac-chart.jpg` | 1536×2048 | 青年場第一關附圖 `zodiac` |
| `/_blob/27a918ed340c51214e07a9f19d09326c` | `youth-L2-fig1-shop-positions.jpg` | 1706×960 | 青年場第二關附圖 `shops` |
| `/_blob/454c6f9e79e5e215c5428212137129c7` | `youth-L2-fig2-4x4-arrows.png` | 1483×1794 | 青年場第二關附圖 `arrows` |

- 字型：`assets-src/fonts/GenRyuMinTW-Regular.woff2`、`GenRyuMinTW-Bold.woff2`（源流明體，SIL OFL）。子集化後放 `site/assets/fonts/`，CSS 的 `@font-face` 路徑跟著改。
- 圖示：都是設計檔裡的內嵌 SVG（線條、`stroke` 跟著文字色），直接複製。不要用 emoji。
- 親子場地圖是 `F06Map.dc.html` 裡的內嵌 SVG，相關樣式在 miao.css 的 `.fmap`。
- 缺的美術：
  - 序章的妙妙貓角色插畫（設計稿是虛線佔位框）→ 還沒有插畫前先放 logo
  - 親子場拍照任務的「拍照範例圖（選填）」→ 沒有圖就整塊不顯示

---

## 11. 現場可用性與無障礙 / Field usability & accessibility

- 戶外陽光下要看得清楚：沿用 miao.css 的顏色，不要調淡；內文至少 16 px（設計稿 18～20 px）。
- 單手操作：主要按鈕在畫面下方（`.actions` 固定在底部）。點擊區至少 48 px（設計稿按鈕 56 px、選項 64 px）。
- 答案輸入框：`autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"`，按鍵盤的 Enter 等於「送出答案」；數字題用 `inputmode="numeric"`。輸入框字級維持 20 px，避免 iPhone 自動放大。
- 換頁時把焦點移到新頁面的 `h1`；錯誤訊息用 `role="alert"` 讓讀屏軟體念出來；設計稿裡的 `aria-label` 都保留。
- 效能：第一次載入總量目標 1 MB 以內，4G 下 3 秒內可操作。
- 要測的瀏覽器：iOS Safari、Android Chrome、**LINE 內建瀏覽器**（台灣很多人用 LINE 掃 QR code）、Facebook／Instagram 內建瀏覽器。

---

## 12. 待確認事項（開工前一次問 Hugo）/ Open questions

每題都附預設做法：Hugo 沒空回覆時，先照預設做，並在畫面或程式裡標清楚哪裡是暫定的。

| # | 問題 | 預設做法 |
| --- | --- | --- |
| 1 | 親子場要不要讓玩家取隊名？（設計稿的親子場沒有取名頁，但選單和摘要都顯示「妙妙一家人」） | 要。沿用 T03 隊伍名稱頁，標籤改親子場，placeholder 改「例如：妙妙一家人」 |
| 2 | 「遊戲說明」的內容 | 用 §6.5 的草稿，做成彈窗，不是必經步驟 |
| 3 | 青年場序章只有 2 句台詞（設計稿標示共 4 段），其他台詞呢？ | 先上這 2 句（顯示 1/2、2/2）；台詞之後補進 `youth-story.json` |
| 4 | 青年場的結局劇情和完成摘要沒有設計 | 結局沿用序章對話版面，台詞待提供；沒有台詞就直接到完成摘要。摘要沿用親子場 F12 版面（六關成果、NPC、通關碼、沒有星星） |
| 5 | 通關碼：每場固定一組？兩場一樣嗎？ | 兩場各一組固定 4 位數，寫在 `config.js`；親子場先用設計稿的 4827，青年場待定 |
| 6 | 「填寫遊戲回饋」的表單網址 | 先空白，空白時不顯示按鈕 |
| 7 | 「完成遊戲」按下去要做什麼 | 回到入口頁，進度保留（還可以再打開摘要給工作人員看） |
| 8 | 序章的妙妙貓插畫什麼時候會有？ | 先放 logo |
| 9 | GitHub 帳號、repo 名稱、要不要自訂網域 | repo 名稱 `miaomiao-temple-street`，網址 `https://<帳號>.github.io/miaomiao-temple-street/` |
| 10 | 壓克力立牌上的 QR code 連到哪裡？ | 只連主網址（入口頁）；關卡深層連結也支援，但不印在立牌上 |
| 11 | 第一次進關卡選單時，要不要自動跳出遊戲說明？ | 不要，按「遊戲說明」才顯示 |

---

## 13. 上線前要在現場核對的內容 / On-site content checks

這些是之前設計時發現、需要團隊到現場確認的點。**不要自己改內容**，確認後由 Hugo 決定。

1. 青年場第一關任務三（查生肖沖煞表）：表上「羊」那一欄看到的是「辰時」，答案「未時」要先查出地支「未」才推得出。現場確認表格和題意一致。
2. 青年場第四關的提示二直接寫出任務一的四個數字（3／7／4／10）。確認是刻意給的。
3. 青年場第三關的排序選項，顯示順序改成「生、旦、淨、末、丑」，因為原本給的順序剛好就是答案。
4. 青年場第二關任務三的五個欄位，標籤是「甜、鹹、藥香、鐵聲、鼓聲」。
5. 青年場的全破條件比照親子場（六關＋三個 NPC 都完成），請確認。
6. NPC A 問答三的答案是「因為面對米市街，他是商業神」，用的是「他」。完全比對下，玩家打「祂」會被判錯。要不要把「祂」的寫法也加進答案？
7. NPC B 要帶路去的「老順香」，不在兩張地圖上。
8. **每一題都要有團隊成員在現場用手機實際輸入一次正確答案**，也試幾個常見變體（多打空白、全形標點、同音字）。

---

## 14. 驗收清單 / Acceptance checklist

- [ ] `/`、`/youth/`、`/family/` 在 GitHub Pages 的網址都打得開；在任何頁面重新整理都不會壞
- [ ] 入口頁：兩場的進度分別正確顯示；整個按鈕區塊都可以點
- [ ] 兩場都能從頭玩到尾；每一題用正確答案都能過，每一題至少試過一個錯誤答案
- [ ] 青年場：六關都開放；關內任務依序開啟；每個任務的提示看完（或沒有提示）才出現「跳過此題」；跳過不顯示答案；有跳過的關卡標示「跳過 n 題」
- [ ] 親子場：任務順序不限；拍照＋文字題要先按「我拍好了」；數字鍵盤最多 4 位數；加分題答對得星星；必答完成就過關
- [ ] NPC：三個 NPC 兩場都能做；答錯顯示同音字提醒；兩場的 NPC 進度互不影響
- [ ] 關掉瀏覽器再打開，進度還在；「重新開始」只清除那一場
- [ ] 地圖和附圖都能放大看清楚
- [ ] 320 px 寬不破版、沒有橫向捲動；iPhone 下方的安全區不會擋住按鈕
- [ ] 字型已子集化；第一次載入 1 MB 以內
- [ ] 答案判定的單元測試全部通過
- [ ] iOS Safari、Android Chrome、LINE 內建瀏覽器都實測過
- [ ] 團隊在廟街實地走過一次（§13 第 8 點）

---

## 15. 不在範圍 / Out of scope

- 後端、資料庫、帳號登入、跨手機同步進度
- 上傳照片（拍照任務是信任制）
- 排行榜、計時、追蹤分析
- 英文版、LINE 登入／LIFF、管理後台
- 防作弊：答案就在網站的檔案裡，懂技術的人看得到。這次活動可以接受。如果之後要藏起來，需要私人 repo（GitHub Pages 用私人 repo 要 GitHub Pro；學生可以用 GitHub Student Developer Pack 免費取得）。

---

## 16. 建議的施工順序 / Suggested order of work

1. 讀完這份文件和 `CLAUDE.md`，把 §12 的問題一次問 Hugo。
2. 帶 Hugo 建好 GitHub repo，先部署一個只有入口頁的版本，讓他用手機打開網址。**越早上線越好**，之後每做完一段就更新。
3. 把 miao.css 改成可伸縮版面；做 router、store、answers（＋單元測試）。
4. 青年場整條流程。
5. 親子場整條流程。
6. NPC 頁（兩場共用）。
7. 字型子集化、圖片壓縮、遊戲說明、重新開始、深層連結處理。
8. 照 §14 驗收；請團隊依 §13 到現場走一次。

---

## 17. 跟 Hugo 合作 / Working with Hugo

- Hugo 沒有資訊背景。用繁體中文、白話說明；一次只請他做一件事；需要他在 GitHub 網頁上操作時，寫清楚每一步要點哪裡。
- 需要他決定的事，整理成選項並附上你的建議。
- 每完成一個階段，給他一個手機可以直接打開的網址，並告訴他要測什麼。
- 不要自己改題目、答案或文案；有疑問整理成清單一次問。
