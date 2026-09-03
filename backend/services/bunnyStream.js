// services/bunnyStream.js — آپلود ویدیو به Bunny Stream (CDN استریم ویدیو)
// تا وقتی BUNNY_STREAM_LIBRARY_ID/BUNNY_STREAM_API_KEY تنظیم نشده باشند،
// isBunnyConfigured() مقدار false برمی‌گرداند و آپلود روی دیسک محلی سرور
// ادامه پیدا می‌کند (رفتار قبلی، بدون تغییر).
//
// مستندات رسمی: https://docs.bunny.net/reference/video_createvideo
//                https://docs.bunny.net/docs/stream-embed-view-video

const BUNNY_API_BASE = 'https://video.bunnycdn.com/library';

function isBunnyConfigured() {
  return Boolean(process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY);
}

async function createBunnyVideo(title) {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;

  const res = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: process.env.BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    throw new Error(`Bunny Stream: ساخت ویدیو ناموفق بود (${res.status}).`);
  }

  return res.json(); // { guid, ... }
}

async function uploadBunnyVideoBuffer(videoGuid, buffer) {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;

  const res = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos/${videoGuid}`, {
    method: 'PUT',
    headers: {
      AccessKey: process.env.BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  });

  if (!res.ok) {
    throw new Error(`Bunny Stream: آپلود ویدیو ناموفق بود (${res.status}).`);
  }

  return res.json();
}

async function deleteBunnyVideo(videoGuid) {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;

  await fetch(`${BUNNY_API_BASE}/${libraryId}/videos/${videoGuid}`, {
    method: 'DELETE',
    headers: { AccessKey: process.env.BUNNY_STREAM_API_KEY },
  });
}

function getBunnyEmbedUrl(videoGuid) {
  return `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_STREAM_LIBRARY_ID}/${videoGuid}?autoplay=false`;
}

// آدرس‌های embed ساخته‌شده توسط getBunnyEmbedUrl همیشه این الگو را دارند؛
// برای تشخیص اینکه یک ویدیوی ذخیره‌شده از Bunny است یا فایل محلی استفاده می‌شود.
function isBunnyEmbedUrl(url) {
  return typeof url === 'string' && url.includes('iframe.mediadelivery.net/embed/');
}

module.exports = {
  isBunnyConfigured,
  createBunnyVideo,
  uploadBunnyVideoBuffer,
  deleteBunnyVideo,
  getBunnyEmbedUrl,
  isBunnyEmbedUrl,
};
