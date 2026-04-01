'use strict';

const env = require('../config/env');

/**
 * Centralized Express error handler.
 * Must be registered last in the middleware chain (after all routes).
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  const isProduction = env.nodeEnv === 'production';
  const message =
    statusCode === 500 && isProduction ? 'An unexpected error occurred.' : err.message || 'An unexpected error occurred.';

  const body = { success: false, message };

  res.status(statusCode).json(body);
}

module.exports = errorMiddleware;
