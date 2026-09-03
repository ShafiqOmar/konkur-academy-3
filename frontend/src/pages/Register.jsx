import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', branch_id: '' });
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getBranches().then(setBranches).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="text-2xl font-black text-heading mb-6 text-center">ثبت‌نام شاگرد جدید</h1>
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-line/10 p-6 space-y-4">
        {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="text-sm font-bold text-heading block mb-1">نام کامل</label>
          <input
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2 focus:border-gold outline-none"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
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
            minLength={6}
            className="w-full border border-line/20 rounded-lg px-3 py-2 focus:border-gold outline-none"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="text-xs text-ink/50 mt-1">حداقل ۶ حرف</p>
        </div>
        <div>
          <label className="text-sm font-bold text-heading block mb-1">رشته/صنف شما</label>
          <select
            className="w-full border border-line/20 rounded-lg px-3 py-2 focus:border-gold outline-none"
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
          >
            <option value="">انتخاب نشده</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={loading}
          className="w-full bg-gold text-navy font-bold py-2.5 rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60"
        >
          {loading ? 'در حال ثبت‌نام...' : 'ساخت حساب'}
        </button>
      </form>
      <p className="text-center text-sm text-ink/60 mt-4">
        قبلاً ثبت‌نام کرده‌اید؟{' '}
        <Link to="/login" className="text-gold font-bold">
          وارد شوید
        </Link>
      </p>
    </div>
  );
}
