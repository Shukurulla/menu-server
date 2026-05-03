const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    logo: { type: String, default: null }, // URL yoki file path
    description: { type: String, default: '' },
    address: { type: String, default: '' },
    workingHours: { type: String, default: '10:00 — 23:00' },
    instagram: { type: String, default: '' },

    // Region defaults
    region: { type: String, default: 'UZ' }, // UZ | RU | KZ | KG | TJ | US
    phonePrefix: { type: String, default: '+998' },
    phoneFormat: { type: String, default: '+998 (XX) XXX-XX-XX' },
    currency: { type: String, default: 'UZS' },
    currencySymbol: { type: String, default: 'сум' },
    locale: { type: String, default: 'ru-UZ' },
    timezone: { type: String, default: 'Asia/Tashkent' },

    phone: { type: String, default: '' },
    adminName: { type: String, default: '' },

    // Geolocation — restaurant point and allowed delivery/order radius (meters).
    // When location.lat/lng are set, public order submissions must come from
    // within `radius` meters of the point (Haversine distance check).
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    radius: { type: Number, default: 200 },

    // Auth
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true }, // AES-encrypted

    // Notifications
    notifSound: { type: Boolean, default: true },
    notifTelegram: { type: Boolean, default: false },
    notifEmail: { type: Boolean, default: false },

    // Web Push (FCM) — registered browser tokens for new-order notifications
    fcmTokens: { type: [String], default: [] },

    status: { type: String, enum: ['active', 'pending', 'blocked'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Restaurant', RestaurantSchema);
