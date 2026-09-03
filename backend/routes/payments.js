const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/auth');

const { grantCourseAccess, handleFailedPayment } = require('../services/paymentHelpers');
const { getStripeClient } = require('../services/stripeClient');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Güvenli ödeme referansı
|--------------------------------------------------------------------------
*/
function createPaymentRef() {
  return `pay_${Date.now()}_${crypto
    .randomBytes(12)
    .toString('hex')}`;
}

/*
|--------------------------------------------------------------------------
| Kullanıcı gerçekten student mı?
|--------------------------------------------------------------------------
*/
function requireStudent(req, res, next) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({
      message:
        'خرید کورس فقط برای شاگردان مجاز است.',
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| POST /api/payments/checkout
|--------------------------------------------------------------------------
| Ödeme başlatır.
|--------------------------------------------------------------------------
*/
router.post(
  '/checkout',
  requireAuth,
  requireStudent,
  async (req, res) => {
    try {
      const {
        course_id,
        method = 'manual',
      } = req.body;

      if (!course_id) {
        return res.status(400).json({
          message:
            'کورس الزامی است.',
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
          message:
            'کورس یافت نشد.',
        });
      }

      const price =
        Number(course.price) || 0;

      if (price < 0) {
        return res.status(500).json({
          message:
            'قیمت کورس نامعتبر است.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Enrollment kontrolü
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
          course_id
        );

      /*
      |--------------------------------------------------------------------------
      | Kullanıcının zaten erişimi varsa tekrar ödeme oluşturma
      |--------------------------------------------------------------------------
      */
      if (
        enrollment &&
        ['paid', 'free'].includes(
          enrollment.payment_status
        )
      ) {
        return res.json({
          ok: true,
          status:
            enrollment.payment_status,
          enrolled: true,
          accessGranted: true,
          alreadyEnrolled: true,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Ücretsiz kurs
      |--------------------------------------------------------------------------
      */
      if (price === 0) {
        grantCourseAccess(
          req.user.id,
          course_id,
          'free'
        );

        return res.json({
          ok: true,
          status: 'free',
          enrolled: true,
          accessGranted: true,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Kart ile ödeme (Stripe Checkout)
      |--------------------------------------------------------------------------
      | افغانستان کشور پشتیبانی‌شده‌ی Stripe نیست و AFN ارز پشتیبانی‌شده نیست،
      | پس نمی‌توان قیمت افغانی کورس (course.price) را با یک نرخ فرضی به دلار
      | تبدیل کرد — این کار می‌تواند مبلغ نادرستی از کاربر بگیرد. به‌جای آن،
      | مدیر باید قیمت دلاری را جداگانه در course.price_usd تنظیم کند.
      |--------------------------------------------------------------------------
      */
      if (method === 'card') {
        const stripe = getStripeClient();

        if (!stripe) {
          return res.status(503).json({
            message:
              'پرداخت با کارت هنوز فعال نشده است. لطفاً از حواله بانکی استفاده کنید.',
          });
        }

        const priceUsd = Number(course.price_usd);

        if (!priceUsd || priceUsd <= 0) {
          return res.status(400).json({
            message:
              'قیمت دالری این کورس هنوز توسط مدیر تنظیم نشده است.',
          });
        }

        try {
          const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

          // یک ردیف pending موجود برای همین کارت را دوباره استفاده می‌کنیم
          // تا با هر تلاش مجدد، ردیف تکراری در جدول payments ساخته نشود.
          let paymentRow = db
            .prepare(
              `
              SELECT *
              FROM payments
              WHERE user_id = ?
                AND course_id = ?
                AND method = 'card'
                AND status = 'pending'
              ORDER BY created_at DESC
              LIMIT 1
              `
            )
            .get(req.user.id, course_id);

          if (!paymentRow) {
            if (enrollment) {
              db.prepare(
                `UPDATE enrollments SET payment_status = 'pending', access_granted = 0 WHERE id = ?`
              ).run(enrollment.id);
            } else {
              db.prepare(
                `INSERT INTO enrollments (user_id, course_id, payment_status, access_granted) VALUES (?, ?, 'pending', 0)`
              ).run(req.user.id, course_id);
            }

            const info = db
              .prepare(
                `
                INSERT INTO payments (
                  user_id, course_id, amount, currency, method, status, provider_payment_id
                )
                VALUES (?, ?, ?, ?, 'card', 'pending', ?)
                `
              )
              .run(
                req.user.id,
                course_id,
                priceUsd,
                currency.toUpperCase(),
                `pending_${crypto.randomBytes(8).toString('hex')}`
              );

            paymentRow = { id: info.lastInsertRowid };
          }

          const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency,
                  product_data: { name: course.title },
                  unit_amount: Math.round(priceUsd * 100),
                },
                quantity: 1,
              },
            ],
            success_url: `${clientUrl}/payment-status/${paymentRow.id}?stripe=success`,
            cancel_url: `${clientUrl}/courses/${course_id}?stripe=cancelled`,
            metadata: { paymentId: String(paymentRow.id) },
          });

          db.prepare(
            `UPDATE payments SET provider_payment_id = ? WHERE id = ?`
          ).run(session.id, paymentRow.id);

          return res.status(201).json({
            ok: true,
            status: 'pending',
            provider: 'stripe',
            paymentId: paymentRow.id,
            paymentUrl: session.url,
          });
        } catch (stripeError) {
          console.error('Stripe checkout session error:', stripeError);

          return res.status(502).json({
            message: 'خطا در ارتباط با درگاه پرداخت Stripe.',
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Aynı kurs için zaten pending ödeme var mı?
      |--------------------------------------------------------------------------
      | Varsa yeni ödeme üretmek yerine mevcut işlemi döndür.
      |--------------------------------------------------------------------------
      */
      const existingPending = db
        .prepare(
          `
          SELECT *
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
          course_id
        );

      if (existingPending) {
        return res.json({
          ok: true,
          status: 'pending',

          paymentId:
            existingPending.id,

          paymentRef:
            existingPending.provider_payment_id,

          paymentUrl:
            `/payment-status/${existingPending.id}`,

          message:
            'برای این کورس یک پرداخت در حال انتظار دارید.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Enrollment'i pending yap
      |--------------------------------------------------------------------------
      */
      if (enrollment) {
        db.prepare(
          `
          UPDATE enrollments
          SET
            payment_status = 'pending',
            access_granted = 0
          WHERE id = ?
          `
        ).run(enrollment.id);
      } else {
        db.prepare(
          `
          INSERT INTO enrollments (
            user_id,
            course_id,
            payment_status,
            access_granted
          )
          VALUES (?, ?, 'pending', 0)
          `
        ).run(
          req.user.id,
          course_id
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Payment oluştur
      |--------------------------------------------------------------------------
      */
      const paymentRef =
        createPaymentRef();

      const allowedMethods = [
        'manual',
        'card',
        'bank',
      ];

      const cleanMethod =
        allowedMethods.includes(method)
          ? method
          : 'manual';

      const info = db
        .prepare(
          `
          INSERT INTO payments (
            user_id,
            course_id,
            amount,
            method,
            status,
            provider_payment_id
          )
          VALUES (?, ?, ?, ?, 'pending', ?)
          `
        )
        .run(
          req.user.id,
          course_id,
          price,
          cleanMethod,
          paymentRef
        );

      return res.status(201).json({
        ok: true,
        status: 'pending',

        paymentId:
          info.lastInsertRowid,

        paymentRef,

        paymentUrl:
          `/payment-status/${info.lastInsertRowid}`,

        message:
          'Ödeme bekleniyor. Lütfen işlemi tamamlayın.',
      });
    } catch (error) {
      console.error(
        'Checkout error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در ایجاد پرداخت.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/payments/pending
|--------------------------------------------------------------------------
| Admin bekleyen ödemeleri görür.
|--------------------------------------------------------------------------
*/
router.get(
  '/pending',
  requireAuth,
  requireAdmin,
  (req, res) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT
            p.*,
            u.full_name AS user_name,
            u.email AS user_email,
            c.title AS course_title

          FROM payments p

          JOIN users u
            ON u.id = p.user_id

          JOIN courses c
            ON c.id = p.course_id

          WHERE p.status = 'pending'

          ORDER BY p.created_at DESC
          `
        )
        .all();

      return res.json(rows);
    } catch (error) {
      console.error(
        'Pending payments error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت پرداخت‌های در انتظار.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/payments/status/:paymentId
|--------------------------------------------------------------------------
| Kullanıcı yalnızca kendi ödemesini görebilir.
|--------------------------------------------------------------------------
*/
router.get(
  '/status/:paymentId',
  requireAuth,
  requireStudent,
  (req, res) => {
    try {
      const payment = db
        .prepare(
          `
          SELECT *
          FROM payments
          WHERE id = ?
            AND user_id = ?
          `
        )
        .get(
          req.params.paymentId,
          req.user.id
        );

      if (!payment) {
        return res.status(404).json({
          message:
            'پرداخت یافت نشد.',
        });
      }

      return res.json({
        id:
          payment.id,

        status:
          payment.status,

        amount:
          payment.amount,

        currency:
          payment.currency,

        method:
          payment.method,

        paymentRef:
          payment.provider_payment_id,

        confirmedAt:
          payment.confirmed_at,

        courseId:
          payment.course_id,
      });
    } catch (error) {
      console.error(
        'Payment status error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت وضعیت پرداخت.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/payments/webhook
|--------------------------------------------------------------------------
| Ödeme sağlayıcısından sonuç gelir.
|--------------------------------------------------------------------------
*/
router.post('/webhook', (req, res) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | Webhook secret MUTLAKA .env içinde olmalı
    |--------------------------------------------------------------------------
    */
    const expected =
      process.env.PAYMENT_WEBHOOK_SECRET;

    if (!expected) {
      console.error(
        'PAYMENT_WEBHOOK_SECRET is not configured.'
      );

      return res.status(503).json({
        message:
          'Payment webhook is not configured.',
      });
    }

    const provided =
      String(
        req.headers['x-webhook-secret'] || ''
      );

    /*
    |--------------------------------------------------------------------------
    | timingSafeEqual
    |--------------------------------------------------------------------------
    */
    const expectedBuffer =
      Buffer.from(expected);

    const providedBuffer =
      Buffer.from(provided);

    const validSecret =
      expectedBuffer.length ===
        providedBuffer.length &&
      crypto.timingSafeEqual(
        expectedBuffer,
        providedBuffer
      );

    if (!validSecret) {
      return res.status(401).json({
        message:
          'Webhook secret mismatch.',
      });
    }

    const {
      paymentId,
      status,
    } = req.body;

    if (
      !paymentId ||
      !['success', 'failed'].includes(
        status
      )
    ) {
      return res.status(400).json({
        message:
          'Invalid webhook payload.',
      });
    }

    const payment = db
      .prepare(
        `
        SELECT *
        FROM payments
        WHERE id = ?
        `
      )
      .get(paymentId);

    if (!payment) {
      return res.status(404).json({
        message:
          'پرداخت یافت نشد.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Zaten tamamlanmış ödeme tekrar değiştirilmez
    |--------------------------------------------------------------------------
    */
    if (payment.status !== 'pending') {
      return res.json({
        ok: true,
        message:
          'Payment already processed.',
        status:
          payment.status,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Transaction
    |--------------------------------------------------------------------------
    */
    const processPayment =
      db.transaction(() => {
        db.prepare(
          `
          UPDATE payments
          SET
            status = ?,
            confirmed_at = datetime('now')
          WHERE id = ?
            AND status = 'pending'
          `
        ).run(
          status,
          payment.id
        );

        if (status === 'success') {
          grantCourseAccess(
            payment.user_id,
            payment.course_id,
            'paid'
          );
        } else {
          handleFailedPayment(payment);
        }
      });

    processPayment();

    const course = db
      .prepare(
        `
        SELECT title
        FROM courses
        WHERE id = ?
        `
      )
      .get(payment.course_id);

    /*
    |--------------------------------------------------------------------------
    | Bildirim
    |--------------------------------------------------------------------------
    */
    if (status === 'success') {
      db.notify(
        payment.user_id,
        'پرداخت موفق',
        `پرداخت شما برای کورس «${course?.title || ''}» تایید شد.`,
        'payment'
      );
    } else {
      db.notify(
        payment.user_id,
        'پرداخت ناموفق',
        `پرداخت شما برای کورس «${course?.title || ''}» ناموفق بود.`,
        'payment'
      );
    }

    return res.json({
      ok: true,
      status,
    });
  } catch (error) {
    console.error(
      'Payment webhook error:',
      error
    );

    return res.status(500).json({
      message:
        'Payment webhook error.',
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/payments/:paymentId/approve
|--------------------------------------------------------------------------
| Admin manuel ödeme onayı.
|--------------------------------------------------------------------------
*/
router.post(
  '/:paymentId/approve',
  requireAuth,
  requireAdmin,
  (req, res) => {
    try {
      const payment = db
        .prepare(
          `
          SELECT *
          FROM payments
          WHERE id = ?
          `
        )
        .get(req.params.paymentId);

      if (!payment) {
        return res.status(404).json({
          message:
            'پرداخت یافت نشد.',
        });
      }

      if (payment.status !== 'pending') {
        return res.status(400).json({
          message:
            'این پرداخت در وضعیت pending نیست.',
        });
      }

      const approvePayment =
        db.transaction(() => {
          db.prepare(
            `
            UPDATE payments
            SET
              status = 'success',
              confirmed_at = datetime('now')
            WHERE id = ?
              AND status = 'pending'
            `
          ).run(payment.id);

          grantCourseAccess(
            payment.user_id,
            payment.course_id,
            'paid'
          );
        });

      approvePayment();

      const course = db
        .prepare(
          `
          SELECT title
          FROM courses
          WHERE id = ?
          `
        )
        .get(payment.course_id);

      try {
        db.notify(
          payment.user_id,
          'پرداخت تایید شد',
          `پرداخت شما برای کورس «${course?.title || ''}» با موفقیت تایید شد.`,
          'payment'
        );
      } catch (notificationError) {
        console.error(
          'Payment notification error:',
          notificationError
        );
      }

      return res.json({
        ok: true,
        status: 'success',
      });
    } catch (error) {
      console.error(
        'Approve payment error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در تایید پرداخت.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/payments/:paymentId/reject
|--------------------------------------------------------------------------
| Admin manuel ödeme reddi.
|--------------------------------------------------------------------------
*/
router.post(
  '/:paymentId/reject',
  requireAuth,
  requireAdmin,
  (req, res) => {
    try {
      const payment = db
        .prepare(
          `
          SELECT *
          FROM payments
          WHERE id = ?
          `
        )
        .get(req.params.paymentId);

      if (!payment) {
        return res.status(404).json({
          message:
            'پرداخت یافت نشد.',
        });
      }

      if (payment.status !== 'pending') {
        return res.status(400).json({
          message:
            'این پرداخت در وضعیت pending نیست.',
        });
      }

      const rejectPayment =
        db.transaction(() => {
          db.prepare(
            `
            UPDATE payments
            SET
              status = 'failed',
              confirmed_at = datetime('now')
            WHERE id = ?
              AND status = 'pending'
            `
          ).run(payment.id);

          handleFailedPayment(payment);
        });

      rejectPayment();

      const course = db
        .prepare(
          `
          SELECT title
          FROM courses
          WHERE id = ?
          `
        )
        .get(payment.course_id);

      try {
        db.notify(
          payment.user_id,
          'پرداخت رد شد',
          `پرداخت شما برای کورس «${course?.title || ''}» رد شد.`,
          'payment'
        );
      } catch (notificationError) {
        console.error(
          'Payment notification error:',
          notificationError
        );
      }

      return res.json({
        ok: true,
        status: 'failed',
      });
    } catch (error) {
      console.error(
        'Reject payment error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در رد پرداخت.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/payments/history
|--------------------------------------------------------------------------
| Öğrenci yalnızca kendi ödeme geçmişini görür.
|--------------------------------------------------------------------------
*/
router.get(
  '/history',
  requireAuth,
  requireStudent,
  (req, res) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT
            p.id,
            p.course_id,
            p.amount,
            p.currency,
            p.method,
            p.status,
            p.provider_payment_id,
            p.created_at,
            p.confirmed_at,
            c.title AS course_title

          FROM payments p

          JOIN courses c
            ON c.id = p.course_id

          WHERE p.user_id = ?

          ORDER BY p.created_at DESC
          `
        )
        .all(req.user.id);

      return res.json(rows);
    } catch (error) {
      console.error(
        'Payment history error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در دریافت تاریخچه پرداخت‌ها.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Stripe webhook handler
|--------------------------------------------------------------------------
| این تابع مستقیماً روی app (نه این router) با express.raw() مانت می‌شود،
| چون امضای Stripe فقط با بدنه‌ی خام (raw) قابل بررسی است. اگر بعد از
| express.json() مانت شود، بدنه از قبل مصرف شده و امضا هرگز تایید نمی‌شود.
|--------------------------------------------------------------------------
*/
async function stripeWebhookHandler(req, res) {
  const stripe = getStripeClient();

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook is not configured.');
    return res.status(503).json({ message: 'Stripe webhook is not configured.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Stripe webhook signature error:', error.message);
    return res.status(400).json({ message: 'Invalid Stripe signature.' });
  }

  try {
    const successEvents = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
    const failureEvents = ['checkout.session.async_payment_failed', 'checkout.session.expired'];

    if (successEvents.includes(event.type) || failureEvents.includes(event.type)) {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;

      if (paymentId) {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);

        if (payment && payment.status === 'pending') {
          if (successEvents.includes(event.type)) {
            const processPayment = db.transaction(() => {
              db.prepare(
                `UPDATE payments SET status = 'success', confirmed_at = datetime('now') WHERE id = ? AND status = 'pending'`
              ).run(payment.id);
              grantCourseAccess(payment.user_id, payment.course_id, 'paid');
            });
            processPayment();

            const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(payment.course_id);
            db.notify(
              payment.user_id,
              'پرداخت موفق',
              `پرداخت شما برای کورس «${course?.title || ''}» تایید شد.`,
              'payment'
            );
          } else {
            const processPayment = db.transaction(() => {
              db.prepare(
                `UPDATE payments SET status = 'failed', confirmed_at = datetime('now') WHERE id = ? AND status = 'pending'`
              ).run(payment.id);
              handleFailedPayment(payment);
            });
            processPayment();

            const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(payment.course_id);
            db.notify(
              payment.user_id,
              'پرداخت ناموفق',
              `پرداخت شما برای کورس «${course?.title || ''}» ناموفق بود.`,
              'payment'
            );
          }
        }
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return res.status(500).json({ message: 'Stripe webhook processing error.' });
  }
}

module.exports = router;
module.exports.stripeWebhookHandler = stripeWebhookHandler;