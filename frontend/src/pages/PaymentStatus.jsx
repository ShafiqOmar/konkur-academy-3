import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function PaymentStatus() {
  const { paymentId } = useParams();
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .getPaymentStatus(paymentId, token)
      .then((res) => setStatus(res))
      .catch((err) => setError(err.message));
  }, [paymentId, token]);

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!status) return <p className="text-center text-ink/50 py-16">در حال بارگذاری وضعیت پرداخت...</p>;

  const statusLabel = { pending: 'در انتظار تایید', success: 'موفق', failed: 'ناموفق' }[status.status] || status.status;

  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-4">وضعیت پرداخت</h1>
      <div className="rounded-3xl border border-line/10 bg-surface p-6 space-y-4">
        <div>
          <p className="text-sm text-ink/60">شناسه پرداخت</p>
          <p className="font-bold text-heading">{status.paymentRef}</p>
        </div>
        <div>
          <p className="text-sm text-ink/60">وضعیت</p>
          <p className="font-bold text-heading">{statusLabel}</p>
        </div>
        <div>
          <p className="text-sm text-ink/60">مبلغ</p>
          <p className="font-bold text-heading">
            {status.amount} {status.currency === 'AFN' ? 'افغانی' : status.currency}
          </p>
        </div>
        {status.confirmedAt && (
          <div>
            <p className="text-sm text-ink/60">زمان تایید</p>
            <p className="font-bold text-heading">{status.confirmedAt}</p>
          </div>
        )}
        {status.status === 'pending' && (
          <p className="text-sm text-ink/60">پرداخت شما هنوز تایید نشده است. لطفاً کمی بعد دوباره بررسی کنید.</p>
        )}
        {status.status === 'success' && (
          <p className="text-sm text-sage">پرداخت تایید شد و دسترسی به کورس فعال شده است.</p>
        )}
        {status.status === 'failed' && (
          <p className="text-sm text-red-600">پرداخت ناموفق بود. در صورت نیاز با پشتیبانی تماس بگیرید.</p>
        )}
      </div>
    </div>
  );
}
