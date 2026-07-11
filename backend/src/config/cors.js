const env = require('./env');

function corsOptions() {
  return {
    origin(origin, callback) {
      if (!origin || env.env !== 'production' || env.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true
  };
}

module.exports = corsOptions;
