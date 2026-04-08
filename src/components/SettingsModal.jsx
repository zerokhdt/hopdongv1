import React, { useState } from 'react';
import { X, Palette, Check } from 'lucide-react';
import { THEMES } from '../utils/theme';

const colorOptions = Object.values(THEMES);

function ColorPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = THEMES[value] || THEMES.slate;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white shadow-sm transition-all text-sm font-medium text-slate-700 min-w-[130px]"
        style={{ borderLeftColor: selected.hex, borderLeftWidth: '4px' }}
      >
        <span
          className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
          style={{ backgroundColor: selected.hex }}
        />
        {selected.name}
        <svg className="ml-auto w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 grid grid-cols-5 gap-2 w-56">
            {colorOptions.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id); setIsOpen(false); }}
                className="relative w-8 h-8 rounded-full flex items-center justify-center shadow-sm border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c.hex,
                  borderColor: value === c.id ? 'white' : 'transparent',
                  boxShadow: value === c.id ? `0 0 0 3px ${c.hex}` : undefined
                }}
                title={c.name}
              >
                {value === c.id && <Check size={14} className="text-white drop-shadow" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SettingsModal({ currentConfig, onSave, onClose, groups }) {
  const [config, setConfig] = useState(() => JSON.parse(JSON.stringify(currentConfig)));
  const [mappingVersion, setMappingVersion] = useState(0); 
  const [maskSalary, setMaskSalary] = useState(() => {
    const raw = localStorage.getItem('ace_hrm_mask_salary');
    if (raw === null) return true;
    return raw === '1';
  });

  const handleStatusChange = (status, color) => {
    setConfig(prev => ({ ...prev, statuses: { ...prev.statuses, [status]: color } }));
  };

  const handleGroupChange = (group, color) => {
    setConfig(prev => ({ ...prev, groups: { ...prev.groups, [group]: color } }));
  };

  const saveAndClose = () => {
    localStorage.setItem('ace_hrm_mask_salary', maskSalary ? '1' : '0');
    onSave(config);
    onClose();
  };

  const STATUS_LABELS = { TODO: 'Chưa làm', IN_PROGRESS: 'Đang làm', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy' };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-md">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Cài đặt Màu sắc</h2>
              <p className="text-xs text-slate-500">Tùy biến giao diện công việc</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          
          {/* Position Mapping Section */}
          <section className="bg-slate-50 p-5 rounded-[24px] border border-slate-200">
            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Cấu hình Hồ sơ theo Vị trí
            </h3>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Thêm cấu hình mới</p>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    id="new-pos-name"
                    placeholder="Tên vị trí (VD: Giáo viên)"
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                  />
                  <select id="new-pos-docs" className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400">
                    <option value="HĐLĐ + Phụ lục">HĐLĐ + Phụ lục</option>
                    <option value="Thỏa thuận CV">Thỏa thuận CV</option>
                    <option value="Cam kết + HĐLĐ">Cam kết + HĐLĐ</option>
                    <option value="Full bộ (HĐ+PL+CK)">Full bộ (HĐ+PL+CK)</option>
                  </select>
                </div>
                <button 
                  onClick={() => {
                    const name = document.getElementById('new-pos-name').value.trim();
                    const docs = document.getElementById('new-pos-docs').value;
                    if (!name) return;
                    const cur = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
                    cur[name] = docs;
                    localStorage.setItem('ace_position_contract_mapping_v1', JSON.stringify(cur));
                    document.getElementById('new-pos-name').value = '';
                    setMappingVersion(v => v + 1);
                  }}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all"
                >
                  Thêm cấu hình
                </button>
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {Object.entries(JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}')).map(([pos, docs]) => (
                  <div key={pos} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                    <div>
                      <div className="text-[11px] font-black text-slate-700">{pos}</div>
                      <div className="text-[9px] font-bold text-indigo-500 uppercase">{docs}</div>
                    </div>
                    <button 
                      onClick={() => {
                        const cur = JSON.parse(localStorage.getItem('ace_position_contract_mapping_v1') || '{}');
                        delete cur[pos];
                        localStorage.setItem('ace_position_contract_mapping_v1', JSON.stringify(cur));
                        setMappingVersion(v => v + 1);
                      }}
                      className="text-slate-300 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Status Colors */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
              Màu sắc Trạng thái
            </h3>
            <div className="space-y-3">
              {['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map(status => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                      style={{ backgroundColor: THEMES[config.statuses[status] || 'slate'].hex }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{STATUS_LABELS[status] || status}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{status}</p>
                    </div>
                  </div>
                  <ColorPicker
                    value={config.statuses[status] || 'slate'}
                    onChange={(color) => handleStatusChange(status, color)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Group Colors */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>
              Màu sắc Chi nhánh
            </h3>
            <div className="space-y-3">
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Chưa có nhóm nào.</p>
              ) : (
                groups.map(group => (
                  <div key={group} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                        style={{ backgroundColor: THEMES[config.groups[group] || 'slate'].hex }}
                      />
                      <p className="text-sm font-semibold text-slate-700 truncate max-w-[170px]">{group}</p>
                    </div>
                    <ColorPicker
                      value={config.groups[group] || 'slate'}
                      onChange={(color) => handleGroupChange(group, color)}
                    />
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"></span>
              Quyền riêng tư
            </h3>
            <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-700">Ẩn thông tin lương</p>
                <p className="text-[11px] text-slate-500">Hiển thị ******* thay vì số lương</p>
              </div>
              <button
                type="button"
                onClick={() => setMaskSalary(v => !v)}
                className={`w-12 h-7 rounded-full transition-colors relative ${maskSalary ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${maskSalary ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-200 transition-colors text-sm">
            Hủy
          </button>
          <button onClick={saveAndClose} className="px-5 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20 text-sm">
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
