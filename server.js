'use strict';
require('dotenv').config();
// Load and validate all environment variables before anything else.
const http = require('http');
const { Server } = require('socket.io');
const env = require('./src/config/env');
const app = require('./src/app');
const { registerBuildingSockets } = require('./src/sockets/building.socket');

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:'*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  },
});

registerBuildingSockets(io);

const server = httpServer.listen(env.port, () => {
  console.log(`[server] Running on port ${env.port} (${env.nodeEnv})`);
  console.log(`[server] Base URL: ${env.appBaseUrl}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[server] Received ${signal}. Shutting down gracefully…`);
  io.close(() => {
    console.log('[server] Socket.IO closed.');
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
  });
  // Force exit after 10 seconds if graceful shutdown hangs.
  setTimeout(() => {
    console.error('[server] Forced exit after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});
