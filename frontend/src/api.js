// api.js — یک لایه‌ی نازک روی fetch برای تماس با بک‌اند

const BASE_URL = '/api';

async function request(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'خطایی در ارتباط با سرور رخ داد.');
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  getBranches: () => request('/branches'),

  getCourses: (branchId) => request(branchId ? `/courses?branch_id=${branchId}` : '/courses'),
  getCourse: (id) => request(`/courses/${id}`),
  getEnrollment: (id, token) => request(`/courses/${id}/enrollment`, { token }),
  getPaymentStatus: (paymentId, token) => request(`/payments/status/${paymentId}`, { token }),
  getPendingPayments: (token) => request('/payments/pending', { token }),
  approvePayment: (paymentId, token) => request(`/payments/${paymentId}/approve`, { method: 'POST', token }),
  rejectPayment: (paymentId, token) => request(`/payments/${paymentId}/reject`, { method: 'POST', token }),
  getMyCourses: (token) => request('/courses/mine', { token }),
  createCourse: (payload, token) => request('/courses', { method: 'POST', body: payload, token }),
  getCourseStudents: (id, token) => request(`/courses/${id}/students`, { token }),

  getVideo: (id, token) => request(`/videos/${id}`, { token }),
  saveProgress: (id, payload, token) =>
    request(`/videos/${id}/progress`, { method: 'POST', body: payload, token }),

  getTest: (id, token) => request(`/tests/${id}`, { token }),
  submitTest: (id, payload, token) =>
    request(`/tests/${id}/submit`, { method: 'POST', body: payload, token }),
  createTest: (payload, token) => request('/tests', { method: 'POST', body: payload, token }),

  checkout: (payload, token) => request('/payments/checkout', { method: 'POST', body: payload, token }),

  getDashboard: (token) => request('/dashboard', { token }),

  // استادان (ادمین)
  getTeachers: (token) => request('/teachers', { token }),
  createTeacher: (payload, token) => request('/teachers', { method: 'POST', body: payload, token }),

  // کلاس آنلاین زنده
  getLiveSessions: (courseId, token) => request(`/live/course/${courseId}`, { token }),
  createLiveSession: (payload, token) => request('/live', { method: 'POST', body: payload, token }),

  // انجمن پرسش‌وپاسخ
  getThreads: (courseId, token) => request(`/forum/course/${courseId}`, { token }),
  getThread: (id, token) => request(`/forum/thread/${id}`, { token }),
  createThread: (courseId, payload, token) =>
    request(`/forum/course/${courseId}`, { method: 'POST', body: payload, token }),
  replyThread: (id, payload, token) =>
    request(`/forum/thread/${id}/reply`, { method: 'POST', body: payload, token }),

  // اعلان‌ها
  getNotifications: (token) => request('/notifications', { token }),
  markNotificationsRead: (token) => request('/notifications/read-all', { method: 'POST', token }),

  // لیدربورد
  getLeaderboard: (branchId, token) =>
    request(branchId ? `/leaderboard?branch_id=${branchId}` : '/leaderboard', { token }),

  // آمار ادمین
  getAdminStats: (token) => request('/admin-stats', { token }),
};
