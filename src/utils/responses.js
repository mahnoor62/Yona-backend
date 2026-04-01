/**
 * Sends a standardized JSON success response.
 */
function successResponse(res, message, data = null, statusCode = 200) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  return res.status(statusCode).json(body);
}

/**
 * Sends a standardized JSON error response.
 */
function errorResponse(res, message, statusCode = 400, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { successResponse, errorResponse };
