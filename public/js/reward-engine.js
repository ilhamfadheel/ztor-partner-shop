// Creator-configurable rules: a leaf {type:'tier'|'product'|'lifetime'|'invite', value},
// or nested {all:[rules]} / {any:[rules]}. Empty or invalid branches fail closed.
// Entitlements are permanent earned records; current conditions remain explainable.
const tiers = ['fan', 'ranked', 'super', 'inner'];
const names = ['Fan', 'Ranked Fan', 'Super Fan', 'Inner Circle'];
const number = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;
const invalid = () => ({valid:false,met:false,progress:0,conditions:[]});
function evaluate(rule, who, depth = 0) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule) || depth > 20) return invalid();
  const group = Object.hasOwn(rule,'all') ? 'all' : Object.hasOwn(rule,'any') ? 'any' : null;
  if (group) {
    if (Object.hasOwn(rule,'all') && Object.hasOwn(rule,'any') || Object.hasOwn(rule,'type')) return invalid();
    const children = rule[group];
    if (!Array.isArray(children) || !children.length) return invalid();
    const results = children.map(child => evaluate(child, who, depth+1));
    if (results.some(result => !result.valid)) return invalid();
    const met = group === 'all' ? results.every(r=>r.met) : results.some(r=>r.met);
    const progress = group === 'all' ? results.reduce((sum,r)=>sum+r.progress,0)/results.length : Math.max(...results.map(r=>r.progress));
    return {valid:true,met,progress,conditions:results.flatMap(r=>r.conditions)};
  }
  let current, target, met, progress, label;
  if (rule.type === 'tier') {
    target = tiers.indexOf(rule.value); current = tiers.indexOf(who.tier);
    if (target < 0) return invalid();
    met = current >= target; progress = current < 0 ? 0 : target === 0 ? 1 : Math.min(1,current/target);
    label = `Reach ${names[target]}`;
    current = current < 0 ? null : tiers[current]; target = rule.value;
  } else if (rule.type === 'product') {
    if (!text(rule.value)) return invalid();
    met = Array.isArray(who.purchasedProducts) && who.purchasedProducts.includes(rule.value);
    current = met ? 1 : 0; target = 1; progress = current;
    label = `Purchase ${text(rule.productName) ? rule.productName : rule.value}`;
  } else if (rule.type === 'lifetime') {
    if (!number(rule.value) || rule.value === 0) return invalid();
    target = rule.value; current = number(who.lifetime) ? who.lifetime : 0;
    met = current >= target; progress = Math.min(1,current/target);
    label = `Earn ${target.toLocaleString('en-US')} lifetime points`;
  } else if (rule.type === 'invite') {
    if (!number(rule.value) || rule.value === 0) return invalid();
    target = rule.value; current = number(who.invites) ? who.invites : 0;
    met = current >= target; progress = Math.min(1,current/target);
    label = `Invite ${target} friends`;
  } else return invalid();
  return {valid:true,met,progress,conditions:[{label,met,current,target,progress}]};
}
export function rewardProgress(reward, who) {
  const locked = {unlocked:false,progress:0,conditions:[]};
  if (!reward || !text(reward.id) || !who || !text(who.id) || who.guest) return locked;
  const rule = reward.conditions ? (['all','any'].includes(reward.match) ? {[reward.match]:reward.conditions} : null) : reward.unlock;
  const result = evaluate(rule,who);
  if (!result.valid) return locked;
  const earned = Array.isArray(who.unlockedRewards) && who.unlockedRewards.includes(reward.id);
  const published = reward.published !== false;
  return {unlocked:earned || (published && result.met),progress:earned ? 1 : published ? result.progress : 0,conditions:result.conditions};
}
