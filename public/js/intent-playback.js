// Scroll is a direction request, not a video playhead. Native video playback
// owns cadence; the document remains free to leave before a walk completes.
import { motionAnchor } from './motion-path.js?v=20260909-slim-face-complete';
const clamp = n => Math.max(0, Math.min(1, n));
export class IntentPlayback {
  constructor(film) {
    this.film = film;
    this.phase = 'waiting';
    this.desired = 0;
    this.started = false;
    this.primary = false;
    this.playPending = false;
    this.playRetries = 0;
    this.retryAt = 0;
    this.alignment = null;
    this.pendingJump = null;
    this.visual = null;
    this.canvas = film.figure.querySelector('canvas');
    this.bridge = document.createElement('canvas');
    this.bridge.className = 'model-bridge';
    this.bridge.setAttribute('aria-hidden', 'true');
    film.figure.append(this.bridge);
  }
  setState(isActive, isPrimary) {
    const f = this.film;
    f.active = isActive;
    this.primary = isPrimary;
    f.mode = this.phase;
    if (isActive) f.load();
  }
  request(direction) {
    if (!direction) return;
    this.desired = Math.sign(direction);
    this.started = true;
    this.film.autoplayBlocked = false;
    this.playRetries = 0;
    this.retryAt = 0;
    this.film.load();
  }
  capture() {
    if (this.film.paintedTime < 0) return;
    this.bridge.width = this.canvas.width;
    this.bridge.height = this.canvas.height;
    this.bridge.getContext('2d').drawImage(this.canvas, 0, 0);
    this.bridge.style.cssText = `transform:${this.canvas.style.transform || 'none'};opacity:1;transition:none`;
  }
  jump(phase, time, fit = true) {
    const f = this.film;
    this.capture();
    this.phase = phase;
    f.mode = phase;
    f.targetTime = time;
    f.video.pause();
    f.playEpoch++;
    f.priming = false;
    this.playPending = false;
    this.pendingJump = { time, fit, from: this.visual && { ...this.visual } };
    this.alignment = null;
    if (Math.abs(f.paintedTime - time) < 1 / 24 && Math.abs(f.video.currentTime - time) < 1 / 24) {
      this.afterDraw();
      return;
    }
    f.video.currentTime = Math.max(.001, time);
    f.revealTime = time;
  }
  tick(canMove) {
    const f = this.film, v = f.video, r = f.definition.ranges;
    if (!canMove) { v.pause(); return; }
    if (this.pendingJump || v.seeking) return;
    // Complete a turn already in motion before honoring an opposite request.
    // Keep only the latest direction, never a queue of scroll ticks.
    const turningAway = this.phase === 'retreat' && v.currentTime < r.retreatTurn?.[1];
    const turningBack = this.phase === 'return';
    if (!turningAway && !turningBack && this.started) {
      if (this.desired < 0 && r.retreat && ['approach', 'idle'].includes(this.phase)) this.jump('retreat', r.retreat[0]);
      else if (this.desired > 0 && ['retreat', 'far'].includes(this.phase)) this.jump('return', r.return[0]);
      // The opening is already back-facing. Play its authored turn before walking in.
      else if (this.desired > 0 && this.phase === 'waiting') this.jump('return', r.return[0], Boolean(f.definition.farStage));
    }
    if (this.pendingJump) return;
    if (this.phase === 'waiting' || this.phase === 'far') { v.pause(); return; }
    const range = r[this.phase];
    if (!range) return;
    if (v.currentTime >= range[1] - 1 / 24) {
      if (this.phase === 'approach') {
        this.phase = 'idle'; f.mode = 'idle'; this.desired = 1;
        // Approach and idle are contiguous. Do not seek between them.
        // Let the last approach frame settle its transform before releasing it.
      } else if (this.phase === 'idle') {
        // An approach-only preview has no authored loop or retreat to play.
        if (f.definition.idleLoop === false) { v.pause(); f.targetTime = v.currentTime; return; }
        // A finite arrival expression plays once; repeat only its living quiet tail.
        this.jump('idle', f.definition.idleLoopStart ?? r.idle[0], false);
      }
      else if (this.phase === 'retreat') this.jump('far', r.return[0], false);
      else if (this.phase === 'return') {
        const next = this.desired < 0 && r.retreat ? 'retreat' : 'approach';
        this.jump(next, r[next][0]);
      }
      if (this.pendingJump || this.phase === 'far') return;
    }
    // Pose dwell is authored in the footage, never simulated by slow-motion playback.
    if (v.playbackRate !== 1) v.playbackRate = 1;
    if (v.paused && !this.playPending && !f.autoplayBlocked && performance.now() >= this.retryAt) {
      const epoch = f.playEpoch;
      const request = v.play();
      this.playPending = request;
      request.then(() => {
        if (epoch === f.playEpoch) { this.playRetries = 0; this.retryAt = 0; }
      }, error => {
        if (epoch !== f.playEpoch) return;
        if (error.name === 'NotAllowedError') {
          f.autoplayBlocked = true;
          // Re-arm the existing touchend/click prime, which calls play inside
          // the gesture handler rather than a later animation frame.
          f.primed = false;
        }
        // A pause/seek can abort an in-flight play without revoking permission.
        // Retry transient interruptions, bounded so a broken source cannot spin.
        else if (error.name === 'AbortError') this.retryAt = ++this.playRetries <= 3 ? performance.now() + 400 * this.playRetries : Infinity;
        else {
          f.failed = true;
          f.figure.classList.remove('has-frame');
        }
      })
        // A gesture/cancellation may invalidate the epoch while this settles.
        // Release this request's lock, never the lock of a newer play request.
        .finally(() => { if (this.playPending === request) this.playPending = false; });
    }
    f.targetTime = v.currentTime;
  }
  afterDraw() {
    const f = this.film, v = f.video, r = f.definition.ranges;
    const time = f.decodedTime >= 0 ? f.decodedTime : v.currentTime;
    const source = motionAnchor(f.key, time);
    if (this.pendingJump) {
      const jump = this.pendingJump;
      if (Math.abs(v.currentTime - jump.time) > .15) return;
      this.pendingJump = null;
      if (jump.fit && jump.from) {
        const to = this.phase === 'return' ? jump.from : this.phase === 'retreat'
          ? f.definition.farStage || motionAnchor(f.key, 0) : f.definition.nearStage || motionAnchor(f.key, r.approach[1]);
        const start = r[this.phase][0];
        this.alignment = { from: jump.from, to, start, end: r[this.phase][1] };
      }
      // Hold during seeking, then replace atomically. A dissolve doubles moving contours.
      this.bridge.style.transition = 'none';
      this.bridge.style.opacity = '0';
    }
    let target = ['waiting', 'far'].includes(this.phase) && f.definition.farStage ? f.definition.farStage : source;
    if (this.phase === 'idle' && f.definition.nearStage) target = f.definition.nearStage;
    if (this.alignment) {
      const { from, to, start, end } = this.alignment;
      const startHeight = motionAnchor(f.key, start).height;
      const endHeight = motionAnchor(f.key, end).height;
      // Retarget the broad authored path, never a live silhouette measurement.
      // Stationary turns retain one destination; natural limb motion survives.
      const t = time <= start ? 0 : time >= end ? 1
        : Math.abs(endHeight-startHeight) > .01
          ? clamp((source.height-startHeight)/(endHeight-startHeight))
          : clamp((time-start)/(end-start));
      target = Object.fromEntries(['cx', 'bottom', 'height'].map(k => [k, from[k] + (to[k] - from[k]) * t]));
      if (this.phase === 'idle' && time >= end) {
        this.alignment = null; target = f.definition.nearStage || source;
      }
    }
    // One uniform camera fit moves the whole person and real shadow together.
    // No anatomy warp or live per-frame silhouette feedback.
    const scale = target.height / source.height;
    this.canvas.style.transform = target === source ? '' : `translate(${(target.cx - source.cx * scale) * 100}%,${(target.bottom - source.bottom * scale) * 100}%) scale(${scale})`;
    this.visual = target;
    const far = f.definition.farStage || motionAnchor(f.key, 0), near = f.definition.nearStage || motionAnchor(f.key, r.approach[1]);
    f.depth = clamp((this.visual.height - far.height) / (near.height - far.height));
  }
  reset(near = false) {
    this.phase = near ? 'idle' : 'waiting';
    this.started = false; this.desired = 0;
    this.playPending = false;
    this.playRetries = 0; this.retryAt = 0;
    this.alignment = null; this.pendingJump = null;
    this.visual = null;
    this.canvas.style.transform = ''; this.bridge.style.opacity = '0';
  }
}
