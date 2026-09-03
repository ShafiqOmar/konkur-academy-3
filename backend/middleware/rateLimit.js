// middleware/rateLimit.js — درخواست‌های بیش‌ازحد را محدود می‌کند

const rateLimit = require('express-rate-limit');

// در تست‌ها محدودیت غیرفعال می‌شود تا آزمون‌های پیاپی login/register مسدود نشوند
const skipInTest = () => process.env.NODE_ENV === 'test';

// محدودیت کلی روی همه‌ی مسیرهای API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ۱۵ دقیقه
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { message: 'تعداد درخواست‌های شما بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' },
});

// محدودیت سخت‌گیرانه‌تر برای ورود/ثبت‌نام تا جلوی حدس‌زدن رمز عبور گرفته شود
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ۱۵ دقیقه
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { message: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.' },
});

module.exports = { apiLimiter, authLimiter };
