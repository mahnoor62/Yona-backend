'use strict';

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

module.exports = { hashPassword, verifyPassword };
