const { app, request, loginAs, registerStudent } = require('./helpers');

async function findCourseByPrice(token, price) {
  const res = await request(app).get('/api/courses').set('Authorization', `Bearer ${token}`);
  return res.body.find((c) => c.price === price);
}

describe('کنترل دسترسی به ویدیوی کورس', () => {
  let studentToken;
  let freeCourse;
  let paidCourse;
  let freeVideoId;
  let paidVideoId;

  beforeAll(async () => {
    const { password, email } = await registerStudent();
    studentToken = await loginAs(email, password);

    const adminToken = await loginAs('admin@konkur.test', 'admin123');
    freeCourse = await findCourseByPrice(adminToken, 0);
    paidCourse = await findCourseByPrice(adminToken, 500);

    const freeDetail = await request(app).get(`/api/courses/${freeCourse.id}`);
    freeVideoId = freeDetail.body.videos[0].id;

    const paidDetail = await request(app).get(`/api/courses/${paidCourse.id}`);
    paidVideoId = paidDetail.body.videos[0].id;
  });

  test('شاگرد بدون ثبت‌نام به ویدیوی کورس رایگان دسترسی ندارد', async () => {
    const res = await request(app)
      .get(`/api/videos/${freeVideoId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test('بعد از ثبت‌نام در کورس رایگان، شاگرد به ویدیو دسترسی پیدا می‌کند', async () => {
    const checkout = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ course_id: freeCourse.id });

    expect(checkout.status).toBe(200);
    expect(checkout.body.accessGranted).toBe(true);

    const res = await request(app)
      .get(`/api/videos/${freeVideoId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
  });

  test('شاگرد بدون پرداخت به ویدیوی کورس پولی دسترسی ندارد', async () => {
    const res = await request(app)
      .get(`/api/videos/${paidVideoId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test('معلم دیگری (غیر از استاد کورس) به ساخت آزمون کورس دسترسی ندارد', async () => {
    // استاد نمونه، مالک هر سه کورس seed‌شده است، پس یک استاد جدید بدون کورس می‌سازیم
    const adminToken = await loginAs('admin@konkur.test', 'admin123');
    const otherEmail = `teacher2_${Date.now()}@test.dev`;

    const createRes = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'استاد دیگر', email: otherEmail, password: 'test1234' });

    expect(createRes.status).toBe(201);

    const otherTeacherToken = await loginAs(otherEmail, 'test1234');

    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ title: 'آزمون غیرمجاز', course_id: paidCourse.id, questions: [{ question_text: 'س؟', options: ['a', 'b'], correct_index: 0 }] });

    expect(res.status).toBe(403);
  });

  test('بدون توکن دسترسی به داشبورد رد می‌شود', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });
});
