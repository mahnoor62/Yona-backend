'use strict';

const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const html = require('../utils/html');

// ─── GET /auth/verify-email?token=... ────────────────────────────────────────

async function verifyEmail(req, res) {
  const { token } = req.query;

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).send(html.renderVerificationFailed('No verification token was provided.'));
  }

  try {
    await authService.verifyEmail(token.trim());
    return res.status(200).send(html.renderVerificationSuccess());
  } catch (err) {
    return res.status(400).send(html.renderVerificationFailed(err.message));
  }
}

// ─── GET /auth/reset-password?token=... ──────────────────────────────────────

async function getResetPasswordPage(req, res) {
  const { token } = req.query;

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).send(html.renderResetFailed('No reset token was provided.'));
  }

  const result = await tokenService.verifyPasswordResetToken(token.trim());

  if (!result.valid) {
    return res.status(400).send(html.renderResetFailed(result.reason));
  }

  return res.status(200).send(html.renderResetPasswordForm(token.trim()));
}

module.exports = { verifyEmail, getResetPasswordPage };
