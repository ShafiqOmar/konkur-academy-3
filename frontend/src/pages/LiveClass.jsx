import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LiveClass() {
  const { id } = useParams(); // course id
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [form, setForm] = useState({ title: '', scheduled_at: '' });
  const [error, setError] = useState('');
  const canSchedule = user?.role === 'teacher' || user?.role === 'admin';

  function load() {
    api.getLiveSessions(id, token).then(setSessions).catch((e) => setError(e.message));
  }
  useEffect(load, [id, token]);

  async function handleSchedule(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createLiveSession({ course_id: id, ...form }, token);
      setForm({ title: '', scheduled_at: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (activeRoom) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-8">
        <button onClick={() => setActiveRoom(null)} className="text-sm text-gold font-bold mb-3">
          ← بازگشت به لیست جلسات
        </button>
        <div className="rounded-xl overflow-hidden border border-line/10" style={{ height: '75vh' }}>
          <iframe
            src={`https://meet.jit.si/${activeRoom}`}
            allow="camera; microphone; fullscreen; display-capture"
            style={{ width: '100%', height: '100%', border: 0 }}
            title="کلاس آنلاین زنده"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-6">کلاس‌های آنلاین زنده</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {canSchedule && (
        <form onSubmit={handleSchedule} className="bg-surface border border-line/10 rounded-xl p-5 mb-8 space-y-3">
          <h2 className="font-bold text-heading text-sm">برنامه‌ریزی جلسه‌ی جدید</h2>
          <input
            placeholder="عنوان جلسه (مثلاً مرور فصل سلول)"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="datetime-local"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2 font-mono-nums"
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          />
          <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg">برنامه‌ریزی</button>
        </form>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-surface border border-line/10 rounded-lg px-4 py-3"
          >
            <div>
              <p className="font-bold text-heading text-sm">{s.title}</p>
              <p className="text-xs text-ink/50 font-mono-nums">
                {new Date(s.scheduled_at).toLocaleString('fa-IR')}
              </p>
            </div>
            <button
              onClick={() => setActiveRoom(s.room_name)}
              className="bg-gold text-navy text-sm font-bold px-4 py-2 rounded-lg hover:bg-gold-light"
            >
              ورود به کلاس
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-sm text-ink/50">هنوز جلسه‌ای برنامه‌ریزی نشده.</p>}
      </div>
    </div>
  );
}
