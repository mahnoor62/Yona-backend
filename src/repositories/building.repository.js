'use strict';

const { supabaseAdmin } = require('../config/supabase');

/**
 * @param {string} buildingName
 * @returns {Promise<object|null>}
 */
async function findBuildingByName(buildingName) {
  const { data, error } = await supabaseAdmin
    .from('buildings')
    .select('*')
    .eq('name', buildingName)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * @param {string[]} buildingIds
 * @returns {Promise<{ building_id: string, player_id: string, total_amount: string|number }[]>}
 */
async function listBidTotalsForBuildingIds(buildingIds) {
  if (!buildingIds.length) return [];

  const { data, error } = await supabaseAdmin
    .from('building_bid_totals')
    .select('building_id, player_id, total_amount')
    .in('building_id', buildingIds);

  if (error) throw error;
  return data || [];
}

/**
 * @param {string} buildingName
 * @param {string} playerId
 * @param {number} amount
 * @param {string} bidAtIso
 * @returns {Promise<{ ok: boolean, code?: string, message?: string, buildingId?: string }>}
 */
async function placeBuildingBidAtomic(buildingName, playerId, amount, bidAtIso) {
  const { data, error } = await supabaseAdmin.rpc('place_building_bid', {
    p_building_name: buildingName,
    p_player_id: playerId,
    p_amount: amount,
    p_bid_at: bidAtIso,
  });

  if (error) throw error;
  if (data == null) {
    return { ok: false, code: 'EMPTY_RESPONSE', message: 'No response from database.' };
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { ok: false, code: 'PARSE_ERROR', message: 'Invalid RPC response.' };
    }
  }
  return data;
}

module.exports = {
  findBuildingByName,
  listBidTotalsForBuildingIds,
  placeBuildingBidAtomic,
};
