import React from 'react';
import { RefreshCcw, ArrowUpCircle, LogOut, Plus, Bell } from 'lucide-react';

const TAB_LABELS = {
  'task-manager': 'Task Manager',
  'contract': 'In Hợp Đồng',
  'personnel': 'Nhân Sự',
  'personnel-evaluation': 'Đánh Giá Tháng',
  'personnel-summary': 'Tổng Hợp Nhân Sự',
  'personnel-report': 'Báo Cáo PDF',
  'personnel-movements': 'Biến Động Nhân Sự',
  'personnel-contracts': 'Theo Dõi Hợp Đồng',
  'info': 'Info',
};

export default function Header({ onAddTask, reminderCount, onSyncPull, onSyncPush, onLogout, userRole, activeTab, username, userBranch }) {
  const handleLogout = () => {
    if (window.confirm('Bạn có muốn đăng xuất không?')) {
      onLogout();
    }
  };

  const isAdmin = userRole === 'admin';
  const tabLabel = TAB_LABELS[activeTab] || 'ACE HRM';

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 font-sans flex-shrink-0">
      {/* Left: breadcrumb / current tab */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">ACE HRM</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <h1 className="text-sm font-bold text-slate-700">{tabLabel}</h1>
        </div>
        {reminderCount > 0 && isAdmin && (
          <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow shadow-red-300 animate-bounce">
            <Bell size={10} />
            {reminderCount}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* User info chip */}
        {(username || userBranch) && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              {(username || userBranch).substring(0, 2).toUpperCase()}
            </div>
            <div className="text-xs leading-tight">
              {username && <div className="font-bold text-slate-700 truncate max-w-[100px]">{username}</div>}
              {userBranch && <div className="text-slate-400 truncate max-w-[100px]">{userBranch}</div>}
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            {/* Pull: tải từ server */}
            <button
              onClick={() => onSyncPull()}
              className="p-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all duration-200 group relative"
              title="Tải dữ liệu mới nhất (Pull)"
            >
              <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white" />
            </button>

            {/* Push: đẩy lên server */}
            <button
              onClick={() => onSyncPush()}
              className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 group relative"
              title="Đẩy dữ liệu lên server (Push)"
            >
              <ArrowUpCircle className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" />
            </button>

            <button
              onClick={onAddTask}
              className="hidden md:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl font-bold text-sm transition-all shadow shadow-blue-200 active:scale-95"
            >
              <Plus size={16} /> Thêm task
            </button>
          </>
        )}

        <button
          onClick={handleLogout}
          title="Đăng xuất"
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </header>
  );
}
