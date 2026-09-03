const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'student'").get().c;
  const totalTeachers = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'teacher'").get().c;
  const totalCourses = db.prepare('SELECT COUNT(*) c FROM courses').get().c;

  // پرداخت‌ها می‌توانند به چند واحد پول باشند (AFN حواله‌ی دستی، USD کارت Stripe).
  // جمع‌زدن مبالغ با واحدهای مختلف در یک عدد، گزارش مالی نادرستی می‌سازد،
  // پس درآمد به تفکیک واحد پول برگردانده می‌شود؛ totalRevenue برای سازگاری با
  // نسخه‌های قبلی همچنان فقط افغانی (واحد اصلی) را نشان می‌دهد.
  const totalRevenue = db
    .prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status = 'success' AND currency = 'AFN'")
    .get().s;

  const revenueByCurrency = db
    .prepare(
      `SELECT currency, COALESCE(SUM(amount),0) AS total
       FROM payments
       WHERE status = 'success'
       GROUP BY currency`
    )
    .all();

  const perBranch = db
    .prepare(
      `SELECT b.title AS branch, COUNT(u.id) AS student_count FROM branches b
       LEFT JOIN users u ON u.branch_id = b.id AND u.role = 'student'
       GROUP BY b.id`
    )
    .all();

  // نمودار درآمد به تفکیک کورس فقط افغانی (واحد اصلی) را جمع می‌زند تا با
  // پرداخت‌های کارتی (USD) قاطی نشود.
  const perCourse = db
    .prepare(
      `SELECT c.title AS course, COUNT(e.id) AS enrolled_count,
        COALESCE(SUM(CASE WHEN p.status='success' AND p.currency='AFN' THEN p.amount ELSE 0 END),0) AS revenue
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN payments p ON p.course_id = c.id
       GROUP BY c.id`
    )
    .all();

  const avgScoresPerCourse = db
    .prepare(
      `SELECT c.title AS course, ROUND(AVG(CAST(tr.score AS FLOAT) / tr.total * 100), 1) AS avg_percent
       FROM test_results tr
       JOIN tests t ON t.id = tr.test_id
       JOIN courses c ON c.id = t.course_id
       GROUP BY c.id`
    )
    .all();

  res.json({
    totalStudents,
    totalTeachers,
    totalCourses,
    totalRevenue,
    revenueByCurrency,
    perBranch,
    perCourse,
    avgScoresPerCourse,
  });
});

module.exports = router;
