const express = require('express');
const db = require('../db');

const {
  requireAuth,
  requireTeacherOrAdmin,
} = require('../middleware/auth');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET /api/courses
|--------------------------------------------------------------------------
| Tüm kursların herkese açık listesi.
| ?branch_id= ile filtrelenebilir.
|--------------------------------------------------------------------------
*/
router.get('/', (req, res) => {
  try {
    const { branch_id } = req.query;

    let courses;

    if (branch_id) {
      courses = db
        .prepare(
          `
          SELECT
            c.*,
            b.title AS branch_title,
            u.full_name AS teacher_name
          FROM courses c
          LEFT JOIN branches b
            ON b.id = c.branch_id
          LEFT JOIN users u
            ON u.id = c.teacher_id
          WHERE c.branch_id = ?
          ORDER BY c.created_at DESC
          `
        )
        .all(branch_id);
    } else {
      courses = db
        .prepare(
          `
          SELECT
            c.*,
            b.title AS branch_title,
            u.full_name AS teacher_name
          FROM courses c
          LEFT JOIN branches b
            ON b.id = c.branch_id
          LEFT JOIN users u
            ON u.id = c.teacher_id
          ORDER BY c.created_at DESC
          `
        )
        .all();
    }

    return res.json(courses);
  } catch (error) {
    console.error('Course list error:', error);

    return res.status(500).json({
      message: 'خطا در دریافت لیست کورس‌ها.',
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/courses/mine
|--------------------------------------------------------------------------
| Öğretmenin kendi kursları.
| Admin için tüm kurslar döndürülür.
|
| DİKKAT:
| Bu route /:id route'undan önce olmalı.
|--------------------------------------------------------------------------
*/
router.get(
  '/mine',
  requireAuth,
  requireTeacherOrAdmin,
  (req, res) => {
    try {
      let courses;

      if (req.user.role === 'admin') {
        courses = db
          .prepare(
            `
            SELECT
              c.*,
              u.full_name AS teacher_name
            FROM courses c
            LEFT JOIN users u
              ON u.id = c.teacher_id
            ORDER BY c.created_at DESC
            `
          )
          .all();
      } else {
        courses = db
          .prepare(
            `
            SELECT *
            FROM courses
            WHERE teacher_id = ?
            ORDER BY created_at DESC
            `
          )
          .all(req.user.id);
      }

      return res.json(courses);
    } catch (error) {
      console.error('My courses error:', error);

      return res.status(500).json({
        message: 'خطا در دریافت کورس‌ها.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/courses/:id
|--------------------------------------------------------------------------
| Herkese açık kurs detayları.
|
| Burada video URL'si DÖNDÜRÜLMÜYOR.
| Sadece müfredatın başlık bilgileri gösteriliyor.
|
| Gerçek video içeriği:
| GET /api/videos/:id
|
| üzerinden alınır ve orada erişim kontrolü vardır.
|--------------------------------------------------------------------------
*/
router.get('/:id', (req, res) => {
  try {
    const course = db
      .prepare(
        `
        SELECT
          c.*,
          b.title AS branch_title,
          u.full_name AS teacher_name
        FROM courses c
        LEFT JOIN branches b
          ON b.id = c.branch_id
        LEFT JOIN users u
          ON u.id = c.teacher_id
        WHERE c.id = ?
        `
      )
      .get(req.params.id);

    if (!course) {
      return res.status(404).json({
        message: 'کورس یافت نشد.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Video listesi
    |--------------------------------------------------------------------------
    | URL özellikle gönderilmiyor.
    |--------------------------------------------------------------------------
    */
    const videos = db
      .prepare(
        `
        SELECT
          id,
          title,
          duration_seconds,
          sort_order
        FROM videos
        WHERE course_id = ?
        ORDER BY sort_order ASC, id ASC
        `
      )
      .all(req.params.id);

    /*
    |--------------------------------------------------------------------------
    | Test listesi
    |--------------------------------------------------------------------------
    | Sorular/cevaplar burada gönderilmiyor.
    |--------------------------------------------------------------------------
    */
    const tests = db
      .prepare(
        `
        SELECT
          id,
          title
        FROM tests
        WHERE course_id = ?
        ORDER BY id ASC
        `
      )
      .all(req.params.id);

    return res.json({
      ...course,
      videos,
      tests,
    });
  } catch (error) {
    console.error('Course detail error:', error);

    return res.status(500).json({
      message: 'خطا در دریافت جزئیات کورس.',
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/courses/:id/enrollment
|--------------------------------------------------------------------------
| Kullanıcının bu kursa erişim durumunu kontrol eder.
|
| Yeni güvenlik kuralımız:
|
| paid  => erişim var
| free  => erişim var
| pending => erişim yok
| kayıt yok => erişim yok
|--------------------------------------------------------------------------
*/
router.get(
  '/:id/enrollment',
  requireAuth,
  (req, res) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | Önce kurs gerçekten var mı?
      |--------------------------------------------------------------------------
      */
      const course = db
        .prepare(
          `
          SELECT id, teacher_id
          FROM courses
          WHERE id = ?
          `
        )
        .get(req.params.id);

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
        return res.json({
          enrolled: true,
          status: 'admin',
          accessGranted: true,
          paymentId: null,
          paymentRef: null,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Kursun öğretmeni
      |--------------------------------------------------------------------------
      */
      if (
        req.user.role === 'teacher' &&
        Number(course.teacher_id) === Number(req.user.id)
      ) {
        return res.json({
          enrolled: true,
          status: 'teacher',
          accessGranted: true,
          paymentId: null,
          paymentRef: null,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Başka öğretmen
      |--------------------------------------------------------------------------
      */
      if (req.user.role === 'teacher') {
        return res.json({
          enrolled: false,
          status: null,
          accessGranted: false,
          paymentId: null,
          paymentRef: null,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Student enrollment
      |--------------------------------------------------------------------------
      */
      const enrollment = db
        .prepare(
          `
          SELECT *
          FROM enrollments
          WHERE user_id = ?
            AND course_id = ?
          `
        )
        .get(
          req.user.id,
          req.params.id
        );

      if (!enrollment) {
        return res.json({
          enrolled: false,
          status: null,
          accessGranted: false,
          paymentId: null,
          paymentRef: null,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Gerçek erişim kontrolü
      |--------------------------------------------------------------------------
      */
      const accessGranted =
        enrollment.payment_status === 'paid' ||
        enrollment.payment_status === 'free';

      /*
      |--------------------------------------------------------------------------
      | Pending ödeme varsa son ödeme kaydını bul
      |--------------------------------------------------------------------------
      */
      let payment = null;

      if (enrollment.payment_status === 'pending') {
        payment = db
          .prepare(
            `
            SELECT
              id,
              provider_payment_id
            FROM payments
            WHERE user_id = ?
              AND course_id = ?
              AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
            `
          )
          .get(
            req.user.id,
            req.params.id
          );
      }

      return res.json({
        enrolled: true,

        status:
          enrollment.payment_status,

        accessGranted,

        paymentId:
          payment?.id || null,

        paymentRef:
          payment?.provider_payment_id || null,
      });
    } catch (error) {
      console.error(
        'Enrollment check error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در بررسی وضعیت ثبت‌نام.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/courses/:id/students
|--------------------------------------------------------------------------
| Kursa kayıtlı öğrenciler.
|
| Admin:
|   Her kursu görebilir.
|
| Teacher:
|   Sadece kendi kursundaki öğrencileri görebilir.
|--------------------------------------------------------------------------
*/
router.get(
  '/:id/students',
  requireAuth,
  requireTeacherOrAdmin,
  (req, res) => {
    try {
      const course = db
        .prepare(
          `
          SELECT *
          FROM courses
          WHERE id = ?
          `
        )
        .get(req.params.id);

      if (!course) {
        return res.status(404).json({
          message: 'کورس یافت نشد.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Öğretmen sadece kendi kursunu görebilir
      |--------------------------------------------------------------------------
      */
      if (
        req.user.role === 'teacher' &&
        Number(course.teacher_id) !== Number(req.user.id)
      ) {
        return res.status(403).json({
          message: 'این کورس متعلق به شما نیست.',
        });
      }

      const students = db
        .prepare(
          `
          SELECT
            u.id,
            u.full_name,
            u.email,
            e.payment_status,
            e.created_at AS enrolled_at
          FROM enrollments e
          JOIN users u
            ON u.id = e.user_id
          WHERE e.course_id = ?
          ORDER BY e.created_at DESC
          `
        )
        .all(req.params.id);

      return res.json(students);
    } catch (error) {
      console.error(
        'Course students error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت لیست شاگردان.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/courses
|--------------------------------------------------------------------------
| Yeni kurs oluşturma.
|
| Admin:
|   İstediği öğretmene kurs atayabilir.
|
| Teacher:
|   Yalnızca kendisi için kurs oluşturabilir.
|--------------------------------------------------------------------------
*/
router.post(
  '/',
  requireAuth,
  requireTeacherOrAdmin,
  (req, res) => {
    try {
      const {
        title,
        description,
        subject,
        branch_id,
        price,
        price_usd,
        cover_color,
      } = req.body;

      let { teacher_id } = req.body;

      /*
      |--------------------------------------------------------------------------
      | Başlık zorunlu
      |--------------------------------------------------------------------------
      */
      if (
        !title ||
        !String(title).trim()
      ) {
        return res.status(400).json({
          message: 'عنوان کورس الزامی است.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Öğretmen kursu kendine oluşturur
      |--------------------------------------------------------------------------
      */
      if (req.user.role === 'teacher') {
        teacher_id = req.user.id;
      }

      /*
      |--------------------------------------------------------------------------
      | Fiyat doğrulama
      |--------------------------------------------------------------------------
      */
      const numericPrice =
        Number(price) || 0;

      if (numericPrice < 0) {
        return res.status(400).json({
          message:
            'قیمت کورس نمی‌تواند منفی باشد.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Kart ile ödeme (Stripe) için ayrı dolar fiyatı — isteğe bağlı
      |--------------------------------------------------------------------------
      | AFN Stripe'ta desteklenmediği için otomatik dönüştürülemez؛ boş
      | bırakılırsa پرداخت با کارت برای این کورس غیرفعال می‌ماند.
      |--------------------------------------------------------------------------
      */
      let numericPriceUsd = null;

      if (price_usd !== undefined && price_usd !== null && price_usd !== '') {
        numericPriceUsd = Number(price_usd);

        if (!Number.isFinite(numericPriceUsd) || numericPriceUsd < 0) {
          return res.status(400).json({
            message: 'قیمت دالری کورس نامعتبر است.',
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Admin öğretmen seçmişse kullanıcıyı doğrula
      |--------------------------------------------------------------------------
      */
      if (
        req.user.role === 'admin' &&
        teacher_id
      ) {
        const teacher = db
          .prepare(
            `
            SELECT id
            FROM users
            WHERE id = ?
              AND role = 'teacher'
            `
          )
          .get(teacher_id);

        if (!teacher) {
          return res.status(400).json({
            message:
              'استاد انتخاب‌شده معتبر نیست.',
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Branch doğrulama
      |--------------------------------------------------------------------------
      */
      if (branch_id) {
        const branch = db
          .prepare(
            `
            SELECT id
            FROM branches
            WHERE id = ?
            `
          )
          .get(branch_id);

        if (!branch) {
          return res.status(400).json({
            message:
              'رشته انتخاب‌شده معتبر نیست.',
          });
        }
      }

      const info = db
        .prepare(
          `
          INSERT INTO courses (
            title,
            description,
            subject,
            branch_id,
            teacher_id,
            price,
            price_usd,
            cover_color
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          String(title).trim(),
          description || '',
          subject || '',
          branch_id || null,
          teacher_id || null,
          numericPrice,
          numericPriceUsd,
          cover_color || '#2D4263'
        );

      return res.status(201).json({
        message:
          'کورس با موفقیت ساخته شد.',

        id:
          info.lastInsertRowid,
      });
    } catch (error) {
      console.error(
        'Course creation error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در ساخت کورس.',
      });
    }
  }
);

module.exports = router;