import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function TeacherPanel() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [msg, setMsg] = useState('');

  const [courseForm, setCourseForm] = useState({ title: '', description: '', subject: '', price: 0 });
  const [videoForm, setVideoForm] = useState({ title: '', file: null });
  const [testForm, setTestForm] = useState({
    title: '',
    questions: [{ question_text: '', options: ['', '', '', ''], correct_index: 0 }],
  });

  function loadCourses() {
    api.getMyCourses(token).then(setCourses).catch(() => {});
  }
  useEffect(loadCourses, [token]);

  function openCourse(c) {
    setSelectedCourse(c);
    api.getCourseStudents(c.id, token).then(setStudents).catch(() => {});
  }

  async function submitCourse(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api.createCourse(courseForm, token);
      setMsg('✓ کورس ساخته شد.');
      setCourseForm({ title: '', description: '', subject: '', price: 0 });
      loadCourses();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function submitVideo(e) {
    e.preventDefault();
    setMsg('');
    if (!videoForm.file || !selectedCourse) return setMsg('یک کورس و فایل ویدیو انتخاب کنید.');
    const form = new FormData();
    form.append('video', videoForm.file);
    form.append('title', videoForm.title);
    try {
      const res = await fetch(`/api/videos/upload/${selectedCourse.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg('✓ ویدیو آپلود شد.');
      setVideoForm({ title: '', file: null });
    } catch (err) {
      setMsg(err.message);
    }
  }

  function updateQuestion(idx, field, value) {
    setTestForm((prev) => {
      const questions = [...prev.questions];
      questions[idx] = { ...questions[idx], [field]: value };
      return { ...prev, questions };
    });
  }
  function updateOption(qIdx, oIdx, value) {
    setTestForm((prev) => {
      const questions = [...prev.questions];
      const options = [...questions[qIdx].options];
      options[oIdx] = value;
      questions[qIdx] = { ...questions[qIdx], options };
      return { ...prev, questions };
    });
  }
  function addQuestion() {
    setTestForm((prev) => ({
      ...prev,
      questions: [...prev.questions, { question_text: '', options: ['', '', '', ''], correct_index: 0 }],
    }));
  }

  async function submitTest(e) {
    e.preventDefault();
    setMsg('');
    if (!selectedCourse) return setMsg('یک کورس انتخاب کنید.');
    try {
      await api.createTest({ course_id: selectedCourse.id, ...testForm }, token);
      setMsg('✓ آزمون ساخته شد.');
      setTestForm({ title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_index: 0 }] });
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-1">پنل استاد</h1>
      <p className="text-ink/60 text-sm mb-6">خوش آمدید {user?.full_name}</p>
      {msg && <p className="text-sage font-bold text-sm mb-4">{msg}</p>}

      <div className="grid md:grid-cols-3 gap-6">
        {/* لیست کورس‌ها */}
        <div className="md:col-span-1 space-y-3">
          <h2 className="font-bold text-heading text-sm">کورس‌های من</h2>
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => openCourse(c)}
              className={`block w-full text-right bg-surface border rounded-lg px-4 py-3 text-sm ${
                selectedCourse?.id === c.id ? 'border-gold' : 'border-line/10'
              }`}
            >
              <p className="font-bold text-heading">{c.title}</p>
              <p className="text-xs text-ink/50">{c.subject}</p>
            </button>
          ))}
          {courses.length === 0 && <p className="text-sm text-ink/50">هنوز کورسی ندارید.</p>}

          <form onSubmit={submitCourse} className="bg-surface border border-line/10 rounded-xl p-4 space-y-2 mt-4">
            <h3 className="font-bold text-heading text-xs">افزودن کورس جدید</h3>
            <input
              placeholder="عنوان"
              required
              className="w-full border border-line/20 rounded-lg px-3 py-1.5 text-sm"
              value={courseForm.title}
              onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
            />
            <input
              placeholder="موضوع"
              className="w-full border border-line/20 rounded-lg px-3 py-1.5 text-sm"
              value={courseForm.subject}
              onChange={(e) => setCourseForm({ ...courseForm, subject: e.target.value })}
            />
            <input
              type="number"
              placeholder="قیمت"
              className="w-full border border-line/20 rounded-lg px-3 py-1.5 text-sm font-mono-nums"
              value={courseForm.price}
              onChange={(e) => setCourseForm({ ...courseForm, price: Number(e.target.value) })}
            />
            <button className="w-full bg-navy text-white font-bold py-1.5 rounded-lg text-sm">ساخت کورس</button>
          </form>
        </div>

        {/* جزئیات کورس انتخاب‌شده */}
        <div className="md:col-span-2 space-y-6">
          {!selectedCourse && (
            <p className="text-sm text-ink/50 bg-surface border border-line/10 rounded-xl p-6 text-center">
              یک کورس را از سمت راست انتخاب کنید تا شاگردان، آپلود ویدیو و آزمون را مدیریت کنید.
            </p>
          )}

          {selectedCourse && (
            <>
              <div className="flex gap-2">
                <Link
                  to={`/courses/${selectedCourse.id}/live`}
                  className="text-sm bg-surface border border-line/10 rounded-lg px-4 py-2 hover:border-gold"
                >
                  🎥 کلاس آنلاین زنده
                </Link>
                <Link
                  to={`/courses/${selectedCourse.id}/forum`}
                  className="text-sm bg-surface border border-line/10 rounded-lg px-4 py-2 hover:border-gold"
                >
                  💬 پرسش و پاسخ
                </Link>
              </div>

              <div className="bg-surface border border-line/10 rounded-xl p-5">
                <h3 className="font-bold text-heading mb-3">شاگردان ثبت‌نام‌شده ({students.length})</h3>
                <div className="space-y-2">
                  {students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm border-b border-line/5 pb-2">
                      <div>
                        <p className="font-bold text-heading">{s.full_name}</p>
                        <p className="text-xs text-ink/50">{s.email}</p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          s.payment_status === 'pending'
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                            : 'bg-sage/10 text-sage'
                        }`}
                      >
                        {s.payment_status === 'paid' ? 'پرداخت‌شده' : s.payment_status === 'free' ? 'رایگان' : 'در انتظار'}
                      </span>
                    </div>
                  ))}
                  {students.length === 0 && <p className="text-sm text-ink/50">هنوز شاگردی ثبت‌نام نکرده.</p>}
                </div>
              </div>

              <form onSubmit={submitVideo} className="bg-surface border border-line/10 rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-heading">آپلود ویدیوی درسی</h3>
                <input
                  placeholder="عنوان ویدیو"
                  className="w-full border border-line/20 rounded-lg px-3 py-2"
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                />
                <input
                  type="file"
                  accept="video/*"
                  required
                  className="w-full text-sm"
                  onChange={(e) => setVideoForm({ ...videoForm, file: e.target.files[0] })}
                />
                <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg">آپلود</button>
              </form>

              <form onSubmit={submitTest} className="bg-surface border border-line/10 rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-heading">ساخت آزمون</h3>
                <input
                  placeholder="عنوان آزمون"
                  required
                  className="w-full border border-line/20 rounded-lg px-3 py-2"
                  value={testForm.title}
                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                />
                {testForm.questions.map((q, qi) => (
                  <div key={qi} className="border border-line/10 rounded-lg p-3 space-y-2">
                    <input
                      placeholder={`سوال ${qi + 1}`}
                      className="w-full border border-line/20 rounded-lg px-3 py-2"
                      value={q.question_text}
                      onChange={(e) => updateQuestion(qi, 'question_text', e.target.value)}
                    />
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={q.correct_index === oi}
                          onChange={() => updateQuestion(qi, 'correct_index', oi)}
                        />
                        <input
                          placeholder={`گزینه ${oi + 1}`}
                          className="flex-1 border border-line/20 rounded-lg px-3 py-1.5 text-sm"
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <button type="button" onClick={addQuestion} className="text-sm text-gold font-bold">
                  + افزودن سوال دیگر
                </button>
                <button className="block bg-navy text-white font-bold px-4 py-2 rounded-lg">ساخت آزمون</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
