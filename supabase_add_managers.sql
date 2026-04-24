-- 門店主管（多對多）
CREATE TABLE IF NOT EXISTS store_managers (
  id            BIGSERIAL PRIMARY KEY,
  store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  manager_name  TEXT,
  manager_email TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(store_id, manager_email)
);
ALTER TABLE store_managers DISABLE ROW LEVEL SECURITY;

-- 區域主管（多對多）
CREATE TABLE IF NOT EXISTS area_managers (
  id            BIGSERIAL PRIMARY KEY,
  area_id       INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  manager_name  TEXT,
  manager_email TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(area_id, manager_email)
);
ALTER TABLE area_managers DISABLE ROW LEVEL SECURITY;

-- 事業群主管（多對多）
CREATE TABLE IF NOT EXISTS business_group_managers (
  id                BIGSERIAL PRIMARY KEY,
  business_group_id INTEGER NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  manager_name      TEXT,
  manager_email     TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
  UNIQUE(business_group_id, manager_email)
);
ALTER TABLE business_group_managers DISABLE ROW LEVEL SECURITY;
