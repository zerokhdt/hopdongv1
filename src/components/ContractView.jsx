import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, CheckCircle2, ChevronDown, AlertCircle, Loader2, X, Printer } from 'lucide-react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { renderAsync } from 'docx-preview';
import { apiFetch } from '../utils/api.js';
import { supabase } from '../utils/supabase';

// ─── Cấu hình Template Tài Liệu ───────────────────────────────────────────────
const DOCUMENT_TEMPLATES = [
  {
    id: 'hop-dong', type: 'contract',
    variants: [
      { 
        id: 'hd-fulltime', label: 'Full-time',  desc: 'HĐ lao động không xác định thời hạn',
        useTemplate: false
      },
      { id: 'hd-cohưu',    label: 'Cơ hữu',     desc: 'Thỏa thuận công việc (Cơ hữu)', docId: 'TTCV-CH-001' },
      { id: 'hd-parttime', label: 'Part-time',  desc: 'HĐ lao động bán thời gian', docId: 'REPLACE_DOC_ID_2' },
      { id: 'hd-thuviec',  label: 'Thử việc',   desc: 'HĐ thử việc',             docId: 'REPLACE_DOC_ID_3' },
    ],
  },
  {
    id: 'phu-luc', type: 'appendix',
    variants: [
      { id: 'pl-luong',  label: 'Thay đổi lương',   desc: 'Điều chỉnh mức lương & phụ cấp', docId: 'REPLACE_DOC_ID_5' },
      { id: 'pl-chucvu', label: 'Thay đổi chức vụ', desc: 'Điều chuyển vị trí công tác',     docId: 'REPLACE_DOC_ID_6' },
    ],
  },
];

// ─── Trường thông tin hợp đồng ────────────────────────────────────────────────
const CONTRACT_FIELDS = [
  { key: 'ma_nv',         label: 'Mã NV',               placeholder: '00848',            required: false },
  { key: 'so_hd',         label: 'Số Hợp Đồng',         placeholder: '01/2026/ACE',      required: true },
  { key: 'ho_ten',        label: 'Họ và Tên',           placeholder: 'NGUYỄN VĂN A',     required: true },
  { key: 'quoc_tich',     label: 'Quốc tịch',           placeholder: 'Việt Nam',         required: true },
  { key: 'ngay_sinh',     label: 'Sinh ngày',           placeholder: '',                 required: true,  type: 'date' },
  { key: 'noi_sinh',      label: 'Nơi sinh',            placeholder: 'TP. Hồ Chí Minh',  required: true },
  { key: 'cccd',          label: 'Số CCCD / CMND',      placeholder: '0123456789',       required: true },
  { key: 'ngay_cap',      label: 'Ngày cấp CCCD',       placeholder: '',                 required: true,  type: 'date' },
  { key: 'noi_cap',       label: 'Nơi cấp CCCD',        placeholder: 'Cục CS QLHC...',   required: true },
  { key: 'so_dien_thoai', label: 'Số điện thoại',       placeholder: '090xxxxxxx',       required: true },
  { key: 'email',         label: 'Email',               placeholder: 'name@gmail.com',  required: false },
  { key: 'dia_chi',       label: 'Thường trú',          placeholder: 'Số nhà, đường...',  required: true },
  { key: 'tam_tru',       label: 'Tạm trú',             placeholder: 'Địa chỉ hiện tại', required: true },
  { key: 'chuc_vu',       label: 'Chức danh chuyên môn', placeholder: 'Giáo viên...',     required: true },
  { key: 'tu_ngay',       label: 'Làm việc từ ngày',    placeholder: '',                 required: true,  type: 'date' },
  { key: 'den_ngay',      label: 'Đến ngày',            placeholder: 'dd/mm/yyyy',       required: false },
  { key: 'luong',         label: 'Mức lương (số)',      placeholder: '10.000.000',       required: true },
  { key: 'luong_chu',     label: 'Mức lương (chữ)',     placeholder: 'Mười triệu đồng',  required: true },
  { key: 'phu_cap_cho_o',  label: 'Phụ cấp chỗ ở',       placeholder: '0',                required: false },
  { key: 'phu_cap_di_lai', label: 'Phụ cấp đi lại',      placeholder: '0',                required: false },
  { key: 'phu_cap_dt',     label: 'Phụ cấp điện thoại',  placeholder: '0',                required: false },
  { key: 'ngay_ky',       label: 'Ngày ký HĐ',          placeholder: 'dd/mm/yyyy',       required: true },
];

function parseMoneyToNumber(v) {
  const s = String(v || '').replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '').trim();
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function formatMoneyDots(v) {
  const digits = String(v || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const cleaned = digits.replace(/^0+(?=\d)/, '');
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function isIsoDateString(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
}

function parseDdMmYyyyToIso(text) {
  const raw = String(text || '').trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (yyyy < 1900 || yyyy > 2100) return '';
  if (mm < 1 || mm > 12) return '';
  if (dd < 1 || dd > 31) return '';
  const dt = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(dt.getTime())) return '';
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return '';
  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function isoToDdMmYyyy(iso) {
  if (!isIsoDateString(iso)) return '';
  const [yyyy, mm, dd] = String(iso).split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateVN(val) {
  if (!val) return '';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return String(val);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dt.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function soHdBase(val) {
  const s = String(val || '').trim();
  return s.replace(/\/\s*(HĐLĐ-ACE|HDLD-ACE)\s*$/i, '').trim();
}

function formatDateVNLong(val) {
  if (!val) return '';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return String(val);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dt.getFullYear());
  return `${dd} tháng ${mm} năm ${yyyy}`;
}

function dateParts(val) {
  if (!val) return { d: '', m: '', y: '' };
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return { d: '', m: '', y: '' };
  return {
    d: String(dt.getDate()).padStart(2, '0'),
    m: String(dt.getMonth() + 1).padStart(2, '0'),
    y: String(dt.getFullYear()),
  };
}

function buildGoogleContractPlaceholders(data) {
  const ky = dateParts(data.ngay_ky);
  const tu = dateParts(data.tu_ngay);
  const den = dateParts(data.den_ngay);
  const sinh = dateParts(data.ngay_sinh);
  const cap = dateParts(data.ngay_cap);
  const chiNhanh = String(localStorage.getItem('user_branch') || '').trim();
  const diaChi = data.dia_chi || '';
  return {
    CHI_NHANH: chiNhanh,
    VI_TRI: data.chuc_vu || '',
    SO_HD: soHdBase(data.so_hd),
    MA_NV: data.ma_nv || '',
    HO_TEN: data.ho_ten || '',
    QUOC_TICH: data.quoc_tich || '',
    NGAY_SINH: formatDateVN(data.ngay_sinh),
    NGAY_SINH_D: sinh.d,
    NGAY_SINH_M: sinh.m,
    NGAY_SINH_Y: sinh.y,
    NGAY_SINH_LONG: formatDateVNLong(data.ngay_sinh),
    NOI_SINH: data.noi_sinh || '',
    CCCD: data.cccd || '',
    NGAY_CAP: formatDateVN(data.ngay_cap),
    NGAY_CAP_D: cap.d,
    NGAY_CAP_M: cap.m,
    NGAY_CAP_Y: cap.y,
    NGAY_CAP_LONG: formatDateVNLong(data.ngay_cap),
    NOI_CAP: data.noi_cap || '',
    DIEN_THOAI: data.so_dien_thoai || '',
    EMAIL: data.email || '',
    DIA_CHI: diaChi,
    DIA_CHI_THUONG_TRU: diaChi,
    DIA_CHI_TAM_TRU: data.tam_tru || '',
    CHUC_DANH: data.chuc_vu || '',
    TU_NGAY: formatDateVN(data.tu_ngay),
    TU_NGAY_D: tu.d,
    TU_NGAY_M: tu.m,
    TU_NGAY_Y: tu.y,
    TU_NGAY_LONG: formatDateVNLong(data.tu_ngay),
    DEN_NGAY: formatDateVN(data.den_ngay),
    DEN_NGAY_D: den.d,
    DEN_NGAY_M: den.m,
    DEN_NGAY_Y: den.y,
    DEN_NGAY_LONG: formatDateVNLong(data.den_ngay),
    NGAY_KY: formatDateVN(data.ngay_ky),
    NGAY_KY_D: ky.d,
    NGAY_KY_M: ky.m,
    NGAY_KY_Y: ky.y,
    NGAY_KY_LONG: formatDateVNLong(data.ngay_ky),
    LUONG: data.luong || '',
    LUONG_CHU: data.luong_chu || '',
    PC_CHO_O: data.phu_cap_cho_o || '0',
    PC_DI_LAI: data.phu_cap_di_lai || '0',
    PC_DIEN_THOAI: data.phu_cap_dt || '0',
  };
}

function makeSafeFileName(s) {
  return String(s || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function slugBranchNoDiacritics(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 50);
}

function computeIssueKey({ branch, soHd, ngayKy }) {
  const branchSlug = slugBranchNoDiacritics(branch);
  const year = String((ngayKy || '').slice(0, 4) || new Date().getFullYear());
  const soBase = soHdBase(soHd) || soHd;
  const soForFile = String(soBase || '').replace(/[\\/:*?"<>|\\s]+/g, '');
  return makeSafeFileName(`${branchSlug}_${soForFile}_${year}`);
}

function appendContractIssueLogLocal(entry) {
  const row = {
    id: `ISSUE_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    username: String(localStorage.getItem('saved_username') || '').trim(),
    role: String(localStorage.getItem('user_role') || '').trim(),
    branch: String(localStorage.getItem('user_branch') || '').trim(),
    workflowStage: 1,
    workflowStatus: 'INITIALIZED',
    auditTrail: [{ 
      action: 'Khởi tạo hợp đồng', 
      time: new Date().toISOString(), 
      user: String(localStorage.getItem('saved_username') || 'system') 
    }],
    ...entry,
  };
  try {
    const key = 'ace_contract_issue_log_v1';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const next = Array.isArray(existing) ? existing : [];
    next.unshift(row);
    if (next.length > 1000) next.length = 1000;
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('ace_workflow_updated'));
  } catch (_e) {}
}

function postContractIssueLog(entry) {
  try {
    const token = String(localStorage.getItem('token') || '').trim();
    if (!token) return;
    apiFetch('/api/contracts/issue-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(entry || {}),
    }).catch(() => {});
  } catch (_e) {}
}

function normalizeTemplateTitle(name) {
  return String(name || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^\s*\d+\s*\.\s*/g, '')
    .replace(/^\s*\d+\s*-\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyTemplateTitle(title) {
  return normalizeTemplateTitle(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function getTotalHdDocxUrlFromLabel(label) {
  const slug = slugifyTemplateTitle(label);
  if (!slug) return '';
  return `/templates/total_hd/${slug}.docx`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDocxtemplaterData(data) {
  const google = buildGoogleContractPlaceholders(data);
  const chiNhanh = String(localStorage.getItem('user_branch') || '').trim();
  return {
    ...google,
    Ho_Ten: data.ho_ten || '',
    Dia_Chi: google.DIA_CHI || '',
    Den_Ngay: google.DEN_NGAY || '',
    Den_Ngay_Long: google.DEN_NGAY_LONG || '',
    Chi_Nhanh: chiNhanh,
    Vi_Tri: data.chuc_vu || '',
    CCCD: data.cccd || '',
    Dien_Thoai: data.so_dien_thoai || '',
    Email: data.email || '',
  };
}

function detectDocxDelimiters(zip) {
  try {
    const f = zip.file('word/document.xml');
    const xml = f ? f.asText() : '';
    if (xml && xml.indexOf('{{') !== -1 && xml.indexOf('}}') !== -1) return { start: '{{', end: '}}' };
  } catch (_) {}
  return { start: '{', end: '}' };
}

function createDocxFromArrayBuffer(buf, data) {
  const zip = new PizZip(buf);
  const delimiters = detectDocxDelimiters(zip);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters,
    nullGetter: () => '',
  });
  doc.setData(buildDocxtemplaterData(data));
  doc.render();
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

async function createDocxFromTemplateFile(templateFile, data, outputName) {
  const buf = await templateFile.arrayBuffer();
  const blob = createDocxFromArrayBuffer(buf, data);
  const name = String(outputName || '').trim() || 'ACE_HOP_DONG';
  saveAs(blob, name.toLowerCase().endsWith('.docx') ? name : `${name}.docx`);
}

async function createDocxFromTemplateUrl(templateUrl, data, outputName) {
  const resp = await fetch(templateUrl, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Không tải được template .docx');
  const buf = await resp.arrayBuffer();
  const blob = createDocxFromArrayBuffer(buf, data);
  const name = String(outputName || '').trim() || 'ACE_HOP_DONG';
  saveAs(blob, name.toLowerCase().endsWith('.docx') ? name : `${name}.docx`);
}

const WORKFLOW_STAGES = [
  { id: 1, label: 'GĐ 1: Khởi tạo & NV Ký', icon: '👤', color: 'indigo' },
  { id: 2, label: 'GĐ 2: Lãnh đạo ký & Đóng mộc', icon: '🏛️', color: 'emerald' },
  { id: 3, label: 'GĐ 3: Hoàn tất & Link Profile', icon: '✅', color: 'green' },
];

function WorkflowAuditTrail({ logs }) {
  return (
    <div className="mt-10 pt-10 border-t border-slate-100">
      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Nhật ký quy trình (Audit Trail)</h5>
      <div className="relative space-y-0 pb-4">
        <div className="absolute left-[11px] top-2 bottom-6 w-0.5 bg-slate-100 z-0" />
        {(logs || []).slice().reverse().map((log, i) => {
          const isScheduling = log.action.includes('Đặt lịch') || log.action.includes('Ngày trình ký');
          const isSigning = log.action.includes('đã ký');
          const isUpload = log.action.includes('upload');
          const isComplete = log.action.includes('Hoàn tất');
          
          let dotColor = 'bg-slate-300';
          let textColor = 'text-slate-600';
          if (isScheduling) dotColor = 'bg-amber-400';
          if (isSigning) dotColor = 'bg-emerald-500';
          if (isUpload) dotColor = 'bg-indigo-500';
          if (isComplete) { dotColor = 'bg-indigo-600'; textColor = 'text-indigo-900 font-bold'; }

          return (
            <div key={i} className="relative z-10 flex items-start gap-5 pb-8 group">
              <div className={`w-6 h-6 rounded-lg ${dotColor} mt-0.5 shrink-0 shadow-lg shadow-black/5 flex items-center justify-center text-[10px] text-white font-bold`}>
                {isComplete ? '✓' : (i + 1)}
              </div>
              <div className="flex-1">
                <div className={`text-[13px] font-bold ${textColor} leading-tight mb-1`}>{log.action}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateVN(log.time)}</span>
                  <span className="text-slate-200 text-[10px]">|</span>
                  <span className="text-[10px] font-bold text-indigo-400">{new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-slate-200 text-[10px]">|</span>
                  <span className="text-[10px] font-bold text-slate-400 italic">bởi {log.user}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractWorkflowTracker({ userRole, branch, setTasks }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');
  
  const [checklistValues, setChecklistValues] = useState({});
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const load = () => {
    const data = JSON.parse(localStorage.getItem('ace_contract_issue_log_v1') || '[]');
    setItems(data);
  };

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('ace_workflow_updated', handleUpdate);
    return () => window.removeEventListener('ace_workflow_updated', handleUpdate);
  }, []);

  const selectedItem = items.find(it => it.id === selectedId);

  const handleStageTransition = (nextStage, nextStatus, nextAudit) => {
    const mappings = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
    const pos = String(selectedItem.chuc_vu || selectedItem.vi_tri || '').trim();
    const required = mappings[pos];
    
    if (required) {
      const docs = required.split('+').map(s => s.trim());
      const initial = {};
      docs.forEach(d => { initial[d] = false; });
      setChecklistValues(initial);
      setPendingAction({ nextStage, nextStatus, nextAudit });
      setShowChecklistModal(true);
    } else {
      updateItem(selectedId, nextStage, nextStatus, nextAudit);
    }
  };

  const createContractTask = (it, dateStr) => {
    if (!setTasks || !dateStr) return;
    const newTask = {
      id: `task-hd-${it.id}-${Date.now()}`,
      title: `Trình ký hợp đồng`,
      group: it.branch || branch || 'ALL',
      startDate: dateStr, // Format YYYY-MM-DD matches expected input
      endDate: dateStr,
      notes: `LỊCH TRÌNH KÝ:\n- Nhân sự: ${it.employeeName || it.ho_ten}\n- Mã NV: ${it.employeeId || it.ma_nv}\n- Chi nhánh: ${it.branch || branch}\n- Số HĐ: ${it.soHd || it.so_hd}`,
      status: 'TODO',
      priority: 'high',
      assignee: String(localStorage.getItem('saved_username') || ''),
      tags: ['HRM', 'HỢP ĐỒNG'],
      subtasks: [],
      comments: [],
      activityLog: [{ action: 'Hệ thống tự động tạo từ Quy trình Hợp đồng', time: new Date().toISOString(), user: 'system' }]
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const updateItem = (id, nextStage, status, auditAction, extra = {}) => {
    const updated = items.map(it => {
      if (it.id !== id) return it;
      const nextTrail = [
        ...(it.auditTrail || []),
        { action: auditAction, time: new Date().toISOString(), user: String(localStorage.getItem('saved_username') || 'system') }
      ];
      
      // If we are setting submission date for the first time or updating it
      if (extra.submissionDate && extra.submissionDate !== it.submissionDate) {
         createContractTask(it, extra.submissionDate);
      }

      return { 
        ...it, 
        workflowStage: nextStage, 
        workflowStatus: status, 
        auditTrail: nextTrail,
        ...extra 
      };
    });
    localStorage.setItem('ace_contract_issue_log_v1', JSON.stringify(updated));
    setItems(updated);
  };

  const filteredItems = items.filter(it => {
    const s = filterQuery.toLowerCase();
    const matchesQuery = !s || 
      (it.ho_ten || '').toLowerCase().includes(s) || 
      (it.soHd || '').toLowerCase().includes(s) || 
      (it.employeeId || '').toLowerCase().includes(s) ||
      (it.branch || '').toLowerCase().includes(s) ||
      (it.chuc_vu || '').toLowerCase().includes(s);
    const matchesBranch = (userRole === 'admin') || (it.branch === branch);
    return matchesQuery && matchesBranch;
  });

  return (
    <div className="relative">
      {/* Main List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <h3 className="font-bold text-slate-800 text-sm">Danh sách quy trình hồ sơ</h3>
          <input 
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Tìm theo tên/mã/số HĐ/chi nhánh..."
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3">Số HĐ</th>
                <th className="px-4 py-3">Chi nhánh / Vị trí</th>
                <th className="px-4 py-3">Giai đoạn</th>
                <th className="px-4 py-3">Cập nhật</th>
                <th className="px-4 py-3">Ghi chú</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(it => (
                <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-slate-800">{it.employeeName || it.ho_ten}</div>
                    <div className="text-[10px] font-bold text-slate-400">{it.employeeId || it.ma_nv}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-500 whitespace-nowrap">{it.soHd || it.so_hd}</td>
                  <td className="px-4 py-3">
                    <div className="text-[11px] font-bold text-indigo-600 truncate max-w-[120px]">{it.branch}</div>
                    <div className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{it.chuc_vu || it.vi_tri || '---'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter bg-${WORKFLOW_STAGES[(it.workflowStage || 1) - 1].color}-100 text-${WORKFLOW_STAGES[(it.workflowStage || 1) - 1].color}-700`}>
                          GĐ {it.workflowStage || 1}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 truncate max-w-[80px]">
                          {it.workflowStatus === 'COMPLETED' ? 'Đã hoàn tất' : it.workflowStatus}
                        </div>
                      </div>
                      {(it.submissionDate || it.signingDate) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex items-center gap-1">
                            📅 {formatDateVN(it.submissionDate || it.signingDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                    {formatDateVN(it.auditTrail?.slice(-1)[0]?.time)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[10px] text-slate-500 italic max-w-[150px] line-clamp-1" title={it.ghi_chu}>
                      {it.ghi_chu || 'No note'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button 
                      onClick={() => setSelectedId(it.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[10px] hover:bg-indigo-100 uppercase"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400 text-sm font-bold">Chưa có hồ sơ nào trong quy trình.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {selectedId && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl max-h-full overflow-hidden rounded-[32px] shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-100 p-6 md:px-8 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selectedItem.employeeName || selectedItem.ho_ten}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Số HĐ: {selectedItem.soHd || selectedItem.so_hd} · {selectedItem.branch} · {selectedItem.chuc_vu || selectedItem.vi_tri || 'N/A'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedId(null)}
                className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all font-bold text-2xl"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              {/* Workflow Progress Header */}
              <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between mb-10">
                   <div className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm bg-${WORKFLOW_STAGES[(selectedItem.workflowStage || 1) - 1].color}-600 text-white`}>
                    {WORKFLOW_STAGES[(selectedItem.workflowStage || 1) - 1].label}
                  </div>
                </div>

                <div className="relative px-10">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 z-0" />
                  <div className="relative flex justify-between z-10">
                    {WORKFLOW_STAGES.map(s => {
                      const isActive = selectedItem.workflowStage >= s.id;
                      const isCurrent = selectedItem.workflowStage === s.id;
                      return (
                        <div key={s.id} className="flex flex-col items-center gap-3 w-32">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-all transform ${isActive ? `bg-${s.color}-600 text-white scale-110` : 'bg-white text-slate-300 border-2 border-slate-200'}`}>
                            {isActive && !isCurrent && s.id < selectedItem.workflowStage ? '✓' : s.icon}
                          </div>
                          <div className={`text-[10px] font-bold text-center uppercase tracking-widest leading-tight ${isActive ? 'text-slate-800' : 'text-slate-300'}`}>
                            {s.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

                {/* Scheduling Section */}
                <div className="max-w-3xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">📅 Ngày trình ký (Draft)</label>
                    <input 
                      type="date"
                      value={selectedItem.submissionDate || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateItem(selectedId, selectedItem.workflowStage, selectedItem.workflowStatus, `Đặt lịch trình ký: ${formatDateVN(val)}`, { submissionDate: val });
                      }}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">✍️ Ngày sếp ký (Final)</label>
                    <input 
                      type="date"
                      value={selectedItem.signingDate || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateItem(selectedId, selectedItem.workflowStage, selectedItem.workflowStatus, `Lãnh đạo đã ký ngày: ${formatDateVN(val)}`, { signingDate: val });
                      }}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Stage Implementation */}
                <div className="max-w-3xl mx-auto space-y-10">
                  {(() => {
                    const mappings = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
                    const req = mappings[String(selectedItem.chuc_vu || selectedItem.vi_tri || '').trim()];
                    if (!req) return null;
                    return (
                      <div className="p-6 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner">📄</div>
                            <div>
                              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Cấu hình hồ sơ bắt buộc:</div>
                              <div className="text-base font-bold text-indigo-300 tracking-wide">{req}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {selectedItem.workflowStage === 1 && (
                    <div className="p-8 rounded-[32px] border-2 border-dashed border-indigo-100 bg-indigo-50/30">
                      <h4 className="font-bold text-indigo-900 text-lg mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                        Nhân viên ký tay & Upload Scan
                      </h4>
                      <p className="text-sm text-indigo-700/60 font-bold mb-8">Vui lòng in hợp đồng bản cứng, yêu cầu nhân viên ký xác nhận, sau đó scan bản có chữ ký và tải lên tại đây.</p>
                      
                      <div className="flex flex-col gap-6">
                        <div className="relative group">
                          <input 
                            type="file" 
                            accept="application/pdf"
                            className="hidden" 
                            id="upload-scan-nv"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              updateItem(selectedItem.id, 1, 'ĐÃ UPLOAD BẢN QUÉT NV', `Đã upload bản scan NV: ${f.name}`, { nvScanFile: f.name });
                            }}
                          />
                          <label htmlFor="upload-scan-nv" className="flex flex-col items-center justify-center gap-4 w-full py-10 bg-white border-2 border-slate-200 border-dashed rounded-[24px] cursor-pointer group-hover:border-indigo-400 transition-all">
                            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">↑</div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedItem.nvScanFile || 'CHỌN FILE PDF ĐỂ TẢI LÊN'}</span>
                          </label>
                        </div>

                        {selectedItem.nvScanFile && (
                          <button 
                            onClick={() => {
                              handleStageTransition(2, 'CHỜ LÃNH ĐẠO KÝ', 'Nhân sự xác nhận đã đủ hồ sơ & trình lãnh đạo');
                            }}
                            className="w-full py-5 bg-indigo-600 text-white font-bold text-sm rounded-[20px] shadow-2xl shadow-indigo-200 uppercase tracking-[0.2em] hover:bg-indigo-700 active:scale-[0.98] transition-all"
                          >
                            Xác nhận nộp hồ sơ & GĐ 2 →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedItem.workflowStage === 2 && (
                    <div className="p-8 rounded-[32px] border-2 border-dashed border-emerald-100 bg-emerald-50/30">
                      <h4 className="font-bold text-emerald-900 text-lg mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
                        Lãnh đạo ký & Hoàn thiện
                      </h4>
                      <p className="text-sm text-emerald-700/60 font-bold mb-8">Gửi bản cứng cho lãnh đạo ký và đóng mộc. Sau đó scan bản hoàn thiện cuối cùng và cập nhật lên hệ thống.</p>
                      
                      <div className="flex flex-col gap-6">
                        <div className="relative group">
                          <input 
                            type="file" 
                            accept="application/pdf"
                            className="hidden" 
                            id="upload-scan-final"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              updateItem(selectedItem.id, 2, 'ĐÃ UPLOAD BẢN QUÉT FINAL', `Đã upload bản scan FINAL: ${f.name}`, { finalScanFile: f.name });
                            }}
                          />
                          <label htmlFor="upload-scan-final" className="flex flex-col items-center justify-center gap-4 w-full py-10 bg-white border-2 border-slate-200 border-dashed rounded-[24px] cursor-pointer group-hover:border-emerald-400 transition-all">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">↑</div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedItem.finalScanFile || 'TẢI LÊN BẢN SCAN CÓ MỘC'}</span>
                          </label>
                        </div>

                        {selectedItem.finalScanFile && (
                          <button 
                            onClick={() => {
                              handleStageTransition(3, 'COMPLETED', 'Xác nhận hồ sơ đã có mộc & hoàn tất');
                            }}
                            className="w-full py-5 bg-emerald-600 text-white font-bold text-sm rounded-[20px] shadow-2xl shadow-emerald-200 uppercase tracking-[0.2em] hover:bg-emerald-700 active:scale-[0.98] transition-all"
                          >
                            Xác nhận hoàn tất nộp hồ sơ ✓
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedItem.workflowStage === 3 && (
                    <div className="p-10 rounded-[40px] bg-indigo-600 text-white shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl grayscale transform rotate-12">📝</div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-6 mb-8">
                          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-4xl shadow-inner">🎉</div>
                          <div>
                            <h4 className="font-bold text-2xl uppercase tracking-wider mb-1">Quy trình hoàn tất</h4>
                            <p className="text-xs font-bold text-white/70 uppercase tracking-[0.2em]">Hồ sơ đã được số hóa & lưu trữ an toàn</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-6 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/10 group cursor-pointer hover:bg-white/20 transition-all">
                            <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Scan NV</div>
                            <div className="text-sm font-bold truncate">{selectedItem.nvScanFile}</div>
                          </div>
                          <div className="p-6 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/10 group cursor-pointer hover:bg-white/20 transition-all">
                            <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Scan FINAL</div>
                            <div className="text-sm font-bold truncate">{selectedItem.finalScanFile}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note Section */}
                  <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Ghi chú & Nhật ký công việc</label>
                    <textarea 
                      value={selectedItem.ghi_chu || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const updated = items.map(it => it.id === selectedId ? { ...it, ghi_chu: v } : it);
                        localStorage.setItem('ace_contract_issue_log_v1', JSON.stringify(updated));
                        setItems(updated);
                      }}
                      className="w-full p-6 rounded-[24px] border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all min-h-[120px] resize-none"
                      placeholder="Nhập ghi chú quan trọng hoặc các cập nhật bổ sung cho nhân sự này..."
                    />
                  </div>

                  <div className="pb-10">
                    <WorkflowAuditTrail logs={selectedItem.auditTrail} />
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}
      {showChecklistModal && pendingAction && (
        <ChecklistModal 
          docs={(() => {
            const mappings = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
            const req = mappings[String(selectedItem.chuc_vu || selectedItem.vi_tri || '').trim()];
            return req ? req.split('+').map(s => s.trim()) : [];
          })()}
          values={checklistValues}
          onChange={(doc, val) => setChecklistValues(prev => ({ ...prev, [doc]: val }))}
          onCancel={() => setShowChecklistModal(false)}
          onConfirm={() => {
            updateItem(selectedId, pendingAction.nextStage, pendingAction.nextStatus, pendingAction.nextAudit);
            setShowChecklistModal(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}

function DocxViewer({ templateUrl, templateFile, data, height = 640 }) {
  const hostRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError('');
      const el = hostRef.current;
      if (!el) return;
      el.innerHTML = '';

      if (!templateUrl && !templateFile) return;

      setBusy(true);
      try {
        let buf;
        if (templateFile) buf = await templateFile.arrayBuffer();
        else {
          const resp = await fetch(templateUrl, { cache: 'no-store' });
          if (!resp.ok) throw new Error('Không tải được template .docx');
          buf = await resp.arrayBuffer();
        }
        const blob = createDocxFromArrayBuffer(buf, data);
        const filledBuf = await blob.arrayBuffer();
        await renderAsync(filledBuf, el, undefined, { inWrapper: false });
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      const el = hostRef.current;
      if (el) el.innerHTML = '';
    };
  }, [data, templateFile, templateUrl]);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <style dangerouslySetInnerHTML={{ __html: '.ace-docx-viewer, .ace-docx-viewer * { font-family: "Times New Roman", Times, serif !important; }' }} />
      {busy && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Đang tải DOCX…
        </div>
      )}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-sm font-bold text-red-600">
          {error}
        </div>
      )}
      <div className="overflow-auto ace-docx-viewer" style={{ height }}>
        <div ref={hostRef} className="p-4" />
      </div>
    </div>
  );
}

function vnReadTriple(n) {
  const ones = ['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
  const a = Math.floor(n / 100);
  const b = Math.floor((n % 100) / 10);
  const c = n % 10;
  const parts = [];
  if (a > 0) parts.push(ones[a], 'trăm');
  if (b === 0 && c > 0 && a > 0) parts.push('lẻ');
  if (b > 1) parts.push(ones[b], 'mươi');
  if (b === 1) parts.push('mười');
  if (c > 0) {
    if (b > 1 && c === 1) parts.push('mốt');
    else if (b >= 1 && c === 5) parts.push('lăm');
    else parts.push(ones[c]);
  }
  return parts.join(' ');
}

function numberToVietnameseWords(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const chunks = [];
  let x = n;
  while (x > 0) {
    chunks.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const parts = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk === 0) continue;
    const text = vnReadTriple(chunk);
    parts.push(text);
    if (units[i]) parts.push(units[i]);
  }
  const out = parts.join(' ').replace(/\s+/g, ' ').trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
}

function moneyToWords(v) {
  const n = parseMoneyToNumber(v);
  if (!n) return '';
  const w = numberToVietnameseWords(n);
  return w ? `${w} đồng` : '';
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

const CONTRACT_TYPE_DOCS_STORAGE_KEY = 'ace_contract_type_docs_v1';
const AGREEMENT_DOCS_STORAGE_KEY = 'ace_agreement_docs_v1';
const COMMITMENT_DOCS_STORAGE_KEY = 'ace_commitment_docs_v1';

const CONTRACT_DOC_TYPE_OPTIONS = [
  { id: 'hoc-viec', label: 'ACE - THỎA THUẬN HỌC VIỆC' },
  { id: 'thu-viec-ft', label: 'ACE - HỢP ĐỒNG THỬ VIỆC NHÂN VIÊN TOÀN THỜI GIAN' },
  { id: 'hdld-ft', label: 'ACE - HỢP ĐỒNG LAO ĐỘNG TOÀN THỜI GIAN' },
  { id: 'hdld-pt-bhxh', label: 'ACE - HỢP ĐỒNG LAO ĐỘNG BÁN THỜI GIAN CÓ THAM GIA BHXH' },
  { id: 'cong-tac-vien', label: 'ACE - HỢP ĐỒNG CỘNG TÁC VIÊN' },
  { id: 'custom', label: 'Tùy chỉnh (nhập tên)' },
];

const AGREEMENT_DOC_TYPE_OPTIONS = [
  { id: 'ttcv-bao-ve', label: 'ACE - THỎA THUẬN CÔNG VIỆC - BẢO VỆ' },
  { id: 'ttcv-tap-vu', label: 'ACE - THỎA THUẬN CÔNG VIỆC - TẠP VỤ' },
  { id: 'ttcv-part-time', label: 'ACE - THỎA THUẬN CÔNG VIỆC - PART TIME' },
  { id: 'ttcv-thinh-giang', label: 'ACE - THỎA THUẬN CÔNG VIỆC - THỈNH GIẢNG' },
  { id: 'ttcv-tro-giang', label: 'ACE - THỎA THUẬN CÔNG VIỆC - TRỢ GIẢNG' },
  { id: 'ttcv-gv-co-huu', label: 'ACE - THỎA THUẬN CÔNG VIỆC - GIÁO VIÊN CƠ HỮU' },
  { id: 'ttcv-nv-co-huu', label: 'ACE - THỎA THUẬN CÔNG VIỆC - NHÂN VIÊN CƠ HỮU' },
  { id: 'ttcv-truong-vp', label: 'ACE - THỎA THUẬN CÔNG VIỆC - TRƯỞNG BỘ PHẬN VĂN PHÒNG' },
  { id: 'ttcv-truong-cl', label: 'ACE - THỎA THUẬN CÔNG VIỆC - TRƯỞNG BỘ PHẬN CHẤT LƯỢNG' },
  { id: 'ttcv-qlcn', label: 'ACE - THỎA THUẬN CÔNG VIỆC - QLCN' },
  { id: 'custom', label: 'Tùy chỉnh (nhập tên)' },
];

const COMMITMENT_DOC_TYPE_OPTIONS = [
  { id: 'ckql-bao-ve', label: 'ACE - CAM KẾT QUYỀN LỢI - BẢO VỆ' },
  { id: 'ckql-tap-vu', label: 'ACE - CAM KẾT QUYỀN LỢI - TẠP VỤ' },
  { id: 'ckql-part-time', label: 'ACE - CAM KẾT QUYỀN LỢI - PART TIME' },
  { id: 'ckql-thinh-giang', label: 'ACE - CAM KẾT QUYỀN LỢI - THỈNH GIẢNG' },
  { id: 'ckql-tro-giang', label: 'ACE - CAM KẾT QUYỀN LỢI - TRỢ GIẢNG' },
  { id: 'custom', label: 'Tùy chỉnh (nhập tên)' },
];

const DEFAULT_CONTRACT_TYPE_DOCS = {
  'hdld-ft': '1mJzGvkgUBK-YPXTDtYO1ZvtVvPrPQUseXHbya2MyH5g',
  'cong-tac-vien': '1U4dTFRscr1-M3v-K3spN42CLy7-EAhni2pmW-W-PKlA',
  'hdld-pt-bhxh': '1qIs9TQpuzSmLpW_a6vCQvU3Hdnm6qmw6wtK0RX0JdXE',
  'thu-viec-ft': '1bhW8G1Wj8ggH-kjPCOoy2z5LdY0gl0oTCpfp2gGKflc',
  'hoc-viec': '1a90ZPkPvn2DbGWS-MvoV_549Ix4PiMuQYcUtQkhbjsE',
};

function requiresDenNgay(contractTypeId, agreementTypeId) {
  const cid = String(contractTypeId || '').trim();
  const contractNeeds = cid === 'hoc-viec' || cid === 'thu-viec-ft' || cid === 'hdld-pt-bhxh' || cid === 'cong-tac-vien';
  return contractNeeds || !!String(agreementTypeId || '').trim();
}

function validateContractData(data, { contractTypeId, agreementTypeId }) {
  const missing = [];
  const fieldErrors = {};
  const v = (k) => String(data?.[k] ?? '').trim();

  for (const f of CONTRACT_FIELDS) {
    if (!f.required) continue;
    if (!v(f.key)) missing.push(f.label);
  }

  if (v('ngay_ky') && !isIsoDateString(v('ngay_ky'))) {
    fieldErrors.ngay_ky = 'Ngày ký HĐ không hợp lệ. Nhập đúng dd/mm/yyyy.';
  }

  const needDen = requiresDenNgay(contractTypeId, agreementTypeId);
  if (v('den_ngay') && !isIsoDateString(v('den_ngay'))) {
    fieldErrors.den_ngay = 'Đến ngày không hợp lệ. Nhập đúng dd/mm/yyyy.';
  }

  if (v('tu_ngay') && v('den_ngay') && isIsoDateString(v('tu_ngay')) && isIsoDateString(v('den_ngay'))) {
    if (v('den_ngay') < v('tu_ngay')) {
      fieldErrors.den_ngay = 'Đến ngày phải lớn hơn hoặc bằng Từ ngày.';
    }
  }

  return { missing, fieldErrors };
}

const DEFAULT_AGREEMENT_DOCS = {
  'ttcv-bao-ve': '1Pdq_5C7ekHUkpzjJMaEIyTTcJ6FBsbMmsJOUBbU2U0g',
  'ttcv-tap-vu': '1KN9WYsjDqsxsS6mPTMvyzpawZa_5VT2NMmPv1ACOfbI',
  'ttcv-part-time': '1DHYUIFz9x0EIx4u2RQvUs1Y0D9d2xLUFPIuuv6QOHeI',
  'ttcv-thinh-giang': '1TX7w4LTy1CHhT4P18yMMtrSdo9afRKWSf4B1GrXZBoA',
  'ttcv-tro-giang': '1ograO43mUM2n4Wpqs69tOXo2ihXsRUpAonl6rqC8byA',
  'ttcv-gv-co-huu': '1RfagYzw69c6bHiqnLQgOLGz4vdcmUBPqLvE4_QFmJJQ',
  'ttcv-nv-co-huu': '1tqzsYfP2n1Tcy2ClL5hlf3BpP3m4VRd7HV6YS0iz-hA',
  'ttcv-truong-vp': '1zDrkJYRyEUKRf3PlwPzns9_ZWiihBPonnJFL_NrU0wE',
  'ttcv-truong-cl': '1fy--Un1MhXGCeX5tRTHbpHg43Zzq0g9ohPa0Jgd1gik',
  'ttcv-qlcn': '1E0G36m6D_ezvO1Q5WgxZJatqRtI2yZUc5dFCX8j_9MM',
};

const DEFAULT_COMMITMENT_DOCS = {
  'ckql-bao-ve': '1kLIsz5QHKVaXvFPjXXIi8fbbI6PeBaECz7C2bnn6MG8',
  'ckql-tap-vu': '1FI_4jf-EOm4kpE1fraplA0W9Vux1Yd6ZGioMHEcbMCY',
  'ckql-part-time': '12gP2B6YQHQql4gEBW2UEI6yKdLpnNV_8DlU8w3j2968',
  'ckql-thinh-giang': '1zI98G7RXlmwGlGDEwGy49gl_nnnImwLVsayeV3mfdEI',
  'ckql-tro-giang': '1it-XMSDAV7Sky4Oq1eXPtNP4GqrtJ3hqqPv_KxbSjX0',
};

function mergeDocMaps(defaultMap, userMap) {
  const base = defaultMap && typeof defaultMap === 'object' ? defaultMap : {};
  const extra = userMap && typeof userMap === 'object' && !Array.isArray(userMap) ? userMap : {};
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const s = String(v || '').trim();
    if (s) out[k] = s;
  }
  return out;
}

function loadContractTypeDocs() {
  const raw = localStorage.getItem(CONTRACT_TYPE_DOCS_STORAGE_KEY) || '';
  const parsed = safeJsonParse(raw, {});
  return mergeDocMaps(DEFAULT_CONTRACT_TYPE_DOCS, parsed);
}

function saveContractTypeDocs(map) {
  const safe = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  localStorage.setItem(CONTRACT_TYPE_DOCS_STORAGE_KEY, JSON.stringify(safe));
}

function loadAgreementDocs() {
  const raw = localStorage.getItem(AGREEMENT_DOCS_STORAGE_KEY) || '';
  const parsed = safeJsonParse(raw, {});
  return mergeDocMaps(DEFAULT_AGREEMENT_DOCS, parsed);
}

function saveAgreementDocs(map) {
  const safe = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  localStorage.setItem(AGREEMENT_DOCS_STORAGE_KEY, JSON.stringify(safe));
}

function loadCommitmentDocs() {
  const raw = localStorage.getItem(COMMITMENT_DOCS_STORAGE_KEY) || '';
  const parsed = safeJsonParse(raw, {});
  return mergeDocMaps(DEFAULT_COMMITMENT_DOCS, parsed);
}

function saveCommitmentDocs(map) {
  const safe = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  localStorage.setItem(COMMITMENT_DOCS_STORAGE_KEY, JSON.stringify(safe));
}

function safeJsonParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v === undefined || v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function canonicalPositionKey(pos) {
  const t = normalizeHeader(pos);
  if (!t) return '';
  if (t.includes('fulltime') || t.includes('full time')) return 'fulltime';
  if (t.includes('thinh gian') || t.includes('thinh giang')) return 'thinh giang';
  return t;
}

function preferredPositionLabelByKey(key) {
  if (key === 'fulltime') return 'Fulltime';
  if (key === 'thinh giang') return 'Thỉnh giảng';
  return '';
}

function canonicalPositionLabel(pos) {
  const key = canonicalPositionKey(pos);
  const preferred = preferredPositionLabelByKey(key);
  if (preferred) return preferred;
  return String(pos || '').trim();
}

function optionLabel(options, id) {
  const key = String(id || '').trim();
  const opt = (Array.isArray(options) ? options : []).find(o => o && o.id === key);
  return opt ? String(opt.label || '').trim() : key;
}

function normalizePositionKey(pos) {
  return canonicalPositionKey(String(pos || ''));
}

function normalizeCellValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.replace(/^'+/, '').trim();
}

function normalizeDateToISO(v) {
  const s = normalizeCellValue(v);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(y)) return '';
    let month;
    let day;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      month = a;
      day = b;
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return '';
}

function mapRowToContract(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return normalizeCellValue(v);
    }
    return '';
  };

  const maNv = get('ma nv', 'mã nv', 'mã nhân viên', 'employee id', 'id');
  const luong = get('luong can ban', 'lương căn bản', 'luong co ban', 'muc luong (so)', 'lương', 'luong');
  const nhaO = get('nha o', 'nhà ở', 'phu cap cho o', 'phụ cấp chỗ ở');
  const xangXe = get('xang xe', 'xăng xe', 'phu cap di lai', 'phụ cấp đi lại');
  const dtPc = get('dien thoai__2', 'điện thoại__2', 'dien thoai (phu cap)', 'dien thoai (pc)', 'phu cap dien thoai', 'phụ cấp điện thoại');
  const v1 = get('vi tri 1', 'vị trí 1', 'chuc danh chuyen mon', 'chức danh chuyên môn', 'position');

  const out = {
    ma_nv: maNv,
    so_hd: get('so hop dong', 'số hợp đồng', 'so hd', 'số hd'),
    ho_ten: get('ho va ten', 'họ và tên', 'name'),
    quoc_tich: get('quoc tich', 'quốc tịch', 'nationality') || 'Việt Nam',
    ngay_sinh: normalizeDateToISO(get('ngay sinh', 'ngày sinh', 'dob', 'sinh ngay')),
    noi_sinh: get('noi sinh', 'nơi sinh', 'place of birth'),
    cccd: get('so cccd', 'số cccd', 'so cmnd/cccd', 'cccd', 'cmnd'),
    ngay_cap: normalizeDateToISO(get('ngay cap', 'ngày cấp', 'ngay cap cccd', 'ngày cấp cccd', 'ngay cap cmnd', 'ngày cấp cmnd')),
    noi_cap: get('noi cap', 'nơi cấp', 'noi cap cccd', 'nơi cấp cccd'),
    so_dien_thoai: get('so dien thoai', 'số điện thoại', 'dien thoai', 'điện thoại', 'phone'),
    email: get('email'),
    dia_chi: get('dia chi thuong tru', 'địa chỉ thường trú', 'thuong tru', 'thường trú', 'dia chi', 'địa chỉ'),
    tam_tru: get('dia chi tam tru', 'địa chỉ tạm trú', 'tam tru', 'tạm trú'),
    chuc_vu: v1,
    tu_ngay: normalizeDateToISO(get('ngay lam viec chinh thuc', 'ngày làm việc chính thức', 'ngay bat dau lam viec', 'ngày bắt đầu làm việc', 'tu ngay', 'từ ngày')),
    luong,
    luong_chu: '',
    phu_cap_cho_o: nhaO,
    phu_cap_di_lai: xangXe,
    phu_cap_dt: dtPc,
    ngay_ky: normalizeDateToISO(get('ngay ky hop dong', 'ngày ký hợp đồng', 'ngay ky hd', 'ngày ký hđ', 'ngay ky', 'ngày ký')),
  };

  out.luong_chu = moneyToWords(out.luong);
  return out;
}

function computeSoHdFromMaNv(maNv) {
  const id = String(maNv || '').trim();
  if (!id) return '';
  return id;
}

function parseDelimited(text, delimiter) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line) => {
    if (delimiter === ',') {
      const out = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = !inQ;
          }
        } else if (ch === ',' && !inQ) {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    }
    return line.split(delimiter);
  };

  const rawHeaders = splitLine(lines[0]).map(s => String(s || '').trim());
  const normalized = rawHeaders.map(h => normalizeHeader(h));
  const counts = {};
  const headers = normalized.map(h => {
    counts[h] = (counts[h] || 0) + 1;
    return counts[h] === 1 ? h : `${h}__${counts[h]}`;
  });
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] !== undefined ? String(cols[idx]).trim() : '';
    });
    rows.push(obj);
  }
  return { headers, rows };
}

function detectCsvDelimiter(line) {
  const l = String(line || '');
  const comma = (l.match(/,/g) || []).length;
  const semi = (l.match(/;/g) || []).length;
  const tab = (l.match(/\t/g) || []).length;
  if (tab > comma && tab > semi) return '\t';
  if (semi > comma) return ';';
  return ',';
}

function parseCsvSmart(text) {
  const rawLines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = rawLines.filter(l => String(l || '').trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectCsvDelimiter(lines[0]);

  const split = (line) => {
    if (delimiter !== ',') return String(line || '').split(delimiter);

    const out = [];
    let cur = '';
    let inQ = false;
    const s = String(line || '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        if (inQ && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const scoreHeader = (headers) => {
    const set = new Set(headers);
    const has = (...k) => k.some(x => set.has(x));
    let score = 0;
    if (has('ma nv', 'mã nv', 'ma nhan vien')) score += 3;
    if (has('ho va ten', 'họ và tên')) score += 3;
    if (has('so cccd', 'số cccd', 'so cmnd/cccd')) score += 2;
    if (has('ngay sinh', 'ngày sinh')) score += 1;
    if (has('noi cap', 'nơi cấp', 'noi cap cccd')) score += 1;
    if (has('so dien thoai', 'số điện thoại', 'dien thoai')) score += 1;
    if (has('luong can ban', 'lương căn bản')) score += 1;
    if (has('ngay ky hop dong', 'ngày ký hợp đồng')) score += 1;
    return score;
  };

  let headerIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const cols = split(lines[i]).map(s => normalizeHeader(s));
    const sc = scoreHeader(cols);
    if (sc > bestScore) {
      bestScore = sc;
      headerIndex = i;
    }
  }
  if (bestScore < 3) {
    return parseDelimited(text, delimiter);
  }

  const normalized = split(lines[headerIndex]).map(s => normalizeHeader(s));
  const counts = {};
  const headers = normalized.map(h => {
    counts[h] = (counts[h] || 0) + 1;
    return counts[h] === 1 ? h : `${h}__${counts[h]}`;
  });
  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    if (!cols || cols.every(c => String(c || '').trim() === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] !== undefined ? String(cols[idx]).trim() : '';
    });
    rows.push(obj);
  }

  return { headers, rows };
}

let _xlsxPromise;
async function loadXlsx() {
  if (typeof window === 'undefined') throw new Error('no_window');
  if (window.XLSX) return window.XLSX;
  if (!_xlsxPromise) {
    _xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('xlsx_missing'));
      script.onerror = () => reject(new Error('xlsx_load_failed'));
      document.head.appendChild(script);
    });
  }
  return _xlsxPromise;
}

let _pdfjsPromise;

async function loadPdfJs() {
  if (typeof window === 'undefined') throw new Error('no_window');
  if (window.pdfjsLib) return window.pdfjsLib;

  if (!_pdfjsPromise) {
    _pdfjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error('pdfjs_missing'));
          return;
        }
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('pdfjs_load_failed'));
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = await _pdfjsPromise;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js';
  return pdfjsLib;
}

function PdfA4Page({ pageNum, pdfUrl, pdfPageNumber }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError('');
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        const absUrl = new URL(pdfUrl, window.location.origin).toString();
        const doc = await pdfjsLib.getDocument({
          url: absUrl,
          disableRange: true,
          disableStream: true,
          disableAutoFetch: true,
        }).promise;
        if (cancelled) return;
        const page = await doc.getPage(pdfPageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          const msg = e?.message ? String(e.message) : String(e);
          setError(`Không thể tải trang PDF (trang 3-4). ${msg}`);
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pdfPageNumber]);

  return (
    <div className="flex flex-col items-center">
      <div className="no-print w-[210mm] flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold text-white shadow-md bg-indigo-600">
          <span>TRANG {pageNum}</span>
        </div>
      </div>

      <section className="page max-w-[210mm] relative" style={{ padding: 0 }}>
        <div className="absolute inset-0 bg-white">
          {error ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
              {error}
            </div>
          ) : (
            <div className="w-full h-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold">
                  Đang tải PDF…
                </div>
              )}
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Mock Staff Data ───────────────────────────────────────────────────────────
const MOCK_STAFF = [
  { 
    id: 'EMP001', 
    name: 'NGUYỄN VĂN A', 
    position: 'QUẢN LÝ CHI NHÁNH', 
    department: 'TRUNG MỸ TÂY',
    cccd: '079090001234', 
    cccd_date: '2021-05-20', 
    cccd_place: 'Cục Cảnh sát QLHC về TTXH',
    dob: '1990-01-01',
    nationality: 'Việt Nam',
    address: '123 Đường Số 1, Phường Tân Thới Nhất, Quận 12, TP.HCM',
    phone: '0901234567',
    salary: '25,000,000',
    salary_text: 'Hai mươi lăm triệu đồng chẵn',
    startDate: '2024-01-01'
  },
  { 
    id: 'EMP002', 
    name: 'TRẦN THỊ B', 
    position: 'GIÁO VIÊN TIẾNG ANH', 
    department: 'NGUYỄN ẢNH THỦ',
    cccd: '079092005678', 
    cccd_date: '2022-10-15', 
    cccd_place: 'Cục Cảnh sát QLHC về TTXH',
    dob: '1995-06-15',
    nationality: 'Việt Nam',
    address: '456 Lê Văn Khương, Quận 12, TP.HCM',
    phone: '0909876543',
    salary: '15,000,000',
    salary_text: 'Mười lăm triệu đồng chẵn',
    startDate: '2024-03-15'
  }
];

// ─── CSS nhúng cho trang giấy ─────────────────────────────────────────────────
const PAGE_CSS = `
  :root {
    --page-width: 210mm;
    --page-height: 297mm;
    --page-padding-top: 18mm;
    --page-padding-right: 20mm;
    --page-padding-bottom: 18mm;
    --page-padding-left: 30mm;
    --text: #111;
    --accent: #c00000;
    --paper: #fff;
    --screen-bg: #cbd5e1;
  }

  .pv-wrapper, .pv-wrapper * { box-sizing: border-box; }
  
  .document {
    padding: 24px 12px 40px;
    font-family: "Times New Roman", Times, serif;
    color: var(--text);
    line-height: 1.15;
    width: 100%;
  }

  .page {
    position: relative;
    width: var(--page-width);
    min-height: var(--page-height);
    margin: 0 auto 20px;
    background: var(--paper);
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    padding: var(--page-padding-top) var(--page-padding-right) var(--page-padding-bottom) var(--page-padding-left);
    page-break-after: always;
    overflow: hidden;
  }

  .page:last-child { page-break-after: auto; }

  .page-header {
    position: absolute;
    top: 8mm;
    left: 30mm;
    right: 20mm;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font-size: 11pt;
    color: var(--accent);
    font-weight: 700;
  }

  .page-footer {
    position: absolute;
    left: 30mm;
    right: 20mm;
    bottom: 8mm;
    text-align: center;
    font-size: 12pt;
  }

  .page-content {
    padding-top: 16mm;
    padding-bottom: 12mm;
    font-size: 13pt;
    text-align: justify;
    line-height: 1.15;
  }

  .page p { margin: 0 0 6px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .left { text-align: left; }
  .italic { font-style: italic; }
  .bold { font-weight: 700; }
  .uppercase { text-transform: uppercase; }
  .red { color: var(--accent); }
  .small-gap { margin-bottom: 3px; }
  .gap { margin-bottom: 10px; }
  .section-title { font-weight: 700; margin-top: 8px; }

  .top-grid {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 24px;
    align-items: start;
    margin-bottom: 18px;
  }

  .top-grid .left-block,
  .top-grid .right-block { text-align: center; }

  .country-title { font-size: 16pt; font-weight: 700; line-height: 1.2; }
  .main-title { margin: 14px 0 14px; font-size: 20pt; font-weight: 700; text-align: center; }
  .indent-1 { padding-left: 18px; }
  .indent-2 { padding-left: 36px; }
  
  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 24px;
    text-align: center;
    font-weight: 700;
  }
  .signature-space { height: 70px; }

  @media print {
    body * { visibility: hidden; }
    #print-root, #print-root * { visibility: visible; }
    #print-root { position: absolute; left: 0; top: 0; width: 100%; }
    .pv-wrapper { background: #fff; }
    .document { padding: 0; background: #fff; box-shadow: none; }
    .page {
      margin: 0;
      box-shadow: none;
      width: 210mm;
      min-height: 297mm;
    }
    .no-print { display: none !important; }
  }
`;

const HDLD_ACE_HTML_CSS = `
  .hdld-ace-root, .hdld-ace-root * { box-sizing: border-box; }
  .hdld-ace-root { font-family: "Times New Roman", Times, serif; color: #000; line-height: 1.15; }
  .hdld-ace-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 20px;
    padding: 15mm 20mm 20mm 25mm;
    position: relative;
    background: #fff;
    page-break-after: always;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
  .hdld-ace-page:last-child { page-break-after: auto; }
  .hdld-ace-doc-code {
    position: absolute;
    top: 6mm;
    right: 8mm;
    border: 1.5px solid #c00;
    color: #c00;
    font-size: 11pt;
    font-weight: bold;
    padding: 2px 10px;
    display: inline-block;
    white-space: nowrap;
  }
  .hdld-ace-page-num {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8mm;
    text-align: center;
    font-size: 12pt;
  }
  .hdld-ace-header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .hdld-ace-header-table td { border: none; padding: 4px 0; vertical-align: middle; width: 50%; font-size: 12pt; line-height: 1.15; }
  .hdld-ace-can-cu { margin: 10px auto 10px; font-style: italic; font-size: 12pt; line-height: 1.15; text-align: center; max-width: 165mm; }
  .hdld-ace-can-cu p { margin-bottom: 3px; }
  .hdld-ace-contract-title { text-align: center; font-size: 15pt; font-weight: bold; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 1px; }
  .hdld-ace-root p { font-size: 12.5pt; line-height: 1.15; margin-bottom: 3px; text-align: left; }
  .hdld-ace-intro-line { font-style: italic; margin-bottom: 10px; }
  .hdld-ace-party { margin-bottom: 8px; }
  .hdld-ace-party-name { font-weight: bold; font-size: 13pt; margin-bottom: 2px; }
  .hdld-ace-party-info p { margin-bottom: 2px; }
  .hdld-ace-agreement-line { font-style: italic; margin: 10px 0 12px; }
  .hdld-ace-article { margin-bottom: 12px; }
  .hdld-ace-article-title { font-weight: bold; font-size: 13pt; margin-bottom: 5px; }
  .hdld-ace-sub-title { font-weight: bold; margin-top: 7px; margin-bottom: 3px; }
  .hdld-ace-indent { padding-left: 20px; }
  .hdld-ace-note-box { font-style: italic; font-size: 12pt; line-height: 1.15; margin: 5px 0; }
  .hdld-ace-spacer { margin: 0 0 12px; }
  .hdld-ace-red { color: #c00; }
  .hdld-ace-link { color: #06c; text-decoration: underline; }
  .hdld-ace-sig-table { width: 100%; border-collapse: collapse; margin-top: 36px; }
  .hdld-ace-sig-table td { width: 50%; text-align: center; padding: 8px; font-size: 12.5pt; vertical-align: top; border: none; }
  .hdld-ace-sig-title { font-weight: bold; margin-bottom: 3px; }
  .hdld-ace-sig-sub { font-style: italic; font-size: 11.5pt; margin-bottom: 0; }
  .hdld-ace-sig-space { height: 70mm; }
  @media print {
    .hdld-ace-page { margin: 0; padding: 12mm 18mm 18mm 22mm; width: 100%; box-shadow: none; }
    @page { size: A4; margin: 0; }
  }
`;

const HDLD_ACE_HTML_TEMPLATE = `
  <div class="hdld-ace-page">
    <div class="hdld-ace-doc-code">03.HĐLĐ – ACE</div>
    <table class="hdld-ace-header-table">
      <tr>
        <td style="text-align:center;"><strong>CÔNG TY TNHH PHÁT TRIỂN<br>GIÁO DỤC ACE</strong></td>
        <td style="text-align:center;"><strong style="white-space:nowrap;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br><strong>Độc lập – Tự do – Hạnh phúc</strong></td>
      </tr>
    </table>
    <p style="margin-top:6px;">Số: <span class="hdld-ace-red">{{SO_HD}}</span>/HĐLĐ-ACE</p>
    <div class="hdld-ace-can-cu">
      <p>- Căn cứ Bộ luật Lao động số 45/2019/QH14 ngày 20 tháng 11 năm 2019;</p>
      <p>- Căn cứ Nghị định số 145/2020/NĐ-CP ngày 14 tháng 12 năm 2020 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Bộ luật Lao động;</p>
      <p>- Căn cứ Nội quy lao động và nhu cầu sử dụng lao động thực tế của Công ty;</p>
    </div>
    <div class="hdld-ace-contract-title">Hợp Đồng Lao Động</div>
    <p class="hdld-ace-intro-line">Hôm nay, ngày <span class="hdld-ace-red">{{NGAY_KY_D}}</span> tháng <span class="hdld-ace-red">{{NGAY_KY_M}}</span> năm {{NGAY_KY_Y}}, tại Thành phố Hồ Chí Minh, Chúng tôi gồm có:</p>
    <div class="hdld-ace-party">
      <p class="hdld-ace-party-name">Bên A (Người sử dụng lao động): CÔNG TY TNHH PHÁT TRIỂN GIÁO DỤC ACE</p>
      <div class="hdld-ace-party-info">
        <p>Địa chỉ: Số 201, Lê Lợi, xã Xuân Thới Sơn, Thành phố Hồ Chí Minh</p>
        <p>Mã Số doanh nghiệp/ mã số Thuế: 0318914647</p>
        <p>Đại diện pháp luật: Bà <strong>TRƯƠNG KIỀU OANH</strong></p>
        <p>Chức vụ: Giám đốc</p>
        <p>Điện thoại: 0909259555</p>
      </div>
    </div>
    <p class="hdld-ace-spacer">&nbsp;</p>
    <div class="hdld-ace-party">
      <p class="hdld-ace-party-name">Bên B (Người lao động): Ông/Bà: <strong><span class="hdld-ace-red">{{HO_TEN}}</span></strong></p>
      <div class="hdld-ace-party-info">
        <p>Quốc tịch: {{QUOC_TICH}} &nbsp;&nbsp; sinh ngày: {{NGAY_SINH}} &nbsp;&nbsp; tại: <span class="hdld-ace-red">{{NOI_SINH}}</span></p>
        <p>Số CMND/CCCD: <strong><span class="hdld-ace-red">{{CCCD}}</span></strong> do <span class="hdld-ace-red">{{NOI_CAP}}</span>, cấp ngày: <span class="hdld-ace-red">{{NGAY_CAP}}</span>.</p>
        <p>Số điện thoại: <span class="hdld-ace-red">{{DIEN_THOAI}}</span></p>
        <p>Email: <span class="hdld-ace-link">{{EMAIL}}</span></p>
        <p>Địa chỉ thường trú: <span class="hdld-ace-red">{{DIA_CHI_THUONG_TRU}}</span></p>
        <p>Địa chỉ tạm trú: <span class="hdld-ace-red">{{DIA_CHI_TAM_TRU}}</span></p>
      </div>
    </div>
    <p class="hdld-ace-spacer">&nbsp;</p>
    <p class="hdld-ace-agreement-line">Thỏa thuận ký kết hợp đồng lao động và cam kết thực hiện đúng những điều khoản sau:</p>
    <div class="hdld-ace-article">
      <p class="hdld-ace-article-title">Điều 1: Thời hạn và công việc hợp đồng</p>
      <p>Loại hợp đồng: {{LOAI_HOP_DONG}}</p>
      <p>- Thời gian làm việc chính thức: từ ngày <span class="hdld-ace-red">{{TU_NGAY_D}}</span> tháng <span class="hdld-ace-red">{{TU_NGAY_M}}</span> năm <span class="hdld-ace-red">{{TU_NGAY_Y}}</span>.</p>
      <p>- Địa điểm làm việc: Công Ty TNHH Phát Triển Giáo Dục ACE <em>(kèm theo quyết định điều động và bổ nhiệm)</em></p>
    </div>
    <div class="hdld-ace-page-num">1</div>
  </div>
  <div class="hdld-ace-page">
    <div class="hdld-ace-doc-code">03.HĐLĐ – ACE</div>
    <div class="hdld-ace-article">
      <p>- Chức danh chuyên môn: <span class="hdld-ace-red">{{CHUC_DANH}}</span></p>
      <p>- Công việc theo sự phân công.</p>
      <p class="hdld-ace-article-title">Điều 2: Chế độ làm việc</p>
      <p><strong>2.1.</strong> Thời gian làm việc: 8 tiếng/ ngày; theo nội quy công ty.</p>
      <p><strong>2.2.</strong> Đồng phục và các trang thiết bị làm việc sẽ được công ty cấp phát tùy theo nhu cầu của công việc.</p>
      <p class="hdld-ace-article-title">Điều 3: Nghĩa vụ và quyền lợi của Bên B</p>
      <p class="hdld-ace-sub-title">3.1. Quyền lợi</p>
      <p><strong>3.1.1. Tiền lương và hình thức trả lương</strong></p>
      <p>Mức lương cơ bản: <span class="hdld-ace-red">{{LUONG}}</span> đồng/tháng.</p>
      <p>(Số tiền bằng chữ: <span class="hdld-ace-red">{{LUONG_CHU}}</span>)</p>
      <p class="hdld-ace-sub-title">3.1.2. Phụ cấp khác:</p>
      <p>- Phụ cấp chỗ ở: <span class="hdld-ace-red">{{PC_CHO_O}}</span> đồng/tháng</p>
      <p>- Phụ cấp đi lại: <span class="hdld-ace-red">{{PC_DI_LAI}}</span> đồng/tháng</p>
      <p>- Phụ cấp điện thoại: <span class="hdld-ace-red">{{PC_DIEN_THOAI}}</span> đồng/tháng</p>
      <p>- Thưởng thêm khác theo quy định.</p>
      <p>- Hình thức trả lương: Tiền lương được thanh toán vào ngày 10 hàng tháng bằng hình thức chuyển khoản <em>(hoặc tiền mặt, tùy theo thỏa thuận)</em>. Trường hợp ngày 10 trùng vào thứ Bảy, Chủ nhật hoặc ngày nghỉ lễ, việc thanh toán sẽ được thực hiện vào ngày làm việc tiếp theo.</p>
      <p class="hdld-ace-sub-title">3.1.3. Các quyền lợi khác</p>
      <p>- Được tham gia Bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp theo quy định của Luật BHXH hiện hành.</p>
      <p>- Chế độ nâng lương: Theo chính sách nâng lương của công ty.</p>
      <p>- Chế độ ngày nghỉ: Nghỉ lễ có hưởng lương trong năm: Tết Dương Lịch (01 ngày), Ngày giỗ tổ Hùng Vương 10/03 âm lịch (01 ngày), 30/04 (01 ngày), 01/05 (01 ngày), 02/09 (02 ngày), Tết Nguyên Đán (05 ngày). Ngoài ra Bên B được nghỉ thêm 12 ngày phép trong năm, áp dụng đối với nhân viên làm việc đủ số ngày trong tháng và theo quy định công ty.</p>
      <p>- Chế độ ngày phép: Bên B được hưởng 12 ngày phép/năm.</p>
      <p class="hdld-ace-note-box"><strong>Lưu ý:</strong> <em>Áp dụng đủ 01 ngày phép khi nhân viên làm đủ số ngày trong tháng được tính nghỉ phép năm theo tỷ lệ thời gian làm việc thực tế trong năm. Phép năm chưa sử dụng trong năm khi đến tháng cuối cùng trong năm sẽ được công ty bố trí phù hợp. Trường hợp công ty đã bố trí lịch nghỉ phép hợp lý mà Bên B không sử dụng thì phần phép chưa nghỉ sẽ không được quy đổi thành tiền.</em></p>
      <p>Bên B được sử dụng tối đa 03 ngày phép năm/01 tháng <em>(Nếu muốn sử dụng hơn 3 ngày phép năm/01 tháng phải xin duyệt từ Ban Giám Đốc)</em></p>
    </div>
    <div class="hdld-ace-page-num">2</div>
  </div>
  <div class="hdld-ace-page">
    <div class="hdld-ace-doc-code">03.HĐLĐ – ACE</div>
    <div class="hdld-ace-article">
      <p class="hdld-ace-sub-title">- Các chế độ khác:</p>
      <p class="hdld-ace-indent">+ Nhân viên được tham gia các khóa đào tạo chuyên môn của công ty hoặc các chương trình đào tạo quốc tế và các chế độ theo quy định của công ty.</p>
      <p class="hdld-ace-indent">+ Nhân viên làm việc từ tháng thứ 03 trở về sau được xét hưởng thêm chế độ thưởng khác theo quy định của công ty.</p>
      <p class="hdld-ace-sub-title">3.2. Nghĩa vụ</p>
      <p><strong>3.2.1.</strong> Cam kết chấp hành nghiêm túc nội quy lao động, các thỏa thuận, quy chế của Công ty và quy định pháp luật. Trường hợp vi phạm sẽ bị xử lý kỷ luật theo quy định của pháp luật và nội quy Công ty.</p>
      <p><strong>3.2.2.</strong> Trong quá trình làm việc, Bên B có nghĩa vụ:</p>
      <p class="hdld-ace-indent">Đảm bảo đúng thời gian làm việc, chất lượng giảng dạy, chăm sóc học viên sát sao và thực hiện đúng chương trình đào tạo nếu có lớp giảng dạy;</p>
      <p class="hdld-ace-indent">Tạo dựng môi trường học tập an toàn, tích cực, công bằng và nhân văn cho tất cả học viên;</p>
      <p class="hdld-ace-indent">Ứng xử văn minh, tôn trọng học viên; tuyệt đối nghiêm cấm mọi hành vi bạo hành, đe dọa, la mắng, xúc phạm, kỳ thị hoặc phân biệt đối xử với học viên dưới bất kỳ hình thức nào.</p>
      <p><strong>3.2.3.</strong> Chấp hành việc điều động, luân chuyển theo phân công công việc của Công ty.</p>
      <p><strong>3.2.4.</strong> Trường hợp Bên B xin nghỉ việc, phải thông báo trước cho Công ty tối thiểu 45 ngày theo quy định tại Điều 35 Bộ luật Lao động 2019 và theo thỏa thuận. Đồng thời, có trách nhiệm bàn giao đầy đủ công việc cho người thay thế do Công ty chỉ định.</p>
      <p><strong>3.2.5.</strong> Bên B cam kết bảo mật và không tiết lộ bất kỳ thông tin nào liên quan đến công việc, tài liệu, dữ liệu và các nội dung khác do Bên A cung cấp cho bất kỳ bên thứ ba nào trong suốt quá trình hợp tác và cả sau khi hợp đồng kết thúc.</p>
      <p class="hdld-ace-article-title">Điều 4: Nghĩa vụ và quyền hạn của Bên A</p>
      <p class="hdld-ace-sub-title">4.1 Nghĩa vụ</p>
      <p><strong>4.1.1.</strong> Bảo đảm việc làm và thực hiện đầy đủ những điều đã cam kết trong hợp đồng lao động này.</p>
      <p><strong>4.1.2.</strong> Thanh toán lương đầy đủ, đúng thời hạn và đảm bảo thực hiện đúng các chế độ và quyền lợi cho nhân viên theo hợp đồng lao động và theo quy định của công ty.</p>
      <p><strong>4.1.3.</strong> Trường hợp bất khả kháng khiến công ty tạm ngưng hoạt động <em>(do thiên tai, dịch bệnh, chiến tranh, hỏa hoạn…)</em> công ty ngưng trả lương và ngưng các khoản trợ cấp theo hợp đồng. Bên A có thể hỗ trợ Bên B tùy theo tình hình tài chính thực tế của Bên A.</p>
      <p class="hdld-ace-sub-title">4.2 Quyền hạn</p>
      <p><strong>4.2.1.</strong> Điều hành nhân viên hoàn thành công việc theo Hợp đồng <em>(bố trí, điều chuyển, phân công công việc, v.v...).</em></p>
      <p><strong>4.2.2.</strong> Công ty có quyền tạm hoãn, chấm dứt Hợp đồng với Bên B, khi Bên B vi phạm</p>
    </div>
    <div class="hdld-ace-page-num">3</div>
  </div>
  <div class="hdld-ace-page">
    <div class="hdld-ace-doc-code">03.HĐLĐ – ACE</div>
    <div class="hdld-ace-article">
      <p>kỷ luật, gây mất đoàn kết nội bộ trong công ty, cãi nhau, đánh nhau, sử dụng các chất cấm, vi phạm văn hóa công ty, vi phạm nội quy của công ty và pháp luật có liên quan.</p>
      <p>Khi đó Bên B phải bồi thường những thiệt hại <em>(nếu có)</em> cho công ty hoặc các bên có liên quan. Việc bồi thường được xác định dựa trên mức độ thiệt hại thực tế và theo nguyên tắc tại Điều 130 Bộ luật Lao động 2019.</p>
    </div>
    <div class="hdld-ace-article">
      <p class="hdld-ace-article-title">Điều 5: Điều khoản chung</p>
      <p>Trong các trường hợp bất khả kháng được nêu ở trên thì hai bên sẽ chấm dứt Hợp đồng lao động mà không bên nào phải đền bù tổn thất cho bên còn lại.</p>
      <p>Nếu có tranh chấp các bên ngồi lại trên tinh thần đàm phán và tôn trọng lẫn nhau, nếu không thể giải quyết được thì các bên có quyền khởi kiện bên còn lại ra Tòa án của Việt Nam. Bên thua kiện chịu các khoản án phí theo quy định.</p>
      <p>Hợp đồng này được lập bằng tiếng Việt Nam, theo quy định của Luật pháp Việt Nam và phán quyết của Tòa án Việt Nam.</p>
      <p>Thuế thu nhập cá nhân <em>(TNCN)</em>: Bên A có trách nhiệm khấu trừ thuế TNCN theo quy định pháp luật hiện hành trước khi thanh toán tiền lương cho Bên B.</p>
      <p>Cả hai Bên A và Bên B cùng đọc và hiểu các điều khoản trong hợp đồng này cùng đồng thuận, tự nguyện ký hợp đồng và không có bất kỳ khiếu nại về sau.</p>
      <p>Hợp đồng lao động này được làm thành 03 bản có giá trị ngang nhau, Bên A giữ 02 bản và Bên B giữ 01 bản và có hiệu lực từ ngày ký./.</p>
    </div>
    <table class="hdld-ace-sig-table">
      <tr>
        <td>
          <p class="hdld-ace-sig-title">NGƯỜI SỬ DỤNG LAO ĐỘNG</p>
          <p class="hdld-ace-sig-sub">(Ký tên, đóng dấu và ghi rõ họ và tên)</p>
          <div class="hdld-ace-sig-space"></div>
        </td>
        <td>
          <p class="hdld-ace-sig-title">NGƯỜI LAO ĐỘNG</p>
          <p class="hdld-ace-sig-sub">(Ký và ghi rõ họ và tên)</p>
          <div class="hdld-ace-sig-space"></div>
        </td>
      </tr>
    </table>
    <div class="hdld-ace-page-num">4</div>
  </div>
`;

function HdldAceHtml({ data, contractVariant }) {
  const fill = (val, dots) => {
    const s = String(val ?? '').trim();
    return s ? s : String(dots ?? '................');
  };

  const so = soHdBase(data.so_hd) || '';
  const ky = dateParts(data.ngay_ky);
  const tu = dateParts(data.tu_ngay);
  const ngayKyLong = ky.d && ky.m && ky.y ? `${ky.d} tháng ${ky.m} năm ${ky.y}` : '';
  const tuNgayLong = tu.d && tu.m && tu.y ? `${tu.d} tháng ${tu.m} năm ${tu.y}` : '';

  const map = {
    SO_HD: fill(so, '........../....'),
    NGAY_KY_LONG: ngayKyLong,
    NGAY_KY_D: fill(ky.d, '....'),
    NGAY_KY_M: fill(ky.m, '....'),
    NGAY_KY_Y: fill(ky.y, '....'),
    HO_TEN: fill(data.ho_ten, '........................'),
    QUOC_TICH: fill(data.quoc_tich || 'Việt Nam', '........................'),
    NGAY_SINH: fill(formatDateVN(data.ngay_sinh), '....../....../........'),
    NOI_SINH: fill(data.noi_sinh, '........................'),
    CCCD: fill(data.cccd, '........................'),
    NOI_CAP: fill(data.noi_cap, '........................'),
    NGAY_CAP: fill(formatDateVN(data.ngay_cap), '....../....../........'),
    DIEN_THOAI: fill(data.so_dien_thoai, '........................'),
    EMAIL: fill(data.email, '........................'),
    DIA_CHI_THUONG_TRU: fill(data.dia_chi, '........................'),
    DIA_CHI_TAM_TRU: fill(data.tam_tru, '........................'),
    LOAI_HOP_DONG: contractVariant && contractVariant.desc ? contractVariant.desc : 'Hợp đồng lao động không xác định thời hạn.',
    TU_NGAY_LONG: tuNgayLong,
    TU_NGAY_D: fill(tu.d, '....'),
    TU_NGAY_M: fill(tu.m, '....'),
    TU_NGAY_Y: fill(tu.y, '....'),
    CHUC_DANH: fill(data.chuc_vu, '........................'),
    LUONG: fill(data.luong, '........................'),
    LUONG_CHU: fill(data.luong_chu, '........................................................'),
    PC_CHO_O: fill(data.phu_cap_cho_o, '........................'),
    PC_DI_LAI: fill(data.phu_cap_di_lai, '........................'),
    PC_DIEN_THOAI: fill(data.phu_cap_dt, '........................'),
  };

  let html = HDLD_ACE_HTML_TEMPLATE;
  Object.keys(map).forEach((k) => {
    html = html.split(`{{${k}}}`).join(escapeHtml(map[k]));
  });

  return (
    <div className="hdld-ace-root">
      <style dangerouslySetInnerHTML={{ __html: HDLD_ACE_HTML_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ─── Component: Tìm kiếm ──────────────────────────────────────────────────────
function SearchFromSheet({ onSelect, employees = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults]   = useState(employees);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setResults(employees);
  }, [employees]);

  const handleSearch = (val) => {
    setQuery(val);
    const q = val.toLowerCase();
    setResults(!val.trim() ? employees : employees.filter(s =>
      s.name.toLowerCase().includes(q) || (s.id && String(s.id).toLowerCase().includes(q))
    ));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" />
        <input type="text" value={query} onChange={e => handleSearch(e.target.value)}
          placeholder="Tìm theo Tên hoặc Mã nhân viên..."
          className="w-full pl-11 py-3 border-2 border-red-200 focus:border-red-400 rounded-xl outline-none text-red-700 placeholder-red-400 text-sm transition-colors bg-white" />
      </div>
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {results.map((s, i) => (
          <button key={i} onClick={() => { setSelected(s); onSelect(s); }}
            className={`w-full text-left flex items-center justify-between p-3.5 rounded-xl border-2 transition-all
              ${selected?.id === s.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white hover:border-indigo-200'}`}>
            <div>
              <div className="font-bold text-sm text-slate-800">{s.name}</div>
              <div className="text-xs text-slate-400">{s.id || '---'} · {s.position}</div>
            </div>
            {selected?.id === s.id && <CheckCircle2 size={18} className="text-indigo-500 flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateDdMmYyyyField({ valueIso, onChangeIso, placeholder = 'dd/mm/yyyy', disabled = false }) {
  const [text, setText] = useState(() => isoToDdMmYyyy(valueIso));
  const [invalid, setInvalid] = useState(false);
  const dateRef = useRef(null);

  useEffect(() => {
    setText(isoToDdMmYyyy(valueIso));
    setInvalid(false);
  }, [valueIso]);

  const sanitize = (s) => String(s || '').replace(/[^\d/]/g, '').slice(0, 10);

  const onTextChange = (v) => {
    const nextText = sanitize(v);
    setText(nextText);
    if (nextText.length === 10) {
      const iso = parseDdMmYyyyToIso(nextText);
      if (iso) {
        setInvalid(false);
        onChangeIso(iso);
      } else {
        setInvalid(true);
        onChangeIso('');
      }
    } else {
      setInvalid(false);
      if (!nextText) onChangeIso('');
    }
  };

  const openPicker = () => {
    if (disabled) return;
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={text}
        disabled={disabled}
        onChange={(e) => onTextChange(e.target.value)}
        onBlur={() => {
          if (!text) return;
          if (text.length !== 10) {
            setInvalid(true);
            onChangeIso('');
            return;
          }
          const iso = parseDdMmYyyyToIso(text);
          setInvalid(!iso);
          if (!iso) onChangeIso('');
        }}
        placeholder={placeholder}
        className={`w-full pr-12 px-4 py-2.5 border-2 rounded-lg outline-none text-sm transition-all bg-slate-50/50 ${invalid ? 'border-red-300 focus:border-red-400' : 'border-slate-100 focus:border-indigo-400'} ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        aria-label="Chọn ngày"
        disabled={disabled}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 9H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 6H18C19.1046 6 20 6.89543 20 8V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V8C4 6.89543 4.89543 6 6 6Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <input
        ref={dateRef}
        type="date"
        value={isIsoDateString(valueIso) ? valueIso : ''}
        onChange={(e) => {
          const iso = String(e.target.value || '').trim();
          setInvalid(false);
          onChangeIso(iso);
        }}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
}

// ─── Component: Form nhập thủ công ────────────────────────────────────────────
function ManualForm({ data, onChange, positionOptions = [], lockSoHd = false, fieldErrors = {}, showDenNgay = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {CONTRACT_FIELDS.filter(f => (f.key !== 'den_ngay') || showDenNgay).map(f => (
        <div key={f.key} className={f.key === 'dia_chi' || f.key === 'tam_tru' ? 'md:col-span-2' : ''}>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            {f.label} {f.required && <span className="text-red-400">*</span>} {(f.key === 'ngay_ky' || f.key === 'den_ngay') && <span className="ml-1 text-[10px] font-bold text-slate-400 normal-case">(dd/mm/yyyy)</span>}
          </label>
          {f.key === 'chuc_vu' ? (
            <>
              <input
                list="ace-position-options"
                type="text"
                value={data[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 border-2 border-slate-100 focus:border-indigo-400 rounded-lg outline-none text-sm transition-all bg-slate-50/50"
              />
              <datalist id="ace-position-options">
                {positionOptions.map(p => <option key={p} value={p} />)}
              </datalist>
            </>
          ) : f.key === 'ngay_ky' || f.key === 'den_ngay' ? (
            <>
              <DateDdMmYyyyField
                valueIso={data[f.key] || ''}
                onChangeIso={(iso) => onChange(f.key, iso)}
                placeholder={f.placeholder || 'dd/mm/yyyy'}
              />
              {fieldErrors[f.key] && (
                <div className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors[f.key]}</div>
              )}
            </>
          ) : (
            <input
              type={f.type || 'text'}
              value={data[f.key] || ''}
              disabled={lockSoHd && f.key === 'so_hd'}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              readOnly={f.key === 'luong_chu'}
              className={`w-full px-4 py-2.5 border-2 rounded-lg outline-none text-sm transition-all bg-slate-50/50 ${f.key === 'luong_chu' ? 'border-slate-100 text-slate-700' : 'border-slate-100 focus:border-indigo-400'} ${lockSoHd && f.key === 'so_hd' ? 'cursor-not-allowed opacity-80' : ''}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function A4Page({ pageNum, headerText, children, backgroundUrl }) {
  return (
    <div className="flex flex-col items-center">
      <div className="no-print w-[210mm] flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold text-white shadow-md bg-indigo-600">
          <span>TRANG {pageNum}</span>
        </div>
      </div>
      <section className="page max-w-[210mm] relative" style={backgroundUrl ? { 
        backgroundImage: `url(${backgroundUrl})`, 
        backgroundSize: '100% 100%',
        padding: 0 
      } : {}}>
        {!backgroundUrl && (
          <>
            <div className="page-header">{headerText}</div>
            <div className="page-content">{children}</div>
            <div className="page-footer">{pageNum}</div>
          </>
        )}
        {backgroundUrl && (
          <div className="absolute inset-0">
            {children}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Component: Trường dữ liệu tuyệt đối (cho Overlay) ──────────────────────────
function Field({ top, left, value, className = "" }) {
  return (
    <div 
      className={`absolute text-blue-600 font-bold text-[13pt] ${className}`}
      style={{ top, left, transform: 'translateY(-50%)' }}
    >
      {value || '................'}
    </div>
  );
}

// ─── Component Preview chính ──────────────────────────────────────────────────
export function ContractPreview({ data, contractTypeId, position: _position, agreementTypeId, commitmentTypeId: _commitmentTypeId, onEdit, onPrint: _onPrint, isPrinting }) {
  const [docxBusy, setDocxBusy] = useState(false);
  const [docxError, setDocxError] = useState('');
  const [docxTemplateFile, setDocxTemplateFile] = useState(null);
  const docxFileRef = useRef(null);
  const [localData, setLocalData] = useState(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const isAdmin = (localStorage.getItem('user_role') || '') === 'admin';
  const branch = String(localStorage.getItem('user_branch') || '').trim();
  const allEmployees = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('ace_hrm_employees_v1') || '[]') || [];
    } catch (_) {
      return [];
    }
  }, []);
  const previewEmployees = React.useMemo(() => {
    if (isAdmin) return allEmployees;
    return allEmployees.filter(e => String(e.department || '').trim() === branch);
  }, [allEmployees, branch, isAdmin]);

  const contractGroup = DOCUMENT_TEMPLATES.find(t => t.type === 'contract');
  const contractVariantMap = {
    'hoc-viec': 'hd-thuviec',
    'thu-viec-ft': 'hd-thuviec',
    'hdld-ft': 'hd-fulltime',
    'hdld-pt-bhxh': 'hd-parttime',
    'cong-tac-vien': 'hd-parttime',
  };
  const vId = contractVariantMap[contractTypeId] || 'hd-fulltime';
  const contractVariant = contractGroup?.variants.find(v => v.id === vId) || contractGroup?.variants.find(v => v.id === 'hd-fulltime') || null;

  const fmt = (s) => {
    if (!s) return { d: '...', m: '...', y: '....' };
    const dt = new Date(s);
    return { d: dt.getDate().toString().padStart(2,'0'), m: (dt.getMonth()+1).toString().padStart(2,'0'), y: dt.getFullYear() };
  };
  const ky   = fmt(localData.ngay_ky);
  const sinh = fmt(localData.ngay_sinh);
  const cap  = fmt(localData.ngay_cap);
  const tu   = fmt(localData.tu_ngay);

  const V = ({ v, blank = '...............' }) => <span className="red">{v || blank}</span>;

  let pageNum = 1;

  const handleSelectPreviewEmployee = (s) => {
    const next = {
      ...localData,
      ma_nv: s.id,
      so_hd: computeSoHdFromMaNv(s.id),
      ho_ten: s.name,
      email: s.email,
      so_dien_thoai: s.phone,
      chuc_vu: canonicalPositionLabel(s.position),
      tu_ngay: s.startDate,
      cccd: s.cccd || '',
      dia_chi: s.address || '',
      tam_tru: s.currentAddress || '',
      ngay_sinh: s.dob || '',
      ngay_cap: s.cccd_date || '',
      noi_cap: s.cccd_place || localData.noi_cap,
      luong: formatMoneyDots(s.salary) || '',
      luong_chu: moneyToWords(formatMoneyDots(s.salary)) || s.salary_text || '',
    };
    setLocalData(next);
    localStorage.setItem('preview_data', JSON.stringify(next));
  };

  const ensurePreviewValid = () => {
    const v = validateContractData(localData, { contractTypeId, agreementTypeId });
    if ((v.missing || []).length > 0) throw new Error(`Thiếu thông tin: ${(v.missing || []).join(', ')}`);
    const keys = Object.keys(v.fieldErrors || {});
    if (keys.length > 0) throw new Error(Object.values(v.fieldErrors || {}).join(' | '));
  };

  const handleDownloadWord = async () => {
    setDocxError('');
    setDocxBusy(true);
    try {
      ensurePreviewValid();
      const so = String(localData.so_hd || '').trim();
      const hoTen = String(localData.ho_ten || '').trim();
      const chiNhanh = String(localStorage.getItem('user_branch') || '').trim();
      const baseName = makeSafeFileName([chiNhanh, so, hoTen].filter(Boolean).join(' - '));
      const outName = makeSafeFileName(`HOP_DONG - ${baseName}`);
      const issueKey = computeIssueKey({ branch: chiNhanh, soHd: so, ngayKy: localData.ngay_ky });

      if (docxTemplateFile) {
        await createDocxFromTemplateFile(docxTemplateFile, localData, outName);
        const entry = {
          issueKey,
          method: 'DOCX_TEMPLATE',
          soHd: so,
          employeeId: String(localData.ma_nv || '').trim(),
          employeeName: String(localData.ho_ten || '').trim(),
          branch: chiNhanh,
          chuc_vu: String(localData.chuc_vu || '').trim(),
          filename: `${outName}.docx`,
        };
        appendContractIssueLogLocal(entry);
        postContractIssueLog(entry);
        return;
      }
      const labels = [
        optionLabel(CONTRACT_DOC_TYPE_OPTIONS, contractTypeId),
        optionLabel(AGREEMENT_DOC_TYPE_OPTIONS, agreementTypeId),
        optionLabel(COMMITMENT_DOC_TYPE_OPTIONS, _commitmentTypeId),
      ];

      let firstEntry = null;

      for (const label of labels) {
        if (!label) continue;

        const totalUrl = getTotalHdDocxUrlFromLabel(label);
        if (!totalUrl) continue;

        try {
          await createDocxFromTemplateUrl(totalUrl, localData, `${outName} - ${label}`);

          if (!firstEntry) {
            firstEntry = {
              issue_key: issueKey,
              method: 'DOCX_TOTAL',
              so_hd: so,
              employee_id: String(localData.ma_nv || '').trim(),
              employee_name: String(localData.ho_ten || '').trim(),
              branch: chiNhanh,
              chuc_vu: String(localData.chuc_vu || '').trim(),
              filename: `${outName} - ${label}.docx`,
              created_at: new Date().toISOString(),
            };
          }

        } catch (err) {
          console.warn('Lỗi tạo docx:', label, err);
        }
      }

      // ✅ insert DB sau loop
      if (firstEntry) {
        const { data, error } = await supabase
          .from('contract_logs') // tên table của bạn
          .insert([firstEntry]);

        if (error) {
          console.error('❌ Supabase insert lỗi:', error);
        } else {
          console.log('✅ Đã lưu DB:', data);
        }
      }
    } catch (e) {
      setDocxError(e.message || String(e));
      if (!docxTemplateFile && docxFileRef.current) docxFileRef.current.click();
    } finally {
      setDocxBusy(false);
    }
  };

  const isTrialBorder = String(soHdBase(localData.so_hd || '')).trim() && String(soHdBase(localData.so_hd || '')).trim() === String(localData.ma_nv || '').trim();

  return (
    <div className="min-h-screen bg-slate-300 flex flex-col items-center pv-wrapper py-10" id="print-root">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      <div className="no-print w-[210mm] flex gap-4 mb-8 sticky top-4 z-10">
        <button onClick={onEdit} className="flex-1 py-4 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl shadow-md hover:bg-slate-50 transition-all flex justify-center items-center gap-2">
          <X size={18} /> Quay lại chỉnh sửa
        </button>
        <button onClick={handleDownloadWord} disabled={docxBusy || isPrinting} className="flex-1 py-4 bg-slate-900 text-white font-extrabold rounded-xl shadow-xl hover:bg-slate-950 disabled:opacity-50 transition-all flex justify-center items-center gap-2">
          {docxBusy ? <><Loader2 size={18} className="animate-spin" /> Đang tạo Word...</> : <>Tải Word (.docx)</>}
        </button>
      </div>

      {docxError && (
        <div className="no-print w-[210mm] -mt-4 mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          {docxError && (
            <div className="bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold text-red-600">
              {docxError}
            </div>
          )}
        </div>
      )}

      <main className="document" style={isTrialBorder ? { border: '4px solid #E11920' } : undefined}>
        {!contractVariant && (
          <div className="text-slate-500 text-center py-20 font-sans">Chưa chọn loại hợp đồng.</div>
        )}

        {contractVariant && (
          <>
            {contractVariant.id === 'hd-fulltime' ? (
              <HdldAceHtml data={localData} contractVariant={contractVariant} />
            ) : (
              <>
            <A4Page pageNum={pageNum++} headerText="03.HĐLĐ - ACE">
              <div className="top-grid">
                <div className="left-block">
                  <p className="bold center">CÔNG TY TNHH PHÁT TRIỂN<br/>GIÁO DỤC ACE</p>
                  <p className="center">Số: <span className="red">{localData.so_hd ? soHdBase(localData.so_hd) : '.../26'}</span>/HĐLĐ-ACE</p>
                </div>
                <div className="right-block">
                  <p className="country-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="country-title">Độc lập – Tự do – Hạnh phúc</p>
                </div>
              </div>
              <p className="italic">- Căn cứ Bộ luật Lao động số 45/2019/QH14 ngày 20 tháng 11 năm 2019;</p>
              <p className="italic">- Căn cứ Nghị định số 145/2020/NĐ-CP ngày 14 tháng 12 năm 2020 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Bộ luật Lao động;</p>
              <p className="italic gap">- Căn cứ Nội quy lao động và nhu cầu sử dụng lao động thực tế của Công ty;</p>
              <div className="main-title">HỢP ĐỒNG LAO ĐỘNG</div>
              <p className="italic">Hôm nay, ngày <span className="red">{ky.d}</span> tháng <span className="red">{ky.m}</span> năm {ky.y}, tại Thành phố Hồ Chí Minh, Chúng tôi gồm có:</p>
              <p className="bold">Bên A (Người sử dụng lao động): CÔNG TY TNHH PHÁT TRIỂN GIÁO DỤC ACE</p>
              <p>Địa chỉ: Số 201, Lê Lợi, xã Xuân Thới Sơn, Thành phố Hồ Chí Minh</p>
              <p>Mã Số doanh nghiệp/ mã số Thuế: 0318914647</p>
              <p>Đại diện pháp luật: Bà <span className="bold">TRƯƠNG KIỀU OANH</span></p>
              <p>Chức vụ: Giám đốc</p>
              <p className="small-gap">Điện thoại: 0909259555</p>
              <p className="gap">&nbsp;</p>

              <p><span className="bold">Bên B (Người lao động):</span> Ông/Bà: <span className="red bold uppercase">{localData.ho_ten || '..............................'}</span></p>
              <p>Quốc tịch: {localData.quoc_tich} sinh ngày: <V v={`${sinh.d}/${sinh.m}/${sinh.y}`}/> tại: <V v={localData.noi_sinh}/></p>
              <p>Số CMND/CCCD: <V v={localData.cccd}/> do {localData.noi_cap}, cấp ngày: <V v={`${cap.d}/${cap.m}/${cap.y}`}/>.</p>
              <p>Số điện thoại: <V v={localData.so_dien_thoai}/></p>
              <p>Email: <V v={localData.email}/></p>
              <p>Địa chỉ thường trú: <V v={localData.dia_chi}/></p>
              <p className="small-gap">Địa chỉ tạm trú: <V v={localData.tam_tru}/></p>
              <p className="gap">&nbsp;</p>

              <p className="italic">Thỏa thuận ký kết hợp đồng lao động và cam kết thực hiện đúng những điều khoản sau:</p>
              <p className="section-title">Điều 1: Thời hạn và công việc hợp đồng</p>
              <p>Loại hợp đồng: {contractVariant.desc || 'Hợp đồng lao động không xác định thời hạn'}.</p>
              <p>- Thời gian làm việc chính thức: từ ngày <V v={`${tu.d}/${tu.m}/${tu.y}`} /></p>
              <p>- Địa điểm làm việc: Công Ty TNHH Phát Triển Giáo Dục ACE <span className="italic">(kèm theo)</span></p>
              <p>- Chức danh chuyên môn: <V v={localData.chuc_vu}/></p>
              <p>- Công việc theo sự phân công.</p>
              <p className="section-title">Điều 2: Chế độ làm việc</p>
            </A4Page>

            <A4Page pageNum={pageNum++} headerText="03.HĐLĐ - ACE">
              <p><span className="bold">2.1.</span> Thời gian làm việc: 8 tiếng/ ngày; theo nội quy công ty.</p>
              <p className="gap"><span className="bold">2.2.</span> Đồng phục và các trang thiết bị làm việc sẽ được công ty cấp phát tùy theo nhu cầu của công việc</p>

              <p className="section-title">Điều 3: Nghĩa vụ và quyền lợi của Bên B</p>
              <p className="bold">3.1. Quyền lợi</p>
              <p className="bold">3.1.1. Tiền lương và hình thức trả lương</p>
              <p>Mức lương cơ bản: <V v={localData.luong}/> đồng/tháng.</p>
              <p>(Số tiền bằng chữ: <V v={localData.luong_chu}/>)</p>
              <p><span className="bold">3.1.2.</span> Phụ cấp khác:</p>
              <p className="indent-1">- Phụ cấp chỗ ở: <V v={localData.phu_cap_cho_o || '0'} /> đồng/tháng</p>
              <p className="indent-1">- Phụ cấp đi lại: <V v={localData.phu_cap_di_lai || '0'} /> đồng/tháng</p>
              <p className="indent-1">- Phụ cấp điện thoại: <V v={localData.phu_cap_dt || '0'} /> đồng/tháng</p>
              <p className="indent-1">- Thưởng thêm khác theo quy định.</p>
              <p>- Hình thức trả lương: Tiền lương được thanh toán vào ngày 10 hàng tháng bằng chuyển khoản.</p>

              <p className="bold">3.1.3. Các quyền lợi khác</p>
              <p>- Được tham gia Bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp theo quy định.</p>
              <p>- Chế độ nâng lương: Theo chính sách nâng lương của công ty</p>
              <p>- Chế độ ngày nghỉ: Nghỉ lễ có hưởng lương trong năm: Tết Dương Lịch (01 ngày), Giờ tổ Hùng Vương (01 ngày), 30/04 (01 ngày), 01/05 (01 ngày), 02/09 (02 ngày), Tết Âm lịch. Phép năm: 12 ngày/năm.</p>
              <p>- Các chế độ khác:</p>
              <p className="indent-1">+ Tham gia các khóa đào tạo chuyên môn của công ty.</p>
            </A4Page>

            <A4Page pageNum={pageNum++} headerText="03.HĐLĐ - ACE">
              <p className="indent-1 gap">+ Nhân viên làm việc từ tháng thứ 03 trở về sau được xét thưởng thêm.</p>

              <p className="bold">3.2. Nghĩa vụ</p>
              <p><span className="bold">3.2.1.</span> Cam kết chấp hành nghiêm túc nội quy lao động, các thỏa thuận, quy chế của Công ty.</p>
              <p><span className="bold">3.2.2.</span> Trong quá trình làm việc, Bên B có nghĩa vụ:</p>
              <p className="indent-1">Đảm bảo đúng thời gian làm việc, chất lượng giảng dạy, chăm sóc học viên sát sao;</p>
              <p className="indent-1">Tạo dựng môi trường học tập an toàn, tích cực, công bằng và nhân văn cho tất cả học viên;</p>
              <p className="indent-1">Ứng xử văn minh, tôn trọng học viên.</p>
              <p><span className="bold">3.2.3.</span> Chấp hành việc điều động, luân chuyển theo phân công công việc.</p>
              <p><span className="bold">3.2.4.</span> Khi xin nghỉ việc, phải thông báo trước tối thiểu 45 ngày theo quy định tại Điều 35 BLLĐ 2019 và có trách nhiệm bàn giao đầy đủ công việc.</p>
              <p className="gap"><span className="bold">3.2.5.</span> Cam kết bảo mật mọi thông tin do Bên A cung cấp.</p>

              <p className="section-title">Điều 4: Nghĩa vụ và quyền hạn của Bên A</p>
              <p className="bold">4.1 Nghĩa vụ</p>
              <p><span className="bold">4.1.1.</span> Bảo đảm việc làm và thực hiện đầy đủ cam kết trong HĐLĐ.</p>
              <p><span className="bold">4.1.2.</span> Thanh toán lương đầy đủ, đúng thời hạn.</p>
              <p><span className="bold">4.1.3.</span> Trường hợp bất khả kháng phải tạm ngưng hoạt động, công ty ngưng trả lương và hỗ trợ dựa trên tình hình thực tế.</p>
              <p className="bold">4.2 Quyền hạn</p>
              <p><span className="bold">4.2.1.</span> Điều hành và đánh giá nhân viên.</p>
            </A4Page>

            <A4Page pageNum={pageNum++} headerText="03.HĐLĐ - ACE">
              <p><span className="bold">4.2.2.</span> Quyền tạm hoãn, chấm dứt Hợp đồng khi Bên B vi phạm kỷ luật.</p>
              <p>Bên B phải bồi thường những thiệt hại (nếu có) theo nguyên tắc BLLĐ.</p>

              <p className="section-title">Điều 5: Điều khoản chung</p>
              <p>Trong các trường hợp bất khả kháng, hai bên sẽ chấm dứt Hợp đồng lao động mà không phải đền bù.</p>
              <p>Tranh chấp giải quyết trên tinh thần hòa giải hoặc thỏa thuận. Nếu không giải quyết được sẽ kiện ra Tòa án Việt Nam.</p>
            </A4Page>
            
            <A4Page pageNum={pageNum++} headerText="03.HĐLĐ - ACE">
              <p>Hợp đồng này được lập bằng tiếng Việt Nam, theo quy định của Luật pháp Việt Nam.</p>
              <p>Thuế thu nhập cá nhân: Bên A có trách nhiệm khấu trừ thuế TNCN theo pháp luật trước khi thanh toán cho Bên B.</p>
              <p className="gap">Hai Bên cùng đọc, hiểu và đồng thuận tự nguyện ký hợp đồng.</p>
              <p>Hợp đồng lao động này làm thành 03 bản, Bên A giữ 02 bản, Bên B giữ 01 bản, hiệu lực từ ngày ký./.</p>
              <div className="signature-grid">
                <div>
                  <p>NGƯỜI SỬ DỤNG LAO ĐỘNG</p>
                  <p>(Ký tên, đóng dấu và ghi rõ họ và tên)</p>
                  <div className="signature-space"></div>
                  <p>TRƯƠNG KIỀU OANH</p>
                </div>
                <div>
                  <p>NGƯỜI LAO ĐỘNG</p>
                  <p>(Ký và ghi rõ họ và tên)</p>
                  <div className="signature-space"></div>
                  <p className="uppercase">{localData.ho_ten || '.........................'}</p>
                </div>
              </div>
            </A4Page>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── ContractView — Main ──────────────────────────────────────────────────────
export default function ContractView({ onLogout, employees = [], userRole, initialEmployeeId, initialMode, branch, setTasks }) {
  const [step, _setStep] = useState('input');
  const [selectedContractType, setSelectedContractType] = useState(() => localStorage.getItem('contract_type') || 'hdld-ft');
  const [selectedPosition, setSelectedPosition] = useState(() => canonicalPositionLabel(localStorage.getItem('contract_position') || ''));
  const [selectedAgreementType, setSelectedAgreementType] = useState(() => localStorage.getItem('agreement_type') || '');
  const [selectedCommitmentType, setSelectedCommitmentType] = useState(() => localStorage.getItem('commitment_type') || '');
  const [reviewDocKind, setReviewDocKind] = useState(() => localStorage.getItem('ace_docx_review_kind') || 'contract');
  const [reviewAll, setReviewAll] = useState(() => localStorage.getItem('ace_docx_review_all') === '1');
  const [reviewContractDocx, setReviewContractDocx] = useState(null);
  const [reviewAgreementDocx, setReviewAgreementDocx] = useState(null);
  const [reviewCommitmentDocx, setReviewCommitmentDocx] = useState(null);
  const contractDocxRef = useRef(null);
  const agreementDocxRef = useRef(null);
  const commitmentDocxRef = useRef(null);
  const CUSTOM_POSITION_VALUE = '__custom_position__';
  const [positionSelectValue, setPositionSelectValue] = useState(() => canonicalPositionLabel(localStorage.getItem('contract_position') || ''));
  const [positionCustomValue, setPositionCustomValue] = useState(() => canonicalPositionLabel(localStorage.getItem('contract_position') || ''));

  const [contractTypeDocs, setContractTypeDocs] = useState(() => loadContractTypeDocs());
  const [agreementDocs, setAgreementDocs] = useState(() => loadAgreementDocs());
  const [commitmentDocs, setCommitmentDocs] = useState(() => loadCommitmentDocs());
  const [mode, setMode] = useState(initialMode || 'search');
  const [quickRows, setQuickRows] = useState([]);
  const [quickError, setQuickError] = useState('');
  const [quickQuery, setQuickQuery] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickFileName, setQuickFileName] = useState('');
  const quickFileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    ngay_ky:   new Date().toISOString().slice(0, 10),
    quoc_tich: 'Việt Nam',
    noi_sinh:  'TP. Hồ Chí Minh',
    noi_cap:   'Cục Cảnh sát QLHC về TTXH',
  });
  const [errors, setErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [printInfoCollapsed, setPrintInfoCollapsed] = useState(() => localStorage.getItem('ace_print_info_collapsed') === '1');
  const [quickPrintInfoCollapsed, setQuickPrintInfoCollapsed] = useState(() => localStorage.getItem('ace_quick_print_info_collapsed') === '1');
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    localStorage.setItem('ace_print_info_collapsed', printInfoCollapsed ? '1' : '0');
  }, [printInfoCollapsed]);

  useEffect(() => {
    localStorage.setItem('ace_quick_print_info_collapsed', quickPrintInfoCollapsed ? '1' : '0');
  }, [quickPrintInfoCollapsed]);

  const filteredEmployees = React.useMemo(() => {
    if (isAdmin) return employees;
    return employees.filter(e => e.department === branch);
  }, [branch, employees, isAdmin]);

  const positionOptions = React.useMemo(() => {
    const map = new Map();
    filteredEmployees.forEach(e => {
      const raw = String(e.position || '').trim();
      const key = normalizePositionKey(raw);
      if (!key) return;
      const preferred = preferredPositionLabelByKey(key);
      const label = preferred || raw;
      if (!map.has(key)) map.set(key, label);
      else if (preferred) map.set(key, preferred);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [filteredEmployees]);

  const applyPositionSelection = React.useCallback((pos) => {
    const p = canonicalPositionLabel(pos);
    setSelectedPosition(p);
    localStorage.setItem('contract_position', p);
  }, []);

  useEffect(() => {
    if (!selectedPosition) {
      setPositionSelectValue('');
      setPositionCustomValue('');
      return;
    }
    if (positionOptions.includes(selectedPosition)) {
      setPositionSelectValue(selectedPosition);
      setPositionCustomValue('');
      return;
    }
    setPositionSelectValue(CUSTOM_POSITION_VALUE);
    setPositionCustomValue(selectedPosition);
  }, [CUSTOM_POSITION_VALUE, positionOptions, selectedPosition]);

  const applyContractTypeSelection = (typeId) => {
    const id = String(typeId || '').trim();
    setSelectedContractType(id);
    localStorage.setItem('contract_type', id);
  };

  const activeReview = React.useMemo(() => {
    if (reviewDocKind === 'agreement') {
      const label = selectedAgreementType ? optionLabel(AGREEMENT_DOC_TYPE_OPTIONS, selectedAgreementType) : '';
      return {
        title: selectedAgreementType ? `📝 ${label}` : '📝 Thỏa thuận công việc',
        templateUrl: label ? getTotalHdDocxUrlFromLabel(label) : '',
        templateFile: reviewAgreementDocx,
      };
    }
    if (reviewDocKind === 'commitment') {
      const label = selectedCommitmentType ? optionLabel(COMMITMENT_DOC_TYPE_OPTIONS, selectedCommitmentType) : '';
      return {
        title: selectedCommitmentType ? `🛡️ ${label}` : '🛡️ Cam kết',
        templateUrl: label ? getTotalHdDocxUrlFromLabel(label) : '',
        templateFile: reviewCommitmentDocx,
      };
    }
    const label = optionLabel(CONTRACT_DOC_TYPE_OPTIONS, selectedContractType);
    return {
      title: `📄 ${label}`,
      templateUrl: label ? getTotalHdDocxUrlFromLabel(label) : '/templates/hdld-ft.docx',
      templateFile: reviewContractDocx,
    };
  }, [reviewAgreementDocx, reviewCommitmentDocx, reviewContractDocx, reviewDocKind, selectedAgreementType, selectedCommitmentType, selectedContractType]);

  const hasAgreement = !!selectedAgreementType;
  const hasCommitment = !!selectedCommitmentType;

  useEffect(() => {
    if (reviewDocKind === 'agreement' && !hasAgreement) {
      localStorage.setItem('ace_docx_review_kind', 'contract');
      setReviewDocKind('contract');
    }
    if (reviewDocKind === 'commitment' && !hasCommitment) {
      localStorage.setItem('ace_docx_review_kind', 'contract');
      setReviewDocKind('contract');
    }
  }, [hasAgreement, hasCommitment, reviewDocKind]);

  const handleFieldChange = (key, val) => {
    if (key === 'chuc_vu') {
      applyPositionSelection(val);
      setFormData(prev => ({ ...prev, chuc_vu: canonicalPositionLabel(val) }));
      return;
    }
    if (key === 'ngay_ky' || key === 'den_ngay') {
      setFieldErrors(prev => ({ ...prev, [key]: '' }));
    }
    setFormData(prev => {
      if (key === 'phu_cap_cho_o' || key === 'phu_cap_di_lai' || key === 'phu_cap_dt') {
        return { ...prev, [key]: formatMoneyDots(val) };
      }
      if (key === 'luong') {
        const fmt = formatMoneyDots(val);
        const luongChu = moneyToWords(fmt);
        return { ...prev, luong: fmt, luong_chu: luongChu || prev.luong_chu };
      }
      if (key === 'ma_nv') {
        const next = { ...prev, ma_nv: val };
        const so = computeSoHdFromMaNv(val);
        if (so) next.so_hd = so;
        return next;
      }
      if (key === 'ngay_ky') return { ...prev, ngay_ky: val };
      if (key === 'den_ngay') return { ...prev, den_ngay: val };
      return { ...prev, [key]: val };
    });
  };
  const handleSelectFromSheet = React.useCallback((s) => {
    const pos = String(s.position || '').trim();
    if (pos) applyPositionSelection(pos);
    setFormData(prev => ({ 
      ...prev, 
      ma_nv: s.id,
      so_hd: computeSoHdFromMaNv(s.id),
      ho_ten: s.name,
      email: s.email,
      so_dien_thoai: s.phone,
      chuc_vu: canonicalPositionLabel(s.position),
      tu_ngay: s.startDate,
      cccd: s.cccd || '',
      dia_chi: s.address || '',
      tam_tru: s.currentAddress || '',
      ngay_sinh: s.dob || '',
      ngay_cap: s.cccd_date || '',
      noi_cap: s.cccd_place || prev.noi_cap,
      luong: formatMoneyDots(s.salary) || '',
      luong_chu: moneyToWords(formatMoneyDots(s.salary)) || s.salary_text || ''
    }));
  }, [applyPositionSelection]);

  const applyContractPatch = (patch) => {
    if (patch && patch.chuc_vu) {
      const pos = String(patch.chuc_vu || '').trim();
      if (pos) applyPositionSelection(pos);
    }
    setFormData(prev => {
      const next = { ...prev, ...patch };
      next.luong = formatMoneyDots(next.luong);
      next.phu_cap_cho_o = formatMoneyDots(next.phu_cap_cho_o);
      next.phu_cap_di_lai = formatMoneyDots(next.phu_cap_di_lai);
      next.phu_cap_dt = formatMoneyDots(next.phu_cap_dt);
      const so = computeSoHdFromMaNv(next.ma_nv);
      if (so) next.so_hd = so;
      if (!next.luong_chu) next.luong_chu = moneyToWords(next.luong);
      return next;
    });
  };

  useEffect(() => {
    if (!initialEmployeeId) return;
    const emp = filteredEmployees.find(e => String(e.id || '').trim() === String(initialEmployeeId || '').trim());
    if (!emp) return;
    setMode('search');
    handleSelectFromSheet(emp);
  }, [filteredEmployees, handleSelectFromSheet, initialEmployeeId]);

  useEffect(() => {
    if (isAdmin) return;
    setMode('search');
  }, [isAdmin]);

  const handlePasteParse = () => {
    try {
      setQuickError('');
      const t = pasteText.trim();
      if (!t) return;
      const delimiter = t.includes('\t') ? '\t' : detectCsvDelimiter(t.split(/\r\n|\r|\n/)[0]);
      const { rows } = delimiter === ',' ? parseCsvSmart(t) : parseDelimited(t, delimiter);
      if (rows.length === 0) {
        setQuickError('Không đọc được dữ liệu dán.');
        return;
      }
      const mapped = rows.map(r => mapRowToContract(r));
      setQuickRows(mapped);
      applyContractPatch(mapped[0]);
    } catch (_) {
      setQuickError('Không thể phân tích dữ liệu dán.');
    }
  };

  const handleQuickFile = async (file) => {
    if (!file) return;
    try {
      setQuickLoading(true);
      setQuickError('');
      setQuickFileName(file.name || '');
      const name = String(file.name || '').toLowerCase();
      if (name.endsWith('.csv')) {
        const text = await file.text();
        const { rows } = parseCsvSmart(text);
        const mapped = rows.map(r => mapRowToContract(r));
        setQuickRows(mapped);
        if (mapped[0]) applyContractPatch(mapped[0]);
        setQuickLoading(false);
        return;
      }

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await loadXlsx();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (!json || json.length < 2) {
          setQuickError('File Excel không có đủ dữ liệu.');
          return;
        }
          const normalized = (json[0] || []).map(h => normalizeHeader(h));
          const counts = {};
          const headers = normalized.map(h => {
            counts[h] = (counts[h] || 0) + 1;
            return counts[h] === 1 ? h : `${h}__${counts[h]}`;
          });
        const rows = json.slice(1).filter(r => r && r.some(c => String(c || '').trim() !== '')).map(r => {
          const obj = {};
          headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? String(r[idx]).trim() : ''; });
          return obj;
        });
        const mapped = rows.map(r => mapRowToContract(r));
        setQuickRows(mapped);
        if (mapped[0]) applyContractPatch(mapped[0]);
        setQuickLoading(false);
        return;
      }

      setQuickError('Chỉ hỗ trợ .csv (UTF-8) hoặc .xlsx');
      setQuickLoading(false);
    } catch (_) {
      setQuickError('Không thể đọc file. Hãy thử lại với CSV UTF-8.');
      setQuickLoading(false);
    }
  };

  const filteredQuickRows = React.useMemo(() => {
    if (!quickQuery.trim()) return quickRows;
    const s = quickQuery.trim().toLowerCase();
    return quickRows.filter(r =>
      (r.ma_nv || '').toLowerCase().includes(s) ||
      (r.ho_ten || '').toLowerCase().includes(s) ||
      (r.chuc_vu || '').toLowerCase().includes(s)
    );
  }, [quickRows, quickQuery]);

  const validate = () => {
    if (!String(selectedContractType || '').trim()) {
      setErrors(['Vui lòng chọn Loại hợp đồng']);
      return false;
    }
    if (!String(selectedPosition || '').trim()) {
      setErrors(['Vui lòng chọn Vị trí công việc']);
      return false;
    }
    const v = validateContractData(formData, { contractTypeId: selectedContractType, agreementTypeId: selectedAgreementType });
    setFieldErrors(v.fieldErrors || {});
    setErrors(v.missing || []);
    return (v.missing || []).length === 0 && Object.keys(v.fieldErrors || {}).length === 0;
  };

  const requiredDocs = React.useMemo(() => {
    const mappings = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
    const pos = String(formData.chuc_vu || '').trim();
    return mappings[pos] || null;
  }, [formData.chuc_vu]);

  const handleReview = () => { 
    if (validate()) {
      localStorage.setItem('preview_data', JSON.stringify(formData));
      localStorage.setItem('preview_contract_type', selectedContractType);
      localStorage.setItem('preview_position', selectedPosition);
      localStorage.setItem('preview_agreement_type', selectedAgreementType || '');
      localStorage.setItem('preview_commitment_type', selectedCommitmentType || '');
      window.open(window.location.origin + '?preview=contract', '_blank');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-100 font-sans">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="flex items-center gap-3">
          <img src="/ace-logo.svg" alt="ACE" className="w-10 h-10 rounded-xl shadow-sm" />
          <div>
            <h1 className="text-sm font-bold text-slate-900 uppercase">
              {mode === 'workflow' ? 'Theo dõi quy trình hồ sơ' : 'Hệ thống tạo hợp đồng ACE'}
            </h1>
            <p className="text-[10px] text-slate-500">{branch}</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Đăng xuất</button>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {mode === 'workflow' ? (
          /* ── Giao diện QUY TRÌNH HỒ SƠ ── */
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Theo dõi hợp đồng</h2>
              <p className="text-slate-400 text-sm">Quản lý trạng thái và hồ sơ quét (scan) của nhân sự</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px]">
              <ContractWorkflowTracker userRole={userRole} branch={branch} setTasks={setTasks} />
            </div>
          </div>
        ) : (
          /* ── Giao diện IN HỢP ĐỒNG (Gốc) ── */
          <>
            {step === 'input' && (
              <div className="space-y-6 no-print">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Thông Tin Hợp Đồng</h2>
                  <p className="text-slate-400 text-sm">Chọn loại tài liệu và điền đầy đủ thông tin nhân sự</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-3">Chọn loại hợp đồng · vị trí · thỏa thuận · cam kết</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase">📄 Loại hợp đồng</label>
                      <select
                        value={selectedContractType}
                        onChange={(e) => applyContractTypeSelection(e.target.value)}
                        className={`w-full p-3 border-2 rounded-xl outline-none font-semibold text-sm transition-colors
                          ${selectedContractType ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-500'}`}
                      >
                        {CONTRACT_DOC_TYPE_OPTIONS.filter(x => x.id !== 'custom').map(x => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-emerald-600 uppercase">🧩 Vị trí công việc</label>
                      <select
                        value={positionSelectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPositionSelectValue(v);
                          if (!v) { applyPositionSelection(''); setFormData(prev => ({ ...prev, chuc_vu: '' })); return; }
                          if (v === CUSTOM_POSITION_VALUE) { applyPositionSelection(positionCustomValue || ''); setFormData(prev => ({ ...prev, chuc_vu: canonicalPositionLabel(positionCustomValue || '') })); return; }
                          applyPositionSelection(v); setFormData(prev => ({ ...prev, chuc_vu: canonicalPositionLabel(v) }));
                        }}
                        className={`w-full p-3 border-2 rounded-xl outline-none font-semibold text-sm transition-colors bg-white
                          ${positionSelectValue ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}
                      >
                        <option value="">— Chọn vị trí —</option>
                        {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value={CUSTOM_POSITION_VALUE}>Khác (tự nhập)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-purple-600 uppercase">📝 Thỏa thuận công việc</label>
                      <select
                        value={selectedAgreementType}
                        onChange={(e) => { setSelectedAgreementType(e.target.value); localStorage.setItem('agreement_type', e.target.value); }}
                        className={`w-full p-3 border-2 rounded-xl outline-none font-semibold text-sm transition-colors
                          ${selectedAgreementType ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-slate-200 text-slate-500'}`}
                      >
                        {AGREEMENT_DOC_TYPE_OPTIONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-amber-600 uppercase">🛡️ Bản cam kết</label>
                      <select
                        value={selectedCommitmentType}
                        onChange={(e) => { setSelectedCommitmentType(e.target.value); localStorage.setItem('commitment_type', e.target.value); }}
                        className={`w-full p-3 border-2 rounded-xl outline-none font-semibold text-sm transition-colors
                          ${selectedCommitmentType ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-500'}`}
                      >
                        {COMMITMENT_DOC_TYPE_OPTIONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {(selectedContractType || selectedAgreementType || selectedCommitmentType) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-400 uppercase">Sẽ tạo:</span>
                      <span className="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">📄 {optionLabel(CONTRACT_DOC_TYPE_OPTIONS, selectedContractType)}</span>
                      {selectedAgreementType && <span className="bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full">📝 {optionLabel(AGREEMENT_DOC_TYPE_OPTIONS, selectedAgreementType)}</span>}
                      {selectedCommitmentType && <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full">🛡️ {optionLabel(COMMITMENT_DOC_TYPE_OPTIONS, selectedCommitmentType)}</span>}
                    </div>
                  )}
                </div>

                {isAdmin && !initialMode && (
                  <div className="grid grid-cols-2 bg-white rounded-xl border border-slate-200 p-1 gap-1">
                    {[{ id: 'search', label: '🔍 Chọn nhân viên' }, { id: 'quick', label: '⚡ Upload/Paste nhanh' }].map(m => (
                      <button key={m.id} onClick={() => setMode(m.id)}
                        className={`py-3 rounded-lg font-bold text-xs transition-all ${mode === m.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`bg-white rounded-2xl border p-6 ${mode === 'search' ? 'border-red-200 shadow-md shadow-red-100' : 'border-slate-200 shadow-sm'}`}>
                  {mode === 'search' ? (
                    <>
                      <h3 className="font-bold text-slate-700 mb-1 text-sm">Chọn nhân viên</h3>
                      <p className="text-xs text-slate-400 mb-4">Chọn từ danh sách để điền tự động.</p>
                      <SearchFromSheet onSelect={handleSelectFromSheet} employees={filteredEmployees} />
                      {formData.ho_ten && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-500" />
                          <span className="text-sm font-bold text-green-700">Đã chọn: {formData.ho_ten}</span>
                        </div>
                      )}
                      <div className="mt-5 p-4 rounded-2xl border border-slate-200 bg-white">
                        <button type="button" onClick={() => setPrintInfoCollapsed(v => !v)} className="w-full flex items-center justify-between gap-3 text-left">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thông tin in</div>
                          <ChevronDown size={18} className={`text-slate-400 transition-transform ${printInfoCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {!printInfoCollapsed && <div className="mt-3"><ManualForm data={formData} onChange={handleFieldChange} positionOptions={positionOptions} lockSoHd fieldErrors={fieldErrors} showDenNgay={requiresDenNgay(selectedContractType, selectedAgreementType)} /></div>}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-slate-700 mb-1 text-sm">Upload / Dán nhanh</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Upload file</div>
                          <input ref={quickFileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => handleQuickFile(e.target.files?.[0])} />
                          <button type="button" onClick={() => quickFileInputRef.current?.click()} className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50">CHỌN TỆP</button>
                        </div>
                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Dán CSV / Excel</div>
                          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={3} placeholder="Paste here..." className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono" />
                          <button type="button" onClick={handlePasteParse} className="mt-2 w-full py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs">ÁP DỤNG</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {errors.length > 0 && <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3"><AlertCircle size={18} className="text-red-400 flex-shrink-0" /><div><p className="text-red-700 font-bold text-sm">Vui lòng kiểm tra lại:</p><p className="text-red-500 text-xs mt-1">{errors.join(' · ')}</p></div></div>}
                <button onClick={handleReview} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl shadow-xl shadow-indigo-200 transition-all uppercase tracking-wider flex items-center justify-center gap-3"><FileText size={20} /> Xem trước &amp; Kiểm tra →</button>
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between no-print">
                  <button onClick={() => _setStep('input')} className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase">← Quay lại sửa</button>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={reviewAll} onChange={(e) => { setReviewAll(e.target.checked); localStorage.setItem('ace_docx_review_all', e.target.checked ? '1' : '0'); }} /> Xem tất cả
                  </label>
                </div>
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                   <div className="space-y-6">
                      {reviewAll ? (
                        <>
                          <DocxViewer templateUrl={getTotalHdDocxUrlFromLabel(optionLabel(CONTRACT_DOC_TYPE_OPTIONS, selectedContractType)) || '/templates/hdld-ft.docx'} data={formData} height={720} />
                          {selectedAgreementType && <DocxViewer templateUrl={getTotalHdDocxUrlFromLabel(optionLabel(AGREEMENT_DOC_TYPE_OPTIONS, selectedAgreementType))} data={formData} height={720} />}
                          {selectedCommitmentType && <DocxViewer templateUrl={getTotalHdDocxUrlFromLabel(optionLabel(COMMITMENT_DOC_TYPE_OPTIONS, selectedCommitmentType))} data={formData} height={720} />}
                        </>
                      ) : (
                        <DocxViewer templateUrl={activeReview.templateUrl || '/templates/hdld-ft.docx'} templateFile={activeReview.templateFile} data={formData} height={720} />
                      )}
                   </div>
                </div>
                <button onClick={() => window.print()} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-2xl no-print shadow-xl shadow-emerald-200 transition-all uppercase tracking-wider flex items-center justify-center gap-3">
                  <Printer size={20} /> In Hợp đồng &amp; Phụ lục
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
