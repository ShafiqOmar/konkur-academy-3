import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import TrailPath from '../components/TrailPath';

export default function Dashboard() {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!data) return <p className="text-center text-ink/50 py-16">در حال بارگذاری...</p>;

  const trail = [
    { label: 'شروع', percent: 100 },
    ...data.courses.map((c) => ({ label: c.title, percent: c.progressPercent })),
    { label: 'روز کانکور', percent: data.overallProgress >= 100 ? 100 : 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading">سلام {user?.full_name} 👋</h1>
      <p className="text-ink/60 mt-1">این مسیر شما تا روز کانکور است.</p>

      <div className="mt-6 bg-surface rounded-xl border border-line/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-heading">پیشرفت کلی</p>
          <p className="font-mono-nums font-black text-gold text-xl">{data.overallProgress}%</p>
        </div>
        <TrailPath milestones={trail} compact />
      </div>

      <section className="mt-8">
        <h2 className="font-black text-heading text-lg mb-3">کورس‌های من</h2>
        <div className="space-y-3">
          {data.courses.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.id}`}
              className="block bg-surface border border-line/10 rounded-xl p-4 hover:border-gold transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-heading">{c.title}</span>
                <span className="font-mono-nums text-sm text-sage font-bold">{c.progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-line/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sage rounded-full transition-all"
                  style={{ width: `${c.progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-ink/50 mt-2 font-mono-nums">
                {c.watchedVideos} از {c.totalVideos} ویدیو تماشا شده
              </p>
            </Link>
          ))}
          {data.courses.length === 0 && (
            <p className="text-sm text-ink/50">
              هنوز در کورسی ثبت‌نام نکرده‌اید.{' '}
              <Link to="/" className="text-gold font-bold">
                مشاهده کورس‌ها
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-black text-heading text-lg mb-3">نتایج آزمون‌ها</h2>
        <div className="space-y-2">
          {data.testResults.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between bg-surface border border-line/10 rounded-lg px-4 py-3"
            >
              <div>
                <p className="font-bold text-heading text-sm">{r.test_title}</p>
                <p className="text-xs text-ink/50">{r.course_title}</p>
              </div>
              <span className="font-mono-nums font-bold text-heading">
                {r.score}/{r.total}
              </span>
            </div>
          ))}
          {data.testResults.length === 0 && (
            <p className="text-sm text-ink/50">هنوز آزمونی نداده‌اید.</p>
          )}
        </div>
      </section>
    </div>
  );
}
