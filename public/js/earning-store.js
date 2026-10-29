// LLOUD's earning missions are the platform's, on Ztor: created and reviewed in the SSO Partners
// console (Fans › Missions), read with the fan's progress from the Creator API (./ztor/state.js).
// A fan submits proof here; approval, points and the review itself happen on Ztor.
import * as state from './ztor/state.js';

/** The missions the platform published, with the fan's progress (`state`: todo, pending, rejected, done, revoked). */
export function earningCatalog() { return state.missionCatalog(); }

/** Where the fan stands on one mission. */
export function missionState(id) {
  const m = earningCatalog().find(x => x.id === String(id));
  return { id: String(id), status: m ? m.state : 'unavailable', points: m?.amount ?? 0, proof: m?.me ? { url: m.me.proofUrl, note: m.me.note } : null };
}

/** Sends a proof mission's link and/or note (`{ proofUrl, note }`) for review; resolves with the mission as it is now. */
export function submitMissionProof(id, input = {}) { return state.submitProof(id, input); }
