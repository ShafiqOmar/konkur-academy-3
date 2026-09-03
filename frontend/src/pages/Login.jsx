import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(form);
      login(token, user);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="text-2xl font-black text-heading mb-6 text-center">ورود به حساب</h1>
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-line/10 p-6 space-y-4">
        {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="text-sm font-bold text-heading block mb-1">ایمیل</label>
          <input
            type="email"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2 focus:border-gold outline-none"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-heading block mb-1">رمز عبور</label>
          <input
            type="password"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2 focus:border-gold outline-none"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button
          disabled={loading}
          className="w-full bg-navy text-white font-bold py-2.5 rounded-lg hover:bg-navy-light transition-colors disabled:opacity-60"
        >
          {loading ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
      <p className="text-center text-sm text-ink/60 mt-4">
        حساب ندارید؟{' '}
        <Link to="/register" className="text-gold font-bold">
          ثبت‌نام کنید
        </Link>
      </p>
    </div>
  );
}
