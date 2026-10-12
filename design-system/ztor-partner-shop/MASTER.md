# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Ztor partner shop
**Generated:** 2026-10-08 16:45:28
**Category:** E-commerce
**Design Dials:** Variance 2/10 (Centered / Minimal) | Motion 2/10 (Subtle)

---

## Global Rules

### Style source (2026-10-12)

The fan-club look of **lloud.club** (`/fan-club`, `/edit-profile`), measured from its live CSS: warm paper, ink,
hairlines, square corners, light display type with tight tracking, small tracked capitals. The header is
lloud's: the shop mark + FAN CLUB on the left, sections centred (their own row on phones), account and bag
on the right. `app/globals.css` `:root` is the source of truth; this table mirrors it.

### Color Palette

| Role | Hex | CSS Variable | lloud source |
|------|-----|--------------|--------------|
| Background (paper) | `#F3F1EC` | `--color-background`, `--color-card` | lloud's body as rendered (`--l-bg` is `#F4F2EE`) |
| Surface | `#FFFFFF` | `--color-surface` | `--l-surface` |
| Muted (hover) | `#E9E6E0` | `--color-muted` | `--l-bg-2` |
| Selected list item | `#E8E5DE` | `--color-selected` | account nav |
| Hairline | `#D8D5CE` | `--color-border` | header/list borders |
| Control boundary | `#8A8681` | `--color-border-control` | `--l-ink-3` (lloud's `#C8C5BD` is 1.5:1, under WCAG 1.4.11; we keep 3.2:1) |
| Foreground | `#181818` | `--color-foreground` | body text |
| Muted foreground | `#696761` | `--color-muted-foreground` | nav links, meta |
| Accent / CTA (ink) | `#111111` on `#FFFFFF` | `--color-accent`, `--color-on-accent` | `--l-signal` |
| Destructive | `#B6001C` | `--color-destructive` | error red |
| Success | `#277044` | `--color-success` | `--mission-complete-ink` |

Radii are 0 everywhere (`--l-r-*: 0`); only avatars and the spinner are round.

### Typography

- **Font:** Satoshi (Fontshare, free for commercial use), self-hosted variable 300–900 via `next/font/local` (`app/fonts/`).
- Body 360, nav 440; h1 `clamp(40px…64px)` at -0.065em, h2 24–28px at -0.045em (lloud 64px/-4.16px, 28px/-1.26px).
- Eyebrows: 13px capitals, +0.14em tracking (`--track-caps`, lloud `--l-track`); FAN CLUB 14px/440 at +0.18em (lloud 2.52px).

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EA580C;
  color: #000000;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #059669;
  border: 2px solid #059669;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0F172A;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #059669;
  outline: none;
  box-shadow: 0 0 0 3px #05966920;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Feature-Rich Showcase

- **Conversion Strategy:** Clear feature hierarchy. One key message per card. Strong CTA repetition.
- **CTA Placement:** Hero (sticky) + After features + Bottom
- **Section Order:** Hero (value prop) > Feature grid/cards (4-6) > Use cases or benefits > Social proof or logos > CTA

---

## Motion

**Scroll Reveal** (Subtle) — Trigger: scroll (viewport enter) | Duration: 300-400ms | Easing: `power1.out`

```js
gsap.from(el, { opacity: 0, y: 12, duration: 0.35, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
```

**Framework notes:** Requires the ScrollTrigger plugin registered once via gsap.registerPlugin(ScrollTrigger); Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Keep the y offset small (8-16px) so it reads as a fade, not a slide
- ❌ Don't reveal below-the-fold content needed for SEO/crawlers as invisible-by-default without a no-JS fallback
- ⚡ toggleActions 'play none none reverse' avoids re-triggering on every scroll direction change

---

## Anti-Patterns (Do NOT Use)

- ❌ Flat design without depth
- ❌ Text-heavy pages

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Project decisions (override the generated values above)

Generated with `search.py "e-commerce merch store dark mode" --design-system --variance 2 --motion 2`. The first query ("…artist merch store dark premium minimal") returned Liquid Glass + a light luxury palette — off-fit for a dark, content-first fan shop — so it was retried once, narrower, per the skill's query contract. What this project keeps and what it overrides:

| Area | Generated | Applied | Why |
|------|-----------|---------|-----|
| Style | Minimalism & Swiss | **Kept** | Content-first catalogue, low cost, low a11y risk |
| Page pattern | Feature-Rich Showcase (hero → features → CTA) | **Not applied** | A partner shop is catalogue-first: no hero, no feature grid, no carousel — the product grid *is* the landing |
| Accent / CTA | `#EA580C` on black | **`#ffa33f`** (Ztor gold) on `#1a1200` ink | Brand mark; 9.3:1 ink-on-gold, 9.9:1 gold-on-canvas. Never white on gold (2.0:1) |
| Primary / secondary greens | `#059669` / `#10B981` | Not used | One accent only; success state uses `--color-success` |
| Neutrals | slate (`#0F172A` …) | zinc near-black (`#0b0b0c` canvas, `#151517` card) | Matches the Ztor dark canvas; same roles, measured below |
| Typography | Rubik / Nunito Sans | **Kept**, via `next/font/google` (self-hosted, `display: swap`, size-adjusted fallback) | Stack guideline: no external font `<link>`/`@import`; CJK falls back to Noto Sans TC / PingFang TC |
| Motion | GSAP scroll reveal | Not used | No GSAP dependency; motion = 120–200 ms state transitions, skeleton shimmer, spinner — all off under `prefers-reduced-motion` |
| Shadows | 4 levels | One (`--shadow-lg`, menus only) | Dark surfaces show elevation by surface step + border |
| Buttons | 8 px radius | Pill radius kept | Existing shop shape; min-height 44 px (48 px for primary CTAs) |

### Measured contrast (WCAG 2.2)

| Pair | Ratio | Need |
|------|-------|------|
| `--color-foreground #f4f4f5` on card `#151517` | 16.6:1 | 4.5 |
| `--color-muted-foreground #a1a1aa` on card / on hover `#1f1f23` | 7.1 / 6.4:1 | 4.5 |
| `--color-accent #ffa33f` as text on canvas / card | 9.9 / 9.2:1 | 4.5 |
| `--color-on-accent #1a1200` on accent / accent-hover | 9.3 / 10.7:1 | 4.5 |
| `--color-destructive #f87171` on card | 6.6:1 | 4.5 |
| `--color-success #4ade80` on card | 10.5:1 | 4.5 |
| `--color-border-control #71717a` (inputs, chips, steppers, radio cards) on canvas / card | 4.1 / 3.8:1 | 3 |
| old `--line #27272a` as the only input boundary | 1.3:1 | 3 — **was failing; now decorative dividers only** |
| focus ring (accent) on canvas | 9.9:1 | 3 |
