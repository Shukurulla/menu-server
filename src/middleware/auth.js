const { verify } = require('../utils/jwt');

function auth(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Нет токена' });

    const payload = verify(token);
    if (!payload) return res.status(401).json({ error: 'Невалидный токен' });

    if (allowed.length && !allowed.includes(payload.role)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    req.user = payload;
    next();
  };
}

module.exports = auth;
