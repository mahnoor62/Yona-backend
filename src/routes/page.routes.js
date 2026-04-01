'use strict';

const { Router } = require('express');
const pageController = require('../controllers/page.controller');

const router = Router();

// Browser-facing HTML pages — no JSON responses on these routes.
router.get('/verify-email', pageController.verifyEmail);
router.get('/reset-password', pageController.getResetPasswordPage);

module.exports = router;
