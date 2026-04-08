import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Calendar, ArrowRightLeft, CheckCircle, Clock, 
  XCircle, Send, Calculator, History, Search, Filter, 
  TrendingUp, Home, ShieldAlert, FileText, Mail, Bell, HelpCircle, Paperclip, Hash, Building2, IdCard
} from 'lucide-react';
import { differenceInDays, addMonths, format, parseISO } from 'date-fns';
import { apiFetch } from '../utils/api.js';
import { supabase } from '../utils/supabase';
import { useGoogleLogin } from '@react-oauth/google';


export default function PersonnelMovementView({ employees, setEmployees, movements: _movements, setMovements: _setMovements, userRole, branchId }) {
  const [activeSubTab, setActiveSubTab] = useState('onboarding');
  const [notifications, setNotifications] = useState([]);
  const [myMovements, setMyMovements] = useState([]);
  const [adminMovements, setAdminMovements] = useState([]);
  const pendingMovements = useMemo(() => {
    return adminMovements.filter(m => m.status === 'PENDING' || m.status === 'REVISION');
  }, [adminMovements]);
  const [busy, setBusy] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const maskSalary = useMemo(() => {
    const raw = localStorage.getItem('ace_hrm_mask_salary');
    if (raw === null) return userRole !== 'admin';
    return raw === '1';
  }, [userRole]);

  const isAdmin = userRole === 'admin';
  useEffect(() => {
    if (!isAdmin) return;
    try {
      const v = localStorage.getItem('ace_open_personnel_movements');
      if (v === '1') {
        localStorage.removeItem('ace_open_personnel_movements');
        setActiveSubTab('approvals');
      }
    } catch (_e) {}
  }, [isAdmin]);

  const mapDbMovementToUi = (m) => {
    return {
      id: String(m?.id || ''),
      type: String(m?.type || ''),
      employeeName: String(m?.employee_name || ''),
      employeeId: String(m?.employee_id || ''),
      status: String(m?.status || ''),
      branchId: String(m?.branch || ''),
      createdAt: String(m?.created_at || ''),
      processedAt: String(m?.processed_at || ''),
      createdBy: String(m?.created_by || ''),
      processedBy: String(m?.processed_by || ''),
      branchNote: String(m?.note || ''),
      decisionNote: String(m?.decision_note || ''),
      details: m?.payload || {},
      attachments: Array.isArray(m?.attachments) ? m.attachments : [],
    };
  };

  const mapDbEmployeeToUi = (r) => {
    if (!r) return null;
    return {
      id: r.id,
      title: r.title || '',
      name: r.name || '',
      position: r.position || '',
      department: r.department || '',
      email: r.email || '',
      phone: r.phone || '',
      startDate: r.start_date || '',
      probationDate: r.probation_date || '',
      seniority: r.seniority || '',
      contractDate: r.contract_date || '',
      renewDate: r.renew_date || '',
      education: r.education || '',
      major: r.major || '',
      pedagogyCert: r.pedagogy_cert || '',
      hasInsurance: r.has_insurance || '',
      insuranceAgency: r.insurance_agency || '',
      documentStatus: r.document_status || '',
      salary: r.salary || '',
      salaryBase: r.salary_base || '',
      allowanceHousing: r.allowance_housing || '',
      allowanceTravel: r.allowance_travel || '',
      allowancePhone: r.allowance_phone || '',
      cccd: r.cccd || '',
      cccd_date: r.cccd_date || '',
      cccd_place: r.cccd_place || '',
      dob: r.dob || '',
      address: r.address || '',
      currentAddress: r.current_address || '',
      nationality: r.nationality || '',
      avatar_url: r.avatar_url || '',
      bankAccount: r.bank_account || '',
      bankName: r.bank_name || '',
      taxCode: r.tax_code || '',
      note: r.note || '',
      rawStatus: r.raw_status || '',
    };
  };

  const loadMy = async () => {
    setBusy(true);
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      const resp = await apiFetch('/api/movements/my?status=ALL', { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.message || 'load_failed');
      setMyMovements((data.movements || []).map(mapDbMovementToUi));
    } catch (e) {
      setNotifications(prev => [...prev, { id: Date.now(), message: `Không tải được biến động: ${e?.message || String(e)}`, type: 'error' }]);
    } finally {
      setBusy(false);
    }
  };

  const loadPending = async () => {
    if (!isAdmin) return;
    loadAdminHistory();
  };

  const loadAdminHistory = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      const resp = await apiFetch('/api/movements/list?status=ALL', { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.message || 'load_failed');
      const mapped = (data.movements || []).map(mapDbMovementToUi);
      // Ensure newest items are first by date sorting
      mapped.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setAdminMovements(mapped);
    } catch (e) {
      setNotifications(prev => [...prev, { id: Date.now(), message: `Không tải được lịch sử hệ thống: ${e?.message || String(e)}`, type: 'error' }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'history') {
      if (isAdmin) loadAdminHistory();
      else loadMy();
    }
    if (activeSubTab === 'approvals' && isAdmin) {
      loadAdminHistory();
    }
  }, [activeSubTab, isAdmin]);

  const addMovement = async (type, employeeName, details) => {
    setBusy(true);
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      const employeeId = String(details?.employeeId || details?.id || '').trim() || null;
      const attachments = Array.isArray(details?.attachments) ? details.attachments : [];
      const resp = await apiFetch('/api/movements/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type,
          employeeId,
          employeeName,
          payload: details || {},
          attachments,
          note: String(details?.note || '').trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.message || 'create_failed');
      alert("Yêu cầu đã được gửi cho HRM phê duyệt.");
      if (isAdmin) loadAdminHistory();
      else loadMy();
    } catch (e) {
    } finally {
      setBusy(false);
    }
  };

  const decide = async (movement, action, note = '') => {
    setBusy(true);

    // Map action thành trạng thái mới
    let newStatus = '';
    if (action === 'APPROVE') newStatus = 'APPROVED';
    if (action === 'REJECT') newStatus = 'REJECTED';
    if (action === 'REVISION') newStatus = 'REVISION';

    try {
      // 1️⃣ Cập nhật Supabase
      const { error } = await supabase
        .from('bien_dong_nhan_su')
        .update({
          trang_thai: newStatus,
          ghi_chu: note,          // Ghi chú HRM hoặc lý do
          created_at: new Date()  // Nếu có cột updated_at
        })
        .eq('ma_nv', movement.details.employeeId);

      if (error) throw error;

      // 2️⃣ Cập nhật state local để UI phản hồi ngay
      setMovements(prev =>
        prev.map(m =>
          m.id === movement.id
            ? { ...m, status: newStatus, decisionNote: note }
            : m
        )
      );

      // 3️⃣ Thông báo
      setNotifications(prev => [
        ...prev,
        {
          id: Date.now(),
          message: `Đã xử lý yêu cầu ${movement.type} cho ${movement.employeeName}`,
          type: action === 'APPROVE' ? 'success' : action === 'REJECT' ? 'error' : 'warning',
        },
      ]);

      // 4️⃣ Đóng modal nếu đang mở
      setSelected(null);
    } catch (e) {
      setNotifications(prev => [
        ...prev,
        {
          id: Date.now(),
          message: `Xử lý thất bại: ${e.message || String(e)}`,
          type: 'error',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = (movement) => decide(movement, 'APPROVE', '');
  const handleReject = (movement) => decide(movement, 'REJECT', '');
  const handleRequestRevision = (movement, note) => decide(movement, 'REVISION', note);

  return (
    <div className="h-full flex flex-col bg-[#F2F4F7] p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Biến động nhân sự</h2>
          <p className="text-slate-500 text-sm">
            {userRole === 'admin' ? 'Quản lý và phê duyệt biến động toàn hệ thống' : `Gửi yêu cầu biến động cho chi nhánh ${branchId}`}
          </p>
        </div>
        <div className="flex gap-2">
          {userRole === 'admin' && (
             <button onClick={() => setIsReportModalOpen(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 font-bold text-xs shadow-sm">
               <FileText size={16} className="text-blue-500" /> Xuất báo cáo
             </button>
          )}
          {notifications.length > 0 && (
            <div className="relative group">
              <button className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 transition-colors">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{notifications.length}</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 hidden group-hover:block z-50">
                <div className="text-xs font-bold text-slate-400 uppercase p-2 border-b border-slate-50">Thông báo mới</div>
                {notifications.slice(-5).map(n => (
                  <div key={n.id} className={`p-2 text-xs rounded-lg mt-1 ${n.type === 'success' ? 'bg-green-50 text-green-700' : n.type === 'warning' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                    {n.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex bg-white rounded-xl border border-slate-200 p-1 gap-1 mb-6 shadow-sm">
        <button onClick={() => setActiveSubTab('onboarding')} className={`flex-1 py-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeSubTab === 'onboarding' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
          <UserPlus size={16} /> Tuyển dụng mới
        </button>
        <button onClick={() => setActiveSubTab('leave')} className={`flex-1 py-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeSubTab === 'leave' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Calendar size={16} /> Nghỉ phép / Thai sản
        </button>
        <button onClick={() => setActiveSubTab('career')} className={`flex-1 py-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeSubTab === 'career' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
          <TrendingUp size={16} /> Thăng tiến / Điều chuyển
        </button>
        <button onClick={() => setActiveSubTab('history')} className={`flex-1 py-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeSubTab === 'history' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
          <History size={16} /> {userRole === 'admin' ? 'Lịch sử hệ thống' : 'Yêu cầu của tôi'}
        </button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveSubTab('approvals')} className={`flex-1 py-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeSubTab === 'approvals' ? 'bg-orange-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
            <ShieldAlert size={16} /> HRM Duyệt ({pendingMovements.length})
          </button>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {activeSubTab === 'onboarding' && <OnboardingForm onSubmit={(data) => addMovement('ONBOARDING', data.name, data)} maskSalary={maskSalary} />}
          {activeSubTab === 'leave' && <LeaveForm employees={employees} onSubmit={(data) => addMovement('LEAVE', data.employeeName, data)} />}
          {activeSubTab === 'career' && <CareerMovementForm employees={employees} onSubmit={(data) => addMovement('CAREER_CHANGE', data.employeeName, data)} maskSalary={maskSalary} />}
          {activeSubTab === 'history' && <HistoryList movements={isAdmin ? adminMovements : myMovements} busy={busy} />}
          {activeSubTab === 'approvals' && userRole === 'admin' && (
            <ApprovalDashboard 
              movements={adminMovements} 
              onApprove={handleApprove} 
              onReject={handleReject} 
              onRevision={handleRequestRevision}
              busy={busy}
            />
          )}
        </div>
      </div>
      <MovementReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} movements={adminMovements} />
    </div>
  );
}

// ─── FORM 1: TUYỂN DỤNG MỚI ──────────────────────────────────────────
function OnboardingForm({ onSubmit, maskSalary = false }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    contractNumber: '',
    name: '',
    nationality: 'Việt Nam',
    birthDate: '',
    birthPlace: '',
    cccd: '',
    cccdDate: '',
    cccdPlace: '',
    phone: '',
    email: '',
    permanentAddress: '',
    temporaryAddress: '',
    position: '',
    department: '',
    startDate: '',
    salary: '',
    salaryText: '',
    contractSignDate: '',
    note: '',
    scanFile: null
  });

  const [pendingContracts, setPendingContracts] = useState([]);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [checklistValues, setChecklistValues] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await fetch('https://hopdong-delta.vercel.app/api/get-pending-contracts');
        const json = await res.json();
        if (res.ok) {
          setPendingContracts(json.contracts || []);
        } else {
          console.error('Lỗi lấy hợp đồng:', json.error);
        }
      } catch (err) {
        console.error('Lỗi fetch hợp đồng:', err);
      }
    };

    fetchContracts();
  }, []);

  const selectedContract = useMemo(() => {
    return pendingContracts.find(c => c.id === selectedContractId) || null;
  }, [selectedContractId, pendingContracts]);

  const requiredDocs = useMemo(() => {
    if (!selectedContract) return null;
    const mappings = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
    const pos = String(selectedContract.chuc_vu || selectedContract.vi_tri || '').trim();
    const req = mappings[pos];
    // Default fallback if no admin mapping
    const defaultDocs = "HĐLĐ + Bản cam kết + CCCD Photo";
    const actual = req || defaultDocs;
    return actual.split('+').map(s => s.trim());
  }, [selectedContract]);

  const loginGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: (tokenResponse) => {
      localStorage.setItem('google_token', tokenResponse.access_token);
    },
    onError: () => {
      alert('Đăng nhập Google thất bại');
    }
  });

  const FOLDER_ID = '1cBAPmzzhqVhu5KTNvRJw3_HHgovH-k28'; // 👈 folder của người khác đã share

  const handleSubmitForm = async () => {
    try {
      // ✅ Validate
      if (!formData.scanFile) {
        alert('Bạn bắt buộc phải tải lên bản Scan ký tay');
        return;
      }

      if (!isChecklistComplete) {
        alert('Bạn phải hoàn thành đầy đủ checklist hồ sơ');
        return;
      }

      let token = localStorage.getItem('google_token');

      // ✅ Auto login nếu chưa có token
      if (!token) {
        await new Promise((resolve, reject) => {
          loginGoogle({
            onSuccess: (tokenResponse) => {
              localStorage.setItem('google_token', tokenResponse.access_token);
              token = tokenResponse.access_token;
              resolve();
            },
            onError: () => reject(new Error('Login Google thất bại'))
          });
        });
      }

      if (!token) throw new Error('Không lấy được token Google');

      setLoading(true);

      const files = [formData.scanFile, ...(formData.otherFiles || [])];
      const uploadedFiles = [];

      // 🚀 Upload từng file
      for (const file of files) {
        const metadata = {
          name: `${formData.employeeId}_${Date.now()}_${file.name}`, // tránh trùng
          mimeType: file.type,
          parents: [FOLDER_ID] // 👈 QUAN TRỌNG: upload vào drive người khác
        };

        const formUpload = new FormData();
        formUpload.append(
          'metadata',
          new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        );
        formUpload.append('file', file);

        const res = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formUpload
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error('Upload thất bại: ' + JSON.stringify(data));
        }

        const fileId = data.id;

        // 🔓 (Optional) Cho phép ai cũng xem
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          })
        });

        uploadedFiles.push({
          fileId,
          name: file.name,
          url: `https://drive.google.com/file/d/${fileId}/view`
        });
      }

      // 👉 Gửi về hệ thống
      const finalPayload = {
        ...formData,
        checklist: checklistValues,
        attachments: uploadedFiles
      };

      await onSubmit(finalPayload);

      const { error } = await supabase
        .from('bien_dong_nhan_su')
        .insert([
          {
            ma_nv: formData.employeeId,
            ten_nhan_vien: formData.name,
            chuc_danh: formData.position,
            chi_nhanh: formData.department,
            muc_luong: formData.salary ? Number(formData.salary) : null,
            loai_bien_dong: 'PENDING', // 👈 mặc định
            link_file: uploadedFiles.map(f => f.url).join(', '), // nhiều file
            trang_thai: 'PENDING', // 👈 nên có
            ghi_chu: formData.note || ''
          }
        ]);

      if (error) {
      throw new Error('Lưu DB thất bại: ' + error.message);
    }

      alert('✅ Upload + lưu thành công');

    } catch (err) {
      console.error(err);

      // ❗ Token hết hạn → login lại
      if (err.message.includes('401')) {
        localStorage.removeItem('google_token');
        alert('Phiên đăng nhập hết hạn, vui lòng thử lại');
      } else {
        alert('❌ Lỗi: ' + err.message);
      }

    } finally {
      setLoading(false);
    }
  };

  const handleImportContract = (id) => {
    setSelectedContractId(id);
    const c = pendingContracts.find(x => x.id === id);
    if (!c) return;

    setFormData(prev => ({
      ...prev,
      employeeId: c.employee_id || '',
      contractNumber: c.so_hd || '',
      name: c.employee_name || '',
      nationality: c.quoc_tich || 'Việt Nam',
      birthDate: c.ngay_sinh || '',
      birthPlace: c.noi_sinh || '',
      cccd: c.cccd || '',
      cccdDate: c.cccd_date || '',
      cccdPlace: c.cccd_place || '',
      phone: c.dien_thoai || '',
      email: c.email || '',
      permanentAddress: c.dia_chi_thuong_tru || '',
      temporaryAddress: c.dia_chi_tam_tru || '',
      position: c.chuc_vu || c.vi_tri || '',
      department: c.branch || '',
      startDate: c.ngay_bat_dau || '',
      salary: c.muc_luong || '',
      salaryText: c.muc_luong_chu || '',
      contractSignDate: c.ngay_ky_hd || ''
    }));
    setChecklistValues({});
  };

  const isChecklistComplete = useMemo(() => {
    if (!requiredDocs) return true;
    return requiredDocs.every(d => checklistValues[d] === true);
  }, [requiredDocs, checklistValues]);

  const isReadyToSubmit = isChecklistComplete && formData.scanFile;

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end gap-6 mb-10">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">Báo tăng Nhân sự</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quy trình tự động hóa hồ sơ chi nhánh</p>
            </div>
          </div>
        </div>
        <div className="w-full md:w-80">
           <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 block ml-1">Lấy từ HĐ đã in (Hỗ trợ nhập liệu)</label>
           <select 
            className="w-full px-5 py-4 bg-white border-2 border-blue-100 rounded-[24px] text-sm font-black text-slate-700 outline-none focus:border-blue-500 shadow-xl shadow-blue-50/50 appearance-none cursor-pointer transition-all hover:bg-blue-50/30"
            value={selectedContractId}
            onChange={e => handleImportContract(e.target.value)}
          >
            <option value="">-- Chọn hợp đồng nhân viên --</option>
            {pendingContracts.map(c => (
              <option key={c.id} value={c.id}>{c.so_hd} - {c.branch}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: FORM INFO */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/40 p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2 flex items-center gap-3">
                <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">HỒ SƠ NHÂN SỰ</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Mã nhân viên</label>
                <input type="text" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-blue-400 font-black text-sm text-slate-700" value={formData.employeeId} readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Số hợp đồng</label>
                <input type="text" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:border-blue-400 font-black text-sm text-slate-700" value={formData.contractNumber} readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Họ và tên</label>
                <input type="text" className="w-full p-5 bg-white border border-slate-200 rounded-[20px] outline-none focus:border-blue-400 font-black text-sm text-slate-700 shadow-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Chức danh</label>
                <input type="text" className="w-full p-5 bg-white border border-slate-200 rounded-[20px] outline-none focus:border-blue-400 font-black text-sm text-slate-700 shadow-sm" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Phòng ban / Chi nhánh</label>
                <input type="text" className="w-full p-5 bg-white border border-slate-200 rounded-[20px] outline-none focus:border-blue-400 font-black text-sm text-slate-700 shadow-sm" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Mức lương</label>
                <input type={maskSalary ? "password" : "text"} className="w-full p-5 bg-white border border-slate-200 rounded-[20px] outline-none focus:border-blue-400 font-black text-sm text-slate-700 shadow-sm" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CHECKLIST & SCAN */}
        <div className="lg:col-span-4 space-y-6">
          {/* SCAN UPLOAD */}
          <div className="bg-white rounded-[40px] border-2 border-dashed border-indigo-200 p-8 shadow-xl shadow-indigo-100/20 relative overflow-hidden group">
            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-sm shadow-lg shadow-indigo-200">↑</span>
              Bản scan ký tay (PDF) <span className="text-red-500">*</span>
            </h4>
            
            <input 
              type="file" 
              accept="application/pdf"
              className="hidden" 
              id="onboarding-scan"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFormData({ ...formData, scanFile: f });
              }}
            />
            <label htmlFor="onboarding-scan" className="flex flex-col items-center justify-center gap-4 w-full py-12 bg-slate-50 border-2 border-slate-100 border-dashed rounded-[32px] cursor-pointer group-hover:border-indigo-400 group-hover:bg-indigo-50/30 transition-all">
              <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-3xl shadow-inner transition-all ${formData.scanFile ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'}`}>
                {formData.scanFile ? '✓' : '📄'}
              </div>
              <div className="text-center">
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-1">
                  {formData.scanFile ? 'Đã tải hồ sơ quét' : 'Chọn file Scan PDF'}
                </span>
                {formData.scanFile && <span className="text-[10px] font-bold text-emerald-600 truncate max-w-[150px] block">{formData.scanFile.name}</span>}
              </div>
            </label>
          </div>

          {/* CHECKLIST */}
          {requiredDocs && (
            <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-xl shadow-slate-200/30">
               <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                 <span className="w-8 h-8 border-2 border-slate-800 text-slate-800 rounded-xl flex items-center justify-center text-xs">✓</span>
                 Bảng kê hồ sơ bắt buộc
               </h4>
               <div className="space-y-3">
                 {requiredDocs.map(doc => (
                   <label key={doc} className="flex items-center gap-4 p-5 bg-slate-50 rounded-[20px] cursor-pointer hover:bg-blue-50 transition-all border-2 border-transparent has-[:checked]:border-blue-400 group">
                     <input 
                       type="checkbox" 
                       checked={checklistValues[doc] || false}
                       onChange={e => setChecklistValues({ ...checklistValues, [doc]: e.target.checked })}
                       className="w-6 h-6 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                     />
                     <span className="text-xs font-black text-slate-700 group-hover:text-blue-700 tracking-tight">{doc}</span>
                   </label>
                 ))}
               </div>
            </div>
          )}
        </div>

        {/* BOTTOM: NOTE & SUBMIT */}
        <div className="lg:col-span-12">
          <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-xl shadow-slate-200/30">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 block ml-1">Ghi chú quan trọng cho bộ phận HRM Tổng</label>
            <textarea 
              className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[32px] outline-none focus:border-blue-400 text-sm font-black text-slate-700 min-h-[160px] resize-none shadow-inner"
              placeholder="Nhập ghi chú chi tiết về hồ sơ này (ví dụ: xin bổ sung file sau, lưu ý về ngày làm việc...)"
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
            
            <div className="mt-10 flex flex-col md:flex-row items-center gap-8 border-t border-slate-50 pt-10">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isChecklistComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kiểm tra hồ sơ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${formData.scanFile ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tải lên bản Scan (Bắt buộc)</span>
                </div>
              </div>

              <button 
                disabled={!isReadyToSubmit || loading}
                onClick={handleSubmitForm}
                className={`w-80 py-6 font-black rounded-[24px] shadow-2xl uppercase tracking-[0.3em] transition-all flex justify-center items-center gap-4 text-sm active:scale-[0.98] 
                ${isReadyToSubmit && !loading 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                {loading ? 'ĐANG XỬ LÝ...' : 'Báo tăng →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FORM 2: NGHỈ PHÉP / THAI SẢN ────────────────────────────────────
function LeaveForm({ employees, onSubmit }) {
  const [department, setDepartment] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [formData, setFormData] = useState({ employeeName: '', employeeId: '', leaveType: 'ANNUAL', from: '', to: '', reason: '' });

  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach(e => set.add(e.department || '')); 
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (department !== 'ALL') list = list.filter(e => e.department === department);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(e => (e.name || '').toLowerCase().includes(s) || (e.id || '').toLowerCase().includes(s));
    }
    return list;
  }, [employees, department, search]);

  const selectedEmp = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  const readFilesToAttachments = async (fileList) => {
    const files = Array.from(fileList || []);
    const toAttachment = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(file);
    });
    const results = [];
    for (const f of files) {
      try {
        results.push(await toAttachment(f));
      } catch (_) {
      }
    }
    return results;
  };
  
  const stats = useMemo(() => {
    if (!formData.from || !formData.to) return null;
    const start = parseISO(formData.from);
    const end = parseISO(formData.to);
    const days = differenceInDays(end, start) + 1;
    
    let label = "Nghỉ phép năm";
    let isPaid = true;
    let detail = `${days} ngày`;

    if (formData.leaveType === 'MATERNITY') {
      label = "Nghỉ thai sản";
      const backDate = addMonths(start, 6);
      detail = `Dự kiến đi làm lại: ${format(backDate, 'dd/MM/yyyy')}`;
    } else if (formData.leaveType === 'SICK') {
      label = "Nghỉ ốm (Hưởng BHXH)";
    } else if (formData.leaveType === 'UNPAID') {
      label = "Nghỉ không lương";
      isPaid = false;
    }

    return { days, label, isPaid, detail };
  }, [formData.from, formData.to, formData.leaveType]);

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Calculator className="text-purple-500" /> Tính toán nghỉ phép</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Phòng ban / Chi nhánh</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={department} onChange={e => setDepartment(e.target.value)}>
            <option value="ALL">Tất cả</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Tìm mã / tên</label>
          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={search} onChange={e => setSearch(e.target.value)} placeholder="Gõ mã NV hoặc tên" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Chọn nhân sự</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={selectedEmployeeId} onChange={e => {
            const id = e.target.value;
            setSelectedEmployeeId(id);
            const emp = employees.find(x => x.id === id);
            setFormData(prev => ({ ...prev, employeeName: emp?.name || '', employeeId: emp?.id || '' }));
          }}>
            <option value="">-- Chọn nhân viên --</option>
            {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name} ({e.department})</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Loại hình nghỉ</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
            {[
              { id: 'ANNUAL', label: 'Phép năm' },
              { id: 'SICK', label: 'Nghỉ ốm' },
              { id: 'MATERNITY', label: 'Thai sản' },
              { id: 'UNPAID', label: 'Không lương' }
            ].map(type => (
              <button key={type.id} onClick={() => setFormData({...formData, leaveType: type.id})} className={`p-2 text-xs font-bold rounded-lg border-2 transition-all ${formData.leaveType === type.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                {type.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Từ ngày</label>
          <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.from} onChange={e => setFormData({...formData, from: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Đến ngày</label>
          <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.to} onChange={e => setFormData({...formData, to: e.target.value})} />
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
            <Paperclip size={14} /> Tài liệu đính kèm (đơn nghỉ, giấy BHXH, giấy khám, ...)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            onChange={async (e) => {
              const items = await readFilesToAttachments(e.target.files);
              setAttachments(prev => [...prev, ...items]);
            }}
          />
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a, idx) => (
                <div key={idx} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" />
                  <span className="max-w-[220px] truncate">{a.name}</span>
                  <button className="text-slate-400 hover:text-red-600" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                    <XCircle size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className="mt-6 p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Kết quả tính toán</div>
            <div className="text-xl font-black">{stats.label}</div>
            <div className="text-xs text-slate-400 mt-1">{stats.detail} · {stats.isPaid ? 'Có lương' : 'Không lương'}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-blue-400">{stats.days}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Tổng số ngày</div>
          </div>
        </div>
      )}

      <button onClick={() => onSubmit({ ...formData, employeeName: selectedEmp?.name || formData.employeeName, employeeId: selectedEmp?.id || formData.employeeId, department: selectedEmp?.department || department, attachments, ...stats })} className="w-full mt-8 py-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all">
        Gửi yêu cầu HRM
      </button>
    </div>
  );
}

// ─── FORM 3: BIẾN ĐỘNG CÔNG TÁC / LƯƠNG ──────────────────────────────
function CareerMovementForm({ employees, onSubmit, maskSalary = false }) {
  const [department, setDepartment] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    type: 'PROMOTION',
    newRole: '',
    newSalary: '',
    newSalaryText: '',
    housingAllowance: '',
    travelAllowance: '',
    phoneAllowance: '',
    newDepartment: '',
    effectiveDate: '',
    reason: ''
  });

  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach(e => set.add(e.department || '')); 
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (department !== 'ALL') list = list.filter(e => e.department === department);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(e => (e.name || '').toLowerCase().includes(s) || (e.id || '').toLowerCase().includes(s));
    }
    return list;
  }, [employees, department, search]);

  const selectedEmp = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="text-orange-500" /> Biến động vị trí & Lương</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Phòng ban / Chi nhánh</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={department} onChange={e => setDepartment(e.target.value)}>
            <option value="ALL">Tất cả</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Tìm mã / tên</label>
          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={search} onChange={e => setSearch(e.target.value)} placeholder="Gõ mã NV hoặc tên" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Chọn nhân sự</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={selectedEmployeeId} onChange={e => {
            const id = e.target.value;
            setSelectedEmployeeId(id);
            const emp = employees.find(x => x.id === id);
            setFormData(prev => ({
              ...prev,
              employeeId: emp?.id || '',
              employeeName: emp?.name || '',
              newDepartment: prev.newDepartment || emp?.department || ''
            }));
          }}>
            <option value="">-- Chọn nhân viên --</option>
            {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name} ({e.position})</option>)}
          </select>
        </div>

        {selectedEmp && (
          <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
            <div className="flex gap-4">
              <div><span className="text-slate-400">Vị trí hiện tại:</span> <span className="font-bold">{selectedEmp.position}</span></div>
              <div><span className="text-slate-400">Phòng ban:</span> <span className="font-bold">{selectedEmp.department}</span></div>
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Vị trí mới</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.newRole} onChange={e => setFormData({...formData, newRole: e.target.value})} placeholder={selectedEmp?.position} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Phòng ban/chi nhánh mới</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.newDepartment} onChange={e => setFormData({...formData, newDepartment: e.target.value})} placeholder={selectedEmp?.department} />
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Loại biến động</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
            {[
              { id: 'PROMOTION', label: 'Thăng chức' },
              { id: 'TRANSFER', label: 'Điều chuyển' },
              { id: 'SALARY_UP', label: 'Tăng lương' },
              { id: 'RESIGN', label: 'Nghỉ việc' }
            ].map(type => (
              <button key={type.id} onClick={() => setFormData({...formData, type: type.id})} className={`p-2 text-xs font-bold rounded-lg border-2 transition-all ${formData.type === type.id ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                {type.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Mức lương mới (số)</label>
          <input type={maskSalary ? "password" : "text"} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.newSalary} onChange={e => setFormData({...formData, newSalary: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Mức lương mới (chữ)</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.newSalaryText} onChange={e => setFormData({...formData, newSalaryText: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Phụ cấp chỗ ở</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.housingAllowance} onChange={e => setFormData({...formData, housingAllowance: e.target.value})} placeholder="đồng/tháng" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Phụ cấp đi lại</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.travelAllowance} onChange={e => setFormData({...formData, travelAllowance: e.target.value})} placeholder="đồng/tháng" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Phụ cấp điện thoại</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.phoneAllowance} onChange={e => setFormData({...formData, phoneAllowance: e.target.value})} placeholder="đồng/tháng" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Ngày hiệu lực</label>
          <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.effectiveDate} onChange={e => setFormData({...formData, effectiveDate: e.target.value})} />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Lý do / ghi chú</label>
          <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
        </div>
      </div>

      <button onClick={() => onSubmit({ ...formData, employeeName: selectedEmp?.name || formData.employeeName, employeeId: selectedEmp?.id || formData.employeeId, currentDepartment: selectedEmp?.department, currentRole: selectedEmp?.position })} className="w-full mt-8 py-4 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all flex justify-center items-center gap-2">
        <Send size={18} /> Gửi trình ký HRM
      </button>
    </div>
  );
}

// ─── COMPONENT: DANH SÁCH LỊCH SỬ (Cho cả Chi nhánh & Admin) ───────────
function HistoryList() {
  const [movements, setMovements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ Lấy dữ liệu từ API
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('https://hopdong-delta.vercel.app/api/get-pending-bd');
        const data = await response.json();

        // Nếu API trả về field khác, map về đúng structure movements
        const formatted = (data.contracts || []).map(item => ({
          id: item.ma_nv || item.contractId || Math.random().toString(36).substr(2, 9),
          employeeName: item.ten_nhan_vien || item.name || '---',
          status: item.trang_thai || 'PENDING',
          createdAt: item.created_at || item.dateCreated || new Date().toISOString(),
          type: item.loai_bien_dong || 'ONBOARDING',
          branchId: item.chi_nhanh || item.branch || '---',
          details: {
            employeeId: item.ma_nv,
            position: item.chuc_danh || '---',
            department: item.chi_nhanh || '---',
            salary: item.muc_luong || '---',
            salaryText: item.luong_text || '---',
            phone: item.dien_thoai || '---',
            cccd: item.cccd || '---',
            cccdPlace: item.cccd_noi_cap || '---',
            cccdDate: item.cccd_ngay_cap || '---',
            newRole: item.chuc_danh_moi,
            newDepartment: item.phong_ban_moi,
            newSalary: item.muc_luong_moi,
            reason: item.ly_do
          },
          decisionNote: item.ghi_chu || item.note || '',
          branchNote: item.ghi_chu || '',
          attachments: item.attachments || []
        }));

        setMovements(formatted);
      } catch (err) {
        console.error("Lỗi load movements:", err);
        setMovements([]);
      }
    }
    loadData();
  }, []); // Chỉ chạy 1 lần khi mount

  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [movements]);

  const processing = sortedMovements.filter(m => m.status === 'PENDING' || m.status === 'REVISION');
  const history = sortedMovements.filter(m => {
    if (m.status !== 'APPROVED' && m.status !== 'REJECTED') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const dateStr = m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : '';
    return (m.employeeName || '').toLowerCase().includes(q) || 
           (m.branchId || '').toLowerCase().includes(q) ||
           (m.details?.employeeId || '').toLowerCase().includes(q) ||
           dateStr.includes(q);
  });

  const renderMovement = (m) => {
    let bClass = 'bg-white border-slate-200 hover:border-blue-400';
    if (m.status === 'APPROVED') bClass = 'bg-emerald-50/40 border-emerald-500 hover:border-emerald-600';
    if (m.status === 'REJECTED') bClass = 'bg-red-50/40 border-red-500 hover:border-red-600';

    return (
      <div key={m.id} onClick={() => setSelected(m)} className={`p-4 border-2 rounded-2xl mb-3 cursor-pointer transition-all shadow-sm group flex flex-col justify-between ${bClass}`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
              m.type === 'ONBOARDING' ? 'bg-blue-100 text-blue-600' :
              m.type === 'LEAVE' ? 'bg-purple-100 text-purple-600' :
              'bg-orange-100 text-orange-600'
            }`}>
              {m.type.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{m.employeeName}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                <span className="font-medium text-slate-700">{m.branchId}</span> · {m.details?.position || m.details?.newRole || m.type} · {m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : ''}
              </div>
            </div>
          </div>
          <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[11px] font-bold flex items-center gap-1 shrink-0">
            Chi tiết <ArrowRightLeft size={14} />
          </div>
        </div>
        
        {(m.status === 'REJECTED' || m.status === 'REVISION') && m.decisionNote && (
          <div className={`mt-3 pt-3 border-t ${m.status === 'REJECTED' ? 'border-red-200' : 'border-orange-200'} w-full`}>
            <div className={`text-[11px] px-3 py-2 rounded-xl inline-block w-full ${m.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
               <strong className={`${m.status === 'REJECTED' ? 'text-red-900' : 'text-orange-900'} block mb-0.5`}>
                 {m.status === 'REJECTED' ? 'HRM Từ chối:' : 'Ghi chú HRM:'}
               </strong> 
               {m.decisionNote}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Clock size={14} /> Đang xử lý ({processing.length})</h4>
        {processing.map(m => renderMovement(m))}
        {processing.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Không có hồ sơ đang xử lý</div>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 shrink-0"><History size={14} /> Lịch sử ({history.length})</h4>
          <div className="relative w-full max-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-[600px] overflow-y-auto pr-2">
          {history.length > 0 ? history.map(m => renderMovement(m)) : (
            <div className="text-center py-10 text-slate-400 text-sm">Chưa có lịch sử hoặc không tìm thấy</div>
          )}
        </div>
      </div>
      
      <MovementDetailModal movement={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    'PENDING': { label: 'Chờ duyệt', class: 'bg-yellow-100 text-yellow-700' },
    'APPROVED': { label: 'Đã duyệt', class: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: <CheckCircle size={12} className="mr-1 inline" /> },
    'REJECTED': { label: 'Từ chối', class: 'bg-red-100 text-red-800 border border-red-200', icon: <XCircle size={12} className="mr-1 inline" /> },
    'REVISION': { label: 'Kiểm tra lại', class: 'bg-orange-100 text-orange-800 border border-orange-200' }
  };
  const config = configs[status] || configs['PENDING'];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center w-fit ${config.class}`}>
    {config.icon}{config.label}
  </span>;
}

function MovementDetailModal({ movement, onClose, onApprove, onReject, onRevision }) {
  if (!movement) return null;
  const m = movement;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
              m.type === 'ONBOARDING' ? 'bg-blue-100 text-blue-600' :
              m.type === 'LEAVE' ? 'bg-purple-100 text-purple-600' :
              'bg-orange-100 text-orange-600'
            }`}>
              {m.type.charAt(0)}
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">{m.employeeName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={m.status} />
                <span className="text-xs text-slate-500 font-medium">{m.branchId} · {format(parseISO(m.createdAt), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-800 transition-colors">
            <XCircle size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <div className="mb-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Thông tin chi tiết ({m.type})</h4>
            {m.type === 'ONBOARDING' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div><span className="text-slate-400 text-xs block mb-0.5">Mã NV:</span> <span className="font-bold text-sm text-slate-700">{m.details?.employeeId || '---'}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Số HĐ:</span> <span className="font-bold text-sm text-blue-700">{m.details?.contractNumber || '---'}</span></div>
                
                <div><span className="text-slate-400 text-xs block mb-0.5">Chức danh:</span> <span className="font-bold text-sm text-slate-700">{m.details?.position || '---'}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Phòng ban:</span> <span className="font-bold text-sm text-slate-700">{m.details?.department || '---'}</span></div>

                <div><span className="text-slate-400 text-xs block mb-0.5">Điện thoại:</span> <span className="font-bold text-sm text-slate-700">{m.details?.phone || '---'}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">CCCD:</span> <span className="font-bold text-sm text-slate-700">{m.details?.cccd || '---'}</span> <span className="text-[10px] text-slate-400">({m.details?.cccdPlace} - {m.details?.cccdDate})</span></div>

                <div className="col-span-1 md:col-span-2">
                  <span className="text-slate-400 text-xs block mb-0.5">Lương:</span> 
                  <span className="font-black text-lg text-emerald-600">{m.details?.salary || '---'}</span> <span className="text-sm font-medium text-slate-500">({m.details?.salaryText || '---'})</span>
                </div>

                {m.details?.checklist && Object.keys(m.details.checklist).length > 0 && (
                  <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 p-4 bg-slate-50 rounded-2xl">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Checklist Hồ sơ bản cứng</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(m.details.checklist).map(([docName, isChecked]) => (
                        <span key={docName} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${isChecked ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'}`}>
                          {isChecked ? '✓' : '✗'} {docName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {m.type === 'LEAVE' && (
              <div className="space-y-4">
                <div><span className="text-slate-400 text-xs block mb-0.5">Loại nghỉ:</span> <span className="font-bold text-sm text-slate-700">{m.details?.label} ({m.details?.days} ngày)</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Thời gian:</span> <span className="font-bold text-sm text-slate-700">Từ {m.details?.from} đến {m.details?.to}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Lý do:</span> <span className="font-bold text-sm text-slate-700">{m.details?.reason}</span></div>
              </div>
            )}
            
            {m.type === 'CAREER_CHANGE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div><span className="text-slate-400 text-xs block mb-0.5">Loại biến động:</span> <span className="font-bold text-sm text-slate-700">{m.details?.type}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Ngày hiệu lực:</span> <span className="font-bold text-sm text-slate-700">{m.details?.effectiveDate || '---'}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Chức danh mới:</span> <span className="font-bold text-sm text-slate-700">{m.details?.newRole || '---'}</span></div>
                <div><span className="text-slate-400 text-xs block mb-0.5">Phòng ban mới:</span> <span className="font-bold text-sm text-slate-700">{m.details?.newDepartment || '---'}</span></div>
                <div className="col-span-1 md:col-span-2"><span className="text-slate-400 text-xs block mb-0.5">Mức lương mới:</span> <span className="font-bold text-sm text-emerald-600">{m.details?.newSalary || '---'}</span></div>
                <div className="col-span-1 md:col-span-2"><span className="text-slate-400 text-xs block mb-0.5">Ghi chú:</span> <span className="font-bold text-sm text-slate-700">{m.details?.reason}</span></div>
              </div>
            )}
          </div>
          
          {m.branchNote && (
            <div className="mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Ghi chú từ Chi nhánh</span>
              <p className="text-sm font-medium text-blue-900">{m.branchNote}</p>
            </div>
          )}

          {m.decisionNote && (
            <div className={`mb-6 p-4 rounded-2xl border ${m.status === 'REJECTED' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${m.status === 'REJECTED' ? 'text-red-500' : 'text-orange-500'}`}>
                {m.status === 'REJECTED' ? 'HRM Từ chối với lý do:' : 'HRM Phản hồi:'}
              </span>
              <p className={`text-sm font-bold ${m.status === 'REJECTED' ? 'text-red-900' : 'text-orange-900'}`}>{m.decisionNote}</p>
            </div>
          )}

          {(() => {
            const attachments = Array.isArray(m.attachments) && m.attachments.length > 0 
              ? m.attachments 
              : [{ name: 'Ban_Scan_Ho_So_GoogleDrive.pdf', dataUrl: 'https://drive.google.com/file/d/1gHmw4qokbWMmFmOLATGobqlgtQu3_alO/view?usp=drive_link' }];
              
            return (
              <div className="mb-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Tài liệu đính kèm</h4>
                <div className="flex flex-wrap gap-3">
                  {attachments.map((a, idx) => (
                    <a
                      key={idx}
                      href={a.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs font-black text-indigo-700 flex items-center gap-3 hover:border-indigo-400 hover:bg-indigo-100 hover:text-indigo-800 transition-all shadow-sm"
                      title="Nhấn để xem file trên Google Drive / Trình duyệt"
                      onClick={e => e.stopPropagation()}
                    >
                      <FileText size={18} className="text-indigo-500 shrink-0" />
                      <span className="max-w-[250px] truncate">{a.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
        
        {onApprove && onReject && (m.status === 'PENDING' || m.status === 'REVISION') && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end rounded-b-3xl">
            <button onClick={() => {
              const note = prompt("Nhập lý do yêu cầu kiểm tra lại:");
              if (note) { onRevision(m, note); onClose(); }
            }} className="px-5 py-2.5 bg-white border-2 border-orange-200 text-orange-600 hover:border-orange-500 hover:bg-orange-50 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <HelpCircle size={16} /> Kiểm tra lại
            </button>
            <button onClick={() => { onReject(m); onClose(); }} className="px-5 py-2.5 bg-white border-2 border-red-200 text-red-600 hover:border-red-500 hover:bg-red-50 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <XCircle size={16} /> Từ chối
            </button>
            <button onClick={() => { onApprove(m); onClose(); }} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-200 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <CheckCircle size={16} /> Phê duyệt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD: HRM PHÊ DUYỆT ─────────────────────────────────────────
function ApprovalDashboard({ onApprove, onReject, onRevision }) {
  const [localMovements, setLocalMovements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Lấy dữ liệu từ API
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('https://hopdong-delta.vercel.app/api/get-pending-bd');
        const data = await response.json();

        const formatted = (data.contracts || []).map(item => ({
          id: item.ma_nv || item.contractId || Math.random().toString(36).substr(2, 9),
          employeeName: item.ten_nhan_vien || item.name || '---',
          status: item.trang_thai || 'PENDING',
          createdAt: item.created_at || item.dateCreated || new Date().toISOString(),
          type: item.loai_bien_dong || 'ONBOARDING',
          branchId: item.chi_nhanh || item.branch || '---',
          details: {
            employeeId: item.ma_nv,
            position: item.chuc_danh || '---',
            department: item.chi_nhanh || '---',
            salary: item.muc_luong || '---',
            salaryText: item.luong_text || '---',
            phone: item.dien_thoai || '---',
            cccd: item.cccd || '---',
            cccdPlace: item.cccd_noi_cap || '---',
            cccdDate: item.cccd_ngay_cap || '---',
            newRole: item.chuc_danh_moi,
            newDepartment: item.phong_ban_moi,
            newSalary: item.muc_luong_moi,
            reason: item.ly_do
          },
          decisionNote: item.ghi_chu || item.note || '',
          branchNote: item.ghi_chu || '',
          attachments: item.attachments || []
        }));

        setLocalMovements(formatted);
      } catch (err) {
        console.error("Lỗi load movements:", err);
        setLocalMovements([]);
      }
    }
    loadData();
  }, []);

  const sortedMovements = useMemo(() => {
    return [...localMovements].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [localMovements]);

  const pending = sortedMovements.filter(m => m.status === 'PENDING' || m.status === 'REVISION');
  const history = sortedMovements.filter(m => {
    if (m.status !== 'APPROVED' && m.status !== 'REJECTED') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const dateStr = m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : '';
    return (m.employeeName || '').toLowerCase().includes(q) || 
           (m.branchId || '').toLowerCase().includes(q) ||
           (m.details?.employeeId || '').toLowerCase().includes(q) ||
           dateStr.includes(q);
  });

  const renderMovement = (m, isHistory = false) => {
    let bClass = 'bg-white border-slate-200 hover:border-blue-400';
    if (m.status === 'APPROVED') bClass = 'bg-emerald-50/40 border-emerald-500 hover:border-emerald-600';
    if (m.status === 'REJECTED') bClass = 'bg-red-50/40 border-red-500 hover:border-red-600';

    return (
      <div key={m.id} onClick={() => setSelected(m)} className={`p-4 border-2 rounded-2xl mb-3 cursor-pointer transition-all shadow-sm group flex flex-col justify-between ${bClass}`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
              m.type === 'ONBOARDING' ? 'bg-blue-100 text-blue-600' :
              m.type === 'LEAVE' ? 'bg-purple-100 text-purple-600' :
              'bg-orange-100 text-orange-600'
            }`}>
              {m.type.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{m.employeeName}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                 <span className="font-medium text-slate-700">{m.branchId}</span> · {m.details?.position || m.details?.newRole || m.type} · {m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : ''}
              </div>
            </div>
          </div>
          <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[11px] font-bold flex items-center gap-1 shrink-0">
             Xem hồ sơ <ArrowRightLeft size={14} />
          </div>
        </div>
        
        {(m.status === 'REJECTED' || m.status === 'REVISION') && m.decisionNote && (
          <div className={`mt-3 pt-3 border-t ${m.status === 'REJECTED' ? 'border-red-200' : 'border-orange-200'} w-full`}>
            <div className={`text-[11px] px-3 py-2 rounded-xl inline-block w-full ${m.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
               <strong className={`${m.status === 'REJECTED' ? 'text-red-900' : 'text-orange-900'} block mb-0.5`}>
                 {m.status === 'REJECTED' ? 'Lý do từ chối:' : 'Ghi chú HRM:'}
               </strong> 
               {m.decisionNote}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Clock size={14} /> Chờ duyệt ({pending.length})</h4>
        {pending.map(m => renderMovement(m))}
        {pending.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Không có yêu cầu chờ duyệt</div>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 shrink-0"><History size={14} /> Lịch sử xử lý</h4>
          <div className="relative w-full max-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm tên, mã, chi nhánh, ngày..." 
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-[500px] overflow-y-auto pr-2">
          {history.length > 0 ? history.map(m => renderMovement(m, true)) : (
            <div className="text-center py-10 text-slate-400 text-sm">Không tìm thấy yêu cầu nào</div>
          )}
        </div>
      </div>
      
      <MovementDetailModal 
         movement={selected} 
         onClose={() => setSelected(null)} 
         onApprove={onApprove} 
         onReject={onReject} 
         onRevision={onRevision} 
      />
    </div>
  );
}

// ─── COMPONENT: MODAL XUẤT BÁO CÁO NHÂN SỰ ────────────────────────────
function MovementReportModal({ isOpen, onClose, movements }) {
  const [filters, setFilters] = useState({
    startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'ALL',
    status: 'ALL'
  });

  const filtered = useMemo(() => {
    return movements.filter(m => {
      const mDate = m.createdAt ? format(parseISO(m.createdAt), 'yyyy-MM-dd') : '';
      const dateMatch = (!filters.startDate || mDate >= filters.startDate) && (!filters.endDate || mDate <= filters.endDate);
      const typeMatch = filters.type === 'ALL' || m.type === filters.type;
      const statusMatch = filters.status === 'ALL' || m.status === filters.status;
      return dateMatch && typeMatch && statusMatch;
    });
  }, [movements, filters]);

  const exportCSV = () => {
    const headers = ["ID", "Loại", "Ngày gửi", "Nhân viên", "Mã NV", "Chi nhánh", "Trạng thái", "Ghi chú HRM"];
    const rows = filtered.map(m => [
      m.id, 
      m.type, 
      m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : '',
      m.employeeName,
      m.employeeId || 'N/A',
      m.branchId,
      m.status,
      m.decisionNote?.replace(/,/g, ';') || ''
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_bien_dong_${filters.startDate}_${filters.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
          <div>
            <h3 className="text-xl font-black text-slate-800">Báo cáo biến động nhân sự</h3>
            <p className="text-xs text-slate-500 font-medium">Lọc và kết xuất dữ liệu báo cáo cho Giám đốc</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <XCircle size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Từ ngày</label>
              <input type="date" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 shadow-sm" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Đến ngày</label>
              <input type="date" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 shadow-sm" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Loại hồ sơ</label>
              <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 shadow-sm" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
                <option value="ALL">Tất cả</option>
                <option value="ONBOARDING">Tuyển dụng mới</option>
                <option value="LEAVE">Nghỉ phép/Sức khỏe</option>
                <option value="CAREER_CHANGE">Thay đổi sự nghiệp</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Trạng thái</label>
              <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 shadow-sm" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                <option value="ALL">Tất cả</option>
                <option value="APPROVED">Đã duyệt (Xanh)</option>
                <option value="REJECTED">Từ chối (Đỏ)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Danh sách kết quả ({filtered.length})</span>
          </div>
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Ngày</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Nhân viên</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Loại</th>
                  <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-xs font-medium text-slate-600">{m.createdAt ? format(parseISO(m.createdAt), 'dd/MM/yyyy') : '-'}</td>
                    <td className="p-3">
                      <div className="text-xs font-bold text-slate-800">{m.employeeName}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{m.branchId}</div>
                    </td>
                    <td className="p-3 text-[10px] font-bold text-slate-500">
                      {m.type === 'ONBOARDING' ? 'Tuyển dụng' : m.type === 'LEAVE' ? 'Nghỉ phép' : 'Biến động'}
                    </td>
                    <td className="p-3">
                       <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-10 text-center text-sm text-slate-400 italic">Không có dữ liệu thỏa mãn bộ lọc</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium italic">* Báo cáo bao gồm đầy đủ chi tiết theo bộ lọc hiện tại.</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-white rounded-xl transition-all">Đóng</button>
            <button 
              onClick={exportCSV} 
              disabled={filtered.length === 0}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white shadow-xl shadow-blue-100 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <FileText size={18} /> Xác nhận & Tải CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
