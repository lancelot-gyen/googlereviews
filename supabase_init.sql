-- ============================================================
-- Google 評論管理系統 — 資料庫初始化（規格書 v6）
-- 請在 Supabase SQL Editor 中執行此檔案
-- ============================================================

-- 1. google_group（品牌群組）
CREATE TABLE IF NOT EXISTS google_group (
  id          BIGSERIAL PRIMARY KEY,
  group_name  TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);
ALTER TABLE google_group DISABLE ROW LEVEL SECURITY;

INSERT INTO google_group (group_name) VALUES
  ('開丼 燒肉vs丼飯'),
  ('bhc CHICKEN'),
  ('Pepper Lunch 胡椒廚房')
ON CONFLICT (group_name) DO NOTHING;

-- 2. business_groups（事業群）
CREATE TABLE IF NOT EXISTS business_groups (
  id                  BIGSERIAL PRIMARY KEY,
  business_group_name TEXT UNIQUE NOT NULL,
  created_at          TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);
ALTER TABLE business_groups DISABLE ROW LEVEL SECURITY;

-- 3. areas（區域）
CREATE TABLE IF NOT EXISTS areas (
  id          BIGSERIAL PRIMARY KEY,
  area_name   TEXT UNIQUE NOT NULL,
  group_id    INTEGER REFERENCES google_group(id),
  created_at  TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);
ALTER TABLE areas DISABLE ROW LEVEL SECURITY;

-- 4. stores（門店）
CREATE TABLE IF NOT EXISTS stores (
  id                BIGSERIAL PRIMARY KEY,
  store_name        TEXT NOT NULL,
  group_id          INTEGER REFERENCES google_group(id),
  area_id           INTEGER REFERENCES areas(id),
  business_group_id INTEGER REFERENCES business_groups(id),
  created_at        TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;

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

-- 5. store_members（門店人員，支援多人）
CREATE TABLE IF NOT EXISTS store_members (
  id         BIGSERIAL PRIMARY KEY,
  store_id   INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(store_id, email)
);
ALTER TABLE store_members DISABLE ROW LEVEL SECURITY;

-- 6. area_members（區域主管，支援多人）
CREATE TABLE IF NOT EXISTS area_members (
  id         BIGSERIAL PRIMARY KEY,
  area_id    INTEGER REFERENCES areas(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(area_id, email)
);
ALTER TABLE area_members DISABLE ROW LEVEL SECURITY;

-- 7. business_group_members（事業群主管，支援多人）
CREATE TABLE IF NOT EXISTS business_group_members (
  id                BIGSERIAL PRIMARY KEY,
  business_group_id INTEGER REFERENCES business_groups(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(business_group_id, email)
);
ALTER TABLE business_group_members DISABLE ROW LEVEL SECURITY;

-- 8. google_reviews（Google 評論）
CREATE TABLE IF NOT EXISTS google_reviews (
  id               BIGSERIAL PRIMARY KEY,
  review_id        TEXT UNIQUE NOT NULL,
  reviewer_name    TEXT,
  branch_name      TEXT,
  star_rating      TEXT,
  review_content   TEXT,
  review_time      TIMESTAMP,

  -- AI 回覆
  ai_reply         TEXT,
  ai_analysis_time TIMESTAMP,

  -- 人工回覆
  reply_content    TEXT,
  replied_by       TEXT,
  reply_time       TIMESTAMP,

  -- 處理狀態（未處理 / 處理中 / 已回覆 / 已結案）
  process_status   TEXT DEFAULT '未處理',

  -- 結案
  is_closed        BOOLEAN DEFAULT FALSE,
  closed_by        TEXT,
  closed_at        TIMESTAMP,

  created_at       TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);
ALTER TABLE google_reviews DISABLE ROW LEVEL SECURITY;

-- 9. user_roles（所有帳號角色）
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'store',
    'area_manager',
    'group_manager',
    'headquarters',
    'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_roles (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       user_role NOT NULL,
  created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  updated_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')
);
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- 初始 super_admin
INSERT INTO user_roles (email, role) VALUES
  ('lancelot@gyen.com.tw', 'super_admin')
ON CONFLICT (email) DO NOTHING;
