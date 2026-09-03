import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ForumList() {
  const { id } = useParams(); // course id
  const { token } = useAuth();
  const [threads, setThreads] = useState([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [error, setError] = useState('');

  function load() {
    api.getThreads(id, token).then(setThreads).catch((e) => setError(e.message));
  }
  useEffect(load, [id, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createThread(id, form, token);
      setForm({ title: '', body: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-6">پرسش و پاسخ کورس</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-surface border border-line/10 rounded-xl p-5 mb-8 space-y-3">
        <h2 className="font-bold text-heading text-sm">سوال جدید بپرسید</h2>
        <input
          placeholder="عنوان سوال"
          required
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          placeholder="توضیح بیشتر (اختیاری)"
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg">ارسال سوال</button>
      </form>

      <div className="space-y-2">
        {threads.map((t) => (
          <Link
            key={t.id}
            to={`/forum/thread/${t.id}`}
            className="block bg-surface border border-line/10 rounded-lg px-4 py-3 hover:border-gold transition-colors"
          >
            <p className="font-bold text-heading text-sm">{t.title}</p>
            <p className="text-xs text-ink/50 mt-1">
              پرسیده شده توسط {t.author_name} · {t.reply_count} پاسخ
            </p>
          </Link>
        ))}
        {threads.length === 0 && <p className="text-sm text-ink/50">هنوز سوالی پرسیده نشده.</p>}
      </div>
    </div>
  );
}
