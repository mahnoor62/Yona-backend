'use strict';

const transporter = require('../config/mailer');
const env = require('../config/env');

async function sendVerificationEmail(toEmail, rawToken) {
  const verifyUrl = `${env.appBaseUrl}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  await transporter.sendMail({
    from: env.smtp.from,
    to: toEmail,
    subject: 'Email Verification for Sign Up — Yona',
    html: buildVerificationHtml(verifyUrl),
  });
}

async function sendPasswordResetEmail(toEmail, rawToken) {
  const resetUrl = `${env.appBaseUrl}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

  await transporter.sendMail({
    from: env.smtp.from,
    to: toEmail,
    subject: 'Password Reset Request — Yona',
    html: buildPasswordResetHtml(resetUrl),
  });
}

// ─── Email HTML Templates ─────────────────────────────────────────────────────

function emailShell(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background:#0d0f18;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Yona</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6;">
                You received this email because an action was performed on your Yona account.<br />
                If you did not initiate this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationHtml(verifyUrl) {
  const body = `
    <h2 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 12px;letter-spacing:-0.3px;">Verification for Sign Up</h2>
    <p style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 28px;">
      Welcome to Yona! Please confirm your email address to activate your account.
      This link expires in <strong>24 hours</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${verifyUrl}"
             style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
            Verify Email Address
          </a>
        </td>
      </tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;text-align:center;">
      Button not working? Copy and paste this link into your browser:<br />
      <a href="${verifyUrl}" style="color:#6366f1;word-break:break-all;">${verifyUrl}</a>
    </p>`;

  return emailShell('Email Verification for Sign Up — Yona', body);
}

function buildPasswordResetHtml(resetUrl) {
  const body = `
    <h2 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 12px;letter-spacing:-0.3px;">Password Reset Request</h2>
    <p style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 28px;">
      We received a request to reset the password for your Yona account.
      Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${resetUrl}"
             style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;text-align:center;">
      Button not working? Copy and paste this link into your browser:<br />
      <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
    </p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:20px 0 0;text-align:center;">
      If you did not request a password reset, no action is needed — your password will remain unchanged.
    </p>`;

  return emailShell('Password Reset Request — Yona', body);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
