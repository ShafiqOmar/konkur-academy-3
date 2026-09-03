const express = require('express');
const db = require('../db');
const {
  requireAuth,
  requireTeacherOrAdmin,
} = require('../middleware/auth');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Test erişim kontrolü
|--------------------------------------------------------------------------
| Admin:
|   - Tüm testlere erişebilir.
|
| Teacher:
|   - Sadece kendi kursundaki testlere erişebilir.
|
| Student:
|   - Sadece payment_status = paid veya free olan kursların testlerine erişebilir.
|--------------------------------------------------------------------------
*/
function requireTestAccess(req, res, next) {
  try {
    const test = db
      .prepare('SELECT * FROM tests WHERE id = ?')
      .get(req.params.id);

    if (!test) {
      return res.status(404).json({
        message: 'آزمون یافت نشد.',
      });
    }

    const course = db
      .prepare('SELECT * FROM courses WHERE id = ?')
      .get(test.course_id);

    if (!course) {
      return res.status(404).json({
        message: 'کورس مربوط به آزمون یافت نشد.',
      });
    }

    // Admin
    if (req.user.role === 'admin') {
      req.test = test;
      req.course = course;
      return next();
    }

    // Teacher
    if (req.user.role === 'teacher') {
      if (Number(course.teacher_id) !== Number(req.user.id)) {
        return res.status(403).json({
          message: 'شما اجازه دسترسی به این آزمون را ندارید.',
        });
      }

      req.test = test;
      req.course = course;
      return next();
    }

    // Student
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
        .get(req.user.id, test.course_id);

      if (!enrollment) {
        return res.status(403).json({
          message:
            'برای شرکت در این آزمون باید ابتدا در کورس ثبت‌نام کنید.',
        });
      }

      req.test = test;
      req.course = course;
      req.enrollment = enrollment;

      return next();
    }

    return res.status(403).json({
      message: 'شما اجازه دسترسی به این آزمون را ندارید.',
    });
  } catch (error) {
    console.error('Test access error:', error);

    return res.status(500).json({
      message: 'خطا در بررسی دسترسی به آزمون.',
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/tests/:id
|--------------------------------------------------------------------------
| Test sorularını getirir.
| Doğru cevap kesinlikle frontend'e gönderilmez.
|--------------------------------------------------------------------------
*/
router.get(
  '/:id',
  requireAuth,
  requireTestAccess,
  (req, res) => {
    try {
      const questions = db
        .prepare(
          `
          SELECT
            id,
            question_text,
            options
          FROM questions
          WHERE test_id = ?
          ORDER BY id ASC
          `
        )
        .all(req.test.id)
        .map((question) => {
          let options = [];

          try {
            options = JSON.parse(question.options);
          } catch (error) {
            console.error(
              'Question options parse error:',
              question.id,
              error
            );
          }

          return {
            ...question,
            options,
          };
        });

      return res.json({
        id: req.test.id,
        course_id: req.test.course_id,
        title: req.test.title,
        questions,
      });
    } catch (error) {
      console.error('Get test error:', error);

      return res.status(500).json({
        message: 'خطا در دریافت آزمون.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/tests/:id/submit
|--------------------------------------------------------------------------
| Test cevaplarını gönderir.
|
| Önemli:
| - Sadece student submit edebilir.
| - Kullanıcı kursa erişiyor olmalı.
| - Aynı testten sadece ilk denemede leaderboard puanı kazanır.
|--------------------------------------------------------------------------
*/
router.post(
  '/:id/submit',
  requireAuth,
  requireTestAccess,
  (req, res) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({
          message: 'ارسال پاسخ آزمون فقط برای شاگرد مجاز است.',
        });
      }

      const { answers } = req.body;

      if (!Array.isArray(answers)) {
        return res.status(400).json({
          message: 'فرمت پاسخ‌ها نادرست است.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Soruları al
      |--------------------------------------------------------------------------
      */
      const questions = db
        .prepare(
          `
          SELECT
            id,
            correct_index
          FROM questions
          WHERE test_id = ?
          `
        )
        .all(req.test.id);

      if (questions.length === 0) {
        return res.status(400).json({
          message: 'این آزمون هیچ سوالی ندارد.',
        });
      }

      const correctMap = new Map(
        questions.map((question) => [
          Number(question.id),
          Number(question.correct_index),
        ])
      );

      /*
      |--------------------------------------------------------------------------
      | Cevapları hesapla
      |--------------------------------------------------------------------------
      */
      let score = 0;

      const sanitizedAnswers = [];

      for (const answer of answers) {
        const questionId = Number(answer.question_id);
        const selectedIndex = Number(answer.selected_index);

        if (!correctMap.has(questionId)) {
          continue;
        }

        sanitizedAnswers.push({
          question_id: questionId,
          selected_index: selectedIndex,
        });

        if (
          correctMap.get(questionId) === selectedIndex
        ) {
          score += 1;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Kullanıcının bu testi daha önce çözüp çözmediğini kontrol et
      |--------------------------------------------------------------------------
      */
      const previousResult = db
        .prepare(
          `
          SELECT
            id,
            score,
            total
          FROM test_results
          WHERE user_id = ?
            AND test_id = ?
          ORDER BY id ASC
          LIMIT 1
          `
        )
        .get(
          req.user.id,
          req.test.id
        );

      /*
      |--------------------------------------------------------------------------
      | Yeni test sonucu kaydet
      |--------------------------------------------------------------------------
      */
      const resultInfo = db
        .prepare(
          `
          INSERT INTO test_results (
            user_id,
            test_id,
            score,
            total,
            answers
          )
          VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(
          req.user.id,
          req.test.id,
          score,
          questions.length,
          JSON.stringify(sanitizedAnswers)
        );

      /*
      |--------------------------------------------------------------------------
      | Leaderboard puanı
      |--------------------------------------------------------------------------
      |
      | İlk deneme:
      |   Her doğru cevap = 10 puan
      |
      | Sonraki denemeler:
      |   0 yeni puan
      |
      | Böylece kullanıcı aynı testi tekrar tekrar çözerek
      | sınırsız puan kazanamaz.
      |--------------------------------------------------------------------------
      */
      let earnedPoints = 0;

      if (!previousResult) {
        earnedPoints = score * 10;

        if (earnedPoints > 0) {
          db.prepare(
            `
            UPDATE users
            SET points = COALESCE(points, 0) + ?
            WHERE id = ?
            `
          ).run(
            earnedPoints,
            req.user.id
          );
        }
      }

      return res.json({
        resultId: resultInfo.lastInsertRowid,
        score,
        total: questions.length,
        earnedPoints,
        firstAttempt: !previousResult,
      });
    } catch (error) {
      console.error('Submit test error:', error);

      return res.status(500).json({
        message: 'خطا در ثبت نتیجه آزمون.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/tests
|--------------------------------------------------------------------------
| Yeni test oluşturur.
|
| Admin:
|   - Her kursa test ekleyebilir.
|
| Teacher:
|   - Sadece kendi kursuna test ekleyebilir.
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
        course_id,
        questions,
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | Temel doğrulama
      |--------------------------------------------------------------------------
      */
      if (
        !title ||
        !String(title).trim() ||
        !course_id
      ) {
        return res.status(400).json({
          message:
            'عنوان و کورس آزمون الزامی است.',
        });
      }

      if (!Array.isArray(questions)) {
        return res.status(400).json({
          message:
            'سوالات آزمون باید به شکل لیست ارسال شوند.',
        });
      }

      if (questions.length === 0) {
        return res.status(400).json({
          message:
            'آزمون باید حداقل یک سوال داشته باشد.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Kursu bul
      |--------------------------------------------------------------------------
      */
      const course = db
        .prepare(
          `
          SELECT *
          FROM courses
          WHERE id = ?
          `
        )
        .get(course_id);

      if (!course) {
        return res.status(404).json({
          message: 'کورس یافت نشد.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Teacher sadece kendi kursuna ekleyebilir
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

      /*
      |--------------------------------------------------------------------------
      | Soruları doğrula
      |--------------------------------------------------------------------------
      */
      for (let index = 0; index < questions.length; index++) {
        const question = questions[index];

        if (
          !question.question_text ||
          !String(question.question_text).trim()
        ) {
          return res.status(400).json({
            message:
              `متن سوال شماره ${index + 1} الزامی است.`,
          });
        }

        if (
          !Array.isArray(question.options) ||
          question.options.length < 2
        ) {
          return res.status(400).json({
            message:
              `سوال شماره ${index + 1} باید حداقل دو گزینه داشته باشد.`,
          });
        }

        const correctIndex =
          Number(question.correct_index);

        if (
          !Number.isInteger(correctIndex) ||
          correctIndex < 0 ||
          correctIndex >= question.options.length
        ) {
          return res.status(400).json({
            message:
              `گزینه صحیح سوال شماره ${index + 1} معتبر نیست.`,
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Transaction kullan
      |--------------------------------------------------------------------------
      | Test oluşturulurken ortada hata olursa yarım test oluşmasın.
      |--------------------------------------------------------------------------
      */
      const createTest = db.transaction(() => {
        const testInfo = db
          .prepare(
            `
            INSERT INTO tests (
              course_id,
              title
            )
            VALUES (?, ?)
            `
          )
          .run(
            course_id,
            String(title).trim()
          );

        const insertQuestion = db
          .prepare(
            `
            INSERT INTO questions (
              test_id,
              question_text,
              options,
              correct_index
            )
            VALUES (?, ?, ?, ?)
            `
          );

        for (const question of questions) {
          insertQuestion.run(
            testInfo.lastInsertRowid,
            String(question.question_text).trim(),
            JSON.stringify(question.options),
            Number(question.correct_index)
          );
        }

        return testInfo.lastInsertRowid;
      });

      const testId = createTest();

      /*
      |--------------------------------------------------------------------------
      | Sadece gerçek erişimi olan öğrencilere bildirim gönder
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
            'آزمون جدید',
            `آزمون «${String(title).trim()}» در کورس «${course.title}» اضافه شد.`,
            'test'
          );
        } catch (notificationError) {
          console.error(
            'Test notification error:',
            notificationError
          );
        }
      }

      return res.status(201).json({
        message: 'آزمون با موفقیت ساخته شد.',
        id: testId,
      });
    } catch (error) {
      console.error('Create test error:', error);

      return res.status(500).json({
        message: 'خطا در ساخت آزمون.',
      });
    }
  }
);

module.exports = router;