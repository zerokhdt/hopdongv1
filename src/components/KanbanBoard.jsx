import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Plus, ChevronLeft, ChevronRight, LayoutPanelTop } from 'lucide-react';
import { THEMES } from '../utils/theme';

const COLUMNS = [
    { id: 'TODO', title: 'To Do' },
    { id: 'IN_PROGRESS', title: 'In Progress' },
    { id: 'DONE', title: 'Done' },
    { id: 'CANCELLED', title: 'Cancelled' }
];

export default function KanbanBoard({ tasks, setTasks: _setTasks, onTaskClick, colorConfig, onStatusChange, onDelete, userRole, onPrintContract, isAllCollapsed }) {
    const isAdmin = userRole === 'admin';
    const [collapsedColumns, setCollapsedColumns] = useState({});

    // Sync with isAllCollapsed prop
    useEffect(() => {
        const newState = {};
        if (isAllCollapsed) {
            COLUMNS.forEach(col => newState[col.id] = true);
        }
        setCollapsedColumns(newState);
    }, [isAllCollapsed]);

    const toggleCollapse = (columnId) => {
        setCollapsedColumns(prev => ({
            ...prev,
            [columnId]: !prev[columnId]
        }));
    };

    const onDragEnd = (result) => {
        if (!isAdmin) return; 
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId !== destination.droppableId) {
            onStatusChange(draggableId, destination.droppableId);
        }
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 h-full items-start overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300">
                {COLUMNS.map(col => {
                    const colTasks = tasks.filter(t => t.status === col.id);
                    const isCollapsed = collapsedColumns[col.id];
                    const themeColor = colorConfig?.statuses[col.id] || 'slate';
                    const theme = THEMES[themeColor] || THEMES.slate;

                    return (
                        <div 
                            key={col.id} 
                            className={`flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[64px]' : 'w-[320px]'} h-full`}
                        >
                            <div className={`rounded-2xl border ${theme.light} flex flex-col h-full overflow-hidden transition-colors`}>
                                <div className={`flex items-center justify-between px-3 py-4 sticky top-0 bg-inherit z-10 ${isCollapsed ? 'flex-col gap-4' : ''}`}>
                                    <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                                        <div className={`w-2 h-2 rounded-full ${theme.base} shadow-sm`}></div>
                                        {!isCollapsed && (
                                            <>
                                                <h3 className="font-bold text-slate-700 whitespace-nowrap text-sm">{col.title}</h3>
                                                <span className="bg-white border border-slate-200 text-slate-500 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                                    {colTasks.length}
                                                </span>
                                            </>
                                        )}
                                        {isCollapsed && (
                                            <div className="bg-white border border-slate-200 text-slate-500 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
                                                {colTasks.length}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
                                        {!isCollapsed && isAdmin && (
                                            <button className="text-slate-400 hover:text-slate-700 hover:bg-white rounded-md p-1.5 transition-all shadow-sm">
                                                <Plus size={14} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => toggleCollapse(col.id)}
                                            className="text-slate-400 hover:text-slate-700 hover:bg-white rounded-md p-1.5 transition-all shadow-sm"
                                            title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                                        >
                                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {!isCollapsed && (
                                    <Droppable droppableId={col.id} isDropDisabled={!isAdmin}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`flex-1 overflow-y-auto px-3 pb-4 transition-colors ${snapshot.isDraggingOver ? 'bg-black/5' : ''} scrollbar-thin scrollbar-thumb-slate-200`}
                                            >
                                                <div className="space-y-3 pt-1">
                                                    {colTasks.map((task, index) => (
                                                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!isAdmin}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    style={{ ...provided.draggableProps.style }}
                                                                >
                                                                    <TaskCard
                                                                        task={task}
                                                                        colorConfig={colorConfig}
                                                                        isDragging={snapshot.isDragging}
                                                                        onClick={() => onTaskClick(task)}
                                                                        onStatusChange={isAdmin ? onStatusChange : undefined}
                                                                        onDelete={isAdmin ? onDelete : undefined}
                                                                        userRole={userRole}
                                                                        onPrintContract={onPrintContract}
                                                                    />
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            </div>
                                        )}
                                    </Droppable>
                                )}
                                
                                {isCollapsed && (
                                    <div className="flex-1 flex items-center justify-center relative">
                                        <div className="rotate-90 whitespace-nowrap text-slate-400 font-black text-[10px] tracking-[0.2em] uppercase absolute">
                                            {col.title}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </DragDropContext>
    );
}
