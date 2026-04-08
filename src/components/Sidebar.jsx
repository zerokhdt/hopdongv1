import React, { useState } from 'react';
import { LayoutDashboard, Info, GraduationCap, Settings, HelpCircle, ChevronRight, ChevronDown, Plus, Trash2, FileText, Users, X, BookOpen, Bell, RefreshCcw } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, groups = [], activeGroup = 'ALL', setActiveGroup, onAddGroup, onRemoveGroup, onOpenSettings, tasks = [], userRole = 'user' }) {
    const [newGroup, setNewGroup] = useState('');
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [isPersonnelExpanded, setIsPersonnelExpanded] = useState(true);
    const [isTaskGroupsExpanded, setIsTaskGroupsExpanded] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const now = new Date();
    const getGroupStats = (group) => {
        const groupTasks = tasks.filter(t => t.group === group);
        const active = groupTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length;
        const overdue = groupTasks.filter(t => t.endDate && new Date(t.endDate) < now && t.status !== 'DONE' && t.status !== 'CANCELLED').length;
        return { active, overdue };
    };
    const totalActive = tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length;
    
    // Phân quyền menu cho Admin vs Chi nhánh
    const menuItems = [
        { id: 'task-manager', label: userRole === 'admin' ? 'Task manager' : 'Task', icon: LayoutDashboard },
        { id: 'contract',     label: userRole === 'admin' ? 'In hợp đồng' : 'Hợp đồng', icon: FileText },
        { id: 'trainer',      label: 'Trainer',      icon: GraduationCap, adminOnly: true },
        { id: 'info',         label: 'Info',         icon: Info },
    ].filter(item => userRole === 'admin' || !item.adminOnly);

    const isAdmin = userRole === 'admin';

    return (
        <aside className="w-64 bg-[#2f3241] h-full flex flex-col text-slate-300 flex-shrink-0 overflow-hidden">
            <div className="p-4 flex items-center gap-3 border-b border-slate-600/30">
                <img src="/ace-logo.svg" alt="ACE" className="w-9 h-9 rounded-xl shadow-md bg-white" />
                <span className="font-bold text-lg text-[#E11920]">ACE HRM</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Chức năng</div>
                    <nav className="space-y-1">
                        <div className="mb-1">
                            <button
                                onClick={() => {
                                    setIsPersonnelExpanded(v => !v);
                                    setActiveTab('personnel');
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                                    activeTab === 'personnel' || activeTab === 'personnel-summary' || activeTab === 'personnel-report' || activeTab === 'personnel-movements' || activeTab === 'personnel-contracts' || activeTab === 'personnel-evaluation'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'hover:bg-slate-700/50 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Users size={18} />
                                    Nhân sự
                                </div>
                                <div className="flex items-center gap-2">
                                    {isPersonnelExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                            </button>

                            {isPersonnelExpanded && (
                                <div className="ml-5 mt-1 border-l border-slate-600/50 pl-2 space-y-1">
                                    <button
                                        onClick={() => setActiveTab('personnel')}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium ${
                                            activeTab === 'personnel'
                                                ? 'bg-blue-500/20 text-blue-300'
                                                : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className="truncate text-left">Danh sách nhân sự</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('personnel-evaluation')}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium ${
                                            activeTab === 'personnel-evaluation'
                                                ? 'bg-blue-500/20 text-blue-300'
                                                : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className="truncate text-left">Đánh giá tháng</span>
                                    </button>

                                    {userRole === 'admin' && (
                                        <>
                                            <button
                                                onClick={() => setActiveTab('personnel-summary')}
                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium ${
                                                    activeTab === 'personnel-summary'
                                                        ? 'bg-blue-500/20 text-blue-300'
                                                        : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                                }`}
                                            >
                                                <span className="truncate text-left">Tổng hợp nhân sự</span>
                                                <FileText size={14} className="text-slate-500" />
                                            </button>

                                            <button
                                                onClick={() => setActiveTab('personnel-report')}
                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium ${
                                                    activeTab === 'personnel-report'
                                                        ? 'bg-blue-500/20 text-blue-300'
                                                        : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                                }`}
                                            >
                                                <span className="truncate text-left">Báo cáo (In PDF)</span>
                                                <FileText size={14} className="text-slate-500" />
                                            </button>
                                        </>
                                    )}

                                    <button
                                        onClick={() => setActiveTab('personnel-movements')}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium ${
                                            activeTab === 'personnel-movements'
                                                ? 'bg-blue-500/20 text-blue-300'
                                                : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className="truncate text-left">Biến động nhân sự</span>
                                        <FileText size={14} className="text-slate-500" />
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('personnel-contracts')}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium ${
                                            activeTab === 'personnel-contracts'
                                                ? 'bg-blue-500/20 text-blue-300'
                                                : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className="truncate text-left">Theo dõi hợp đồng</span>
                                        <FileText size={14} className="text-slate-500" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {menuItems.map(item => (
                            <div key={item.id} className="mb-1">
                                <button
                                    onClick={() => { 
                                        setActiveTab(item.id); 
                                        if (item.id === 'task-manager' && setActiveGroup) setActiveGroup('ALL'); 
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                                        activeTab === item.id
                                            ? (activeGroup === 'ALL' || item.id !== 'task-manager' ? 'bg-blue-500/20 text-blue-400' : 'text-blue-400 font-bold')
                                            : 'hover:bg-slate-700/50 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={18} />
                                        {item.label}
                                    </div>
                                    {item.id === 'task-manager' && (
                                      <div className="flex items-center gap-2">
                                        {totalActive > 0 && (
                                          <span className="text-[10px] font-bold bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-full">
                                            {isAdmin ? totalActive : tasks.filter(t => (t.group === localStorage.getItem('user_branch') || t.group === 'ALL') && t.status !== 'DONE' && t.status !== 'CANCELLED').length}
                                          </span>
                                        )}
                                        {isAdmin && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setIsTaskGroupsExpanded(v => !v); }}
                                            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                                            title={isTaskGroupsExpanded ? 'Thu gọn nhóm' : 'Mở rộng nhóm'}
                                          >
                                            {isTaskGroupsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                          </button>
                                        )}
                                      </div>
                                    )}
                            </button>
                            
                            {item.id === 'task-manager' && isAdmin && isTaskGroupsExpanded && (
                                <div className="ml-5 mt-1 border-l border-slate-600/50 pl-2 space-y-1">
                                        {groups.map(group => {
                                           const stats = getGroupStats(group);
                                           return (
                                           <div key={group} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors text-[13px] font-medium group ${
                                               activeTab === 'task-manager' && activeGroup === group
                                               ? 'bg-blue-500/20 text-blue-300'
                                               : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                                           }`}>
                                               <button
                                                   onClick={() => { setActiveTab('task-manager'); if (setActiveGroup) setActiveGroup(group); }}
                                                   className="flex items-center gap-2 flex-1 overflow-hidden"
                                               >
                                                   <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${stats.overdue > 0 ? 'bg-red-400' : activeGroup === group ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'bg-slate-500'}`}></div>
                                                   <span className="truncate text-left">{group}</span>
                                               </button>
                                               <div className="flex items-center gap-1">
                                                   {stats.overdue > 0 && <span className="text-[9px] font-bold text-red-400 bg-red-900/30 px-1 rounded">⚠{stats.overdue}</span>}
                                                   {stats.active > 0 && <span className="text-[9px] font-bold text-slate-500 bg-slate-700 px-1 rounded">{stats.active}</span>}
                                                   {isAdmin && (
                                                     <button 
                                                       onClick={(e) => { e.stopPropagation(); if (onRemoveGroup) onRemoveGroup(group); }} 
                                                       className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
                                                       title="Xóa nhóm"
                                                     >
                                                       <Trash2 size={12} />
                                                     </button>
                                                   )}
                                               </div>
                                           </div>
                                           );
                                        })}
                                        
                                        {isAdmin && (
                                            isAddingGroup ? (
                                                <div className="mt-2 px-1">
                                                    <input 
                                                        autoFocus
                                                        type="text" 
                                                        className="w-full bg-slate-800 text-slate-200 text-[13px] font-medium rounded-md px-2 py-1.5 outline-none border border-slate-600 focus:border-blue-400 transition-colors"
                                                        placeholder="Tên nhóm mới..."
                                                        value={newGroup}
                                                        onChange={e => setNewGroup(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') { if (newGroup.trim() && onAddGroup) onAddGroup(newGroup.trim()); setNewGroup(''); setIsAddingGroup(false); }
                                                            if (e.key === 'Escape') { setIsAddingGroup(false); setNewGroup(''); }
                                                        }}
                                                        onBlur={() => {
                                                            if (newGroup.trim() && onAddGroup) onAddGroup(newGroup.trim());
                                                            setIsAddingGroup(false);
                                                            setNewGroup('');
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setIsAddingGroup(true)}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 mt-1 border border-dashed border-slate-600/50"
                                                >
                                                    <Plus size={14} /> Thêm nhóm
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="p-4 mt-auto border-t border-slate-600/30 space-y-1">
                <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-slate-700/50 hover:text-white">
                    <Settings size={18} />
                    Cài đặt
                </button>
                <button onClick={() => setIsHelpOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-slate-700/50 hover:text-white">
                    <HelpCircle size={18} />
                    Trợ giúp
                </button>
            </div>

            {/* Help Modal */}
            {isHelpOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsHelpOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <BookOpen size={18} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Hướng dẫn sử dụng</h3>
                                    <p className="text-xs text-slate-400">ACE HRM — Quick Guide</p>
                                </div>
                            </div>
                            <button onClick={() => setIsHelpOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 text-sm text-slate-600">
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                                    <span className="text-base">📋</span> Quản lý Task
                                </h4>
                                <ul className="space-y-1 text-xs leading-relaxed text-slate-500 pl-6">
                                    <li>• Admin: Bấm <strong className="text-slate-700">+ Thêm task</strong> để tạo task mới cho chi nhánh</li>
                                    <li>• Drag &amp; Drop card qua các cột để đổi trạng thái (chỉ admin)</li>
                                    <li>• Click vào card để mở chi tiết, thêm comment, cập nhật tiến độ</li>
                                    <li>• Chi nhánh có thể báo hoàn thành, chờ admin duyệt</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                                    <span className="text-base">👥</span> Nhân sỰ
                                </h4>
                                <ul className="space-y-1 text-xs leading-relaxed text-slate-500 pl-6">
                                    <li>• <strong className="text-slate-700">Danh sách nhân sỰ:</strong> Xem, thêm, sửa thông tin nhân viên</li>
                                    <li>• <strong className="text-slate-700">Biến động:</strong> Ghi nhận onboarding, nghỉ phép, thay đổi chức vụ</li>
                                    <li>• <strong className="text-slate-700">Tổng hợp:</strong> Bảng tổng hợp số liệu theo chi nhánh (admin)</li>
                                    <li>• Import CSV: Upload file Excel để cập nhật danh sách hàng loạt</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                                    <span className="text-base">📄</span> Hợp đồng
                                </h4>
                                <ul className="space-y-1 text-xs leading-relaxed text-slate-500 pl-6">
                                    <li>• Chọn loại hợp đồng, vị trí, điền thông tin nhân viên</li>
                                    <li>• Preview trước khi xuất</li>
                                    <li>• Xuất DOCX về máy hoặc gửi qua email</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                                    <RefreshCcw size={14} className="text-emerald-500" /> Sync dữ liệu
                                </h4>
                                <ul className="space-y-1 text-xs leading-relaxed text-slate-500 pl-6">
                                    <li>• <strong className="text-slate-700">Nút xanh (Pull):</strong> Tải dữ liệu mới nhất từ server về</li>
                                    <li>• <strong className="text-slate-700">Nút đỏ (Push):</strong> Đẩy dữ liệu hiện tại lên server</li>
                                    <li>• Dữ liệu tự đồng tải lại mỗi 20 giây khi ứng dụng đang mở</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                                    <Bell size={14} className="text-amber-500" /> Thông báo
                                </h4>
                                <ul className="space-y-1 text-xs leading-relaxed text-slate-500 pl-6">
                                    <li>• Thông báo hiện ở góc dưới phải màn hình</li>
                                    <li>• Click × để đóng, tự biến sau vài giây</li>
                                </ul>
                            </div>
                        </div>
                        <div className="px-5 pb-5">
                            <button onClick={() => setIsHelpOpen(false)} className="w-full py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
