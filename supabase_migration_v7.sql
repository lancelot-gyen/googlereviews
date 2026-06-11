-- Migration v7：user_roles 新增 can_reply 欄位（控制 Google 回覆功能權限）
-- 預設 FALSE；執行後手動將 super_admin 設為 TRUE，或依需求開放其他角色

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS can_reply BOOLEAN NOT NULL DEFAULT FALSE;

-- 將現有 super_admin 帳號預設開啟回覆權限
UPDATE user_roles SET can_reply = TRUE WHERE role = 'super_admin';
