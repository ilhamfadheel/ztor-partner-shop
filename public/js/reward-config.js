// LLOUD's reward catalog is the creator's Media Vault on Ztor (./ztor/state.js): rewards, covers and
// unlock conditions are authored there (loyalty-points admin), not in this browser.
import * as state from './ztor/state.js';

export const REWARD_CONFIG_KEY = 'lloud_reward_config_preview_v1';
export const DEFAULT_REWARDS = [];
export const rewardCatalog = () => state.rewards();
export function validateRewardConfig(list) { return Array.isArray(list) ? list : []; }
export function saveRewardCatalog() { throw new Error('Rewards are managed on Ztor.'); }
export function resetRewardCatalog() { return saveRewardCatalog(); }
