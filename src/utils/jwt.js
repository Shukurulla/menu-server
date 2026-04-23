const jwt = require('jsonwebtoken');

function sign(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev', { expiresIn });
}

function verify(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev');
  } catch (e) {
    return null;
  }
}

module.exports = { sign, verify };
