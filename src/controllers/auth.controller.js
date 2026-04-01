'use strict';

const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const { successResponse } = require('../utils/responses');
const html = require('../utils/html');
const { validateResetPassword } = require('../utils/validators');

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body);
    return successResponse(res, 'Signup successful. Please verify your email.', result, 201);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/signin ────────────────────────────────────────────────────

async function signin(req, res, next) {
  try {
    const result = await authService.signin(req.body);
    return successResponse(res, 'Signin successful.', result);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

async function forgotPassword(req, res, next) {
  try {
    await authService.forgotPassword(req.body);
    return successResponse(res, 'Password reset link sent successfully. Please check your inbox.');
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
// Handles both JSON (API clients) and form submissions (from the HTML reset page).

async function resetPassword(req, res, next) {
  const { token, password, confirmPassword } = req.body;
  const isForm = req.is('application/x-www-form-urlencoded');

  const errors = validateResetPassword({ token, password, confirmPassword });
  if (errors.length > 0) {
    if (isForm) {
      return res.status(422).send(html.renderResetPasswordForm(token || '', errors.join(' ')));
    }
    return res.status(422).json({ success: false, message: 'Validation failed.', errors });
  }

  try {
    await authService.resetPassword({ token, password });

    if (isForm) {
      return res.status(200).send(html.renderResetSuccess());
    }
    return successResponse(res, 'Password has been reset successfully.');
  } catch (err) {
    if (isForm) {
      return res.status(400).send(html.renderResetFailed(err.message));
    }
    next(err);
  }
}

module.exports = { signup, signin, forgotPassword, resetPassword };
