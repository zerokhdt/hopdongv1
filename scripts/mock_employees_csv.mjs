import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../src/utils/csv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = process.argv[2];
const outputPath = process.argv[3] || path.join(process.cwd(), 'demo_nhan_su_mock.csv');

if (!inputPath) {
  process.stderr.write('Usage: node scripts/mock_employees_csv.mjs <input.csv> [output.csv]\n');
  process.exit(1);
}

const inputAbs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
const outputAbs = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function randInt(seed, min, max) {
  const x = (seed * 1664525 + 1013904223) >>> 0;
  const r = x / 4294967296;
  return Math.floor(min + r * (max - min + 1));
}

const NAMES = {
  maleFirst: ['ANH', 'BẢO', 'CƯỜNG', 'DUY', 'DŨNG', 'HẢI', 'HIẾU', 'KHÁNH', 'KIÊN', 'LÂM', 'MINH', 'NAM', 'PHÁT', 'PHONG', 'QUÂN', 'SƠN', 'THÀNH', 'THẮNG', 'TRUNG', 'TUẤN', 'VINH'],
  femaleFirst: ['AN', 'ANH', 'BÍCH', 'CHI', 'DIỆU', 'GIANG', 'HIỀN', 'HƯƠNG', 'LAN', 'LINH', 'MAI', 'NGÂN', 'NGỌC', 'NHI', 'NHƯ', 'PHƯƠNG', 'QUỲNH', 'THẢO', 'THU', 'TRANG', 'VÂN', 'YẾN'],
  mid: ['THỊ', 'VĂN', 'HỒNG', 'NGỌC', 'THUỲ', 'MINH', 'KHÁNH', 'ĐỨC', 'QUỐC', 'TUẤN'],
  last: ['NGUYỄN', 'TRẦN', 'LÊ', 'PHẠM', 'HUỲNH', 'VÕ', 'ĐẶNG', 'BÙI', 'ĐỖ', 'DƯƠNG', 'HOÀNG', 'PHAN', 'VŨ', 'TRƯƠNG', 'TẠ', 'TÔ', 'ĐINH', 'NGÔ'],
};

function makeName(gender, seed) {
  const l1 = pick(NAMES.last, seed);
  const l2 = pick(NAMES.last, seed >>> 3);
  const m = pick(NAMES.mid, seed >>> 5);
  const f = gender === 'Nam' ? pick(NAMES.maleFirst, seed >>> 7) : pick(NAMES.femaleFirst, seed >>> 7);
  const useTwoLast = seed % 5 === 0;
  return [l1, useTwoLast ? l2 : null, m, f].filter(Boolean).join(' ');
}

function fmtDigits(seed, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String(randInt(seed >>> i, 0, 9));
  if (s[0] === '0') s = '1' + s.slice(1);
  return s;
}

function fmtPhone(seed) {
  const prefixes = ['03', '05', '07', '08', '09'];
  const p = prefixes[seed % prefixes.length];
  let n = '';
  for (let i = 0; i < 8; i++) n += String(randInt(seed >>> i, 0, 9));
  return p + n;
}

function fmtPhoneSpaced(phone) {
  const s = String(phone);
  if (s.length !== 10) return s;
  return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`;
}

function parseMoney(s) {
  const digits = String(s || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return n;
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Math.max(0, Math.round(Number(n)));
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function mockMoneyLike(orig, seed) {
  const n = parseMoney(orig);
  if (n === null) return String(orig || '');
  const factor = 0.75 + ((seed % 500) / 1000);
  const noise = randInt(seed >>> 9, -150000, 150000);
  const out = Math.max(0, Math.round((n * factor + noise) / 1000) * 1000);
  return fmtMoney(out);
}

function parseMDY(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yy = Number(m[3]);
  const d = new Date(yy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtMDY(d) {
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yy = d.getFullYear();
  return `${mm}/${dd}/${yy}`;
}

function shiftDateLike(orig, seed) {
  const d = parseMDY(orig);
  if (!d) return String(orig || '');
  const delta = randInt(seed >>> 11, -180, 180);
  const out = new Date(d.getTime() + delta * 86400000);
  return fmtMDY(out);
}

function makeEmail(name, id) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40);
  return `${base}.${id}@example.com`;
}

function makeAddress(seed) {
  const streets = ['Lê Lợi', 'Quang Trung', 'Nguyễn Trãi', 'Lý Thường Kiệt', 'Phan Văn Trị', 'Tô Ký', 'Trường Chinh', 'Cộng Hòa', 'Lê Văn Khương', 'Hà Đặc'];
  const wards = ['Phường 1', 'Phường 10', 'Phường 12', 'Phường Tân Chánh Hiệp', 'Phường Trung Mỹ Tây', 'Phường Đông Hưng Thuận'];
  const no = randInt(seed, 10, 999);
  const hx = randInt(seed >>> 1, 1, 200);
  const st = pick(streets, seed >>> 2);
  const w = pick(wards, seed >>> 4);
  return `${no}/${hx} ${st}, ${w}, TP.HCM`;
}

function escapeCell(s, delimiter = ',') {
  const v = String(s ?? '');
  const needsQuotes = v.includes('"') || v.includes('\n') || v.includes('\r') || v.includes(delimiter);
  if (!needsQuotes) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

const raw = await fs.readFile(inputAbs, 'utf8');
const rows = parseCsv(raw, ',');
if (!rows || rows.length < 2) throw new Error('CSV không có dữ liệu');

const header = rows[0];
const data = rows.slice(1);
const headerIndex = new Map();
header.forEach((h, i) => {
  const key = String(h || '').trim();
  if (!headerIndex.has(key)) headerIndex.set(key, []);
  headerIndex.get(key).push(i);
});

const colFirst = (name) => (headerIndex.get(name) || [])[0];
const colLast = (name) => {
  const list = headerIndex.get(name) || [];
  return list.length ? list[list.length - 1] : undefined;
};

const outRows = [header];
let nextIdNum = 20000;

for (let r = 0; r < data.length; r++) {
  const row = data[r].slice();
  while (row.length < header.length) row.push('');

  const seedBase = hashStr(row.join('|') + '|' + r);
  nextIdNum += 1;
  const newId = String(nextIdNum).padStart(5, '0');

  const genderCol = colFirst('Giới Tính');
  const gender = genderCol !== undefined ? String(row[genderCol] || '').trim() : '';
  const g = gender === 'Nam' ? 'Nam' : 'Nữ';

  const newName = makeName(g, seedBase);
  const email = makeEmail(newName, newId);
  const phoneCol = colFirst('Điện Thoại');
  const origPhone = phoneCol !== undefined ? String(row[phoneCol] || '').trim() : '';
  const phoneSeed = hashStr(newId + '|phone');
  let phone = fmtPhone(phoneSeed);
  if (origPhone && phone.replace(/\D/g, '') === origPhone.replace(/\D/g, '')) {
    phone = fmtPhone(phoneSeed + 1);
  }
  const phone2 = fmtPhoneSpaced(fmtPhone(hashStr(newId + '|phone2')));
  const cccd = fmtDigits(seedBase >>> 2, 12);
  const bhxh = fmtDigits(seedBase >>> 3, 10);
  const tax = fmtDigits(seedBase >>> 4, 10);
  const bank = fmtDigits(seedBase >>> 5, 9);

  const setIfCol = (name, valueFn) => {
    const i = colFirst(name);
    if (i === undefined) return;
    const orig = String(row[i] ?? '');
    if (orig.trim() === '') return;
    row[i] = valueFn(orig);
  };

  const setIfColIndex = (index, valueFn) => {
    if (index === undefined) return;
    const orig = String(row[index] ?? '');
    if (orig.trim() === '') return;
    row[index] = valueFn(orig);
  };

  setIfCol('Mã NV', () => newId);
  setIfCol('Họ và Tên', () => newName);
  setIfCol('Chủ Tài Khoản', () => newName);

  setIfCol('Email', () => email);
  setIfCol('Tên Đăng Nhập', () => email);
  setIfCol('Mật Khẩu', () => '123456');

  setIfColIndex(phoneCol, () => phone);
  setIfCol('Điện thoại Cha Mẹ/Vợ Chồng', (orig) => (orig.trim() ? phone2 : orig));

  setIfCol('Số CCCD', (orig) => (orig.trim().startsWith("'") ? "'" + cccd : cccd));
  setIfCol('Mã Số BHXH', (orig) => (orig.trim().startsWith("'") ? "'" + bhxh : bhxh));
  setIfCol('Mã Số Thuế', (orig) => (orig.trim().startsWith("'") ? "'" + tax : tax));

  setIfCol('Số Tài Khoản', () => bank);

  setIfCol('Địa Chỉ Thường Trú', () => makeAddress(seedBase));
  setIfCol('Địa Chỉ  Tạm Trú', (orig) => (orig.trim() ? makeAddress(seedBase >>> 6) : orig));

  setIfCol('Ngày Sinh', (orig) => shiftDateLike(orig, seedBase));
  setIfCol('Ngày Cấp', (orig) => shiftDateLike(orig, seedBase >>> 7));
  setIfCol('Ngày Bắt Đầu Làm Việc', (orig) => shiftDateLike(orig, seedBase >>> 8));
  setIfCol('Ngày Thử Việc', (orig) => shiftDateLike(orig, seedBase >>> 9));
  setIfCol('Ngày Làm Việc Chính Thức', (orig) => shiftDateLike(orig, seedBase >>> 10));
  setIfCol('Ngày Ký Hợp Đồng', (orig) => shiftDateLike(orig, seedBase >>> 11));
  setIfCol('Ngày Tái Ký Hợp Đồng', (orig) => shiftDateLike(orig, seedBase >>> 12));

  setIfCol('Lương Căn Bản', (orig) => mockMoneyLike(orig, seedBase));
  setIfCol('Số Tiền / Giờ', (orig) => mockMoneyLike(orig, seedBase >>> 13));
  setIfCol('Nhà Ở', (orig) => mockMoneyLike(orig, seedBase >>> 14));
  setIfCol('Xăng Xe', (orig) => mockMoneyLike(orig, seedBase >>> 15));
  setIfColIndex(colLast('Điện Thoại'), (orig) => mockMoneyLike(orig, seedBase >>> 16));
  setIfCol('Tổng Lương (Thỏa Thuận)', (orig) => mockMoneyLike(orig, seedBase >>> 17));

  outRows.push(row);
}

const delimiter = ',';
const outText = outRows.map(r => r.map(c => escapeCell(c, delimiter)).join(delimiter)).join('\r\n');
await fs.writeFile(outputAbs, outText, 'utf8');

process.stdout.write(`OK\\nInput: ${inputAbs}\\nOutput: ${outputAbs}\\nRows: ${outRows.length - 1}\\n`);
