import {metadataFor} from './seo-metadata.js';

// Head-only enhancement. Does not rewrite history, links, focus or application state.
function meta(attribute,key,value) {
  const selector=`meta[${attribute}="${key}"]`;
  let node=document.head.querySelector(selector);
  if(value===null){node?.remove();return;}
  if(!node){node=document.createElement('meta');node.setAttribute(attribute,key);document.head.append(node);}
  if(node.content!==value)node.content=value;
}
let lastRoute='',lastTitle='';
function update() {
  const route=location.pathname+location.search;
  if(route===lastRoute&&document.title===lastTitle)return;
  const data=metadataFor(location.href);
  if(!data)return;
  lastRoute=route;lastTitle=data.title;
  if(document.title!==data.title)document.title=data.title;
  meta('name','description',data.description);
  meta('name','robots',/^(www\.)?lloud\.club$/.test(location.hostname)?data.robots:'noindex, follow');
  meta('property','og:site_name','LLOUD');
  meta('property','og:type','website');
  meta('property','og:title',data.title);
  meta('property','og:description',data.description);
  meta('property','og:url',data.canonical);
  meta('property','og:image',data.image);
  meta('name','twitter:card',data.image?'summary_large_image':'summary');
  let link=document.head.querySelector('link[rel="canonical"]');
  if(!data.canonical){link?.remove();return;}
  if(!link){link=document.createElement('link');link.rel='canonical';document.head.append(link);}
  if(link.href!==data.canonical)link.href=data.canonical;
}
update();
window.addEventListener('popstate',update);
// Auction sheets change history and then render. Observe rendering instead of
// monkey-patching the shared History API or adding navigation listeners.
const observer=new MutationObserver(update);
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>{update();observer.observe(document.body,{childList:true,subtree:true});},{once:true});
window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
window.addEventListener('pageshow',()=>{update();observer.observe(document.body,{childList:true,subtree:true});});
