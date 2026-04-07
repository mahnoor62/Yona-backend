const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]).{8,}$/;

function validateSignup({ username, email, password } = {}) {
  const errors = [];

  if (!username || typeof username !== 'string') {
    errors.push('Username is required.');
  } else if (!USERNAME_REGEX.test(username.toLowerCase())) {
    errors.push('Username must be 3–30 characters and contain only lowercase letters, numbers, or underscores.');
  }

  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.push(
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
    );
  }

  return errors;
}

function validateSignin({ login, email, username, password } = {}) {
  const errors = [];

  // Accept `login`, `email`, or `username` — at least one must be present.
  const identifier = login || email || username;
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    errors.push('Email or username is required.');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('Password is required.');
  }

  return errors;
}

function validateForgotPassword({ email } = {}) {
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('A valid email address is required.');
  }

  return errors;
}

function validateResetPassword({ token, password, confirmPassword } = {}) {
  const errors = [];

  if (!token || typeof token !== 'string' || !token.trim()) {
    errors.push('Reset token is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.push(
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
    );
  }

  if (!confirmPassword || typeof confirmPassword !== 'string') {
    errors.push('Confirm password is required.');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  return errors;
}

function validateAvatar({ body, hairstyle, head, top, bottom, shoes } = {}) {
  const errors = [];
  const fields = { body, hairstyle, head, top, bottom, shoes };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      errors.push(`${key} is required.`);
      continue;
    }

    // Avatar values are now stored as strings.
    const normalized = String(value).trim();
    if (!normalized) {
      errors.push(`${key} must be a non-empty string.`);
    }
  }

  return errors;
}

module.exports = {
  validateSignup,
  validateSignin,
  validateForgotPassword,
  validateResetPassword,
  validateAvatar,
};
