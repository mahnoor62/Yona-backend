'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const {
  validateSignup,
  validateSignin,
  validateForgotPassword,
} = require('../utils/validators');

const router = Router();

router.post('/signup', validate(validateSignup), authController.signup);
router.post('/signin', validate(validateSignin), authController.signin);
router.post('/forgot-password', validate(validateForgotPassword), authController.forgotPassword);

// reset-password handles its own validation because it must return
// either HTML (form submission) or JSON (API client) on errors.
router.post('/reset-password', authController.resetPassword);

module.exports = router;
