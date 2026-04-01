'use strict';

const userService = require('../services/user.service');
const { successResponse, errorResponse } = require('../utils/responses');

// ─── GET /api/avatar/me ───────────────────────────────────────────────────────

async function getAvatar(req, res, next) {
  try {
    const profile = await userService.getProfileById(req.user.id);

    if (!profile) {
      return errorResponse(res, 'Profile not found.', 404);
    }

    return successResponse(res, 'Avatar retrieved.', {
      body: profile.avatar_body,
      hairstyle: profile.avatar_hairstyle,
      head: profile.avatar_head,
      top: profile.avatar_top,
      bottom: profile.avatar_bottom,
      shoes: profile.avatar_shoes,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/avatar/me ───────────────────────────────────────────────────────

async function setAvatar(req, res, next) {
  try {
    const { body, hairstyle, head, top, bottom, shoes } = req.body;
    const updated = await userService.updateAvatar(req.user.id, {
      body,
      hairstyle,
      head,
      top,
      bottom,
      shoes,
    });

    return successResponse(res, 'Avatar updated.', {
      body: updated.avatar_body,
      hairstyle: updated.avatar_hairstyle,
      head: updated.avatar_head,
      top: updated.avatar_top,
      bottom: updated.avatar_bottom,
      shoes: updated.avatar_shoes,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAvatar, setAvatar };
