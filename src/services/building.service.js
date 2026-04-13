'use strict';

const buildingRepository = require('../repositories/building.repository');

function createHttpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * @param {string|number|null|undefined} v
 * @returns {number|null}
 */
function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} row
 * @param {Record<string, number>} currentBids
 */
function mapRowToSnapshot(row, currentBids) {
  const lastWinner =
    row.last_winner_username != null &&
    row.last_winner_payout != null &&
    row.last_winner_bid != null &&
    row.last_winner_resolved_at != null
      ? {
          username: row.last_winner_username,
          payout: row.last_winner_payout,
          bid: row.last_winner_bid,
          resolvedAt: new Date(row.last_winner_resolved_at).toISOString(),
        }
      : null;

  const cd = toNumberOrNull(row.countdown_days);

  return {
    buildingName: row.name,
    rewardValue: row.reward_value,
    minBuyIn: row.min_buy_in,
    capValue: row.cap_value,
    type: row.type,
    status: row.status,
    state: row.state,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    countdownDays: cd,
    maxSnipeCount: row.max_snipe_count,
    constructionTime: row.construction_time,
    lastBidAt: row.last_bid_at ? new Date(row.last_bid_at).toISOString() : null,
    lastWinner,
    currentBids,
  };
}

function buildCurrentBidsFromTotals(rows) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const r of rows) {
    const amt = typeof r.total_amount === 'string' ? parseInt(r.total_amount, 10) : Number(r.total_amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    out[r.player_id] = amt;
  }
  return out;
}

/**
 * @param {string} buildingName
 */
async function getBuildingSnapshot(buildingName) {
  if (!buildingName || typeof buildingName !== 'string' || !buildingName.trim()) {
    throw createHttpError('buildingName is required.', 400);
  }

  const row = await buildingRepository.findBuildingByName(buildingName.trim());
  if (!row) {
    throw createHttpError('Building not found.', 404);
  }

  const totals = await buildingRepository.listBidTotalsForBuildingIds([row.id]);
  const mine = totals.filter((t) => String(t.building_id) === String(row.id));
  const currentBids = buildCurrentBidsFromTotals(mine);

  return mapRowToSnapshot(row, currentBids);
}

/**
 * @param {{ buildingName: string, playerId: string, amount: number, timestamp: string }} payload
 */
async function placeBidAndGetSnapshot({ buildingName, playerId, amount, timestamp }) {
  if (!buildingName || typeof buildingName !== 'string' || !buildingName.trim()) {
    throw createHttpError('buildingName is required.', 400);
  }
  if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
    throw createHttpError('playerId is required.', 400);
  }
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    throw createHttpError('amount is required.', 400);
  }

  const amt = typeof amount === 'string' ? parseInt(amount, 10) : Math.trunc(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    throw createHttpError('amount must be a positive integer.', 400);
  }

  if (!timestamp || typeof timestamp !== 'string') {
    throw createHttpError('timestamp is required (ISO 8601 string).', 400);
  }

  const bidDate = new Date(timestamp);
  if (Number.isNaN(bidDate.getTime())) {
    throw createHttpError('timestamp must be a valid ISO 8601 date.', 400);
  }

  const trimmedName = buildingName.trim();
  const trimmedPlayer = playerId.trim();
  const bidAtIso = bidDate.toISOString();

  const result = await buildingRepository.placeBuildingBidAtomic(trimmedName, trimmedPlayer, amt, bidAtIso);

  if (!result || typeof result !== 'object') {
    throw createHttpError('Unexpected response from database.', 500);
  }

  if (!result.ok) {
    const code = result.code || 'BID_REJECTED';
    const message = result.message || 'Bid could not be placed.';
    if (code === 'NOT_FOUND') throw createHttpError(message, 404);
    if (code === 'EMPTY_RESPONSE' || code === 'PARSE_ERROR') throw createHttpError(message, 500);
    if (code === 'NOT_ACTIVE' || code === 'BELOW_MIN' || code === 'INVALID_AMOUNT' || code === 'INVALID_INPUT') {
      throw createHttpError(message, 400);
    }
    throw createHttpError(message, 400);
  }

  return getBuildingSnapshot(trimmedName);
}

module.exports = {
  getBuildingSnapshot,
  placeBidAndGetSnapshot,
};
