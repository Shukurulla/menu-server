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
const fs = require('fs');
const fsp = require('fs/promises');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/foods');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const okExt = /\.(jpe?g|png|webp|gif|hei[cf]|avif|bmp|tiff?|svg|jfif)$/.test(ext);
    if (mt.startsWith('image/') || okExt) cb(null, true);
    else cb(new Error('Только изображения'));
  },
});

async function decodeBuffer(buf, mimetype, originalName) {
  const mt = (mimetype || '').toLowerCase();
  const ext = path.extname(originalName || '').toLowerCase();
  const isHeic = /heic|heif/.test(mt) || /\.(hei[cf])$/.test(ext);
  if (!isHeic) return buf;
  try {
    return Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.92 }));
  } catch (e) {
    // Fallback — sharp may have heif support compiled in
    return buf;
  }
}

router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const decoded = await decodeBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
    const filename = crypto.randomBytes(12).toString('hex') + '.jpg';
    const outPath = path.join(UPLOAD_DIR, filename);
    await sharp(decoded)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(outPath);
    res.json({ url: '/uploads/foods/' + filename });
  } catch (e) {
    console.error('[upload] conversion failed:', e.message);
    res.status(500).json({ error: 'Не удалось обработать изображение' });
  }
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
