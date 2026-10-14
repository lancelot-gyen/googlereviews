-- Migration v8：門店改用 Google 門店代碼（location_id）對應評論，不再依賴店名
-- review_id 格式：accounts/{accountId}/locations/{locationId}/reviews/{reviewId}

BEGIN;

-- 1. 評論：由 review_id 自動產生 location_id（n8n、評論匯入不需修改）
ALTER TABLE google_reviews
  ADD COLUMN IF NOT EXISTS location_id TEXT
  GENERATED ALWAYS AS (split_part(review_id, '/', 4)) STORED;
CREATE INDEX IF NOT EXISTS idx_google_reviews_location_id ON google_reviews (location_id);

-- 2. 門店：新增門店代碼
ALTER TABLE stores ADD COLUMN IF NOT EXISTS location_id TEXT;
CREATE INDEX IF NOT EXISTS idx_stores_location_id ON stores (location_id);

-- 3. 依店名自動回填門店代碼
UPDATE stores s
   SET location_id = r.location_id
  FROM (SELECT DISTINCT branch_name, location_id FROM google_reviews) r
 WHERE s.location_id IS NULL
   AND s.store_name = r.branch_name;

-- 4. 後台已改成短名稱、無法用店名對應的門店
UPDATE stores SET location_id = '1526023040786345159'  WHERE id = 45; -- 四代目菊川 台中漢神洲際店
UPDATE stores SET location_id = '4324691898167145765'  WHERE id = 52; -- 四代目菊川 高雄漢神巨蛋店
UPDATE stores SET location_id = '10499959017472121011' WHERE id = 53; -- 四代目菊川 台北SOGO天母店
UPDATE stores SET location_id = '376834707421807545'   WHERE id = 55; -- 四代目菊川 遠東Garden City大巨蛋店

-- 5. 每個 Google 門店的最新店名與評論數（資料管理頁列出未登記門店用）
CREATE OR REPLACE VIEW review_locations AS
SELECT location_id,
       (array_agg(branch_name ORDER BY review_time DESC NULLS LAST))[1] AS latest_name,
       count(*) AS review_count
  FROM google_reviews
 GROUP BY location_id;
GRANT SELECT ON review_locations TO anon, authenticated;

COMMIT;

-- 執行後確認：以下應回傳 0 筆
SELECT id, store_name FROM stores WHERE location_id IS NULL;
