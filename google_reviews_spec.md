# Google 評論管理系統 — 系統規格書 v2

## 1. 專案概覽

| 項目 | 說明 |
|------|------|
| 專案名稱 | Google 評論管理系統 |
| GitHub Repository | `googlereviews` |
| 資料庫 | Supabase (PostgreSQL) |
| 認證方式 | Google OAuth（透過 Supabase Auth） |

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

### .env.example
```env
SUPABASE_URL=https://zunactakynxzgvzoazul.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

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
  manager_name        TEXT,
  manager_email       TEXT,
  created_at          TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE business_groups DISABLE ROW LEVEL SECURITY;
```

---

### 3.3 areas（區域）

```sql
CREATE TABLE areas (
  id              BIGSERIAL PRIMARY KEY,
  area_name       TEXT UNIQUE NOT NULL,
  group_id        INTEGER REFERENCES google_group(id),
  manager_name    TEXT,
  manager_email   TEXT,
  created_at      TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
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
  manager_name        TEXT,
  manager_email       TEXT,
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

### 3.5 google_reviews（Google 評論）

```sql
CREATE TABLE google_reviews (
  id                BIGSERIAL PRIMARY KEY,
  review_id         TEXT UNIQUE NOT NULL,
  reviewer_name     TEXT,
  branch_name       TEXT,
  star_rating       TEXT,
  review_content    TEXT,
  review_time       TIMESTAMP,
  ai_reply          TEXT,
  ai_analysis_time  TIMESTAMP,
  process_status    TEXT DEFAULT '未處理',
  reply_time        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);

ALTER TABLE google_reviews DISABLE ROW LEVEL SECURITY;
```

---

### 3.6 user_roles（使用者權限）

> `store`、`area_manager`、`group_manager` 的 email 來自各自資料表的 `manager_email` 欄位。  
> `headquarters` 和 `super_admin` 則在此表直接維護。

```sql
CREATE TYPE user_role AS ENUM (
  'store',          -- 門店店長
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

## 4. 資料表關聯圖

```
google_group (1)
  ├── (N) stores
  │     ├── area_id      → areas(id)
  │     └── business_group_id → business_groups(id)
  └── (N) areas

business_groups (1)
  └── (N) stores

google_reviews
  └── branch_name 對應 stores.store_name（字串比對）

user_roles
  └── email 對應：
        stores.manager_email        → role: store
        areas.manager_email         → role: area_manager
        business_groups.manager_email → role: group_manager
        user_roles.email            → role: headquarters / super_admin
```

---

## 5. 權限規則

| 角色 | email 來源 | 可見評論範圍 | 可異動資料表 |
|------|-----------|------------|------------|
| `store` | `stores.manager_email` | 自己門店的評論 | `google_reviews`（自己門店） |
| `area_manager` | `areas.manager_email` | 管轄區域內所有門店評論 | `google_reviews`（管轄門店） |
| `group_manager` | `business_groups.manager_email` | 事業群內所有門店評論 | `google_reviews`（事業群） |
| `headquarters` | `user_roles.email` | 所有門店評論（唯讀） | `google_reviews`（全部） |
| `super_admin` | `user_roles.email` | 所有門店評論 | 所有資料表 |

> ⚠️ 只有 `super_admin` 可以新增／修改／刪除 `user_roles`、`stores`、`areas`、`business_groups`、`google_group` 等基本資料表。

---

## 6. 登入後角色判斷流程

```
Google OAuth 登入取得 email
  │
  ├── 比對 stores.manager_email        → role: store
  ├── 比對 areas.manager_email         → role: area_manager
  ├── 比對 business_groups.manager_email → role: group_manager
  ├── 比對 user_roles（role=headquarters）→ role: headquarters
  ├── 比對 user_roles（role=super_admin）→ role: super_admin
  │
  └── 皆無比對 → 顯示「無權限，請聯繫管理員」
```

---

## 7. 完整資料表清單

| 資料表 | 說明 | RLS |
|--------|------|-----|
| `google_group` | 品牌群組 | 關閉 |
| `business_groups` | 事業群（含負責人） | 關閉 |
| `areas` | 區域（含負責人） | 關閉 |
| `stores` | 門店（含店長） | 關閉 |
| `google_reviews` | Google 評論 | 關閉 |
| `user_roles` | 總部/最高權限帳號 | 關閉 |

---

## 8. GitHub 設定

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

## 9. 資料庫初始化順序

執行 SQL 的順序（避免外鍵錯誤）：

```
1. google_group
2. business_groups
3. areas
4. stores
5. google_reviews
6. user_roles（含 ENUM 建立）
```
