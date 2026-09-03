// tests/helpers.js — کمک‌کننده‌های مشترک برای تست‌ها

const request = require('supertest');
const app = require('../app');

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

async function registerStudent(overrides = {}) {
  const email = overrides.email || `student_${Date.now()}_${Math.random().toString(36).slice(2)}@test.dev`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      full_name: overrides.full_name || 'شاگرد تست',
      email,
      password: overrides.password || 'test1234',
    });
  return { res, email, password: overrides.password || 'test1234' };
}

module.exports = { app, request, loginAs, registerStudent };
