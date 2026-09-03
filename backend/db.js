// db.js — راه‌اندازی پایگاه داده SQLite و ساخت جدول‌ها
// از better-sqlite3 استفاده می‌کنیم چون نیازی به نصب سرور جداگانه ندارد
// و همه‌چیز در یک فایل (data.sqlite) ذخیره می‌شود.

const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

// در تست‌ها از یک دیتابیس موقت و ایزوله در حافظه استفاده می‌شود
// تا داده‌های واقعی توسعه (data.sqlite) دستکاری نشوند.
// DB_DIR در Docker برای نگه‌داشتن فایل دیتابیس روی یک volume جدا استفاده می‌شود.
const dbDir = process.env.DB_DIR || __dirname;
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(dbDir, 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,           -- مثلاً «طب»، «انجینیری»، «اقتصاد»
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- 'student' | 'teacher' | 'admin'
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL, -- صنف/رشته شاگرد
  points INTEGER NOT NULL DEFAULT 0,   -- امتیاز برای لیدربورد
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  price INTEGER NOT NULL DEFAULT 0,
  cover_color TEXT DEFAULT '#2D4263',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  access_granted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS video_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched_seconds INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  UNIQUE(user_id, video_id)
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers TEXT,
  taken_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_payment_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  UNIQUE(user_id, course_id, provider_payment_id)
);

-- کلاس آنلاین زنده: هر رکورد یک جلسه‌ی لایو برای یک کورس است.
-- پخش زنده با Jitsi Meet (رایگان، بدون نیاز به کلید API) انجام می‌شود.
CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  room_name TEXT NOT NULL UNIQUE,
  scheduled_at TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- انجمن پرسش و پاسخ برای هر کورس
CREATE TABLE IF NOT EXISTS forum_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- اعلان‌های داخل سایت (زنگ اعلان). برای ایمیل/پیامک واقعی به README مراجعه کنید.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',   -- 'info' | 'payment' | 'live' | 'forum' | 'test'
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// --- ستون‌های جدید برای دیتابیس‌های قدیمی‌تری که از قبل ساخته شده‌اند ---
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('users', 'branch_id', 'INTEGER REFERENCES branches(id)');
ensureColumn('users', 'points', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('courses', 'branch_id', 'INTEGER REFERENCES branches(id)');
ensureColumn('courses', 'teacher_id', 'INTEGER REFERENCES users(id)');
ensureColumn('enrollments', 'access_granted', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('payments', 'status', "TEXT NOT NULL DEFAULT 'pending'");
// قیمت جدا برای پرداخت کارتی (Stripe): افغانستان کشور پشتیبانی‌شده‌ی Stripe نیست
// و AFN ارز پشتیبانی‌شده نیست، پس نمی‌توان قیمت افغانی را خودکار به USD تبدیل کرد
// (نرخ تبدیل ثابت/فرضی خطرناک است). مدیر باید این قیمت را جدا و به‌صراحت به دلار وارد کند.
ensureColumn('courses', 'price_usd', 'REAL');
// واحد پول واقعی هر پرداخت را ذخیره می‌کند تا SUM(amount) در گزارش‌های مالی
// هیچ‌وقت AFN و USD را با هم جمع نزند.
ensureColumn('payments', 'currency', "TEXT NOT NULL DEFAULT 'AFN'");
// اگر ویدیو روی Bunny Stream آپلود شده باشد، GUID آن اینجا ذخیره می‌شود
// (برای حذف/مدیریت بعدی از طریق API بانی). ویدیوهای محلی این مقدار را ندارند.
ensureColumn('videos', 'bunny_video_id', 'TEXT');
ensureColumn('payments', 'provider_payment_id', 'TEXT');
ensureColumn('payments', 'notes', 'TEXT');
ensureColumn('payments', 'confirmed_at', 'TEXT');
// --- کمک‌کننده برای ساخت اعلان (در روت‌های دیگر هم استفاده می‌شود) ---
function notify(userId, title, message, type = 'info') {
  db.prepare(
    'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)'
  ).run(userId, title, message || '', type);
}
db.notify = notify;

// --- Seed داده‌های نمونه (فقط بار اول) ---
const branchCount = db.prepare('SELECT COUNT(*) AS c FROM branches').get().c;
if (branchCount === 0) {
  const insertBranch = db.prepare('INSERT INTO branches (title, description) VALUES (?, ?)');
  var medBranch = insertBranch.run('طب', 'رشته‌ی علوم طبی');
  var engBranch = insertBranch.run('انجینیری', 'رشته‌ی علوم انجینیری');
  insertBranch.run('اقتصاد', 'رشته‌ی علوم اقتصادی');
  console.log('✅ صنف‌ها/رشته‌های نمونه ساخته شدند.');
}

const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
if (adminCount === 0) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run('مدیر آموزشگاه', 'admin@konkur.test', passwordHash, 'admin');
  console.log('✅ حساب مدیر ساخته شد → ایمیل: admin@konkur.test | رمز عبور: admin123');
}

const teacherCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'teacher'").get().c;
if (teacherCount === 0) {
  const passwordHash = bcrypt.hashSync('teacher123', 10);
  db.prepare(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run('استاد نمونه', 'teacher@konkur.test', passwordHash, 'teacher');
  console.log('✅ حساب استاد نمونه ساخته شد → ایمیل: teacher@konkur.test | رمز عبور: teacher123');
}

const courseCount = db.prepare('SELECT COUNT(*) AS c FROM courses').get().c;
if (courseCount === 0) {
  const teacher = db.prepare("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").get();
  const med = db.prepare("SELECT id FROM branches WHERE title = 'طب'").get();
  const eng = db.prepare("SELECT id FROM branches WHERE title = 'انجینیری'").get();

  const insertCourse = db.prepare(
    `INSERT INTO courses (title, description, subject, branch_id, teacher_id, price, cover_color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const bio = insertCourse.run(
    'بیولوژی جامع کانکور', 'دوره‌ی کامل بیولوژی برای آماده‌گی کانکور، از سلول تا وراثت.',
    'بیولوژی', med?.id || null, teacher?.id || null, 0, '#4E8D7C'
  );
  const math = insertCourse.run(
    'ریاضیات کانکور', 'حل مسائل کلیدی ریاضی با تمرکز بر سوالات تکراری کانکور.',
    'ریاضی', eng?.id || null, teacher?.id || null, 500, '#2D4263'
  );
  const phy = insertCourse.run(
    'فزیک کاربردی', 'مفاهیم فزیک به زبان ساده همراه با تست‌های تشریحی.',
    'فزیک', eng?.id || null, teacher?.id || null, 500, '#E8A33D'
  );

  const insertVideo = db.prepare(
    `INSERT INTO videos (course_id, title, url, duration_seconds, sort_order) VALUES (?, ?, ?, ?, ?)`
  );
  insertVideo.run(bio.lastInsertRowid, 'مقدمه بر سلول', 'https://www.w3schools.com/html/mov_bbb.mp4', 596, 1);
  insertVideo.run(bio.lastInsertRowid, 'وراثت و ژنتیک', 'https://www.w3schools.com/html/mov_bbb.mp4', 745, 2);
  insertVideo.run(math.lastInsertRowid, 'معادلات درجه دوم', 'https://www.w3schools.com/html/mov_bbb.mp4', 630, 1);
  insertVideo.run(phy.lastInsertRowid, 'حرکت و نیرو', 'https://www.w3schools.com/html/mov_bbb.mp4', 512, 1);

  const insertTest = db.prepare(`INSERT INTO tests (course_id, title) VALUES (?, ?)`);
  const bioTest = insertTest.run(bio.lastInsertRowid, 'آزمون فصل سلول');

  const insertQ = db.prepare(
    `INSERT INTO questions (test_id, question_text, options, correct_index) VALUES (?, ?, ?, ?)`
  );
  insertQ.run(bioTest.lastInsertRowid, 'کدام اندامک وظیفه تولید انرژی را دارد؟',
    JSON.stringify(['هسته', 'میتوکندری', 'ریبوزوم', 'لیزوزوم']), 1);
  insertQ.run(bioTest.lastInsertRowid, 'دیواره سلولی در کدام نوع سلول وجود دارد؟',
    JSON.stringify(['سلول جانوری', 'سلول گیاهی', 'هر دو', 'هیچ‌کدام']), 1);

  console.log('✅ داده‌های نمونه (کورس، ویدیو، آزمون) ساخته شدند.');
}

module.exports = db;
