'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const avatarRoutes = require('./routes/avatar.routes');
const pageRoutes = require('./routes/page.routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow inline styles for server-rendered HTML pages.
        styleSrc: ["'self'", "'unsafe-inline'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        // Allow inline scripts for backend-rendered HTML pages (eye-toggle etc).
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));
// Required for form submissions from the password-reset HTML page.
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  skipSuccessfulRequests: false,
});

app.use('/api/auth', authRateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/auth', pageRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running.' });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;
