const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Kurs forumuna erişim kontrolü
|--------------------------------------------------------------------------
| Admin:
|   - Tüm kurs forumlarına erişebilir.
|
| Teacher:
|   - Sadece kendi kursunun forumuna erişebilir.
|
| Student:
|   - Sadece paid veya free kayıtlı olduğu kursun forumuna erişebilir.
|--------------------------------------------------------------------------
*/
function requireForumCourseAccess(req, res, next) {
  try {
    const courseId =
      req.params.courseId ||
      req.courseId;

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
            'شما اجازه دسترسی به انجمن این کورس را ندارید.',
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
            'برای دسترسی به انجمن باید ابتدا در این کورس ثبت‌نام کنید.',
        });
      }

      req.course = course;
      req.enrollment = enrollment;

      return next();
    }

    return res.status(403).json({
      message:
        'شما اجازه دسترسی به انجمن این کورس را ندارید.',
    });
  } catch (error) {
    console.error(
      'Forum course access error:',
      error
    );

    return res.status(500).json({
      message:
        'خطا در بررسی دسترسی به انجمن.',
    });
  }
}

/*
|--------------------------------------------------------------------------
| Thread üzerinden kurs erişimini bul
|--------------------------------------------------------------------------
*/
function requireForumThreadAccess(req, res, next) {
  try {
    const thread = db
      .prepare(
        `
        SELECT *
        FROM forum_threads
        WHERE id = ?
        `
      )
      .get(req.params.id);

    if (!thread) {
      return res.status(404).json({
        message: 'موضوع یافت نشد.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Thread bilgisini request'e koy
    |--------------------------------------------------------------------------
    */
    req.thread = thread;

    /*
    |--------------------------------------------------------------------------
    | Course ID'yi sonraki middleware'e gönder
    |--------------------------------------------------------------------------
    */
    req.courseId = thread.course_id;

    return requireForumCourseAccess(
      req,
      res,
      next
    );
  } catch (error) {
    console.error(
      'Forum thread access error:',
      error
    );

    return res.status(500).json({
      message:
        'خطا در بررسی دسترسی به موضوع.',
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/forum/course/:courseId
|--------------------------------------------------------------------------
| Bir kursun forum konularını getirir.
|--------------------------------------------------------------------------
*/
router.get(
  '/course/:courseId',
  requireAuth,
  requireForumCourseAccess,
  (req, res) => {
    try {
      const threads = db
        .prepare(
          `
          SELECT
            t.id,
            t.course_id,
            t.user_id,
            t.title,
            t.body,
            t.created_at,
            u.full_name AS author_name,
            u.role AS author_role,

            (
              SELECT COUNT(*)
              FROM forum_replies r
              WHERE r.thread_id = t.id
            ) AS reply_count

          FROM forum_threads t

          JOIN users u
            ON u.id = t.user_id

          WHERE t.course_id = ?

          ORDER BY t.created_at DESC
          `
        )
        .all(req.params.courseId);

      return res.json(threads);
    } catch (error) {
      console.error(
        'Forum threads error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت موضوعات انجمن.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/forum/thread/:id
|--------------------------------------------------------------------------
| Bir forum konusu ve cevaplarını getirir.
|--------------------------------------------------------------------------
*/
router.get(
  '/thread/:id',
  requireAuth,
  requireForumThreadAccess,
  (req, res) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | Thread + kullanıcı bilgisi
      |--------------------------------------------------------------------------
      */
      const thread = db
        .prepare(
          `
          SELECT
            t.id,
            t.course_id,
            t.user_id,
            t.title,
            t.body,
            t.created_at,
            u.full_name AS author_name,
            u.role AS author_role

          FROM forum_threads t

          JOIN users u
            ON u.id = t.user_id

          WHERE t.id = ?
          `
        )
        .get(req.params.id);

      /*
      |--------------------------------------------------------------------------
      | Cevaplar
      |--------------------------------------------------------------------------
      */
      const replies = db
        .prepare(
          `
          SELECT
            r.id,
            r.thread_id,
            r.user_id,
            r.message,
            r.created_at,
            u.full_name AS author_name,
            u.role AS author_role

          FROM forum_replies r

          JOIN users u
            ON u.id = r.user_id

          WHERE r.thread_id = ?

          ORDER BY r.created_at ASC
          `
        )
        .all(req.params.id);

      return res.json({
        ...thread,
        replies,
      });
    } catch (error) {
      console.error(
        'Forum thread detail error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت موضوع انجمن.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/forum/course/:courseId
|--------------------------------------------------------------------------
| Yeni forum konusu oluşturur.
|
| Student:
|   Kayıtlı olduğu kursta konu açabilir.
|
| Teacher:
|   Kendi kursunda konu açabilir.
|
| Admin:
|   Her kursta konu açabilir.
|--------------------------------------------------------------------------
*/
router.post(
  '/course/:courseId',
  requireAuth,
  requireForumCourseAccess,
  (req, res) => {
    try {
      const { title, body } = req.body;

      /*
      |--------------------------------------------------------------------------
      | Başlık doğrulama
      |--------------------------------------------------------------------------
      */
      if (
        !title ||
        !String(title).trim()
      ) {
        return res.status(400).json({
          message:
            'عنوان سوال الزامی است.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Çok uzun başlıkları engelle
      |--------------------------------------------------------------------------
      */
      const cleanTitle =
        String(title).trim();

      if (cleanTitle.length > 200) {
        return res.status(400).json({
          message:
            'عنوان سوال بیش از حد طولانی است.',
        });
      }

      const cleanBody =
        body
          ? String(body).trim()
          : '';

      /*
      |--------------------------------------------------------------------------
      | Thread oluştur
      |--------------------------------------------------------------------------
      */
      const info = db
        .prepare(
          `
          INSERT INTO forum_threads (
            course_id,
            user_id,
            title,
            body
          )
          VALUES (?, ?, ?, ?)
          `
        )
        .run(
          req.params.courseId,
          req.user.id,
          cleanTitle,
          cleanBody
        );

      /*
      |--------------------------------------------------------------------------
      | Öğretmene bildirim
      |--------------------------------------------------------------------------
      | Öğretmenin kendisi konu açtıysa kendisine bildirim gitmez.
      |--------------------------------------------------------------------------
      */
      if (
        req.course.teacher_id &&
        Number(req.course.teacher_id) !==
          Number(req.user.id)
      ) {
        try {
          db.notify(
            req.course.teacher_id,
            'سوال جدید در انجمن',
            `«${cleanTitle}» در کورس «${req.course.title}»`,
            'forum'
          );
        } catch (notificationError) {
          console.error(
            'Forum notification error:',
            notificationError
          );
        }
      }

      return res.status(201).json({
        message:
          'موضوع با موفقیت ایجاد شد.',
        id:
          info.lastInsertRowid,
      });
    } catch (error) {
      console.error(
        'Create forum thread error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در ایجاد موضوع انجمن.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/forum/thread/:id/reply
|--------------------------------------------------------------------------
| Bir forum konusuna cevap verir.
|--------------------------------------------------------------------------
*/
router.post(
  '/thread/:id/reply',
  requireAuth,
  requireForumThreadAccess,
  (req, res) => {
    try {
      const { message } = req.body;

      /*
      |--------------------------------------------------------------------------
      | Mesaj doğrulama
      |--------------------------------------------------------------------------
      */
      if (
        !message ||
        !String(message).trim()
      ) {
        return res.status(400).json({
          message:
            'متن پاسخ الزامی است.',
        });
      }

      const cleanMessage =
        String(message).trim();

      /*
      |--------------------------------------------------------------------------
      | Aşırı uzun cevap engeli
      |--------------------------------------------------------------------------
      */
      if (cleanMessage.length > 5000) {
        return res.status(400).json({
          message:
            'متن پاسخ بیش از حد طولانی است.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Cevabı kaydet
      |--------------------------------------------------------------------------
      */
      const info = db
        .prepare(
          `
          INSERT INTO forum_replies (
            thread_id,
            user_id,
            message
          )
          VALUES (?, ?, ?)
          `
        )
        .run(
          req.params.id,
          req.user.id,
          cleanMessage
        );

      /*
      |--------------------------------------------------------------------------
      | Konuyu açan kullanıcıya bildirim
      |--------------------------------------------------------------------------
      */
      if (
        Number(req.thread.user_id) !==
        Number(req.user.id)
      ) {
        try {
          db.notify(
            req.thread.user_id,
            'پاسخ جدید به سوال شما',
            `به «${req.thread.title}» پاسخ داده شد.`,
            'forum'
          );
        } catch (notificationError) {
          console.error(
            'Reply notification error:',
            notificationError
          );
        }
      }

      return res.status(201).json({
        message:
          'پاسخ با موفقیت ثبت شد.',
        id:
          info.lastInsertRowid,
      });
    } catch (error) {
      console.error(
        'Forum reply error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در ثبت پاسخ.',
      });
    }
  }
);

module.exports = router;