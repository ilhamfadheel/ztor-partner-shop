import { mountNavigation } from './navigation.js';
import { mountDevTools } from './dev-tools.js';
import { cart } from './cart.js';
import { COLLECTIONS } from './data.js';
// Shared commerce inner-page header. The runway owns its own frozen header.
export function mountHeader() {
  const slot = document.querySelector('[data-slot="header"]');
  if (!slot) return document.querySelector('.header');
  slot.outerHTML = `<header class="header">
    <a class="brand" href="/#rockstar" aria-label="LLOUD home"><img src="assets/brand/brand-logo.svg" width="48" height="32" alt="LLOUD"></a>
    <nav class="collection-index" aria-label="Collections">
      ${COLLECTIONS.map(collection => `<a href="/#${collection.id}">${collection.name}</a>`).join('')}
    </nav>
    <div class="header-actions">
      <a class="fan-club fan-club-button" href="/fan-club">Fan Club</a>
      <a class="bag-link" href="?view=bag" aria-label="Shopping bag">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg><span class="commerce-bag-count" aria-hidden="true"></span>
      </a>
    </div>
  </header>`;
  const bag=document.querySelector('.bag-link'),badge=bag.querySelector('.commerce-bag-count');
  const sync=event=>{const count=cart.count();badge.textContent=count?String(count):'';bag.setAttribute('aria-label',count?`Shopping bag, ${count} ${count===1?'item':'items'}`:'Shopping bag');if(event?.detail?.type==='add'){badge.classList.remove('is-added');void badge.offsetWidth;badge.classList.add('is-added');}};
  sync();document.addEventListener('cart:change',sync);
  mountNavigation();
  mountDevTools();
  // The current world, and again when the page changes it (a product page wears its piece's collection).
  const mark = () => {
    const key = document.documentElement.dataset.collection;
    document.querySelectorAll('.collection-index a').forEach(a => {
      if (a.hash === '#' + key) a.setAttribute('aria-current','true'); else a.removeAttribute('aria-current');
    });
  };
  mark(); document.addEventListener('collection:change', mark);
  return document.querySelector('.header');
}
