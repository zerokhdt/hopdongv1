import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, UserPlus, Mail, Phone, MapPin, Briefcase, Calendar, Trash2, Edit2, MoreVertical, X, Printer, Camera, History, FileText, BadgeCheck, ShieldCheck, Download, Award, User, CreditCard, GraduationCap, Building2 } from 'lucide-react';
import { format, parseISO, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { importEmployeesFromCsv, mergeEmployees } from '../utils/employeeImport';
import { SEED_DATA } from '../data/employees_seed';
import { apiFetch } from '../utils/api.js';

// Helper for seniority calculation
const calculateSeniority = (startDate) => {
  if (!startDate) return '0 năm 0 tháng';
  try {
    const start = parseISO(startDate);
    const now = new Date();
    const years = differenceInYears(now, start);
    const months = differenceInMonths(now, start) % 12;
    
    if (years === 0 && months === 0) {
      const days = differenceInDays(now, start);
      return `${days} ngày`;
    }
    
    return `${years} năm ${months} tháng`;
  } catch (_e) {
    return 'N/A';
  }
};

export default function EmployeeView({ employees, setEmployees, userRole, branchId, movements = [], onCreateContract }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isImportingEmployees, setIsImportingEmployees] = useState(false);
  const [showImportRequests, setShowImportRequests] = useState(false);

  const isAdmin = userRole === 'admin';
  useEffect(() => {
    if (!isAdmin) return;
    try {
      const v = localStorage.getItem('ace_open_employee_requests');
      if (v === '1') {
        localStorage.removeItem('ace_open_employee_requests');
        setShowImportRequests(true);
      }
    } catch (_e) {}
  }, [isAdmin]);

  const normalizeKey = (v) => String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!isAdmin && branchId) {
      return matchesSearch && normalizeKey(emp.department) === normalizeKey(branchId);
    }
    return matchesSearch;
  });

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F2F4F7] p-6 overflow-hidden print:bg-white print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản lý nhân sự</h2>
          <p className="text-slate-500 text-sm">
            {isAdmin ? 'Quản lý thông tin nhân viên và hồ sơ công việc toàn hệ thống' : `Danh sách nhân viên chi nhánh ${branchId}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowImportRequests(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-semibold border border-slate-200"
            >
              <ShieldCheck size={18} /> Yêu cầu cập nhật
            </button>
          )}
          <button
            onClick={() => setIsImportingEmployees(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-semibold border border-slate-200"
          >
            <Download size={18} /> Import CSV
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsAddingEmployee(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-semibold"
            >
              <UserPlus size={18} /> Thêm nhân viên
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 print:hidden">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm nhân viên (tên, email, chức vụ)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 print:hidden">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân viên</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Chức vụ / Phòng ban</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thâm niên</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày vào làm</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} className="w-10 h-10 rounded-full object-cover border border-slate-200" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {emp.name.split(' ').pop().charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800">{emp.name}</div>
                        <div className="text-xs text-slate-400">ID: {emp.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Briefcase size={14} className="text-slate-400" />
                        {emp.position}
                      </div>
                      <div className="text-xs text-slate-400 ml-5">{emp.department}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                      {calculateSeniority(emp.startDate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      {emp.startDate}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!!onCreateContract && (
                        <button
                          onClick={() => onCreateContract(emp)}
                          className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
                          title="Tạo hợp đồng"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedEmployee(emp)}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                        title="Xem chi tiết"
                      >
                        <Search size={16} />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDelete(emp.id)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    Không tìm thấy nhân viên nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for adding/editing/viewing */}
      {(isAddingEmployee || selectedEmployee) && (
        <EmployeeProfileModal 
          employee={selectedEmployee} 
          userRole={userRole}
          movements={movements}
          onClose={() => { setIsAddingEmployee(false); setSelectedEmployee(null); }}
          onSave={(data) => {
            if (selectedEmployee) {
              setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, ...data } : e));
            } else {
              setEmployees(prev => [...prev, { ...data, id: 'EMP' + Date.now() }]);
            }
            setIsAddingEmployee(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {isImportingEmployees && (
        <EmployeeCsvImportModal
          existingEmployees={employees}
          isAdmin={isAdmin}
          branchId={branchId}
          onClose={() => setIsImportingEmployees(false)}
          onApply={(merged) => {
            setEmployees(merged);
            setIsImportingEmployees(false);
          }}
        />
      )}

      {showImportRequests && isAdmin && (
        <EmployeeImportRequestsModal
          existingEmployees={employees}
          setEmployees={setEmployees}
          onClose={() => setShowImportRequests(false)}
        />
      )}
    </div>
  );
}

function EmployeeCsvImportModal({ existingEmployees, isAdmin, branchId, onClose, onApply }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [parsedEmployees, setParsedEmployees] = useState([]);
  const [parsedCount, setParsedCount] = useState(0);
  const [parseErrors, setParseErrors] = useState([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [csvText, setCsvText] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const applyBranchOverride = (list) => {
    if (isAdmin) return list;
    const b = String(branchId || '').trim();
    if (!b) return list;
    return (Array.isArray(list) ? list : []).map(e => ({ ...e, department: b }));
  };

  const decodeBest = (buf) => {
    const decoders = [
      { name: 'utf-8', dec: () => new TextDecoder('utf-8').decode(buf) },
      { name: 'windows-1258', dec: () => new TextDecoder('windows-1258').decode(buf) },
      { name: 'windows-1252', dec: () => new TextDecoder('windows-1252').decode(buf) },
      { name: 'utf-16le', dec: () => new TextDecoder('utf-16le').decode(buf) },
    ];

    const scoreText = (t) => {
      const s = String(t || '');
      const bad = (s.match(/\uFFFD/g) || []).length * 8 + (s.match(/Ã./g) || []).length * 4 + (s.match(/ï»¿/g) || []).length * 6;
      const good = (s.match(/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi) || []).length;
      const headerBoost = /ma\s*nv|mã\s*nv/i.test(s) ? 10 : 0;
      return good + headerBoost - bad;
    };

    let best = { text: new TextDecoder('utf-8').decode(buf), score: -Infinity };
    for (const d of decoders) {
      let t = '';
      try {
        t = d.dec();
      } catch {
        continue;
      }
      const score = scoreText(t);
      if (score > best.score) best = { text: t, score };
    }
    return best.text.replace(/^\uFEFF/, '').replace(/^ï»¿/, '');
  };

  const decodeFile = async (file) => {
    const buf = await file.arrayBuffer();
    return decodeBest(buf);
  };

  const handlePickFile = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleLoadMock = () => {
    setError('');
    setSyncMessage('');
    setParseErrors([]);
    const mock = Array.isArray(SEED_DATA?.employees) ? SEED_DATA.employees : [];
    const list = applyBranchOverride(
      mock.map(e => ({
        id: String(e.id || '').trim(),
        title: e.title || '',
        name: e.name || '',
        position: e.position || '',
        department: e.department || '',
        phone: e.phone || '',
        email: e.email || '',
        startDate: e.startDate || '',
        probationDate: e.probationDate || '',
        contractDate: e.contractDate || '',
        renewDate: e.renewDate || '',
        seniority: e.seniority || '',
        education: e.education || '',
        major: e.major || '',
        pedagogyCert: e.pedagogyCert || '',
        hasInsurance: e.hasInsurance || '',
        insuranceAgency: e.insuranceAgency || '',
        documentStatus: e.documentStatus || '',
        salary: e.salary || '',
        cccd: e.cccd || '',
        dob: e.dob || '',
        address: e.address || '',
        nationality: e.nationality || 'Việt Nam',
      })),
    ).filter(e => e.id && e.name);
    setParsedEmployees(list);
    setParsedCount(list.length);
    setSelectedIds(new Set(list.map(e => e.id)));
  };

  const handleFile = async (file) => {
    setError('');
    setSyncMessage('');
    setParsedEmployees([]);
    setParsedCount(0);
    setParseErrors([]);
    setSelectedIds(new Set());
    if (!file) return;
    setBusy(true);
    try {
      const text = await decodeFile(file);
      setCsvText(text);
      const parsed = importEmployeesFromCsv(text);
      if (!parsed.ok) {
        setError(parsed.error || 'Không đọc được CSV');
        return;
      }
      const list = applyBranchOverride(parsed.employees);
      setParsedEmployees(list);
      setParsedCount(list.length);
      setSelectedIds(new Set(list.map(e => e.id)));
      setParseErrors(parsed.errors || []);
    } catch (_e) {
      setError(_e?.message || String(_e));
    } finally {
      setBusy(false);
    }
  };

  const handleParseText = () => {
    setError('');
    setSyncMessage('');
    setParsedEmployees([]);
    setParsedCount(0);
    setParseErrors([]);
    setSelectedIds(new Set());
    const text = String(csvText || '').trim();
    if (!text) {
      setError('Chưa có nội dung CSV để phân tích.');
      return;
    }
    const parsed = importEmployeesFromCsv(text);
    if (!parsed.ok) {
      setError(parsed.error || 'Không đọc được CSV');
      return;
    }
    const list = applyBranchOverride(parsed.employees);
    setParsedEmployees(list);
    setParsedCount(list.length);
    setSelectedIds(new Set(list.map(e => e.id)));
    setParseErrors(parsed.errors || []);
  };

  const mergeResult = useMemo(() => {
    if (!parsedEmployees || parsedEmployees.length === 0) return null;
    const selected = parsedEmployees.filter(e => selectedIds.has(e.id));
    if (selected.length === 0) return null;
    return mergeEmployees(existingEmployees, selected, { replaceAll, overwrite: overwriteExisting });
  }, [existingEmployees, overwriteExisting, parsedEmployees, replaceAll, selectedIds]);

  const applyNow = () => {
    if (!mergeResult || !mergeResult.merged) return;
    onApply(mergeResult.merged);
  };

  const syncToSupabase = async () => {
    if (!mergeResult) return;
    setError('');
    setSyncMessage('');
    setSyncBusy(true);
    try {
      if (!isAdmin) {
        setError('Chỉ tài khoản Admin được phép lưu nhân sự lên Supabase.');
        return;
      }
      const token = String(localStorage.getItem('token') || '').trim();
      if (!token) {
        setError('Thiếu token đăng nhập. Vui lòng đăng nhập lại.');
        return;
      }
      const selected = (parsedEmployees || []).filter(e => selectedIds.has(e.id));
      const resp = await apiFetch('/api/employees/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employees: selected,
          replaceAll,
          overwriteExisting,
        }),
      });
      const text = await resp.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!resp.ok || !data?.ok) {
        setError(data?.message || 'Lưu Supabase thất bại.');
        return;
      }
      setSyncMessage(`Đã lưu Supabase: ${data.employees} nhân viên · ${data.branches} chi nhánh`);
      onApply(mergeResult.merged);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const sendImportRequest = async () => {
    if (!mergeResult) return;
    setError('');
    setSyncMessage('');
    setRequestBusy(true);
    try {
      if (isAdmin) {
        setError('Admin không cần gửi yêu cầu.');
        return;
      }
      const token = String(localStorage.getItem('token') || '').trim();
      if (!token) {
        setError('Thiếu token đăng nhập. Vui lòng đăng nhập lại.');
        return;
      }
      const selected = (parsedEmployees || []).filter(e => selectedIds.has(e.id)).map(e => ({ ...e, department: String(branchId || e.department || '').trim() }));
      const resp = await apiFetch('/api/employees/import-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employees: selected,
          overwriteExisting,
        }),
      });
      const text = await resp.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!resp.ok || !data?.ok) {
        setError(data?.message || 'Gửi yêu cầu thất bại.');
        return;
      }
      setSyncMessage(`Đã gửi yêu cầu cập nhật (${data.employees} nhân viên). Chờ Admin duyệt.`);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setRequestBusy(false);
    }
  };

  const preview = parsedEmployees || [];

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden mx-auto my-6 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-black text-slate-800">Import nhân viên từ CSV</div>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Cập nhật danh sách nhân sự</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors">
              Hủy
            </button>
            {isAdmin && (
              <button disabled={!mergeResult || busy || syncBusy} onClick={syncToSupabase} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {syncBusy ? 'ĐANG LƯU…' : 'LƯU SUPABASE'}
              </button>
            )}
            {!isAdmin && (
              <button disabled={!mergeResult || busy || syncBusy || requestBusy} onClick={sendImportRequest} className="px-4 py-2 rounded-lg bg-amber-600 text-white font-black hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {requestBusy ? 'ĐANG GỬI…' : 'GỬI YÊU CẦU'}
              </button>
            )}
            <button disabled={!mergeResult || busy || syncBusy} onClick={applyNow} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-black hover:bg-blue-700 disabled:opacity-50 transition-colors">
              Áp dụng local
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files && e.target.files[0])} />
              <button onClick={handlePickFile} className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-900 transition-colors">
                Chọn file CSV
              </button>
              <button onClick={handleLoadMock} disabled={busy || syncBusy} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors">
                Nạp dữ liệu mẫu
              </button>
              <button onClick={handleParseText} disabled={busy} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors">
                Phân tích nội dung dán
              </button>
              <div className="text-sm text-slate-600 font-semibold">
                {busy ? 'Đang đọc file…' : (parsedCount > 0 ? `Đã đọc ${parsedCount} dòng` : 'Chưa chọn file')}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} disabled={!isAdmin} />
                Thay thế toàn bộ
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={overwriteExisting} onChange={(e) => setOverwriteExisting(e.target.checked)} disabled={replaceAll} />
                Ghi đè nhân viên trùng Mã NV
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm font-bold text-red-600">
              {error}
            </div>
          )}
          {syncMessage && (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm font-bold text-emerald-700">
              {syncMessage}
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest">Dán CSV (tuỳ chọn)</div>
            <div className="p-4">
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full h-32 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono outline-none focus:border-blue-400" placeholder="Dán toàn bộ nội dung CSV vào đây rồi bấm “Phân tích nội dung dán”" />
            </div>
          </div>

          {mergeResult && (
            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
              <div className="text-sm font-black text-slate-800 mb-2">Kết quả import</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-400 uppercase">Thêm mới</div>
                  <div className="text-lg font-black text-slate-800">{mergeResult.stats.added}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-400 uppercase">Cập nhật</div>
                  <div className="text-lg font-black text-slate-800">{mergeResult.stats.updated}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-400 uppercase">Giữ nguyên</div>
                  <div className="text-lg font-black text-slate-800">{mergeResult.stats.kept}</div>
                </div>
              </div>
              {parseErrors.length > 0 && (
                <div className="mt-3 text-sm font-bold text-amber-700">
                  Có {parseErrors.length} dòng bị bỏ qua (thiếu Mã NV hoặc Họ và Tên).
                </div>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest">Danh sách nhân sự nạp</div>
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">
                        <input
                          type="checkbox"
                          checked={parsedEmployees.length > 0 && selectedIds.size === parsedEmployees.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(new Set(parsedEmployees.map(x => x.id)));
                            else setSelectedIds(new Set());
                          }}
                        />
                      </th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">Mã NV</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">Họ tên</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">Bộ phận</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">Chức vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(e.id)}
                            onChange={(ev) => {
                              const next = new Set(selectedIds);
                              if (ev.target.checked) next.add(e.id);
                              else next.delete(e.id);
                              setSelectedIds(next);
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 text-sm font-bold text-slate-700">{e.id}</td>
                        <td className="px-4 py-2 text-sm text-slate-700">{e.name}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{e.department}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{e.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-white border-t border-slate-100 text-xs font-bold text-slate-500">
                Đã chọn {selectedIds.size}/{parsedEmployees.length} nhân sự
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeImportRequestsModal({ existingEmployees, setEmployees, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [decideBusy, setDecideBusy] = useState('');
  const [previewId, setPreviewId] = useState('');

  const load = async () => {
    setError('');
    setBusy(true);
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      const resp = await apiFetch('/api/employees/import-requests/list?status=PENDING', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await resp.text();
      let data = null;
      try { data = JSON.parse(text) } catch { data = null }
      if (!resp.ok || !data?.ok) {
        setError(data?.message || 'Không tải được danh sách yêu cầu.');
        return;
      }
      setItems(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (id, decision) => {
    setError('');
    setDecideBusy(id);
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      const resp = await apiFetch('/api/employees/import-requests/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, decision }),
      });
      const text = await resp.text();
      let data = null;
      try { data = JSON.parse(text) } catch { data = null }
      if (!resp.ok || !data?.ok) {
        setError(data?.message || 'Thao tác thất bại.');
        return;
      }
      const item = items.find(x => x.id === id);
      if (decision === 'APPROVE' && item?.employees) {
        const overwrite = item.overwrite_existing !== false;
        const payload = Array.isArray(item.employees) ? item.employees : [];
        const merged = mergeEmployees(existingEmployees, payload, { replaceAll: false, overwrite }).merged;
        setEmployees(merged);
      }
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDecideBusy('');
    }
  };

  const previewItem = useMemo(() => items.find(x => x.id === previewId) || null, [items, previewId]);

  const normalizeVal = (v) => String(v ?? '').trim();
  const sameVal = (a, b) => normalizeVal(a) === normalizeVal(b);
  const diffFields = [
    { key: 'name', label: 'Họ và Tên' },
    { key: 'department', label: 'Chi nhánh' },
    { key: 'position', label: 'Chức vụ' },
    { key: 'phone', label: 'Điện thoại' },
    { key: 'email', label: 'Email' },
    { key: 'startDate', label: 'Ngày vào làm' },
    { key: 'probationDate', label: 'Thử việc' },
    { key: 'contractDate', label: 'Ký HĐ' },
    { key: 'renewDate', label: 'Tái ký' },
    { key: 'dob', label: 'Ngày sinh' },
    { key: 'nationality', label: 'Quốc tịch' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'cccd', label: 'CCCD' },
    { key: 'cccd_date', label: 'Ngày cấp' },
    { key: 'cccd_place', label: 'Nơi cấp' },
    { key: 'salary', label: 'Lương' },
    { key: 'hasInsurance', label: 'BHXH' },
    { key: 'insuranceAgency', label: 'Cơ quan BH' },
    { key: 'documentStatus', label: 'Hồ sơ' },
    { key: 'education', label: 'Học vấn' },
    { key: 'major', label: 'Chuyên ngành' },
    { key: 'pedagogyCert', label: 'NVSP' },
    { key: 'title', label: 'Giới tính' },
  ];

  const previewRows = useMemo(() => {
    if (!previewItem || !Array.isArray(previewItem.employees)) return [];
    const byId = new Map();
    (existingEmployees || []).forEach(e => {
      const id = normalizeVal(e?.id);
      if (id) byId.set(id, e);
    });
    return previewItem.employees
      .map((e) => {
        const id = normalizeVal(e?.id);
        const cur = id ? byId.get(id) : null;
        const changes = [];
        diffFields.forEach(f => {
          if (!cur) return;
          if (!sameVal(cur?.[f.key], e?.[f.key])) changes.push(f.label);
        });
        const action = !cur ? 'ADD' : (changes.length > 0 ? 'UPDATE' : 'NOCHANGE');
        return {
          id,
          name: normalizeVal(e?.name),
          department: normalizeVal(e?.department),
          action,
          changes,
          next: e,
          prev: cur,
        };
      })
      .filter(r => r.id);
  }, [existingEmployees, previewItem]);

  const previewStats = useMemo(() => {
    const stats = { add: 0, update: 0, nochange: 0 };
    previewRows.forEach(r => {
      if (r.action === 'ADD') stats.add++;
      else if (r.action === 'UPDATE') stats.update++;
      else stats.nochange++;
    });
    return stats;
  }, [previewRows]);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden mx-auto my-6 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-black text-slate-800">Yêu cầu cập nhật nhân sự</div>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Chi nhánh gửi dữ liệu · Admin duyệt</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={busy} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50">
              Tải lại
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors">
              Đóng
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm font-bold text-red-600">
              {error}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700">
            {busy ? 'Đang tải…' : `Đang chờ duyệt: ${items.length} yêu cầu`}
          </div>

          {items.length === 0 && !busy ? (
            <div className="text-center text-sm font-bold text-slate-500 py-10">
              Không có yêu cầu nào.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-800 truncate">
                      {it.branch} · {Array.isArray(it.employees) ? it.employees.length : 0} nhân viên
                    </div>
                    <div className="text-xs text-slate-500 font-bold mt-1">
                      Từ: {it.created_by} · {it.created_at ? new Date(it.created_at).toLocaleString() : ''}
                    </div>
                    <div className="text-xs text-slate-500 font-bold mt-1">
                      {it.overwrite_existing === false ? 'Chỉ thêm mới (không ghi đè)' : 'Có ghi đè Mã NV trùng'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={!!decideBusy}
                      onClick={() => setPreviewId(it.id)}
                      className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-black text-xs tracking-widest hover:bg-slate-50 disabled:opacity-50"
                    >
                      XEM TRƯỚC
                    </button>
                    <button
                      disabled={!!decideBusy}
                      onClick={() => decide(it.id, 'REJECT')}
                      className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-black text-xs tracking-widest hover:bg-slate-50 disabled:opacity-50"
                    >
                      {decideBusy === it.id ? '...' : 'TỪ CHỐI'}
                    </button>
                    <button
                      disabled={!!decideBusy}
                      onClick={() => decide(it.id, 'APPROVE')}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-black text-xs tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {decideBusy === it.id ? '...' : 'DUYỆT'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewItem && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden mx-auto my-6 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-lg font-black text-slate-800">Xem trước cập nhật</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  {previewItem.branch} · Thêm {previewStats.add} · Cập nhật {previewStats.update} · Không đổi {previewStats.nochange}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewId('')}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="p-6 overflow-auto flex-1">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mã NV</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Họ tên</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Chi nhánh</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Trạng thái</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Thay đổi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-black text-slate-800">{r.id}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">{r.name || '—'}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{r.department || '—'}</td>
                        <td className="px-4 py-3">
                          {r.action === 'ADD' && <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black tracking-widest">THÊM MỚI</span>}
                          {r.action === 'UPDATE' && <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black tracking-widest">CẬP NHẬT</span>}
                          {r.action === 'NOCHANGE' && <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-black tracking-widest">KHÔNG ĐỔI</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">
                          {r.action === 'UPDATE' ? r.changes.join(' · ') : (r.action === 'ADD' ? '—' : '—')}
                        </td>
                      </tr>
                    ))}
                    {previewRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm font-bold text-slate-500">Không có dữ liệu.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeProfileModal({ employee, onClose, onSave, userRole, movements }) {
  const isAdmin = userRole === 'admin';
  const canEditCompensation = true;
  const [activeTab, setActiveTab] = useState('info');
  const fileInputRef = useRef(null);
  const maskSalary = useMemo(() => {
    const raw = localStorage.getItem('ace_hrm_mask_salary');
    if (raw === null) return !isAdmin;
    return raw === '1';
  }, [isAdmin]);
  const [printOrientation, setPrintOrientation] = useState(() => {
    const raw = localStorage.getItem('ace_hrm_print_orientation');
    return raw === 'landscape' ? 'landscape' : 'portrait';
  });
  const [printMode, setPrintMode] = useState(() => {
    const raw = localStorage.getItem('ace_hrm_print_mode');
    return raw === 'full' ? 'full' : 'summary';
  });

  const applyPrintPageStyle = (orientation) => {
    if (typeof document === 'undefined') return;
    const id = 'ace_print_page_style';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    const o = orientation === 'landscape' ? 'landscape' : 'portrait';
    el.textContent = `@page { size: A4 ${o}; margin: 10mm; }`;
  };

  const normalizeNameKey = (v) => String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
  
  const [formData, setFormData] = useState(employee || {
    name: '', position: '', department: '', email: '', phone: '',
    startDate: new Date().toISOString().slice(0, 10),
    probationDate: '', contractDate: '', renewDate: '',
    address: '', dob: '', cccd: '', cccd_date: '', cccd_place: '',
    nationality: 'Việt Nam', education: '', major: '',
    pedagogyCert: '', hasInsurance: '', insuranceAgency: '', documentStatus: '',
    salary: '', avatar_url: '', title: ''
  });

  const employeeHistory = useMemo(() => {
    if (!employee) return [];
    return movements.filter(m => m.employeeName === employee.name);
  }, [employee, movements]);

  const monthlyEvals = useMemo(() => {
    try {
      const raw = localStorage.getItem('ace_monthly_eval_v1') || '{}'
      const all = JSON.parse(raw)
      const rows = []
      const branchesToScan = isAdmin
        ? Object.keys(all || {})
        : [String(formData.department || localStorage.getItem('user_branch') || '').trim()].filter(Boolean)

      const empId = String(employee?.id || '').trim()
      const empNameKey = normalizeNameKey(employee?.name)

      branchesToScan.forEach((b) => {
        const listByBranch = all?.[b] || {}
        Object.entries(listByBranch).forEach(([mon, arr]) => {
          ;(arr || []).forEach(it => {
            const matchById = empId && String(it.employeeId || '').trim() === empId
            const matchByName = !empId && normalizeNameKey(it.name) === empNameKey
            if (!matchById && !matchByName) return
            const key = it.scoreKey || Object.keys(it.scores || {})[0] || 'diem'
            rows.push({ branch: b, month: mon, score: it.scores?.[key] || '' })
          })
        })
      })
      rows.sort((a, b) => a.month.localeCompare(b.month) || a.branch.localeCompare(b.branch))
      return rows
    } catch {
      return []
    }
  }, [employee, formData.department, isAdmin]);

  const recentMonthlyEvals = useMemo(() => monthlyEvals.slice(-6), [monthlyEvals])

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    try {
      localStorage.setItem('ace_hrm_print_orientation', printOrientation);
      localStorage.setItem('ace_hrm_print_mode', printMode);
    } catch (_e) {}
    applyPrintPageStyle(printOrientation);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[95vh] print:fixed print:inset-0 print:m-0 print:rounded-none print:shadow-none print:max-h-none print:overflow-visible">
        
        {/* Header - Hidden on print */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">
                {isAdmin ? (employee ? 'Hồ sơ nhân sự' : 'Thêm nhân viên mới') : 'Chi tiết nhân sự'}
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ACE Education System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {employee && (
              <div className="flex items-center gap-2">
                <select
                  value={printOrientation}
                  onChange={(e) => {
                    const v = e.target.value === 'landscape' ? 'landscape' : 'portrait';
                    setPrintOrientation(v);
                    try { localStorage.setItem('ace_hrm_print_orientation', v); } catch (_err) {}
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:border-blue-400"
                  title="Khổ giấy A4"
                >
                  <option value="portrait">A4 Dọc</option>
                  <option value="landscape">A4 Ngang</option>
                </select>
                <select
                  value={printMode}
                  onChange={(e) => {
                    const v = e.target.value === 'full' ? 'full' : 'summary';
                    setPrintMode(v);
                    try { localStorage.setItem('ace_hrm_print_mode', v); } catch (_err) {}
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:border-blue-400"
                  title="Chế độ in"
                >
                  <option value="summary">Tóm tắt</option>
                  <option value="full">Đầy đủ</option>
                </select>
                <button onClick={handlePrint} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-2 font-bold text-xs">
                  <Printer size={18} /> In hồ sơ
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={24} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 print:p-0">
          
          {/* Profile Summary Card */}
          <div className="flex flex-col md:flex-row gap-8 mb-8 items-start border-b border-slate-100 pb-8">
            <div className="relative group">
              <div className="w-40 h-40 rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-slate-100 relative group/avatar">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black text-slate-300">
                    {formData.name?.split(' ').pop().charAt(0) || '?'}
                  </div>
                )}
                {isAdmin && (
                  <div 
                    onClick={() => fileInputRef.current.click()}
                    className="absolute inset-0 bg-slate-900/40 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer text-white"
                  >
                    <Camera size={32} />
                    <span className="text-[10px] font-black mt-2 uppercase tracking-widest">Thay ảnh</span>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-4xl font-black text-slate-800 mb-1 leading-tight">{formData.name || 'Họ và Tên'}</h4>
                  <div className="text-xs font-black text-slate-500">
                    Mã nhân viên: <span className="text-slate-700">{formData.id || '---'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <ShieldCheck size={14} /> {formData.position || 'Chức vụ'}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                      {formData.department || 'Phòng ban'}
                    </span>
                    <div className="flex items-center gap-1 text-green-600 font-black text-xs px-2 py-1 bg-green-50 rounded-lg border border-green-100">
                      <Award size={14} />
                      THÂM NIÊN: {calculateSeniority(formData.startDate)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Mail size={12} /> Email
                  </span>
                  <span className="block text-sm font-bold text-slate-700 break-all break-words max-w-full leading-snug">{formData.email || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Phone size={12} /> Điện thoại
                    </span>
                    <span className="text-sm font-bold text-slate-700">{formData.phone || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Calendar size={12} /> Ngày vào làm
                    </span>
                    <span className="text-sm font-bold text-slate-700">{formData.startDate || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs - Hidden on print */}
          <div className="flex gap-1 bg-slate-50 p-1.5 rounded-2xl mb-8 print:hidden">
            <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'info' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <FileText size={16} /> THÔNG TIN CHI TIẾT
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <History size={16} /> LỊCH SỬ BIẾN ĐỘNG
            </button>
            <button onClick={() => setActiveTab('eval')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <BadgeCheck size={16} /> ĐÁNH GIÁ THÁNG
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'info' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-2 duration-300">
              {/* Personal Section */}
              <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <h5 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                  <User size={16} /> THÔNG TIN CÁ NHÂN & PHÁP LÝ
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Field label="Họ và Tên" value={formData.name} disabled={!isAdmin} onChange={val => setFormData({...formData, name: val})} />
                  <Field label="Ngày sinh" value={formData.dob} type="date" disabled={!isAdmin} onChange={val => setFormData({...formData, dob: val})} />
                  <Field label="Giới tính" value={formData.title} placeholder="Nam/Nữ" disabled={!isAdmin} onChange={val => setFormData({...formData, title: val})} />
                  <Field label="Quốc tịch" value={formData.nationality} disabled={!isAdmin} onChange={val => setFormData({...formData, nationality: val})} />
                  
                  <Field label="Số CCCD" value={formData.cccd} disabled={!isAdmin} onChange={val => setFormData({...formData, cccd: val})} />
                  <Field label="Ngày cấp" value={formData.cccd_date} type="date" disabled={!isAdmin} onChange={val => setFormData({...formData, cccd_date: val})} />
                  <Field label="Nơi cấp" value={formData.cccd_place} disabled={!isAdmin} onChange={val => setFormData({...formData, cccd_place: val})} />
                  <Field label="Địa chỉ hiện tại" value={formData.address} disabled={!isAdmin} onChange={val => setFormData({...formData, address: val})} />
                </div>
              </section>

              {/* Education Section */}
              <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <h5 className="text-[11px] font-black text-purple-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                  <GraduationCap size={16} /> TRÌNH ĐỘ HỌC VẤN & CHUYÊN MÔN
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Field label="Bằng cấp cao nhất" value={formData.education} placeholder="Cử nhân/Thạc sĩ..." disabled={!isAdmin} onChange={val => setFormData({...formData, education: val})} />
                  <Field label="Chuyên ngành" value={formData.major} disabled={!isAdmin} onChange={val => setFormData({...formData, major: val})} />
                  <Field label="Chứng chỉ NVSP" value={formData.pedagogyCert} placeholder="Có/Không hoặc Tên chứng chỉ" disabled={!isAdmin} onChange={val => setFormData({...formData, pedagogyCert: val})} />
                </div>
              </section>

              {/* Work Section */}
              <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <h5 className="text-[11px] font-black text-green-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                  <Building2 size={16} /> QUÁ TRÌNH CÔNG TÁC & CHẾ ĐỘ
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Field label="Ngày vào làm" value={formData.startDate} type="date" disabled={!isAdmin} onChange={val => setFormData({...formData, startDate: val})} />
                  <Field label="Ngày thử việc" value={formData.probationDate} type="date" disabled={!isAdmin} onChange={val => setFormData({...formData, probationDate: val})} />
                  <Field label="Ngày ký HĐ" value={formData.contractDate} type="date" disabled={!isAdmin} onChange={val => setFormData({...formData, contractDate: val})} />
                  <Field label="Ngày tái ký" value={formData.renewDate} type="date" disabled={!isAdmin} onChange={val => setFormData({...formData, renewDate: val})} />
                  
                  <Field label="Mức lương" value={formData.salary} placeholder="Ví dụ: 15,000,000" disabled={!canEditCompensation} onChange={val => setFormData({...formData, salary: val})} mask={maskSalary} />
                  <Field label="Tham gia BHXH" value={formData.hasInsurance} placeholder="Có/Không" disabled={!canEditCompensation} onChange={val => setFormData({...formData, hasInsurance: val})} />
                  <Field label="Cơ quan BHXH" value={formData.insuranceAgency} disabled={!canEditCompensation} onChange={val => setFormData({...formData, insuranceAgency: val})} />
                  <Field label="Tình trạng hồ sơ" value={formData.documentStatus} placeholder="Đủ/Thiếu" disabled={!canEditCompensation} onChange={val => setFormData({...formData, documentStatus: val})} />
                </div>
                {recentMonthlyEvals.length > 0 && (
                  <div className="mt-6">
                    <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Đánh giá gần đây</h6>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      {recentMonthlyEvals.map(it => (
                        <div key={`${it.branch}:${it.month}`} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center">
                          <div className="text-[10px] font-black text-slate-400 uppercase">{it.month}</div>
                          <div className="text-sm font-black text-slate-800">{it.score || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              {employeeHistory.length > 0 ? (
                employeeHistory.map((m, idx) => (
                  <div key={m.id} className="relative pl-8 pb-8 last:pb-0">
                    {/* Timeline Line */}
                    {idx !== employeeHistory.length - 1 && <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-slate-100"></div>}
                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-50 border-4 border-white shadow-sm flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-blue-600 uppercase tracking-wider">{m.type}</span>
                        <span className="text-[10px] font-bold text-slate-400">{format(parseISO(m.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 mb-1">{m.branchId}</p>
                      <div className="text-xs text-slate-500 bg-white/50 p-2 rounded-lg italic">
                        {m.type === 'LEAVE' && `Nghỉ từ ${m.details.from} đến ${m.details.to} (${m.details.days} ngày). Lý do: ${m.details.reason}`}
                        {m.type === 'CAREER_CHANGE' && `Thay đổi sang: ${m.details.newRole} (${maskSalary ? '*******' : m.details.newSalary}) tại ${m.details.branch}`}
                        {m.type === 'ONBOARDING' && `Tiếp nhận nhân sự mới vào hệ thống.`}
                      </div>
                      <div className="mt-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          m.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          m.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold">Chưa có lịch sử biến động nào được ghi nhận</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'eval' && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-800">Đánh giá theo tháng</div>
                    <div className="text-xs font-bold text-slate-400">{monthlyEvals.length} bản ghi</div>
                  </div>
                </div>
                <div className="p-6">
                  {monthlyEvals.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-bold">Chưa có dữ liệu đánh giá.</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-white">
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 py-2 pr-3">Tháng</th>
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 py-2 pr-3">Chi nhánh</th>
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 py-2">Điểm</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyEvals.map(r => (
                            <tr key={`${r.branch}:${r.month}`} className="border-b border-slate-100">
                              <td className="py-2 pr-3 text-sm font-black text-slate-800">{r.month}</td>
                              <td className="py-2 pr-3 text-xs font-bold text-slate-600">{r.branch}</td>
                              <td className="py-2 text-sm font-bold text-slate-700">{r.score || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Hidden on print */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 sticky bottom-0 z-10 print:hidden">
          <button onClick={onClose} className="px-6 py-2.5 text-slate-600 font-black hover:text-slate-800 transition-colors text-xs tracking-widest">
            {isAdmin ? 'HỦY BỎ' : 'ĐÓNG'}
          </button>
          {isAdmin && (
            <button 
              onClick={() => onSave(formData)}
              className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 text-xs tracking-widest"
            >
              LƯU HỒ SƠ
            </button>
          )}
          {!isAdmin && canEditCompensation && (
            <button
              onClick={() => onSave({
                salary: formData.salary,
                hasInsurance: formData.hasInsurance,
                insuranceAgency: formData.insuranceAgency,
                documentStatus: formData.documentStatus,
              })}
              className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 text-xs tracking-widest"
            >
              LƯU THAY ĐỔI
            </button>
          )}
        </div>
      </div>

      <div className="hidden print:block bg-white text-slate-900">
        <div
          className="mx-auto"
          style={{
            width: printOrientation === 'landscape' ? '297mm' : '210mm',
            minHeight: printOrientation === 'landscape' ? '210mm' : '297mm',
            padding: 0,
          }}
        >
          <div className="w-full h-full" style={{ padding: '10mm' }}>
            <div className="flex items-start justify-between border-b border-slate-300 pb-3">
              <div className="flex items-center gap-3">
                <img src="/ace-logo.svg" alt="ACE" className="w-10 h-10 rounded-xl" />
                <div>
                  <div className="text-sm font-black text-slate-900 tracking-tight">HỒ SƠ NHÂN SỰ</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ACE HRM</div>
                </div>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-600">
                <div>Mã NV: <span className="font-black text-slate-900">{formData.id || '—'}</span></div>
                <div>Ngày in: <span className="font-black text-slate-900">{format(new Date(), 'dd/MM/yyyy')}</span></div>
                <div>Chi nhánh: <span className="font-black text-slate-900">{formData.department || '—'}</span></div>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <div className="shrink-0">
                <div className="w-24 h-28 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300">
                      {formData.name?.split(' ').pop()?.charAt(0) || '—'}
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-black text-slate-900 leading-tight truncate">{formData.name || '—'}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                  <PrintLine label="Chức vụ" value={formData.position} />
                  <PrintLine label="Ngày vào làm" value={formData.startDate} />
                  <PrintLine label="Điện thoại" value={formData.phone} />
                  <PrintLine label="Email" value={formData.email} />
                </div>
              </div>
            </div>

            <div className={`mt-4 grid gap-3 ${printOrientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Thông tin cá nhân</div>
                <div className="mt-2 space-y-1">
                  <PrintLine label="Ngày sinh" value={formData.dob} />
                  <PrintLine label="Giới tính" value={formData.title} />
                  <PrintLine label="Quốc tịch" value={formData.nationality} />
                  <PrintLine label="Địa chỉ" value={formData.address} />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pháp lý</div>
                <div className="mt-2 space-y-1">
                  <PrintLine label="CCCD" value={formData.cccd} />
                  <PrintLine label="Ngày cấp" value={formData.cccd_date} />
                  <PrintLine label="Nơi cấp" value={formData.cccd_place} />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Học vấn</div>
                <div className="mt-2 space-y-1">
                  <PrintLine label="Học vấn" value={formData.education} />
                  <PrintLine label="Chuyên ngành" value={formData.major} />
                  <PrintLine label="NVSP" value={formData.pedagogyCert} />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hợp đồng</div>
                <div className="mt-2 space-y-1">
                  <PrintLine label="Thử việc" value={formData.probationDate} />
                  <PrintLine label="Ký HĐ" value={formData.contractDate} />
                  <PrintLine label="Tái ký" value={formData.renewDate} />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chế độ</div>
                <div className="mt-2 space-y-1">
                  <PrintLine label="Mức lương" value={formData.salary} mask={maskSalary} />
                  <PrintLine label="BHXH" value={formData.hasInsurance} />
                  <PrintLine label="Cơ quan BH" value={formData.insuranceAgency} />
                  <PrintLine label="Hồ sơ" value={formData.documentStatus} />
                </div>
              </div>

              {printMode === 'full' && (
                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Biến động gần nhất</div>
                  <div className="mt-2 space-y-1">
                    {(employeeHistory || []).slice(0, 3).map(m => (
                      <div key={m.id} className="flex justify-between gap-2 text-[11px]">
                        <span className="font-bold text-slate-500">{format(parseISO(m.createdAt), 'dd/MM/yyyy')}</span>
                        <span className="font-black text-slate-800 truncate">{m.type}</span>
                        <span className="font-bold text-slate-600 truncate">{m.branchId}</span>
                      </div>
                    ))}
                    {(employeeHistory || []).length === 0 && (
                      <div className="text-[11px] font-bold text-slate-500">—</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`mt-5 grid gap-6 ${printOrientation === 'landscape' && printMode === 'full' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="text-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Người lập</div>
                <div className="h-12"></div>
                <div className="border-b border-slate-300"></div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HRM</div>
                <div className="h-12"></div>
                <div className="border-b border-slate-300"></div>
              </div>
              {printOrientation === 'landscape' && printMode === 'full' && (
                <div className="text-center">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phê duyệt</div>
                  <div className="h-12"></div>
                  <div className="border-b border-slate-300"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, type = "text", placeholder, disabled, onChange, mask = false }) {
  const computedType = mask && type === 'text' ? 'password' : type;
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <input 
        type={computedType}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all text-sm font-bold text-slate-700 ${disabled ? 'bg-slate-50 cursor-not-allowed' : 'hover:border-slate-300'}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function PrintField({ label, value, mask = false }) {
  const displayValue = mask && value ? '*******' : (value || '................................');
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-bold text-slate-400 w-32 shrink-0 uppercase text-[10px] tracking-wider">{label}:</span>
      <span className="font-black text-slate-800">{displayValue}</span>
    </div>
  );
}

function PrintLine({ label, value, mask = false }) {
  const displayValue = mask && value ? '*******' : (String(value || '').trim() || '—');
  return (
    <div className="flex items-baseline gap-2 text-[11px] leading-snug">
      <span className="font-bold text-slate-500 w-[72px] shrink-0">{label}</span>
      <span className="font-black text-slate-800 min-w-0 break-words">{displayValue}</span>
    </div>
  );
}
