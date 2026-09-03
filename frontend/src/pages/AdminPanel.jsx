import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AdminPanel() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [msg, setMsg] = useState('');
  const [paymentMsg, setPaymentMsg] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(null);

  const [courseForm, setCourseForm] = useState({
    title: '', description: '', subject: '', price: 0, price_usd: '', branch_id: '', teacher_id: '',
  });
  const [videoForm, setVideoForm] = useState({ course_id: '', title: '', file: null });
  const [testForm, setTestForm] = useState({
    course_id: '',
    title: '',
    questions: [{ question_text: '', options: ['', '', '', ''], correct_index: 0 }],
  });
  const [branchForm, setBranchForm] = useState({ title: '', description: '' });
  const [teacherForm, setTeacherForm] = useState({ full_name: '', email: '', password: '' });

  function loadAll() {
    api.getCourses().then(setCourses);
    api.getBranches().then(setBranches);
    api.getTeachers(token).then(setTeachers).catch(() => {});
    loadPendingPayments();
  }

  function loadPendingPayments() {
    if (!token) return;
    api
      .getPendingPayments(token)
      .then(setPendingPayments)
      .catch(() => setPendingPayments([]));
  }

  useEffect(loadAll, [token]);

  if (user && user.role !== 'admin') {
    return <p className="text-center text-red-600 py-16">این صفحه فقط برای مدیر آموزشگاه است.</p>;
  }

  async function submitBranch(e) {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(branchForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg('✓ رشته/صنف ساخته شد.');
      setBranchForm({ title: '', description: '' });
      loadAll();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function submitTeacher(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api.createTeacher(teacherForm, token);
      setMsg('✓ حساب استاد ساخته شد.');
      setTeacherForm({ full_name: '', email: '', password: '' });
      loadAll();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function approvePayment(paymentId) {
    if (!token) return;
    setPaymentLoading(paymentId);
    setPaymentMsg('');
    try {
      await api.approvePayment(paymentId, token);
      setPaymentMsg('پرداخت تایید شد.');
      loadPendingPayments();
    } catch (err) {
      setPaymentMsg(err.message);
    } finally {
      setPaymentLoading(null);
    }
  }

  async function rejectPayment(paymentId) {
    if (!token) return;
    setPaymentLoading(paymentId);
    setPaymentMsg('');
    try {
      await api.rejectPayment(paymentId, token);
      setPaymentMsg('پرداخت رد شد.');
      loadPendingPayments();
    } catch (err) {
      setPaymentMsg(err.message);
    } finally {
      setPaymentLoading(null);
    }
  }

  async function submitCourse(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api.createCourse(
        { ...courseForm, price_usd: courseForm.price_usd === '' ? undefined : Number(courseForm.price_usd) },
        token
      );
      setMsg('✓ کورس ساخته شد.');
      setCourseForm({ title: '', description: '', subject: '', price: 0, price_usd: '', branch_id: '', teacher_id: '' });
      loadAll();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function submitVideo(e) {
    e.preventDefault();
    setMsg('');
    if (!videoForm.file || !videoForm.course_id) return setMsg('کورس و فایل ویدیو را انتخاب کنید.');
    const form = new FormData();
    form.append('video', videoForm.file);
    form.append('title', videoForm.title);
    try {
      const res = await fetch(`/api/videos/upload/${videoForm.course_id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg('✓ ویدیو آپلود شد.');
      setVideoForm({ course_id: '', title: '', file: null });
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function submitTest(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api.createTest(testForm, token);
      setMsg('✓ آزمون ساخته شد.');
      setTestForm({
        course_id: '',
        title: '',
        questions: [{ question_text: '', options: ['', '', '', ''], correct_index: 0 }],
      });
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

  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-heading">پنل مدیریت آموزشگاه</h1>
        <Link to="/admin/stats" className="text-sm bg-navy text-white font-bold px-4 py-2 rounded-lg">
          📊 آمار و گزارش‌گیری
        </Link>
      </div>
      {msg && <p className="text-sage font-bold text-sm mb-4">{msg}</p>}
      {paymentMsg && <p className="text-rose-600 font-bold text-sm mb-4">{paymentMsg}</p>}

      <div className="bg-surface border border-line/10 rounded-xl p-5 mb-8">
        <h2 className="font-bold text-heading mb-3">پرداخت‌های در انتظار</h2>
        {pendingPayments.length === 0 ? (
          <p className="text-sm text-ink/60">پرداخت در انتظار وجود ندارد.</p>
        ) : (
          <div className="space-y-3">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-line/10 p-4 bg-white/70">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-heading">{payment.course_title}</p>
                    <p className="text-xs text-ink/60">کاربر: {payment.user_name} ({payment.user_email})</p>
                    <p className="text-xs text-ink/60">
                      مبلغ: {payment.amount} {payment.currency === 'AFN' ? 'افغانی' : payment.currency} ({payment.method === 'card' ? 'کارت' : 'حواله بانکی'})
                    </p>
                    <p className="text-xs text-ink/60">شناسه پرداخت: {payment.provider_payment_id}</p>
                  </div>
                  <div className="flex gap-2 mt-3 sm:mt-0">
                    <button
                      disabled={paymentLoading === payment.id}
                      onClick={() => approvePayment(payment.id)}
                      className="rounded-lg bg-sage px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      تایید
                    </button>
                    <button
                      disabled={paymentLoading === payment.id}
                      onClick={() => rejectPayment(payment.id)}
                      className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      رد
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* ساخت رشته/صنف */}
        <form onSubmit={submitBranch} className="bg-surface border border-line/10 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-heading text-sm">افزودن رشته/صنف جدید</h2>
          <input
            placeholder="عنوان رشته (مثلاً طب)"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={branchForm.title}
            onChange={(e) => setBranchForm({ ...branchForm, title: e.target.value })}
          />
          <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg text-sm">ساخت رشته</button>
          <div className="pt-2 flex flex-wrap gap-1">
            {branches.map((b) => (
              <span key={b.id} className="text-xs bg-line/5 text-heading px-2 py-1 rounded-full">
                {b.title}
              </span>
            ))}
          </div>
        </form>

        {/* ساخت حساب استاد */}
        <form onSubmit={submitTeacher} className="bg-surface border border-line/10 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-heading text-sm">افزودن حساب استاد جدید</h2>
          <input
            placeholder="نام کامل استاد"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={teacherForm.full_name}
            onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
          />
          <input
            type="email"
            placeholder="ایمیل"
            required
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={teacherForm.email}
            onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="رمز عبور موقت"
            required
            minLength={6}
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={teacherForm.password}
            onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
          />
          <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg text-sm">ساخت حساب استاد</button>
        </form>
      </div>

      {/* ساخت کورس */}
      <form onSubmit={submitCourse} className="bg-surface border border-line/10 rounded-xl p-5 mb-8 space-y-3">
        <h2 className="font-bold text-heading">افزودن کورس جدید</h2>
        <input
          placeholder="عنوان کورس"
          required
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={courseForm.title}
          onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
        />
        <input
          placeholder="موضوع (مثلاً ریاضی)"
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={courseForm.subject}
          onChange={(e) => setCourseForm({ ...courseForm, subject: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={courseForm.branch_id}
            onChange={(e) => setCourseForm({ ...courseForm, branch_id: e.target.value })}
          >
            <option value="">بدون رشته</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <select
            className="w-full border border-line/20 rounded-lg px-3 py-2"
            value={courseForm.teacher_id}
            onChange={(e) => setCourseForm({ ...courseForm, teacher_id: e.target.value })}
          >
            <option value="">بدون استاد</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="توضیحات"
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={courseForm.description}
          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            placeholder="قیمت به افغانی (۰ برای رایگان)"
            className="w-full border border-line/20 rounded-lg px-3 py-2 font-mono-nums"
            value={courseForm.price}
            onChange={(e) => setCourseForm({ ...courseForm, price: Number(e.target.value) })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="قیمت به دالر برای کارت (اختیاری)"
            className="w-full border border-line/20 rounded-lg px-3 py-2 font-mono-nums"
            value={courseForm.price_usd}
            onChange={(e) => setCourseForm({ ...courseForm, price_usd: e.target.value })}
          />
        </div>
        <p className="text-xs text-ink/50">
          اگر قیمت دلاری خالی بماند، پرداخت با کارت (Stripe) برای این کورس غیرفعال می‌ماند و فقط حواله بانکی در دسترس است.
        </p>
        <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg">ساخت کورس</button>
      </form>

      {/* آپلود ویدیو */}
      <form onSubmit={submitVideo} className="bg-surface border border-line/10 rounded-xl p-5 mb-8 space-y-3">
        <h2 className="font-bold text-heading">آپلود ویدیوی درسی</h2>
        <select
          required
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={videoForm.course_id}
          onChange={(e) => setVideoForm({ ...videoForm, course_id: e.target.value })}
        >
          <option value="">انتخاب کورس...</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
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
        <button className="bg-navy text-white font-bold px-4 py-2 rounded-lg">آپلود ویدیو</button>
      </form>

      {/* ساخت آزمون */}
      <form onSubmit={submitTest} className="bg-surface border border-line/10 rounded-xl p-5 space-y-3">
        <h2 className="font-bold text-heading">ساخت آزمون</h2>
        <select
          required
          className="w-full border border-line/20 rounded-lg px-3 py-2"
          value={testForm.course_id}
          onChange={(e) => setTestForm({ ...testForm, course_id: e.target.value })}
        >
          <option value="">انتخاب کورس...</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
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
    </div>
  );
}
