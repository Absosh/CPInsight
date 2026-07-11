function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  const payload = {
    error: {
      message: status === 500 ? 'Internal server error' : error.message
    }
  };

  if (error.details) payload.error.details = error.details;
  if (status === 500 && process.env.NODE_ENV !== 'production') {
    payload.error.debug = error.message;
  }

  res.status(status).json(payload);
}

module.exports = errorHandler;
