import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Leaderboard() {
  const { token } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState({ rows: [], myRank: null });
  const [error, setError] = useState('');

  useEffect(() => {
    api.getBranches().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    api.getLeaderboard(branchId || null, token).then(setData).catch((e) => setError(e.message));
  }, [branchId, token]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-1">لیدربورد شاگردان</h1>
      <p className="text-ink/60 text-sm mb-6">امتیاز از آزمون‌های آنلاین به‌دست می‌آید — هر پاسخ درست ۱۰ امتیاز.</p>

      <select
        className="border border-line/20 rounded-lg px-3 py-2 mb-6"
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
      >
        <option value="">همه رشته‌ها</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {data.myRank && (
        <p className="mb-4 text-sm font-bold text-sage">رتبه شما: {data.myRank}</p>
      )}

      <div className="space-y-2">
        {data.rows.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center justify-between bg-surface border border-line/10 rounded-lg px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 text-center font-bold text-heading">{medals[i] || i + 1}</span>
              <div>
                <p className="font-bold text-heading text-sm">{r.full_name}</p>
                {r.branch_title && <p className="text-xs text-ink/50">{r.branch_title}</p>}
              </div>
            </div>
            <span className="font-mono-nums font-black text-gold">{r.points}</span>
          </div>
        ))}
        {data.rows.length === 0 && <p className="text-sm text-ink/50">هنوز امتیازی ثبت نشده.</p>}
      </div>
    </div>
  );
}
