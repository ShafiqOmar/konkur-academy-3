import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import TrailPath from '../components/TrailPath';

export default function Home() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCourses().then(setCourses).catch((e) => setError(e.message));
  }, []);

  const trail = [
    { label: 'شروع', percent: 100 },
    { label: 'مفاهیم پایه', percent: 100 },
    { label: 'تست‌های موضوعی', percent: 60 },
    { label: 'آزمون جامع', percent: 20 },
    { label: 'روز کانکور', percent: 0 },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-10 text-center">
        <span className="inline-block text-xs font-bold tracking-widest text-sage bg-sage/10 px-3 py-1 rounded-full mb-4">
          آموزشگاه آنلاین کانکور
        </span>
        <h1 className="text-4xl md:text-5xl font-black text-heading leading-tight">
          هر شاگرد یک مسیر دارد،<br /> این مسیر تا روز کانکور است
        </h1>
        <p className="mt-4 text-ink/70 max-w-xl mx-auto">
          ویدیوهای درسی، آزمون‌های آنلاین و پیگیری پیشرفت — همه‌جا با شما، تا روزی که ورق امتحان را باز می‌کنید.
        </p>

        <div className="mt-10 bg-surface rounded-2xl border border-line/10 p-6 shadow-sm">
          <p className="text-sm font-bold text-heading mb-4">نمونه‌ی مسیر یک شاگرد</p>
          <TrailPath milestones={trail} />
        </div>
      </section>

      {/* Courses */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <h2 className="text-2xl font-black text-heading mb-6">کورس‌های موجود</h2>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.id}`}
              className="group bg-surface rounded-xl border border-line/10 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="h-2" style={{ backgroundColor: c.cover_color }} />
              <div className="p-5">
                <p className="text-xs font-bold text-sage mb-1">{c.subject}</p>
                <h3 className="font-bold text-heading text-lg group-hover:text-gold transition-colors">
                  {c.title}
                </h3>
                <p className="text-sm text-ink/60 mt-1 line-clamp-2">{c.description}</p>
                <p className="mt-3 font-mono-nums font-bold text-heading">
                  {c.price === 0 ? 'رایگان' : `${c.price} افغانی`}
                </p>
              </div>
            </Link>
          ))}
        </div>
        {courses.length === 0 && !error && (
          <p className="text-ink/50 text-sm">در حال بارگذاری کورس‌ها...</p>
        )}
      </section>
    </div>
  );
}
