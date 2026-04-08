import React from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

const STATUSES = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'TODO', label: '⬜ To Do' },
  { value: 'IN_PROGRESS', label: '🔵 In Progress' },
  { value: 'DONE', label: '✅ Done' },
  { value: 'CANCELLED', label: '❌ Cancelled' },
];

const PRIORITIES = [
  { value: 'ALL', label: 'Tất cả ưu tiên' },
  { value: 'critical', label: '🔴 Critical' },
  { value: 'high', label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low', label: '🟢 Low' },
];

const QUICK_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'today', label: '📅 Hôm nay' },
  { value: 'week', label: '📆 Tuần này' },
  { value: 'overdue', label: '⚠️ Quá hạn' },
];

const SORTS = [
  { value: '', label: 'Sắp xếp...' },
  { value: 'date_asc', label: '📅 Ngày ↑' },
  { value: 'date_desc', label: '📅 Ngày ↓' },
  { value: 'priority', label: '🔴 Ưu tiên' },
  { value: 'progress', label: '📊 Tiến độ' },
  { value: 'title', label: '🔤 Tên A→Z' },
];

const TASK_TYPES = [
  { value: 'ALL', label: 'Tất cả loại' },
  { value: 'CONTRACT_PRINT', label: '🖨️ In hợp đồng' },
  { value: 'EMPLOYEE_MOVEMENT', label: '🔄 Biến động nhân sự' },
  { value: 'GENERAL', label: '📌 Khác' },
];

export default function FilterBar({ filters, onChange, isAdmin, teamMembers = [] }) {
  const hasActiveFilters = filters.search || filters.status !== 'ALL' || filters.priority !== 'ALL' || filters.quickFilter || filters.assignee || (isAdmin && filters.type && filters.type !== 'ALL');

  const reset = () => onChange({ search: '', status: 'ALL', priority: 'ALL', quickFilter: '', sort: '', type: 'ALL', assignee: '' });

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
      {!isAdmin && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => onChange({ ...filters, status: 'TODO' })}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              filters.status === 'TODO'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ⬜ Pending
          </button>
          <button
            onClick={() => onChange({ ...filters, status: 'DONE' })}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              filters.status === 'DONE'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ✅ Done
          </button>
          <button
            onClick={() => onChange({ ...filters, status: 'CANCELLED' })}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              filters.status === 'CANCELLED'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ❌ Cancel
          </button>
        </div>
      )}
      {/* Search */}
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder="Tìm kiếm task..."
          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        {QUICK_FILTERS.map(qf => (
          <button
            key={qf.value}
            onClick={() => onChange({ ...filters, quickFilter: qf.value })}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              filters.quickFilter === qf.value
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {qf.label}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="relative">
        <select
          value={filters.status}
          onChange={e => onChange({ ...filters, status: e.target.value })}
          className="appearance-none pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {/* Priority */}
      <div className="relative">
        <select
          value={filters.priority}
          onChange={e => onChange({ ...filters, priority: e.target.value })}
          className="appearance-none pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
        >
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {/* Type (HRM) */}
      {isAdmin && (
        <div className="relative">
          <select
            value={filters.type || 'ALL'}
            onChange={e => onChange({ ...filters, type: e.target.value })}
            className="appearance-none pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
          >
            {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Assignee filter */}
      {teamMembers.length > 0 && (
        <div className="relative">
          <select
            value={filters.assignee || ''}
            onChange={e => onChange({ ...filters, assignee: e.target.value })}
            className="appearance-none pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
          >
            <option value="">Tất cả người thực hiện</option>
            {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Sort */}
      <div className="relative">
        <select
          value={filters.sort || ''}
          onChange={e => onChange({ ...filters, sort: e.target.value })}
          className="appearance-none pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
        >
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium">
          <X size={12} /> Xóa lọc
        </button>
      )}
    </div>
  );
}
