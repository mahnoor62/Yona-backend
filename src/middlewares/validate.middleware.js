'use strict';

const { errorResponse } = require('../utils/responses');

/**
 * Factory that wraps a validator function into Express middleware.
 * The validator receives req.body and returns an array of error strings.
 * If the array is non-empty, responds with 422 and the errors list.
 *
 * Usage:
 *   router.post('/signup', validate(validateSignup), authController.signup);
 */
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body);
    if (errors.length > 0) {
      return errorResponse(res, 'Validation failed.', 422, errors);
    }
    next();
  };
}

module.exports = validate;
