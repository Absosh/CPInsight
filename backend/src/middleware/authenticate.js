const userRepository = require('../repositories/userRepository');
const HttpError = require('../utils/httpError');
const { verifyAccessToken } = require('../utils/token');

module.exports = async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Missing bearer token');

    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.sub);
    if (!user) throw new HttpError(401, 'User no longer exists');

    req.user = { id: user.id, username: user.username, email: user.email };
    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, 'Invalid access token'));
  }
};
