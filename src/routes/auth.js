const express = require('express');
const SystemAdmin = require('../models/SystemAdmin');
const Restaurant = require('../models/Restaurant');
const { decrypt } = require('../utils/aes');
const { sign } = require('../utils/jwt');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  const normalEmail = String(email).toLowerCase();

  const admin = await SystemAdmin.findOne({ email: normalEmail });
  if (admin) {
    if (decrypt(admin.password) !== password) return res.status(401).json({ error: 'Неверные данные' });
    const token = sign({ id: admin._id.toString(), role: 'system', email: admin.email });
    return res.json({ token, user: { id: admin._id, email: admin.email, role: 'system', name: admin.name } });
  }

  const rest = await Restaurant.findOne({ email: normalEmail });
  if (rest) {
    if (rest.status === 'blocked') return res.status(403).json({ error: 'Ресторан заблокирован' });
    if (decrypt(rest.password) !== password) return res.status(401).json({ error: 'Неверные данные' });
    const token = sign({ id: rest._id.toString(), role: 'restaurant', email: rest.email });
    return res.json({ token, user: { id: rest._id, email: rest.email, role: 'restaurant', brandName: rest.brandName, slug: rest.slug } });
  }

  res.status(401).json({ error: 'Неверные данные' });
});

module.exports = router;
