import { initCollection } from './collection.js';
import { translateDocument } from './i18n.js';
import { mountHeader } from './header.js';
import { mountDrawer } from './drawer.js';
export function mountSite() {
  translateDocument();
  const collection = initCollection();
  const header = mountHeader();
  const drawer = mountDrawer();
  document.documentElement.classList.add('is-site-ready');
  return { collection, header, drawer };
}
export { initCollection, mountHeader, mountDrawer };
