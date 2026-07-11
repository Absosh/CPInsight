const HttpError = require('../utils/httpError');

function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      next(new HttpError(400, 'Validation failed', error.details.map((detail) => detail.message)));
      return;
    }
    req[property] = value;
    next();
  };
}

module.exports = validate;
