import React, { useMemo, useState } from 'react';
import { Printer, Eye, X } from 'lucide-react';
import {
  differenceInMonths,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';

const REPORTS = [
  { id: 'BRANCH', label: 'Báo cáo nhân sự chi nhánh' },
  { id: 'POSITION', label: 'Báo cáo theo chức vụ' },
  { id: 'SENIORITY', label: 'Báo cáo theo thâm niên' },
  { id: 'EDUCATION', label: 'Báo cáo theo bằng cấp' },
  { id: 'CONTRACT_EXPIRING', label: 'HĐ sắp tới hạn trong tháng' },
];

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  return d;
}

function getSeniorityMonths(startDate) {
  const start = parseDate(startDate);
  if (!start) return null;
  const months = differenceInMonths(new Date(), start);
  return Number.isFinite(months) ? Math.max(0, months) : null;
}

function formatSeniority(startDate) {
  const months = getSeniorityMonths(startDate);
  if (months === null) return '---';
  const years = Math.floor(months / 12);
  const remain = months % 12;
  if (years === 0) return `${remain} tháng`;
  if (remain === 0) return `${years} năm`;
  return `${years} năm ${remain} tháng`;
}

function seniorityBucket(months) {
  if (months === null) return 'Chưa có ngày vào';
  if (months < 6) return 'Dưới 6 tháng';
  if (months < 12) return '6–12 tháng';
  if (months < 36) return '1–3 năm';
  if (months < 60) return '3–5 năm';
  return 'Trên 5 năm';
}

function normalizeText(v) {
  return String(v || '').trim();
}

function canonicalPositionKey(v) {
  const t = normalizeText(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.includes('fulltime') || t.includes('full time')) return 'fulltime';
  if (t.includes('thinh gian') || t.includes('thinh giang')) return 'thinh giang';
  return t;
}

function canonicalPositionLabel(v) {
  const key = canonicalPositionKey(v);
  if (key === 'fulltime') return 'Fulltime';
  if (key === 'thinh giang') return 'Thỉnh giảng';
  return normalizeText(v) || 'Chưa cập nhật';
}

function normalizeEducation(v) {
  const t = normalizeText(v);
  if (!t) return 'Chưa cập nhật';
  return t
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .toUpperCase();
}

function normalizeGender(v) {
  const t = normalizeText(v).toLowerCase();
  if (!t) return '---';
  if (/(^|\b)(mr|nam)\b/.test(t)) return 'Nam';
  if (/(^|\b)(ms|mrs|nữ|nu)\b/.test(t)) return 'Nữ';
  return normalizeText(v);
}

export default function PersonnelReportView({ employees = [], branches = [] }) {
  const [reportId, setReportId] = useState('BRANCH');
  const [branch, setBranch] = useState('ALL');
  const [q, setQ] = useState('');

  const [positionFilter, setPositionFilter] = useState('ALL');
  const [educationFilter, setEducationFilter] = useState('ALL');
  const [seniorityFilter, setSeniorityFilter] = useState('ALL');
  const [contractMonth, setContractMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = employees;
    if (branch !== 'ALL') {
      list = list.filter(e => e.department === branch);
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(s) ||
        (e.position || '').toLowerCase().includes(s) ||
        (e.department || '').toLowerCase().includes(s)
      );
    }
    if (positionFilter !== 'ALL') {
      list = list.filter(e => canonicalPositionKey(e.position) === positionFilter);
    }
    if (educationFilter !== 'ALL') {
      list = list.filter(e => normalizeEducation(e.education) === educationFilter);
    }
    if (seniorityFilter !== 'ALL') {
      list = list.filter(e => seniorityBucket(getSeniorityMonths(e.startDate)) === seniorityFilter);
    }
    return list;
  }, [employees, branch, q, positionFilter, educationFilter, seniorityFilter]);

  const positionOptions = useMemo(() => {
    const map = new Map();
    employees.forEach(e => {
      const key = canonicalPositionKey(e.position);
      if (!key) return;
      if (!map.has(key)) map.set(key, canonicalPositionLabel(e.position));
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [employees]);

  const educationOptions = useMemo(() => {
    const set = new Set();
    employees.forEach(e => {
      set.add(normalizeEducation(e.education));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const seniorityOptions = useMemo(() => {
    const buckets = new Set();
    employees.forEach(e => buckets.add(seniorityBucket(getSeniorityMonths(e.startDate))));
    const order = ['Dưới 6 tháng', '6–12 tháng', '1–3 năm', '3–5 năm', 'Trên 5 năm', 'Chưa có ngày vào'];
    return Array.from(buckets).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [employees]);

  const contractExpiringList = useMemo(() => {
    const [y, m] = contractMonth.split('-').map(Number);
    if (!y || !m) return [];
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(start);

    return filtered
      .map(e => {
        const renew = parseDate(e.renewDate);
        return { e, renew };
      })
      .filter(x => x.renew && x.renew >= start && x.renew <= end)
      .sort((a, b) => a.renew - b.renew);
  }, [filtered, contractMonth]);

  const positionSummary = useMemo(() => {
    const map = new Map();
    filtered.forEach(e => {
      const key = canonicalPositionLabel(e.position);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, count: v }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [filtered]);

  const senioritySummary = useMemo(() => {
    const map = new Map();
    filtered.forEach(e => {
      const key = seniorityBucket(getSeniorityMonths(e.startDate));
      map.set(key, (map.get(key) || 0) + 1);
    });
    const order = ['Dưới 6 tháng', '6–12 tháng', '1–3 năm', '3–5 năm', 'Trên 5 năm', 'Chưa có ngày vào'];
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, count: v }))
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [filtered]);

  const educationSummary = useMemo(() => {
    const map = new Map();
    filtered.forEach(e => {
      const key = normalizeEducation(e.education);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, count: v }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [filtered]);

  const groupedByPosition = useMemo(() => {
    const map = new Map();
    filtered.forEach(e => {
      const key = canonicalPositionLabel(e.position);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.entries())
      .map(([key, list]) => ({
        position: key,
        employees: list
          .slice()
          .sort((a, b) => (a.department || '').localeCompare(b.department || '') || (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => b.employees.length - a.employees.length || a.position.localeCompare(b.position));
  }, [filtered]);

  const reportTitle = useMemo(() => {
    const base = REPORTS.find(r => r.id === reportId)?.label || 'Báo cáo nhân sự';
    if (branch === 'ALL') return base;
    return `${base} - ${branch}`;
  }, [reportId, branch]);

  const handlePrint = () => window.print();

  const reportBody = (
    <div className="p-10 min-w-[900px] mx-auto bg-white">
      <div className="flex justify-between items-start mb-10 border-b-8 border-slate-900 pb-8">
        <div className="flex items-center gap-6">
          <img src="/ace-logo.svg" alt="ACE" className="w-20 h-20 rounded-2xl shadow-xl bg-white" />
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">{reportTitle}</h1>
            <p className="text-base font-bold text-[#E11920] tracking-[0.3em] uppercase mt-2">ACE HRM</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ngày lập</p>
          <p className="text-sm font-black text-slate-900">{format(new Date(), 'dd/MM/yyyy')}</p>
          <p className="text-xs font-bold text-slate-500 mt-2">Tổng số: {filtered.length}</p>
        </div>
      </div>

      {reportId === 'BRANCH' && (
        <table className="w-full text-left border-collapse border border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-10">STT</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Họ và Tên</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Chức vụ</th>
              {branch === 'ALL' && <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Chi nhánh</th>}
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Ngày vào</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Thâm niên</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Bằng cấp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {filtered.map((emp, idx) => (
              <tr key={emp.id}>
                <td className="px-3 py-3 text-xs font-bold text-slate-500 border border-slate-900 text-center">{idx + 1}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900">{emp.name}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-600 border border-slate-900 uppercase">{emp.position || '---'}</td>
                {branch === 'ALL' && <td className="px-4 py-3 text-xs font-bold text-slate-600 border border-slate-900">{emp.department || '---'}</td>}
                <td className="px-4 py-3 text-xs font-medium text-slate-600 border border-slate-900">{emp.startDate || '---'}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600 border border-slate-900">{formatSeniority(emp.startDate)}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600 border border-slate-900">{normalizeEducation(emp.education)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportId === 'POSITION' && (
        <table className="w-full text-left border-collapse border border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-10">STT</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Chức vụ</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-28">Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {positionSummary.map((row, idx) => (
              <tr key={row.key}>
                <td className="px-3 py-3 text-xs font-bold text-slate-500 border border-slate-900 text-center">{idx + 1}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900">{row.key}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900 text-center">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportId === 'SENIORITY' && (
        <table className="w-full text-left border-collapse border border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-10">STT</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Nhóm thâm niên</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-28">Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {senioritySummary.map((row, idx) => (
              <tr key={row.key}>
                <td className="px-3 py-3 text-xs font-bold text-slate-500 border border-slate-900 text-center">{idx + 1}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900">{row.key}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900 text-center">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportId === 'EDUCATION' && (
        <table className="w-full text-left border-collapse border border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-10">STT</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Bằng cấp</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-28">Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {educationSummary.map((row, idx) => (
              <tr key={row.key}>
                <td className="px-3 py-3 text-xs font-bold text-slate-500 border border-slate-900 text-center">{idx + 1}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900">{row.key}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900 text-center">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reportId === 'CONTRACT_EXPIRING' && (
        <table className="w-full text-left border-collapse border border-slate-900">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900 w-10">STT</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Họ và Tên</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Chức vụ</th>
              {branch === 'ALL' && <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Chi nhánh</th>}
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Ngày tái ký</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider border border-slate-900">Ngày ký HĐ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {contractExpiringList.map((row, idx) => (
              <tr key={row.e.id}>
                <td className="px-3 py-3 text-xs font-bold text-slate-500 border border-slate-900 text-center">{idx + 1}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-900">{row.e.name}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-600 border border-slate-900 uppercase">{row.e.position || '---'}</td>
                {branch === 'ALL' && <td className="px-4 py-3 text-xs font-bold text-slate-600 border border-slate-900">{row.e.department || '---'}</td>}
                <td className="px-4 py-3 text-xs font-black text-slate-800 border border-slate-900">{row.e.renewDate || '---'}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600 border border-slate-900">{row.e.contractDate || '---'}</td>
              </tr>
            ))}
            {contractExpiringList.length === 0 && (
              <tr>
                <td colSpan={branch === 'ALL' ? 6 : 5} className="px-6 py-10 text-center text-slate-400 border border-slate-900">
                  Không có hợp đồng tới hạn trong tháng {contractMonth}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="mt-10">
        <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Danh sách chi tiết (gộp theo chức vụ)</div>
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          {groupedByPosition.map(group => (
            <div key={group.position} className="border-b border-slate-100 last:border-b-0">
              <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                <div className="text-sm font-black text-slate-800 uppercase">{group.position}</div>
                <div className="text-xs font-black text-slate-500">{group.employees.length} nhân sự</div>
              </div>
              <div className="px-4 py-3 text-xs text-slate-700">
                <div className="grid grid-cols-1 gap-1">
                  {group.employees.map(e => (
                    <div key={e.id} className="flex flex-wrap gap-x-2">
                      <span className="font-black">{e.department || '---'}</span>
                      <span className="text-slate-400">-</span>
                      <span className="font-bold">{normalizeGender(e.title)}</span>
                      <span className="text-slate-400">-</span>
                      <span className="font-bold">{e.name || '---'}</span>
                      <span className="text-slate-400">-</span>
                      <span className="font-bold">{normalizeEducation(e.education)}</span>
                      <span className="text-slate-400">-</span>
                      <span className="font-bold">{formatSeniority(e.startDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {groupedByPosition.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-400">Không có dữ liệu để hiển thị.</div>
          )}
        </div>
      </div>

      <div className="mt-12 text-center text-[10px] text-[#E11920] font-bold uppercase tracking-[0.5em] border-t border-slate-100 pt-8">
        ACE HRM
      </div>
    </div>
  );

  const openReview = () => setIsReviewOpen(true);
  const closeReview = () => setIsReviewOpen(false);

  return (
    <div className="h-full flex flex-col bg-[#F2F4F7] p-6 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 print:hidden">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Báo cáo HRM</h2>
              <p className="text-slate-500 text-sm">Tạo nhanh báo cáo để in ngay khi có yêu cầu</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openReview}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-black text-xs tracking-widest shadow-sm hover:bg-slate-50"
              >
                <Eye size={18} /> XEM TRƯỚC
              </button>
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl flex items-center gap-2 transition-all font-black text-xs tracking-widest shadow-lg shadow-blue-200"
              >
                <Printer size={18} /> IN PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loại báo cáo</label>
              <select
                value={reportId}
                onChange={e => setReportId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {REPORTS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chi nhánh</label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">Tất cả</option>
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tìm nhanh</label>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Tên / chức vụ / chi nhánh"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tháng HĐ</label>
              <input
                type="month"
                value={contractMonth}
                onChange={e => setContractMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức vụ</label>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">Tất cả</option>
                {positionOptions.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thâm niên</label>
              <select
                value={seniorityFilter}
                onChange={e => setSeniorityFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">Tất cả</option>
                {seniorityOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bằng cấp</label>
              <select
                value={educationFilter}
                onChange={e => setEducationFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">Tất cả</option>
                {educationOptions.map(ed => (
                  <option key={ed} value={ed}>{ed}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto print:border-none print:shadow-none print:bg-white">
        {reportBody}
      </div>

      {isReviewOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/ace-logo.svg" alt="ACE" className="w-10 h-10 rounded-xl" />
                <div>
                  <div className="text-sm font-black text-slate-900">Xem trước báo cáo</div>
                  <div className="text-xs font-bold text-slate-400">{reportTitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-black text-xs tracking-widest"
                >
                  <Printer size={16} /> IN PDF
                </button>
                <button
                  onClick={closeReview}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Đóng"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              {reportBody}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
