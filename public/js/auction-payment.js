// Browser-only settlement preview. No payment credentials are persisted or sent.
import {member,canAuction} from './member-store.js';
import {auctionPaymentKey} from './auction-catalog.js';
import {readJSON,writeJSON,money} from './util.js';
import {esc} from './club-ui.js';
import {mockPay} from './mock-pay.js';
import {t} from './i18n.js';

export function auctionOrder(view,lot) {
  const value=readJSON(auctionPaymentKey(lot),null);
  if(view.stage!=='settled'||!view.winner||!value||value.demo!==true||typeof value.id!=='string'
    ||value.auctionId!==view.id||value.amount!==view.winner.amount
    ||(value.lotId&&value.lotId!==lot.id)||(value.userId&&value.userId!==view.winner.userId))return null;
  // Legacy confirmations only created an order. They did not complete a payment.
  const paid=value.status==='paid'&&value.userId===view.winner.userId&&Number.isFinite(value.paidAt);
  return {id:value.id,auctionId:view.id,lotId:lot.id,userId:view.winner.userId,title:lot.title,
    amount:view.winner.amount,currency:'HKD',status:paid?'paid':'pending',demo:true,
    ts:value.ts,...(paid?{paidAt:value.paidAt,last4:/^\d{4}$/.test(value.last4)?value.last4:''}:{})};
}

export function openAuctionPayment({lot,snapshot,overlay,onChange,isActive}) {
  const reviewed=snapshot(),userId=member().id;
  if(!userId||reviewed.stage!=='settled'||reviewed.winner?.userId!==userId)return;
  const key=auctionPaymentKey(lot);
  let order=auctionOrder(reviewed,lot),node,finished=false;
  const identity=()=>`<div class="auction-payment-item"><img src="${esc(lot.image)}" alt="${esc(lot.alt)}" width="64" height="76"><div><span class="club-kicker">${t('Winning lot')} · ${esc(lot.collection)}</span><h3>${esc(lot.title)}</h3><span class="club-quiet">${order?esc(order.id):t('Your winning bid')}</span></div></div>`;
  const check=()=>{
    const latest=snapshot();
    if(!isActive()||member().id!==userId)throw new Error(t('Your account changed. Close this window and sign in as the winning bidder.'));
    if(latest.stage!=='settled'||latest.id!==reviewed.id||latest.round!==reviewed.round
      ||latest.winner?.userId!==userId||latest.winner.amount!==reviewed.winner.amount)
      throw new Error(t('The auction result changed. Close this window and review the updated result before paying.'));
    return latest;
  };
  const eligibility=()=>{if(!canAuction())throw new Error(t('Your winning result is unchanged, but checkout is paused for an Inner Circle eligibility review. No payment was taken.'));};
  const error=message=>{
    const output=node.querySelector('[data-payment-error]');output.textContent=message;output.focus({preventScroll:true});
  };
  const show=(title,content,mount)=>{
    if(!node){node=overlay(title,content);node.classList.add('auction-payment-dialog');}
    else {node.querySelector('.club-dialog-head h2').textContent=title;node.querySelector('.club-dialog-body').innerHTML=content;node.scrollTop=0;}
    mount?.();
  };
  const errorHtml='<p class="club-form-error" data-payment-error role="alert" tabindex="-1"></p>';
  function receipt() {
    show(t('Payment preview complete'),`${identity()}<span class="auction-payment-status">${t('Paid · demo')}</span><div class="bid-review-amount">${money(order.amount)}</div><p>${t('Your auction order is confirmed in this browser.')}</p><p class="club-quiet">${t('No money was charged. This is a payment simulation, not a receipt for a real purchase.')}</p><button class="club-button" data-payment-done>${t('Back to auctions')}<span aria-hidden="true">↗</span></button>`,()=>{
      node.querySelector('[data-payment-done]').addEventListener('click',()=>node.close());
      node.querySelector('[data-payment-done]').focus({preventScroll:true});
    });
  }
  function complete(result) {
    if(finished||!node?.open)return;
    try {
      const latest=check();
      const current=auctionOrder(latest,lot);
      if(!current||current.id!==order.id)throw new Error(t('This order changed in another window. Close this window and review your order again.'));
      // Another window may have already completed this exact winning order.
      if(current?.status==='paid'){order=current;finished=true;onChange();receipt();return;}
      eligibility();
      const paid={...current,status:'paid',paidAt:Date.now(),last4:result.last4};
      if(!writeJSON(key,paid))throw new Error(t('This browser could not save the payment preview. Your order is still unpaid. Please try again.'));
      order=paid;finished=true;onChange();receipt();
    }catch(err){error(err.message);}
  }
  function payment() {
    try {
      const latest=check();
      order=auctionOrder(latest,lot);
      if(order?.status==='paid'){receipt();return;}
      eligibility();
      order=order||{id:'AU-'+crypto.randomUUID().slice(0,8).toUpperCase(),auctionId:latest.id,
        lotId:lot.id,userId,title:lot.title,amount:latest.winner.amount,currency:'HKD',
        status:'pending',ts:Date.now(),demo:true};
      if(!writeJSON(key,order))throw new Error(t('This browser could not save the order. Please try again. No payment was taken.'));
      onChange();
      show(t('Pay for your winning bid'),`${identity()}<p class="auction-payment-demo">${t('Payment preview only. Use test details, never a real card.')}</p><div data-auction-payment-form></div>${errorHtml}<details class="auction-payment-help"><summary tabindex="0">${t('Test payment details')}</summary><p>${t('Use any name, card 4242 4242 4242 4242, expiry 12/30 and code 123. A card ending 0002 previews a decline; 3220 previews bank verification. Nothing is sent to a bank.')}</p></details>`,()=>{
        mockPay.open({mount:node.querySelector('[data-auction-payment-form]'),amount:order.amount,currency:'HK$',
          title:t('Winning bid · sample all-in total'),forceForm:true,demoOnly:true,
          confirmLabel:t('Pay {amount} · demo',{amount:money(order.amount)}),backLabel:t('Back to order'),
          onSuccess:complete,onBack:summary});
      });
    }catch(err){error(err.message);}
  }
  function summary() {
    if(order?.status==='paid'){receipt();return;}
    show(t('Your auction order'),`${identity()}<span class="auction-payment-status is-pending">${t('Awaiting payment')}</span><div class="bid-review-amount">${money(reviewed.winner.amount)}</div><p>${t('Your winning bid is ready for checkout.')}</p><p class="club-quiet">${t('Sample all-in total. No extra fees are added in this preview. Live shipping and payment terms must be confirmed before bidding opens.')}</p>${errorHtml}<button class="club-button" data-go-payment>${t('Go to payment')}<span aria-hidden="true">↗</span></button><p class="club-quiet auction-payment-note">${t('Demo only · no real money will be charged.')}</p>`,()=>{
      node.querySelector('[data-go-payment]').addEventListener('click',payment);
      node.querySelector('[data-go-payment]').focus({preventScroll:true});
    });
  }
  summary();
  return node;
}
