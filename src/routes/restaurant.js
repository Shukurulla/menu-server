const express = require('express');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const Category = require('../models/Category');
const Food = require('../models/Food');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/aes');
const { REGIONS } = require('../config/regions');

const router = express.Router();

router.use(auth('restaurant'));

// Me (profile)
router.get('/me', async (req, res) => {
  const rest = await Restaurant.findById(req.user.id).select('-password');
  if (!rest) return res.status(404).json({ error: 'Не найдено' });
  res.json(rest);
});

// Update profile
router.patch('/me', async (req, res) => {
  const allowed = [
    'brandName', 'logo', 'description', 'address', 'workingHours', 'instagram',
    'phone', 'phonePrefix', 'adminName',
    'currency', 'currencySymbol', 'phoneFormat', 'locale', 'timezone',
    'notifSound', 'notifTelegram', 'notifEmail',
  ];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];
  const rest = await Restaurant.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
  res.json(rest);
});

// Change password
router.post('/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const rest = await Restaurant.findById(req.user.id);
  if (!rest) return res.status(404).json({ error: 'Не найдено' });
  if (decrypt(rest.password) !== oldPassword) return res.status(400).json({ error: 'Старый пароль неверный' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Пароль слишком короткий' });
  rest.password = encrypt(newPassword);
  await rest.save();
  res.json({ ok: true });
});

// Dashboard stats
router.get('/stats', async (req, res) => {
  const restaurant = req.user.id;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todayCount, newCount, tableCount] = await Promise.all([
    Order.countDocuments({ restaurant, createdAt: { $gte: today } }),
    Order.countDocuments({ restaurant, status: 'new' }),
    Table.countDocuments({ restaurant }),
  ]);
  const recent = await Order.find({ restaurant }).sort({ createdAt: -1 }).limit(5);
  const topFoods = await Order.aggregate([
    { $match: { restaurant: new (require('mongoose').Types.ObjectId)(restaurant) } },
    { $unwind: '$items' },
    { $group: { _id: '$items.food', name: { $first: '$items.name' }, qty: { $sum: '$items.qty' } } },
    { $sort: { qty: -1 } },
    { $limit: 4 },
  ]);
  res.json({ todayCount, newCount, tableCount, recent, topFoods });
});

// === TABLES ===
router.get('/tables', async (req, res) => {
  const list = await Table.find({ restaurant: req.user.id }).sort({ createdAt: 1 });
  res.json(list);
});

router.post('/tables', async (req, res) => {
  const { kind = 'table', name, number } = req.body || {};
  if (!name || !number) return res.status(400).json({ error: 'name и number обязательны' });
  const prefix = kind === 'room' ? 'X' : 'T';
  const slug = `${prefix}-${number}`;
  try {
    const t = await Table.create({ restaurant: req.user.id, kind, name, number, slug });
    res.status(201).json(t);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Такой номер уже существует' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/tables/:id', async (req, res) => {
  const { name, number, kind } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = name;
  if (number !== undefined) update.number = number;
  if (kind !== undefined) update.kind = kind;
  if (update.number || update.kind) {
    const cur = await Table.findOne({ _id: req.params.id, restaurant: req.user.id });
    if (!cur) return res.status(404).json({ error: 'Не найдено' });
    const prefix = (update.kind || cur.kind) === 'room' ? 'X' : 'T';
    update.slug = `${prefix}-${update.number || cur.number}`;
  }
  const t = await Table.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.id }, update, { new: true });
  if (!t) return res.status(404).json({ error: 'Не найдено' });
  res.json(t);
});

router.delete('/tables/:id', async (req, res) => {
  await Table.findOneAndDelete({ _id: req.params.id, restaurant: req.user.id });
  res.json({ ok: true });
});

// === CATEGORIES ===
router.get('/categories', async (req, res) => {
  const list = await Category.find({ restaurant: req.user.id }).sort({ order: 1 });
  res.json(list);
});

router.post('/categories', async (req, res) => {
  const { name, emoji, order = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name обязателен' });
  const c = await Category.create({ restaurant: req.user.id, name, emoji, order });
  res.status(201).json(c);
});

router.patch('/categories/:id', async (req, res) => {
  const c = await Category.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.id }, req.body, { new: true });
  res.json(c);
});

router.delete('/categories/:id', async (req, res) => {
  await Category.findOneAndDelete({ _id: req.params.id, restaurant: req.user.id });
  await Food.deleteMany({ category: req.params.id, restaurant: req.user.id });
  res.json({ ok: true });
});

// === FOODS ===
router.get('/foods', async (req, res) => {
  const filter = { restaurant: req.user.id };
  if (req.query.category) filter.category = req.query.category;
  const list = await Food.find(filter).sort({ createdAt: -1 });
  res.json(list);
});

router.post('/foods', async (req, res) => {
  const { category, name, description = '', price, image = null } = req.body || {};
  if (!category || !name || price == null) return res.status(400).json({ error: 'category, name, price обязательны' });
  const f = await Food.create({ restaurant: req.user.id, category, name, description, price, image });
  res.status(201).json(f);
});

router.patch('/foods/:id', async (req, res) => {
  const allowed = ['name', 'description', 'price', 'image', 'status', 'category'];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];
  const f = await Food.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.id }, update, { new: true });
  res.json(f);
});

router.delete('/foods/:id', async (req, res) => {
  await Food.findOneAndDelete({ _id: req.params.id, restaurant: req.user.id });
  res.json({ ok: true });
});


// === IMAGE UPLOAD ===
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/foods'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Только изображения'));
  },
});

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  res.json({ url: '/uploads/foods/' + req.file.filename });
});

// === FCM TOKENS (web push) ===
router.post('/fcm-token', async (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.length < 20) {
    return res.status(400).json({ error: 'token обязателен' });
  }
  const rest = await Restaurant.findById(req.user.id);
  if (!rest) return res.status(404).json({ error: 'Не найдено' });
  if (!rest.fcmTokens.includes(token)) {
    rest.fcmTokens.push(token);
    if (rest.fcmTokens.length > 20) rest.fcmTokens = rest.fcmTokens.slice(-20);
    await rest.save();
  }
  res.json({ ok: true, count: rest.fcmTokens.length });
});

router.delete('/fcm-token', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token обязателен' });
  await Restaurant.findByIdAndUpdate(req.user.id, { $pull: { fcmTokens: token } });
  res.json({ ok: true });
});

// === ORDERS ===
router.get('/orders', async (req, res) => {
  const list = await Order.find({ restaurant: req.user.id }).sort({ createdAt: -1 }).limit(200);

  // Fill in missing item images from Food collection (for orders created before image was added)
  const foodIds = [...new Set(list.flatMap((o) => o.items.map((i) => i.food?.toString()).filter(Boolean)))];
  const foods = await Food.find({ _id: { $in: foodIds } }).select('_id image');
  const imgMap = new Map(foods.map((f) => [f._id.toString(), f.image || null]));

  const withImages = list.map((o) => ({
    ...o.toObject(),
    items: o.items.map((i) => ({
      ...i.toObject(),
      image: i.image || imgMap.get(i.food?.toString()) || null,
    })),
  }));

  res.json(withImages);
});

router.post('/orders/:id/seen', async (req, res) => {
  const o = await Order.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.user.id },
    { status: 'seen', seenAt: new Date() },
    { new: true }
  );
  if (!o) return res.status(404).json({ error: 'Не найдено' });
  res.json(o);
});

module.exports = router;
