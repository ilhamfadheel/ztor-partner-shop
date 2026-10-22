import { COLLECTION_IDS } from './data.js';
const base = new URL('../', import.meta.url);

// Loading hints only. Existing showroom code alone owns src, load(), play(),
// pause(), currentTime, seeks and gesture recovery. No duplicate video downloads,
// Blob URLs, hidden players, CacheStorage or intercepted native Range requests.
export class RunwayPreload {
  constructor() {
    this.videos = COLLECTION_IDS.map(key => ({ key, video: document.querySelector(`#${key} video`) }));
    this.skipped = matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(navigator.connection?.saveData);
    this.entered = false;
    this.error = null;
    this.manifest = fetch(new URL('assets/fashion/manifest.json', base))
      .then(response => { if (!response.ok) throw Error(`Manifest ${response.status}`); return response.json(); })
      .then(({ outfits }) => {
        for (const item of this.videos) {
          const ranges = outfits[item.key]?.ranges;
          if (!ranges?.return) throw Error(`Missing startup ranges: ${item.key}`);
          // The native loader opens on the authored back-to-front turn. Requiring
          // a second, distant approach buffer can deadlock a paused native video.
          item.startupRanges = [ranges.return];
        }
        this.hint();
      }).catch(error => { this.error = error.message; });
    this.background = { state: 'waiting', completed: 0, failed: 0 };
    this.observer = new MutationObserver(() => this.hint());
    for (const { video } of this.videos) {
      this.observer.observe(video, { attributes: true, attributeFilter: ['src', 'preload'] });
      video.addEventListener('progress', () => this.hint());
      video.addEventListener('loadedmetadata', () => this.hint());
    }
    this.timer = setInterval(() => { if (!document.hidden) this.hint(); }, 500);
    this.hint();
  }
  snapshot(critical = false) {
    const files = (critical ? this.videos.slice(0, 2) : this.videos).map(({ key, video, startupRanges = [] }) => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const ranges = [];
      let buffered = 0, covered = 0, contiguous = true;
      const currentRanges = video.buffered;
      for (let i = 0; i < currentRanges.length; i++) {
        const start = Math.max(0, currentRanges.start(i)), end = Math.min(duration, currentRanges.end(i));
        ranges.push([start, end]);
        buffered += Math.max(0, end - start);
        if (start > covered + .08) contiguous = false;
        covered = Math.max(covered, end);
      }
      const startupDuration = startupRanges.reduce((sum, [start, end]) => sum + end - start, 0);
      const startupBuffered = startupRanges.reduce((sum, [start, end]) => sum + ranges.reduce((n, [a, b]) => n + Math.max(0, Math.min(end, b) - Math.max(start, a)), 0), 0);
      const startupReady = startupRanges.length === 1 && duration > 0 && video.readyState >= 2 &&
        startupRanges.every(([start, end]) => end <= duration && ranges.some(([a, b]) => a <= start + .05 && b >= end - .05));
      return { key, duration, buffered, ranges, startupRanges, startupDuration, startupBuffered, startupReady,
        complete: duration > 0 && contiguous && covered >= duration - .08,
        error: video.error?.code || null };
    });
    return { method: 'native-buffer', scope: critical ? 'first-two-entrances' : 'all-films', skipped: this.skipped, error: this.error,
      startupReady: !this.error && files.length > 0 && files.every(file => file.startupReady && !file.error),
      startupBuffered: files.reduce((sum, file) => sum + file.startupBuffered, 0),
      startupDuration: files.every(file => file.startupDuration > 0) ? files.reduce((sum, file) => sum + file.startupDuration, 0) : 0,
      complete: files.length > 0 && files.every(file => file.complete && !file.error),
      buffered: files.reduce((sum, file) => sum + file.buffered, 0),
      duration: files.every(file => file.duration > 0) ? files.reduce((sum, file) => sum + file.duration, 0) : 0,
      files, background: { ...this.background } };
  }
  hint() {
    if (this.skipped || document.hidden) return;
    const { files } = this.snapshot();
    // First two during splash, then prepare each remaining entrance. Never
    // wait for a browser-limited whole-file buffer before warming the next film.
    const next = this.entered ? files.findIndex((file, i) => i >= 2 && !file.startupReady && !file.error) : -1;
    const limit = this.entered ? (next < 0 ? files.length : next + 1) : 2;
    for (const { video } of this.videos.slice(0, limit)) {
      // Wait for the unchanged native loader to establish its original source.
      if (video.getAttribute('src') && video.preload !== 'auto') video.preload = 'auto';
    }
  }
  async warm() {
    if (this.entered) return;
    this.entered = true;
    this.hint();
    if (this.skipped) { this.background.state = 'data-saver-or-reduced-motion'; return; }
    this.background.state = 'loading';
    await warmPages(this.background);
    this.background.state = this.background.failed ? 'partial' : 'complete';
  }
}

export const runwayPreload = new RunwayPreload();
Object.defineProperty(window, 'runwayPreloadSnapshot', { get: () => runwayPreload.snapshot() });
document.addEventListener('runway:entered', () => runwayPreload.warm(), { once: true });
document.addEventListener('runway:ready', () => {
  if (!window.RunwayEntry || window.RunwayEntry.state.released) runwayPreload.warm();
}, { once: true });

async function visible() {
  if (!document.hidden) return;
  await new Promise(resolve => {
    const resume = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', resume); resolve(); } };
    document.addEventListener('visibilitychange', resume);
  });
}

async function warmPages(state) {
  const { COLLECTIONS, PRODUCTS } = await import('./data.js');
  const queue = ['/shop', '/product', '/fan-club', '/rewards', '/auction', '/leaderboard', '/loyalty', '/edit-profile', '/account', '/signup', '/checkout',
    ...COLLECTIONS.map(c => c.heroImage), ...PRODUCTS.map(p => p.image), ...['apple.png', 'google.png', 'meta.png', 'line.png', 'ztor.svg'].map(file => `assets/providers/${file}`)];
  const seen = new Set();
  const add = (path, parent = base) => {
    if (!path || path.includes('${') || !/^[\w./?=&%+-]+$/.test(path)) return;
    const url = new URL(path, parent);
    if (url.origin === base.origin && url.pathname.startsWith(base.pathname) &&
        /\.(html|js|css|webp|png|svg|jpg|jpeg|woff2?|ttf)$/.test(url.pathname) && !seen.has(url.href)) queue.push(url.href);
  };
  while (queue.length) {
    await visible();
    const url = new URL(queue.shift(), base).href;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const response = await fetch(url, { cache: 'default', priority: 'low' });
      if (!response.ok) throw Error(String(response.status));
      if (/\.(html|js|css)$/.test(new URL(url).pathname)) {
        const text = await response.text();
        if (new URL(url).pathname.endsWith('.html')) {
          const doc = new DOMParser().parseFromString(text, 'text/html');
          doc.querySelectorAll('script[src],link[rel="stylesheet"][href],img[src]').forEach(el => add(el.getAttribute('src') || el.getAttribute('href'), url));
          doc.querySelectorAll('script[type="importmap"]').forEach(el => Object.values(JSON.parse(el.textContent).imports || {}).forEach(path => add(path, url)));
        }
        for (const match of text.matchAll(/["']([^"'\s]+\.(?:js|css|webp|png|svg|jpg|jpeg|woff2?|ttf)(?:\?[^"'\s]*)?)["']/g)) {
          const path = match[1];
          // JS filenames can be fragments/templates, not actual resource URLs.
          if (new URL(url).pathname.endsWith('.js') && !/^(\.\.?\/|assets\/|css\/)/.test(path)) continue;
          add(path, /^(assets|css)\//.test(path) ? base : url);
        }
        for (const match of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) add(match[1], url);
      } else await response.arrayBuffer();
      state.completed++;
    } catch { state.failed++; }
  }
}
