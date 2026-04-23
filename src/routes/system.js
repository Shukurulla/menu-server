const express = require('express');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const Category = require('../models/Category');
const Food = require('../models/Food');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/aes');
const { getRegion, REGIONS } = require('../config/regions');

const router = express.Router();

router.use(auth('system'));

// Regions list
router.get('/regions', (req, res) => {
  res.json(Object.values(REGIONS));
});

// Dashboard stats
router.get('/stats', async (req, res) => {
  const [total, active, pending, blocked] = await Promise.all([
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ status: 'active' }),
    Restaurant.countDocuments({ status: 'pending' }),
    Restaurant.countDocuments({ status: 'blocked' }),
  ]);
  res.json({ total, active, pending, blocked });
});

// List restaurants
router.get('/restaurants', async (req, res) => {
  const { q, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.$or = [{ brandName: new RegExp(q, 'i') }, { address: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
  const list = await Restaurant.find(filter).sort({ createdAt: -1 }).select('-password');
  res.json(list);
});

// Get restaurant details + decrypted password
router.get('/restaurants/:id', async (req, res) => {
  const rest = await Restaurant.findById(req.params.id);
  if (!rest) return res.status(404).json({ error: 'Не найдено' });

  const [tables, categories, foods] = await Promise.all([
    Table.countDocuments({ restaurant: rest._id }),
    Category.countDocuments({ restaurant: rest._id }),
    Food.countDocuments({ restaurant: rest._id }),
  ]);

  res.json({
    ...rest.toObject(),
    password: undefined,
    passwordPlain: decrypt(rest.password),
    counts: { tables, categories, foods },
  });
});

// Create restaurant
router.post('/restaurants', async (req, res) => {
  try {
    const { brandName, email, password, region = 'UZ', phone, address, logo, description } = req.body || {};
    if (!brandName || !email || !password) {
      return res.status(400).json({ error: 'brandName, email, password обязательны' });
    }

    const exists = await Restaurant.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Email уже используется' });

    const r = getRegion(region);
    const slug = (brandName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const rest = await Restaurant.create({
      brandName,
      slug,
      email: String(email).toLowerCase(),
      password: encrypt(password),
      region: r.code,
      phonePrefix: r.phonePrefix,
      phoneFormat: r.phoneFormat,
      currency: r.currency,
      currencySymbol: r.currencySymbol,
      locale: r.locale,
      timezone: r.timezone,
      phone: phone || '',
      address: address || '',
      logo: logo || null,
      description: description || '',
      status: 'active',
    });

    res.status(201).json({ ...rest.toObject(), password: undefined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update restaurant (system-level: region, status)
router.patch('/restaurants/:id', async (req, res) => {
  const allowed = ['brandName', 'region', 'status', 'address', 'phone', 'logo'];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];

  if (update.region) {
    const r = getRegion(update.region);
    update.phonePrefix = r.phonePrefix;
    update.phoneFormat = r.phoneFormat;
    update.currency = r.currency;
    update.currencySymbol = r.currencySymbol;
    update.locale = r.locale;
    update.timezone = r.timezone;
  }

  const rest = await Restaurant.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
  if (!rest) return res.status(404).json({ error: 'Не найдено' });
  res.json(rest);
});

// Reset password
router.post('/restaurants/:id/reset-password', async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль слишком короткий' });
  const rest = await Restaurant.findByIdAndUpdate(req.params.id, { password: encrypt(password) }, { new: true });
  if (!rest) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

// Delete restaurant
router.delete('/restaurants/:id', async (req, res) => {
  const id = req.params.id;
  await Promise.all([
    Restaurant.findByIdAndDelete(id),
    Table.deleteMany({ restaurant: id }),
    Category.deleteMany({ restaurant: id }),
    Food.deleteMany({ restaurant: id }),
    Order.deleteMany({ restaurant: id }),
  ]);
  res.json({ ok: true });
});

module.exports = router;
