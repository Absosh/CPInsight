const userRepository = require('../../repositories/userRepository');
const { verifyAccessToken } = require('../../utils/token');

class WebSocketAuthenticator {
  constructor({ users = userRepository } = {}) {
    this.users = users;
  }

  async authenticate(requestUrl, headers = {}) {
    const token = this.extractToken(requestUrl, headers);
    if (!token) {
      const error = new Error('Missing access token');
      error.code = 'REALTIME_AUTH_MISSING_TOKEN';
      throw error;
    }
    const decoded = verifyAccessToken(token);
    const user = await this.users.findById(decoded.sub);
    if (!user) {
      const error = new Error('User no longer exists');
      error.code = 'REALTIME_AUTH_USER_NOT_FOUND';
      throw error;
    }
    return Object.freeze({
      id: user.id,
      username: user.username,
      tokenExpiresAt: decoded.exp ? decoded.exp * 1000 : null
    });
  }

  extractToken(requestUrl, headers) {
    const authHeader = headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme === 'Bearer' && token) return token;

    const url = new URL(requestUrl, 'http://localhost');
    return url.searchParams.get('token');
  }
}

module.exports = { WebSocketAuthenticator };
