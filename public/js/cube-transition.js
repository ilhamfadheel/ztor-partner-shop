// One camera, one rigid body, six opaque faces. Flatten live pages into their
// face so no separately composited text/canvas can paint from the back.
const gsap = window.gsap;

export class CubeTransition {
  constructor(outgoing, incoming, width, { reverse = false } = {}) {
    this.faces = [outgoing, incoming];
    this.reverse = reverse;
    this.host = outgoing.parentElement === incoming.parentElement
      ? outgoing.parentElement : outgoing.closest('.entry');
    this.scene = document.createElement('div');
    this.scene.className = 'cube-scene';
    this.rotor = document.createElement('div');
    this.rotor.className = 'cube-rotor';
    this.scene.append(this.rotor);
    this.host.append(this.scene);
    this.slots = this.faces.map((face, i) => {
      const marker = document.createComment('cube-page-position');
      face.before(marker);
      const panel = document.createElement('div');
      panel.className = 'cube-face';
      panel.dataset.cubeFace = String(i);
      panel.style.background = getComputedStyle(face).backgroundColor;
      this.rotor.append(panel);
      panel.append(face);
      return { marker, panel };
    });
    this.shell = ['back', 'left', 'top', 'bottom'].map(side => {
      const panel = document.createElement('div');
      panel.className = 'cube-face cube-shell';
      panel.dataset.cubeFace = side;
      panel.setAttribute('aria-hidden', 'true');
      this.rotor.append(panel);
      return panel;
    });
    this.state = { progress: 0 };
    this.size = { scale: 1 };
    // Only scale rebounds, never the angle. The paused score is reversible and
    // never runs a wall-clock bounce after the visitor has stopped scrolling.
    this.sizeScore = gsap.timeline({ paused: true })
      .to(this.size, { scale: .88, duration: .2, ease: 'sine.inOut' })
      .to(this.size, { scale: .88, duration: .42, ease: 'none' })
      .to(this.size, { scale: 1.012, duration: .25, ease: 'power2.out' })
      .to(this.size, { scale: .997, duration: .08, ease: 'sine.inOut' })
      .to(this.size, { scale: 1, duration: .05, ease: 'sine.out' });
    this.timeline = gsap.timeline({ paused: true }).to(this.state, {
      progress: 1, duration: 1, ease: 'none', onUpdate: () => this.paint(),
    });
    this.resize(width);
  }
  resize(width) {
    this.width = width;
    const r = width / 2, height = this.host.clientHeight;
    this.scene.style.perspective = `${width * 2.2}px`;
    this.slots.forEach(({ panel }, i) => { panel.style.transform = `rotateY(${i * 90}deg) translateZ(${r}px)`; });
    this.shell.forEach((panel, i) => {
      if (i < 2) panel.style.transform = `rotateY(${i ? -90 : 180}deg) translateZ(${r}px)`;
      else {
        panel.style.height = `${width}px`;
        panel.style.top = `${(height - width) / 2}px`;
        panel.style.transform = `rotateX(${i === 2 ? 90 : -90}deg) translateZ(${height / 2}px)`;
      }
    });
    this.paint();
  }
  paint() {
    const p = this.state.progress;
    this.sizeScore.progress(this.reverse ? 1 - p : p);
    const scale = this.size.scale, r = this.width / 2;
    const theta = p * Math.PI / 2;
    const pullback = r * (Math.sin(theta) + Math.cos(theta) - 1 + .48 * Math.sin(Math.PI * p));
    const z = -r * scale - pullback;
    this.rotor.style.transform = `translateZ(${z}px) scale3d(${scale},${scale},${scale}) rotateY(${-90 * p}deg)`;
    this.scene.dataset.progress = p.toFixed(4);
    this.scene.dataset.scale = scale.toFixed(4);
    this.slots.forEach(({ panel }, i) => {
      // Under perspective a face points away from the camera BEFORE 90deg.
      // Explicit culling also protects Safari's composited media descendants.
      const normalZ = i ? Math.sin(theta) : Math.cos(theta);
      const facing = normalZ * (this.width * 2.2 - z) - r * scale > 0;
      panel.style.visibility = facing ? 'visible' : 'hidden';
      panel.dataset.facing = String(facing);
      this.faces[i].style.setProperty('--cube-shade', String((i ? 1 - p : p) * .26));
    });
  }
  seek(progress) { this.timeline.progress(progress); }
  faceAt(x, y) {
    // Project the real panel corners into the shared camera, so fixed chrome
    // samples its own backdrop instead of borrowing the active collection tone.
    const p = this.state.progress, angle = p * Math.PI / 2;
    const s = this.size.scale, r = this.width / 2, h = this.host.clientHeight / 2;
    const camera = this.width * 2.2;
    const z = -r * s - r * (Math.sin(angle) + Math.cos(angle) - 1 + .48 * Math.sin(Math.PI * p));
    for (const [i, { panel }] of this.slots.entries()) {
      if (panel.dataset.facing !== 'true') continue;
      const corners = [[-r, -h], [r, -h], [r, h], [-r, h]].map(([u, v]) => {
        const fx = i ? r : u, fz = i ? -u : r;
        const px = (Math.cos(angle) * fx - Math.sin(angle) * fz) * s;
        const pz = (Math.sin(angle) * fx + Math.cos(angle) * fz) * s + z;
        const k = camera / (camera - pz);
        return [r + px * k, h + v * s * k];
      });
      const sides = corners.map(([ax, ay], n) => {
        const [bx, by] = corners[(n + 1) % 4];
        return (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      });
      if (sides.every(value => value >= 0) || sides.every(value => value <= 0)) return this.faces[i];
    }
    return null;
  }
  play(onComplete) {
    return this.timeline.tweenTo(1, { duration: 1.25, ease: 'power2.inOut', onComplete });
  }
  destroy() {
    this.timeline.kill();
    this.sizeScore.kill();
    this.faces.forEach((face, i) => {
      this.slots[i].marker.replaceWith(face);
      face.style.removeProperty('--cube-shade');
    });
    this.scene.remove();
  }
}
