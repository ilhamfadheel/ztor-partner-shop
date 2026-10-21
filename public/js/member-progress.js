// LLOUD's leaderboard and next-level reference, from the creator's real board and this week's
// tier cut-offs (./ztor/state.js). The board lists public names only.
import * as state from './ztor/state.js';
import * as map from './ztor/map.js';

export function leaderboardRows(who = {}) {
  const rows = state.board().slice(0, 10);
  // The fan is outside the top ten: their own row follows, as LLOUD's preview did.
  if (who.id && Number.isSafeInteger(who.rank) && who.rank > 10 && !rows.some(r => r.you)) rows.push({ name: who.name || 'You', rank: who.rank, points: who.lifetime, tier: map.tierLabel(who.tier), avatar: who.avatar || null, you: true });
  return rows;
}

export const nextTierProgress = who => map.nextTierProgress(who);
