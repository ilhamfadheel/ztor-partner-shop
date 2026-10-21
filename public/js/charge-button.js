const ENTER = 'Enter the collection';

// Scroll drives the fill; only the 90% label change has a short CSS transition.
export class ChargeButton {
  constructor(link, onNavigate) {
    this.link = link;
    this.onNavigate = onNavigate;
    this.originalHref = link.getAttribute('href');
    this.state = 'rest';
    this.target = null;
    this.progress = 0;
    link.classList.add('charge-button');
    link.innerHTML = '<span class="charge-fill" aria-hidden="true"></span><span class="charge-window" aria-hidden="true"><span class="charge-word charge-enter">Enter the collection</span><span class="charge-word charge-destination"></span></span><span class="charge-icon" aria-hidden="true">↗</span>';
    this.destination = link.querySelector('.charge-destination');
    this.fill = link.querySelector('.charge-fill');
    this.icon = link.querySelector('.charge-icon');
    link.setAttribute('aria-label', ENTER);
    link.addEventListener('click', event => {
      // Capture before the collection-sheet handler: visible navigation copy
      // must navigate, while ordinary Enter retains its existing shop behavior.
      if (this.progress < .9 || !this.target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.onNavigate(this.target);
    }, true);
  }
  update(progress, target, label, active, reduced = false) {
    this.progress = Math.max(0, Math.min(1, progress));
    this.target = target;
    const navigate = this.progress >= .9 && Boolean(target);
    const state = this.progress < .01 ? 'rest' : this.progress >= 1 ? 'full' : navigate ? 'ready' : 'charging';
    const identity = state + ':' + (target || '') + ':' + label;
    this.link.dataset.chargeAnimate = String(active && !reduced);
    if (identity !== this.identity) {
      this.identity = identity;
      this.state = state;
      const text = navigate ? label : ENTER;
      this.link.dataset.chargeState = state;
      this.link.dataset.chargeReady = String(navigate);
      this.link.setAttribute('aria-label', text);
      this.link.setAttribute('href', navigate ? `#${target}` : this.originalHref);
      this.icon.textContent = !navigate ? '↗' : label.startsWith('Previous') ? '↑' : '↓';
      this.destination.textContent = label;
    }
    this.fill.style.transform = `scaleX(${this.progress})`;
    this.link.dataset.charge = this.progress.toFixed(4);
  }
}
