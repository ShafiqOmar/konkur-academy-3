// middleware/auth.js — بررسی توکن JWT و تشخیص نقش کاربر (شاگرد/ادمین)

const jwt = require('jsonwebtoken');
const db = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'برای دسترسی باید وارد حساب خود شوید.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'نشست شما منقضی شده، دوباره وارد شوید.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'این عملیات فقط برای مدیر آموزشگاه مجاز است.' });
  }
  next();
}

function requireTeacherOrAdmin(req, res, next) {
  if (!['admin', 'teacher'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'این عملیات فقط برای استاد یا مدیر مجاز است.' });
  }
  next();
}
function requireCourseAccess(req, res, next) {
  try {
    const courseId =
      req.params.courseId ||
      req.params.course_id ||
      req.body.course_id;

    if (!courseId) {
      return res.status(400).json({
        message: 'کورس مشخص نشده است.',
      });
    }

    const course = db
      .prepare('SELECT * FROM courses WHERE id = ?')
      .get(courseId);

    if (!course) {
      return res.status(404).json({
        message: 'کورس یافت نشد.',
      });
    }

    // Admin her kursa erişebilir
    if (req.user.role === 'admin') {
      req.course = course;
      return next();
    }

    // Öğretmen sadece kendi kursuna erişebilir
    if (
      req.user.role === 'teacher' &&
      course.teacher_id === req.user.id
    ) {
      req.course = course;
      return next();
    }

    // Öğrenci için enrollment kontrolü
    const enrollment = db
      .prepare(
        `SELECT * FROM enrollments
         WHERE user_id = ?
         AND course_id = ?
         AND payment_status IN ('paid', 'free')`
      )
      .get(req.user.id, courseId);

    if (!enrollment) {
      return res.status(403).json({
        message: 'برای دسترسی به این کورس باید ابتدا ثبت‌نام کنید.',
      });
    }

    req.course = course;
    req.enrollment = enrollment;

    next();
  } catch (error) {
    console.error('Course access error:', error);

    return res.status(500).json({
      message: 'خطا در بررسی دسترسی به کورس.',
    });
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireTeacherOrAdmin,
  requireCourseAccess,
};
