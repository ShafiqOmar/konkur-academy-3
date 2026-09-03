const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// لیدربورد کلی یا بر اساس رشته (?branch_id=)
router.get('/', requireAuth, (req, res) => {
  const { branch_id } = req.query;
  const rows = branch_id
    ? db
        .prepare(
          `SELECT u.id, u.full_name, u.points, b.title AS branch_title FROM users u
           LEFT JOIN branches b ON b.id = u.branch_id
           WHERE u.role = 'student' AND u.branch_id = ?
           ORDER BY u.points DESC LIMIT 20`
        )
        .all(branch_id)
    : db
        .prepare(
          `SELECT u.id, u.full_name, u.points, b.title AS branch_title FROM users u
           LEFT JOIN branches b ON b.id = u.branch_id
           WHERE u.role = 'student'
           ORDER BY u.points DESC LIMIT 20`
        )
        .all();

  const myRank = rows.findIndex((r) => r.id === req.user.id);
  res.json({ rows, myRank: myRank === -1 ? null : myRank + 1 });
});

module.exports = router;
