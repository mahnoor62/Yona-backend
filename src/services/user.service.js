'use strict';

const { supabaseAdmin } = require('../config/supabase');

async function getUserByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email, is_verified')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`DB error looking up email: ${error.message}`);
  return data;
}

async function getUserByUsername(username) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email, is_verified')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`DB error looking up username: ${error.message}`);
  return data;
}

async function createProfile(userId, username, email, passwordHash) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password_hash: passwordHash,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create profile: ${error.message}`);
  return data;
}

async function getProfileById(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email, password_hash, avatar_body, avatar_hairstyle, avatar_head, avatar_top, avatar_bottom, avatar_shoes')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`DB error fetching profile: ${error.message}`);
  return data;
}

async function markProfileVerified(userId) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_verified: true })
    .eq('id', userId);

  if (error) throw new Error(`Failed to mark profile as verified: ${error.message}`);
}

async function updateAvatar(userId, { body, hairstyle, head, top, bottom, shoes }) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      avatar_body: body,
      avatar_hairstyle: hairstyle,
      avatar_head: head,
      avatar_top: top,
      avatar_bottom: bottom,
      avatar_shoes: shoes,
    })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update avatar: ${error.message}`);
  if (!data) throw new Error('Profile not found for avatar update.');
  return data;
}

module.exports = {
  getUserByEmail,
  getUserByUsername,
  createProfile,
  getProfileById,
  markProfileVerified,
  updateAvatar,
};
