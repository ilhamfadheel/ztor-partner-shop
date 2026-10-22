// Adapted from site/js/light.js: a following key light and opposing fill.
// Keep the lights inside each opaque cube face, behind the subject and type.
export class CursorLight {
  constructor(root, leaves) {
    this.root = root;
    this.fine = matchMedia('(hover: hover) and (pointer: fine)');
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.layers = leaves.map(leaf => {
      const key = document.createElement('div'), fill = document.createElement('div');
      key.className = 'cursor-key'; fill.className = 'cursor-fill';
      leaf.querySelector('.leaf-ground').append(key, fill);
      return { key, fill };
    });
    this.x = this.y = this.tx = this.ty = 0;
    this.frame = 0; this.stamp = 0; this.inside = false; this.enabled = false;
    this.move = event => {
      if (!this.enabled || event.pointerType !== 'mouse') return;
      const rect = root.getBoundingClientRect();
      this.tx = event.clientX - rect.left - rect.width * .62;
      this.ty = event.clientY - rect.top - rect.height * .38;
      this.inside = true;
      root.dataset.cursorLight = 'true';
      this.wake();
    };
    this.leave = () => {
      this.inside = false; this.tx = this.ty = 0;
      root.dataset.cursorLight = 'false';
      this.wake();
    };
    root.addEventListener('pointermove', this.move, { passive: true });
    root.addEventListener('pointerleave', this.leave, { passive: true });
  }
  setEnabled(value) {
    const enabled = value && this.fine.matches && !this.reduced.matches;
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.inside = false; this.x = this.y = this.tx = this.ty = 0;
      this.root.dataset.cursorLight = 'false';
      cancelAnimationFrame(this.frame); this.frame = 0;
      this.paint();
    }
  }
  paint() {
    for (const { key, fill } of this.layers) {
      key.style.transform = `translate3d(${this.x.toFixed(2)}px,${this.y.toFixed(2)}px,0)`;
      fill.style.transform = `translate3d(${(-this.x * .25).toFixed(2)}px,${(-this.y * .25).toFixed(2)}px,0)`;
    }
  }
  wake() {
    if (!this.enabled || this.frame) return;
    this.stamp = performance.now();
    const tick = now => {
      const follow = 1 - Math.pow(.92, Math.min(50, now - this.stamp) / (1000 / 60));
      this.stamp = now;
      this.x += (this.tx - this.x) * follow;
      this.y += (this.ty - this.y) * follow;
      this.paint();
      const settled = Math.abs(this.tx - this.x) < .2 && Math.abs(this.ty - this.y) < .2;
      this.frame = settled ? 0 : requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  destroy() {
    this.setEnabled(false);
    this.root.removeEventListener('pointermove', this.move);
    this.root.removeEventListener('pointerleave', this.leave);
    this.layers.forEach(({ key, fill }) => { key.remove(); fill.remove(); });
  }
}
