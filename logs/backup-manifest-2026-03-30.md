Date: 2026-03-30
Type: Snapshot manifest (source tree)

Key changes since previous snapshot:
- src/components/ContractView.jsx: bỏ HTML preview, thêm review/tải DOCX; phân quyền admin cài template
- vite.config.js: bỏ proxy /api/contract; thêm cấu hình test
- src/App.jsx: sửa hooks, thêm route MonthlyEvaluationView
- src/components/EmployeeView.jsx: mở chỉnh lương/BHXH cho chi nhánh; thêm hiển thị đánh giá tháng; email 1 dòng riêng
- src/components/MonthlyEvaluationView.jsx: module nhập CSV đánh giá và lưu theo tháng
- eslint.config.js: cập nhật môi trường + rule
- Thêm test: src/App.test.jsx, src/components/ContractView.test.jsx, src/components/EmployeeView.test.jsx

Note:
- Nếu cần gói ZIP, chạy lệnh (PowerShell) tại thư mục dự án:
  $ts = Get-Date -Format yyyyMMdd-HHmmss
  if (!(Test-Path '.backups')) { New-Item -ItemType Directory '.backups' | Out-Null }
  $items = Get-ChildItem -Force | Where-Object { $_.Name -ne '.backups' -and $_.Name -ne 'dist' }
  Compress-Archive -Path $items -DestinationPath (\".backups\\backup-$ts.zip\") -CompressionLevel Optimal -Force

