// LLOUD's live /rewards ("Your missions."): mission cards first, then the Media Vault's rewards, in
// one masonry grid (mission-grid.js), with the mission dialog. Ported
// from lloud.club's fan-experience.js (renderEarningCards / openMission) without its browser-local
// demo: missions are the platform's (SSO Partners console › Fans › Missions), progress, review and
// points are Ztor's (Creator API /missions, /invites).
import * as state from './ztor/state.js';
import { missionBenefit, tierLabel, TIER_ID } from './ztor/map.js';
import { signInHref } from './ztor/session.js';
import { member, rewardStatus } from './member-store.js';
import { rewardCatalog } from './reward-config.js';
import { rewardCard, completedRewardSummary } from './reward-presentation.js';
import { esc, dialog, notify, action } from './club-ui.js';
import { ICONS } from './util.js';
import { t, locale } from './i18n.js';

const num = n => Number(n || 0).toLocaleString(locale());
const successTick = () => `<span class="success-icon ds-success-tick" aria-hidden="true">${ICONS.tick}</span>`;
const checklist = steps => `<ul class="mission-checklist" aria-label="${t('Mission checklist')}">${steps.map(([label, done]) => `<li><span class="mission-step-box${done ? ' is-complete' : ''}" role="img" aria-label="${done ? t('Completed') : t('Not completed')}">${done ? ICONS.check : ''}</span><span>${esc(label)}</span></li>`).join('')}</ul>`;
const missionPrizes = (prizes = [], eligibility = '') => prizes.length ? `<div class="mission-benefit-prizes"><span class="mission-benefit-note">${esc(eligibility || '')}</span><ul>${prizes.map(prize => `<li>${esc(prize)}</li>`).join('')}</ul></div>` : '';
const cardBenefits = (m, benefit) => `<div class="mission-card-benefits"><h4>${t('Mission rewards')}</h4><p class="mission-card-points">${esc(benefit)}<small>${t('For an approved entry')}</small></p>${missionPrizes(m.prizes, m.prizeEligibility)}</div>`;
const missionDetails = rule => rule ? `<details class="mission-details"><summary>${t('Details')}</summary><ul>${rule.split(/(?<=[.!?])\s+/).map(line => `<li>${esc(line)}</li>`).join('')}</ul></details>` : '';
const button = (label, attrs = '', secondary = true) => `<button type="button" class="club-button${secondary ? ' is-secondary' : ''}" ${attrs}>${label}</button>`;
const external = (label, href) => `<a class="club-button is-secondary" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span aria-hidden="true">↗</span></a>`;
const fallbackCover = () => 'assets/optimized/editorial-smile-lossless.webp';
const hostsText = hosts => hosts.join(', ');

/** The steps a mission shows: the platform's checklist, else one from how it completes. Ticked from the fan's state. */
export function missionTasks(m) {
  const done = m.state === 'done', submitted = done || m.state === 'pending';
  const fallback = m.kind === 'social' ? t('Submit the public post link')
    : m.kind === 'response' ? t('Submit your response')
    : m.kind === 'referral' ? (m.targetCount === 1 ? t('Invite a friend who joins') : t('Invite {count} friends who join', { count: num(m.targetCount) }))
    : m.kind === 'purchase' ? (m.target ? t('Buy the selected piece') : t('Complete a purchase from the shop'))
    : m.action === 'follow' ? t('Follow the artist on Ztor')
    : m.action === 'supported' ? t('Back the co-creation')
    : m.action === 'tier' ? t('Reach {tier}', { tier: tierLabel(TIER_ID[m.target] ?? m.target) })
    : m.action === 'lifetime' ? t('Earn {points} lifetime points', { points: num(m.target) })
    : t('Complete the mission');
  const steps = m.checklist.length ? m.checklist : [fallback];
  return steps.map(label => [label, m.kind === 'social' || m.kind === 'response' ? submitted : done]);
}

/** "2 of 10 friends" / "40 of 3,000 points" for a mission counted in steps; null for a one-step one. */
function progressText(m) {
  const p = m.me?.progress;
  if (!p || p.target <= 1) return null;
  if (m.kind === 'referral') return t('{current} of {target} friends', { current: num(p.current), target: num(p.target) });
  if (m.action === 'lifetime') return t('{current} of {target} points', { current: num(p.current), target: num(p.target) });
  return t('{current} of {target}', { current: num(p.current), target: num(p.target) });
}
const progressBar = (m, label) => {
  const p = m.me?.progress, pct = p?.target ? Math.round(Math.min(1, p.current / p.target) * 100) : 0;
  return `<div class="reward-progress" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
};

/** One mission's card in the grid (LLOUD's renderEarningCards). */
export function missionCard(m) {
  const done = m.state === 'done';
  const benefit = missionBenefit(m);
  const tasks = missionTasks(m);
  const counted = progressText(m);
  const body = done
    ? completedRewardSummary(t('Yours to keep'), benefit, m.amount ? t('Your points have been added to your account.') : t('Your participation has been recorded.')) + missionPrizes(m.prizes, m.prizeEligibility)
    : `<section class="reward-missions">${m.prizes.length ? cardBenefits(m, benefit) + `<h4 class="mission-card-tasks-heading">${t('Your tasks')}</h4>` : `<div class="reward-missions-head"><h4>${t('What you earn')}</h4><span>${esc(benefit)}</span></div>`}${checklist(tasks.slice(0, 5))}${counted ? `${progressBar(m, counted)}<p class="reward-mission-hint">${esc(counted)}</p>` : ''}${tasks.length > 5 ? button(t('View all tasks'), `data-fan-mission="${esc(m.id)}"`) : ''}${m.window !== 'open' && m.availability ? `<p class="club-quiet">${esc(m.availability)}</p>` : ''}</section>`;
  const cta = done
    ? `<button type="button" class="club-button is-red" data-fan-mission="${esc(m.id)}">${t('View completion')}<span aria-hidden="true">↗</span></button>`
    : button(t('View mission'), `data-fan-mission="${esc(m.id)}"`);
  return `<article class="reward-card fan-earning-card ${done ? 'is-unlocked' : ''}" data-reveal data-earning-id="${esc(m.id)}"><div class="reward-preview is-editorial"><img class="reward-cover" src="${esc(m.cover || fallbackCover(m))}" alt="${m.cover ? esc(m.title) : t('LLOUD editorial')}" loading="lazy"><div class="reward-preview-top"><span>${esc(m.category)}</span><span class="reward-seal">${esc(m.seal)}</span></div><div class="reward-preview-copy"><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p></div></div><div class="reward-info">${body}${cta}</div></article>`;
}

const CATEGORIES = () => [['all', t('All')], ['earn', t('Missions')], ['films', t('Films')], ['audio', t('Voice & music')]];
const REWARD_TYPES = { films: ['video'], audio: ['voice', 'music'] };

/** The /rewards page body: heading, tabs, then the missions and the rewards for the chosen category and status. */
export function rewardsPage({ category = 'all', filter = 'all' } = {}) {
  const missions = state.missionCatalog().filter(m => (category === 'all' || category === 'earn') && (filter === 'all' || (filter === 'unlocked') === (m.state === 'done')));
  const all = rewardCatalog().filter(r => r.published);
  const rewards = all.filter(r => (category === 'all' || REWARD_TYPES[category]?.includes(r.type)) && (filter === 'all' || (filter === 'unlocked') === rewardStatus(r.id).unlocked));
  const cards = missions.map(missionCard).join('') + rewards.map(r => rewardCard(r, all.indexOf(r))).join('');
  return `<div data-reveal><span class="club-kicker">${t('Earned. Not ordinary.')}</span><h1>${t('Your missions.')}</h1><p class="club-lead">${t('Take part in missions, earn points from qualifying activities and unlock exclusive content from Lisa.')}</p></div><div id="vault-rewards" class="club-tabs fan-category-tabs" aria-label="${t('Mission categories')}">${CATEGORIES().map(([id, label]) => `<button type="button" data-mission-category="${id}" aria-pressed="${category === id}">${esc(label)}</button>`).join('')}</div><div class="club-tabs fan-status-tabs" aria-label="${t('Filter by unlock status')}">${[['all', t('All statuses')], ['unlocked', t('Unlocked')], ['locked', t('To discover')]].map(([id, label]) => `<button type="button" data-reward-filter="${id}" aria-pressed="${filter === id}">${esc(label)}</button>`).join('')}</div><section id="vault-missions" tabindex="-1" aria-label="${t('Missions and rewards')}">${cards ? `<div class="club-grid">${cards}</div>` : `<div class="club-empty"><h2>${t('Nothing here yet.')}</h2><p>${t('Try another category or show all statuses.')}</p><button class="club-button" data-reward-filter="all">${t('Show all statuses')}</button></div>`}</section>`;
}

/** Where an auto mission sends the fan to do it: the platform's link, else the shop for a purchase. */
function autoAction(m) {
  if (m.actionUrl) return /^https?:/.test(m.actionUrl) && !m.actionUrl.startsWith(location.origin) ? external(m.actionLabel || t('Open'), m.actionUrl) : action(m.actionLabel || t('Open'), m.actionUrl);
  if (m.kind === 'purchase') return action(m.target ? t('Shop this piece') : t('Go to the shop'), m.target ? '/product?id=' + encodeURIComponent(m.target) : '/shop');
  return '';
}

/** The proof form: a link and/or a note, as the mission asks (required / optional / off). */
function proofForm(m) {
  const link = m.proof?.link ?? 'off', note = m.proof?.note ?? 'off', hosts = m.proof?.allowedHosts ?? [];
  const fields = [
    link !== 'off' && `<label class="club-field">${link === 'optional' ? t('Public post link (optional)') : t('Public post link')}<input name="proof_url" type="url" inputmode="url" maxlength="1000" placeholder="https://" value="${esc(m.me?.proofUrl || '')}"${link === 'required' ? ' required' : ''}></label><p class="club-quiet">${hosts.length ? t('A public https link on {hosts}.', { hosts: esc(hostsText(hosts)) }) : t('A public https link.')} ${t('One link can earn only once.')}</p>`,
    note !== 'off' && `<label class="club-field">${esc(m.prompt || (note === 'optional' ? t('Your note (optional)') : t('Your note')))}<textarea name="note" rows="4" maxlength="1000" placeholder="${t('Write your own response')}"${note === 'required' ? ' required' : ''}>${esc(m.me?.note || '')}</textarea></label><p class="club-quiet">${t('Up to 1,000 characters. Reviewed by the team.')}</p>`,
  ].filter(Boolean).join('');
  return `<form data-mission-form="${esc(m.id)}">${fields}<p class="club-form-error" data-mission-error role="alert"></p><button class="club-button" type="submit">${t('Submit for review')}</button></form>`;
}

/** What the mission dialog shows, from the mission and the fan's state (LLOUD's openMission). */
export function missionBody(m) {
  const done = m.state === 'done';
  const note = done ? t('Earned') : !m.amount ? t('Recorded on completion') : m.kind === 'referral' ? t('Added for each friend who joins') : m.kind === 'social' || m.kind === 'response' ? t('Added after confirmation') : t('Added when the mission completes');
  const benefit = `<section class="mission-benefit${m.prizes.length ? ' has-multiple' : ''}" aria-label="${t('Mission reward')}"><span class="mission-benefit-label">${m.prizes.length ? t('Mission rewards') : m.amount ? t('Mission reward') : t('What you unlock')}</span><strong class="mission-benefit-value${m.amount ? '' : ' is-milestone'}">${m.amount ? `+${num(m.amount)} <small>${m.pointsPer === 'friend' ? t('points per friend') : t('points')}</small>` : esc(m.benefit || t('A milestone on your profile'))}</strong><span class="mission-benefit-note">${esc(note)}</span>${missionPrizes(m.prizes, m.prizeEligibility)}</section>`;
  const counted = progressText(m);
  const progress = counted ? `<div class="mission-progress">${progressBar(m, counted)}<p class="reward-mission-hint">${esc(counted)}</p></div>` : '';
  const film = m.media ? `<video controls playsinline preload="metadata" class="mission-film" aria-label="${esc(m.title)}" src="${esc(m.media)}"></video>` : '';
  let content;
  if (done) content = `<p class="fan-success" role="status">${successTick()}${t('Mission complete.')}</p><p>${m.amount ? t('Your points have been credited once.') : esc(m.benefit || t('Your participation has been recorded.'))}</p>`;
  else if (m.state === 'revoked') content = `<p class="club-form-error" role="status">${t('This mission was not credited.')}</p>${m.me?.reason ? `<p>${esc(m.me.reason)}</p>` : ''}`;
  else if (m.state === 'pending') content = `<p role="status">${t('In review. We’ll confirm once your submission is approved.')}</p>${m.me?.proofUrl ? `<a class="club-text-link" href="${esc(m.me.proofUrl)}" target="_blank" rel="noopener noreferrer">${t('View what you sent ↗')}</a>` : ''}`;
  else if (m.window !== 'open') content = `<p role="status">${esc(m.availability || t('This mission isn’t open right now.'))}</p>`;
  else if (m.kind === 'social' || m.kind === 'response') content = `${m.state === 'rejected' ? `<p class="club-form-error" role="status">${t('Your submission needs an update.')}</p>${m.me?.reason ? `<p>${esc(m.me.reason)}</p>` : ''}` : ''}${m.actionUrl ? external(m.actionLabel || t('Open'), m.actionUrl) : ''}${proofForm(m)}`;
  else if (m.kind === 'referral') content = `${progress}${button(t('Copy invitation link'), 'data-invite-link', false)}<p class="club-quiet">${t('A friend counts when they join the club with your link. Existing members and your own account don’t count.')}</p>${m.availability ? `<p role="status">${esc(m.availability)}</p>` : ''}`;
  else content = `${progress}${autoAction(m)}<p class="club-quiet">${t('This mission completes on its own once you’ve done it. There’s nothing to claim.')}</p>${m.availability ? `<p role="status">${esc(m.availability)}</p>` : ''}`;
  return `${m.description ? `<p>${esc(m.description)}</p>` : ''}${film}${benefit}${checklist(missionTasks(m))}${content}${missionDetails(m.rule)}`;
}

const REFUSAL = {
  CREATOR_PROOF_REUSED: () => t('This link was already used for a mission.'),
  CREATOR_MISSION_CLOSED: () => t('This mission isn’t open right now.'),
  CREATOR_MISSION_NOT_PROOF: () => t('This mission completes on its own; there’s nothing to submit.'),
};
/** A Creator API refusal in the fan's words; the server's own message for a bad argument. */
export const refusalText = error => REFUSAL[error?.code]?.() ?? error?.message ?? t('Something went wrong. Please try again.');

// ── behaviour (browser) ──────────────────────────────────────────────────────
/** Opens a mission; a visitor signs in first and comes back to it. */
export function openMission(id) {
  const m = state.missionCatalog().find(x => x.id === String(id));
  if (!m) return notify(t('This mission is no longer available.'));
  if (!member().id) return location.assign(signInHref('/rewards?fanMission=' + encodeURIComponent(m.id)));
  document.querySelectorAll('dialog[open]').forEach(d => { if (d.dataset.missionDialog) d.close(); });
  const node = dialog(m.title, missionBody(m));
  // Not data-fan-mission: that opens a mission, and every click inside the dialog (the link field,
  // the ×) would match it on the dialog itself and open the mission again.
  node.dataset.missionDialog = m.id;
  return node;
}

/** The Missions tab of /rewards (from anywhere: "Go earn points", the earning overlay). */
export function openMissions() {
  if (document.documentElement.dataset.clubView === 'rewards') {
    document.querySelectorAll('dialog[open]').forEach(node => node.close());
    document.querySelector('[data-mission-category=earn]')?.click();
    document.querySelector('[data-reward-filter=all]')?.click();
    const section = document.getElementById('vault-missions');
    section?.scrollIntoView({ block: 'start' }); section?.focus({ preventScroll: true });
  } else dispatchEvent(new CustomEvent('club:navigate', { detail: '/rewards#vault-missions' }));
}

/** Copies the fan's invitation link (their code on this platform); a visitor signs in first. */
export async function shareInvite() {
  if (!member().id) return location.assign(signInHref(location.pathname + location.search));
  if (!state.inviteLink()) await state.hydrate(['invite']);
  const link = state.inviteLink();
  if (!link) return notify(t('Your invitation link isn’t available right now. Please try again.'));
  if (!navigator.clipboard) return notify(link);
  navigator.clipboard.writeText(link).then(() => notify(t('Invite link copied. Send it to a friend.')), () => notify(link));
}

async function submitProof(form) {
  if (form.dataset.saving) return;
  const id = form.dataset.missionForm, error = form.querySelector('[data-mission-error]'), submit = form.querySelector('[type=submit]');
  const proofUrl = String(form.elements.proof_url?.value ?? '').trim(), note = String(form.elements.note?.value ?? '').trim();
  error.textContent = '';
  if (!proofUrl && !note) { error.textContent = t('Add a link or a note.'); return; }
  form.dataset.saving = 'true'; submit.disabled = true;
  try {
    await state.submitProof(id, { proofUrl, note });
    form.closest('dialog')?.close();
    openMission(id);
  } catch (err) {
    if (err?.code === 'CREATOR_ALREADY_SUBMITTED') { await state.reloadMissions(); form.closest('dialog')?.close(); openMission(id); return; }
    error.textContent = err?.code === 'CREATOR_NOT_FOUND' ? t('This mission is no longer available.') : refusalText(err);
  } finally { delete form.dataset.saving; submit.disabled = false; }
}

let mounted = false;
/** Wires the mission buttons and forms anywhere on the page (cards, reward steps, dialogs), once. */
export function mountMissions() {
  if (mounted) return;
  mounted = true;
  document.addEventListener('click', e => {
    const target = e.target.closest?.('[data-fan-mission],[data-invite-link],[data-open-missions]');
    if (!target) return;
    if (target.dataset.fanMission) openMission(target.dataset.fanMission);
    else if (target.hasAttribute('data-invite-link')) void shareInvite();
    else openMissions();
  });
  document.addEventListener('submit', e => {
    const form = e.target.closest?.('[data-mission-form]');
    if (!form) return;
    e.preventDefault();
    void submitProof(form);
  });
}
