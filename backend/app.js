require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const { apiLimiter } = require('./middleware/rateLimit');
const openapiSpec = require('./docs/openapi.json');

require('./db'); // مطمئن می‌شویم دیتابیس و جدول‌ها ساخته شده‌اند

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const videoRoutes = require('./routes/videos');
const testRoutes = require('./routes/tests');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const { stripeWebhookHandler } = paymentRoutes;
const branchRoutes = require('./routes/branches');
const teacherRoutes = require('./routes/teachers');
const liveRoutes = require('./routes/live');
const forumRoutes = require('./routes/forum');
const notificationRoutes = require('./routes/notifications');
const leaderboardRoutes = require('./routes/leaderboard');
const adminStatsRoutes = require('./routes/admin-stats');

const app = express();

// فرانت‌اند و بک‌اند معمولاً روی دامنه‌های جدا میزبانی می‌شوند
// (مثلاً Vercel + Railway)، پس فایل‌های آپلودشده باید cross-origin بارگذاری شوند
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Stripe امضای درخواست را روی بدنه‌ی خام (raw) بررسی می‌کند، پس این مسیر
// باید قبل از express.json() مانت شود؛ وگرنه بدنه از قبل مصرف/پارس شده است.
app.post('/api/payments/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());
app.use('/api', apiLimiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin-stats', adminStatsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// خطاهای عمومی (مثلاً خطای آپلود multer)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'خطای سرور' });
});

module.exports = app;
