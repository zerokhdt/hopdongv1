## 2026-03-30

- Chuyển hoàn toàn sang hướng DOCX:
  - Gỡ Google Apps Script PDF/email; xoá `/api/contract` proxy và endpoint.
  - Preview/Export DOCX dùng Docxtemplater + docx-preview.
  - Chỉ Admin được cài Template DOCX (IndexedDB); chi nhánh chỉ dùng.
- Module mới: Đánh giá nhân sự theo tháng
  - Màn hình nhập CSV, chọn cột điểm, lưu theo Chi nhánh + Tháng.
  - Bổ sung hiển thị “Đánh giá gần đây” và tab “ĐÁNH GIÁ THÁNG” trong hồ sơ nhân sự.
- UI/UX
  - Email hồ sơ chuyển sang 1 dòng riêng, hỗ trợ xuống hàng cho địa chỉ dài.
- Chất lượng
  - Thêm Vitest + Testing Library, 4 test cơ bản (App, ContractView, EmployeeView).
  - Chuẩn hoá eslint (node cho api/vite, vitest globals, rule cleanup).

