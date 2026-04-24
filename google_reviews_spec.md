# Google 評論管理系統 — 系統規格書 v6

## 1. 專案概覽

| 項目 | 說明 |
|------|------|
| 專案名稱 | Google 評論管理系統 |
| GitHub Repository | `googlereviews` |
| 資料庫 | Supabase (PostgreSQL) |
| 認證方式 | Google OAuth（透過 Supabase Auth） |
| 介面設計 | RWD（支援電腦、平板、手機） |
| PWA 支援 | 是（可加入主畫面，全螢幕執行，無需上架） |
| 部署平台 | Vercel（免費方案） |

---

## 1.1 平台相容性

| 平台 | 方式 | 相容性 |
|------|------|--------|
| Windows 電腦 | 瀏覽器（Chrome / Edge / Firefox） | ✅ |
| Mac 電腦 | 瀏覽器（Chrome / Safari） | ✅ |
| iPhone / iOS | 瀏覽器（Safari / Chrome） | ✅ |
| Android 手機 | 瀏覽器（Chrome） | ✅ |
| iPad / 平板 | 瀏覽器（RWD 自動適配） | ✅ |
| 加到主畫面（PWA） | iOS / Android 皆支援 | ✅ |

---

## 1.2 PWA 規格

| 項目 | 說明 |
|------|------|
| manifest.json | 定義 App 名稱、icon、顯示模式 |
| display 模式 | `standalone`（全螢幕，不顯示瀏覽器網址列） |
| icon 規格 | 192x192 / 512x512 PNG |
| Service Worker | 快取靜態資源，提升載入速度 |
| 離線支援 | 基本頁面框架可離線顯示，資料需連線 |
| iOS 安裝方式 | Safari → 分享 → 加入主畫面 |
| Android 安裝方式 | Chrome → 選單 → 安裝應用程式 |

### manifest.json 範本
```json
{
  "name": "Google 評論管理系統",
  "short_name": "評論管理",
  "description": "集團門店 Google 評論管理平台",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 2. Supabase 連線資訊

> ⚠️ 所有連線資訊一律透過環境變數注入，不可寫死在程式碼中。

| 項目 | 值 |
|------|-----|
| Project URL | `https://zunactakynxzgvzoazul.supabase.co` |
| Anon Public Key | 見 `.env` |
| 環境變數名稱（URL） | `SUPABASE_URL` |
| 環境變數名稱（Key） | `SUPABASE_ANON_KEY` |
| 環境變數名稱（Service Role） | `SUPABASE_SERVICE_ROLE_KEY` |
| Google OAuth Client ID | `GOOGLE_CLIENT_ID` |
| Google OAuth Client Secret | `GOOGLE_CLIENT_SECRET` |
| Google Refresh Token（GBP API） | `GOOGLE_REFRESH_TOKEN` |
| Google API Key | `GOOGLE_API_KEY` |

### .env.example
```env
SUPABASE_URL=https://zunactakynxzgvzoazul.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google API
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_API_KEY=
```

> **說明：**
> - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：Google OAuth 應用程式憑證
> - `GOOGLE_REFRESH_TOKEN`：用來取得 Access Token，呼叫 GBP API 回覆評論時使用
> - `GOOGLE_API_KEY`：GBP API 金鑰（若使用 API Key 方式驗證）
>
> 呼叫 Google My Business API 回覆評論時，後端需先用 `GOOGLE_REFRESH_TOKEN` 換取有效的 Access Token，再帶入 Authorization Header，不可將任何 KEY 暴露在前端程式碼中。

---

## 3. 資料庫設計

### 3.1 google_group（品牌群組）

```sql
CREATE TABLE google_group (
  id          BIGSERIAL PRIMARY KEY,
  group_name  TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE google_group DISABLE ROW LEVEL SECURITY;

-- 初始資料
INSERT INTO google_group (group_name) VALUES
  ('開丼 燒肉vs丼飯'),
  ('bhc CHICKEN'),
  ('Pepper Lunch 胡椒廚房');
```

---

### 3.2 business_groups（事業群）

```sql
CREATE TABLE business_groups (
  id                  BIGSERIAL PRIMARY KEY,
  business_group_name TEXT UNIQUE NOT NULL,
  created_at          TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE business_groups DISABLE ROW LEVEL SECURITY;
```

---

### 3.3 areas（區域）

```sql
CREATE TABLE areas (
  id          BIGSERIAL PRIMARY KEY,
  area_name   TEXT UNIQUE NOT NULL,
  group_id    INTEGER REFERENCES google_group(id),
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE areas DISABLE ROW LEVEL SECURITY;
```

---

### 3.4 stores（門店）

```sql
CREATE TABLE stores (
  id                  BIGSERIAL PRIMARY KEY,
  store_name          TEXT NOT NULL,
  group_id            INTEGER REFERENCES google_group(id),
  area_id             INTEGER REFERENCES areas(id),
  business_group_id   INTEGER REFERENCES business_groups(id),
  created_at          TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE stores DISABLE ROW LEVEL SECURITY;

-- 初始資料
INSERT INTO stores (store_name, group_id) VALUES
  ('開丼 燒肉vs丼飯 Dream Plaza店', 1),
  ('開丼 燒肉vs丼飯 桃園華泰店', 1),
  ('開丼 燒肉vs丼飯 美麗華店', 1),
  ('開丼 燒肉vs丼飯 台中LALAport店', 1),
  ('開丼 燒肉vs丼飯 新店誠品生活店', 1),
  ('開丼 燒肉vs丼飯 台中三井店', 1),
  ('開丼 燒肉vs丼飯 台北101店', 1),
  ('開丼 燒肉vs丼飯 中和環球店', 1),
  ('開丼 燒肉vs丼飯 南港環球店', 1),
  ('開丼 燒肉vs丼飯 台南南紡店', 1),
  ('開丼 燒肉vs丼飯 高雄左營新光三越店', 1),
  ('bhc CHICKEN 遠東GARDEN CITY大巨蛋店', 2),
  ('bhc CHICKEN 信義ATT店', 2),
  ('Pepper Lunch Express 胡椒廚房 - 台中中友店', 3),
  ('Pepper Lunch Express 胡椒廚房 - 新莊宏匯店', 3),
  ('Pepper Lunch 胡椒廚房 - 髙島屋店', 3),
  ('Pepper Lunch Express胡椒廚房 - 台南南紡店', 3),
  ('Pepper Lunch Express 胡椒廚房 - 台中三井店', 3),
  ('Pepper Lunch Express 胡椒廚房 - 新竹巨城店', 3),
  ('Pepper Lunch Express 胡椒廚房 - Lalaport台中店', 3),
  ('Pepper Lunch Express 胡椒廚房 - 台北101店', 3);
```

---

### 3.5 store_members（門店人員，支援多人）

```sql
CREATE TABLE store_members (
  id          BIGSERIAL PRIMARY KEY,
  store_id    INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(store_id, email)
);

ALTER TABLE store_members DISABLE ROW LEVEL SECURITY;
```

---

### 3.6 area_members（區域主管，支援多人）

```sql
CREATE TABLE area_members (
  id          BIGSERIAL PRIMARY KEY,
  area_id     INTEGER REFERENCES areas(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(area_id, email)
);

ALTER TABLE area_members DISABLE ROW LEVEL SECURITY;
```

---

### 3.7 business_group_members（事業群主管，支援多人）

```sql
CREATE TABLE business_group_members (
  id                  BIGSERIAL PRIMARY KEY,
  business_group_id   INTEGER REFERENCES business_groups(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  created_at          TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(business_group_id, email)
);

ALTER TABLE business_group_members DISABLE ROW LEVEL SECURITY;
```

---

### 3.8 user_roles（使用者權限）

> 所有角色的 email 統一在此表維護，角色對應的資料範圍則到各自 members 表查詢。

```sql
CREATE TYPE user_role AS ENUM (
  'store',          -- 門店人員
  'area_manager',   -- 區域主管
  'group_manager',  -- 事業群主管
  'headquarters',   -- 總部
  'super_admin'     -- 最高權限
);

CREATE TABLE user_roles (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  role        user_role NOT NULL,
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  updated_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
```

---

### 3.9 google_reviews（Google 評論）

```sql
CREATE TABLE google_reviews (
  id                BIGSERIAL PRIMARY KEY,
  review_id         TEXT UNIQUE NOT NULL,
  reviewer_name     TEXT,
  branch_name       TEXT,
  star_rating       TEXT,
  review_content    TEXT,
  review_time       TIMESTAMP,

  -- AI 回覆
  ai_reply          TEXT,
  ai_analysis_time  TIMESTAMP,

  -- 人工回覆
  reply_content     TEXT,        -- 實際送出到 Google 的回覆內容
  replied_by        TEXT,        -- 回覆者 email
  reply_time        TIMESTAMP,   -- 回覆時間

  -- 處理狀態
  process_status    TEXT DEFAULT '未處理',
  -- 狀態值：未處理 / 處理中 / 已回覆 / 已結案

  -- 結案
  is_closed         BOOLEAN DEFAULT FALSE,
  closed_by         TEXT,        -- 結案者 email
  closed_at         TIMESTAMP,   -- 結案時間

  created_at        TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE google_reviews DISABLE ROW LEVEL SECURITY;
```

---

## 4. process_status 狀態定義

| 狀態值 | is_closed | 說明 | 可操作角色 |
|--------|-----------|------|-----------|
| `未處理` | FALSE | 新進評論，尚未處理 | 自動設定 |
| `處理中` | FALSE | 已有人員介入 | store / area_manager / group_manager / super_admin |
| `已回覆` | FALSE | 已送出 Google 回覆，待結案 | store / area_manager / group_manager / super_admin |
| `已結案` | TRUE | 主管確認結案 | group_manager / super_admin |

---

## 5. 回覆評論功能

### 5.1 Google API 端點

```
PUT https://mybusiness.googleapis.com/v4/{review_id}/reply
Body: { "comment": "回覆內容" }
```

`review_id` 即 `google_reviews.review_id`（格式：`accounts/xxx/locations/xxx/reviews/xxx`）

### 5.2 網頁操作流程

```
評論詳情頁
  │
  ├── 顯示 ai_reply 內容
  │     └── 「複製 AI 回覆」按鈕
  │           → 自動將 ai_reply 內容填入 reply_content 編輯框
  │
  ├── reply_content 編輯框（可自行修改）
  │
  └── 「送出回覆」按鈕
        → 呼叫 Google API PUT reply
        → 成功後更新 google_reviews：
            reply_content = 編輯框內容
            replied_by    = 登入者 email
            reply_time    = 當下時間
            process_status = '已回覆'
```

### 5.3 結案操作流程

```
評論詳情頁（process_status = 已回覆）
  │
  └── 「結案」按鈕（僅 group_manager / super_admin 可見）
        → 更新 google_reviews：
            is_closed      = TRUE
            closed_by      = 登入者 email
            closed_at      = 當下時間
            process_status = '已結案'
```

---

## 6. 權限規則

| 角色 | 可見評論 | 可回覆評論 | 可結案 | 可異動基本資料表 |
|------|---------|-----------|--------|----------------|
| `store` | 自己門店 | ✅ 自己門店 | ❌ | ❌ |
| `area_manager` | 管轄區域門店 | ✅ 管轄門店 | ❌ | ❌ |
| `group_manager` | 事業群門店 | ✅ 事業群門店 | ✅ 事業群門店 | ❌ |
| `headquarters` | 所有門店 | ❌ | ❌ | ❌ |
| `super_admin` | 所有門店 | ✅ 全部 | ✅ 全部 | ✅ |

---

## 7. 資料表關聯圖

```
user_roles（統一管理所有帳號的角色）
  │
  ├── role = store         → store_members（email 比對）→ stores
  ├── role = area_manager  → area_members（email 比對）→ areas → stores
  ├── role = group_manager → business_group_members（email 比對）→ business_groups → stores
  ├── role = headquarters  → 可看全部（不需額外查詢）
  └── role = super_admin   → 可看全部 + 異動所有資料表

google_group (1)
  ├── (N) stores
  └── (N) areas

business_groups (1)
  ├── (N) stores
  └── (N) business_group_members

areas (1)
  ├── (N) stores
  └── (N) area_members

stores (1)
  └── (N) store_members

google_reviews
  └── branch_name 對應 stores.store_name（字串比對）
  └── replied_by / closed_by 對應 user_roles.email
```

---

## 8. 登入後角色判斷流程

```
Google OAuth 登入取得 email
  │
  ├── Step 1：比對 user_roles.email 取得 role
  │     └── 無對應 email → 顯示「無權限，請聯繫管理員」
  │
  └── Step 2：依 role 查詢可見範圍
        ├── store
        │     └── 到 store_members 查詢 email 對應的 store_id 清單
        │           → 篩選 google_reviews.branch_name 符合的評論
        │
        ├── area_manager
        │     └── 到 area_members 查詢 email 對應的 area_id 清單
        │           → 到 stores 查詢該 area_id 下的所有門店
        │           → 篩選 google_reviews.branch_name 符合的評論
        │
        ├── group_manager
        │     └── 到 business_group_members 查詢 email 對應的 business_group_id 清單
        │           → 到 stores 查詢該 business_group_id 下的所有門店
        │           → 篩選 google_reviews.branch_name 符合的評論
        │
        ├── headquarters
        │     └── 直接讀取所有 google_reviews（唯讀）
        │
        └── super_admin
              └── 直接讀取所有 google_reviews + 可異動所有資料表
```

---

## 9. 完整資料表清單與初始化順序

> 依此順序執行 SQL，避免外鍵錯誤。

| 順序 | 資料表 | 說明 | RLS |
|------|--------|------|-----|
| 1 | `google_group` | 品牌群組 | 關閉 |
| 2 | `business_groups` | 事業群 | 關閉 |
| 3 | `areas` | 區域 | 關閉 |
| 4 | `stores` | 門店 | 關閉 |
| 5 | `store_members` | 門店人員（多人） | 關閉 |
| 6 | `area_members` | 區域主管（多人） | 關閉 |
| 7 | `business_group_members` | 事業群主管（多人） | 關閉 |
| 8 | `google_reviews` | Google 評論 | 關閉 |
| 9 | `user_roles` | 所有帳號角色（含 ENUM） | 關閉 |

---

## 10. GitHub 設定

| 項目 | 說明 |
|------|------|
| Repository | `googlereviews` |
| 主要分支 | `main` |
| 開發分支 | `dev` |

### .gitignore 重要項目
```
.env
.env.local
node_modules/
```

---

## 11. 部署平台：Vercel

### 11.1 選用原因

| 項目 | 說明 |
|------|------|
| 免費方案 | 個人專案完全免費 |
| 部署方式 | 連接 GitHub Repository，push 後自動部署 |
| HTTPS | 自動提供 SSL 憑證（PWA 必須跑在 HTTPS） |
| 環境變數 | Vercel 後台直接設定，不寫死在程式碼 |
| CDN | 全球節點，台灣存取速度快 |
| 自訂網域 | 支援綁定自己的網域 |

### 11.2 環境變數設定位置

> Vercel 後台 → 專案設定 → Environment Variables，填入以下所有變數：

```env
SUPABASE_URL=https://zunactakynxzgvzoazul.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_API_KEY=
```

### 11.3 部署流程

```
本地開發
  │
  ├── push 到 dev 分支
  │     → Vercel 自動建置 Preview URL（測試用）
  │     → 確認功能正常
  │
  └── merge dev → main
        → Vercel 自動部署正式版本
        → 正式網址生效
```

### 11.4 初次部署步驟

```
1. 登入 vercel.com（用 GitHub 帳號登入）
2. 點擊「Add New Project」
3. 選擇 GitHub Repository：googlereviews
4. 設定環境變數（見 11.2）
5. 點擊「Deploy」
6. 部署完成後取得網址（例：https://googlereviews.vercel.app）
7. 選填：到 Domains 設定自訂網域
```

### 11.5 免費方案額度

| 項目 | 免費額度 | 評估 |
|------|---------|------|
| 頻寬 | 100GB / 月 | ✅ 內部系統足夠 |
| 部署次數 | 無限制 | ✅ |
| 自訂網域 | 支援 | ✅ |
| HTTPS | 自動提供 | ✅ |
| 專案數量 | 無限制 | ✅ |