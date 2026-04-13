'use strict';

const buildingService = require('../services/building.service');

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

function roomForBuilding(buildingName) {
  return `building:${buildingName}`;
}

/**
 * Testers (e.g. PieHost) sometimes send JSON as a string, or wrap in an array.
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
function normalizePayload(raw) {
  if (Array.isArray(raw) && raw.length > 0) {
    return normalizePayload(raw[0]);
  }
  if (raw == null) return {};
  if (typeof raw === 'string') {
    let s = raw.trim();
    if (!s) return {};
    // PieHost Socket.IO tester sends "(JSON) {\"buildingName\":...}" — strip prefix so JSON.parse works.
    const piePrefix = /^\(JSON\)\s*/i;
    if (piePrefix.test(s)) {
      s = s.replace(piePrefix, '').trim();
    }
    try {
      const o = JSON.parse(s);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return /** @type {Record<string, unknown>} */ (raw);
  return {};
}

/**
 * @param {object} snapshot
 */
function biddingStatsFromSnapshot(snapshot) {
  const bids =
    snapshot.currentBids && typeof snapshot.currentBids === 'object' ? snapshot.currentBids : {};
  const players = Object.keys(bids);
  const totalVolume = players.reduce((sum, p) => sum + (Number(bids[p]) || 0), 0);
  return {
    bidderCount: players.length,
    totalVolume,
    currentBids: bids,
  };
}

/**
 * @param {object} snapshot
 * @param {{ playerId: string, amount: number, bidAt: string } | null} lastAction
 */
function wrapBuildingPayload(snapshot, lastAction = null) {
  return {
    snapshot,
    biddingStats: biddingStatsFromSnapshot(snapshot),
    lastAction,
  };
}

/**
 * PieHost and similar tools often print objects as [object Object]. Emit a string line too.
 * @param {import('socket.io').Socket} socket
 * @param {string} line
 */
function emitTesterReadableLine(socket, line) {
  socket.emit('building:error_line', line);
}

/**
 * PieHost prints objects as [object Object]. In development, duplicate as JSON string.
 * @param {import('socket.io').Socket} socket
 * @param {string} eventName
 * @param {object} data
 */
function emitObjectForTester(socket, eventName, data) {
  socket.emit(eventName, data);
  if (isDev) {
    try {
      socket.emit(`${eventName}_text`, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * @param {import('socket.io').Server} io
 * @param {string} room
 * @param {string} eventName
 * @param {object} data
 */
function broadcastObjectForTester(io, room, eventName, data) {
  io.to(room).emit(eventName, data);
  if (isDev) {
    try {
      const line = JSON.stringify(data);
      io.to(room).emit(`${eventName}_text`, line);
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * One-line summary for testers (PieHost) and game client logs.
 * @param {{ snapshot: { buildingName: string }, biddingStats: { bidderCount: number, totalVolume: number, currentBids: Record<string, number> }, lastAction: { playerId: string, amount: number, bidAt: string } | null }} out
 */
function buildBidSummaryLine(out) {
  const name = out.snapshot.buildingName;
  const n = out.biddingStats.bidderCount;
  const total = out.biddingStats.totalVolume;
  const bids = out.biddingStats.currentBids || {};
  const byPlayer = Object.entries(bids)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  const la = out.lastAction;
  const thisBid = la ? `${la.playerId}+${la.amount}@${la.bidAt}` : '';
  return `[bid] ${name} | players=${n} | totalInvested=${total} | byPlayer: ${byPlayer || '(none)'} | thisBid=${thisBid}`;
}

/**
 * @param {import('socket.io').Socket} socket
 * @param {string} event
 * @param {unknown} payload
 */
function logIncoming(socket, event, payload) {
  let summary = '';
  try {
    summary =
      typeof payload === 'string'
        ? payload.slice(0, 200)
        : JSON.stringify(payload).slice(0, 400);
  } catch {
    summary = String(payload);
  }
  console.log('[socket]', socket.id, event, 'payload=', summary);
}

/**
 * @param {import('socket.io').Server} io
 */
function registerBuildingSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
    });

    // Clients must LISTEN for this event after a bid. Emitting it does nothing useful.
    socket.on('building:bid_update', (payload) => {
      logIncoming(socket, 'building:bid_update (ignored)', payload);
      const msg =
        'Do not emit building:bid_update. The server sends it after building:place_bid. Listen for building:bid_update instead.';
      socket.emit('building:protocol_error', { message: msg });
      emitTesterReadableLine(socket, `[protocol_error] ${msg}`);
    });

    socket.on('building:join', async (payload, ack) => {
      logIncoming(socket, 'building:join', payload);
      try {
        const body = normalizePayload(payload);
        const buildingName =
          typeof body.buildingName === 'string' ? body.buildingName.trim() : '';
        if (!buildingName) {
          const errBody = {
            code: 'INVALID_INPUT',
            message:
              'buildingName is required. Emit JSON: {"buildingName":"NexusFinanceTower"} (valid JSON string or object).',
          };
          console.warn(`[socket] ${socket.id} building:join fail`, errBody);
          socket.emit('building:join_error', errBody);
          emitTesterReadableLine(socket, `[join_error] ${errBody.code}: ${errBody.message}`);
          if (typeof ack === 'function') ack({ ok: false, ...errBody });
          return;
        }

        await socket.join(roomForBuilding(buildingName));
        const snapshot = await buildingService.getBuildingSnapshot(buildingName);
        const out = wrapBuildingPayload(snapshot, null);
        console.log(
          `[socket] ${socket.id} building:join ok ${buildingName} bidders=${out.biddingStats.bidderCount}`,
        );
        emitObjectForTester(socket, 'building:snapshot', out);
        if (typeof ack === 'function') ack({ ok: true, ...out });
      } catch (err) {
        console.error(`[socket] ${socket.id} building:join`, err);
        const status = err.statusCode || 500;
        const code = status === 404 ? 'NOT_FOUND' : status === 400 ? 'INVALID_INPUT' : 'SERVER_ERROR';
        const errBody = { code, message: err.message || 'Failed to join building room.' };
        socket.emit('building:join_error', errBody);
        emitTesterReadableLine(socket, `[join_error] ${errBody.code}: ${errBody.message}`);
        if (typeof ack === 'function') ack({ ok: false, ...errBody });
      }
    });

    socket.on('building:place_bid', async (payload, ack) => {
      logIncoming(socket, 'building:place_bid', payload);
      try {
        const body = normalizePayload(payload);
        const buildingName = body.buildingName;
        const playerId = body.playerId;
        const amount = body.amount;
        const timestamp = body.timestamp;

        const snapshot = await buildingService.placeBidAndGetSnapshot({
          buildingName,
          playerId,
          amount,
          timestamp,
        });

        const bidAt =
          typeof timestamp === 'string' && timestamp.trim()
            ? new Date(timestamp).toISOString()
            : snapshot.lastBidAt;

        const lastAction = {
          playerId: typeof playerId === 'string' ? playerId.trim() : String(playerId),
          amount: typeof amount === 'number' ? amount : parseInt(String(amount), 10),
          bidAt,
        };

        const room = roomForBuilding(snapshot.buildingName);
        await socket.join(room);
        const out = wrapBuildingPayload(snapshot, lastAction);
        const summaryLine = buildBidSummaryLine(out);
        console.log(`[socket] ${socket.id} ${summaryLine}`);

        emitObjectForTester(socket, 'building:bid_success', out);
        broadcastObjectForTester(io, room, 'building:bid_update', out);
        io.to(room).emit('building:bid_summary_line', summaryLine);

        if (typeof ack === 'function') ack({ ok: true, ...out });
      } catch (err) {
        console.error(`[socket] ${socket.id} building:place_bid`, err);
        const status = err.statusCode || 500;
        const code =
          status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
        const errBody = { code, message: err.message || 'Bid could not be placed.' };
        socket.emit('building:bid_error', errBody);
        emitTesterReadableLine(socket, `[bid_error] ${errBody.code}: ${errBody.message}`);
        if (typeof ack === 'function') ack({ ok: false, ...errBody });
      }
    });
  });
}

module.exports = { registerBuildingSockets, roomForBuilding };
