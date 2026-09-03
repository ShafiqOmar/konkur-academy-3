import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ForumThread() {
  const { id } = useParams();
  const { token } = useAuth();
  const [thread, setThread] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.getThread(id, token).then(setThread).catch((e) => setError(e.message));
  }
  useEffect(load, [id, token]);

  async function handleReply(e) {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      await api.replyThread(id, { message }, token);
      setMessage('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!thread) return <p className="text-center text-ink/50 py-16">در حال بارگذاری...</p>;

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <div className="bg-surface border border-line/10 rounded-xl p-5 mb-6">
        <h1 className="font-black text-heading text-lg">{thread.title}</h1>
        <p className="text-xs text-ink/50 mt-1">پرسیده شده توسط {thread.author_name}</p>
        {thread.body && <p className="text-sm text-ink/80 mt-3">{thread.body}</p>}
      </div>

      <div className="space-y-3 mb-6">
        {thread.replies.map((r) => (
          <div key={r.id} className="bg-surface border border-line/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-heading text-sm">{r.author_name}</span>
              {r.author_role !== 'student' && (
                <span className="text-xs bg-sage/10 text-sage font-bold px-2 py-0.5 rounded-full">
                  {r.author_role === 'admin' ? 'مدیر' : 'استاد'}
                </span>
              )}
            </div>
            <p className="text-sm text-ink/80">{r.message}</p>
          </div>
        ))}
        {thread.replies.length === 0 && <p className="text-sm text-ink/50">هنوز پاسخی داده نشده.</p>}
      </div>

      <form onSubmit={handleReply} className="flex gap-2">
        <input
          placeholder="پاسخ خود را بنویسید..."
          className="flex-1 border border-line/20 rounded-lg px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="bg-gold text-navy font-bold px-4 py-2 rounded-lg">ارسال</button>
      </form>
    </div>
  );
}
