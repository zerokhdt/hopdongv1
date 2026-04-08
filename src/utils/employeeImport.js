import { findHeaderRowIndex, normalizeHeader, parseCsv, parseDateFlexible, stripLeadingApostrophe, toBooleanLoose } from './csv.js';

function buildHeaderIndex(headers) {
  const idx = new Map();
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (!key) return;
    if (!idx.has(key)) idx.set(key, i);
  });
  return idx;
}

function getCell(row, headerIndex, headerName) {
  const i = headerIndex.get(normalizeHeader(headerName));
  if (i === undefined) return '';
  return row[i] ?? '';
}

function getCellAny(row, headerIndex, headerNames) {
  const list = Array.isArray(headerNames) ? headerNames : [headerNames];
  for (const h of list) {
    const v = getCell(row, headerIndex, h);
    if (String(v || '').trim() !== '') return v;
  }
  return '';
}

function cleanMoney(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return s.replace(/[^\d.,-]/g, '').replace(/,/g, ',');
}

function joinNonEmpty(parts, sep = ' / ') {
  return parts.map(s => String(s || '').trim()).filter(Boolean).join(sep);
}

export function importEmployeesFromCsv(csvText) {
  const raw = String(csvText || '');
  const lines = raw.split(/\r?\n/).slice(0, 5).filter(l => String(l || '').trim() !== '');
  const sample = lines.join('\n');
  const delimCounts = [
    { d: ',', c: (sample.match(/,/g) || []).length },
    { d: ';', c: (sample.match(/;/g) || []).length },
    { d: '\t', c: (sample.match(/\t/g) || []).length },
  ];
  delimCounts.sort((a, b) => b.c - a.c);
  const delimiter = delimCounts[0]?.c > 0 ? delimCounts[0].d : ',';

  const rows = parseCsv(raw, delimiter);
  const headerRowIdx = findHeaderRowIndex(rows, 'Mã NV');
  if (headerRowIdx < 0) {
    return { ok: false, error: 'Không tìm thấy dòng tiêu đề (cột “Mã NV”).' };
  }

  const headers = rows[headerRowIdx] || [];
  const headerIndex = buildHeaderIndex(headers);

  const dataRows = rows.slice(headerRowIdx + 1).filter(r => (r || []).some(c => String(c || '').trim() !== ''));

  const employees = [];
  const errors = [];

  dataRows.forEach((r, rowOffset) => {
    const rowNum = headerRowIdx + 2 + rowOffset;
    const id = stripLeadingApostrophe(getCellAny(r, headerIndex, ['Mã NV', 'Ma NV', 'Mã Nhân Viên', 'Ma Nhan Vien', 'MANV', 'MaNV'])).trim();
    const name = getCellAny(r, headerIndex, ['Họ và Tên', 'Ho va Ten', 'Họ Tên', 'Ho Ten', 'Tên Nhân Viên', 'Ten Nhan Vien']).trim();

    if (!id || !name) {
      errors.push(`Dòng ${rowNum}: thiếu Mã NV hoặc Họ và Tên`);
      return;
    }

    const department = getCellAny(r, headerIndex, [
      'Bộ Phận Làm Việc (Chi Nhánh/Phòng Ban Hệ Thống)',
      'Bộ Phận Làm Việc',
      'Chi Nhánh',
      'Phong Ban',
      'Phòng Ban',
      'Bo Phan',
      'Bộ Phận',
    ]).trim();
    const position = joinNonEmpty([
      getCellAny(r, headerIndex, ['Vị Trí 1', 'Vi Tri 1', 'Vị Trí', 'Vi Tri']),
      getCellAny(r, headerIndex, ['Vị Trí 2', 'Vi Tri 2']),
      getCellAny(r, headerIndex, ['Vị Trí 3', 'Vi Tri 3']),
    ]);

    const employee = {
      id,
      name,
      department,
      position,
      phone: stripLeadingApostrophe(getCellAny(r, headerIndex, ['Điện Thoại', 'Dien Thoai', 'SĐT', 'SDT'])).trim(),
      email: getCellAny(r, headerIndex, ['Email', 'E-mail']).trim(),
      startDate: parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Làm Việc Chính Thức', 'Ngay Lam Viec Chinh Thuc'])) || parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Bắt Đầu Làm Việc', 'Ngay Bat Dau Lam Viec'])),
      probationDate: parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Thử Việc', 'Ngay Thu Viec'])),
      contractDate: parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Ký Hợp Đồng', 'Ngay Ky Hop Dong'])),
      renewDate: parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Tái Ký Hợp Đồng', 'Ngay Tai Ky Hop Dong'])),
      dob: parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Sinh', 'Ngay Sinh'])),
      nationality: getCellAny(r, headerIndex, ['Quốc Tịch', 'Quoc Tich']).trim() || 'Việt Nam',
      address: getCellAny(r, headerIndex, ['Địa Chỉ Thường Trú', 'Dia Chi Thuong Tru']).trim(),
      currentAddress: getCellAny(r, headerIndex, ['Địa Chỉ Tạm Trú', 'Địa Chỉ  Tạm Trú', 'Dia Chi Tam Tru']).trim(),
      cccd: stripLeadingApostrophe(getCellAny(r, headerIndex, ['Số CCCD', 'So CCCD', 'CCCD'])).trim(),
      cccd_date: parseDateFlexible(getCellAny(r, headerIndex, ['Ngày Cấp', 'Ngay Cap'])),
      cccd_place: getCellAny(r, headerIndex, ['Nơi Cấp', 'Noi Cap']).trim(),
      education: getCellAny(r, headerIndex, ['Trình Độ Học Vấn', 'Trinh Do Hoc Van']).trim(),
      major: getCellAny(r, headerIndex, ['Chuyên Ngành', 'Chuyen Nganh']).trim(),
      pedagogyCert: toBooleanLoose(getCellAny(r, headerIndex, ['Chứng Chỉ NVSP', 'Chung Chi NVSP'])) ? 'Có' : '',
      hasCccd: toBooleanLoose(getCellAny(r, headerIndex, ['CCCD'])) ? 'Có' : '',
      hasInsurance: toBooleanLoose(getCellAny(r, headerIndex, ['Đóng BHXH', 'Dong BHXH'])) ? 'Có' : '',
      insuranceAgency: getCellAny(r, headerIndex, ['Cơ Quan Tham Gia BHXH', 'Co Quan Tham Gia BHXH']).trim(),
      salary: cleanMoney(getCellAny(r, headerIndex, ['Tổng Lương (Thỏa Thuận)', 'Tong Luong Thoa Thuan'])) || cleanMoney(getCellAny(r, headerIndex, ['Lương Căn Bản', 'Luong Can Ban'])),
      salaryBase: cleanMoney(getCellAny(r, headerIndex, ['Lương Căn Bản', 'Luong Can Ban'])),
      allowanceHousing: cleanMoney(getCellAny(r, headerIndex, ['Phụ Cấp Chổ Ở', 'Phu Cap Cho O', 'Phụ Cấp Chỗ Ở'])),
      allowanceTravel: cleanMoney(getCellAny(r, headerIndex, ['Phụ Cấp Đi Lại', 'Phu Cap Di Lai'])),
      allowancePhone: cleanMoney(getCellAny(r, headerIndex, ['Phụ Cấp Điện Thoại', 'Phu Cap Dien Thoai'])),
      bankAccount: stripLeadingApostrophe(getCellAny(r, headerIndex, ['Số Tài Khoản', 'So Tai Khoan'])).trim(),
      bankName: getCellAny(r, headerIndex, ['Ngân Hàng', 'Ngan Hang']).trim(),
      taxCode: stripLeadingApostrophe(getCellAny(r, headerIndex, ['Mã Số Thuế', 'Ma So Thue'])).trim(),
      note: getCellAny(r, headerIndex, ['Ghi Chú', 'Ghi Chu', 'GhiChu']).trim(),
      rawStatus: getCellAny(r, headerIndex, ['Trạng Thái', 'Trang Thai']).trim(),
    };

    employees.push(employee);
  });

  if (employees.length === 0) return { ok: false, error: errors[0] || 'CSV không có dòng dữ liệu hợp lệ.' };
  return { ok: true, employees, errors };
}

export function mergeEmployees(existingEmployees, importedEmployees, options = {}) {
  const replaceAll = !!options.replaceAll;
  const overwrite = options.overwrite !== false;

  const existing = Array.isArray(existingEmployees) ? existingEmployees : [];
  const imported = Array.isArray(importedEmployees) ? importedEmployees : [];

  if (replaceAll) {
    return {
      merged: imported.map(e => ({ ...e })),
      stats: { added: imported.length, updated: 0, kept: 0 },
    };
  }

  const byId = new Map();
  existing.forEach(e => {
    if (e && e.id) byId.set(String(e.id), e);
  });

  let added = 0;
  let updated = 0;

  imported.forEach(imp => {
    const key = String(imp.id);
    const cur = byId.get(key);
    if (!cur) {
      byId.set(key, imp);
      added++;
      return;
    }
    byId.set(key, overwrite ? { ...cur, ...imp } : { ...imp, ...cur });
    updated++;
  });

  return {
    merged: Array.from(byId.values()),
    stats: { added, updated, kept: Math.max(0, existing.length - updated) },
  };
}
