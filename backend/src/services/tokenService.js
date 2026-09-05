const jwt = require('jsonwebtoken');
const env = require('../config/env');

class TokenService {
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return jwt.sign(payload, env.JWT.SECRET, {
      expiresIn: env.JWT.EXPIRES_IN,
    });
  }

  verifyToken(token) {
    return jwt.verify(token, env.JWT.SECRET);
  }
}

module.exports = new TokenService();
