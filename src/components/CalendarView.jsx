import React, { useState } from 'react';
import { 
  format, startOfWeek, endOfWeek, eachDayOfInterval, 
  startOfMonth, endOfMonth, isSameMonth, isSameDay, 
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  parseISO, getHours, getDay 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from 'lucide-react';
import { THEMES } from '../utils/theme';

export default function CalendarView({ mode, tasks = [], onTaskClick, colorConfig }) {
  const [currentDate, setCurrentDate] = useState(new Date("2026-03-09T00:00:00"));
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [timeView, setTimeView] = useState('week'); // 'day' | 'week' | 'month' cho Group mode

  const getGroupTheme = (groupName) => {
    const colorId = colorConfig?.groups[groupName] || 'slate';
    return THEMES[colorId] || THEMES.slate;
  };

  const handleDateChange = (e) => {
      if (e.target.value) {
          setCurrentDate(new Date(e.target.value));
      }
  };

  const prev = () => {
    if (mode === 'summary') setCurrentDate(subMonths(currentDate, 1));
    else {
      if (timeView === 'day') setCurrentDate(subDays(currentDate, 1));
      if (timeView === 'week') setCurrentDate(subWeeks(currentDate, 1));
      if (timeView === 'month') setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const next = () => {
    if (mode === 'summary') setCurrentDate(addMonths(currentDate, 1));
    else {
      if (timeView === 'day') setCurrentDate(addDays(currentDate, 1));
      if (timeView === 'week') setCurrentDate(addWeeks(currentDate, 1));
      if (timeView === 'month') setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  // --- Chế độ Tổng hợp (Summary View) - Lịch Tháng ---
  const renderSummaryView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

    return (
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
         <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            {weekDays.map(day => (
               <div key={day} className="p-3 text-center text-sm font-bold text-slate-600 border-r border-slate-200 last:border-0">{day}</div>
            ))}
         </div>
         <div className="grid grid-cols-7 bg-slate-200 gap-[1px] flex-1">
            {days.map(day => {
                const dayTasks = tasks.filter(t => t.startDate && isSameDay(parseISO(t.startDate), day));
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div key={day.toString()} className={`min-h-[120px] bg-white p-2 flex flex-col ${!isCurrentMonth ? 'bg-slate-50 opacity-60' : ''}`}>
                    <div className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>
                       {format(day, 'd')}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
                      {dayTasks.map(task => {
                         const theme = getGroupTheme(task.group);
                         return (
                            <div 
                              key={task.id}
                              onClick={() => onTaskClick && onTaskClick(task)}
                              className={`text-[11px] leading-tight truncate px-2 py-1.5 rounded cursor-pointer text-white font-medium ${theme.base} hover:opacity-80 transition-opacity shadow-sm border border-slate-100/20`}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                         )
                      })}
                    </div>
                  </div>
                )
            })}
         </div>
       </div>
    );
  };

  // --- Chế độ Nhóm (Group View) ---
  const renderGroupView = () => {
    let start, end;
    if (timeView === 'day') {
        start = currentDate;
        end = currentDate;
    } else if (timeView === 'week') {
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else { // month
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
    }
    const days = eachDayOfInterval({ start, end });
    const vnDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const allGroups = [...new Set(tasks.map(t => t.group || 'Khác'))];
    if (allGroups.length === 0) allGroups.push('Chưa có dữ liệu');
    const displayGroups = selectedGroup === 'ALL' ? allGroups : [selectedGroup];

    // Tạo style Grid cho Header/Row để có thể cuộn tự do
    const gridStyle = {
      display: 'grid',
      gridTemplateColumns: timeView === 'day' ? '200px minmax(300px, 1fr)' 
                         : timeView === 'week' ? '150px repeat(7, minmax(130px, 1fr))' 
                         : `120px repeat(${days.length}, 100px)`
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden relative">
        <div className="overflow-x-auto flex-1 h-full custom-scrollbar flex flex-col bg-slate-200 gap-[1px]">
          
          {/* Header Row */}
          <div style={gridStyle} className="bg-white flex-shrink-0 sticky top-0 z-20 w-max min-w-full border-b border-slate-200">
            <div className={`p-3 font-bold text-slate-600 text-sm border-r border-slate-200 flex items-center justify-center bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] sticky left-0 z-30`}>
              Nhóm \ Ngày
            </div>
            {days.map(day => {
               const isToday = isSameDay(day, new Date());
               return (
                 <div key={day.toString()} className={`p-3 border-r border-slate-200 text-center flex flex-col items-center justify-center ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    <span className={`font-bold ${timeView === 'month' ? 'text-xs' : 'text-sm'} ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                      {vnDays[getDay(day)]}
                    </span>
                    <span className={`mt-0.5 ${timeView === 'month' ? 'text-[10px]' : 'text-xs'} ${isToday ? 'text-blue-500 font-semibold' : 'text-slate-400 font-medium'}`}>
                      {format(day, 'dd/MM')}
                    </span>
                 </div>
               )
            })}
          </div>
          
          {/* Body Rows */}
          <div className="flex-1 w-max min-w-full flex flex-col gap-[1px]">
            {displayGroups.map(group => (
               <div key={group} style={gridStyle} className="bg-white min-h-[140px]">
                 {/* Cột Nhóm cố định */}
                 <div className="p-4 font-bold text-sm text-slate-700 border-r border-slate-200 flex items-center justify-center text-center bg-slate-50/80 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] backdrop-blur-sm">
                   {group}
                 </div>

                 {/* Cột Ngày tương ứng */}
                 {days.map(day => {
                   const dayTasks = tasks.filter(t => t.startDate && t.group === group && isSameDay(parseISO(t.startDate), day));
                   const isToday = isSameDay(day, new Date());
                   
                   return (
                     <div key={day.toString()} className={`border-r border-slate-100 p-2 relative flex flex-col gap-1.5 ${isToday ? 'bg-blue-50/20' : ''}`}>
                       {dayTasks.map(task => {
                          const isPM = getHours(parseISO(task.startDate)) >= 12;
                          const theme = getGroupTheme(group);
                          const colorClass = isPM ? theme.dark : theme.light;
                          
                          return (
                            <div 
                              key={task.id} 
                              onClick={() => onTaskClick && onTaskClick(task)}
                              className={`text-[11px] p-2 flex flex-col gap-1.5 rounded cursor-pointer border shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md ${colorClass}`}
                              title={`${task.title} (${isPM ? 'Chiều/Tối' : 'Sáng'})`}
                            >
                              <span className="font-bold opacity-90 text-[10px] tracking-wide block">
                                {format(parseISO(task.startDate), 'HH:mm')} {isPM ? 'PM' : 'AM'}
                              </span> 
                              <span className="font-medium line-clamp-2 leading-tight">{task.title}</span>
                            </div>
                          )
                       })}
                     </div>
                   )
                 })}
               </div>
            ))}
          </div>
          
        </div>
      </div>
    );
  };

  const allGroupsOptions = [...new Set(tasks.map(t => t.group || 'Khác'))];

  return (
    <div className="h-full flex flex-col gap-4">
      
      {/* Calendar Header Controls */}
      <div className="flex flex-col lg:flex-row items-center justify-between bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200 flex-shrink-0 gap-4">
        
        {/* Left Side: Navigation & Add Date Picker */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button onClick={prev} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={today} className="px-3 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors mx-1">
              Hôm nay
            </button>
            <button onClick={next} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex items-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <CalendarIcon size={16} className="text-slate-400 mr-2" />
            <input 
              type="date" 
              className="bg-transparent border-none outline-none text-sm font-semibold text-slate-700 w-[125px] cursor-pointer focus:ring-0 p-0"
              value={format(currentDate, 'yyyy-MM-dd')}
              onChange={handleDateChange}
            />
          </div>
        </div>
        
        {/* Right Side: Mode specific tools */}
        {mode === 'group' && (
          <div className="flex items-center gap-3">
            {/* AM/PM legend (only visual impact if they need to be reminded) */}
            <div className="hidden xl:flex gap-3 text-xs font-medium border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 shadow-sm mr-2">
               <div className="flex items-center gap-1.5">
                 <div className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-200"></div> Sáng (AM)
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-700"></div> Chiều (PM)
               </div>
            </div>

            {/* Time View Switcher */}
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              {[
                { id: 'day', label: 'Ngày' }, 
                { id: 'week', label: 'Tuần' }, 
                { id: 'month', label: 'Tháng' }
              ].map(v => (
                 <button 
                   key={v.id}
                   onClick={() => setTimeView(v.id)}
                   className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeView === v.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   {v.label}
                 </button>
              ))}
            </div>

            {/* Group Filter */}
            <div className="flex items-center pl-2 border-l border-slate-200">
              <Users size={16} className="text-slate-400 mr-2" />
              <select 
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 cursor-pointer shadow-sm min-w-[140px]"
              >
                <option value="ALL">Tất cả Nhóm</option>
                {allGroupsOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main View Render */}
      <div className="flex-1 overflow-hidden">
        {mode === 'summary' ? renderSummaryView() : renderGroupView()}
      </div>

    </div>
  );
}
