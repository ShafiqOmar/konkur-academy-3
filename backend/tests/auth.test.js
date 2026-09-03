const { app, request, registerStudent } = require('./helpers');

describe('POST /api/auth/register', () => {
  test('نبود رمز عبور یا ایمیل با خطای ۴۰۰ رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'تست', email: 'a@test.dev' });

    expect(res.status).toBe(400);
  });

  test('ایمیل با فرمت نادرست رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'تست', email: 'not-an-email', password: 'test1234' });

    expect(res.status).toBe(400);
  });

  test('رمز عبور کوتاه‌تر از ۶ حرف رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'تست', email: 'short@test.dev', password: '123' });

    expect(res.status).toBe(400);
  });

  test('ثبت‌نام معتبر یک توکن و کاربر با نقش student برمی‌گرداند', async () => {
    const { res } = await registerStudent();

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('student');
  });

  test('ثبت‌نام با ایمیل تکراری رد می‌شود', async () => {
    const { res: first, email, password } = await registerStudent();
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'دوباره', email, password });

    expect(second.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('رمز عبور نادرست با ۴۰۱ رد می‌شود', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@konkur.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('ورود با حساب مدیر پیش‌فرض موفق است', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@konkur.test', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('admin');
  });
});
