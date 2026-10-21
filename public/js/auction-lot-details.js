// All current lot stories/specifications are illustrative, not verified provenance.
// This is a read-only auction view, never a retail product link or bid action.
import {dialog,esc,notify} from './club-ui.js';

export function openAuctionLotDetails(lot, root) {
  const details=lot.details;
  if(!details)return notify('The creator is preparing the details for this piece.');
  const node=dialog('The story & details',`
    <div class="lot-detail-preview" role="note"><strong>Illustrative auction listing</strong><span>The story, specifications and images are demo content. Provenance has not been verified.</span></div>
    <div class="lot-detail-hero">
      <figure class="lot-detail-art"><img src="${esc(lot.image)}" alt="${esc(lot.alt)}" width="640" height="720"><figcaption>Reference image · final lot photography pending</figcaption></figure>
      <div class="lot-detail-story"><span class="lot-detail-edition">${esc(details.edition)}</span><p class="lot-detail-name">${esc(lot.title)}</p><h3>${esc(details.headline)}</h3><p>${esc(details.story)}</p><span class="lot-detail-exclusive">An auction piece. Not a shop item.</span></div>
    </div>
    <div class="lot-detail-body">
      <section class="lot-detail-history" aria-label="Illustrative provenance"><h3>Its story, on record.</h3><ol>${details.history.map(item=>`<li><span class="lot-detail-date">${esc(item.date)}</span><div><h4>${esc(item.title)}</h4><p>${esc(item.text)}</p></div></li>`).join('')}</ol></section>
      <section class="lot-detail-specs"><h3>The piece, up close.</h3><p>Example specifications · final details must be confirmed by the creator.</p><dl>${details.specifications.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>
      <section class="lot-detail-auth"><div class="lot-detail-auth-head"><h3>Provenance & authenticity</h3><span>Not yet verified</span></div><p>A unique piece needs a documented story. These records must be supplied before a real auction goes live.</p><ul>${details.documents.map(label=>`<li><span>${esc(label)}</span><small>Pending</small></li>`).join('')}</ul></section>
      <button type="button" class="club-button lot-detail-return" data-lot-detail-close>Back to auction<span aria-hidden="true">↗</span></button>
    </div>`,dialogNode=>{
      dialogNode.classList.add('lot-detail-dialog');
      dialogNode.querySelector('[data-lot-detail-close]').addEventListener('click',()=>dialogNode.close());
    });
  // The auction clock/other tabs can replace the opener while details are open.
  node.addEventListener('close',()=>{
    if(document.activeElement===document.body && !document.querySelector('dialog[open]'))root.querySelector('[data-auction-details]')?.focus({preventScroll:true});
  },{once:true});
  return node;
}
