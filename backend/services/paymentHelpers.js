// services/paymentHelpers.js — منطق مشترک بین وبهوک عمومی، تایید دستی ادمین و وبهوک Stripe

const db = require('../db');

function grantCourseAccess(userId, courseId, status = 'paid') {
  const enrollment = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);

  if (enrollment) {
    db.prepare(
      `UPDATE enrollments SET payment_status = ?, access_granted = 1 WHERE id = ?`
    ).run(status, enrollment.id);
    return;
  }

  db.prepare(
    `INSERT INTO enrollments (user_id, course_id, payment_status, access_granted) VALUES (?, ?, ?, 1)`
  ).run(userId, courseId, status);
}

// اگر پرداخت موفق دیگری برای همین کورس وجود داشته باشد، دسترسی هرگز قطع نمی‌شود.
function handleFailedPayment(payment) {
  const successfulPayment = db
    .prepare(
      `SELECT id FROM payments WHERE user_id = ? AND course_id = ? AND status = 'success' LIMIT 1`
    )
    .get(payment.user_id, payment.course_id);

  if (successfulPayment) {
    grantCourseAccess(payment.user_id, payment.course_id, 'paid');
    return;
  }

  db.prepare(
    `UPDATE enrollments SET payment_status = 'failed', access_granted = 0 WHERE user_id = ? AND course_id = ?`
  ).run(payment.user_id, payment.course_id);
}

module.exports = { grantCourseAccess, handleFailedPayment };
