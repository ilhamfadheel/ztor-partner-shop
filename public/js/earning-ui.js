import * as state from './ztor/state.js';
import {esc,dialog,action} from './club-ui.js';
import {member} from './member-store.js';
import {earningCatalog} from './earning-store.js';
import {missionBenefit} from './ztor/map.js';
import {t,locale} from './i18n.js';
const num=n=>Number(n||0).toLocaleString(locale());
const join=mission=> {
  const url=new URL(location.href); if(mission)url.searchParams.set('mission',mission);
  return '/signup?return='+encodeURIComponent(url.pathname.split('/').pop()+url.search+url.hash);
};
function step(parent,title,content) {
  if(!parent)return {node:dialog(title,content),back:null};
  const body=parent.querySelector('.club-dialog-body'),heading=parent.querySelector('.club-dialog-head h2');
  const priorTitle=heading.textContent,priorClass=parent.className,previous=document.createDocumentFragment();
  const priorBack=parent.querySelector('[data-step-back]');priorBack?.remove();
  while(body.firstChild)previous.append(body.firstChild);
  heading.textContent=title;body.innerHTML=content;
  parent.classList.remove('reward-dialog');
  const button=document.createElement('button');button.type='button';button.className='club-text-link';button.dataset.stepBack='';button.textContent=t('← Back');button.setAttribute('aria-label',t('Back to {page}',{page:priorTitle}));
  const back=()=>{body.replaceChildren(previous);heading.textContent=priorTitle;parent.className=priorClass;button.remove();if(priorBack)heading.before(priorBack);parent.scrollTop=0;body.querySelector('button,a[href],input')?.focus({preventScroll:true});};
  button.addEventListener('click',back);heading.before(button);parent.scrollTop=0;
  return {node:parent,back};
}

export function openEarnPoints(parent=null) {
  const origin=document.activeElement;
  const {node}=step(parent,t('How to earn points'),'<div data-earning-content></div>');
  node.addEventListener('close',()=>{
    // Earning points can re-render the home hero while this overlay is open.
    if(!origin?.isConnected && document.activeElement===document.body && !document.querySelector('dialog[open]')) document.querySelector('[data-earn-points]')?.focus({preventScroll:true});
  },{once:true});
  node.classList.add('earning-dialog');
  const render=()=>{
    const who=member();
    const slot=node.querySelector('[data-earning-content]');if(!slot)return;
    const rules=state.rules();
    const earn=type=>rules?.earn?.find(e=>e.type===type);
    const per=e=>e?.pointsPerNtd!=null?`+${num(e.pointsPerNtd)} <small>${t('points / NT$1')}</small>`:`+${num(e?.points)} <small>${t('points')}</small>`;
    const shopRule=earn('A4'),pledgeRule=earn('A1'),like=earn('B4'),save=earn('B5');
    const options=[
      shopRule&&`<article class="earning-option"><div><span class="earning-points">${per(shopRule)}</span><h4>${t('Find your next favourite.')}</h4><p>${t('Every piece from the artist’s store earns points on its price. Other currencies are converted to NT$ first.')}</p></div>${action(who.id?t('Go to the shop'):t('Join to earn'),who.id?'/shop':join())}</article>`,
      pledgeRule&&`<article class="earning-option"><div><span class="earning-points">${per(pledgeRule)}</span><h4>${t('Back a co-creation.')}</h4><p>${t('Support the artist’s projects on Ztor. Points arrive when your pledge is charged.')}</p></div></article>`,
      (like||save)&&`<article class="earning-option"><div><span class="earning-points">${like?`+${num(like.points)}`:''}${like&&save?' / ':''}${save?`+${num(save.points)}`:''} <small>${t('points')}</small></span><h4>${t('Love the artist’s posts.')}</h4><p>${save?t('Like or save the artist’s own posts on Ztor. Once per post — taking a like back keeps your points, liking again adds none.'):t('Like the artist’s own posts on Ztor. Once per post — taking a like back keeps your points, liking again adds none.')}</p></div></article>`,
    ].filter(Boolean).join('');
    // The platform's missions still to do (SSO Partners console › Fans › Missions), the first three.
    const open=earningCatalog().filter(m=>m.window==='open'&&!['done','pending','revoked'].includes(m.state)).slice(0,3);
    const missions=open.map(m=>`<article class="earning-option"><div><span class="earning-points">${esc(missionBenefit(m))}</span><h4>${esc(m.title)}</h4>${m.description?`<p>${esc(m.description)}</p>`:''}</div><button type="button" class="club-button is-secondary" data-fan-mission="${esc(m.id)}">${t('View mission')}<span aria-hidden="true">↗</span></button></article>`).join('');
    slot.innerHTML=`<span class="club-kicker">${t('A little support goes a long way.')}</span><h3 class="earning-title">${t('Choose your next move.')}</h3><p>${t('Every way you support the artist adds to your story.')}</p>${missions?`<div class="earning-options">${missions}</div><button type="button" class="club-text-link" data-open-missions>${t('See all missions')} ↗</button>`:''}${options?`<div class="earning-options">${options}</div>`:missions?'':`<p class="club-quiet">${t('How points are earned will appear here shortly.')}</p>`}<p class="club-quiet earning-disclaimer">${t('Points are added to your lifetime total with this artist. Refunded orders and pledges take their points back.')}</p>`;
  };
  render();
  // The published rules and the platform's missions (from the tab's snapshot when it has them).
  state.hydrate(['rules','missions']).then(render);
  node._earningEvents?.abort();
  const events=new AbortController();node._earningEvents=events;
  node.addEventListener('close',()=>events.abort(),{once:true});
  node.addEventListener('earning-return',render,{signal:events.signal});
  document.addEventListener('member:change',render,{signal:events.signal});
  // A mission opens on its own (missions-ui.js); this overlay steps aside for it.
  node.addEventListener('click',e=>{if(e.target.closest('[data-fan-mission],[data-open-missions]'))node.close();},{signal:events.signal});
  return node;
}
