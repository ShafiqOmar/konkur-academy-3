const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const {
  requireAuth,
  requireTeacherOrAdmin,
} = require('../middleware/auth');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Canlı ders kurs erişim kontrolü
|--------------------------------------------------------------------------
| Admin:
|   - Tüm kursların canlı derslerine erişebilir.
|
| Teacher:
|   - Sadece kendi kursundaki canlı derslere erişebilir.
|
| Student:
|   - Sadece payment_status = paid veya free olan kursların
|     canlı derslerine erişebilir.
|--------------------------------------------------------------------------
*/
function requireLiveCourseAccess(req, res, next) {
  try {
    const courseId =
      req.params.courseId ||
      req.body.course_id;

    if (!courseId) {
      return res.status(400).json({
        message: 'کورس مشخص نشده است.',
      });
    }

    const course = db
      .prepare(
        `
        SELECT *
        FROM courses
        WHERE id = ?
        `
      )
      .get(courseId);

    if (!course) {
      return res.status(404).json({
        message: 'کورس یافت نشد.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Admin
    |--------------------------------------------------------------------------
    */
    if (req.user.role === 'admin') {
      req.course = course;

      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | Teacher
    |--------------------------------------------------------------------------
    */
    if (req.user.role === 'teacher') {
      if (
        Number(course.teacher_id) !==
        Number(req.user.id)
      ) {
        return res.status(403).json({
          message:
            'شما اجازه دسترسی به کلاس‌های زنده این کورس را ندارید.',
        });
      }

      req.course = course;

      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | Student
    |--------------------------------------------------------------------------
    */
    if (req.user.role === 'student') {
      const enrollment = db
        .prepare(
          `
          SELECT *
          FROM enrollments
          WHERE user_id = ?
            AND course_id = ?
            AND payment_status IN ('paid', 'free')
          `
        )
        .get(
          req.user.id,
          courseId
        );

      if (!enrollment) {
        return res.status(403).json({
          message:
            'برای دسترسی به کلاس زنده باید ابتدا در این کورس ثبت‌نام کنید.',
        });
      }

      req.course = course;
      req.enrollment = enrollment;

      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | Bilinmeyen rol
    |--------------------------------------------------------------------------
    */
    return res.status(403).json({
      message:
        'شما اجازه دسترسی به کلاس زنده را ندارید.',
    });
  } catch (error) {
    console.error(
      'Live course access error:',
      error
    );

    return res.status(500).json({
      message:
        'خطا در بررسی دسترسی به کلاس زنده.',
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/live/course/:courseId
|--------------------------------------------------------------------------
| Bir kursun canlı derslerini getirir.
|
| Student:
|   Sadece kayıtlı olduğu paid/free kursta görebilir.
|
| Teacher:
|   Sadece kendi kursunda görebilir.
|
| Admin:
|   Her kursta görebilir.
|--------------------------------------------------------------------------
*/
router.get(
  '/course/:courseId',
  requireAuth,
  requireLiveCourseAccess,
  (req, res) => {
    try {
      const sessions = db
        .prepare(
          `
          SELECT
            id,
            course_id,
            title,
            room_name,
            scheduled_at,
            created_by
          FROM live_sessions
          WHERE course_id = ?
          ORDER BY scheduled_at DESC
          `
        )
        .all(req.params.courseId);

      return res.json(sessions);
    } catch (error) {
      console.error(
        'Live sessions error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت کلاس‌های زنده.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/live
|--------------------------------------------------------------------------
| Yeni canlı ders oluşturur.
|
| Admin:
|   Her kursa canlı ders oluşturabilir.
|
| Teacher:
|   Sadece kendi kursuna oluşturabilir.
|--------------------------------------------------------------------------
*/
router.post(
  '/',
  requireAuth,
  requireTeacherOrAdmin,
  requireLiveCourseAccess,
  (req, res) => {
    try {
      const {
        course_id,
        title,
        scheduled_at,
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | Zorunlu alanlar
      |--------------------------------------------------------------------------
      */
      if (
        !course_id ||
        !title ||
        !String(title).trim() ||
        !scheduled_at
      ) {
        return res.status(400).json({
          message:
            'کورس، عنوان و زمان جلسه الزامی است.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Tarih doğrulama
      |--------------------------------------------------------------------------
      */
      const scheduledDate =
        new Date(scheduled_at);

      if (
        Number.isNaN(
          scheduledDate.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            'زمان جلسه معتبر نیست.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Geçmiş tarih kontrolü
      |--------------------------------------------------------------------------
      */
      if (
        scheduledDate.getTime() <
        Date.now()
      ) {
        return res.status(400).json({
          message:
            'زمان کلاس زنده نمی‌تواند در گذشته باشد.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Benzersiz Jitsi room name
      |--------------------------------------------------------------------------
      */
      const roomName =
        `konkur-${course_id}-${crypto
          .randomBytes(16)
          .toString('hex')}`;

      /*
      |--------------------------------------------------------------------------
      | Canlı dersi oluştur
      |--------------------------------------------------------------------------
      */
      const info = db
        .prepare(
          `
          INSERT INTO live_sessions (
            course_id,
            title,
            room_name,
            scheduled_at,
            created_by
          )
          VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(
          course_id,
          String(title).trim(),
          roomName,
          scheduled_at,
          req.user.id
        );

      /*
      |--------------------------------------------------------------------------
      | Sadece erişim hakkı olan öğrencilere bildirim gönder
      |--------------------------------------------------------------------------
      */
      const students = db
        .prepare(
          `
          SELECT user_id
          FROM enrollments
          WHERE course_id = ?
            AND payment_status IN ('paid', 'free')
          `
        )
        .all(course_id);

      for (const student of students) {
        try {
          db.notify(
            student.user_id,
            'کلاس آنلاین زنده جدید',
            `کلاس «${String(title).trim()}» برای کورس «${req.course.title}» برنامه‌ریزی شد.`,
            'live'
          );
        } catch (notificationError) {
          console.error(
            'Live notification error:',
            notificationError
          );
        }
      }

      return res.status(201).json({
        message:
          'کلاس زنده با موفقیت ایجاد شد.',

        id:
          info.lastInsertRowid,

        room_name:
          roomName,
      });
    } catch (error) {
      console.error(
        'Create live session error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در ساخت کلاس زنده.',
      });
    }
  }
);

module.exports = router;