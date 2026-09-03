const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const {
  requireAuth,
  requireTeacherOrAdmin,
} = require('../middleware/auth');
const {
  isBunnyConfigured,
  createBunnyVideo,
  uploadBunnyVideoBuffer,
  getBunnyEmbedUrl,
} = require('../services/bunnyStream');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Video erişim kontrolü
|--------------------------------------------------------------------------
| Admin:
|   - Tüm videolara erişebilir.
|
| Teacher:
|   - Sadece kendi kursundaki videolara erişebilir.
|
| Student:
|   - Sadece kayıtlı olduğu ve payment_status değeri
|     "paid" veya "free" olan kursların videolarına erişebilir.
|--------------------------------------------------------------------------
*/
function requireVideoAccess(req, res, next) {
  try {
    const video = db
      .prepare('SELECT * FROM videos WHERE id = ?')
      .get(req.params.id);

    if (!video) {
      return res.status(404).json({
        message: 'ویدیو یافت نشد.',
      });
    }

    const course = db
      .prepare('SELECT * FROM courses WHERE id = ?')
      .get(video.course_id);

    if (!course) {
      return res.status(404).json({
        message: 'کورس مربوط به این ویدیو یافت نشد.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Admin
    |--------------------------------------------------------------------------
    */
    if (req.user.role === 'admin') {
      req.video = video;
      req.course = course;

      return next();
    }

    /*
    |--------------------------------------------------------------------------
    | Teacher
    |--------------------------------------------------------------------------
    */
    if (req.user.role === 'teacher') {
      if (Number(course.teacher_id) !== Number(req.user.id)) {
        return res.status(403).json({
          message: 'شما اجازه دسترسی به این ویدیو را ندارید.',
        });
      }

      req.video = video;
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
        .get(req.user.id, video.course_id);

      if (!enrollment) {
        return res.status(403).json({
          message:
            'برای مشاهده این ویدیو باید ابتدا در کورس ثبت‌نام کنید یا پرداخت شما تایید شده باشد.',
        });
      }

      req.video = video;
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
      message: 'شما اجازه دسترسی به این ویدیو را ندارید.',
    });
  } catch (error) {
    console.error('Video access error:', error);

    return res.status(500).json({
      message: 'خطا در بررسی دسترسی به ویدیو.',
    });
  }
}

/*
|--------------------------------------------------------------------------
| Multer video upload ayarları
|--------------------------------------------------------------------------
*/
// اگر Bunny Stream پیکربندی شده باشد، فایل در حافظه نگه‌داشته می‌شود تا
// مستقیم به Bunny فرستاده شود (روی دیسک سرور ذخیره نمی‌شود). در غیر این
// صورت رفتار قبلی (ذخیره روی دیسک محلی زیر backend/uploads) ادامه دارد.
const storage = isBunnyConfigured()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: path.join(__dirname, '..', 'uploads'),

      filename: (req, file, cb) => {
        const unique =
          Date.now() + '-' + Math.round(Math.random() * 1e9);

        cb(
          null,
          unique + path.extname(file.originalname)
        );
      },
    });

const upload = multer({
  storage,

  // Maksimum 500 MB
  limits: {
    fileSize: 500 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(
        new Error('فقط آپلود فایل ویدیویی مجاز است.')
      );
    }

    cb(null, true);
  },
});

/*
|--------------------------------------------------------------------------
| GET /api/videos/:id
|--------------------------------------------------------------------------
| Belirli bir videonun detayını getirir.
| Öğrencinin kursa erişim hakkı olması gerekir.
|--------------------------------------------------------------------------
*/
router.get(
  '/:id',
  requireAuth,
  requireVideoAccess,
  (req, res) => {
    try {
      let progress = {
        watched_seconds: 0,
        completed: 0,
      };

      /*
      |--------------------------------------------------------------------------
      | Progress sadece öğrenci için anlamlı
      |--------------------------------------------------------------------------
      */
      if (req.user.role === 'student') {
        const savedProgress = db
          .prepare(
            `
            SELECT watched_seconds, completed
            FROM video_progress
            WHERE user_id = ?
              AND video_id = ?
            `
          )
          .get(
            req.user.id,
            req.video.id
          );

        if (savedProgress) {
          progress = savedProgress;
        }
      }

      return res.json({
        ...req.video,
        progress,
      });
    } catch (error) {
      console.error(
        'Video detail error:',
        error
      );

      return res.status(500).json({
        message: 'خطا در دریافت ویدیو.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/videos/upload/:courseId
|--------------------------------------------------------------------------
| Yeni video yükleme
|
| Admin:
|   - Her kursa yükleyebilir.
|
| Teacher:
|   - Sadece kendi kursuna yükleyebilir.
|--------------------------------------------------------------------------
*/
router.post(
  '/upload/:courseId',
  requireAuth,
  requireTeacherOrAdmin,
  upload.single('video'),
  async (req, res) => {
    try {
      const course = db
        .prepare(
          'SELECT * FROM courses WHERE id = ?'
        )
        .get(req.params.courseId);

      if (!course) {
        return res.status(404).json({
          message: 'کورس یافت نشد.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Teacher kendi kursuna mı video yüklüyor?
      |--------------------------------------------------------------------------
      */
      if (
        req.user.role === 'teacher' &&
        Number(course.teacher_id) !==
          Number(req.user.id)
      ) {
        return res.status(403).json({
          message: 'این کورس متعلق به شما نیست.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: 'فایل ویدیو ارسال نشده است.',
        });
      }

      const { title, sort_order } = req.body;

      const sortOrder =
        Number(sort_order) || 0;

      const videoTitle = title || req.file.originalname;

      let url;
      let bunnyVideoId = null;

      if (isBunnyConfigured()) {
        try {
          const bunnyVideo = await createBunnyVideo(videoTitle);
          await uploadBunnyVideoBuffer(bunnyVideo.guid, req.file.buffer);
          url = getBunnyEmbedUrl(bunnyVideo.guid);
          bunnyVideoId = bunnyVideo.guid;
        } catch (bunnyError) {
          console.error('Bunny Stream upload error:', bunnyError);
          return res.status(502).json({
            message: 'خطا در آپلود ویدیو به Bunny Stream.',
          });
        }
      } else {
        url = `/uploads/${req.file.filename}`;
      }

      /*
      |--------------------------------------------------------------------------
      | Video kaydet
      |--------------------------------------------------------------------------
      */
      const info = db
        .prepare(
          `
          INSERT INTO videos (
            course_id,
            title,
            url,
            duration_seconds,
            sort_order,
            bunny_video_id
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          req.params.courseId,
          videoTitle,
          url,
          0,
          sortOrder,
          bunnyVideoId
        );

      /*
      |--------------------------------------------------------------------------
      | Sadece aktif erişimi olan öğrencilere bildirim gönder
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
        .all(req.params.courseId);

      for (const student of students) {
        try {
          db.notify(
            student.user_id,
            'درس جدید اضافه شد',
            `ویدیوی «${videoTitle}» در کورس «${course.title}» اضافه شد.`,
            'info'
          );
        } catch (notificationError) {
          console.error(
            'Notification error:',
            notificationError
          );
        }
      }

      return res.status(201).json({
        message: 'ویدیو با موفقیت آپلود شد.',
        id: info.lastInsertRowid,
        url,
      });
    } catch (error) {
      console.error(
        'Video upload error:',
        error
      );

      return res.status(500).json({
        message: 'خطا در آپلود ویدیو.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/videos/:id/progress
|--------------------------------------------------------------------------
| Öğrencinin video izleme ilerlemesini kaydeder.
|--------------------------------------------------------------------------
*/
router.post(
  '/:id/progress',
  requireAuth,
  requireVideoAccess,
  (req, res) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | Teacher ve admin progress kaydedemez
      |--------------------------------------------------------------------------
      */
      if (req.user.role !== 'student') {
        return res.status(403).json({
          message:
            'ثبت پیشرفت فقط برای شاگرد مجاز است.',
        });
      }

      const watchedSeconds =
        Math.max(
          0,
          Number(req.body.watched_seconds) || 0
        );

      const completed =
        req.body.completed ? 1 : 0;

      db.prepare(
        `
        INSERT INTO video_progress (
          user_id,
          video_id,
          watched_seconds,
          completed
        )
        VALUES (?, ?, ?, ?)

        ON CONFLICT(user_id, video_id)
        DO UPDATE SET
          watched_seconds =
            excluded.watched_seconds,
          completed =
            excluded.completed
        `
      ).run(
        req.user.id,
        req.video.id,
        watchedSeconds,
        completed
      );

      return res.json({
        ok: true,
        watched_seconds: watchedSeconds,
        completed,
      });
    } catch (error) {
      console.error(
        'Video progress error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در ثبت پیشرفت ویدیو.',
      });
    }
  }
);

module.exports = router;