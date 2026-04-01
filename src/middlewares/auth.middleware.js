'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { errorResponse } = require('../utils/responses');

/**
 * Bearer token authentication middleware.
 * Verifies the JWT with Supabase and attaches the decoded user to req.user.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return errorResponse(res, 'Authorization token required.', 401);
  }

  // Accept both "Bearer <token>" and plain "<token>"
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return errorResponse(res, 'Authorization token required.', 401);
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return errorResponse(res, 'Invalid or expired token.', 401);
  }

  req.user = data.user;
  next();
}

module.exports = authMiddleware;
