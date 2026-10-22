// Demonstration lots, not published auctions. Production catalog comes from Creator Studio.
export const AUCTION_LOTS = Object.freeze([
  Object.freeze({id:'encore', auctionId:'lloud-stage-worn-preview', title:'The Encore jacket', collection:'Rockstar', image:'assets/products/p-rockstar-encore-leather-jacket.webp', alt:'Black leather jacket with red lining', openingPrice:5000, scenario:'open',
    details: {
      status:'illustrative', edition:'One-off stage commission', headline:'The Bangkok encore.',
      story:'Handcrafted for Lisa’s concert wardrobe in 2024, then worn for an encore in Bangkok in 2025. A sculpted fit, red satin lining and silver-tone hardware make this particular jacket part of the performance — not a piece from a retail rack.',
      history:[{date:'2024',title:'Made for the stage',text:'A special atelier commission, fitted for Lisa’s concert wardrobe.'},{date:'2025',title:'Bangkok · the encore',text:'The exact performance date and appearance records would accompany the final listing.'}],
      specifications:[['Size','Custom fit · reference S'],['Colour','Black / red lining'],['Fabric','Leather outer · satin lining'],['Measurements','Chest 84 cm · length 54 cm · sleeve 58 cm'],['Designer / atelier','Special commission · maker to be confirmed'],['Edition','One commissioned piece · not a retail edition'],['Condition','Stage-worn · detailed condition report pending'],['Included','The jacket · final presentation and documents to be confirmed']],
      documents:['Certificate of authenticity','Concert / atelier provenance records','Measurements and condition report']
    }}),
  Object.freeze({id:'pit-wall', auctionId:'lloud-pit-wall-preview', title:'The Pit Wall jacket', collection:'Paddock', image:'assets/products/p-paddock-pit-wall-jacket.webp', alt:'Black technical zip jacket', openingPrice:3200, scenario:'open',
    details: {
      status:'illustrative', edition:'One-off rehearsal piece', headline:'Before the lights come on.',
      story:'A technical jacket tailored for Lisa’s rehearsal wardrobe. The cut was adjusted for movement, with individually finished panels and a personal fit. This auction is for the specific archive piece, not a new jacket from the shop.',
      history:[{date:'2024',title:'A personal fitting',text:'Custom alterations for Lisa’s rehearsal wardrobe.'},{date:'Archive',title:'One particular piece',text:'The rehearsal date, location and wardrobe records would identify the exact item offered.'}],
      specifications:[['Size','Custom fit · reference M'],['Colour','Black / off-white panels'],['Fabric','Technical nylon shell · mesh lining'],['Measurements','Chest 96 cm · length 59 cm · sleeve 60 cm'],['Designer / atelier','Custom wardrobe atelier · maker to be confirmed'],['Edition','Single archive piece · not a retail edition'],['Condition','Rehearsal-worn · detailed condition report pending'],['Included','The jacket · final presentation and documents to be confirmed']],
      documents:['Certificate of authenticity','Wardrobe and alteration records','Measurements and condition report']
    }}),
  Object.freeze({id:'shell', auctionId:'lloud-shell-preview', title:'The Shell pendant', collection:'Beach Club', image:'assets/products/p-beach-shell-pendant.webp', alt:'Gold-tone shell pendant', openingPrice:800, scenario:'announced',
    details: {
      status:'illustrative', edition:'Single artisan commission', headline:'A little piece of summer.',
      story:'A shell pendant hand-finished as a personal commission for Lisa. Small variations in its surface belong to this individual piece. A collector’s object from a private wardrobe, not an off-the-shelf accessory.',
      history:[{date:'Commission',title:'Finished by hand',text:'An individual shell form, assembled and polished by an artisan.'},{date:'Archive',title:'Kept as a personal piece',text:'The maker, commission date and chain of ownership would be documented before bidding opens.'}],
      specifications:[['Size','Pendant 24 × 18 mm · chain 45 cm'],['Colour','Warm gold tone'],['Material','Gold-plated brass · composition to be confirmed'],['Measurements','Adjustable chain 40–45 cm'],['Designer / atelier','Independent artisan · maker to be confirmed'],['Edition','Single commission · no retail production run'],['Condition','Archive-kept · detailed condition report pending'],['Included','Pendant and chain · final presentation to be confirmed']],
      documents:['Certificate of authenticity','Maker and ownership records','Material and condition report']
    }})
]);
export const auctionLot = id => AUCTION_LOTS.find(lot => lot.id === id) || null;
export function currentAuctionLot() {
  return auctionLot(new URLSearchParams(globalThis.location?.search || '').get('lot')) || AUCTION_LOTS[0];
}
export const auctionHref = lot => `auction.html?lot=${encodeURIComponent(lot.id)}`;
export const auctionPaymentKey = lot => 'lloud_auction_settlement_preview_v1' + (lot.id === 'encore' ? '' : '_' + lot.id);
