## Bảng Review (Trước khi Deploy)

### 1) Bảo mật & dữ liệu
| Hạng mục | Trạng thái | Cách kiểm tra | Ghi chú |
|---|---|---|---|
| Repo GitHub để Private | ☐ | GitHub → Settings → General → Change visibility | Khuyến nghị bắt buộc vì có nghiệp vụ nội bộ |
| Không commit `.env*` | ✅ | `.gitignore` có `.env`, `.env.*` | Dùng `.env.example` để hướng dẫn |
| Không có dữ liệu nhân sự thật trong repo | ✅ | `src/data/employees_seed.js` chỉ còn demo | Khi cần seed thật, import qua CSV/DB |
| Không có file hợp đồng/biên bản thật trong `public/` | ✅ | Kiểm tra `public/contracts` | Đã xóa `public/contracts` |
| Không lưu mật khẩu ở localStorage | ✅ | Login chỉ set `saved_username`, không set `saved_password` | Tránh lộ trên máy người dùng |
| Login API không hardcode mật khẩu/token | ✅ | `api/login.js` đọc `APP_ACCOUNTS_JSON` | Token ngẫu nhiên |

### 2) Cấu hình local test (đăng nhập)
| Hạng mục | Trạng thái | Cách làm | Ghi chú |
|---|---|---|---|
| Tạo `.env.local` (local) | ☐ | Thêm `APP_ACCOUNTS_JSON=...` | File này không commit |
| Dev server có `/api/login` | ✅ | `npm run dev` | Vite middleware local-api |
| Preview server có `/api/login` | ✅ | `npm run build` → `npm run preview:local` | Script `preview-with-api.mjs` |

### 3) Smoke test chức năng chính (theo mục tiêu)
| Mục tiêu | Test case | Trạng thái | Cách test nhanh |
|---|---|---|---|
| In hợp đồng | Admin cài template DOCX | ☐ | Vào Hợp đồng → upload template |
| In hợp đồng | Chi nhánh tạo dữ liệu → Review DOCX | ☐ | Chọn nhân sự/nhập tay → Review DOCX |
| In hợp đồng | Tải DOCX (1 file) | ☐ | Nút “Tải DOCX” |
| In hợp đồng | Tải tất cả (batch) | ☐ | Nút “Tải tất cả” |
| Nhân sự | Mở danh sách + xem hồ sơ | ☐ | Nhân sự → Xem chi tiết |
| Nhân sự | Email hiển thị 1 dòng riêng (không đè) | ☐ | Profile → kiểm tra Email/Điện thoại |
| Nhân sự | Sửa lương/BHXH (chi nhánh) | ☐ | Profile → chỉnh & lưu |
| Đánh giá tháng | Import CSV | ☐ | Nhân sự → Đánh giá tháng → Chọn CSV |
| Đánh giá tháng | Gắn điểm vào profile theo tháng | ☐ | Profile → tab ĐÁNH GIÁ THÁNG |

### 4) Kiểm tra code quality
| Hạng mục | Trạng thái | Lệnh |
|---|---|---|
| Lint pass | ✅ | `npm run lint` |
| Unit test pass | ✅ | `npm run test:run` |
| Build pass | ✅ | `npm run build` |

### 5) Chuẩn bị deploy (Vercel + Supabase)
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Env Vercel: `APP_ACCOUNTS_JSON` | ☐ | Set tại Vercel → Redeploy |
| Env Vercel: `VITE_SCRIPT_URL`, `VITE_SYNC_SECRET` (nếu dùng sync) | ☐ | Nếu chưa dùng có thể bỏ trống |
| Supabase (khi triển khai): RLS + policy theo chi nhánh | ☐ | Ưu tiên trước khi đưa dữ liệu thật |

