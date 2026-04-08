import React, { useState, useRef, useEffect } from 'react';
import { Calendar, MoreHorizontal, Bell, CheckCircle2, AlertCircle, ArrowUp, Minus, ArrowDown } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, addHours } from 'date-fns';
import { THEMES } from '../utils/theme';

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: '#ef4444', icon: <AlertCircle size={11} />, border: '#ef4444' },
  high:     { label: 'High',     color: '#f97316', icon: <ArrowUp size={11} />,     border: '#f97316' },
  medium:   { label: 'Medium',   color: '#f59e0b', icon: <Minus size={11} />,       border: '#f59e0b' },
  low:      { label: 'Low',      color: '#22c55e', icon: <ArrowDown size={11} />,   border: '#22c55e' },
};

function ContextMenu({ task, onStatusChange, onDelete, onClose, isAdmin }) {
  const ref = useRef(null);
  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleDelete = () => {
    if (window.confirm(`Bạn có chắc muốn xóa task "${task.title}" không? Hành động này không thể hoàn tác.`)) {
      onDelete();
    }
    onClose();
  };

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-44 text-sm" onClick={e => e.stopPropagation()}>
      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đổi trạng thái</div>
      {['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map(s => (
        <button key={s} onClick={() => { onStatusChange(s); onClose(); }}
          className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium transition-colors ${task.status === s ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}>
          {s === 'TODO' ? '⬜ To Do' : s === 'IN_PROGRESS' ? '🔵 In Progress' : s === 'DONE' ? '✅ Done' : '❌ Cancelled'}
        </button>
      ))}
      {isAdmin && (
        <>
          <div className="my-1 border-t border-slate-100" />
          <button onClick={handleDelete}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500 font-semibold transition-colors">
            🗑 Xóa task
          </button>
        </>
      )}
    </div>
  );
}

function TaskCard({ task, isDragging, onClick, colorConfig, onStatusChange, onDelete, userRole, onPrintContract }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const themeColor = colorConfig?.statuses?.[task.status] || 'slate';
  const theme = THEMES[themeColor] || THEMES.slate;
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isAdmin = userRole === 'admin';

  const now = new Date();
  const isOverdue = task.endDate && isBefore(new Date(task.endDate), now) && task.status !== 'DONE' && task.status !== 'CANCELLED';
  const hasReminder = task.reminder && isAfter(new Date(task.reminder), now) && isBefore(new Date(task.reminder), addHours(now, 24));

  const completedSubs = (task.subtasks || []).filter(s => s.isCompleted).length;
  const totalSubs = (task.subtasks || []).length;
  const visibleTags = (task.tags || []).slice(0, 2);
  const extraTags = Math.max(0, (task.tags || []).length - 2);

  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: priority.border, borderLeftWidth: '3px' }}
      className={`${theme.light} p-3.5 rounded-xl shadow-sm border border-l-4 ${isDragging ? 'shadow-lg rotate-2 scale-105' : 'hover:shadow-md'} transition-all duration-200 group cursor-pointer relative`}
    >
      {/* Top row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold tracking-wider uppercase bg-white/70 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
            {task.label || 'Task'}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: priority.color, backgroundColor: priority.color + '18' }}>
            {priority.icon} {priority.label}
          </span>
          {hasReminder && <Bell size={12} className="text-amber-500" />}
        </div>
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-700 bg-white/80 hover:bg-slate-100 p-1 rounded-md">
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <ContextMenu
              task={task}
              isAdmin={isAdmin}
              onStatusChange={(s) => onStatusChange && onStatusChange(task.id, s)}
              onDelete={() => onDelete && onDelete(task.id)}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className={`font-semibold ${theme.text} text-sm mb-2 leading-snug`}>{task.title}</h4>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {visibleTags.map(tag => (
            <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">#{tag}</span>
          ))}
          {extraTags > 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{extraTags}</span>}
        </div>
      )}

      {/* Notes preview */}
      {task.notes && <p className="text-xs text-slate-400 line-clamp-1 mb-2">{task.notes}</p>}

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-2 border-t border-black/5">
        <div className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-50 text-red-500' : 'text-slate-400'}`}>
          <Calendar size={11} />
          {task.endDate ? format(parseISO(task.endDate), 'dd/MM') : '—'}
          {isOverdue && ' ⚠'}
        </div>

        <div className="flex items-center gap-2">
          {totalSubs > 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${completedSubs === totalSubs ? 'text-green-600' : 'text-slate-400'}`}>
              <CheckCircle2 size={11} /> {completedSubs}/{totalSubs}
            </span>
          )}
          {task.assignee && (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm" title={task.assignee}>
              {task.assignee.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {task.progress > 0 && (
        <div className="mt-2 -mx-3.5 -mb-3.5 rounded-b-xl overflow-hidden h-1 bg-black/5">
          <div
            className={`h-full transition-all duration-500 ${task.progress === 100 ? 'bg-green-400' : 'bg-blue-400'}`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(TaskCard, (prev, next) => {
  // Only re-render if lastUpdated, status or isDragging changed
  return (
    prev.task.lastUpdated === next.task.lastUpdated &&
    prev.task.status === next.task.status &&
    prev.isDragging === next.isDragging
  );
});
