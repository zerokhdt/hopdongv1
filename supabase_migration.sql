-- Supabase schema (no employee seed data)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO branches (id, name) VALUES ('BAN GIÁM ĐỐC', 'BAN GIÁM ĐỐC') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('HEAD OFFICE', 'HEAD OFFICE') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHÒNG CHUYÊN MÔN', 'PHÒNG CHUYÊN MÔN') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHÒNG NHÂN SỰ', 'PHÒNG NHÂN SỰ') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHÒNG TÀI CHÍNH', 'PHÒNG TÀI CHÍNH') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHÒNG TRUYỀN THÔNG MARKETING', 'PHÒNG TRUYỀN THÔNG MARKETING') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHÒNG THANH TRA', 'PHÒNG THANH TRA') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('KHO HỆ THỐNG', 'KHO HỆ THỐNG') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('THỐNG NHẤT', 'THỐNG NHẤT') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('XÓM MỚI', 'XÓM MỚI') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('GÒ XOÀI', 'GÒ XOÀI') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('LIÊN KHU 4-5', 'LIÊN KHU 4-5') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('XUÂN THỚI THƯỢNG', 'XUÂN THỚI THƯỢNG') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHAN VĂN HỚN', 'PHAN VĂN HỚN') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('TÂN SƠN NHÌ', 'TÂN SƠN NHÌ') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('LÊ VĂN KHƯƠNG', 'LÊ VĂN KHƯƠNG') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('ĐẶNG THÚC VỊNH', 'ĐẶNG THÚC VỊNH') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('LÊ LỢI', 'LÊ LỢI') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('HÀ HUY GIÁP', 'HÀ HUY GIÁP') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('TRUNG MỸ TÂY', 'TRUNG MỸ TÂY') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('THỚI AN', 'THỚI AN') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('DREAM HOME', 'DREAM HOME') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('PHAN THIẾT', 'PHAN THIẾT') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('AN SƯƠNG', 'AN SƯƠNG') ON CONFLICT (id) DO NOTHING;
INSERT INTO branches (id, name) VALUES ('NGUYỄN ẢNH THỦ', 'NGUYỄN ẢNH THỦ') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  title TEXT,
  name TEXT NOT NULL,
  position TEXT,
  department TEXT REFERENCES branches(id),
  email TEXT,
  phone TEXT,
  start_date TEXT,
  probation_date TEXT,
  seniority TEXT,
  contract_date TEXT,
  renew_date TEXT,
  education TEXT,
  major TEXT,
  pedagogy_cert TEXT,
  has_insurance TEXT,
  insurance_agency TEXT,
  document_status TEXT,
  salary TEXT,
  salary_base TEXT,
  allowance_housing TEXT,
  allowance_travel TEXT,
  allowance_phone TEXT,
  cccd TEXT,
  cccd_date TEXT,
  cccd_place TEXT,
  dob TEXT,
  address TEXT,
  current_address TEXT,
  nationality TEXT DEFAULT 'Việt Nam',
  avatar_url TEXT,
  bank_account TEXT,
  bank_name TEXT,
  tax_code TEXT,
  note TEXT,
  raw_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  branch TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES accounts(username) ON DELETE CASCADE,
  role TEXT NOT NULL,
  branch TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_import_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  overwrite_existing BOOLEAN NOT NULL DEFAULT TRUE,
  employees JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_by TEXT,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  "group" TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT,
  priority TEXT,
  end_date TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  step TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  from_status TEXT,
  to_status TEXT,
  from_group TEXT,
  to_group TEXT,
  actor TEXT,
  actor_role TEXT,
  actor_branch TEXT,
  error TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_transition_log_task_idx ON task_transition_log(task_id);
CREATE INDEX IF NOT EXISTS task_transition_log_created_at_idx ON task_transition_log(created_at DESC);

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_username TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS app_notifications_target_idx ON app_notifications(target_username);
CREATE INDEX IF NOT EXISTS app_notifications_created_at_idx ON app_notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS contract_issue_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key TEXT,
  method TEXT NOT NULL,
  so_hd TEXT,
  employee_id TEXT,
  employee_name TEXT,
  branch TEXT,
  filename TEXT,
  drive_file_id TEXT,
  drive_view_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personnel_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL,
  created_by TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  employee_id TEXT,
  employee_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS personnel_movements_status_idx ON personnel_movements(status);
CREATE INDEX IF NOT EXISTS personnel_movements_branch_idx ON personnel_movements(branch);
CREATE INDEX IF NOT EXISTS personnel_movements_created_at_idx ON personnel_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS personnel_movements_employee_id_idx ON personnel_movements(employee_id);

CREATE TABLE IF NOT EXISTS personnel_movement_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES personnel_movements(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TIMESTAMPTZ DEFAULT NOW(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS personnel_movement_audit_movement_idx ON personnel_movement_audit(movement_id);
CREATE INDEX IF NOT EXISTS personnel_movement_audit_at_idx ON personnel_movement_audit(at DESC);

CREATE TABLE IF NOT EXISTS employee_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  branch TEXT,
  leave_type TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  days INTEGER,
  reason TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_leaves_employee_idx ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS employee_leaves_branch_idx ON employee_leaves(branch);
CREATE INDEX IF NOT EXISTS employee_leaves_created_at_idx ON employee_leaves(created_at DESC);

CREATE TABLE IF NOT EXISTS app_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_users_select_none" ON app_users;
CREATE POLICY "app_users_select_none"
  ON app_users
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE OR REPLACE FUNCTION authenticate_app_user(p_username TEXT, p_password TEXT)
RETURNS TABLE (username TEXT, branch_id TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.username, u.branch_id, u.role
  FROM public.app_users u
  WHERE lower(u.username) = lower(trim(p_username))
    AND u.password_hash = extensions.crypt(p_password, u.password_hash);
END;
$$;

REVOKE ALL ON FUNCTION authenticate_app_user(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authenticate_app_user(TEXT, TEXT) TO anon, authenticated;
