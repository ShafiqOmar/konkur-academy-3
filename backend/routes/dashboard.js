const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET /api/dashboard
|--------------------------------------------------------------------------
| Öğrenci dashboard'u.
|
| Sadece student kullanabilir.
| Sadece erişim hakkı olan:
|   - paid
|   - free
|
| kurslar dashboard'da gösterilir.
|--------------------------------------------------------------------------
*/
router.get('/', requireAuth, (req, res) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | Sadece öğrenci dashboard'u
    |--------------------------------------------------------------------------
    */
    if (req.user.role !== 'student') {
      return res.status(403).json({
        message: 'این بخش فقط برای شاگردان قابل دسترسی است.',
      });
    }

    const userId = req.user.id;

    /*
    |--------------------------------------------------------------------------
    | Sadece gerçekten erişilebilir kursları getir
    |--------------------------------------------------------------------------
    */
    const enrollments = db
      .prepare(
        `
        SELECT
          c.id,
          c.title,
          c.subject,
          c.cover_color,
          e.payment_status
        FROM enrollments e

        JOIN courses c
          ON c.id = e.course_id

        WHERE e.user_id = ?
          AND e.payment_status IN ('paid', 'free')

        ORDER BY e.created_at DESC
        `
      )
      .all(userId);

    /*
    |--------------------------------------------------------------------------
    | Kurs ilerlemeleri
    |--------------------------------------------------------------------------
    */
    const courses = enrollments.map((course) => {
      const totalVideos = db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM videos
          WHERE course_id = ?
          `
        )
        .get(course.id).count;

      const watchedVideos = db
        .prepare(
          `
          SELECT COUNT(DISTINCT vp.video_id) AS count

          FROM video_progress vp

          JOIN videos v
            ON v.id = vp.video_id

          WHERE vp.user_id = ?
            AND v.course_id = ?
            AND vp.completed = 1
          `
        )
        .get(
          userId,
          course.id
        ).count;

      /*
      |--------------------------------------------------------------------------
      | Yüzde hesaplama
      |--------------------------------------------------------------------------
      */
      const progressPercent =
        totalVideos > 0
          ? Math.min(
              100,
              Math.round(
                (watchedVideos / totalVideos) * 100
              )
            )
          : 0;

      return {
        ...course,
        totalVideos,
        watchedVideos,
        progressPercent,
      };
    });

    /*
    |--------------------------------------------------------------------------
    | Test sonuçları
    |--------------------------------------------------------------------------
    | Sadece halen erişimi olan kursların test sonuçları gösterilir.
    |--------------------------------------------------------------------------
    */
    const testResults = db
      .prepare(
        `
        SELECT
          tr.id,
          tr.score,
          tr.total,
          tr.taken_at,

          t.id AS test_id,
          t.title AS test_title,

          c.id AS course_id,
          c.title AS course_title

        FROM test_results tr

        JOIN tests t
          ON t.id = tr.test_id

        JOIN courses c
          ON c.id = t.course_id

        JOIN enrollments e
          ON e.course_id = c.id
         AND e.user_id = tr.user_id

        WHERE tr.user_id = ?
          AND e.payment_status IN ('paid', 'free')

        ORDER BY tr.taken_at DESC
        `
      )
      .all(userId);

    /*
    |--------------------------------------------------------------------------
    | Genel ilerleme
    |--------------------------------------------------------------------------
    */
    const overallProgress =
      courses.length > 0
        ? Math.round(
            courses.reduce(
              (sum, course) =>
                sum + course.progressPercent,
              0
            ) / courses.length
          )
        : 0;

    /*
    |--------------------------------------------------------------------------
    | Kullanıcı puanı
    |--------------------------------------------------------------------------
    */
    const me = db
      .prepare(
        `
        SELECT
          points,
          branch_id
        FROM users
        WHERE id = ?
        `
      )
      .get(userId);

    if (!me) {
      return res.status(404).json({
        message: 'کاربر یافت نشد.',
      });
    }

    const userPoints =
      Number(me.points) || 0;

    /*
    |--------------------------------------------------------------------------
    | Leaderboard rank
    |--------------------------------------------------------------------------
    */
    const higherRankedStudents = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'student'
          AND COALESCE(points, 0) > ?
        `
      )
      .get(userPoints).count;

    const rank =
      higherRankedStudents + 1;

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */
    return res.json({
      courses,
      testResults,
      overallProgress,

      points:
        userPoints,

      rank,
    });
  } catch (error) {
    console.error(
      'Dashboard error:',
      error
    );

    return res.status(500).json({
      message:
        'خطا در دریافت اطلاعات داشبورد.',
    });
  }
});

module.exports = router;