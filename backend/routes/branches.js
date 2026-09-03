const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM branches ORDER BY id').all());
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ message: 'عنوان رشته الزامی است.' });
  const info = db
    .prepare('INSERT INTO branches (title, description) VALUES (?, ?)')
    .run(title, description || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
