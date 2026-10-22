import {AUCTION_LOTS,auctionLot} from './auction-catalog.js';
import {auctionSnapshot} from './auction-session.js';
import {member} from './member-store.js';
import {esc,motionOK} from './club-ui.js';

const closedStages=new Set(['settled','no-sale','review']);
const stages={announced:'Coming soon',open:'Public bidding',sealed:'Sealed round',tie:'Tiebreak',settled:'Finished','no-sale':'Closed',review:'Under review'};
const clock=v=>{
  if(closedStages.has(v.stage))return 'Closed';
  const seconds=Math.max(0,Math.ceil(((v.stage==='announced'?v.opensAt:v.deadline)-v.now)/1000));
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
};
function bidStatus(v) {
  if(v.stage==='open'){
    const highest=(v.publicBids||[]).reduce((top,b)=>!top||b.amount>top.amount?b:top,null);
    return highest?.userId===member().id?['You’re leading','leading']:['Outbid','outbid'];
  }
  if(['sealed','tie'].includes(v.stage))return v.ownBid?['Sealed & received','received']:[stages[v.stage],'private'];
  if(v.stage==='settled')return v.winner?.userId===member().id?['You won','leading']:['Finished','closed'];
  return [stages[v.stage],'closed'];
}

/** One catalogue, one URL-backed sheet, one selected bid controller.
 * All monetary actions stay in the existing auction controller/session.
 */
export function mountAuctionWorkspace(root,{mountList,mountLot}) {
  let sheet=null,body=null,lotCleanup=null,mode=null,selected=null,opener=null;
  let animation=null,closing=false,active=true,keyboard=false,nextHistoryKeyboard=null,pendingClose=false;
  const drafts=new Map();
  const participating=()=>AUCTION_LOTS.filter(lot=>auctionSnapshot(lot.id).participated);
  const route=()=>{
    const params=new URLSearchParams(location.search);
    return {mode:params.has('bids')?'bids':params.has('lot')?'lot':null,id:params.get('lot')};
  };
  const listURL=()=>{const url=new URL(location.href);url.searchParams.delete('lot');url.searchParams.delete('bids');return url;};
  function navigate(nextMode,id,instant=false) {
    keyboard=instant;
    const url=listURL();
    if(nextMode==='bids')url.searchParams.set('bids','1');
    if(id)url.searchParams.set('lot',id);
    if(!route().mode){
      opener=document.activeElement?.dataset.auctionCard?{lot:document.activeElement.dataset.auctionCard}:{bids:true};
      history.pushState({...history.state,auctionSheet:true},'',url);
    }else history.replaceState({...history.state,auctionSheet:true},'',url);
    sync();
  }
  function requestClose(instant=false) {
    if(pendingClose)return;
    keyboard=instant;
    if(route().mode && history.state?.auctionSheet){pendingClose=true;nextHistoryKeyboard=instant;history.back();}
    else {history.replaceState(history.state,'',listURL());sync();}
  }
  function focusOpener() {
    requestAnimationFrame(()=>{
      if(sheet?.open||!active||document.querySelector('dialog[open]'))return;
      const target=opener?.lot?root.querySelector(`[data-auction-card="${opener.lot}"]`):root.querySelector('[data-my-bids]');
      if(document.activeElement===document.body||!document.activeElement?.isConnected)target?.focus({preventScroll:true});
    });
  }
  function animateTo(open,instant,onfinish) {
    const node=sheet;
    if(!node)return;
    const from=getComputedStyle(node).transform;
    animation?.cancel();
    if(instant||!motionOK()){node.style.transform='none';onfinish?.();return;}
    animation=node.animate([{transform:from==='none'?'translateX(0)':from},{transform:open?'translateX(0)':'translateX(100%)'}],{
      duration:open?250:200,easing:'cubic-bezier(0.32,0.72,0,1)',fill:'forwards'
    });
    animation.onfinish=()=>{node.style.transform=open?'none':'translateX(100%)';animation.cancel();animation=null;onfinish?.();};
  }
  function closeSheet(instant=false) {
    if(!sheet||closing)return;
    closing=true;
    lotCleanup?.();lotCleanup=null;
    // Dismiss owned review/details before their parent; no orphaned bid action.
    animateTo(false,instant,()=>{
      sheet.close();sheet.remove();sheet=null;body=null;mode=null;selected=null;closing=false;
      focusOpener();
    });
  }
  function createSheet() {
    sheet=document.createElement('dialog');
    sheet.className='auction-workspace';
    sheet.setAttribute('aria-labelledby','auction-sheet-title');
    sheet.innerHTML='<div class="auction-sheet-surface"><header class="auction-sheet-head"><button type="button" class="auction-sheet-back" data-auction-sheet-close>← All auctions</button><h2 id="auction-sheet-title" tabindex="-1"></h2><button type="button" class="auction-my-bids" data-auction-sheet-bids>My bids <span data-bids-count></span></button></header><div class="auction-sheet-body"></div></div>';
    document.body.append(sheet);body=sheet.querySelector('.auction-sheet-body');
    sheet.addEventListener('cancel',event=>{event.preventDefault();requestClose(true);});
    sheet.addEventListener('click',event=>{
      if(event.target===sheet){const b=sheet.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)requestClose(event.detail===0);}
      if(event.target.closest('[data-auction-sheet-close]'))requestClose(event.detail===0);
      if(event.target.closest('[data-auction-sheet-bids]'))navigate('bids',participating().some(l=>l.id===selected)?selected:null,event.detail===0);
      const tab=event.target.closest('[data-quick-lot]');
      if(tab)navigate('bids',tab.dataset.quickLot,true);
      if(event.target.closest('[data-open-full]')&&selected)navigate('lot',selected,true);
      if(event.target.closest('[data-browse-auctions]'))requestClose(event.detail===0);
    });
    sheet.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const controls=[...sheet.querySelectorAll('button,input,a[href],[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length);
      const first=controls[0],last=controls.at(-1),focused=document.activeElement;
      if(event.shiftKey&&(focused===first||!controls.includes(focused))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(focused===last||!controls.includes(focused))){event.preventDefault();first?.focus();}
    });
    sheet.showModal();sheet.style.transform=keyboard||!motionOK()?'none':'translateX(100%)';
    animateTo(true,keyboard);
  }
  function quickList() {
    const list=sheet?.querySelector('[data-quick-list]');if(!list)return;
    const focusId=document.activeElement?.dataset.quickLot;
    list.innerHTML=participating().map(lot=>{
      const v=auctionSnapshot(lot.id),[label,state]=bidStatus(v);
      return `<button type="button" class="auction-quick-tab" data-quick-lot="${lot.id}" aria-pressed="${lot.id===selected}"><img src="${esc(lot.image)}" alt="" width="48" height="56"><span class="auction-quick-tab-copy"><strong>${esc(lot.title)}</strong><span class="auction-bid-state is-${state}">${label}</span></span><span class="auction-quick-clock"><span>${closedStages.has(v.stage)?'Bidding':'Ends in'}</span><strong data-quick-clock="${lot.id}">${clock(v)}</strong></span></button>`;
    }).join('');
    if(focusId)list.querySelector(`[data-quick-lot="${focusId}"]`)?.focus({preventScroll:true});
  }
  function sync() {
    if(!active)return;
    const next=route();
    if(!next.mode){closeSheet(keyboard);return;}
    if(closing){closing=false;animateTo(true,keyboard);}
    const fresh=!sheet;
    if(fresh)createSheet();
    const rows=participating();
    const lot=next.mode==='bids'?(rows.find(l=>l.id===next.id)||rows[0]):auctionLot(next.id);
    const unchanged=mode===next.mode&&selected===(lot?.id||null)&&!!lotCleanup;
    mode=next.mode;selected=lot?.id||null;
    sheet.classList.toggle('is-quick-bids',mode==='bids');
    sheet.querySelector('#auction-sheet-title').textContent=mode==='bids'?'My bids':lot?.title||'Auction not found';
    sheet.querySelector('[data-auction-sheet-bids]').hidden=mode==='bids';
    sheet.querySelector('[data-bids-count]').textContent=rows.length;
    if(unchanged){quickList();return;}
    lotCleanup?.();lotCleanup=null;
    body.scrollTop=0;
    if(!lot){
      body.innerHTML=`<div class="auction-sheet-empty"><h3>${mode==='bids'?(member().id?'Your next move starts here.':'Sign in to see your bids.'):'This auction is not available.'}</h3><p>${mode==='bids'?'Pieces you have bid on appear here, with their own countdown and bidding status.':'Return to the catalogue to explore the available pieces.'}</p><button type="button" class="club-button" data-browse-auctions>Browse auctions ↗</button></div>`;
    }else{
      body.innerHTML=mode==='bids'?'<p class="auction-quick-intro">Your pieces, in one place. Select a piece to review or raise your bid.</p><div class="auction-quick-list" data-quick-list role="group" aria-label="Your auction items"></div><div data-auction-lot-content class="auction-quick-content"></div>':'<div data-auction-lot-content class="auction-full-content"></div>';
      quickList();
      lotCleanup=mountLot(body.querySelector('[data-auction-lot-content]'),lot,{compact:mode==='bids',drafts});
    }
    sheet.querySelector('#auction-sheet-title').focus({preventScroll:true});
  }
  // A cold deep link also has a real catalogue return point. Preserve unrelated params.
  if(route().mode&&!history.state?.auctionSheet){
    const initial=location.href;
    history.replaceState(history.state,'',listURL());
    history.pushState({...history.state,auctionSheet:true},'',initial);
    opener={lot:route().id};
  }
  const listCleanup=mountList(root,(id,instant)=>navigate('lot',id,instant),instant=>navigate('bids',null,instant));
  const stateChanged=()=>{if(sheet&&!closing)sync();};
  const onHistory=()=>{pendingClose=false;keyboard=nextHistoryKeyboard??true;nextHistoryKeyboard=null;sync();};
  window.addEventListener('popstate',onHistory);
  document.addEventListener('auction:change',stateChanged);
  document.addEventListener('member:change',stateChanged);
  const timer=setInterval(()=>{
    if(!sheet||document.hidden)return;
    sheet.querySelectorAll('[data-quick-clock]').forEach(el=>el.textContent=clock(auctionSnapshot(el.dataset.quickClock)));
  },1000);
  sync();
  return ()=>{
    active=false;listCleanup();lotCleanup?.();clearInterval(timer);animation?.cancel();
    sheet?.close();sheet?.remove();
    document.removeEventListener('auction:change',stateChanged);document.removeEventListener('member:change',stateChanged);window.removeEventListener('popstate',onHistory);
  };
}
