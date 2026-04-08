import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 bg-red-50 rounded-2xl border border-red-200">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-1">Có lỗi xảy ra</h3>
          <p className="text-sm text-slate-500 mb-4 text-center max-w-xs">
            {this.state.error?.message || 'Trang này gặp sự cố. Thử tải lại để tiếp tục.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors"
          >
            <RefreshCcw size={16} />
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
