import React, { useState, useMemo, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import ListView from './ListView';
import CalendarView from './CalendarView';
import TaskModal from './TaskModal';
import FilterBar from './FilterBar';
import { LayoutDashboard, ListTodo, Calendar as CalendarIcon, Users, Maximize2, Minimize2, ShieldAlert, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { isToday, isThisWeek, isBefore, parseISO, format } from 'date-fns';
import { apiFetch } from '../utils/api.js';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function TaskManagerView({
  tasks,
  setTasks,
  onPersistTask,
  onDeleteTask,
  onOpenEmployeeRequests,
  onOpenPersonnelMovements,
  colorConfig,
  teamMembers = [],
  userRole = 'user',
  branchId,
  employees: _employees = [],
  setEmployees: _setEmployees,
  movements: _movements = [],
  setMovements: _setMovements,
}) {
  const [subTab, setSubTab] = useState('work-board');
  const [boardMode, setBoardMode] = useState('kanban');
  const [isAllCollapsed, setIsAllCollapsed] = useState(false);
  const [calendarMode, setCalendarMode] = useState('summary');
  const [selectedTask, setSelectedTask] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'ALL', priority: 'ALL', quickFilter: '', sort: '', type: 'ALL', assignee: '' });
  const [isMyTaskExpanded, setIsMyTaskExpanded] = useState(true);
  const [myTaskBusy, setMyTaskBusy] = useState(false);
  const [pendingMovementApprovals, setPendingMovementApprovals] = useState([]);
  const [pendingEmployeeImportRequests, setPendingEmployeeImportRequests] = useState([]);

  const isAdmin = userRole === 'admin';
  const pendingDoneRequests = useMemo(() => {
    if (!isAdmin) return [];
    return (tasks || []).filter(t => String(t?.doneApproval?.status || '').trim() === 'PENDING');
  }, [isAdmin, tasks]);

  const reviewDoneRequest = async (taskId, decision) => {
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      const resp = await apiFetch('/api/tasks/done-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: taskId, decision }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok || !data?.task) throw new Error(data?.message || 'review_failed');
      setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
    } catch (e) {
      alert(e?.message || String(e));
    }
  };
  const branchGroups = useMemo(() => {
    const set = new Set();
    (tasks || []).forEach(t => {
      const g = String(t?.group || '').trim();
      if (g) set.add(g);
    });
    (_employees || []).forEach(e => {
      const g = String(e?.department || '').trim();
      if (g) set.add(g);
    });
    const current = String(branchId || '').trim();
    if (current) set.add(current);
    set.add('HQ');
    set.add('ALL');
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [tasks, _employees, branchId]);

  const pendingTotal = (pendingMovementApprovals.length || 0) + (pendingEmployeeImportRequests.length || 0) + (pendingDoneRequests.length || 0);

  useEffect(() => {
    if (!isAdmin || !isMyTaskExpanded) return;
    let cancelled = false;
    const load = async () => {
      setMyTaskBusy(true);
      try {
        const token = String(localStorage.getItem('token') || '').trim();
        const [mvResp, empResp] = await Promise.all([
          apiFetch('/api/movements/pending?status=ALL', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          apiFetch('/api/employees/import-requests/list?status=PENDING', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        ]);

        if (cancelled) return;

        if (mvResp && mvResp.ok) {
          const mvData = await mvResp.json();
          if (mvData?.ok && Array.isArray(mvData.movements)) {
            const list = mvData.movements.filter(m => m?.status === 'PENDING' || m?.status === 'REVISION');
            setPendingMovementApprovals(list);
          }
        }

        if (empResp && empResp.ok) {
          const empData = await empResp.json();
          if (empData?.ok && Array.isArray(empData.requests)) {
            setPendingEmployeeImportRequests(empData.requests);
          }
        }
      } catch (_e) {
      } finally {
        if (!cancelled) setMyTaskBusy(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isMyTaskExpanded]);

  useEffect(() => {
    if (!isAdmin) return;
    try {
      const v = localStorage.getItem('ace_task_switch_to_done_admin');
      if (v === '1') {
        localStorage.removeItem('ace_task_switch_to_done_admin');
        setFilters(prev => ({ ...prev, status: 'DONE' }));
        setSubTab('work-board');
      }
    } catch (_e) {}
  }, [isAdmin]);

  const handleSaveTask = (updatedTask) => {
    const taskWithTimestamp = { ...updatedTask, lastUpdated: new Date().toISOString() };
    setTasks(prev => prev.map(t => t.id === taskWithTimestamp.id ? taskWithTimestamp : t));
    if (onPersistTask) onPersistTask(taskWithTimestamp);
    setSelectedTask(null);
  };

  const handleStatusChange = (taskId, newStatus) => {
    let nextTask = null;
    setTasks(prev => prev.map(t => (t.id === taskId ? (nextTask = { 
      ...t, 
      status: newStatus, 
      lastUpdated: new Date().toISOString(),
      activityLog: [...(t.activityLog || []), { type: 'status', from: t.status, to: newStatus, at: new Date().toISOString() }] 
    }) : t)));
    if (onPersistTask && nextTask) onPersistTask(nextTask);
  };

  const handleDelete = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (onDeleteTask) onDeleteTask(taskId);
  };

  const now = new Date();

  // Handle printing contract simulate
  const handlePrintContract = (task) => {
    alert(`[Demo] Đang tạo Hợp đồng cho tác vụ: ${task.title}... Vui lòng đợi 3-5s (Tính năng đang chờ ghép Google Apps Script)`);
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Lọc theo chi nhánh nếu không phải admin
    if (!isAdmin && branchId) {
      const doneGroup = `${branchId}__DONE`;
      result = result.filter(t => t.group === branchId || t.group === doneGroup || t.group === 'ALL' || t.group === 'ALL__DONE' || t.group === 'HQ' || t.group === 'HQ__DONE');
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || (t.tags || []).some(tag => tag.toLowerCase().includes(q)));
    }
    if (filters.type && filters.type !== 'ALL') {
      const want = String(filters.type || '').trim();
      result = result.filter(t => String(t.category || 'GENERAL').trim() === want);
    }
    if (filters.status !== 'ALL') result = result.filter(t => t.status === filters.status);
    if (filters.priority !== 'ALL') result = result.filter(t => t.priority === filters.priority);
    if (filters.quickFilter === 'today') result = result.filter(t => t.endDate && isToday(parseISO(t.endDate)));
    if (filters.quickFilter === 'week') result = result.filter(t => t.endDate && isThisWeek(parseISO(t.endDate)));
    if (filters.quickFilter === 'overdue') result = result.filter(t => t.endDate && isBefore(parseISO(t.endDate), now) && t.status !== 'DONE' && t.status !== 'CANCELLED');
    if (filters.assignee) result = result.filter(t => t.assignee === filters.assignee);

    if (filters.sort === 'date_asc') result.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    if (filters.sort === 'date_desc') result.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
    if (filters.sort === 'priority') result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
    if (filters.sort === 'progress') result.sort((a, b) => b.progress - a.progress);
    if (filters.sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title));

    return result;
  }, [tasks, filters, isAdmin, branchId]);

  useEffect(() => {
    if (isAdmin) return;
    try {
      const v = localStorage.getItem('ace_task_switch_to_done');
      if (v === '1') {
        localStorage.removeItem('ace_task_switch_to_done');
        setFilters(prev => ({ ...prev, status: 'DONE' }));
      }
    } catch (_e) {}
  }, [isAdmin]);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Sub-navigation bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-0 relative">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setSubTab('work-board')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${subTab === 'work-board' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {isAdmin ? 'Work board' : 'Task board'}
          </button>
          <button 
            onClick={() => setSubTab('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${subTab === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Calendar
          </button>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
          {subTab === 'work-board' ? (
            <>
              {boardMode === 'kanban' && (
                <button 
                  onClick={() => setIsAllCollapsed(!isAllCollapsed)} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors bg-white text-slate-600 shadow-sm hover:bg-slate-50`}
                  title={isAllCollapsed ? "Mở rộng tất cả" : "Thu gọn tất cả"}
                >
                  {isAllCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                  <span className="hidden sm:inline">{isAllCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
                </button>
              )}
              <button onClick={() => setBoardMode('kanban')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${boardMode === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>
                <LayoutDashboard size={16} /> Board
              </button>
              <button onClick={() => setBoardMode('list')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${boardMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>
                <ListTodo size={16} /> List
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setCalendarMode('summary')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${calendarMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>
                <CalendarIcon size={16} /> Tổng hợp
              </button>
              <button onClick={() => setCalendarMode('group')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${calendarMode === 'group' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>
                <Users size={16} /> Group
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar (only for work board) */}
      {subTab === 'work-board' && (
        <FilterBar filters={filters} onChange={setFilters} isAdmin={isAdmin} teamMembers={teamMembers} />
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6 bg-[#F2F4F7]">
        {subTab === 'work-board' ? (
          <div className="h-full flex flex-col">
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setIsMyTaskExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <ShieldAlert size={20} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black text-slate-800">MY TASK</div>
                      <div className="text-xs text-slate-400 font-bold">Duyệt yêu cầu từ chi nhánh</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${pendingTotal > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                      {pendingTotal} chờ duyệt
                    </span>
                    <span className="text-slate-400 text-sm font-black">{isMyTaskExpanded ? '−' : '+'}</span>
                  </div>
                </button>

                {isMyTaskExpanded && (
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black text-slate-800">BIẾN ĐỘNG NHÂN SỰ</div>
                            <div className="text-[11px] text-slate-500 font-bold mt-1">{pendingMovementApprovals.length} yêu cầu</div>
                          </div>
                          <button
                            disabled={myTaskBusy}
                            onClick={() => {
                              try { localStorage.setItem('ace_open_personnel_movements', '1'); } catch (_e) {}
                              if (onOpenPersonnelMovements) onOpenPersonnelMovements();
                            }}
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            MỞ DUYỆT
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {pendingMovementApprovals.slice(0, 3).map(m => (
                            <div key={m.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                              <div className="text-xs font-black text-slate-800 truncate">{m.employee_name}</div>
                              <div className="text-[10px] font-bold text-slate-500 mt-0.5">{m.branch} · {m.type} · {m.created_at ? format(parseISO(m.created_at), 'dd/MM HH:mm') : ''}</div>
                            </div>
                          ))}
                          {pendingMovementApprovals.length === 0 && <div className="text-xs font-bold text-slate-400 py-2">Không có yêu cầu.</div>}
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black text-slate-800">DUYỆT HOÀN THÀNH TASK</div>
                            <div className="text-[11px] text-slate-500 font-bold mt-1">{pendingDoneRequests.length} yêu cầu</div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {pendingDoneRequests.slice(0, 3).map(t => (
                            <div key={t.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-slate-800 truncate">{t.title}</div>
                                  <div className="text-[10px] font-bold text-slate-500 mt-0.5">{t.group} · {t.doneApproval?.requestedBy || ''}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    disabled={myTaskBusy}
                                    onClick={() => reviewDoneRequest(t.id, 'REJECT')}
                                    className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    title="Từ chối"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                  <button
                                    disabled={myTaskBusy}
                                    onClick={() => reviewDoneRequest(t.id, 'APPROVE')}
                                    className="p-2 rounded-xl text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                                    title="Phê duyệt"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {pendingDoneRequests.length === 0 && <div className="text-xs font-bold text-slate-400 py-2">Không có yêu cầu.</div>}
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black text-slate-800">CẬP NHẬT NHÂN SỰ (CSV)</div>
                            <div className="text-[11px] text-slate-500 font-bold mt-1">{pendingEmployeeImportRequests.length} yêu cầu</div>
                          </div>
                          <button
                            disabled={myTaskBusy}
                            onClick={() => {
                              try { localStorage.setItem('ace_open_employee_requests', '1'); } catch (_e) {}
                              if (onOpenEmployeeRequests) onOpenEmployeeRequests();
                            }}
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            MỞ DUYỆT
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {pendingEmployeeImportRequests.slice(0, 3).map(r => (
                            <div key={r.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                              <div className="text-xs font-black text-slate-800 truncate">{r.branch}</div>
                              <div className="text-[10px] font-bold text-slate-500 mt-0.5">{Array.isArray(r.employees) ? r.employees.length : 0} nhân viên · {r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
                            </div>
                          ))}
                          {pendingEmployeeImportRequests.length === 0 && <div className="text-xs font-bold text-slate-400 py-2">Không có yêu cầu.</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 min-h-0">
              {boardMode === 'kanban' ? (
                <KanbanBoard tasks={filteredTasks} setTasks={setTasks} onTaskClick={setSelectedTask} colorConfig={colorConfig} onStatusChange={handleStatusChange} onDelete={handleDelete} userRole={userRole} onPrintContract={handlePrintContract} isAllCollapsed={isAllCollapsed} />
              ) : (
                <ListView tasks={filteredTasks} onTaskClick={setSelectedTask} colorConfig={colorConfig} onStatusChange={handleStatusChange} onDelete={handleDelete} userRole={userRole} onPrintContract={handlePrintContract} />
              )}
            </div>
          </div>
        ) : (
          <CalendarView mode={calendarMode} tasks={tasks} onTaskClick={setSelectedTask} colorConfig={colorConfig} userRole={userRole} />
        )}
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={handleSaveTask}
          groups={branchGroups}
          teamMembers={teamMembers}
          userRole={userRole}
        />
      )}
    </div>
  );
}
