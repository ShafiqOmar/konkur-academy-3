import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AdminStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminStats(token).then(setStats).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!stats) return <p className="text-center text-ink/50 py-16">در حال بارگذاری...</p>;

  const cards = [
    { label: 'مجموع شاگردان', value: stats.totalStudents },
    { label: 'مجموع استادان', value: stats.totalTeachers },
    { label: 'مجموع کورس‌ها', value: stats.totalCourses },
    { label: 'مجموع درآمد (افغانی)', value: stats.totalRevenue },
  ];

  // درآمد به تفکیک واحد پول (افغانی از حواله دستی، دلار از پرداخت کارتی Stripe)
  // هیچ‌وقت با هم جمع زده نمی‌شوند چون نرخ تبدیل واقعی موجود نیست.
  const otherCurrencies = (stats.revenueByCurrency || []).filter((r) => r.currency !== 'AFN' && r.total > 0);

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-6">آمار و گزارش‌گیری</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-surface border border-line/10 rounded-xl p-4 text-center">
            <p className="font-mono-nums text-2xl font-black text-heading">{c.value}</p>
            <p className="text-xs text-ink/50 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {otherCurrencies.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {otherCurrencies.map((r) => (
            <span key={r.currency} className="text-sm bg-surface border border-line/10 rounded-full px-4 py-1.5 font-mono-nums">
              درآمد کارتی: {r.total} {r.currency}
            </span>
          ))}
        </div>
      )}

      <div className="bg-surface border border-line/10 rounded-xl p-5 mb-6">
        <h2 className="font-bold text-heading mb-4 text-sm">شاگردان به تفکیک رشته</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.perBranch}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFF3F6" />
            <XAxis dataKey="branch" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="student_count" fill="#2D4263" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-line/10 rounded-xl p-5 mb-6">
        <h2 className="font-bold text-heading mb-4 text-sm">درآمد به تفکیک کورس</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.perCourse}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFF3F6" />
            <XAxis dataKey="course" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="revenue" fill="#E8A33D" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-line/10 rounded-xl p-5">
        <h2 className="font-bold text-heading mb-4 text-sm">میانگین نمرات آزمون به تفکیک کورس (%)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.avgScoresPerCourse}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFF3F6" />
            <XAxis dataKey="course" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="avg_percent" fill="#4E8D7C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
