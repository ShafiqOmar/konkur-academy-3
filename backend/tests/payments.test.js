const { app, request, loginAs, registerStudent } = require('./helpers');

async function findPaidCourse(token) {
  const res = await request(app).get('/api/courses').set('Authorization', `Bearer ${token}`);
  return res.body.find((c) => c.price > 0);
}

describe('جریان پرداخت', () => {
  let studentToken;
  let adminToken;
  let paidCourse;

  beforeAll(async () => {
    const { password, email } = await registerStudent();
    studentToken = await loginAs(email, password);
    adminToken = await loginAs('admin@konkur.test', 'admin123');
    paidCourse = await findPaidCourse(adminToken);
  });

  test('چک‌اوت کورس پولی یک پرداخت pending می‌سازد و دسترسی هنوز داده نمی‌شود', async () => {
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: paidCourse.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.paymentId).toBeTruthy();

    const enrollment = await request(app)
      .get(`/api/courses/${paidCourse.id}/enrollment`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(enrollment.body.accessGranted).toBe(false);
  });

  test('چک‌اوت دوباره برای همان کورس، پرداخت pending موجود را برمی‌گرداند نه یک پرداخت جدید', async () => {
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: paidCourse.id });

    expect(res.status).toBe(200);
    expect(res.body.alreadyEnrolled).toBeFalsy();
    expect(res.body.status).toBe('pending');
  });

  test('ادمین می‌تواند پرداخت pending را تایید کند و دسترسی داده می‌شود', async () => {
    const pending = await request(app)
      .get('/api/payments/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    const payment = pending.body.find((p) => p.course_id === paidCourse.id);
    expect(payment).toBeTruthy();

    const approve = await request(app)
      .post(`/api/payments/${payment.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('success');

    const enrollment = await request(app)
      .get(`/api/courses/${paidCourse.id}/enrollment`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(enrollment.body.accessGranted).toBe(true);
  });

  test('شاگرد دیگری نمی‌تواند لیست پرداخت‌های در انتظار را ببیند', async () => {
    const { password, email } = await registerStudent();
    const otherToken = await loginAs(email, password);

    const res = await request(app)
      .get('/api/payments/pending')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/payments/webhook', () => {
  let studentToken;
  let paidCourse;
  let paymentId;

  beforeAll(async () => {
    const { password, email } = await registerStudent();
    studentToken = await loginAs(email, password);
    const adminToken = await loginAs('admin@konkur.test', 'admin123');
    paidCourse = await findPaidCourse(adminToken);

    const checkout = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: paidCourse.id });

    paymentId = checkout.body.paymentId;
  });

  test('بدون هدر webhook secret درست، درخواست رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ paymentId, status: 'success' });

    expect(res.status).toBe(401);
  });

  test('با secret نادرست، درخواست رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ paymentId, status: 'success' });

    expect(res.status).toBe(401);
  });

  test('با secret درست، پرداخت تایید و دسترسی اعطا می‌شود', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-webhook-secret', process.env.PAYMENT_WEBHOOK_SECRET)
      .send({ paymentId, status: 'success' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const enrollment = await request(app)
      .get(`/api/courses/${paidCourse.id}/enrollment`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(enrollment.body.accessGranted).toBe(true);
  });
});
