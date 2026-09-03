const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { isValidEmail } = require('../utils/validators');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ثبت‌نام شاگرد جدید
router.post('/register', authLimiter, (req, res) => {
  const { full_name, email, password, branch_id } = req.body;

  if (!full_name || !String(full_name).trim() || !email || !password) {
    return res.status(400).json({ message: 'نام، ایمیل و رمز عبور الزامی است.' });
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
  if (existing) {
    return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است.' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (full_name, email, password_hash, role, branch_id) VALUES (?, ?, ?, ?, ?)')
    .run(cleanFullName, cleanEmail, password_hash, 'student', branch_id || null);

  const user = { id: info.lastInsertRowid, role: 'student', full_name: cleanFullName };
  res.status(201).json({ token: signToken(user), user });
});

// ورود
router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());

  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.status(401).json({ message: 'ایمیل یا رمز عبور نادرست است.' });
  }

  const user = { id: row.id, role: row.role, full_name: row.full_name };
  res.json({ token: signToken(user), user });
});

// اطلاعات کاربر جاری
router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id, full_name, email, role, branch_id, points, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(row);
});

module.exports = router;
