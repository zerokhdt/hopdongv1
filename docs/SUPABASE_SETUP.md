## Supabase Auth (ACE HRM)

### 1) Tạo bảng (branches/employees/app_users) + hàm login
- Mở Supabase SQL Editor và chạy toàn bộ [supabase_migration.sql](file:///d:/OneDrive/ACE/APP/TASK_MANAGER-main/supabase_migration.sql).

### 2) Tạo tài khoản đăng nhập (bảng app_users) để demo nhanh
- Chạy SQL này trong Supabase SQL Editor (ví dụ 1 user):

```bash
insert into public.app_users (username, password_hash, branch_id, role)
values ('trungmytay', extensions.crypt('123456', extensions.gen_salt('bf')), 'TRUNG MỸ TÂY', 'user')
on conflict (username) do update
set password_hash = excluded.password_hash, branch_id = excluded.branch_id, role = excluded.role;
```

Tài khoản login trong app dùng:
- Username: `trungmytay` (ví dụ)
- Password: `123456`

### 3) Cấu hình env cho web (Vercel)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (khuyến nghị) hoặc `VITE_SUPABASE_ANON_KEY`

Sau đó redeploy.

### 4) Seed danh sách nhân sự từ CSV (demo)
- Chuẩn bị file CSV theo format import của app (ví dụ: `demo_nhan_su_mock.csv`)
- Chạy:

```bash
node scripts/supabase_seed_employees_from_csv.mjs demo_nhan_su_mock.csv
```
