'use strict';

const { Router } = require('express');
const avatarController = require('../controllers/avatar.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { validateAvatar } = require('../utils/validators');

const router = Router();

router.get('/me', authMiddleware, avatarController.getAvatar);
router.put('/me', authMiddleware, validate(validateAvatar), avatarController.setAvatar);

module.exports = router;
