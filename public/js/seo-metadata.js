import {getProduct,getCollection} from './data.js';
import {auctionLot} from './auction-catalog.js';

// Mirrors vercel.json cleanUrls. Identity parameters are content, not tracking.
export const SEO_ORIGIN='https://lloud.club';
const canonical=(path,params={})=>{
  const url=new URL(path,SEO_ORIGIN);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return url.href;
};
export function metadataFor(value) {
  const url=new URL(value,SEO_ORIGIN),page=url.pathname.split('/').pop().replace(/\.html$/,'');
  if(page==='product') {
    const ids=url.searchParams.getAll('id'),product=ids.length===1?getProduct(ids[0]):null;
    if(!product)return {title:'Product unavailable | LLOUD',description:'This product link is incomplete or the piece is not in the current LLOUD catalog.',robots:'noindex, follow',canonical:null,image:null};
    const collection=getCollection(product.collection);
    return {
      title:`${product.name} | ${collection.name} | LLOUD`,
      description:`Explore ${product.name} from the LLOUD ${collection.name} collection. View product photos and size options.`,
      robots:'index, follow, max-image-preview:large',
      canonical:canonical('/product',{id:product.slug}),
      image:new URL(product.image+'',SEO_ORIGIN+'/').href
    };
  }
  if(page==='auction') {
    const ids=url.searchParams.getAll('lot'),lot=ids.length===1?auctionLot(ids[0]):null;
    const personal=url.searchParams.has('bids');
    if(personal)return {title:'My preview bids | LLOUD',description:'Your auction activity in this local LLOUD preview.',robots:'noindex, follow',canonical:null,image:null};
    if(ids.length&&!lot)return {title:'Auction unavailable | LLOUD',description:'This auction link is not in the current LLOUD preview catalog.',robots:'noindex, follow',canonical:null,image:null};
    return {
      title:lot?`${lot.title} | Auction preview | LLOUD`:'Auction preview | LLOUD',
      description:lot?`Explore ${lot.title} in the LLOUD auction preview. This illustrative lot is not a live sale; its history and details are not verified.`:'Explore the LLOUD auction experience. Lots, bidding and deadlines are demonstration data, not live sales.',
      // auction-catalog.js contains illustrative lots, not creator-published auctions.
      robots:'noindex, follow',
      canonical:lot?canonical('/auction',{lot:lot.id}):canonical('/auction'),
      image:lot?new URL(lot.image,SEO_ORIGIN+'/').href:null
    };
  }
  return null;
}
