# ACE HRM — Development Log (Append-Only)

This file is the ongoing, append-only development log.

Rules:

- Add a new entry for every meaningful change (feature, bug fix, refactor, data migration, infra).
- Keep entries short but actionable: what changed, why, where, and how it was verified.
- Do not delete old entries; if something was reverted, add a new entry describing the revert.

---

## 2026-03-29

### Contract printing: legacy CSV quick import + mapping fixes

- Added “Quick upload/paste (not saved)” to speed up branch contract printing from CSV/XLSX.
- Implemented automatic contract number generation from employee code: `MA_NV/YYYY/HĐLĐ-ACE`.
- Improved CSV parsing for real-world exports:
  - Detect correct header row even with multi-row titles above headers.
  - Normalize Vietnamese headers (including `đ/Đ` → `d`) for consistent mapping.
  - Handle duplicate headers by auto-disambiguation (`...__2`, `...__3`) to avoid overwriting (e.g., duplicated “Điện Thoại”).
  - Normalize date strings (`M/D/YYYY`) to `YYYY-MM-DD` for HTML date inputs.
- Updated Fulltime contract header display so “Số:” uses the generated number directly (no double suffix).

Files:

- `src/components/ContractView.jsx`

Verification:

- `vite build` succeeds.

### Fulltime contract pages 3–4 packaging

- Shipped the original PDF as a static asset and attempted runtime rendering with PDF.js.
- Added PDF.js loader and a canvas renderer for page 3–4 using absolute URL and disabled range/stream/autofetch to improve compatibility.

Files:

- `public/contracts/hdld-full.pdf`
- `src/components/ContractView.jsx`

Note:

- If PDF pages still fail to render in some browsers/environments, the next step is to pre-render pages 3–4 into images during build and print the images instead of runtime PDF rendering.

---

## 2026-03-30

### Contract UI refactor: Loại HĐ + Vị trí + Thỏa thuận + Cam kết
- Split “Loại hợp đồng” and “Vị trí công việc”; branches now only choose position while admins configure template IDs separately.
- Introduced email-based delivery: generated PDFs are sent via Apps Script MailApp; UI shows progress and success notice.
- Hid template Doc IDs from all UIs; admins paste via prompt only.
- Added animated education-themed background on Login.
Files: `src/components/ContractView.jsx`, `docs/google-docs-contract/Code.gs`, `api/contract.js`, `src/components/LoginView.jsx`

Verification: manual end-to-end — select contract/agreement/commitment, enter email, “Xuất file vào email” → email received with attachments.

---

## 2026-03-31

### Supabase-based login (app_users) for demo environments
- Added `app_users` table and RPC `authenticate_app_user(p_username, p_password)` (SECURITY DEFINER) using `extensions.crypt` for password verification.
- Tightened RLS: deny direct selects on `app_users`, expose only RPC.
- Updated Login flow to use Supabase RPC; fallback to legacy `/api/login` only when Supabase env is missing.
- Added debug switch `?debug=1` on the login page to surface RPC errors in UI and console.
- Docs: updated `SUPABASE_SETUP.md` with exact SQL for creating users via `extensions.crypt(gen_salt('bf'))`.
- Fixed env reading to accept Vercel variable naming; verified with Production redeploy.

Files:
- `supabase_migration.sql`
- `src/utils/supabase.js`
- `src/components/LoginView.jsx`
- `docs/SUPABASE_SETUP.md`
- `scripts/supabase_seed_users.mjs`, `scripts/supabase_seed_employees_from_csv.mjs`

Verification:
- Supabase SQL `select * from authenticate_app_user('trungmytay','123456')` returns 1 row.
- Vercel env set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Network devtools shows POST to `/rest/v1/rpc/authenticate_app_user` with 200 OK in debug runs.

### Multi-document Apps Script pipeline
- WebApp now accepts `documents[]` and returns `items[]` with per-file status.
- Email bundles all generated PDFs and lists failed ones (if any).
Files: `docs/google-docs-contract/Code.gs`, `api/contract.js`

### DOCX generation + viewer
- Integrated PizZip + Docxtemplater + FileSaver to generate .docx locally from templates.
- Added DOCX preview using `docx-preview`; supports default template and optional per-section file pickers.
- Implemented delimiter auto-detection (`{{ }}` or `{ }`).
Files: `src/components/ContractView.jsx`, `public/templates/hdld-ft.docx`, `package.json`

### CSV import (branch)
- Modal scroll trap fixed; actions moved to header.
- Branch imports auto-override `department` with current branch for visibility.
- Added selectable import list with “select all” and per-row checkboxes.
- Encoding hardening: heuristic decoder (UTF‑8, Windows‑1258/1252, UTF‑16LE) with header scoring; BOM cleanup.
Files: `src/components/EmployeeView.jsx`

### Misc
- Position normalization and merging (Fulltime/Thỉnh giảng, case/diacritics insensitive).
Files: `src/components/ContractView.jsx`, `src/components/PersonnelReportView.jsx`
