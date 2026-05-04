const express = require('express');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const Category = require('../models/Category');
const Food = require('../models/Food');
const Order = require('../models/Order');
const QRCode = require('qrcode');
const { sendToRestaurant } = require('../utils/fcm');
const { haversineMeters, isValidCoord } = require('../utils/geo');

const router = express.Router();

// Get restaurant by slug or id + table context
router.get('/menu/:restaurantId/:tableSlug', async (req, res) => {
  const { restaurantId, tableSlug } = req.params;

  const rest = await Restaurant.findOne({
    $or: [{ _id: restaurantId.match(/^[0-9a-fA-F]{24}$/) ? restaurantId : null }, { slug: restaurantId }],
  }).select('-password');
  if (!rest) return res.status(404).json({ error: 'Ресторан не найден' });
  if (rest.status === 'blocked') return res.status(403).json({ error: 'Ресторан недоступен' });

  const table = await Table.findOne({ restaurant: rest._id, slug: tableSlug });
  if (!table) return res.status(404).json({ error: 'Стол не найден' });

  const [categories, foods, foodCounts] = await Promise.all([
    Category.find({ restaurant: rest._id }).sort({ order: 1 }),
    Food.find({ restaurant: rest._id, status: { $in: ['active', 'out'] } }).sort({ createdAt: -1 }),
    Order.aggregate([
      { $match: { restaurant: rest._id } },
      { $unwind: '$items' },
      { $group: { _id: '$items.food', count: { $sum: '$items.qty' } } },
    ]),
  ]);

  // Popularity-based sorting: most-ordered foods/categories first
  const countByFood = new Map(foodCounts.map((c) => [String(c._id), c.count]));
  const countByCategory = new Map();
  for (const f of foods) {
    const c = countByFood.get(String(f._id)) || 0;
    const catId = String(f.category);
    countByCategory.set(catId, (countByCategory.get(catId) || 0) + c);
  }

  const sortedFoods = [...foods].sort((a, b) => {
    const ca = countByFood.get(String(a._id)) || 0;
    const cb = countByFood.get(String(b._id)) || 0;
    if (cb !== ca) return cb - ca;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const sortedCategories = [...categories].sort((a, b) => {
    const ca = countByCategory.get(String(a._id)) || 0;
    const cb = countByCategory.get(String(b._id)) || 0;
    if (cb !== ca) return cb - ca;
    return (a.order || 0) - (b.order || 0);
  });

  res.json({
    restaurant: {
      id: rest._id,
      brandName: rest.brandName,
      logo: rest.logo,
      description: rest.description,
      currencySymbol: rest.currencySymbol,
      locale: rest.locale,
    },
    table: { id: table._id, name: table.name, number: table.number, slug: table.slug, kind: table.kind },
    categories: sortedCategories,
    foods: sortedFoods,
  });
});

// Submit order
router.post('/orders', async (req, res) => {
  try {
    const { restaurantId, tableId, items, comment = '', lat, lng } = req.body || {};
    if (!restaurantId || !tableId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Неверные данные' });
    }

    const rest = await Restaurant.findById(restaurantId);
    if (!rest || rest.status === 'blocked') return res.status(404).json({ error: 'Ресторан недоступен' });

    const table = await Table.findOne({ _id: tableId, restaurant: rest._id });
    if (!table) return res.status(404).json({ error: 'Стол не найден' });

    // Geolocation gate — clients must always send coordinates. If the restaurant
    // has set its own point + radius, the order must originate inside that radius.
    if (!isValidCoord(lat, lng)) {
      return res.status(400).json({ error: 'Геолокация обязательна. Разрешите доступ и попробуйте снова.', code: 'geo_required' });
    }
    const restLoc = rest.location || {};
    const hasRestLoc = isValidCoord(restLoc.lat, restLoc.lng);
    if (hasRestLoc) {
      const distance = haversineMeters(restLoc.lat, restLoc.lng, lat, lng);
      const radius = Number.isFinite(rest.radius) && rest.radius > 0 ? rest.radius : 200;
      if (distance > radius) {
        return res.status(403).json({
          error: `Вы находитесь вне зоны ресторана (${Math.round(distance)} м). Закажите, находясь в ресторане.`,
          code: 'geo_out_of_range',
          distance: Math.round(distance),
          radius,
        });
      }
    }

    // Validate and calculate items
    const foodIds = items.map((i) => i.food);
    const foods = await Food.find({ _id: { $in: foodIds }, restaurant: rest._id });
    const foodMap = new Map(foods.map((f) => [f._id.toString(), f]));

    let total = 0;
    const validatedItems = [];
    for (const it of items) {
      const f = foodMap.get(String(it.food));
      if (!f) continue;
      if (f.status !== 'active') continue;
      const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
      total += f.price * qty;
      validatedItems.push({ food: f._id, name: f.name, price: f.price, qty, image: f.image || null });
    }
    if (validatedItems.length === 0) return res.status(400).json({ error: 'Нет доступных позиций' });

    const lastOrder = await Order.findOne({ restaurant: rest._id }).sort({ number: -1 });
    const number = (lastOrder?.number || 1000) + 1;

    const order = await Order.create({
      restaurant: rest._id,
      table: table._id,
      tableName: `${table.name} ${table.number}`,
      items: validatedItems,
      comment: comment.slice(0, 500),
      total,
      currencySymbol: rest.currencySymbol,
      status: 'new',
      number,
    });

    // Web Push (FCM) — fire-and-forget
    sendToRestaurant(rest, {
      title: `Новый заказ · ${order.tableName}`,
      body: `${validatedItems.length} ${validatedItems.length === 1 ? 'позиция' : 'позиций'} · ${order.total.toLocaleString('ru-RU')} ${order.currencySymbol}`,
      tag: `order-${order._id}`,
      link: '/restaurant/orders',
      data: {
        orderId: order._id.toString(),
        orderNumber: order.number,
        total: order.total,
        tableName: order.tableName,
      },
    }).catch((e) => console.error('[fcm] new-order push failed:', e.message));

    res.status(201).json({
      id: order._id,
      number: order.number,
      total: order.total,
      currencySymbol: order.currencySymbol,
      items: order.items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// QR image for a table (PNG data url)
router.get('/qr/:restaurantId/:tableSlug.png', async (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const url = `${frontend}/menu/${req.params.restaurantId}/${req.params.tableSlug}`;
  const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
  res.type('image/png').send(png);
});

module.exports = router;
