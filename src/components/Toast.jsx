import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle size={18} className="text-green-500 flex-shrink-0" />,
  error:   <XCircle size={18} className="text-red-500 flex-shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />,
  info:    <Info size={18} className="text-blue-500 flex-shrink-0" />,
};

const COLORS = {
  success: 'border-l-green-500 bg-white',
  error:   'border-l-red-500 bg-white',
  warning: 'border-l-amber-500 bg-white',
  info:    'border-l-blue-500 bg-white',
};

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  useEffect(() => {
    if (!toast.duration) return;
    const t = setTimeout(handleClose, toast.duration);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-lg border border-slate-100 border-l-4
        ${COLORS[toast.type] || COLORS.info}
        transition-all duration-300 ease-out min-w-[300px] max-w-[420px]
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
      `}
    >
      {ICONS[toast.type] || ICONS.info}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-bold text-sm text-slate-800 mb-0.5">{toast.title}</div>
        )}
        <p className="text-sm text-slate-600 leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={handleClose}
        className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, title, type = 'info', duration = 4500 }) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, title, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (message, title) => addToast({ message, title, type: 'success' }),
    error:   (message, title) => addToast({ message, title, type: 'error', duration: 6000 }),
    warning: (message, title) => addToast({ message, title, type: 'warning' }),
    info:    (message, title) => addToast({ message, title, type: 'info' }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
