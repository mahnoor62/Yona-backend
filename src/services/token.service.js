'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { generateSecureToken, hashToken } = require('../utils/crypto');

const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

// ─── Email Verification ──────────────────────────────────────────────────────

async function createEmailVerificationToken(userId) {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('email_verification_tokens')
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });

  if (error) throw new Error(`Failed to create verification token: ${error.message}`);

  return rawToken;
}

async function verifyEmailToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const { data, error } = await supabaseAdmin
    .from('email_verification_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw new Error(`DB error verifying email token: ${error.message}`);
  // Row missing means it never existed or was already consumed and deleted.
  if (!data) return { valid: false, reason: 'Invalid verification token.' };
  if (new Date(data.expires_at) < new Date()) return { valid: false, reason: 'This verification link has expired.' };

  return { valid: true, tokenRecord: data };
}

// Permanently deletes the token row after successful verification to keep storage clean.
async function deleteEmailToken(tokenId) {
  const { error } = await supabaseAdmin
    .from('email_verification_tokens')
    .delete()
    .eq('id', tokenId);

  if (error) throw new Error(`Failed to delete verification token: ${error.message}`);
}

// ─── Password Reset ───────────────────────────────────────────────────────────

async function createPasswordResetToken(userId) {
  // Invalidate all existing unused reset tokens for this user before creating a new one.
  await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null);

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('password_reset_tokens')
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });

  if (error) throw new Error(`Failed to create reset token: ${error.message}`);

  return rawToken;
}

async function verifyPasswordResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const { data, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw new Error(`DB error verifying reset token: ${error.message}`);
  if (!data) return { valid: false, reason: 'Invalid reset token.' };
  if (data.used_at) return { valid: false, reason: 'This reset link has already been used.' };
  if (new Date(data.expires_at) < new Date()) return { valid: false, reason: 'This reset link has expired.' };

  return { valid: true, tokenRecord: data };
}

async function markPasswordResetTokenUsed(tokenId) {
  const { error } = await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId);

  if (error) throw new Error(`Failed to mark reset token as used: ${error.message}`);
}

module.exports = {
  createEmailVerificationToken,
  verifyEmailToken,
  deleteEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  markPasswordResetTokenUsed,
};
