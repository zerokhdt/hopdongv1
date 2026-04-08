import React from 'react';
import { CheckCircle2, Circle, Calendar, MoreHorizontal, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { THEMES } from '../utils/theme';

export default function ListView({ tasks, onTaskClick, colorConfig, onStatusChange: _onStatusChange, onDelete: _onDelete, userRole, onPrintContract }) {
    const isAdmin = userRole === 'admin';
    // Nhóm các task theo trạng thái
    const groupedTasks = {
        TODO: tasks.filter(t => t.status === 'TODO'),
        IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
        DONE: tasks.filter(t => t.status === 'DONE'),
        CANCELLED: tasks.filter(t => t.status === 'CANCELLED'),
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'TODO': return { title: 'To Do', icon: <Circle size={18} /> };
            case 'IN_PROGRESS': return { title: 'In Progress', icon: <Circle size={18} className="fill-current opacity-20" /> };
            case 'DONE': return { title: 'Done', icon: <CheckCircle2 size={18} /> };
            case 'CANCELLED': return { title: 'Cancelled', icon: <XCircle size={18} /> };
            default: return { title: 'Unknown', icon: <Circle size={18} /> };
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10 overflow-y-auto h-full pr-2 scrollbar-thin scrollbar-thumb-slate-300">
            {['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map(status => {
                const statusTasks = groupedTasks[status];
                if (statusTasks.length === 0) return null;

                const themeColor = colorConfig?.statuses[status] || 'slate';
                const theme = THEMES[themeColor] || THEMES.slate;

                const config = getStatusConfig(status);

                return (
                    <div key={status} className={`bg-white rounded-2xl shadow-sm border ${theme.accent} overflow-hidden`}>
                        <div className={`px-6 py-3 border-b flex items-center gap-3 ${theme.light}`}>
                            <div className={`w-3 h-3 rounded-full ${theme.base}`}></div>
                            <h3 className={`font-bold ${theme.text} text-sm tracking-wide`}>{config.title}</h3>
                            <span className="bg-white text-slate-500 text-xs px-2 py-0.5 rounded-full shadow-sm ml-2">
                                {statusTasks.length}
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {statusTasks.map(task => {
                                const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'DONE';

                                return (
                                    <div key={task.id} onClick={() => onTaskClick(task)} className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group cursor-pointer`}>
                                        <button className={`flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity ${theme.text}`}>
                                            {config.icon}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded">
                                                    {task.group || task.label || 'Task'}
                                                </span>
                                                {task.priority && task.priority !== 'medium' && (
                                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${task.priority === 'critical' ? 'bg-red-50 text-red-500' : task.priority === 'high' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-600'}`}>
                                                    {task.priority === 'critical' ? '🔴' : task.priority === 'high' ? '🟠' : '🟢'} {task.priority}
                                                  </span>
                                                )}
                                                <h4 className="font-semibold text-slate-800 text-sm truncate">{task.title}</h4>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {(task.tags || []).slice(0,3).map(tag => <span key={tag} className="text-[10px] text-slate-400 font-medium">#{tag}</span>)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 flex-shrink-0">
                                            <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                                <Calendar size={16} />
                                                {task.dueDate ? format(parseISO(task.dueDate), 'dd MMM, yyyy') : '---'}
                                            </div>

                                            <div className="w-32 flex justify-end">
                                                {task.assignee ? (
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                                                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                                                            {task.assignee.substring(0, 1).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">
                                                            {task.assignee}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Chưa giao</span>
                                                )}
                                            </div>
                                            
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); onPrintContract && onPrintContract(task); }}
                                              className="ml-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-3 py-1.5 rounded text-xs flex items-center justify-center gap-1 border border-blue-200 shadow-sm transition-colors"
                                              title="Tạo Hợp đồng PDF"
                                            >
                                              🖨️ In Hợp Đồng
                                            </button>

                                            {isAdmin && (
                                                <button className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-700 bg-white hover:bg-slate-200 p-1.5 rounded-md border border-transparent shadow-sm">
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
