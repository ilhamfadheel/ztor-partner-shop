import { initCollection } from './collection.js';
import { mountHeader } from './header.js';
import { mountDrawer } from './drawer.js';
export function mountSite() {
  const collection = initCollection();
  const header = mountHeader();
  const drawer = mountDrawer();
  document.documentElement.classList.add('is-site-ready');
  return { collection, header, drawer };
}
export { initCollection, mountHeader, mountDrawer };
