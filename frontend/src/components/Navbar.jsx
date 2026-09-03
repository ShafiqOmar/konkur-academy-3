import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState({ items: [], unreadCount: 0 });

  useEffect(() => {
    if (!token) return;
    api.getNotifications(token).then(setNotifs).catch(() => {});
    const interval = setInterval(() => {
      api.getNotifications(token).then(setNotifs).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  async function openNotifs() {
    setNotifOpen((v) => !v);
    if (notifs.unreadCount > 0) {
      await api.markNotificationsRead(token);
      setNotifs((n) => ({ ...n, unreadCount: 0 }));
    }
  }

  return (
    <header className="bg-navy text-white sticky top-0 z-30 border-b border-navy-light">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-navy font-black text-sm">
            ک
          </span>
          <span className="font-bold text-lg tracking-tight">مسیر کانکور</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors">
            کورس‌ها
          </Link>
          {user && (
            <Link to="/leaderboard" className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors">
              لیدربورد
            </Link>
          )}
          {user && (
            <Link to="/dashboard" className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors">
              داشبورد من
            </Link>
          )}
          {user?.role === 'teacher' && (
            <Link to="/teacher" className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors">
              پنل استاد
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors">
              مدیریت
            </Link>
          )}

          {user && (
            <div className="relative">
              <button
                onClick={openNotifs}
                className="relative px-3 py-2 rounded-lg hover:bg-navy-light transition-colors"
                aria-label="اعلان‌ها"
              >
                🔔
                {notifs.unreadCount > 0 && (
                  <span className="absolute top-1 left-1 w-2.5 h-2.5 bg-gold rounded-full" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-surface text-ink rounded-xl shadow-xl border border-line/10 max-h-96 overflow-y-auto">
                  <p className="px-4 py-2 font-bold text-heading border-b border-line/10 text-sm">اعلان‌ها</p>
                  {notifs.items.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-ink/50">اعلانی ندارید.</p>
                  )}
                  {notifs.items.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b border-line/5 text-sm">
                      <p className="font-bold text-heading">{n.title}</p>
                      <p className="text-ink/60 text-xs mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors"
            aria-label="تغییر حالت روشن/تاریک"
            title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="mr-2 px-4 py-2 rounded-lg bg-navy-light hover:bg-white/10 transition-colors"
            >
              خروج ({user.full_name})
            </button>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 rounded-lg hover:bg-navy-light transition-colors">
                ورود
              </Link>
              <Link
                to="/register"
                className="mr-1 px-4 py-2 rounded-lg bg-gold text-navy font-bold hover:bg-gold-light transition-colors"
              >
                ثبت‌نام رایگان
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
