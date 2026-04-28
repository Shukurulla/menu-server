/**
 * Firebase Cloud Messaging — web push for restaurant admins.
 *
 * Service-account credentials must be supplied via env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY      (escape newlines as \n in the .env value)
 *
 * If any of them is missing, the module silently no-ops so the rest of the
 * server keeps working in dev without Firebase credentials.
 */

let admin = null;
let messaging = null;
let initialized = false;

function tryInit() {
  if (initialized) return messaging;
  initialized = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.log('[fcm] Skipped — FIREBASE_* env not set');
    return null;
  }

  // Allow newlines via "\n" or actual newlines in the env file.
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    messaging = admin.messaging();
    console.log('[fcm] Initialized for project', projectId);
    return messaging;
  } catch (e) {
    console.error('[fcm] init failed:', e.message);
    return null;
  }
}

/**
 * Send a push to every token belonging to a restaurant. Cleans up dead tokens
 * (UNREGISTERED / INVALID_ARGUMENT) from the restaurant's array on the way out.
 */
async function sendToRestaurant(restaurant, payload) {
  const m = tryInit();
  if (!m) return { ok: false, skipped: true };

  const tokens = (restaurant.fcmTokens || []).filter(Boolean);
  if (tokens.length === 0) return { ok: true, sent: 0 };

  const message = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
    ),
    webpush: {
      fcmOptions: { link: payload.link || '/restaurant/orders' },
      notification: {
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        tag: payload.tag || 'new-order',
        renotify: true,
        requireInteraction: true,
        vibrate: [120, 60, 120],
      },
    },
  };

  try {
    const res = await m.sendEachForMulticast(message);
    if (res.failureCount > 0) {
      const dead = [];
      res.responses.forEach((r, i) => {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument') ||
          code.includes('invalid-registration-token')
        ) {
          dead.push(tokens[i]);
        }
      });
      if (dead.length) {
        restaurant.fcmTokens = (restaurant.fcmTokens || []).filter((t) => !dead.includes(t));
        try { await restaurant.save(); } catch { /* ignore */ }
      }
    }
    return { ok: true, sent: res.successCount, failed: res.failureCount };
  } catch (e) {
    console.error('[fcm] send error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendToRestaurant };
