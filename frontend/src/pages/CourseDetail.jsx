import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CourseDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getCourse(id).then(setCourse).catch((e) => setError(e.message));
    if (token) {
      api.getEnrollment(id, token).then(setEnrollment).catch(() => {});
    }
  }, [id, token]);

  useEffect(() => {
    if (!enrollment || !token) return;
    if (enrollment.status === 'pending' && enrollment.paymentId) {
      setPaymentInfo({
        status: 'pending',
        paymentRef: enrollment.paymentRef,
        paymentUrl: `/payment-status/${enrollment.paymentId}`,
      });
      return;
    }
    setPaymentInfo(null);
  }, [enrollment, token]);

  async function handleEnroll(method = 'manual') {
    if (!token) return navigate('/login');
    setBusy(true);
    setError('');
    try {
      const res = await api.checkout({ course_id: id, method }, token);

      // پرداخت کارتی: Stripe یک صفحه‌ی پرداخت واقعی برمی‌گرداند، مرورگر باید به آن هدایت شود
      if (res.provider === 'stripe' && res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }

      setPaymentInfo(res);
      const enrollmentRes = await api.getEnrollment(id, token);
      setEnrollment(enrollmentRes);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!course) return <p className="text-center text-ink/50 py-16">در حال بارگذاری...</p>;

  const canAccess = enrollment?.accessGranted;
  const isPending = enrollment?.status === 'pending';
  const isFailed = enrollment?.status === 'failed';

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <div className="h-2 rounded-full mb-4" style={{ backgroundColor: course.cover_color }} />
      <p className="text-xs font-bold text-sage mb-1">{course.subject}</p>
      <h1 className="text-3xl font-black text-heading">{course.title}</h1>
      <p className="text-ink/70 mt-2">{course.description}</p>

      <div className="mt-6 flex items-center justify-between bg-surface border border-line/10 rounded-xl p-5">
        <div>
          <p className="font-mono-nums font-bold text-xl text-heading">
            {course.price === 0 ? 'رایگان' : `${course.price} افغانی`}
            {course.price > 0 && course.price_usd > 0 && (
              <span className="text-sm text-ink/50 font-normal"> {' '}(یا ${course.price_usd} با کارت)</span>
            )}
          </p>
          {canAccess && <p className="text-sage text-sm font-bold mt-1">✓ شما در این کورس ثبت‌نام هستید</p>}
          {isPending && !canAccess && (
            <p className="text-yellow-600 text-sm font-bold mt-1">پرداخت شما در انتظار تایید است.</p>
          )}
          {isFailed && !canAccess && (
            <p className="text-red-600 text-sm font-bold mt-1">پرداخت ناموفق بود. دوباره امتحان کنید.</p>
          )}
        </div>
        {!canAccess && course.price === 0 && (
          <button
            onClick={() => handleEnroll('manual')}
            disabled={busy || isPending}
            className="bg-gold text-navy font-bold px-5 py-2.5 rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60"
          >
            {busy ? 'در حال پردازش...' : 'ثبت‌نام رایگان'}
          </button>
        )}
        {!canAccess && course.price > 0 && (
          <div className="flex flex-col gap-2 items-end">
            {course.price_usd > 0 && (
              <button
                onClick={() => handleEnroll('card')}
                disabled={busy}
                className="bg-gold text-navy font-bold px-5 py-2.5 rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60"
              >
                {busy ? 'در حال پردازش...' : '💳 پرداخت با کارت'}
              </button>
            )}
            <button
              onClick={() => handleEnroll('manual')}
              disabled={busy || isPending}
              className="bg-surface border border-line/20 text-heading font-bold px-5 py-2 rounded-lg text-sm hover:border-gold transition-colors disabled:opacity-60"
            >
              {isPending ? 'پرداخت در انتظار' : '🏦 حواله بانکی (تایید دستی)'}
            </button>
          </div>
        )}
      </div>

      {canAccess && (
        <div className="flex gap-2 mt-4">
          <Link
            to={`/courses/${id}/live`}
            className="text-sm bg-surface border border-line/10 rounded-lg px-4 py-2 hover:border-gold"
          >
            🎥 کلاس آنلاین زنده
          </Link>
          <Link
            to={`/courses/${id}/forum`}
            className="text-sm bg-surface border border-line/10 rounded-lg px-4 py-2 hover:border-gold"
          >
            💬 پرسش و پاسخ
          </Link>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-black text-heading text-lg mb-3">ویدیوهای درسی</h2>
        <div className="space-y-2">
          {course.videos.map((v, i) => (
            <div
              key={v.id}
              className={`flex items-center justify-between bg-surface border border-line/10 rounded-lg px-4 py-3 ${
                canAccess ? 'hover:border-gold cursor-pointer' : 'opacity-60'
              }`}
              onClick={() => canAccess && navigate(`/videos/${v.id}`)}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-line/10 text-heading text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-bold text-heading text-sm">{v.title}</span>
              </div>
              <span className="font-mono-nums text-xs text-ink/50">{formatDuration(v.duration_seconds)}</span>
            </div>
          ))}
          {course.videos.length === 0 && <p className="text-sm text-ink/50">هنوز ویدیویی اضافه نشده.</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-black text-heading text-lg mb-3">آزمون‌ها</h2>
        <div className="space-y-2">
          {course.tests.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between bg-surface border border-line/10 rounded-lg px-4 py-3 ${
                canAccess ? 'hover:border-gold cursor-pointer' : 'opacity-60'
              }`}
              onClick={() => canAccess && navigate(`/tests/${t.id}`)}
            >
              <span className="font-bold text-heading text-sm">{t.title}</span>
              <span className="text-xs text-sage font-bold">شروع آزمون ←</span>
            </div>
          ))}
          {course.tests.length === 0 && <p className="text-sm text-ink/50">هنوز آزمونی اضافه نشده.</p>}
        </div>
      </section>

      {!canAccess && (
        <>
          <p className="text-xs text-ink/50 mt-6 text-center">
            برای دسترسی به ویدیوها و آزمون‌ها ابتدا باید ثبت‌نام کنید.
          </p>
          {paymentInfo?.status === 'pending' && (
            <div className="mt-4 rounded-xl border border-gold/20 bg-gold/10 p-4 text-sm text-ink/80">
              پرداخت شما در حال انتظار است. پس از تایید پرداخت، دسترسی به کورس فعال خواهد شد.
              {paymentInfo.paymentRef && (
                <div className="mt-2 font-mono-nums text-xs text-ink/60">
                  شناسه پرداخت: {paymentInfo.paymentRef}
                </div>
              )}
              {paymentInfo.paymentUrl && (
                <div className="mt-3">
                  <a
                    href={paymentInfo.paymentUrl}
                    className="text-sm font-bold text-navy underline"
                  >
                    مشاهده وضعیت پرداخت
                  </a>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
