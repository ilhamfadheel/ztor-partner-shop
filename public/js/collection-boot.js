/* js/collection-boot.js — CLASSIC script, loaded synchronously in <head> BEFORE any stylesheet paints.
   Stamps data-collection on <html> pre-paint so the world tokens exist on first frame
   (an ES module is deferred; without this the world would fade in from transparent over 900ms).
   Product routes first use the catalogue's p-<collection>-<slug> identity convention.
   Other routes: ?collection= > localStorage['lisa.collection'] > rockstar. */
(function () {
  var VALID = ['rockstar', 'beach', 'paddock', 'silence-is-loud'];
  var KEY = 'lisa.collection';
  var root = document.documentElement;
  var fromQuery = null, fromStore = null, fromProduct = null;
  try {
    var query = new URLSearchParams(location.search);
    fromQuery = query.get('collection');
    if (root.getAttribute('data-page') === 'product') {
      var match = /^p-(rockstar|beach|paddock|silence-is-loud)-.+$/.exec(query.get('id') || '');
      fromProduct = match && match[1];
    }
  } catch (e) {}
  try { fromStore = localStorage.getItem(KEY); } catch (e) {}
  var id = fromProduct || (VALID.indexOf(fromQuery) >= 0 ? fromQuery : (VALID.indexOf(fromStore) >= 0 ? fromStore : 'rockstar'));
  root.setAttribute('data-collection', id);
})();
