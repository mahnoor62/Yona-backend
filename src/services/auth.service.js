'use strict';

const { supabaseAdmin, supabaseAnon } = require('../config/supabase');
const userService = require('./user.service');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const { hashPassword } = require('../utils/password');

function createHttpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Finds an orphaned Supabase auth user (exists in auth.users but has no
 * matching profile row) by scanning auth.users for a matching email.
 * Only called in the rare error-recovery path.
 */
async function findOrphanedAuthUser(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;

    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;

    if (data.users.length < perPage) break;
    page++;
  }

  return null;
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

async function signup({ username, email, password }) {
  const normalizedUsername = username.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  const [existingByUsername, existingByEmail] = await Promise.all([
    userService.getUserByUsername(normalizedUsername),
    userService.getUserByEmail(normalizedEmail),
  ]);

  if (existingByUsername) {
    if (existingByUsername.is_verified) {
      throw createHttpError(
        'This username is already taken. Please sign in to your existing account.',
        409,
      );
    }
    throw createHttpError(
      'This username is already registered but not yet verified. Please check your inbox and verify your email to complete sign up.',
      409,
    );
  }

  if (existingByEmail) {
    if (existingByEmail.is_verified) {
      throw createHttpError(
        'This email is already registered. Please sign in to your existing account.',
        409,
      );
    }
    throw createHttpError(
      'This email is already registered but not yet verified. Please check your inbox and verify your email to complete sign up.',
      409,
    );
  }

  let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: false,
  });

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? '';

    // Orphaned auth user: profile was deleted manually but auth.users row remains.
    // Detect, remove the stale auth record, and retry so the user can re-register.
    if (msg.includes('already been registered') || msg.includes('already registered')) {
      const orphan = await findOrphanedAuthUser(normalizedEmail);
      if (orphan) {
        await supabaseAdmin.auth.admin.deleteUser(orphan.id);
        const retry = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: false,
        });
        if (retry.error) throw new Error(`Failed to create auth user: ${retry.error.message}`);
        authData = retry.data;
      } else {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }
    } else {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }
  }

  const authUser = authData.user;

  // Hash the password and store it in the profile for retrieval in responses.
  const passwordHash = await hashPassword(password);

  try {
    await userService.createProfile(authUser.id, normalizedUsername, normalizedEmail, passwordHash);
  } catch (profileErr) {
    // Roll back the auth user if profile creation fails to prevent orphaned accounts.
    await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
    throw profileErr;
  }

  const verificationToken = await tokenService.createEmailVerificationToken(authUser.id);
  await emailService.sendVerificationEmail(normalizedEmail, verificationToken);

  return {
    userId: authUser.id,
    email: normalizedEmail,
    username: normalizedUsername,
    encrypted_password: passwordHash,
  };
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

async function verifyEmail(rawToken) {
  const result = await tokenService.verifyEmailToken(rawToken);

  if (!result.valid) {
    const err = new Error(result.reason);
    err.statusCode = 400;
    throw err;
  }

  const { tokenRecord } = result;

  // Confirm the user in Supabase Auth.
  const { error } = await supabaseAdmin.auth.admin.updateUserById(tokenRecord.user_id, {
    email_confirm: true,
  });

  if (error) throw new Error(`Failed to confirm email in auth: ${error.message}`);

  // Mark profile as verified and delete the token row (clean up storage).
  await Promise.all([
    userService.markProfileVerified(tokenRecord.user_id),
    tokenService.deleteEmailToken(tokenRecord.id),
  ]);
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

async function signin({ login, email: emailField, username: usernameField, password }) {
  // Accept login, email, or username — whichever the client sends.
  const identifier = (login || emailField || usernameField || '').toLowerCase().trim();
  let email;

  if (identifier.includes('@')) {
    const profile = await userService.getUserByEmail(identifier);
    if (!profile) {
      throw createHttpError('User does not exist. Please sign up.', 404);
    }
    email = profile.email;
  } else {
    const profile = await userService.getUserByUsername(identifier);
    if (!profile) {
      throw createHttpError('User does not exist. Please sign up.', 404);
    }
    email = profile.email;
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      throw createHttpError('Please verify your email before signing in.', 403);
    }
    throw createHttpError('Invalid credentials.', 401);
  }

  // Defensive double-check even if Supabase returns a session.
  if (!data.user.email_confirmed_at) {
    throw createHttpError('Please verify your email before signing in.', 403);
  }

  const profile = await userService.getProfileById(data.user.id);

  return {
    userId: data.user.id,
    email: data.user.email,
    username: profile?.username ?? null,
    encrypted_password: profile?.password_hash ?? null,
    access_token: data.session.access_token,
  };
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

async function forgotPassword({ email }) {
  const normalizedEmail = email.toLowerCase().trim();

  const profile = await userService.getUserByEmail(normalizedEmail);
  if (!profile) {
    throw createHttpError('No account found with this email address.', 404);
  }

  const resetToken = await tokenService.createPasswordResetToken(profile.id);
  await emailService.sendPasswordResetEmail(normalizedEmail, resetToken);
}

// ─── Reset Password ───────────────────────────────────────────────────────────

async function resetPassword({ token, password }) {
  const result = await tokenService.verifyPasswordResetToken(token);

  if (!result.valid) {
    const err = new Error(result.reason);
    err.statusCode = 400;
    throw err;
  }

  const { tokenRecord } = result;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(tokenRecord.user_id, {
    password,
  });

  if (error) throw new Error(`Failed to update password: ${error.message}`);

  await tokenService.markPasswordResetTokenUsed(tokenRecord.id);
}

module.exports = {
  signup,
  verifyEmail,
  signin,
  forgotPassword,
  resetPassword,
};
