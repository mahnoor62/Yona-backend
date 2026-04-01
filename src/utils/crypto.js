const crypto = require('crypto');

/**
 * Generates a cryptographically secure 64-character hex token.
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a token with SHA-256. Only the hash is stored in the database.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateSecureToken, hashToken };
