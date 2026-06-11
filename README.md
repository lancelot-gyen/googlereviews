# Google 評論管理系統

橘焱胡同集團 Google 評論統一管理平台，支援多品牌、多層級的評論查看與處理。

---

## 技術架構

| 項目 | 說明 |
|------|------|
| 前端框架 | Vite + Vanilla JavaScript（無框架） |
| 資料庫 | Supabase (PostgreSQL) |
| 認證方式 | Google OAuth（透過 Supabase Auth）／開發模式 Email 輸入 |
| 部署平台 | Vercel |
| 正式網址 | `https://googlereviews-chi.vercel.app` |
| GitHub | `googlereviews` repo，`dev` 分支自動部署 |

---

## 本地開發

```bash
# 安裝相依套件
npm install

# 啟動開發伺服器（http://localhost:5173）
npm run dev

# 建置正式版
npm run build
```

### 環境變數

複製 `.env.example` 為 `.env.local`：

```env
VITE_SUPABASE_URL=https://zunactakynxzgvzoazul.supabase.co
VITE_SUPABASE_ANON_KEY=（見 Supabase 後台）
```

---

## 開發模式登入

目前系統使用**開發模式登入**，不走 Google OAuth，直接輸入帳號 Email 即可進入。

**切換方式**：修改 `src/lib/devAuth.js` 第一行：

```js
export const DEV_MODE = true   // 開發模式：Email 輸入登入
export const DEV_MODE = false  // 正式模式：Google OAuth 登入
```

開發模式會將輸入的 Email 存入 `localStorage`，登出時清除。`resolveRole` 仍照常查詢 Supabase 資料庫，權限邏輯與正式模式相同。

---

## 專案結構

```
├── src/
│   ├── main.js               # 入口：判斷 session → 角色 → 渲染
│   ├── style.css             # 全域樣式（橘焱胡同品牌色系）
│   ├── lib/
│   │   ├── supabase.js       # Supabase 客戶端初始化
│   │   ├── auth.js           # 角色解析、Google OAuth、存取範圍
│   │   ├── devAuth.js        # 開發模式登入（DEV_MODE 開關）
│   │   └── toast.js          # Toast 通知元件
│   └── pages/
│       ├── login.js          # 登入頁（Google OAuth / 開發模式）
│       ├── layout.js         # 側欄 + 頁面路由
│       ├── reviews.js        # 評論列表（篩選、排序、分頁、詳情）
│       ├── dashboard.js      # 數據總覽（統計卡片、門店統計表）
│       └── admin.js          # 資料管理（僅 super_admin）
├── public/
│   └── sw.js                 # Service Worker（PWA）
├── api/
│   └── reply.js              # Vercel Serverless（Google My Business 回覆）
├── supabase_init.sql         # 資料庫初始化 SQL
├── supabase_migration_v6.sql # v6 migration（新增 members 表、reply 欄位）
├── vite.config.js
└── vercel.json
```

---

## 資料庫設計

### 資料表清單

| 資料表 | 說明 | RLS |
|--------|------|-----|
| `google_group` | 品牌群組（開丼、bhc、Pepper Lunch） | 關閉 |
| `business_groups` | 事業群 | 關閉 |
| `areas` | 區域 | 關閉 |
| `stores` | 門店 | 關閉 |
| `store_members` | 門店人員（多對多） | 關閉 |
| `area_members` | 區域主管（多對多） | 關閉 |
| `business_group_members` | 事業群主管（多對多） | 關閉 |
| `google_reviews` | Google 評論 | 關閉 |
| `user_roles` | 總部／最高管理員帳號 | 關閉 |

### 資料表關聯

```
google_group (品牌)
  └── stores.group_id

areas (區域)
  ├── stores.area_id
  └── area_members(area_id, name, email)  ← 區域主管

business_groups (事業群)
  ├── stores.business_group_id
  └── business_group_members(business_group_id, name, email)  ← 事業群主管

stores (門店)
  └── store_members(store_id, name, email)  ← 門店人員

google_reviews
  └── branch_name 對應 stores.store_name（字串比對）

user_roles
  └── email + role  ← 所有可登入帳號的角色定義
```

### google_reviews 欄位

| 欄位 | 說明 |
|------|------|
| `review_id` | Google 評論唯一 ID |
| `reviewer_name` | 評論者名稱 |
| `branch_name` | 門店名稱（對應 stores.store_name） |
| `star_rating` | 星級（ONE/TWO/THREE/FOUR/FIVE） |
| `review_content` | 評論內容 |
| `review_time` | 評論時間 |
| `ai_reply` | AI 建議回覆 |
| `ai_analysis_time` | AI 分析時間 |
| `process_status` | 處理狀態（未處理／處理中／已回覆） |
| `reply_content` | 實際回覆內容 |
| `replied_by` | 回覆者 |
| `reply_time` | 回覆時間 |
| `is_closed` | 是否結案 |
| `closed_by` | 結案者 |
| `closed_at` | 結案時間 |

---

## 角色權限系統

### 五種角色

| 角色值 | 顯示名稱 | 說明 |
|--------|---------|------|
| `store` | 門店人員 | 只能看自己門店的評論 |
| `area_manager` | 區域主管 | 看管轄區域內所有門店的評論 |
| `group_manager` | 事業群主管 | 看事業群內所有門店的評論 |
| `headquarters` | 總部 | 看所有門店評論 |
| `super_admin` | 最高管理員 | 全部資料存取 + 資料管理頁 |

### 角色判斷流程

```
輸入 Email
  │
  ├─ 查 user_roles WHERE email = ?  → 取得 role
  │
  ├─ role = 'store'
  │    └─ 查 store_members WHERE email = ?
  │         → scopeNames（門店名稱清單）
  │
  ├─ role = 'area_manager'
  │    └─ 查 area_members WHERE email = ?
  │         → scopeIds（area_id 清單）
  │         → 再查 stores WHERE area_id IN (...)
  │
  ├─ role = 'group_manager'
  │    └─ 查 business_group_members WHERE email = ?
  │         → scopeIds（business_group_id 清單）
  │         → 再查 stores WHERE business_group_id IN (...)
  │
  ├─ role = 'headquarters' / 'super_admin'
  │    └─ 查所有 stores（全域存取）
  │
  └─ 找不到 → 顯示「無存取權限」
```

### 帳號設定方式

1. **所有可登入帳號**：在「資料管理 → 使用者權限」新增 Email + 角色
2. **門店人員**：再到「資料管理 → 門店管理」編輯門店，新增該帳號的 Email 到門店人員清單
3. **區域主管**：到「資料管理 → 區域管理」編輯區域，新增 Email 到區域主管清單
4. **事業群主管**：到「資料管理 → 事業群」編輯事業群，新增 Email 到主管清單
5. **總部 / 最高管理員**：只需在使用者權限設定角色，不需設定對應的成員表

---

## 功能說明

### 評論列表
- 篩選：門店、星級、狀態、關鍵字搜尋
- 排序：點擊表頭可排序（門店、評論者、星級、評論時間、狀態），再點切換升冪／降冪
- 分頁：每頁 20 筆
- 查看詳情：Modal 顯示完整評論內容、AI 建議回覆、處理狀態更新

### 數據總覽
- 統計卡片：評論總數、未處理數、已回覆數、平均星級
- 各門店統計表：評論數、平均星級、處理狀態
- 點擊門店列：直接跳轉評論列表並篩選該門店（麵包屑導覽）

### 資料管理（僅 super_admin）
| 頁籤 | 功能 |
|------|------|
| 門店管理 | 新增／編輯門店，設定品牌、區域、事業群、門店人員（可多人） |
| 區域管理 | 新增／編輯區域，設定區域主管（可多人） |
| 品牌群組 | 新增／編輯品牌（google_group） |
| 事業群 | 新增／編輯事業群，設定主管（可多人） |
| 使用者權限 | 新增／編輯／刪除所有登入帳號及角色 |

---

## 部署

### Vercel 設定

`vercel.json`：
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### 環境變數（Vercel）
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GOOGLE_CLIENT_ID`（API 回覆用）
- `GOOGLE_CLIENT_SECRET`（API 回覆用）
- `GOOGLE_REFRESH_TOKEN`（API 回覆用）

### 分支策略
- `dev` 分支 → Vercel Preview 自動部署
- `main` 分支 → 正式環境

---

## 資料庫初始化

首次建立資料庫時，依序執行：

1. `supabase_init.sql`：建立所有基本資料表與初始資料
2. `supabase_migration_v6.sql`：新增 `store_members`、`area_members`、`business_group_members` 資料表，以及 `google_reviews` 的回覆與結案欄位

---

## 品牌初始資料

系統預設三個品牌群組：

| ID | 品牌 |
|----|------|
| 1 | 開丼 燒肉vs丼飯 |
| 2 | bhc CHICKEN |
| 3 | Pepper Lunch 胡椒廚房 |

共 21 間門店（見 `supabase_init.sql`）。
