// Tiny classic-script safety net: failed modules/media must never lock the shop.
(() => {
  // Retire the removed preload worker for returning visitors only. This never
  // gates entry/playback or registers a worker for a fresh visit.
  if ('serviceWorker' in navigator) {
    const workerURL = new URL('runway-cache.js', new URL('.', location.href)).href;
    navigator.serviceWorker.getRegistration(workerURL).then(registration => {
      const worker = registration?.active || registration?.waiting || registration?.installing;
      if (worker?.scriptURL === workerURL) return registration.update();
    }).catch(error => console.warn('Runway cache retirement:', error.message));
  }
  // A collection deep link is navigation, not a new visit to the welcome screen.
  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  const collection = query.get('view') === 'collection' && query.get('collection')
    ? query.get('collection') : location.hash.slice(1) || query.get('collection');
  if (['rockstar', 'beach', 'paddock', 'silence-is-loud'].includes(collection)) {
    // Paint the linked world before deferred modules/media load, matching showroom.js.
    root.dataset.collection = collection;
    return;
  }
  root.classList.add('is-entering');
  const state = { released: false, startedAt: 0, onRequest: null, onRelease: null };
  const release = (reason = 'fallback') => {
    if (state.released) return;
    state.released = true;
    root.classList.remove('is-entering', 'entry-revealing');
    const splash = document.querySelector('.entry');
    if (splash) { splash.hidden = true; splash.inert = true; }
    const covered = document.body.classList.contains('panel-open') || document.body.classList.contains('cart-open');
    for (const element of document.querySelectorAll('body > main, body > .header')) element.inert = covered;
    state.onRelease?.(reason);
    if (!window.runwaySnapshot) document.dispatchEvent(new Event('runway:ready'));
    document.dispatchEvent(new CustomEvent('runway:entered', { detail: { reason } }));
  };
  window.RunwayEntry = { state, release };
  document.addEventListener('DOMContentLoaded', () => {
    state.startedAt = performance.now();
    document.querySelector('.entry')?.focus({ preventScroll: true });
    for (const element of document.querySelectorAll('body > main, body > .header')) element.inert = true;
    const button = document.querySelector('[data-entry-enter]');
    button.addEventListener('click', () => state.onRequest ? state.onRequest() : release('boot-fallback'));
    setTimeout(() => {
      if (!state.onRequest && !state.released) {
        button.hidden = false;
        button.textContent = 'Continue to site';
        // A classic script: the page's language comes from the i18n module, loaded on demand.
        import('./i18n.js').then(({ t }) => { button.textContent = t('Continue to site'); }).catch(() => {});
      }
    }, 3000);
    // Slow transfers never masquerade as complete; the explicit button remains available.
  }, { once: true });
  addEventListener('pageshow', event => { if (event.persisted) release('history'); });
})();
