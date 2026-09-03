// services/stripeClient.js — کلاینت Stripe فقط وقتی STRIPE_SECRET_KEY تنظیم شده باشد ساخته می‌شود
// تا بدون کلید واقعی، سرور بدون خطا بالا بیاید و پرداخت کارتی صرفاً غیرفعال باشد.

const Stripe = require('stripe');

let client = null;

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

module.exports = { getStripeClient };
