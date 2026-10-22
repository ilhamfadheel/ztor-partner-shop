import { escapeHtml } from './util.js';
import { t } from './i18n.js';
export const esc = escapeHtml;
export const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
let pointerInput=false;
document.addEventListener('pointerdown',()=>{pointerInput=true;},true);
document.addEventListener('keydown',()=>{pointerInput=false;},true);
export function trackMotion(animation) {
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const complete=animation.eventCallback('onComplete'), interrupted=animation.eventCallback('onInterrupt');
  const cleanup=()=>media.removeEventListener('change',finish);
  const finish=()=>{if(media.matches){animation.totalProgress(1);animation.kill();cleanup();}};
  animation.eventCallback('onComplete',()=>{cleanup();complete?.();});
  animation.eventCallback('onInterrupt',()=>{cleanup();interrupted?.();});
  media.addEventListener('change',finish);
  if(media.matches)finish();
  return animation;
}
export function reveal(root) {
  if (!window.gsap || !motionOK()) return;
  trackMotion(gsap.fromTo(root.querySelectorAll('[data-reveal]'), { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: .22, ease: 'power2.out', clearProps: 'transform,opacity' }));
}
export function notify(message) {
  let region = document.querySelector('.club-notice');
  if (!region) { region = document.createElement('div'); region.className = 'club-notice'; region.setAttribute('role','status'); document.body.append(region); }
  region.textContent = message; region.hidden = false;
  clearTimeout(region._timer); region._timer = setTimeout(() => { region.hidden = true; }, 4200);
}
export function dialog(title, content, mount) {
  const origin = document.activeElement;
  const node = document.createElement('dialog');
  node.className = 'club-dialog';
  node.setAttribute('aria-labelledby','club-dialog-title-' + Date.now());
  node.innerHTML = `<div class="club-dialog-head"><h2 id="${node.getAttribute('aria-labelledby')}">${esc(title)}</h2><button type="button" class="club-close" aria-label="${t('Close dialog')}">×</button></div><div class="club-dialog-body">${content}</div>`;
  document.body.append(node);
  let entering,closing;
  const close=()=>{
    if(closing)return node.close();
    entering?.kill();
    if(!pointerInput||!window.gsap||!motionOK())return node.close();
    closing=trackMotion(gsap.to(node,{opacity:0,y:6,duration:.15,ease:'power2.out',onComplete:()=>node.close()}));
  };
  node.querySelector('.club-close').addEventListener('click', close);
  // Keep keyboard focus inside the active inner-page dialog, including the last
  // control -> first control boundary that native Chrome can send to browser chrome.
  node.addEventListener('keydown', e => {
    if(e.key !== 'Tab') return;
    const controls = [...node.querySelectorAll('button,input,select,textarea,a[href],[tabindex],audio[controls],video[controls]')]
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const first=controls[0],last=controls.at(-1),active=document.activeElement;
    if(!first) {e.preventDefault();return;}
    if(e.shiftKey && (active===first || !node.contains(active))) {e.preventDefault();last.focus();}
    else if(!e.shiftKey && (active===last || !node.contains(active))) {e.preventDefault();first.focus();}
  });
  node.addEventListener('click', e => { if (e.target === node && (e.clientX < node.getBoundingClientRect().left || e.clientX > node.getBoundingClientRect().right || e.clientY < node.getBoundingClientRect().top || e.clientY > node.getBoundingClientRect().bottom)) node.close(); });
  node.addEventListener('close', () => { node.querySelectorAll('audio,video').forEach(m => m.pause()); node.remove(); if (origin?.isConnected) origin.focus({preventScroll:true}); }, {once:true});
  node.showModal();
  if (window.gsap && motionOK() && pointerInput) entering=trackMotion(gsap.fromTo(node,{y:8,opacity:0},{y:0,opacity:1,duration:.22,ease:'power2.out',clearProps:'transform,opacity'}));
  node.addEventListener('close',()=>{entering?.kill();closing?.kill();},{once:true});
  mount?.(node);
  return node;
}
export function action(label, href, secondary = false) { return `<a class="club-button${secondary ? ' is-secondary' : ''}" href="${esc(href)}">${esc(label)}<span aria-hidden="true">↗</span></a>`; }
