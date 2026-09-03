const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET /api/notifications
|--------------------------------------------------------------------------
| Kullanıcının kendi bildirimlerini getirir.
|--------------------------------------------------------------------------
*/
router.get('/', requireAuth, (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT
          id,
          title,
          message,
          type,
          is_read,
          created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 30
        `
      )
      .all(req.user.id);

    const unreadCount = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id = ?
          AND is_read = 0
        `
      )
      .get(req.user.id).count;

    return res.json({
      items: rows,
      unreadCount,
    });
  } catch (error) {
    console.error(
      'Notifications error:',
      error
    );

    return res.status(500).json({
      message:
        'خطا در دریافت اعلان‌ها.',
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/notifications/read-all
|--------------------------------------------------------------------------
| Kullanıcının kendi bildirimlerinin tamamını okundu yapar.
|--------------------------------------------------------------------------
*/
router.post(
  '/read-all',
  requireAuth,
  (req, res) => {
    try {
      const result = db
        .prepare(
          `
          UPDATE notifications
          SET is_read = 1
          WHERE user_id = ?
            AND is_read = 0
          `
        )
        .run(req.user.id);

      return res.json({
        ok: true,
        updated:
          result.changes,
      });
    } catch (error) {
      console.error(
        'Read notifications error:',
        error
      );

      return res.status(500).json({
        message:
          'خطا در بروزرسانی اعلان‌ها.',
      });
    }
  }
);

module.exports = router;