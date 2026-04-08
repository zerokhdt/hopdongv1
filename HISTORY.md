# ACE HRM — Development History

This file captures the evolution of the ACE HRM application so that new contributors can quickly understand what was built, why, and where to extend it.

## Maintenance Policy (Keep This Updated)

From now on, every meaningful change should be recorded in `DEVLOG.md` (append-only), and `HISTORY.md` should be updated only when a change represents a new milestone or architectural shift.

- `DEVLOG.md`: day-to-day change log (what changed, files, rationale, verification).
- `HISTORY.md`: milestone-level narrative for onboarding.

## Project Overview

ACE HRM is a role-based HRM + task workflow system for ACE Education. It includes:

- HRM/Admin experience: manages tasks, reviews personnel movements, maintains personnel records, generates contracts, and prints CEO-ready reports.
- Branch experience: views branch-only personnel and assigned tasks, submits personnel movement requests, and marks tasks as done.

The current implementation is primarily a frontend (React + Tailwind) with local state and file-based imports. Supabase integration is planned but not yet the source of truth.

## Key Milestones (Chronological)

### 1) Baseline App + Mock Data Trial

- Added a runnable demo state with mock data to validate UI flows quickly.
- Established two primary roles:
  - `admin` (HRM): full privileges.
  - `user` (Branch): restricted privileges.

### 2) Personnel Movement Workflow (Branch submits, HRM reviews)

- Implemented a movement request pipeline where branches can submit requests and HRM can:
  - Approve
  - Reject
  - Request revision (REVISION)

Where it lives:

- `src/components/PersonnelMovementView.jsx`: movement creation forms and history.
- `src/components/TaskManagerView.jsx`: “MY TASK” panel for HRM approvals.

### 3) Role-based Restrictions for Branch Accounts

- Branch accounts were limited to read-only task views (no task/group management).
- Sidebar labels were made role-aware (branch sees “Task”, admin sees “Task manager”).

Where it lives:

- `src/components/Sidebar.jsx`
- `src/components/TaskManagerView.jsx`
- `src/components/TaskModal.jsx`

### 4) Excel Extraction for Personnel/Branches (Prep for Supabase)

- Introduced a Node script to parse the master HR Excel workbook and generate:
  - React seed data (`employees_seed.js`)
  - CSV export (for future imports)
  - SQL migration draft (for Supabase)

Where it lives:

- `extract-excel-to-sql.cjs`
- `src/data/employees_seed.js`

### 5) Personnel Profile: Full Details + History + Print/PDF

- Added an employee profile modal with tabbed navigation.
- Seniority is computed from `startDate` rather than stored as static text.
- Added print-only layout designed for CEO review.
- Added thumbnail/avatar upload (client-side base64) in the profile.

Where it lives:

- `src/components/EmployeeView.jsx`

### 6) Admin Navigation & Reporting Expansion

- Introduced admin-only reporting views:
  - Personnel summary table (Excel-like dashboard)
  - CEO report printing view with filters and multiple report types
- Added report “Review before print” modal.
- Added a bottom section in reports that groups employees by normalized position and prints lines as:
  - `Branch - Gender - Name - Education - Seniority`

Where it lives:

- `src/components/PersonnelSummaryView.jsx`
- `src/components/PersonnelReportView.jsx`

### 6.1) Reports: Grouped Output for CEO

- Added an additional “grouped” section at the bottom of reports to make CEO review faster.
- Output format per employee line:
  - `Branch - Gender - Name - Education - Seniority`
- Groups are normalized by position (same titles are merged).

### 7) UI/UX Stabilization: Scrolling + Collapsible Menus

- Fixed several scroll traps by ensuring correct `flex` + `min-h-0` + `overflow-*` usage.
- Added collapse/expand controls:
  - Kanban columns collapse/expand and “collapse all” button
  - Sidebar group list collapsible under Task manager
  - Personnel section in sidebar collapsible

Where it lives:

- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/components/TaskManagerView.jsx`
- `src/components/KanbanBoard.jsx`

### 8) Brand Refresh: “ACE HRM” + Logo Integration

- Renamed visible branding from “TaskMaster” to “ACE HRM”.
- Updated favicon and placed the provided ACE logo in common UI locations:
  - Login
  - Header
  - Sidebar
  - Reports

Where it lives:

- `index.html`
- `public/ace-logo.svg`
- `src/components/LoginView.jsx`
- `src/components/Header.jsx`
- `src/components/Sidebar.jsx`

### 9) Contract Generator: Fulltime Template + Allowances + Salary-in-Words

- Enhanced Fulltime contract printing:
  - Added salary section `3.1.1` (salary + salary-in-words)
  - Added allowances section `3.1.2` (housing/travel/phone)
- Implemented salary-in-words auto-generation when typing salary.
- Position field supports selecting from a list (datalist) or typing.

Where it lives:

- `src/components/ContractView.jsx`

### 10) Contract Pages 3–4 Packaging (Hybrid HTML + PDF)

- Implemented a hybrid print flow for the Fulltime contract:
  - Pages 1–2: generated HTML print layout (editable fields).
  - Pages 3–4: rendered from the original PDF using PDF.js at runtime.
- The PDF is shipped as a static asset:
  - `public/contracts/hdld-full.pdf`

Where it lives:

- `src/components/ContractView.jsx` (PDF.js loader + `PdfA4Page` renderer)
- `public/contracts/hdld-full.pdf`

### 11) Quick Contract Input for Branches (CSV/Excel Paste/Upload, No Persistence)

To support branches still using legacy spreadsheets:

- Added a “Quick upload/paste (not saved)” mode inside Contract creation.
- Supports:
  - Upload `.csv` (CSV UTF-8 recommended)
  - Upload `.xlsx/.xls` (via runtime-loaded `xlsx`)
  - Paste CSV/Excel text (header + rows)
- Auto-generates contract number based on employee code:
  - `MA_NV/YYYY/HĐLĐ-ACE`
- Improved CSV parsing for real-world exports:
  - Detects correct header row even if the file has multiple title rows above the header.
  - Normalizes Vietnamese header characters (`đ/Đ` → `d`) so columns like “Địa chỉ …” map correctly.
  - Normalizes dates from `M/D/YYYY` into `YYYY-MM-DD` for HTML date inputs.
  - Handles duplicate headers by disambiguating keys (e.g., `...__2`) to avoid overwriting (notably duplicated “Điện Thoại”).

Where it lives:

- `src/components/ContractView.jsx`

### 12) Leave/Maternity Attachments + Improved Employee Pickers

- Expanded movement forms to include more HR fields (closer to contract requirements).
- Leave/maternity requests support uploading attachments (stored as in-memory data URLs).
- Employee pickers support filtering by department and searching by employee code.

Where it lives:

- `src/components/PersonnelMovementView.jsx`

### 13) Contract Email Delivery + Multi-Document Generation

- Moved contract creation to a composable flow: Loại HĐ + Vị trí + Thỏa thuận + Cam kết.
- Apps Script Web App accepts a `documents[]` array and emails all generated PDFs in one message.
- Template IDs are hidden; admins paste via prompt only.
- UI shows progress and links; errors list per-file failures.

Where it lives:

- `docs/google-docs-contract/Code.gs`
- `src/components/ContractView.jsx`
- `api/contract.js`

### 14) DOCX Template Generation + In‑App Preview

- Integrated client-side .docx generation using PizZip + Docxtemplater (delimiters `{}` or `{{}}`).
- Added DOCX preview (docx-preview) with default templates and optional per-section selection.
- Supports reviewing all selected documents in one screen.

Where it lives:

- `src/components/ContractView.jsx`
- `public/templates/hdld-ft.docx`

### 15) Branch CSV Import UX Hardened

- Modal actions moved to top; scroll traps removed.
- Branch override for `department`, encoding heuristics, and row selection before apply.

Where it lives:

- `src/components/EmployeeView.jsx`
## Current Data Model (Frontend)

The app is currently state-driven (no central DB yet). Key data arrays:

- `employees`: loaded from seed (`src/data/employees_seed.js`) + local updates.
- `tasks`: task objects used by the kanban/list.
- `movements`: personnel movement requests and history.

## Known Limitations / Design Notes

- Google Sheet integration for “MY TASK” is planned but not implemented.
- Supabase authentication/database is planned but not implemented.
- File uploads for leave/maternity attachments are stored in-memory (data URLs) in movement objects; no permanent storage backend.
- PDF rendering for contract pages 3–4 uses CDN-loaded PDF.js (runtime dependency). For offline/enterprise deployment, bundle PDF.js locally.

### 10.1) PDF Render Hardening

- Adjusted PDF.js loading options to reduce runtime failures on some environments (range/stream fetch).
- If runtime rendering still fails, recommended fallback is pre-rendering pages 3–4 to images and printing images.

## How to Run

This repo is a Vite project.

- If `npm` script execution is blocked on Windows PowerShell due to execution policy, run Vite via Node directly:
  - `node node_modules/vite/bin/vite.js --host --port 3000`

## Where to Extend Next (Recommended)

- Replace seed/localStorage state with Supabase tables and auth.
- Add a persistent file store (Supabase Storage or S3) for contract PDFs and leave documents.
- Implement Google Sheets sync for “MY TASK” via Apps Script + `/api` routes.
- Add robust CSV column mapping UI (admin-configurable) for different branch spreadsheets.
