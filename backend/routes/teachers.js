const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { isValidEmail } = require('../utils/validators');

const router = express.Router();

// لیست استادان (برای دراپ‌داون تخصیص کورس)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const teachers = db
    .prepare("SELECT id, full_name, email, created_at FROM users WHERE role = 'teacher' ORDER BY full_name")
    .all();
  res.json(teachers);
});

// ساخت حساب استاد جدید (فقط ادمین)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !String(full_name).trim() || !email || !password) {
    return res.status(400).json({ message: 'نام، ایمیل و رمز عبور استاد الزامی است.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'فرمت ایمیل نادرست است.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'رمز عبور باید حداقل ۶ حرف باشد.' });
  }

  const cleanFullName = String(full_name).trim().slice(0, 120);
  const cleanEmail = email.trim().toLowerCase();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است.' });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(cleanFullName, cleanEmail, password_hash, 'teacher');

  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
