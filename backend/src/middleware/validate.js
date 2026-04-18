'use strict';
const { ZodError } = require('zod');

/**
 * Zod validation middleware factory.
 * Usage: router.post('/path', validate(schema), handler)
 * Can validate body, query, or params.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = source === 'query'  ? req.query
                 : source === 'params' ? req.params
                 : req.body;

      const parsed = schema.parse(data);

      // Replace with parsed (coerced + defaulted) values
      if (source === 'query')  req.query  = parsed;
      else if (source === 'params') req.params = parsed;
      else req.body = parsed;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map(e => ({
          field:   e.path.join('.') || 'root',
          message: e.message,
        }));
        return res.status(400).json({
          success: false,
          message: 'Validation failed. Please check your input.',
          errors,
        });
      }
      next(err);
    }
  };
}

module.exports = validate;
