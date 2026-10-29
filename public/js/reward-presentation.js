// Presentation only. Entitlements and creator configuration remain authoritative.
import { esc, action } from './club-ui.js';
import { product as getProduct } from './ztor/state.js';
import { member, tierOf, rewardStatus } from './member-store.js';
import { ICONS } from './util.js';
import { t, locale } from './i18n.js';
// Getters: each name is read in the page's language when it is shown.
export const rewardMediaNames = {get note(){return t('Private note');},get photo(){return t('Exclusive photo');},get video(){return t('Exclusive film');},get voice(){return t('Voice message');},get music(){return t('Unreleased audio');}};
const num = n => Number(n || 0).toLocaleString(locale());
const TICK='<svg class="reward-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.6 12.4c1.5 1.2 2.8 2.7 3.9 4.5 2.2-3.8 5.1-7.2 8.9-10.1" pathLength="1"/></svg>';
const fallbackCovers = {photo:'assets/optimized/editorial-smile-lossless.webp',voice:'assets/optimized/editorial-smile-lossless.webp',note:'assets/optimized/editorial-smile-lossless.webp',video:'assets/optimized/editorial-summer-lossless.webp',music:'assets/optimized/editorial-summer-lossless.webp'};
// A vault reward's media is fetched when it is opened (a short-lived link), so it is always ready.
export const rewardIsReady = reward => reward.vault ? true : !reward.assetPending && !!(reward.type==='note' ? reward.body?.trim() : reward.mediaUrl);
export const rewardCover = reward => reward.coverUrl || fallbackCovers[reward.type];
export function rewardPreview(reward, status, index = 0) {
  const custom = !!reward.coverUrl;
  return `<div class="reward-preview reward-preview--${esc(reward.type)} ${custom?'has-cover':'is-editorial'}"><img class="reward-cover" src="${esc(reward.coverUrl || fallbackCovers[reward.type])}" alt="${custom?t('Reward cover'):t('Editorial image; not exclusive reward footage')}" loading="lazy"><div class="reward-preview-top"><span>${rewardMediaNames[reward.type]}</span><span class="reward-seal">${status.unlocked?t('UNLOCKED'):t('LOCKED')}</span></div><div class="reward-preview-copy"><span class="reward-edition">${t('LLOUD PRIVATE · {n}',{n:String(index+1).padStart(2,'0')})}</span><h3>${esc(reward.title)}</h3><p>${esc(reward.subtitle)}</p>${['voice','music'].includes(reward.type)?`<div class="reward-wave" aria-hidden="true">${[9,16,27,12,34,43,22,36,17,29,46,24,11,32,40,19,27,14,36,23,12].map(h=>`<i style="--bar:${h}px"></i>`).join('')}</div>`:''}<small>${custom?t('Creator cover'):t('Editorial preview')}${!rewardIsReady(reward)?' · '+t('Content coming soon'):''}</small></div></div>`;
}
export function conditionLabel(condition) {
  if(condition.type==='tier') return t('Reach {tier}',{tier:tierOf(condition.value).name});
  if(condition.type==='product') { const name=getProduct(condition.value)?.name; return name ? t('Own the {product}',{product:name}) : t('Own the selected piece'); }
  if(condition.type==='supported') return t('Back the co-creation');
  if(condition.type==='follow') return t('Follow the artist on Ztor');
  if(condition.type==='invite') return Number(condition.value)===1 ? t('Invite a friend who joins') : t('Invite {count} friends who join',{count:num(condition.value)});
  if(condition.type==='achievement') return condition.label ? t('Complete: {title}',{title:condition.label}) : t('Complete a mission');
  if(condition.type==='other') return t('Complete a requirement');
  return t('Earn {points} lifetime points',{points:num(condition.value)});
}
function taskAction(c, who, rewardId) {
  if(!who.id) return action(t('Join to begin'),'/signup?return='+encodeURIComponent('/rewards?reward='+encodeURIComponent(rewardId)));
  if(c.type==='product') return action(t('Shop this piece'),'/product?id='+encodeURIComponent(c.value));
  if(c.type==='invite') return '<button type="button" class="club-button" data-invite-link>'+t('Invite friends')+'<span aria-hidden="true">↗</span></button>';
  if(c.type==='achievement') return action(t('View mission'),'/rewards?fanMission='+encodeURIComponent(c.value));
  if(c.type==='other') return '';
  // Backing and following happen on Ztor itself; nothing to do on this site.
  if(c.type==='supported' || c.type==='follow') return '';
  return '<button type="button" class="club-button" data-earn-points>'+t('Go earn points')+'<span aria-hidden="true">↗</span></button>';
}
/** A finished step list: the title, what it gave, a full bar and a line under it (LLOUD's live cards). */
export function completedRewardSummary(title,benefit,hint) {
  return `<section class="reward-missions"><div class="reward-missions-head"><h4>${esc(title)}</h4><span>${esc(benefit)}</span></div><div class="reward-progress" role="progressbar" aria-label="${t('Completed')}" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"><span style="width:100%"></span></div><p class="reward-mission-hint">${esc(hint)}</p></section>`;
}
export function rewardTasks(reward,status,who,{compact=false}={}) {
  // The card: lloud.club's live checklist of unlock tasks, or "Yours to keep" once unlocked.
  if(compact && status.unlocked) return completedRewardSummary(t('Yours to keep'),t('Access unlocked'),!rewardIsReady(reward)?t('Access earned · content coming soon.'):t('A private moment, ready whenever you are.'));
  if(compact && reward.conditions.length) return `<section class="reward-missions"><div class="reward-missions-head"><h4>${reward.match==='any'?t('Complete any one task'):t('Your unlock tasks')}</h4></div><ul class="mission-checklist" aria-label="${t('Reward checklist')}">${reward.conditions.slice(0,5).map((c,i)=>{const done=!!status.conditions[i]?.met;return `<li><span class="mission-step-box${done?' is-complete':''}" role="img" aria-label="${done?t('Completed'):t('Not completed')}">${done?ICONS.check:''}</span><span>${esc(conditionLabel(c))}</span></li>`;}).join('')}</ul>${reward.conditions.length>5?`<button type="button" class="club-button is-secondary" data-open-reward="${esc(reward.id)}">${t('View all tasks')}</button>`:''}</section>`;
  const complete=status.conditions.filter(c=>c.met).length;
  const pct=Math.round(status.progress*100);
  const summary=status.unlocked?t('Access unlocked'):!reward.conditions.length?t('Members only'):t('{done} of {total} complete',{done:complete,total:reward.conditions.length});
  return `<section class="reward-missions"><div class="reward-missions-head"><h4>${status.unlocked?t('Yours to keep'):compact?t('Your unlock steps'):reward.match==='all'?t('Complete the following to unlock:'):t('Complete any one to unlock:')}</h4><span>${summary}</span></div><div class="reward-progress" role="progressbar" aria-label="${t('Unlock progress')}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>${compact?`<p class="reward-mission-hint">${status.unlocked?(!rewardIsReady(reward)?t('Access earned · content coming soon.'):t('A private moment, ready whenever you are.')):!reward.conditions.length?t('Free for every member. Join to open it.'):reward.conditions.length===1?esc(conditionLabel(reward.conditions[0])):reward.match==='all'?t('Complete every step to open this reward.'):t('Complete any one step to open this reward.')}</p>`:`<ol class="reward-task-list">${reward.conditions.map((c,i)=>{
    const state=status.conditions[i]||{}, done=!!state.met, pct=Math.round((state.progress||0)*100);
    const product=c.type==='product'?getProduct(c.value):null;
    const left=Math.max(0,(Number(state.target)||0)-(Number(state.current)||0));
    const detail=done?'':c.type==='achievement'?t('Complete the related mission.'):c.type==='other'?t('Complete the related activity.'):c.type==='product'?t('Complete a purchase of this piece.'):c.type==='supported'?t('Back this co-creation on Ztor.'):c.type==='follow'?t('Follow the artist on Ztor.'):c.type==='tier'?t('Your level: {tier}.',{tier:who.id?tierOf(who.tier).name:t('Not a member yet')}):c.type==='invite'?(left===1?t('1 more friend to go.'):t('{count} more friends to go.',{count:num(left)})):t('{count} points to go.',{count:num(left)});
    const count=c.type==='tier'?`${who.id?tierOf(who.tier).name:'—'} / ${tierOf(c.value).name}`:`${num(state.current||0)} / ${num(state.target||c.value)}`;
    return `<li class="reward-task ${done?'is-complete':''}" style="--i:${i}"><span class="reward-step-mark" aria-hidden="true">${done?TICK:String(i+1).padStart(2,'0')}</span><div class="reward-task-content">${product?`<img class="reward-task-product" src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`:''}<strong>${esc(conditionLabel(c))}</strong>${detail?`<p>${esc(detail)}</p>`:''}<div class="reward-task-progress"><div class="reward-progress" role="progressbar" aria-label="${esc(conditionLabel(c))}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><span class="reward-task-count">${esc(count)}</span></div>${done?'<span class="reward-task-done">'+t('Complete')+'</span>':taskAction(c,who,reward.id)}</div></li>`;
  }).join('')}</ol>`}</section>`;
}

/** A Media Vault reward's card in the /rewards grid. */
export function rewardCard(reward,index) {
  const who = member(), status = rewardStatus(reward.id);
  const opened = who.claimed.includes(reward.id);
  return `<article class="reward-card ${status.unlocked ? 'is-unlocked' : ''}" data-reveal data-reward-id="${esc(reward.id)}">${rewardPreview(reward,status,index)}<div class="reward-info">${rewardTasks(reward,status,who,{compact:true})}<button class="club-button ${status.unlocked ? 'is-red' : 'is-secondary'}" type="button" data-open-reward="${esc(reward.id)}">${status.unlocked ? !rewardIsReady(reward) ? t('Content coming soon') : opened ? t('Open reward') : t('Reveal your reward') : t('See how to unlock')}<span aria-hidden="true">↗</span></button></div></article>`;
}
