import {mountMemberMetal} from './member-metal.js';
import {t} from './i18n.js';

const seenWins=new Set();
let keyboardInput=false;
document.addEventListener('keydown',()=>{keyboardInput=true;},{capture:true});
document.addEventListener('pointerdown',()=>{keyboardInput=false;},{capture:true,passive:true});

export const winStamp=()=>`<div class="auction-win-stamp" data-tier="inner" data-pass-motion="still" role="img" aria-label="${t('You won this auction')}"><div class="auction-win-stamp-inner" aria-hidden="true"></div><div class="auction-win-stamp-band" aria-hidden="true"><span class="auction-win-stamp-word" data-word="${t('YOU WON')}">${t('YOU WON')}</span></div></div>`;

export function mountWinStamp(stamp,awardKey) {
  if(!stamp)return ()=>{};
  // Same liquid-metal shader, palette, visibility and reduced-motion policy as the fan pass.
  const disposeMetal=mountMemberMetal(stamp);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let animation=null,disposed=false;
  const land=()=>{
    if(disposed||seenWins.has(awardKey))return;
    seenWins.add(awardKey);
    if(reduced.matches||keyboardInput||document.hidden||navigator.connection?.saveData)return;
    animation=stamp.animate([
      {transform:'translateY(-8px) rotate(-16deg) scale(1.14)',opacity:0},
      {transform:'translateY(0) rotate(-12deg) scale(.97)',opacity:1,offset:.7},
      {transform:'translateY(0) rotate(-12deg) scale(1)',opacity:1}
    ],{duration:280,easing:'cubic-bezier(.23,1,.32,1)'});
  };
  const observer=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){land();observer.disconnect();}
  },{threshold:.6});
  observer.observe(stamp);
  const settle=()=>{animation?.cancel();};
  const visibility=()=>{if(document.hidden)settle();};
  reduced.addEventListener('change',settle);
  document.addEventListener('visibilitychange',visibility);
  return ()=>{disposed=true;observer.disconnect();animation?.cancel();disposeMetal();reduced.removeEventListener('change',settle);document.removeEventListener('visibilitychange',visibility);};
}
