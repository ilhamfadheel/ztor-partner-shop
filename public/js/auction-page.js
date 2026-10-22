import {auctionSnapshot,submitAuctionBid,tickAuction} from './auction-session.js';
import {member,canAuction,TIERS} from './member-store.js';
import {AUCTION_LOTS,auctionHref} from './auction-catalog.js';
import {money} from './util.js';
import {esc,action,dialog,notify,motionOK,reveal,trackMotion} from './club-ui.js';
import {openAuctionLotDetails} from './auction-lot-details.js';
import {mountAuctionWorkspace} from './auction-workspace.js';
import {auctionOrder,openAuctionPayment} from './auction-payment.js';
import {winStamp,mountWinStamp} from './auction-win-stamp.js';
import {t,locale} from './i18n.js';

const aliases=['Noor','Min','Sora','Kai','Yuna','Jules','Ren','Mika','Eden','Sol','Aya'];
const person=id=>id==='preview-you'?(member().id===id?t('You'):'Alex'):aliases[Number(id?.split('-').pop())-1]||t('Another fan');
const stageName={announced:t('Coming soon'),open:t('Public bidding'),sealed:t('Sealed round'),tie:t('Tiebreak round'),settled:t('The result'),review:t('Under review'),'no-sale':t('Auction closed')};
const timeLeft=view=>{const seconds=Math.max(0,Math.ceil(((view.stage==='announced'?view.opensAt:view.deadline)-view.now)/1000));return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');};
const dateLabel=time=>t('{date} HKT',{date:new Intl.DateTimeFormat(locale()==='en-US'?'en-GB':locale(),{timeZone:'Asia/Hong_Kong',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(time)});
const tierName = who => TIERS.find(tier => tier.id === who.tier)?.name || t('Fan');

function lockedAction(label = t('Place bid')) {
  const who = member();
  return `<div class="auction-gate"><span>${t('INNER CIRCLE REQUIRED')}</span><p id="auction-access-reason">${who.id?t('Only Inner Circle members can bid. You’re currently a {tier}.',{tier:esc(tierName(who))}):t('Only Inner Circle members can bid. Sign in to check your membership.')}</p><button type="button" class="club-button is-locked" data-auction-access aria-haspopup="dialog" aria-describedby="auction-access-reason"><span>${label}</span><span class="auction-lock-label">${t('Locked')}</span></button><span class="auction-caption auction-access-hint">${t('Select to see how to unlock bidding.')}</span></div>`;
}

function explainAccess() {
  const who = member();
  return dialog(t('Unlock Inner Circle'), `<div class="auction-access-intro"><span class="club-kicker">${t('Your access to bidding')}</span><p>${t('Inner Circle is for the top 1% of Lisa’s fans, ranked by points earned over the last 90 days.')}</p></div><div class="auction-access-status"><div><span>${t('Current membership')}</span><strong>${who.id?esc(tierName(who)):t('Not signed in')}</strong></div><div><span>${t('Your community rank')}</span><strong>${who.id?`#${who.rank} <small>${t('of {total}',{total:who.population})}</small>`:t('Sign in to see')}</strong></div></div><ol class="auction-access-steps"><li><strong>${t('Earn eligible points.')}</strong><p>${t('Complete qualifying purchases and creator-published activities. Each activity explains the points it awards.')}</p></li><li><strong>${t('Build your recent ranking.')}</strong><p>${t('Your last 90 days count toward membership. Lifetime points keep your reward history, but do not set your tier.')}</p></li><li><strong>${t('Reach the top 1%.')}</strong><p>${t('When your membership becomes Inner Circle, bidding unlocks. Rankings move with the community; there is no fixed spending amount or guaranteed upgrade.')}</p></li></ol><p class="club-quiet">${who.id?t('Your current membership and rank are preview data.'):t('Use Join / sign in in the header to get started. You can keep browsing these auctions without an account.')}</p><button class="club-button" data-access-close>${t('Got it')}</button>`, node => node.querySelector('[data-access-close]').addEventListener('click', () => node.close()));
}

function bidSurface(v, lot, editingSealed=false) {
  if(v.stage==='settled') {
    const won=!!member().id && v.winner?.userId===member().id;
    const paid=auctionOrder(v,lot)?.status==='paid';
    return `<div class="auction-result" data-result="${won?'won':'lost'}">${won?`<div class="auction-result-head"><span class="auction-overline">${t('Your moment.')}</span>${winStamp()}</div>`:`<span class="auction-overline">${t('The result is in.')}</span>`}<h2>${won?t('This piece is yours.'):t('A new home. A shared story.')}</h2><p>${won?t('You placed the highest final bid.'):t('Another member placed the highest final bid. Thank you for being part of the auction.')}</p><div class="auction-amount">${money(v.winner?.amount||0)}</div><span class="auction-caption">${t('Winning bid')} · ${esc(person(v.winner?.userId))}</span>${won?`<button class="club-button is-red" data-auction-settle>${paid?t('View confirmation'):t('Complete your order')}<span aria-hidden="true">↗</span></button>`:action(t('Discover your rewards'),'/rewards')}</div>`;
  }
  if(['no-sale','review'].includes(v.stage))return `<span class="auction-overline">${v.stage==='review'?t('A fair result matters.'):t('This chapter is closed.')}</span><h2>${v.stage==='review'?t('A moment to review.'):t('No winning bid this time.')}</h2><p>${v.stage==='review'?t('The qualification cutoff needs review. Bidding is paused while the result is resolved.'):t('No eligible final bid was received. No payment is due.')}</p>${action(t('Back to the club'),'/fan-club')}`;
  let lead,detail;
  if(v.stage==='announced'){lead=t('Something rare. Worth the wait.');detail=t('Inner Circle members can bid when the first round opens.');}
  else if(v.stage==='open'){lead=t('One piece. Your next move.');detail=t('Bid in the open round. The ten highest distinct bidders move into a private final round.');}
  else if(v.stage==='tie'){lead=t('One more quiet move.');detail=t('The highest bids tied. Only those tied members can submit again. Keep your next move to yourself.');}
  else {lead=t('Your final bid. Only you know.');detail=t('Your amount stays private. You can change it until this round ends. Your last confirmed bid counts.');}
  const hidden=['sealed','tie'].includes(v.stage);
  if(hidden && !v.qualified) {
    lead=v.stage==='tie'?t('The final moves. A fair result.'):t('The next round. A new chapter.');
    detail=v.stage==='tie'?t('The highest tied members are making another private bid. The result will be shared when one winner remains.'):t('The public round is complete. The ten qualifying members are now making their sealed bids.');
  }
  const who=member();
  const highestPublicBid=(v.publicBids||[]).reduce((highest,bid)=>!highest||bid.amount>highest.amount?bid:highest,null);
  const leading=v.stage==='open' && !!who.id && highestPublicBid?.userId===who.id;
  const outbid=v.stage==='open' && !!who.id && !leading && v.publicBids.some(b=>b.userId===who.id);
  let controls='';
  if(!canAuction()) controls=lockedAction(hidden?t('Place sealed bid'):t('Place bid'));
  else if(v.stage==='announced') controls=`<button class="club-button is-red" data-auction-reminder>${who.notices.includes('auction-reminder:'+lot.id)?t('Reminder saved'):t('Remind me when it opens')}<span aria-hidden="true">+</span></button><p class="auction-caption">${t('Preview reminder saved in this browser. No notification will be sent.')}</p>`;
  else if(hidden&&!v.qualified) controls=`<div class="auction-gate"><span>${t('YOUR BIDDING HAS ENDED')}</span><p>${v.stage==='tie'?t('Only the highest tied members continue in this round.'):t('The public round is complete. You did not finish among the ten qualifying bidders.')}</p>${action(t('Discover your rewards'),'/rewards',true)}</div>`;
  else if(v.ownBid && !editingSealed) controls=`<div class="auction-receipt"><span class="auction-overline">${t('YOUR CURRENT SEALED BID')}</span><strong>${money(v.ownBid.amount)}</strong><p>${t('Only you can see this amount. Change it anytime before this round ends.')}</p><span class="auction-caption">${t('Your last confirmed bid at the deadline counts.')}</span><button type="button" class="club-button is-secondary" data-edit-sealed ${v.canBid?'':'disabled'}>${t('Change sealed bid')}<span aria-hidden="true">↗</span></button></div>`;
  else controls=`<form data-bid-form novalidate>${v.ownBid?`<p class="auction-current-sealed">${t('Currently confirmed')} <strong>${money(v.ownBid.amount)}</strong></p>`:''}<label class="auction-bid-label" for="auction-bid">${hidden?(v.ownBid?t('New sealed bid'):t('Your sealed bid')):t('Your bid')} · HKD</label><div class="auction-bid-input"><span>HK$</span><input id="auction-bid" name="amount" type="number" inputmode="numeric" min="${v.floor}" step="1" value="${v.ownBid?.amount||v.floor}" required aria-describedby="auction-minimum auction-error"></div><p id="auction-minimum" class="auction-caption">${t('Minimum {amount}',{amount:money(v.floor)})} · ${hidden?t('editable until the round ends'):t('minimum increment {amount}',{amount:'HK$ 100'})}</p><p id="auction-error" class="auction-error" role="alert"></p><button class="club-button is-red" type="submit" ${v.canBid?'':'disabled'}>${hidden?(v.ownBid?t('Review updated bid'):t('Place sealed bid')):t('Place bid')}<span aria-hidden="true">↗</span></button>${v.ownBid?`<button type="button" class="club-button is-secondary" data-cancel-sealed>${t('Keep current bid')}</button>`:''}<span class="auction-caption auction-access-hint">${v.ownBid?t('Your current bid stays in place until you confirm a change.'):t('Review and confirm before submitting.')}</span></form>`;
  return `<span class="auction-overline">${v.stage==='tie'?t('TIEBREAK · ROUND {round}',{round:v.round}):stageName[v.stage]}</span><h2>${lead}</h2><p>${detail}</p><div class="auction-metrics"><div><span class="auction-caption">${v.stage==='announced'?t('Opens in'):t('Round ends in')}</span><strong data-auction-clock>${timeLeft(v)}</strong></div><div><span class="auction-caption">${hidden?t('Minimum sealed bid'):v.stage==='announced'?t('Opening bid'):t('Current highest')}</span><div class="auction-highest-value"><strong>${money(hidden?v.floor:v.stage==='announced'?v.openingPrice:highestPublicBid?.amount||0)}</strong>${leading||outbid?`<span class="auction-leading-badge" data-bid-state="${leading?'leading':'outbid'}" role="status">${leading?t('You’re leading'):t('You’ve been outbid')}</span>`:''}</div></div></div>${controls}`;
}
function publicRows(v) {
  if(!v.publicBids?.length)return '';
  const unique=new Map();v.publicBids.forEach(b=>{if(!unique.has(b.userId)||unique.get(b.userId).amount<b.amount)unique.set(b.userId,b);});
  const ranked=[...unique.values()].sort((a,b)=>b.amount-a.amount).slice(0,10);
  return `<section class="club-section"><div class="club-section-head"><h2>${t('The public round.')}</h2><span class="club-quiet">${t('Ten distinct bidders qualify')}</span></div><table class="club-rank-table"><caption class="club-sr-only">${t('Ten highest public-round bidders')}</caption><thead><tr><th>${t('Position')}</th><th>${t('Member')}</th><th>${t('Highest public bid')}</th></tr></thead><tbody>${ranked.map((b,i)=>`<tr class="${b.userId===v.userId?'is-you':''}"><td>${String(i+1).padStart(2,'0')}</td><td>${esc(person(b.userId))}</td><td>${money(b.amount)}</td></tr>`).join('')}</tbody></table></section>`;
}

function mountAuctionList(root, onOpen, onMyBids) {
  let active=true, filter='all';
  const group=stage=>stage==='announced'?'upcoming':['open','sealed','tie'].includes(stage)?'live':'finished';
  const snapshots=()=>AUCTION_LOTS.map(lot=>({lot,view:auctionSnapshot(lot.id)}));
  function cards() {
    const rows=snapshots().filter(({view})=>filter==='all'||group(view.stage)===filter);
    root.querySelector('[data-auction-lots]').innerHTML=rows.length?rows.map(({lot,view:v})=>{
      const hidden=['sealed','tie'].includes(v.stage);
      const ended=group(v.stage)==='finished';
      const amount=hidden?v.floor:v.stage==='announced'?v.openingPrice:v.stage==='settled'?v.winner?.amount:Math.max(v.openingPrice,...(v.publicBids||[]).map(b=>b.amount));
      const label=hidden?t('Minimum sealed bid'):v.stage==='announced'?t('Opening bid'):v.stage==='settled'?t('Winning bid'):t('Current highest');
      return `<a class="auction-card" href="${auctionHref(lot)}" data-auction-card="${lot.id}"><div class="auction-card-art"><img src="${esc(lot.image)}" alt="${esc(lot.alt)}" width="640" height="720"></div><div class="auction-card-meta"><span>${esc(lot.collection)}</span><span class="auction-card-status ${ended?'':'is-live'}">${stageName[v.stage]}</span></div><h2>${esc(lot.title)}</h2><div class="auction-card-facts"><div><span>${['review','no-sale'].includes(v.stage)?t('Status'):label}</span><strong>${['review','no-sale'].includes(v.stage)?stageName[v.stage]:money(amount||0)}</strong></div><div><span>${ended?t('Bidding'):v.stage==='announced'?t('Opens in'):t('Ends in')}</span><strong data-lot-clock="${lot.id}">${ended?t('Closed'):timeLeft(v)}</strong></div></div><span class="auction-card-action">${t('View auction')} <span aria-hidden="true">↗</span></span></a>`;
    }).join(''):`<div class="club-empty"><h2>${t('No auctions here yet.')}</h2><p>${t('Choose another view to see the available pieces.')}</p></div>`;
  }
  function render() {
    if(!active)return;
    root.innerHTML=`<div class="auction-title auction-room-title" data-reveal><span class="club-kicker">${t('The LLOUD auction room')}</span><h1>${t('Rare pieces. Your next move.')}</h1><p>${t('Explore individual auctions, each with its own rounds and closing time.')}</p></div><button type="button" class="auction-my-bids auction-my-bids--float" data-my-bids aria-haspopup="dialog">${t('My bids')} <span>${AUCTION_LOTS.filter(lot=>auctionSnapshot(lot.id).participated).length}</span></button><div class="auction-room-access">${canAuction()?`<span>${t('Inner Circle access unlocked. Choose a piece to place your bid.')}</span>`:`<span>${member().id?t('Only Inner Circle members can bid. You’re currently a {tier}.',{tier:esc(tierName(member()))}):t('Only Inner Circle members can bid. You’re browsing as a guest.')}</span><button class="club-text-link" data-auction-access aria-haspopup="dialog">${t('How to unlock bidding')}</button>`}</div><div class="auction-filters" role="group" aria-label="${t('Filter auctions')}">${[['all',t('All auctions')],['live',t('Live now')],['upcoming',t('Coming soon')],['finished',t('Finished')]].map(([id,label])=>`<button type="button" data-auction-filter="${id}" aria-pressed="${id===filter}">${label}</button>`).join('')}</div><div class="auction-catalog" data-auction-lots></div><p class="auction-demo-note club-quiet">${t('Preview catalog. All lots, bids and deadlines are demonstration data; no live auction or payment is taking place.')}</p>`;
    cards();
    root.querySelector('[data-auction-access]')?.addEventListener('click',explainAccess);
    root.querySelectorAll('[data-auction-filter]').forEach(button=>button.addEventListener('click',()=>{
      filter=button.dataset.auctionFilter;
      root.querySelectorAll('[data-auction-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      cards();
    }));
  }
  for(const lot of AUCTION_LOTS)tickAuction(lot.id);
  render();reveal(root);
  const open = event => {
    const card=event.target.closest('[data-auction-card]');
    if(card && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button===0) {
      event.preventDefault();onOpen(card.dataset.auctionCard,event.detail===0);
    }
    if(event.target.closest('[data-my-bids]'))onMyBids(event.detail===0);
  };
  root.addEventListener('click',open);
  document.addEventListener('auction:change',render);document.addEventListener('member:change',render);
  const timer=setInterval(()=>{if(!active||document.hidden)return;for(const lot of AUCTION_LOTS){try{const v=tickAuction(lot.id);const clock=root.querySelector(`[data-lot-clock="${lot.id}"]`);if(clock)clock.textContent=group(v.stage)==='finished'?'Closed':timeLeft(v);}catch{/* Submission/scenario controls surface persistence errors. */}}},1000);
  return ()=>{active=false;clearInterval(timer);root.removeEventListener('click',open);document.removeEventListener('auction:change',render);document.removeEventListener('member:change',render);};
}

export function mountAuctionPage(root) {
  if(!document.querySelector('link[href="css/auction.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='css/auction.css';document.head.append(link);}
  return mountAuctionWorkspace(root,{mountList:mountAuctionList,mountLot:mountAuctionLot});
}

function mountAuctionLot(root,lot,{compact=false,drafts=new Map()}={}) {
  const snapshot=()=>auctionSnapshot(lot.id);
  let active=true,phase='',renderedDraftKey='',editingSealed=false,disposeStamp=()=>{},lastBidStatus=null,savingBid=false,badgeMotion=null;
  const overlays=new Set();
  const draftKey=v=>`${member().id||'guest'}:${lot.id}:${v.stage}:${v.round}`;
  const track=(node,focusSelector='[data-bid-form] button,[data-edit-sealed],[data-auction-access],[data-auction-details]',restoreFocus=false)=>{
    if(!node)return node;
    overlays.add(node);
    node.addEventListener('close',()=>{
      overlays.delete(node);
      requestAnimationFrame(()=>{
        if(active && root.isConnected && (restoreFocus || document.activeElement===document.body || document.activeElement===root.closest('dialog')))
          root.querySelector(focusSelector)?.focus({preventScroll:true});
      });
    },{once:true});
    return node;
  };
  const overlay=(...args)=>track(dialog(...args));
  function render(first=false) {
    if(!active)return;
    disposeStamp();badgeMotion?.kill();
    const focused=document.activeElement;
    const focusInput=root.contains(focused)&&focused.matches('input[name="amount"]');
    const v=snapshot();const previousPhase=phase;phase=v.stage;
    if(renderedDraftKey!==draftKey(v))editingSealed=false;
    renderedDraftKey=draftKey(v);
    const step=v.stage==='announced'?0:v.stage==='open'?1:['sealed','tie'].includes(v.stage)?2:3;
    root.innerHTML=`<div class="auction-title" data-reveal><a class="auction-back" href="/auction">← ${t('All auctions')}</a><span class="club-kicker">${esc(lot.collection)} · ${t('Preview auction')}</span><h1>${t('{title}.',{title:esc(lot.title)})}</h1><p>${t('One exceptional piece. An Inner Circle experience.')}</p></div><ol class="auction-phases" aria-label="${t('Auction progress')}">${[t('Announcement'),t('Public bids'),t('Sealed bids'),t('The result')].map((name,i)=>`<li ${step===i?'aria-current="step"':''} class="${step>=i?'is-reached':''}"><span>${String(i+1).padStart(2,'0')}</span>${name}${step===i?`<small>${t('Current stage')}</small>`:''}</li>`).join('')}</ol><section class="auction-arena" aria-label="${t('{title} auction',{title:esc(lot.title)})}"><div class="auction-lot" data-reveal><span class="auction-lot-label">${esc(lot.collection.toUpperCase())}</span><img src="${esc(lot.image)}" alt="${esc(lot.alt)}" width="640" height="720"><div class="auction-lot-footer"><span class="auction-lot-foot">${t('SAMPLE AUCTION LOT')}</span><button type="button" class="auction-view-details" data-auction-details aria-haspopup="dialog">${t('View details')}<span aria-hidden="true">↗</span></button></div></div><div class="auction-console" data-reveal>${bidSurface(v,lot,editingSealed)}<div class="auction-pulse-line" aria-hidden="true"></div></div></section>${['sealed','tie'].includes(v.stage)?`<p class="club-quiet auction-sealed-note">${t('A private round. No opposing amounts, rankings or submission activity are displayed.')}</p>`:''}${publicRows(v)}<section class="club-section auction-details"><div><span class="club-kicker">${t('How it unfolds')}</span><h2>${t('Four stages. One final owner.')}</h2></div><div class="club-rule-list"><div><strong>01 · ${t('Know before you bid')}</strong><span>${t('Opening time and Inner Circle eligibility are announced in advance.')}</span></div><div><strong>02 · ${t('Enter the public round')}</strong><span>${t('The ten distinct members with the highest bids qualify.')}</span></div><div><strong>03 · ${t('Make a sealed offer')}</strong><span>${t('A private bid, at least the highest public-round price. You may revise it until the round ends.')}</span></div><div><strong>04 · ${t('Resolve a tie fairly')}</strong><span>${t('Highest tied members bid privately again, until one winner remains.')}</span></div></div></section><details class="auction-disclosure"><summary>${t('About this preview lot and bidding rules')}</summary><p>${t('This item and all bids are demonstration data. No claim of stage use, signature or provenance is made. Final auction details and authenticity documentation must be supplied by the creator.')}</p><p>${t('Sample auction amounts are whole HKD. Sealed bids can be revised up or down until each round ends; the last confirmed amount counts and must meet that round’s minimum. Fewer than ten valid public bidders all qualify. A tie at the qualification cutoff pauses for review. Tiebreak minimums follow the preceding tied amount. Empty final rounds close without a sale. These edge policies require business approval before launch.')}</p><p>${t('Browser-only prototype: private bid data, time and eligibility are simulated, not protected server-side. No real payment or binding bid occurs.')}</p></details>`;
    root.querySelector('.auction-title')?.remove();
    if(compact)root.innerHTML=`<div class="auction-quick-identity"><img src="${esc(lot.image)}" alt="${esc(lot.alt)}" width="72" height="84"><div><span>${esc(lot.collection)}</span><h3>${esc(lot.title)}</h3><button type="button" class="club-text-link" data-open-full>${t('Full auction & details')} ↗</button></div></div><div class="auction-console">${bidSurface(v,lot,editingSealed)}<div class="auction-pulse-line" aria-hidden="true"></div>`;
    const input=root.querySelector('input[name="amount"]');
    if(input){
      if(drafts.has(renderedDraftKey))input.value=drafts.get(renderedDraftKey);
      input.addEventListener('input',()=>drafts.set(renderedDraftKey,input.value));
      if(focusInput)input.focus({preventScroll:true});
    }
    root.querySelector('[data-bid-form]')?.addEventListener('submit',reviewBid);
    root.querySelector('[data-edit-sealed]')?.addEventListener('click',()=>{editingSealed=true;render();root.querySelector('#auction-bid')?.focus({preventScroll:true});});
    root.querySelector('[data-cancel-sealed]')?.addEventListener('click',()=>{editingSealed=false;drafts.delete(renderedDraftKey);render();root.querySelector('[data-edit-sealed]')?.focus({preventScroll:true});});
    root.querySelector('[data-auction-details]')?.addEventListener('click',()=>track(openAuctionLotDetails(lot,root),'[data-auction-details]'));
    root.querySelector('[data-auction-reminder]')?.addEventListener('click',async()=>{const {updateMember}=await import('./member-store.js');updateMember({notices:[...new Set([...member().notices,'auction-reminder:'+lot.id])]});notify(t('Preview reminder saved. No notification will be sent.'));});
    root.querySelector('[data-auction-access]')?.addEventListener('click',()=>track(explainAccess()));
    root.querySelector('[data-auction-settle]')?.addEventListener('click',settle);
    disposeStamp=mountWinStamp(root.querySelector('.auction-win-stamp'),`${member().id}:${v.id}:${v.round}:${v.winner?.amount}`);
    const status=root.querySelector('.auction-leading-badge'),nextStatus=status?.textContent||'';
    if(lastBidStatus!==null && nextStatus!==lastBidStatus && v.stage==='open' && nextStatus){
      notify(t('{title}: {status}.',{title:lot.title,status:nextStatus}));
      if(window.gsap && motionOK())badgeMotion=trackMotion(gsap.fromTo(status,{opacity:0},{opacity:1,duration:.14}));
    }
    lastBidStatus=nextStatus;
    if(['announced','open','sealed','tie'].includes(v.stage)) {
      const timing=document.createElement('p');timing.className='auction-caption';timing.style.marginTop='16px';timing.textContent=v.stage==='announced'?t('Opens {date}',{date:dateLabel(v.opensAt)}):t('Deadline {date}',{date:dateLabel(v.deadline)});
      root.querySelector('.auction-console').append(timing);
    }
    if(previousPhase && previousPhase!==phase && window.gsap && motionOK()) {
      const console=root.querySelector('.auction-console');
      trackMotion(gsap.fromTo(console.querySelectorAll('h2,.auction-receipt,.auction-result:not([data-result="won"]),.auction-metrics'),{y:6,opacity:0},{y:0,opacity:1,duration:.22,ease:'power2.out',clearProps:'transform,opacity'}));
    }
    // The containing sheet owns entry motion; live bid updates stay still.
  }
  function reviewBid(event) {
    event.preventDefault();const form=event.target;const amount=Number(new FormData(form).get('amount'));const v=snapshot();
    const error=form.querySelector('[role="alert"]');
    if(!Number.isSafeInteger(amount)||amount<v.floor){error.textContent=t('Enter a whole HKD amount of at least {amount}.',{amount:money(v.floor)});form.querySelector('input').focus();return;}
    if(!v.canBid){error.textContent=t('This round is no longer accepting your bid.');return;}
    const hidden=['sealed','tie'].includes(v.stage);
    if(hidden&&v.ownBid?.amount===amount){error.textContent=t('This is already your confirmed bid. Enter a different amount or keep your current bid.');return;}
    const reviewedStage=v.stage,reviewedRound=v.round,reviewedFloor=v.floor,reviewedUser=member().id,reviewedRevision=v.ownBid?.revision||0;
    overlay(hidden?(v.ownBid?t('Update your sealed bid'):t('Seal your bid')):t('Review your bid'),`<span class="club-kicker">${esc(lot.title)} · ${t('Preview lot')}</span>${v.ownBid?`<p class="auction-review-previous">${t('Currently confirmed: {amount}',{amount:money(v.ownBid.amount)})}</p>`:''}<div class="bid-review-amount">${money(amount)}</div><p>${hidden?(v.ownBid?t('Only you will see this amount. Confirming replaces your current sealed bid. You may change it again before the round ends. Your last confirmed amount counts.'):t('Only you will see this amount. You may change it again before the round ends. Your last confirmed amount counts.')):t('This bid will be visible in the public round. A top-ten position at the deadline qualifies you for the sealed round.')}</p><p class="club-quiet">${t('No real money is charged. This is a demonstration bid.')}</p><p class="club-form-error" data-confirm-error role="alert"></p><button class="club-button is-red" data-confirm-bid>${hidden?(v.ownBid?t('Confirm updated bid'):t('Confirm & seal bid')):t('Confirm preview bid')}</button>`,node=>{
      node.querySelector('[data-confirm-bid]').addEventListener('click',()=>{
        const button=node.querySelector('[data-confirm-bid]');button.disabled=true;
        try {
          const latest=snapshot();
          if(!active || reviewedUser!==member().id)throw new Error(t('Your account changed. Close this review and check your membership.'));
          if(latest.stage!==reviewedStage||latest.round!==reviewedRound)throw new Error(t('The round changed. Close this review and check the new stage.'));
          if(latest.floor!==reviewedFloor)throw new Error(t('The minimum bid changed. Close this review and review the updated amount.'));
          if(hidden&&(latest.ownBid?.revision||0)!==reviewedRevision)throw new Error(t('Your sealed bid changed in another window. Close this review and check your current bid.'));
          savingBid=true;
          submitAuctionBid(amount,lot.id,{stage:reviewedStage,round:reviewedRound,floor:reviewedFloor,userId:reviewedUser,revision:reviewedRevision});savingBid=false;node.close();
          editingSealed=false;drafts.delete(renderedDraftKey);render();
          const console=root.querySelector('.auction-console');
          if(window.gsap&&motionOK()&&console){const line=console.querySelector('.auction-pulse-line');trackMotion(gsap.fromTo(line,{scaleX:0,opacity:.6},{scaleX:1,opacity:0,duration:.2,ease:'power2.out'}));}
          if(hidden&&window.gsap&&motionOK()&&console?.querySelector('.auction-receipt'))trackMotion(gsap.fromTo(console.querySelector('.auction-receipt'),{opacity:.4,y:4},{opacity:1,y:0,duration:.2,ease:'power2.out',clearProps:'opacity,transform'}));
          notify(hidden?(v.ownBid?t('Your sealed bid has been updated.'):t('Your sealed bid is received. Only you can see it.')):t('Your public bid is received.'));
        }catch(err){savingBid=false;node.querySelector('[data-confirm-error]').textContent=err.message;button.disabled=false;}
      });
    });
  }
  function settle() {
    openAuctionPayment({lot,snapshot,overlay:(...args)=>track(dialog(...args),'[data-auction-settle]',true),onChange:render,isActive:()=>active});
  }
  const update=event=>{if(!savingBid && (!event.detail?.lotId || event.detail.lotId===lot.id))render();};
  document.addEventListener('auction:change',update);document.addEventListener('member:change',update);
  render(true);
  const timer=setInterval(()=>{if(!active||document.hidden)return;try{const v=tickAuction(lot.id);if(v.stage!==phase)render();const clock=root.querySelector('[data-auction-clock]');if(clock)clock.textContent=timeLeft(v);}catch(error){const output=root.querySelector('.auction-error');if(output)output.textContent=error.message;}},1000);
  return ()=>{active=false;badgeMotion?.kill();disposeStamp();clearInterval(timer);for(const node of overlays)if(node.open)node.close();document.removeEventListener('auction:change',update);document.removeEventListener('member:change',update);};
}
