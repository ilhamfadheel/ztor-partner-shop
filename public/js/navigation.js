import { initCollection } from './collection.js';
import { mountDrawer, openDrawer } from './drawer.js';

// Showroom and commerce pages share one origin and one bag.
export function mountNavigation() {
  const club = document.querySelector('.fan-club');
  if (!club || club.dataset.wired) return;
  club.dataset.wired = 'true';
  initCollection();
  mountDrawer();
  const bag = document.querySelector('.bag-link');
  bag.setAttribute('aria-haspopup', 'dialog');
  bag.setAttribute('aria-expanded', 'false');
  const syncOverlays = () => {
    const cartOpen = document.body.classList.contains('cart-open');
    const covered = cartOpen || document.body.classList.contains('panel-open') || document.documentElement.classList.contains('is-entering');
    document.querySelector('main').inert = covered;
    document.querySelector('.header').inert = covered;
    const panel = document.querySelector('[data-panel]');
    if (panel) panel.inert = cartOpen;
    bag.setAttribute('aria-expanded', String(cartOpen));
  };
  ['panel:open','panel:close','drawer:open','drawer:close'].forEach(type => document.addEventListener(type, syncOverlays));
  bag.addEventListener('click', event => { event.preventDefault(); openDrawer(bag); });
  if (new URLSearchParams(location.search).get('view') === 'bag') {
    if (document.documentElement.classList.contains('is-entering')) document.addEventListener('runway:entered', () => openDrawer(bag), { once: true });
    else queueMicrotask(() => openDrawer(bag));
  }
}
mountNavigation();
