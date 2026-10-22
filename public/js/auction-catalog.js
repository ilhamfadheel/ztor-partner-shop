import { t } from './i18n.js';

// Demonstration lots, not published auctions. Production catalog comes from Creator Studio.
export const AUCTION_LOTS = Object.freeze([
  Object.freeze({id:'encore', auctionId:'lloud-stage-worn-preview', title:t('The Encore jacket'), collection:'Rockstar', image:'assets/products/p-rockstar-encore-leather-jacket.webp', alt:t('Black leather jacket with red lining'), openingPrice:5000, scenario:'open',
    details: {
      status:'illustrative', edition:t('One-off stage commission'), headline:t('The Bangkok encore.'),
      story:t('Handcrafted for Lisa’s concert wardrobe in 2024, then worn for an encore in Bangkok in 2025. A sculpted fit, red satin lining and silver-tone hardware make this particular jacket part of the performance — not a piece from a retail rack.'),
      history:[{date:'2024',title:t('Made for the stage'),text:t('A special atelier commission, fitted for Lisa’s concert wardrobe.')},{date:'2025',title:t('Bangkok · the encore'),text:t('The exact performance date and appearance records would accompany the final listing.')}],
      specifications:[[t('Size'),t('Custom fit · reference S')],[t('Colour'),t('Black / red lining')],[t('Fabric'),t('Leather outer · satin lining')],[t('Measurements'),t('Chest 84 cm · length 54 cm · sleeve 58 cm')],[t('Designer / atelier'),t('Special commission · maker to be confirmed')],[t('Edition'),t('One commissioned piece · not a retail edition')],[t('Condition'),t('Stage-worn · detailed condition report pending')],[t('Included'),t('The jacket · final presentation and documents to be confirmed')]],
      documents:[t('Certificate of authenticity'),t('Concert / atelier provenance records'),t('Measurements and condition report')]
    }}),
  Object.freeze({id:'pit-wall', auctionId:'lloud-pit-wall-preview', title:t('The Pit Wall jacket'), collection:'Paddock', image:'assets/products/p-paddock-pit-wall-jacket.webp', alt:t('Black technical zip jacket'), openingPrice:3200, scenario:'open',
    details: {
      status:'illustrative', edition:t('One-off rehearsal piece'), headline:t('Before the lights come on.'),
      story:t('A technical jacket tailored for Lisa’s rehearsal wardrobe. The cut was adjusted for movement, with individually finished panels and a personal fit. This auction is for the specific archive piece, not a new jacket from the shop.'),
      history:[{date:'2024',title:t('A personal fitting'),text:t('Custom alterations for Lisa’s rehearsal wardrobe.')},{date:t('Archive'),title:t('One particular piece'),text:t('The rehearsal date, location and wardrobe records would identify the exact item offered.')}],
      specifications:[[t('Size'),t('Custom fit · reference M')],[t('Colour'),t('Black / off-white panels')],[t('Fabric'),t('Technical nylon shell · mesh lining')],[t('Measurements'),t('Chest 96 cm · length 59 cm · sleeve 60 cm')],[t('Designer / atelier'),t('Custom wardrobe atelier · maker to be confirmed')],[t('Edition'),t('Single archive piece · not a retail edition')],[t('Condition'),t('Rehearsal-worn · detailed condition report pending')],[t('Included'),t('The jacket · final presentation and documents to be confirmed')]],
      documents:[t('Certificate of authenticity'),t('Wardrobe and alteration records'),t('Measurements and condition report')]
    }}),
  Object.freeze({id:'shell', auctionId:'lloud-shell-preview', title:t('The Shell pendant'), collection:'Beach Club', image:'assets/products/p-beach-shell-pendant.webp', alt:t('Gold-tone shell pendant'), openingPrice:800, scenario:'announced',
    details: {
      status:'illustrative', edition:t('Single artisan commission'), headline:t('A little piece of summer.'),
      story:t('A shell pendant hand-finished as a personal commission for Lisa. Small variations in its surface belong to this individual piece. A collector’s object from a private wardrobe, not an off-the-shelf accessory.'),
      history:[{date:t('Commission'),title:t('Finished by hand'),text:t('An individual shell form, assembled and polished by an artisan.')},{date:t('Archive'),title:t('Kept as a personal piece'),text:t('The maker, commission date and chain of ownership would be documented before bidding opens.')}],
      specifications:[[t('Size'),t('Pendant 24 × 18 mm · chain 45 cm')],[t('Colour'),t('Warm gold tone')],[t('Material'),t('Gold-plated brass · composition to be confirmed')],[t('Measurements'),t('Adjustable chain 40–45 cm')],[t('Designer / atelier'),t('Independent artisan · maker to be confirmed')],[t('Edition'),t('Single commission · no retail production run')],[t('Condition'),t('Archive-kept · detailed condition report pending')],[t('Included'),t('Pendant and chain · final presentation to be confirmed')]],
      documents:[t('Certificate of authenticity'),t('Maker and ownership records'),t('Material and condition report')]
    }})
]);
export const auctionLot = id => AUCTION_LOTS.find(lot => lot.id === id) || null;
export function currentAuctionLot() {
  return auctionLot(new URLSearchParams(globalThis.location?.search || '').get('lot')) || AUCTION_LOTS[0];
}
export const auctionHref = lot => `/auction?lot=${encodeURIComponent(lot.id)}`;
export const auctionPaymentKey = lot => 'lloud_auction_settlement_preview_v1' + (lot.id === 'encore' ? '' : '_' + lot.id);
