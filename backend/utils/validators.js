// utils/validators.js — بررسی‌های ساده و مشترک برای ورودی کاربر

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && email.trim().length <= 254 && EMAIL_RE.test(email.trim());
}

module.exports = { isValidEmail };
