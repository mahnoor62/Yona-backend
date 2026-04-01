'use strict';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderShell(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0d0f18;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #161926;
      border: 1px solid #252840;
      border-radius: 16px;
      padding: 52px 44px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
    }
    .icon-success { background: rgba(52, 211, 153, 0.15); }
    .icon-error   { background: rgba(248, 113, 113, 0.15); }
    .icon-neutral { background: rgba(99, 102, 241, 0.15); }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 12px;
      color: #f1f5f9;
      letter-spacing: -0.3px;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.65;
      margin-bottom: 0;
    }
    p + p { margin-top: 8px; }
    .form-wrapper { text-align: left; margin-top: 28px; }
    .form-group { margin-bottom: 20px; }
    label {
      display: block;
      font-size: 0.83rem;
      font-weight: 600;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      background: #0d0f18;
      border: 1px solid #252840;
      border-radius: 10px;
      color: #e2e8f0;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="password"]:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    .alert-error {
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.3);
      border-radius: 8px;
      color: #f87171;
      font-size: 0.875rem;
      padding: 12px 16px;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 13px;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      letter-spacing: 0.2px;
    }
    .btn:hover  { opacity: 0.88; }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: #6366f1; color: #fff; margin-top: 4px; }
    .hint {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 18px;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    ${content}
  </div>
</body>
</html>`;
}

function renderVerificationSuccess() {
  return renderShell('Email Verified — Yona', `
    <div class="icon icon-success">✓</div>
    <h1>Email Verified!</h1>
    <p>Your email address has been successfully verified.</p>
    <p>You can now sign in to your account.</p>
  `);
}

function renderVerificationFailed(reason) {
  const safeReason = reason
    ? escapeHtml(reason)
    : 'The verification link is invalid or has expired.';

  return renderShell('Verification Failed — Yona', `
    <div class="icon icon-error">✕</div>
    <h1>Verification Failed</h1>
    <p>${safeReason}</p>
    <p>Please request a new verification email or contact support.</p>
  `);
}

function renderResetPasswordForm(token, errorMessage) {
  const errorBlock = errorMessage
    ? `<div class="alert-error">${escapeHtml(errorMessage)}</div>`
    : '';

  return renderShell('Reset Password — Yona', `
    <div class="icon icon-neutral">🔒</div>
    <h1>Reset Your Password</h1>
    <p>Choose a strong new password for your account.</p>
    <div class="form-wrapper">
      ${errorBlock}
      <form method="POST" action="/api/auth/reset-password">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />

        <div class="form-group">
          <label for="password">New Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="new-password"
            placeholder="Min. 8 chars, mixed case + number + symbol"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            autocomplete="new-password"
            placeholder="Re-enter your new password"
          />
        </div>

        <button type="submit" class="btn btn-primary">Reset Password</button>
      </form>
      <p class="hint">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</p>
    </div>
  `);
}

function renderResetSuccess() {
  return renderShell('Password Reset — Yona', `
    <div class="icon icon-success">✓</div>
    <h1>Password Updated!</h1>
    <p>Your password has been successfully reset.</p>
    <p>You can now sign in with your new password.</p>
  `);
}

function renderResetFailed(reason) {
  const safeReason = reason
    ? escapeHtml(reason)
    : 'The reset link is invalid or has expired.';

  return renderShell('Reset Failed — Yona', `
    <div class="icon icon-error">✕</div>
    <h1>Reset Failed</h1>
    <p>${safeReason}</p>
    <p>Please request a new password reset link.</p>
  `);
}

module.exports = {
  renderVerificationSuccess,
  renderVerificationFailed,
  renderResetPasswordForm,
  renderResetSuccess,
  renderResetFailed,
};
