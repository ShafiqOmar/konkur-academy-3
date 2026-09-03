// tests/payments-stripe.test.js — پرداخت با کارت (Stripe Checkout) بدون تماس واقعی با شبکه
// SDK استرایپ کاملاً mock می‌شود تا هم ساخت جلسه (checkout session) و هم
// تایید امضای وبهوک بدون کلید/شبکه‌ی واقعی تست شوند.

jest.mock('stripe', () => {
  let fakeSessionCounter = 0;

  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(async () => {
          fakeSessionCounter += 1;
          return {
            id: `cs_test_${fakeSessionCounter}`,
            url: `https://checkout.stripe.com/test-session-${fakeSessionCounter}`,
          };
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn((body, signature) => {
        if (signature !== 'valid-test-signature') {
          throw new Error('Invalid signature');
        }
        return JSON.parse(body.toString());
      }),
    },
  }));
});

const { app, request, loginAs, registerStudent } = require('./helpers');

async function createPaidCourseWithUsdPrice(adminToken) {
  const res = await request(app)
    .post('/api/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'کورس تست Stripe', price: 500, price_usd: 9.99 });

  expect(res.status).toBe(201);
  return res.body.id;
}

describe('پرداخت با کارت — Stripe غیرفعال (بدون کلید)', () => {
  test('چک‌اوت با method=card بدون STRIPE_SECRET_KEY با ۵۰۳ رد می‌شود', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const adminToken = await loginAs('admin@konkur.test', 'admin123');
    const courseId = await createPaidCourseWithUsdPrice(adminToken);

    const { password, email } = await registerStudent();
    const studentToken = await loginAs(email, password);

    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: courseId, method: 'card' });

    expect(res.status).toBe(503);
  });
});

describe('پرداخت با کارت — Stripe فعال', () => {
  let studentToken;
  let courseId;
  let paymentId;

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';

    const adminToken = await loginAs('admin@konkur.test', 'admin123');
    courseId = await createPaidCourseWithUsdPrice(adminToken);

    const { password, email } = await registerStudent();
    studentToken = await loginAs(email, password);
  });

  test('بدون price_usd، چک‌اوت با کارت رد می‌شود', async () => {
    const adminToken = await loginAs('admin@konkur.test', 'admin123');
    const noUsdCourse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'کورس بدون قیمت دلاری', price: 500 });

    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: noUsdCourse.body.id, method: 'card' });

    expect(res.status).toBe(400);
  });

  test('چک‌اوت با کارت یک Stripe Checkout Session واقعی می‌سازد', async () => {
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: courseId, method: 'card' });

    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('stripe');
    expect(res.body.paymentUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
    paymentId = res.body.paymentId;

    const status = await request(app)
      .get(`/api/payments/status/${paymentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(status.body.currency).toBe('USD');
    expect(status.body.status).toBe('pending');
  });

  test('چک‌اوت دوباره با کارت، همان پرداخت pending را بازاستفاده می‌کند (ردیف تکراری نمی‌سازد)', async () => {
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: courseId, method: 'card' });

    expect(res.status).toBe(201);
    expect(res.body.paymentId).toBe(paymentId);
  });

  test('وبهوک Stripe با امضای نادرست رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/payments/stripe-webhook')
      .set('stripe-signature', 'wrong-signature')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: { metadata: { paymentId: String(paymentId) } } },
        })
      );

    expect(res.status).toBe(400);
  });

  test('وبهوک Stripe با امضای معتبر دسترسی را فعال می‌کند', async () => {
    const res = await request(app)
      .post('/api/payments/stripe-webhook')
      .set('stripe-signature', 'valid-test-signature')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: { metadata: { paymentId: String(paymentId) } } },
        })
      );

    expect(res.status).toBe(200);

    const enrollment = await request(app)
      .get(`/api/courses/${courseId}/enrollment`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(enrollment.body.accessGranted).toBe(true);
  });

  test('پردازش دوباره‌ی همان رویداد وبهوک بی‌اثر است (idempotent)', async () => {
    const res = await request(app)
      .post('/api/payments/stripe-webhook')
      .set('stripe-signature', 'valid-test-signature')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: { metadata: { paymentId: String(paymentId) } } },
        })
      );

    expect(res.status).toBe(200);
  });
});
