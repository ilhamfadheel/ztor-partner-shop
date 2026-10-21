// Retirement-only worker for the 2026-09-12 preload rollback.
// No fetch handler: Safari and desktop use their original native media path.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  // Remove only this feature's disposable movie cache, never account/site data.
  await caches.delete(`lloud-runway-v1:${new URL(self.registration.scope).pathname}`).catch(() => {});
  await self.registration.unregister();
})()));
