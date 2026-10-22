import { PackedAlphaRenderer } from './fashion-renderer.js?v=20260910-mobile-recovery';
import { ChargeButton } from './charge-button.js';
import { chapters as spans, travel, stageAt } from './runway-timeline.js?v=20260909-immediate-charge';
import { CubeTransition } from './cube-transition.js';
import { EntryScreen } from './entry-screen.js?v=20260909-native-media';
import { IntentPlayback } from './intent-playback.js?v=20260910-mobile-recovery';
import { CursorLight } from './cursor-light.js';
import { COLLECTIONS, COLLECTION_IDS } from './data.js';

// Scroll Craft is the sole source of scroll progress. This adapter never consumes
// wheel/touch deltas or seek films per scroll tick. Passive input only requests
// a playback direction. Charge and fold are real scroll distances,
// never timed locks, wheel interception, snap points or queued scroll events.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 700px)');
const mobileMedia = matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)');
const showroom = document.querySelector('.showroom');
const room = document.querySelector('.room');
const leaves = [...document.querySelectorAll('.leaf')];
const cursorLight = new CursorLight(room, leaves);
const headerParts = [...document.querySelector('.header').children];
const keys = COLLECTION_IDS;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const palette = COLLECTIONS.map(collection => collection.bg);
const lightWorlds = new Set(['beach', 'silence-is-loud']);
const paused = false;
let sceneCovered = false;
let direction = 1;
let lastProgress = 0;
let lastStamp = performance.now();
let activeIndex = 0;
let currentFrame = 0;
let navJourney = null;
let navSequence = 0;
let lastNavigation = null;
let chargeSide = null;
let foldJourney = null;
let stageSnapshot = null;
const entryParams = new URLSearchParams(location.search);
const requestedEntry = entryParams.get('view') === 'collection' ? entryParams.get('collection') : location.hash.slice(1) || entryParams.get('collection');
const entryKey = keys.includes(requestedEntry) ? requestedEntry : 'rockstar';
let entryLocked = Boolean(window.RunwayEntry && !window.RunwayEntry.state.released);
let entryScreen = null;
let stageCube = null;
let cubeIndex = -1;
let settledFace = -1;
let roomWidth = room.clientWidth || innerWidth;
let warmStarted = false;
let userHasScrolled = false;
const scrollCue = document.querySelector('[data-scroll-cue]');
let cueOrigin = null;
let cueDismissed = false;
addEventListener('resize', () => { roomWidth = room.clientWidth; stageCube?.resize(roomWidth); });
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (width > 0 && width !== roomWidth) { roomWidth = width; stageCube?.resize(width); }
}).observe(room);

class OutfitFilm {
  constructor(leaf, definition) {
    this.leaf = leaf;
    this.definition = definition;
    this.figure = leaf.querySelector('.model');
    this.video = leaf.querySelector('video');
    this.poster = leaf.querySelector('.poster');
    this.key = leaf.dataset.outfit;
    this.renderer = null;
    this.loading = false;
    this.loadPromise = null;
    this.bytesLoaded = 0;
    this.bytesTotal = 0;
    this.ready = false;
    this.initialReadyState = null;
    this.failed = false;
    this.renderLost = false;
    this.primed = false;
    this.priming = false;
    this.mode = 'poster';
    this.targetTime = definition.ranges?.return[0] || 0;
    this.paintedTime = -1;
    this.paintCount = 0;
    this.lastSeek = 0;
    this.active = false;
    this.idlePlaying = false;
    this.navControlled = false;
    this.playEpoch = 0;
    this.revealTime = this.targetTime;
    this.returnArmed = false;
    this.turnaround = null;
    this.autoplayBlocked = false;
    this.seekCount = 0;
    this.decodedFrames = 0;
    this.decodedTime = -1;
    this.lastPaintedDecode = -1;
    this.video.muted = true;
    this.video.playsInline = true;
    this.playback = new IntentPlayback(this);
    this.video.addEventListener('error', () => { this.failed = true; this.figure.classList.remove('has-frame'); });
    this.video.addEventListener('seeked', () => {
      // A paused seek can complete before Safari delivers its next frame callback.
      // Use the completed seek's decoded frame so pendingJump can release playback.
      if (mobileMedia.matches && this.video.readyState >= 2) {
        this.decodedTime = this.video.currentTime;
        this.lastPaintedDecode = -1;
      }
      this.draw();
    });
    this.video.addEventListener('seeking', () => { this.seekCount++; });
    if (this.video.requestVideoFrameCallback) {
      const onFrame = (_, frame) => {
        this.decodedFrames++;
        this.decodedTime = frame.mediaTime;
        this.draw();
        this.video.requestVideoFrameCallback(onFrame);
      };
      this.video.requestVideoFrameCallback(onFrame);
    }
    this.figure.addEventListener('fashion:render-lost', () => {
      this.renderLost = true;
      this.video.pause();
      this.playEpoch++;
      this.priming = false;
      this.playback.playPending = false;
      this.playback.bridge.style.opacity = '0';
      this.figure.classList.remove('has-frame');
    });
    this.figure.addEventListener('fashion:render-restored', () => {
      this.renderLost = false;
      this.lastPaintedDecode = -1;
      this.playback.playRetries = 0;
      this.playback.retryAt = 0;
      if (this.video.readyState >= 2) this.decodedTime = this.video.currentTime;
      this.draw();
    });
    this.figure.addEventListener('fashion:render-error', () => { this.failed = true; this.figure.classList.remove('has-frame'); });
  }
  async load() {
    if (!this.definition.video) return;
    if (this.loading) {
      if (this.active) this.video.preload = 'auto';
      return this.loadPromise;
    }
    if (this.failed || reduce.matches || entryLocked && this.key !== entryKey) return;
    this.loading = true;
    this.loadPromise = this.download();
    return this.loadPromise;
  }
  async download(preload = 'auto') {
    try {
      // Touch phones/tablets keep the smaller raster even when opened landscape.
      const src = mobileMedia.matches && this.definition.mobileVideo ? this.definition.mobileVideo : this.definition.video;
      this.renderer = new PackedAlphaRenderer(this.figure.querySelector('canvas'));
      // Give the browser the original URL so it can request byte ranges around
      // the opening/seek target. A whole-file Blob stranded mobile visitors on
      // the poster until every byte of the full-resolution movie arrived.
      await new Promise(resolve => {
        const initialize = () => {
          // Metadata can arrive before WebKit has a seekable playback item.
          // Keep metadata warming moving, but gate mobile seeks on first data.
          if (this.ready || this.failed || mobileMedia.matches && this.video.readyState < 2) return;
          this.ready = true;
          this.initialReadyState = this.video.readyState;
          this.video.removeEventListener('loadeddata', initialize);
          this.video.removeEventListener('canplay', initialize);
          this.video.currentTime = Math.max(.001, this.targetTime);
          if (!this.navControlled) this.prime();
        };
        const settled = () => {
          this.video.removeEventListener('error', settled);
          this.video.removeEventListener('loadedmetadata', metadata);
          if (this.failed) {
            this.video.removeEventListener('loadeddata', initialize);
            this.video.removeEventListener('canplay', initialize);
          }
          resolve();
        };
        const metadata = () => {
          initialize();
          settled();
        };
        if (mobileMedia.matches) {
          this.video.addEventListener('loadeddata', initialize);
          this.video.addEventListener('canplay', initialize);
        }
        this.video.addEventListener('loadedmetadata', metadata, { once: true });
        this.video.addEventListener('error', settled, { once: true });
        this.video.preload = preload;
        this.video.src = src;
      });
    } catch (error) {
      this.failed = true;
      this.figure.dataset.fallback = 'poster';
      console.warn('Runway film fallback:', this.key, error.message);
    }
  }
  // Adapted from canonical Scroll Craft's prime lifecycle: retry per source,
  // release pending promises, touchend activation, poster until actual draw.
  prime() {
    if (!this.active || this.renderLost || this.navControlled || paused || sceneCovered || this.primed || this.priming || (!this.ready && !(mobileMedia.matches && this.video.readyState >= 1)) || reduce.matches) return;
    this.priming = true;
    const epoch = ++this.playEpoch;
    const timer = setTimeout(() => { this.priming = false; }, 2000);
    const finish = () => {
      clearTimeout(timer);
      if (epoch !== this.playEpoch) return;
      this.priming = false;
      // A fresh gesture may unlock data loading; it must not seek before data.
      if (mobileMedia.matches && this.video.readyState < 2) return;
      this.primed = true;
      this.autoplayBlocked = false;
      this.video.pause();
      this.idlePlaying = false;
      this.video.currentTime = clamp(this.targetTime, .001, this.video.duration - .05);
    };
    const result = this.video.play();
    if (result?.then) result.then(finish, () => { clearTimeout(timer); this.priming = false; });
    else finish();
  }
  resetTurnaround() {
    this.returnArmed = false;
    this.turnaround = null;
    this.playback.reset();
  }
  setState(depth, isActive, isNear, scrollDirection) {
    const primary = this.key === keys[activeIndex];
    const entering = primary && !this.playback.primary;
    this.playback.setState(isActive, primary);
    if (userHasScrolled && primary && isActive && !this.navControlled && (entering || !this.playback.started)) {
      this.playback.request(scrollDirection);
    }
  }
  draw() {
    if (!this.active || !this.ready || this.failed || this.renderLost || this.video.seeking || this.video.readyState < 2) return;
    if (this.video.requestVideoFrameCallback && Math.abs(this.decodedTime - this.video.currentTime) > .15) return;
    if (this.revealTime !== null) {
      if (Math.abs(this.video.currentTime - this.revealTime) > .13) return;
      this.revealTime = null;
    }
    const frameTime = this.video.requestVideoFrameCallback ? this.decodedTime : this.video.currentTime;
    if (Math.abs(this.lastPaintedDecode - frameTime) < 1 / 50) return;
    if (this.renderer.draw(this.video)) {
      this.playback.afterDraw();
      this.lastPaintedDecode = frameTime;
      this.paintedTime = frameTime;
      this.paintCount++;
      this.figure.classList.add('has-frame');
    }
  }
  tick(now, delta) {
    if (!this.ready || this.failed || this.renderLost || this.priming) return;
    // Paint the last completed decode before asking for another seek. Otherwise
    // continuous input can keep seeking=true and starve the visible canvas.
    this.draw();
    // Scroll and navigation share the same turn/approach sequencer. Navigation
    // owns only scroll positioning; it cannot bypass the back-facing opening.
    const canMove = this.active && !paused && !sceneCovered && !entryLocked && !reduce.matches && !document.hidden
      && (!this.navControlled || navJourney?.phase === 'walking');
    this.playback.tick(canMove);
    this.draw();
  }
  snapshot() {
    return { key: this.key, mode: this.mode, active: this.active, depth: this.depth, targetTime: this.targetTime, mediaTime: this.video.currentTime, paintedTime: this.paintedTime, paintCount: this.paintCount, decodedFrames: this.decodedFrames, decodedTime: this.decodedTime, seekCount: this.seekCount, ready: this.ready, failed: this.failed, bytesLoaded: this.bytesLoaded, bytesTotal: this.bytesTotal, paused: this.video.paused,
      initialReadyState: this.initialReadyState, priming: this.priming, primed: this.primed, autoplayBlocked: this.autoplayBlocked, renderLost: Boolean(this.renderLost), navControlled: this.navControlled, revealTime: this.revealTime,
      intent: { direction: this.playback.desired, phase: this.playback.phase, started: this.playback.started, primary: this.playback.primary,
        pending: Boolean(this.playback.pendingJump), pendingTime: this.playback.pendingJump?.time ?? null,
        playPending: Boolean(this.playback.playPending), retries: this.playback.playRetries,
        retryAt: Number.isFinite(this.playback.retryAt) ? this.playback.retryAt : 'blocked', visual: this.playback.visual } };
  }
}

const manifest = await fetch('assets/fashion/manifest.json', { cache: 'no-cache' }).then(response => response.json());
const films = leaves.map(leaf => new OutfitFilm(leaf, manifest.outfits[leaf.dataset.outfit]));
const buttons = leaves.map(leaf => new ChargeButton(leaf.querySelector('.shop-link'), target => {
  if (target === 'lineup') document.querySelector('.lineup').scrollIntoView({ behavior: 'smooth' });
  else beginNavigation(target);
}));
showroom.dataset.scSpan = String(travel + 1);
const scrollStage = ScrollCraft.mount(document.body);

function paintStage(progress) {
  const distance = progress * travel;
  const direct = navJourney?.phase === 'positioning' ? navJourney : null;
  let { index, chapter, depth, fold, previous, next } = stageAt(distance);
  let incomingIndex = index + 1;
  if (direct) {
    index = direct.reverse ? direct.index : direct.fromIndex;
    incomingIndex = direct.reverse ? direct.fromIndex : direct.index;
    depth = direct.reverse ? 0 : direct.fromDepth;
    fold = direct.reverse ? 1 - direct.progress : direct.progress;
    previous = next = 0;
  }
  const folding = direct ? index !== incomingIndex : fold > 0 && incomingIndex < keys.length;
  const flip = fold;
  const isNear = depth >= .999;
  // Remember which endpoint began a fold. Reversing at 40% must undo that same
  // fold, not swap the source button or fire an automatic transition.
  if (!direct && folding) {
    if (foldJourney?.boundary !== index) foldJourney = { boundary: index, source: direction > 0 ? index : index + 1 };
  } else foldJourney = null;
  if (next > 0) chargeSide = { index, side: 'next' };
  else if (previous > 0 && (direction < 0 || chargeSide?.index === index && chargeSide.side === 'previous')) chargeSide = { index, side: 'previous' };
  else chargeSide = null;
  const chargeIndex = foldJourney ? foldJourney.source : chargeSide?.index;
  const side = foldJourney ? (foldJourney.source === index ? 'next' : 'previous') : chargeSide?.side;
  const charge = foldJourney ? 1 : side === 'previous' ? previous : side === 'next' ? next : 0;
  const visibleIndex = folding && flip > .52 ? incomingIndex : index;
  activeIndex = visibleIndex;
  const cueCaption = scrollCue.querySelector('.scroll-cue-copy > span');
  const cueFilm = films[visibleIndex];
  const cueText = cueFilm.definition.video && !cueFilm.failed && cueFilm.mode === 'waiting' ? 'to start the runway' : 'to explore the collections';
  if (cueCaption.textContent !== cueText) cueCaption.textContent = cueText;
  if (!sceneCovered) document.documentElement.dataset.collection = keys[visibleIndex];
  const light = lightWorlds.has(keys[visibleIndex]);
  const stageBottom = showroom.getBoundingClientRect().bottom;
  const below = stageBottom <= 0;
  document.querySelector('.header').classList.toggle('is-mobile-lineup', mobile.matches && below);
  // Chrome follows the surface beneath the header, not the portion entering at
  // the bottom. Keep white navigation while the dark leaf is behind it.
  const chromeLight = stageBottom < 60 || light && !folding;
  document.body.dataset.tone = chromeLight ? 'light' : 'dark';
  document.documentElement.style.setProperty('--ink', chromeLight ? (below ? '#171717' : COLLECTIONS[visibleIndex].fg) : '#fff');
  document.documentElement.style.setProperty('--surface', below ? '#f4f2ee' : palette[visibleIndex]);
  document.querySelectorAll('.collection-index [data-jump]').forEach(link => {
    if (link.dataset.jump === keys[visibleIndex]) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  const signatures = [];
  if (folding) {
    const cubeKey = direct ? `nav:${direct.id}` : index;
    if (cubeIndex !== cubeKey) {
      stageCube?.destroy();
      stageCube = new CubeTransition(leaves[index], leaves[incomingIndex], roomWidth, { reverse: direct ? direct.reverse : foldJourney.source === incomingIndex });
      cubeIndex = cubeKey;
    }
    stageCube.seek(flip);
  } else if (stageCube) {
    stageCube.destroy();
    stageCube = null;
    cubeIndex = -1;
    settledFace = -1;
  }
  const roomBounds = stageCube ? room.getBoundingClientRect() : null;
  headerParts.forEach(part => {
    if (!stageCube) { delete part.dataset.cubeInk; return; }
    const bounds = part.getBoundingClientRect();
    const face = stageCube.faceAt(bounds.x + bounds.width / 2 - roomBounds.x, bounds.y + bounds.height / 2 - roomBounds.y);
    part.dataset.cubeInk = lightWorlds.has(face?.dataset.outfit) ? 'dark' : 'light';
  });
  leaves.forEach((leaf, i) => {
    const outgoing = i === index;
    const incoming = i === incomingIndex && folding;
    const onScreen = outgoing || incoming;
    leaf.style.display = onScreen ? 'block' : 'none';
    leaf.inert = i !== visibleIndex;
    leaf.setAttribute('aria-hidden', i === visibleIndex ? 'false' : 'true');
    if (!stageCube && outgoing && settledFace !== i) {
      window.gsap.set(leaf, { x: 0, xPercent: 0, z: 0, rotationY: 0, scale: 1, transformPerspective: 0, transformOrigin: '50% 50%' });
      settledFace = i;
    }
    leaf.style.zIndex = outgoing ? '2' : '1';
    // A separate back plane recedes as the person arrives. The source model and
    // source shadow keep their ratio; no CSS scaling of legs, face, or body.
    const localDepth = direct ? (i === direct.fromIndex ? direct.fromDepth : 0) : outgoing ? depth : 0;
    leaf.querySelector('.back-plane').style.transform = `translateY(${(-localDepth * 18).toFixed(2)}px) scale(${(1 + localDepth * .045).toFixed(4)})`;
    leaf.querySelector('.floor-plane').style.opacity = (.35 + localDepth * .65).toFixed(3);
    films[i].setState(localDepth, onScreen && !below, outgoing && isNear, direction);
    const ownsCharge = i === chargeIndex && !navJourney;
    const targetIndex = i + (side === 'previous' ? -1 : 1);
    const target = targetIndex >= keys.length ? 'lineup' : keys[targetIndex];
    const label = target === 'lineup' ? 'View all collections' : side === 'previous' ? 'Previous collection' : 'Next collection';
    buttons[i].update(ownsCharge ? charge : 0, ownsCharge ? target : null, label, onScreen && !below && !sceneCovered && !entryLocked && !document.hidden, reduce.matches);
    if (onScreen) signatures.push(`${i}:${flip.toFixed(3)}:${localDepth.toFixed(2)}:${films[i].paintedTime.toFixed(2)}`);
  });
  // Only warm the immediate incoming film, and only near its reveal.
  if (!direct && !entryLocked && index < keys.length - 1 && distance > chapter.chargeStart) films[index + 1].load();
  room.dataset.scVerifyState = signatures.join('|');
  room.dataset.scVerifyHold = String(isNear && !flip);
  room.dataset.collection = keys[visibleIndex];
  room.dataset.phase = folding ? 'fold' : charge > 0 ? 'charge' : isNear ? 'near' : direction < 0 ? 'retreat' : 'approach';
  room.dataset.flip = flip.toFixed(3);
  room.dataset.depth = depth.toFixed(3);
  stageSnapshot = { distance, index, depth, fold, charge, side, chargeIndex, phase: room.dataset.phase };
}

function scrollTopFor(distance) {
  const bounds = showroom.getBoundingClientRect();
  return scrollY + bounds.top + (bounds.height - innerHeight) * distance / travel;
}

function positionStage(distance) {
  scrollTo({ top: scrollTopFor(distance), behavior: 'instant' });
  // Commit the destination before the next paint; a deferred scroll event can
  // otherwise reveal a stale, intermediate face for one frame.
  scrollStage.read();
  paintStage(parseFloat(showroom.style.getPropertyValue('--sc-p')) || 0);
}

function showPoster(film, near) {
  film.poster.src = near ? film.definition.nearPoster : film.definition.poster;
  film.figure.classList.remove('has-frame');
  film.revealTime = (near ? film.definition.ranges?.idle[0] : film.definition.ranges?.return[0]) || 0;
  film.paintedTime = -1;
  film.lastPaintedDecode = -1;
}

function cancelNavigation(reason) {
  // User input also releases a completed fallback's poster guard. ScrollCraft's
  // previous frame can lag an explicit scrollTo, so do this at the input boundary
  // rather than inferring a new intention from one stale progress frame.
  films.forEach(film => { film.revealTime = null; });
  if (!navJourney) return;
  const journey = navJourney;
  navJourney = null;
  journey.positioning.kill();
  journey.film.navControlled = false;
  journey.film.playEpoch++;
  journey.film.video.pause();
  journey.film.idlePlaying = false;
  // Release scroll positioning without consuming the new input.
  if (journey.phase === 'positioning') {
    const index = activeIndex === journey.index ? journey.index : journey.fromIndex;
    const depth = index === journey.fromIndex ? journey.fromDepth : 0;
    positionStage(spans[index].walkStart + Math.max(.002, spans[index].approach * depth));
  } else scrollTo({ top: scrollY, behavior: 'instant' });
  lastNavigation = { id: journey.id, key: journey.key, result: reason };
}

function jumpTo(key, animate = false, opening = false) {
  const index = keys.indexOf(key);
  if (index < 0) return;
  cancelNavigation('replaced');
  films[index].resetTurnaround();
  films[index].playback.reset(!opening);
  films[index].playback.started = !opening;
  films[index].playback.desired = opening ? 0 : 1;
  films[index].targetTime = (opening ? films[index].definition.ranges?.return[0] : films[index].definition.ranges?.idle[0]) || 0;
  showPoster(films[index], !opening);
  if (films[index].ready) films[index].video.currentTime = films[index].targetTime;
  const url = new URL(location.href);
  url.hash = key;
  if (url.searchParams.has('collection')) url.searchParams.set('collection', key);
  history.replaceState(history.state, '', url);
  if (reduce.matches) {
    document.querySelector(`.look-${key}`).scrollIntoView({ behavior: 'instant', block: 'center' });
    lastNavigation = { key, result: 'reduced-static' };
    return;
  }
  const distance = opening ? spans[index].walkStart : spans[index].nearStart + spans[index].near * .35;
  const top = scrollTopFor(distance);
  direction = 1;
  if (paused) showPoster(films[index], true);
  scrollTo({ top, behavior: animate ? 'smooth' : 'instant' });
}

function finishNavigation(reason = 'completed') {
  if (!navJourney) return;
  const journey = navJourney;
  const film = journey.film;
  navJourney = null;
  journey.positioning.kill();
  film.navControlled = false;
  film.mode = 'idle';
  film.playback.phase = 'idle';
  film.playback.started = true;
  film.playback.desired = 1;
  film.depth = 1;
  film.targetTime = film.definition.ranges?.idle[0] || 0;
  film.idlePlaying = reason === 'completed' && !film.video.paused;
  if (reason !== 'completed') {
    film.video.pause();
    film.autoplayBlocked = true;
    film.playEpoch++;
    film.playback.reset();
    film.targetTime = film.definition.ranges?.return[0] || 0;
    showPoster(film, false);
  }
  const chapter = spans[journey.index];
  scrollTo({ top: scrollTopFor(reason === 'completed' ? chapter.nearStart + chapter.near * .35 : chapter.walkStart), behavior: 'instant' });
  direction = 1;
  lastNavigation = { id: journey.id, key: journey.key, result: reason };
}

function beginNavigation(key) {
  const index = keys.indexOf(key);
  if (index < 0) return;
  if (paused || reduce.matches) {
    jumpTo(key);
    if (!reduce.matches) lastNavigation = { key, result: 'paused-static' };
    return;
  }
  cancelNavigation('replaced');
  const fromIndex = activeIndex;
  const fromDepth = stageSnapshot?.index === fromIndex ? stageSnapshot.depth : 0;
  const film = films[index];
  film.resetTurnaround();
  film.playEpoch++;
  film.priming = false;
  film.navControlled = true;
  film.autoplayBlocked = false;
  film.video.pause();
  film.idlePlaying = false;
  film.targetTime = film.definition.ranges?.return[0] || 0;
  showPoster(film, false);
  const now = performance.now();
  navJourney = { id: ++navSequence, key, index, film, fromIndex, fromDepth, reverse: index < fromIndex, progress: 0, phase: 'positioning', startedAt: now, lastAdvance: now, lastMediaTime: film.targetTime, seekPrepared: false };
  film.load();
  const url = new URL(location.href);
  url.hash = key;
  if (url.searchParams.has('collection')) url.searchParams.set('collection', key);
  history.replaceState(history.state, '', url);
  direction = navJourney.reverse ? -1 : 1;
  // Explicit navigation folds the two selected live pages once. Native scroll
  // keeps its sequential timeline; we relocate it only when this fold lands.
  navJourney.positioning = window.gsap.to(navJourney, { progress: 1,
    duration: fromIndex === index ? 0 : 1.25, ease: 'power2.inOut' });
}

function updateNavigation(now) {
  const journey = navJourney;
  if (!journey) return;
  const film = journey.film;
  if (document.hidden) { cancelNavigation('hidden'); return; }
  if (journey.phase !== 'walking' && now - journey.startedAt > 10000) {
    finishNavigation('loading-timeout');
    return;
  }
  if (journey.phase === 'positioning') {
    if (journey.positioning.progress() < 1) return;
    journey.phase = 'preparing';
    positionStage(spans[journey.index].walkStart + .002);
  }
  if (!film.definition.video) { finishNavigation('collection-preview'); return; }
  if (film.failed) { finishNavigation('media-fallback'); return; }
  if (journey.phase === 'preparing') {
    if (!film.ready) return;
    if (!journey.seekPrepared) {
      film.video.currentTime = film.definition.ranges.return[0];
      journey.seekPrepared = true;
      return;
    }
    if (film.video.seeking || film.video.readyState < 2) return;
    journey.phase = 'walking';
    film.primed = true;
    film.playback.request(1);
    journey.lastAdvance = now;
  }
  if (journey.phase !== 'walking') return;
  const [start, end] = film.definition.ranges.approach;
  const mediaTime = film.video.currentTime;
  if (film.autoplayBlocked) { finishNavigation('play-fallback'); return; }
  if (Math.abs(mediaTime - journey.lastMediaTime) > .01) {
    journey.lastMediaTime = mediaTime;
    journey.lastAdvance = now;
  } else if (now - journey.lastAdvance > 3000) {
    finishNavigation('stalled-fallback');
    return;
  }
  if (film.playback.phase === 'return' || film.playback.phase === 'waiting' || film.playback.pendingJump) return;
  if (film.playback.phase === 'idle') { finishNavigation(); return; }
  const depth = clamp((mediaTime - start) / (end - start));
  const chapter = spans[journey.index];
  scrollTo({ top: scrollTopFor(chapter.walkStart + Math.max(.002, chapter.approach * depth)), behavior: 'instant' });
  direction = 1;
}

document.querySelectorAll('[data-jump]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  // Collection activation has the same journey for pointer and keyboard users.
  // Reduced motion and pause still resolve immediately to the static near pose.
  if (link.closest('.collection-index')) beginNavigation(link.dataset.jump);
  else jumpTo(link.dataset.jump, event.detail > 0 && !paused);
}));
function requestWalk(delta) {
  if (entryLocked || sceneCovered || reduce.matches || Math.abs(delta) < 3) return;
  userHasScrolled = true;
  if (delta > 0) cueDismissed = true;
  const sign = Math.sign(delta);
  direction = sign;
  films[activeIndex].playback.request(sign);
}
addEventListener('wheel', event => { cancelNavigation('wheel'); requestWalk(event.deltaY); }, { passive: true });
addEventListener('touchstart', () => cancelNavigation('touch'), { passive: true });
let touchY = null;
let touchX = null;
addEventListener('touchstart', event => {
  touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
  touchX = event.touches.length === 1 ? event.touches[0].clientX : null;
}, { passive: true });
addEventListener('touchmove', event => {
  if (event.touches.length !== 1) { touchY = touchX = null; return; }
  const { clientY: y, clientX: x } = event.touches[0];
  const threshold = mobile.matches ? 12 : 4;
  if (touchY !== null && Math.abs(touchY - y) >= threshold && Math.abs(touchY - y) > Math.abs(touchX - x)) {
    requestWalk(touchY - y); touchY = y; touchX = x;
  }
}, { passive: true });
['touchend', 'touchcancel'].forEach(type => addEventListener(type, () => { touchY = touchX = null; }, { passive: true }));
addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)
      || event.key === ' ' && !event.target.closest('button,a,summary')) {
    cancelNavigation('keyboard-scroll');
    requestWalk(['ArrowUp', 'PageUp', 'Home'].includes(event.key) || event.shiftKey && event.key === ' ' ? -10 : 10);
  } else if (['Enter', ' '].includes(event.key) && event.target.closest('a,button,summary')
      && !event.target.closest('.collection-index')) cancelNavigation('interaction');
});
addEventListener('pointerdown', event => {
  if (!event.target.closest('.collection-index')) cancelNavigation('interaction');
}, { passive: true });
['pointerdown', 'touchend', 'click'].forEach(type => addEventListener(type, () => films.forEach(film => film.prime()), { passive: true }));
reduce.addEventListener('change', () => location.reload());

document.addEventListener('runway:select', event => {
  const key = event.detail?.key;
  if (keys.includes(key)) jumpTo(key);
});
function syncOverlays() {
  sceneCovered = document.body.classList.contains('panel-open') || document.body.classList.contains('cart-open');
  if (sceneCovered) cancelNavigation('overlay');
}
['panel:open','panel:close','drawer:open','drawer:close'].forEach(type => document.addEventListener(type, syncOverlays));

function loop(now) {
  const delta = Math.min(50, now - lastStamp);
  lastStamp = now;
  updateNavigation(now);
  if (!entryLocked && !sceneCovered && !reduce.matches) {
    // Initial/deep-link positioning is not proof the visitor discovered scrolling.
    // Keep the instruction until deliberate input moves the runway meaningfully.
    if (!userHasScrolled || navJourney) cueOrigin = scrollY;
    else {
      cueOrigin ??= scrollY;
      if (Math.abs(scrollY - cueOrigin) > 96) cueDismissed = true;
    }
  }
  scrollCue.dataset.visible = String(!entryLocked && !sceneCovered && !navJourney && !cueDismissed && !reduce.matches);
  cursorLight.setEnabled(!entryLocked && !sceneCovered && !document.hidden && showroom.getBoundingClientRect().bottom > innerHeight);
  const progress = parseFloat(showroom.style.getPropertyValue('--sc-p')) || 0;
  if (Math.abs(progress - lastProgress) > .00008) {
    direction = progress > lastProgress ? 1 : -1;
  }
  if (!reduce.matches) paintStage(progress);
  films.forEach(film => film.tick(now, delta));
  lastProgress = progress;
  currentFrame++;
  requestAnimationFrame(loop);
}
// Read-only diagnostics, not animation controls. Values include successful GPU
// draws, not just requested target times, for independent QA.
Object.defineProperty(window, 'runwaySnapshot', { get: () => Object.freeze({ active: keys[activeIndex], direction, paused, entryLocked, sceneCovered, reduced: reduce.matches, frames: currentFrame, entry: entryScreen?.snapshot() || null, timeline: { chapters: spans, travel }, stage: stageSnapshot, navigation: navJourney ? { id: navJourney.id, key: navJourney.key, phase: navJourney.phase } : null, lastNavigation, films: films.map(film => film.snapshot()) }) });
if (new URLSearchParams(location.search).get('runway-debug') === '1') import('./runway-diagnostics.js?v=20260912-first-data-gate');
requestAnimationFrame(loop);
if (reduce.matches) {
  document.body.dataset.tone = 'light';
  document.documentElement.style.setProperty('--ink', '#14343f');
  document.documentElement.style.setProperty('--surface', '#f4f2ee');
  leaves.forEach(leaf => { leaf.inert = true; });
}
requestAnimationFrame(() => {
  if (keys.includes(requestedEntry)) jumpTo(entryKey, false, true);
  if (!window.RunwayEntry || window.RunwayEntry.state.released) {
    entryLocked = false;
    document.dispatchEvent(new Event('runway:ready'));
    warmAdjacent(); // Same native metadata loader for direct-entry visits.
    return;
  }
  const film = films[keys.indexOf(entryKey)];
  entryScreen = new EntryScreen({
    film, room, reduced: reduce.matches,
    prepare: async () => {
      const displayFont = { rockstar: '400 32px "Bebas Neue"', beach: 'italic 400 32px "Instrument Serif"', paddock: '400 32px Michroma' }[entryKey] || '400 32px Georgia';
      // Offscreen lazy lineup images load later; waiting here can deadlock entry.
      const assets = [film.poster.decode().catch(() => {})];
      assets.push(document.fonts.load('500 32px "Geist Splash"'), document.fonts.load('300 32px Satoshi'), document.fonts.load('italic 400 32px "Instrument Serif"'), document.fonts.load(displayFont));
      film.load();
      await Promise.allSettled(assets);
    },
    release: () => {
      entryLocked = false;
      document.dispatchEvent(new Event('runway:ready'));
      warmAdjacent();
    },
    warm: () => warmAdjacent(),
  });
});

async function warmAdjacent() {
  if (warmStarted || reduce.matches || navigator.connection?.saveData) return;
  warmStarted = true;
  // Prepare background metadata without competing full-movie downloads.
  // Visible films promote their preload through load(); interaction stays locked.
  const selected = keys.indexOf(entryKey);
  await films[selected].loadPromise;
  for (const index of [selected + 1, selected - 1, ...keys.map((_, i) => i)].filter((v, i, all) => v >= 0 && v < keys.length && v !== selected && all.indexOf(v) === i)) {
    const film = films[index];
    if (!film.definition.video) continue;
    if (!film.loading && !film.failed) {
      film.loading = true;
      film.loadPromise = film.download('metadata');
    }
    await film.loadPromise;
  }
}
