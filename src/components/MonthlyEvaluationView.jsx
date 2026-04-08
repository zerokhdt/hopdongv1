import React, { useState, useMemo, useEffect } from 'react';
import { Settings, Users, CheckCircle2, ChevronRight, X, Save, Plus, Trash2, Download, Star } from 'lucide-react';

const TAGS_KEY = 'ace_eval_tags_v1';
const DATA_KEY = 'ace_evaluations_v1';

const DEFAULT_TAGS = {
  positive: ['Hoàn thành xuất sắc', 'Chăm chỉ', 'Hỗ trợ đồng nghiệp', 'Thái độ tích cực'],
  negative: ['Chưa đạt KPI', 'Đi làm muộn', 'Thái độ chưa tốt', 'Thiếu trách nhiệm']
};

export default function MonthlyEvaluationView({ userRole = 'user', branches = [], employees = [] }) {
  const isAdmin = userRole === 'admin';
  const branch = localStorage.getItem('user_branch') || (branches[0] || '');
  const [activeTab, setActiveTab] = useState(isAdmin ? 'settings' : 'evaluate');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // State: Tags
  const [tags, setTags] = useState(() => {
    try {
      const stored = localStorage.getItem(TAGS_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_TAGS;
    } catch {
      return DEFAULT_TAGS;
    }
  });

  // State: Evaluations
  const [evaluations, setEvaluations] = useState(() => {
    try {
      const stored = localStorage.getItem(DATA_KEY);
      if (stored && Object.keys(JSON.parse(stored)).length > 0) {
        return JSON.parse(stored);
      }
    } catch {}

    // TRUNGX - TẠO DỮ LIỆU MẪU ĐỂ TEST NẾU APP TRỐNG:
    const mockMonth = new Date().toISOString().slice(0, 7);
    const mockData = {
      [mockMonth]: {
        "ACE001": { score: 9.5, posTags: ["Hoàn thành xuất sắc", "Chăm chỉ"], negTags: [], comments: "Tháng này làm rất tốt, tiếp tục phát huy!" },
        "ACE002": { score: 6.0, posTags: ["Thái độ tích cực"], negTags: ["Chưa đạt KPI", "Đi làm muộn"], comments: "Cần cải thiện tốc độ làm việc." },
        "ACE003": { score: 8.0, posTags: ["Hỗ trợ đồng nghiệp", "Chăm chỉ"], negTags: [], comments: "Hỗ trợ team rất nhiệt tình." }
      }
    };
    return mockData;
  });

  useEffect(() => {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    localStorage.setItem(DATA_KEY, JSON.stringify(evaluations));
  }, [evaluations]);

  // Data processing
  const branchEmployees = useMemo(() => {
    const list = isAdmin ? employees : employees.filter(e => e.department === branch);
    return list.filter(e => e.name && e.id); // Valid employees only
  }, [employees, branch, isAdmin]);

  const currentEvals = useMemo(() => {
    return evaluations[month] || {};
  }, [evaluations, month]);

  const stats = useMemo(() => {
    let done = 0;
    branchEmployees.forEach(emp => {
      if (currentEvals[emp.id] && currentEvals[emp.id].score !== undefined) done++;
    });
    return { total: branchEmployees.length, done };
  }, [branchEmployees, currentEvals]);

  // Handle Tag Settings
  const addTag = (type) => {
    const text = window.prompt(`Nhập thẻ ${type === 'positive' ? 'Cộng' : 'Trừ'} mới:`);
    if (text?.trim()) {
      setTags(prev => ({ ...prev, [type]: [...prev[type], text.trim()] }));
    }
  };
  const removeTag = (type, index) => {
    setTags(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  // Grading Panel State
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [editingEval, setEditingEval] = useState(null);

  const openGrading = (emp) => {
    setSelectedEmp(emp);
    const existing = currentEvals[emp.id] || { selfScore: '', score: 7.5, posTags: [], negTags: [], comments: '' };
    setEditingEval(existing);
  };

  const closeGrading = () => {
    setSelectedEmp(null);
    setEditingEval(null);
  };

  const saveEvaluation = (andNext = false) => {
    if (!selectedEmp || !editingEval) return;
    setEvaluations(prev => {
      const nextMonthData = { ...(prev[month] || {}) };
      nextMonthData[selectedEmp.id] = { ...editingEval, updatedAt: new Date().toISOString() };
      return { ...prev, [month]: nextMonthData };
    });

    if (andNext) {
      const idx = branchEmployees.findIndex(e => e.id === selectedEmp.id);
      if (idx >= 0 && idx < branchEmployees.length - 1) {
        openGrading(branchEmployees[idx + 1]);
      } else {
        closeGrading();
      }
    } else {
      closeGrading();
    }
  };

  const toggleTag = (type, tag) => {
    const listKey = type === 'positive' ? 'posTags' : 'negTags';
    const currentList = editingEval[listKey] || [];
    if (currentList.includes(tag)) {
      setEditingEval(prev => ({ ...prev, [listKey]: currentList.filter(t => t !== tag) }));
    } else {
      setEditingEval(prev => ({ ...prev, [listKey]: [...currentList, tag] }));
    }
  };

  // Export CSV
  const exportCsv = () => {
    const headers = ['Mã NV', 'Họ Tên', 'Chức Vụ', 'Chi Nhánh', 'Tự Nhận(Giấy)', 'Quản Lý Chấm', 'Thẻ Cộng', 'Thẻ Trừ', 'Nhận Xét'];
    const lines = [headers.join(',')];
    
    // Group all exported data by the selected month
    const monthData = evaluations[month] || {};
    employees.forEach(emp => {
      const ev = monthData[emp.id];
      if (ev) {
        const row = [
          emp.id, emp.name, emp.position, emp.department,
          ev.selfScore || '', ev.score, (ev.posTags||[]).join('; '), (ev.negTags||[]).join('; '), ev.comments
        ];
        lines.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
      }
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DanhGia_${month}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col bg-[#F2F4F7] p-6 overflow-hidden relative">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Star className="text-yellow-500 fill-yellow-500" size={24} />
              Đánh giá nhân sự theo biểu mẫu "1 Chạm"
            </h2>
            <p className="text-slate-500 text-sm mt-1">Hệ thống đánh giá nhanh qua Thang điểm + Bộ Thẻ Tags</p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            {isAdmin && (
              <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Cài đặt Tiêu Chí
              </button>
            )}
            <button onClick={() => setActiveTab('evaluate')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'evaluate' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Quản lý chấm điểm
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200">
        
        {/* TAB 1: CÀI ĐẶT TIÊU CHÍ */}
        {activeTab === 'settings' && isAdmin && (
          <div className="h-full p-6 overflow-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Settings size={20} className="text-slate-400" /> Cấu hình Bộ Thẻ (Tags) Đánh Giá
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Positive Tags */}
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-emerald-800">Thẻ Điểm Cộng (Khen)</h4>
                  <button onClick={() => addTag('positive')} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                    <Plus size={14} /> Thêm
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.positive.map((t, idx) => (
                    <div key={idx} className="bg-white border border-emerald-200 text-emerald-700 text-sm px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
                      {t}
                      <button onClick={() => removeTag('positive', idx)} className="text-emerald-300 hover:text-emerald-600"><X size={14}/></button>
                    </div>
                  ))}
                  {tags.positive.length === 0 && <span className="text-sm text-emerald-600 opacity-50">Chưa có thẻ nào...</span>}
                </div>
              </div>

              {/* Negative Tags */}
              <div className="bg-rose-50 rounded-2xl border border-rose-100 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-rose-800">Thẻ Điểm Trừ (Nhắc nhở)</h4>
                  <button onClick={() => addTag('negative')} className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                    <Plus size={14} /> Thêm
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.negative.map((t, idx) => (
                    <div key={idx} className="bg-white border border-rose-200 text-rose-700 text-sm px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
                      {t}
                      <button onClick={() => removeTag('negative', idx)} className="text-rose-300 hover:text-rose-600"><X size={14}/></button>
                    </div>
                  ))}
                  {tags.negative.length === 0 && <span className="text-sm text-rose-600 opacity-50">Chưa có thẻ nào...</span>}
                </div>
              </div>
            </div>
            
            <div className="mt-8 bg-blue-50 border border-blue-100 p-5 rounded-2xl text-sm text-blue-800">
              <strong className="block mb-1">💡 Hướng dẫn:</strong>
              Các thẻ trên sẽ hiển thị dưới dạng nút bấm chọn cho Quản lý mỗi khi họ chấm điểm nhân viên. Việc này thay thế cho việc đếm lỗi thủ công, giúp trải nghiệm đánh giá nhanh như "thả tim" trên mạng xã hội.
            </div>
          </div>
        )}


        {/* TAB 2: ĐÁNH GIÁ (MANAGER VIEW) */}
        {activeTab === 'evaluate' && (
          <div className="h-full flex flex-col">
            {/* Action Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Tháng Đánh Giá</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none" />
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 mb-1">Xuất Dữ Liệu</label>
                    <button onClick={exportCsv} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-slate-100 transition-colors">
                      <Download size={16} /> Xuất CSV
                    </button>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-600 tracking-tight">{stats.done} <span className="text-lg text-slate-300 font-medium">/ {stats.total}</span></div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đã hoàn thành</div>
              </div>
            </div>

            {/* Employee List Grid */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {branchEmployees.map(emp => {
                  const ev = currentEvals[emp.id];
                  const isDone = ev && ev.score !== undefined;
                  return (
                    <button 
                      key={emp.id} 
                      onClick={() => openGrading(emp)}
                      className={`text-left bg-white border ${isDone ? 'border-emerald-200' : 'border-slate-200 border-l-4 border-l-amber-400'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-800 line-clamp-1">{emp.name}</div>
                        {isDone ? (
                          <div className="bg-emerald-100 text-emerald-800 font-black text-sm px-2 py-0.5 rounded-lg flex-shrink-0 ml-2">
                            {ev.score}đ
                          </div>
                        ) : (
                          <div className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded">Chưa chấm</div>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mb-3">{emp.position || 'Nhân viên'}</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {isDone && ev.posTags && ev.posTags.map(t => <span key={t} className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={t}/>)}
                        {isDone && ev.negTags && ev.negTags.map(t => <span key={t} className="w-1.5 h-1.5 rounded-full bg-rose-400" title={t}/>)}
                        {isDone && !ev.posTags?.length && !ev.negTags?.length && <span className="text-[10px] text-slate-400 italic">0 thẻ</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {branchEmployees.length === 0 && (
                <div className="text-center text-slate-400 mt-20">Không có nhân sự nào trong chi nhánh này.</div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* RENDER GRADING PANEL (SLIDE OVERS) */}
      {selectedEmp && editingEval && (
        <div className="absolute inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={closeGrading}>
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-800">{selectedEmp.name}</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">{selectedEmp.position || 'Nhân viên'} · Mã: {selectedEmp.id}</p>
              </div>
              <button onClick={closeGrading} className="p-2 text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 rounded-xl"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-8">
              {/* Điểm nhân viên tự nhận */}
              <div>
                <label className="font-black text-slate-700 block mb-2">Điểm nhân viên tự chấm (Thu từ bản giấy)</label>
                <div className="relative border-2 border-slate-200 rounded-2xl p-1 bg-white flex items-center overflow-hidden focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
                  <input 
                    type="number" min="0" max="10" step="0.5"
                    value={editingEval.selfScore}
                    onChange={e => setEditingEval(prev => ({ ...prev, selfScore: e.target.value }))}
                    placeholder="Ví dụ: 8.5"
                    className="w-full pl-4 py-2 font-bold text-slate-800 outline-none placeholder:text-slate-300 placeholder:font-normal bg-transparent"
                  />
                  <div className="px-4 font-black text-slate-400 border-l border-slate-100 bg-slate-50 text-sm py-2">/ 10</div>
                </div>
              </div>

              {/* Score Slider (Điểm Quản Lý) */}
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                <div className="flex justify-between items-end mb-4">
                  <label className="font-black text-blue-900">Điểm Quản Lý Chốt / 10</label>
                  <div className="text-4xl font-black text-blue-600">{editingEval.score}</div>
                </div>
                <input 
                  type="range" min="1" max="10" step="0.5" 
                  value={editingEval.score} 
                  onChange={e => setEditingEval(prev => ({ ...prev, score: parseFloat(e.target.value) }))}
                  className="w-full transition-all cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                  <span>Mức Kém (1)</span>
                  <span>Trung Bình (5)</span>
                  <span>Xuất sắc (10)</span>
                </div>
              </div>

              {/* Tags Selection */}
              <div>
                <label className="font-black text-slate-700 block mb-3">Lý do Điểm Cộng (+)</label>
                <div className="flex flex-wrap gap-2">
                  {tags.positive.map(t => {
                    const active = editingEval.posTags?.includes(t);
                    return (
                      <button 
                        key={t} onClick={() => toggleTag('positive', t)}
                        className={`text-sm px-4 py-2 rounded-xl font-bold border transition-all ${active ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-200 scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                      >
                        {active && '✓ '} {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="font-black text-slate-700 block mb-3">Lý do Điểm Trừ (-)</label>
                <div className="flex flex-wrap gap-2">
                  {tags.negative.map(t => {
                    const active = editingEval.negTags?.includes(t);
                    return (
                      <button 
                        key={t} onClick={() => toggleTag('negative', t)}
                        className={`text-sm px-4 py-2 rounded-xl font-bold border transition-all ${active ? 'bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-200 scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'}`}
                      >
                        {active && '✓ '} {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="font-black text-slate-700 block mb-3">Nhận xét thêm (Không bắt buộc)</label>
                <textarea 
                  value={editingEval.comments || ''}
                  onChange={e => setEditingEval(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="Nhập ghi chú cho nhân sự này..."
                  className="w-full border-2 border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-400 focus:outline-none min-h-32 resize-y"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white grid grid-cols-2 gap-3">
              <button onClick={() => saveEvaluation(false)} className="bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all flex justify-center items-center gap-2">
                <Save size={18} /> Lưu đóng
              </button>
              <button onClick={() => saveEvaluation(true)} className="bg-blue-600 border-2 border-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex justify-center items-center gap-2">
                Lưu & Chuyển tiếp <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
