import React, { useState, useEffect } from 'react';
import { X, Calendar, Link as LinkIcon, Image as ImageIcon, Mail, FileText, CheckCircle2, ListChecks, MessageSquare, Trash2, ArrowRightCircle, Paperclip } from 'lucide-react';
import { format, parseISO, subMinutes } from 'date-fns';

const REMINDER_OPTIONS = [
  { value: 'none', label: '🚫 Không nhắc' },
  { value: '0', label: '⏰ Đúng giờ' },
  { value: '5m', label: '🔔 Trước 5 phút', mins: 5 },
  { value: '15m', label: '🔔 Trước 15 phút', mins: 15 },
  { value: '30m', label: '🔔 Trước 30 phút', mins: 30 },
  { value: '1h', label: '🔔 Trước 1 giờ', mins: 60 },
  { value: '2h', label: '🔔 Trước 2 giờ', mins: 120 },
  { value: '1d', label: '🔔 Trước 1 ngày', mins: 1440 },
];

export default function TaskModal({ task, onClose, onSave, groups = [], teamMembers = [], userRole = 'user' }) {
  const isAdmin = userRole === 'admin';
  const [editedTask, setEditedTask] = useState(() => {
    const isNew = !task.id;
    let initialReminder = task.reminder || '';
    let initialReminderType = task.reminderType || 'none';

    // Default to 1 hour before for new tasks if startDate exists
    if (isNew && !initialReminder && task.startDate) {
      try {
        const date = parseISO(task.startDate);
        initialReminder = format(subMinutes(date, 60), "yyyy-MM-dd'T'HH:mm");
        initialReminderType = '1h';
      } catch (_e) {}
    }

    const toArray = (d) => Array.isArray(d) ? d : [];

    return {
      ...task,
      links: toArray(task.links),
      images: toArray(task.images),
      email: task.email || '',
      notes: task.notes || '',
      progress: task.progress || 0,
      startDate: task.startDate || '',
      endDate: task.endDate || '',
      group: task.group || '',
      subtasks: toArray(task.subtasks),
      comments: toArray(task.comments),
      priority: task.priority || 'medium',
      tags: toArray(task.tags),
      reminder: initialReminder,
      reminderType: initialReminderType,
      assignee: task.assignee || '',
      activityLog: toArray(task.activityLog)
    };
  });

  const [newLink, setNewLink] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const toArray = (d) => Array.isArray(d) ? d : [];
    setEditedTask({ 
      ...task, 
      links: toArray(task.links), 
      images: toArray(task.images), 
      email: task.email || '', 
      notes: task.notes || '', 
      progress: task.progress || 0, 
      startDate: task.startDate || '', 
      endDate: task.endDate || '', 
      group: task.group || '',
      subtasks: toArray(task.subtasks),
      comments: toArray(task.comments),
      tags: toArray(task.tags),
      activityLog: toArray(task.activityLog)
    });
  }, [task]);

  const handleChange = (field, value) => {
    setEditedTask(prev => {
      let next = { ...prev, [field]: value };

      // Tự động cập nhật nhắc nhở nếu đổi ngày bắt đầu và đang chọn kiểu nhắc nhở tương đối
      if (field === 'startDate' && value && prev.reminderType && prev.reminderType !== 'none' && prev.reminderType !== 'custom') {
        const opt = REMINDER_OPTIONS.find(o => o.value === prev.reminderType);
        if (opt) {
          try {
            const date = parseISO(value);
            if (opt.mins !== undefined) {
              next.reminder = format(subMinutes(date, opt.mins), "yyyy-MM-dd'T'HH:mm");
            } else if (prev.reminderType === '0') {
              next.reminder = value;
            }
          } catch (_e) {}
        }
      }

      const log = field === 'status' && prev[field] !== value
        ? [...(prev.activityLog || []), { type: 'status', from: prev.status, to: value, at: new Date().toISOString() }]
        : field === 'assignee' && prev[field] !== value
        ? [...(prev.activityLog || []), { type: 'assign', to: value, at: new Date().toISOString() }]
        : prev.activityLog || [];
      return { ...next, activityLog: log };
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !(editedTask.tags || []).includes(newTag.trim())) {
      handleChange('tags', [...(editedTask.tags || []), newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag) => {
    handleChange('tags', (editedTask.tags || []).filter(t => t !== tag));
  };

  const handleAddLink = () => {
    if (newLink.trim()) {
      handleChange('links', [...editedTask.links, newLink.trim()]);
      setNewLink('');
    }
  };

  const handleRemoveLink = (index) => {
    handleChange('links', editedTask.links.filter((_, i) => i !== index));
  };

  const handleAddImage = () => {
    if (newImage.trim()) {
      handleChange('images', [...editedTask.images, newImage.trim()]);
      setNewImage('');
    }
  };

  const handleRemoveImage = (index) => {
    handleChange('images', editedTask.images.filter((_, i) => i !== index));
  };

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      handleChange('subtasks', [
        ...editedTask.subtasks, 
        { id: Date.now().toString(), title: newSubtask.trim(), isCompleted: false, email: '' }
      ]);
      setNewSubtask('');
    }
  };

  const handleToggleSubtask = (id) => {
    handleChange('subtasks', editedTask.subtasks.map(st => 
      st.id === id ? { ...st, isCompleted: !st.isCompleted } : st
    ));
  };

  const handleUpdateSubtaskEmail = (id, email) => {
    handleChange('subtasks', editedTask.subtasks.map(st => 
      st.id === id ? { ...st, email } : st
    ));
  };

  const handleRemoveSubtask = (id) => {
    handleChange('subtasks', editedTask.subtasks.filter(st => st.id !== id));
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      const savedUsername = localStorage.getItem('saved_username') || 'Người dùng';
      handleChange('comments', [
        ...editedTask.comments,
        { id: Date.now().toString(), text: newComment.trim(), author: savedUsername, createdAt: new Date().toISOString() }
      ]);
      setNewComment('');
    }
  };

  const handleSave = () => {
    if (isAdmin && !String(editedTask.group || '').trim()) {
      alert('Vui lòng chọn chi nhánh nhận task.');
      return;
    }
    onSave({ ...editedTask, lastUpdated: new Date().toISOString() });
    onClose();
  };

  const completedSubtasks = editedTask.subtasks.filter(st => st.isCompleted).length;
  const totalSubtasks = editedTask.subtasks.length;
  const checklistProgress = totalSubtasks === 0 ? 0 : Math.round((completedSubtasks / totalSubtasks) * 100);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 lg:p-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Header & Meta Properties */}
        <div className="px-6 md:px-8 py-5 flex flex-col border-b border-slate-200 bg-white flex-shrink-0 relative">
          <button onClick={onClose} className="absolute top-5 right-6 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 z-10">
            <X size={24} />
          </button>
          
          <div className="flex-1 pr-12">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 size={24} className="text-blue-600 flex-shrink-0" />
              <input
                type="text"
                disabled={!isAdmin}
                className={`text-2xl font-bold text-slate-800 bg-transparent border-none outline-none w-full placeholder-slate-300 ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                value={editedTask.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Nhập tiêu đề công việc..."
              />
            </div>
            
            {/* Trello-like Properties Row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pl-9">
              
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</span>
                <select
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-md px-3 py-1.5 border-none outline-none cursor-pointer transition-colors"
                  value={editedTask.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ưu tiên</span>
                <select
                  disabled={!isAdmin}
                  className={`bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-md px-3 py-1.5 border-none outline-none cursor-pointer transition-colors ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                  value={editedTask.priority || 'medium'}
                  onChange={(e) => handleChange('priority', e.target.value)}
                >
                  <option value="critical">🔴 Critical</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>

              {/* Progress Slider */}
              <div className="flex flex-col gap-1.5 w-32">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Tiến độ</span>
                  <span className={editedTask.progress === 100 ? "text-green-600" : "text-blue-600"}>{editedTask.progress}%</span>
                </div>
                <input
                  type="range" min="0" max="100" step="5"
                  disabled={!isAdmin}
                  className={`w-full accent-blue-600 mt-1 ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                  value={editedTask.progress}
                  onChange={(e) => handleChange('progress', parseInt(e.target.value))}
                />
              </div>

              {/* Group */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chi nhánh nhận task</span>
                <select
                  disabled={!isAdmin}
                  className={`bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-md px-3 py-1.5 border-none outline-none cursor-pointer transition-colors ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                  value={editedTask.group || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'NEW') {
                      const newG = prompt('Nhập tên nhóm mới:');
                      if (newG) {
                        handleChange('group', newG);
                      }
                    } else {
                      handleChange('group', val);
                    }
                  }}
                >
                  <option value="">{isAdmin ? '-- Chọn chi nhánh --' : '-- Chưa phân nhóm --'}</option>
                  {groups.filter(g => g === 'ALL' || g === 'HQ').map(g => (
                    <option key={g} value={g}>{g === 'ALL' ? 'TẤT CẢ' : 'HQ'}</option>
                  ))}
                  {groups.filter(g => g && g !== 'ALL' && g !== 'HQ').map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  {isAdmin && <option value="NEW">+ Thêm nhóm mới...</option>}
                </select>
              </div>

              {/* HRM Type */}
              {isAdmin && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phân loại (HRM)</span>
                  <select
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-md px-3 py-1.5 border-none outline-none cursor-pointer transition-colors"
                    value={editedTask.category || 'GENERAL'}
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    <option value="CONTRACT_PRINT">🖨️ In hợp đồng</option>
                    <option value="EMPLOYEE_MOVEMENT">🔄 Biến động nhân sự</option>
                    <option value="GENERAL">📌 Khác</option>
                  </select>
                </div>
              )}

              {/* Dates */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thời gian</span>
                <div className={`flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-md px-3 py-1.5 transition-colors ${!isAdmin ? 'cursor-not-allowed' : ''}`}>
                  <Calendar size={14} className="text-slate-500" />
                  <input
                    type="datetime-local"
                    disabled={!isAdmin}
                    className="bg-transparent text-slate-700 font-semibold text-sm border-none outline-none cursor-pointer"
                    value={editedTask.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                  />
                  <ArrowRightCircle size={14} className="text-slate-400" />
                  <input
                    type="datetime-local"
                    disabled={!isAdmin}
                    className="bg-transparent text-slate-700 font-semibold text-sm border-none outline-none cursor-pointer"
                    value={editedTask.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Người thực hiện</span>
                <div className={`bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1 flex items-center gap-1.5 transition-colors ${!isAdmin ? 'cursor-not-allowed' : ''}`}>
                  {editedTask.assignee && (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                      {editedTask.assignee.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  {teamMembers.length > 0 ? (
                    <select
                      disabled={!isAdmin}
                      className="bg-transparent text-slate-700 font-semibold text-sm border-none outline-none cursor-pointer w-32"
                      value={editedTask.assignee || ''}
                      onChange={(e) => handleChange('assignee', e.target.value)}
                    >
                      <option value="">Chưa phân công</option>
                      {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input type="text" disabled={!isAdmin} className="bg-transparent text-slate-700 font-semibold text-sm border-none outline-none w-32" value={editedTask.assignee || ''} onChange={(e) => handleChange('assignee', e.target.value)} placeholder="Tên người thực hiện" />
                  )}
                </div>
              </div>

              {/* Reminder */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🔔 Nhắc nhở</span>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-md px-3 py-1.5 border-none outline-none cursor-pointer transition-colors"
                    value={editedTask.reminderType || 'none'}
                    onChange={(e) => {
                      const type = e.target.value;
                      const opt = REMINDER_OPTIONS.find(o => o.value === type);
                      let newReminder = editedTask.reminder;

                      if (type === 'none') {
                        newReminder = '';
                      } else if (opt.mins !== undefined && editedTask.startDate) {
                        try {
                          const date = parseISO(editedTask.startDate);
                          newReminder = format(subMinutes(date, opt.mins), "yyyy-MM-dd'T'HH:mm");
                        } catch (_err) {}
                      } else if (type === '0' && editedTask.startDate) {
                         newReminder = editedTask.startDate;
                      }

                      setEditedTask(prev => ({ ...prev, reminderType: type, reminder: newReminder }));
                    }}
                  >
                    {REMINDER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                    <option value="custom">⚙️ Tùy chỉnh...</option>
                  </select>
                  
                  {(editedTask.reminderType === 'custom' || editedTask.reminder) && (
                    <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-md px-3 py-1.5 transition-colors">
                      <input
                        type="datetime-local"
                        className="bg-transparent text-slate-700 font-semibold text-sm border-none outline-none cursor-pointer"
                        value={editedTask.reminder || ''}
                        onChange={(e) => setEditedTask(prev => ({ ...prev, reminder: e.target.value, reminderType: 'custom' }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🏷 Tags</span>
                <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1 min-h-[34px]">
                  {(editedTask.tags || []).map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="text-blue-400 hover:text-blue-700 transition-colors ml-0.5">×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="bg-transparent text-slate-700 text-sm border-none outline-none flex-1 min-w-[80px] placeholder-slate-400"
                    placeholder="+ tag (Enter)"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  />
                </div>
              </div>

            </div>
          </div>
          
        </div>

        {/* Body Split Container */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#f4f5f7]">
          
          {/* Left Column - Main Details */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 bg-white border-r border-slate-200">
            
            {/* Description / Notes */}
            <div className="flex gap-4">
              <FileText size={22} className="text-slate-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 text-[17px] mb-3">Mô tả</h3>
                <textarea
                  disabled={!isAdmin}
                  className={`w-full bg-[#f4f5f7] hover:bg-slate-200 focus:bg-white border-2 border-transparent focus:border-blue-500 rounded-lg p-3 text-sm text-slate-700 min-h-[140px] resize-y transition-colors outline-none ${!isAdmin ? 'cursor-not-allowed' : ''}`}
                  placeholder="Thêm mô tả chi tiết hơn..."
                  value={editedTask.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                ></textarea>
              </div>
            </div>

            {/* Checklist */}
            <div className="flex gap-4">
              <ListChecks size={22} className="text-slate-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 text-[17px]">Checklist công việc phụ</h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{checklistProgress}%</span>
                </div>
                
                {/* Progress Bar */}
                {totalSubtasks > 0 && (
                  <div className="w-full bg-slate-200 rounded-full h-2.5 mb-5 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all duration-500 ${checklistProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${checklistProgress}%` }}></div>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  {editedTask.subtasks.map(st => (
                    <div key={st.id} className="flex flex-col gap-1 p-3 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg group transition-colors">
                      <div className="flex items-start justify-between">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input type="checkbox" checked={st.isCompleted} onChange={() => handleToggleSubtask(st.id)} className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer" />
                          <span className={`text-[15px] ${st.isCompleted ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{st.title}</span>
                        </label>
                        {isAdmin && (
                          <button onClick={() => handleRemoveSubtask(st.id)} className="text-slate-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-7 mt-1 opacity-70 focus-within:opacity-100 transition-opacity">
                        <Mail size={12} className="text-slate-400 flex-shrink-0" />
                        <input 
                          type="email" 
                          disabled={!isAdmin}
                          placeholder="Email thông báo riêng cho việc nhỏ (tuỳ chọn)..." 
                          value={st.email} 
                          onChange={(e) => handleUpdateSubtaskEmail(st.id, e.target.value)} 
                          className={`flex-1 text-[13px] border-none bg-transparent outline-none text-blue-700 font-medium placeholder-slate-400 focus:ring-0 p-0 ${!isAdmin ? 'cursor-not-allowed' : ''}`} 
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={handleAddSubtask} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 transition-colors flex items-center gap-2">
                      <CheckCircle2 size={16} /> Thêm mục mới
                    </button>
                    <input
                      type="text"
                      className="flex-1 bg-[#f4f5f7] hover:bg-slate-200 focus:bg-white border-2 border-transparent focus:border-blue-500 rounded-lg p-2 text-sm outline-none transition-colors"
                      placeholder="Gõ tiêu đề và ấn Enter..."
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div className="flex gap-4">
              <Paperclip size={22} className="text-slate-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 text-[17px] mb-3">Tệp đính kèm</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Links Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
                      <LinkIcon size={16} /> Web Links
                    </div>
                    <ul className="space-y-2 mb-3 flex-1">
                      {editedTask.links.map((link, idx) => (
                        <li key={idx} className="flex items-center justify-between text-sm bg-white border border-slate-200 shadow-sm text-blue-700 px-3 py-2 rounded-lg group">
                          <a href={link} target="_blank" rel="noopener noreferrer" className="truncate flex-1 font-medium hover:underline block mr-2" title={link}>{link}</a>
                          {isAdmin && <button onClick={() => handleRemoveLink(idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><X size={16}/></button>}
                        </li>
                      ))}
                    </ul>
                    {isAdmin && (
                      <div className="flex gap-2 mt-auto">
                        <input type="text" className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 outline-none" placeholder="https://..." value={newLink} onChange={(e) => setNewLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddLink()} />
                        <button onClick={handleAddLink} className="bg-slate-200 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-300">Thêm</button>
                      </div>
                    )}
                  </div>

                  {/* Images Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
                      <ImageIcon size={16} /> Hình ảnh
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3 flex-1 content-start">
                      {editedTask.images.map((img, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-300 aspect-video bg-white shadow-sm">
                          <img src={img} alt="đính kèm" className="w-full h-full object-cover" />
                          {isAdmin && <button onClick={() => handleRemoveImage(idx)} className="absolute top-1 right-1 bg-slate-900/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>}
                        </div>
                      ))}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 mt-auto">
                        <input type="text" className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 outline-none" placeholder="URL ảnh..." value={newImage} onChange={(e) => setNewImage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddImage()} />
                        <button onClick={handleAddImage} className="bg-slate-200 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-300">Thêm</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Comments & Activity */}
          <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-[#f4f5f7] flex flex-col h-[500px] md:h-auto border-t md:border-t-0 border-slate-200 relative">
            <div className="p-4 md:px-6 md:py-5 border-b border-slate-200 flex-shrink-0 font-semibold text-slate-800 text-[17px] flex items-center gap-2 bg-white flex-shrink-0 shadow-sm z-10 sticky top-0">
              <MessageSquare size={18} /> Bình luận & Hoạt động
            </div>
            
            {/* Comment List */}
            {/* We map forwards and let the parent stack them. */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
              <div className="space-y-6">
                {editedTask.comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md text-white font-bold flex items-center justify-center flex-shrink-0 text-sm mt-0.5">
                      {comment.author.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 px-0.5">
                        <span className="font-bold text-sm text-slate-800">{comment.author}</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {format(parseISO(comment.createdAt), 'MMM d, yyyy - h:mm a')}
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200 shadow-sm rounded-lg rounded-tl-none p-3 relative">
                        <p className="text-[14px] text-slate-700 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                      </div>
                      <div className="flex gap-3 mt-1.5 px-1">
                        <button className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">👍 Thích</button>
                        <button className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">💬 Phản hồi</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment Input */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.03)] focus-within:shadow-[0_-4px_15px_rgba(0,0,0,0.08)] transition-shadow">
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center flex-shrink-0 text-sm mt-1">
                  U
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <textarea
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm focus:border-blue-500 outline-none resize-none min-h-[60px]"
                    placeholder="Viết cập nhật hoặc bình luận... (Enter để gửi)"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddComment} 
                      disabled={!newComment.trim()}
                      className={`font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors ${
                        newComment.trim() 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Lưu bình luận
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between flex-shrink-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <div className="text-xs font-semibold text-slate-400">
                Đã đồng bộ lần cuối: {editedTask.lastUpdated ? format(parseISO(editedTask.lastUpdated), 'HH:mm - dd/MM/yyyy') : 'Chưa lưu'}
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                    Hủy sửa
                </button>
                <button onClick={handleSave} className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-md shadow-green-600/20 transition-all hover:scale-[1.02]">
                    <CheckCircle2 size={18} /> Lưu công việc
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}
