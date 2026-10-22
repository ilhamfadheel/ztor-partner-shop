import { CubeTransition } from './cube-transition.js';
import { runwayPreload } from './runway-preload.js?v=20260912-native-buffer';
import { t } from './i18n.js';

const gsap = window.gsap;
const MINIMUM = 3000;
const CHAPTER = 2600;
const STORY = CHAPTER * 4 + 200;

export class EntryScreen {
  constructor({ film, room, reduced, prepare, release, warm }) {
    this.film = film;
    this.room = room;
    this.reduced = reduced;
    this.prepare = prepare;
    this.onRelease = release;
    this.warm = warm;
    this.root = document.querySelector('.entry');
    this.face = this.root.querySelector('.entry-face');
    this.button = this.root.querySelector('[data-entry-enter]');
    this.status = this.root.querySelector('[data-entry-status]');
    this.value = this.root.querySelector('[data-entry-value]');
    this.bar = this.root.querySelector('[data-entry-progress]');
    this.fill = this.root.querySelector('.entry-progress-fill');
    this.slides = [...this.root.querySelectorAll('.entry-message')];
    this.boot = window.RunwayEntry;
    this.startedAt = this.boot?.state.startedAt || performance.now();
    this.ready = false;
    this.prepared = false;
    this.exiting = false;
    this.released = false;
    this.outcome = null;
    this.slide = -1;
    this.story = gsap.timeline({ paused: true });
    if (!reduced) {
      this.slides.forEach((slide, i) => {
        // Adapt the supplied TextEffect's character reveal without replacing
        // the authored emphasis, fonts or word boundaries.
        const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
          const fragment = document.createDocumentFragment();
          for (const part of node.textContent.split(/(\s+)/u)) {
            if (!part || /^\s+$/u.test(part)) { fragment.append(part); continue; }
            const word = document.createElement('span');
            word.className = 'entry-word';
            for (const letter of Array.from(part)) {
              const character = document.createElement('span');
              character.className = 'entry-char';
              character.textContent = letter;
              word.append(character);
            }
            fragment.append(word);
          }
          node.replaceWith(fragment);
        }
        const characters = slide.querySelectorAll('.entry-char');
        this.story.fromTo(characters, { opacity: 0, filter: 'blur(6px)', y: 0 },
          { opacity: 1, filter: 'blur(0px)', y: 0, duration: .8, stagger: .024, ease: 'power2.out' }, i * CHAPTER / 1000);
        if (i < this.slides.length - 1) this.story.to(characters,
          { opacity: 0, filter: 'blur(6px)', y: -12, duration: .5, stagger: { amount: .2 }, ease: 'power2.out' }, i * CHAPTER / 1000 + 1.9);
      });
      // Let the existing animation clock run smoothly, independently of the
      // 80ms loading-status poll. This never controls a runway video.
      this.story.play(Math.max(0, (performance.now() - this.startedAt) / 1000));
    }
    gsap.set(this.slides.flatMap(slide => [...slide.querySelectorAll('.entry-line > span')]), { yPercent: 0, opacity: 1 });
    if (reduced) {
      this.root.classList.add('entry-reduced');
    }
    this.boot.state.onRequest = () => this.enter(this.ready ? 'ready' : 'stills');
    this.boot.state.onRelease = reason => this.finish(reason);
    this.prepare().then(() => { this.prepared = true; }).catch(() => { this.prepared = true; });
    this.timer = setInterval(() => this.tick(), 80);
    this.tick();
  }
  tick() {
    if (this.exiting || this.released) return;
    const elapsed = performance.now() - this.startedAt;
    const slide = this.reduced ? 3 : Math.min(3, Math.floor(elapsed / CHAPTER));
    if (this.slide !== slide) {
      this.slide = slide;
      this.root.querySelector('[data-entry-chapter]').textContent = `0${slide + 1} / 04`;
      this.slides.forEach((element, i) => element.setAttribute('aria-hidden', String(i !== slide)));
    }
    const film = this.film;
    // Warm via the historical loader as soon as the first frame is ready. Waiting
    // for both buffers before warming the second movie would deadlock the splash.
    const stillPreview = !film.definition.video;
    const progress = runwayPreload.snapshot(true);
    const openingReady = this.prepared && (this.reduced || stillPreview || film.paintCount > 0);
    if (openingReady && !this.warming) { this.warming = true; this.warm(); }
    this.ready = openingReady && (progress.skipped || stillPreview || progress.startupReady);
    const failed = film.failed || progress.error || progress.files.some(file => file.error);
    const { startupBuffered: buffered, startupDuration: duration } = progress;
    // 100% means entry preparation, not all movie bytes or permanent buffering.
    const ratio = this.ready ? 1 : duration ? Math.min(.99, buffered / duration) : 0;
    this.value.textContent = progress.skipped || stillPreview ? (this.prepared ? t('READY') : '—') : duration ? `${Math.floor(ratio * 100)}%` : '—';
    this.fill.style.transform = `scaleX(${ratio})`;
    this.bar.setAttribute('aria-label', t('First two runway entrances preparation'));
    if (this.ready || duration || this.reduced) this.bar.setAttribute('aria-valuenow', String(Math.floor(ratio * 100)));
    else this.bar.removeAttribute('aria-valuenow');
    const text = this.ready ? (progress.skipped ? t('Your collections are ready · extra preloading skipped') : t('Your runway is ready')) : failed ? t('Could not finish loading. You can continue with stills.') : this.reduced ? t('Preparing the collections') : progress.startupReady ? t('Preparing the first frame, type and images') : elapsed >= 8000 ? t('Still preparing the entrances. You can continue while they load.') : t('Preparing the first two runway entrances');
    if (this.status.textContent !== text) this.status.textContent = text;
    this.status.classList.toggle('entry-sr', this.ready || (!failed && elapsed < 8000));
    const mayEnter = elapsed >= MINIMUM && (this.ready || failed || elapsed >= 8000);
    this.button.hidden = !mayEnter;
    this.button.textContent = this.ready ? t('Enter LLOUD ↗') : t('Continue with stills ↗');
    if (elapsed >= (this.reduced ? MINIMUM : STORY) && this.ready) this.enter('ready');
  }
  enter(outcome) {
    if (this.exiting || this.released || performance.now() - this.startedAt < MINIMUM) return;
    this.exiting = true;
    this.outcome = outcome;
    clearInterval(this.timer);
    this.button.disabled = true;
    this.root.dataset.phase = 'entering';
    this.exitStartedAt = performance.now();
    document.documentElement.classList.add('entry-revealing');
    if (this.reduced) {
      gsap.to(this.root, { opacity: 0, duration: .2, onComplete: () => this.boot.release(outcome) });
      return;
    }
    this.room.inert = true;
    this.cube = new CubeTransition(this.face, this.room, innerWidth);
    this.resize = () => this.cube.resize(innerWidth);
    addEventListener('resize', this.resize);
    this.exitTween = this.cube.play(() => this.boot.release(outcome));
  }
  finish(reason) {
    if (this.released) return;
    this.released = true;
    this.releasedAt = performance.now();
    this.outcome ||= reason;
    clearInterval(this.timer);
    this.story.kill();
    this.exitTween?.kill();
    this.cube?.destroy();
    this.room.inert = false;
    if (this.resize) removeEventListener('resize', this.resize);
    this.onRelease(reason);
    if (this.root.contains(document.activeElement)) document.querySelector('.brand')?.focus({ preventScroll: true });
  }
  snapshot() {
    return { ready: this.ready, prepared: this.prepared, released: this.released, phase: this.released ? 'entered' : this.exiting ? 'entering' : 'loading', outcome: this.outcome, selected: this.film.key, slide: this.slide, startedAt: this.startedAt, exitStartedAt: this.exitStartedAt || null, releasedAt: this.releasedAt || null, progress: runwayPreload.snapshot(true), minimum: MINIMUM };
  }
}
