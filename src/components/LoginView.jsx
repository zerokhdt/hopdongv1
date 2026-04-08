import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, ArrowRight } from 'lucide-react';
import { supabase } from '../utils/supabase.js';
import { apiFetch } from '../utils/api.js';

export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState(localStorage.getItem('saved_username') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const debugAuth = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    setMounted(true);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (response.status === 404) {
        if (!supabase) {
          setError('Không kết nối được máy chủ đăng nhập (/api/login). Nếu bạn đang chạy local, hãy set VITE_API_BASE_URL trỏ về domain Vercel để dùng API serverless.')
          triggerShake()
          return
        }
        const auth = await supabase.rpc('authenticate_app_user', {
          p_username: username,
          p_password: password,
        })
        const rows = Array.isArray(auth.data) ? auth.data : []
        const row = rows[0]
        if (auth.error || !row) {
          setError(debugAuth ? (auth?.error?.message || 'Không có kết quả RPC') : 'Sai tài khoản hoặc mật khẩu!')
          triggerShake()
          if (debugAuth) {
            console.debug('AUTH_RPC_ERROR', { error: auth.error, data: auth.data })
          }
          return
        }
        localStorage.setItem('saved_username', username);
        localStorage.setItem('user_branch', row.branch_id || '');
        localStorage.setItem('user_role', row.role || 'user');
        onLogin(String(Date.now()));
        return
      }

      let data = null
      try {
        data = await response.json()
      } catch (_e) {
        data = null
      }

      if (!response.ok) {
        const msg = data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra cấu hình máy chủ.'
        setError(msg)
        triggerShake()
        return
      }

      if (data?.success) {
        localStorage.setItem('saved_username', username);
        localStorage.setItem('user_branch', data.branch || '');
        localStorage.setItem('user_role', data.role || 'user');
        onLogin(data.token);
      } else {
        setError(data?.message || 'Sai tài khoản hoặc mật khẩu!');
        triggerShake();
      }
    } catch (_err) {
      setError('Không kết nối được máy chủ đăng nhập. Vui lòng kiểm tra mạng hoặc cấu hình deploy.')
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden edu-svg-bg font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,215,0,0.10),transparent_55%),radial-gradient(circle_at_40%_90%,rgba(255,255,255,0.06),transparent_60%)] edu-noise" />
      </div>

      <div
        className={`relative max-w-md w-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${shake ? '[animation:shake_0.5s_ease-in-out]' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        <div className="bg-white rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
          <div className="px-10 pt-10 pb-8 bg-gradient-to-r from-white via-white to-yellow-50">
            <div className="flex items-center gap-4">
              <img src="/ace-logo.svg" alt="ACE" className="w-14 h-14 rounded-2xl shadow-md" />
              <div>
                <h1 className="text-2xl font-black text-[#E11920] tracking-tight">ACE HRM</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.25em]">ACHAUENGLISH</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-sm font-bold text-slate-700">Đăng nhập hệ thống</p>
              <p className="text-xs text-slate-500 mt-1">Quản lý nhân sự · công việc · báo cáo</p>
            </div>
          </div>

          <div className="px-10 py-8 bg-white">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-username" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tài khoản</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <User size={18} />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    required
                    autoComplete="username"
                    autoFocus
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#E11920] focus:ring-4 focus:ring-red-200/40 transition-all outline-none text-slate-900 placeholder-slate-400 font-bold"
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#E11920] focus:ring-4 focus:ring-red-200/40 transition-all outline-none text-slate-900 placeholder-slate-400 font-bold"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold py-3 px-4 rounded-2xl">
                  {error}
                </div>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl font-black text-white shadow-xl transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed bg-[#E11920] hover:bg-[#c9151b] flex items-center justify-center gap-2"
              >
                {isLoading ? 'Đang xác thực…' : 'Đăng nhập'}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>

          <div className="px-10 py-6 bg-slate-50 border-t border-slate-100">
            <p className="text-center text-[11px] text-slate-500 font-bold">© {new Date().getFullYear()} <span className="text-[#E11920]">ACE HRM</span></p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-8px); }
          30%, 70% { transform: translateX(8px); }
        }

        .edu-svg-bg {
          background-image:
            url('/4046152-01.svg');
          background-size: cover;
          background-repeat: no-repeat;
          background-position: center;
          animation: eduBgPan 18s ease-in-out infinite;
        }

        .edu-noise {
          opacity: 0.92;
          animation: eduPulse 10s ease-in-out infinite;
        }

        @keyframes eduBgPan {
          0% { background-position: 50% 50%, 50% 50%; }
          50% { background-position: 45% 52%, 46% 52%; }
          100% { background-position: 50% 50%, 50% 50%; }
        }

        @keyframes eduPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
