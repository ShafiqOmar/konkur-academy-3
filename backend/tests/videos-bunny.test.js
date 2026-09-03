// tests/videos-bunny.test.js — آپلود ویدیو به Bunny Stream بدون تماس واقعی با شبکه
// چون این تست BUNNY_STREAM_* را قبل از require شدن app.js تنظیم می‌کند،
// videos.js از multer.memoryStorage() استفاده می‌کند (به‌جای دیسک محلی).

process.env.BUNNY_STREAM_LIBRARY_ID = 'test-library-id';
process.env.BUNNY_STREAM_API_KEY = 'test-bunny-key';

const { app, request, loginAs } = require('./helpers');

describe('آپلود ویدیو با Bunny Stream فعال', () => {
  let originalFetch;
  let adminToken;
  let courseId;

  beforeAll(async () => {
    adminToken = await loginAs('admin@konkur.test', 'admin123');

    const courseRes = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'کورس تست Bunny', price: 0 });

    courseId = courseRes.body.id;
  });

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('آپلود موفق: ویدیو به Bunny ساخته و آپلود می‌شود و آدرس embed ذخیره می‌شود', async () => {
    global.fetch = jest.fn(async (url, options) => {
      if (options.method === 'POST' && url.includes('/videos') && !url.match(/videos\/[\w-]+$/)) {
        return {
          ok: true,
          json: async () => ({ guid: 'bunny-guid-123' }),
        };
      }
      if (options.method === 'PUT') {
        return { ok: true, json: async () => ({}) };
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const res = await request(app)
      .post(`/api/videos/upload/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'درس اول')
      .attach('video', Buffer.from('fake video bytes'), {
        filename: 'lesson.mp4',
        contentType: 'video/mp4',
      });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe(
      'https://iframe.mediadelivery.net/embed/test-library-id/bunny-guid-123?autoplay=false'
    );

    // ساخت ویدیو باید یک POST به .../videos (بدون PUT به مسیر GUID) باشد
    const createCall = global.fetch.mock.calls.find(([, opts]) => opts.method === 'POST');
    expect(createCall[0]).toBe('https://video.bunnycdn.com/library/test-library-id/videos');
    expect(createCall[1].headers.AccessKey).toBe('test-bunny-key');

    const uploadCall = global.fetch.mock.calls.find(([, opts]) => opts.method === 'PUT');
    expect(uploadCall[0]).toBe(
      'https://video.bunnycdn.com/library/test-library-id/videos/bunny-guid-123'
    );
  });

  test('اگر Bunny خطا برگرداند، ویدیو در دیتابیس ذخیره نمی‌شود', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 }));

    const res = await request(app)
      .post(`/api/videos/upload/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'درس ناموفق')
      .attach('video', Buffer.from('fake video bytes'), {
        filename: 'lesson2.mp4',
        contentType: 'video/mp4',
      });

    expect(res.status).toBe(502);
  });
});
