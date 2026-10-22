// js/data.js — the catalogue and the size-guide data, one module.
// Prices are SAMPLE values in HK$. Bracketed strings are placeholders and stay bracketed.
// Source of truth: the four artboards (Main / Shop / Product / Bag .dc.html) + LANDING-SPEC.md.
// The copy shown to fans is wrapped in t() (js/locales/commerce.js); ids, codes and collection names stay as they are.
import { t } from './i18n.js';

export const CATEGORIES = ['Tees', 'Outerwear', 'Accessories'];
export const CURRENCY = 'HK$';

const APPAREL = ['XS', 'S', 'M', 'L', 'XL'];
function sizeList(labels, outOfStock = []) {
  return labels.map(label => ({
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label: label === 'One size' ? t('One size') : label,
    inStock: !outOfStock.includes(label)
  }));
}
const ONE_SIZE = () => sizeList(['One size']);
const APP = (oos = []) => sizeList(APPAREL, oos);

export const COLLECTIONS = [
  {
    id: 'rockstar', code: 'S26 · 01', token: '[S26·01]', name: 'ROCKSTAR',
    manifesto: t('Loud on purpose. Twelve pieces cut for the encore.'),
    pieces: 12, window: t('until 31 Mar'), badge: t('UNTIL 31 MAR'),
    hero: 1, heroImage: 'assets/products/hero-rockstar.webp',
    // passport swatch values (the shell's --c-bg / --c-accent / --c-fg for this world)
    bg: '#E0091D', accent: '#FFFFFF', fg: '#FFFFFF',
    colours: [
      { id: 'black', label: t('Black'), hex: '#1A1A1A' },
      { id: 'oxblood', label: t('Oxblood'), hex: '#7A2B2B' },
      { id: 'bone', label: t('Bone'), hex: '#EDE7D9' }
    ]
  },
  {
    id: 'beach', code: 'S26 · 02', token: '[S26·02]', name: 'BEACH CLUB',
    manifesto: t('Salt, sun, slow hours. Fourteen pieces for the long afternoon.'),
    pieces: 14, window: t('until 30 Jun'), badge: t('UNTIL 30 JUN'),
    hero: 0, heroImage: 'assets/products/hero-beach.webp',
    bg: '#EADCC2', accent: '#FF6A45', fg: '#14343F',
    colours: [
      { id: 'bone', label: t('Bone'), hex: '#EDE7D9' },
      { id: 'navy', label: t('Navy'), hex: '#243A5E' },
      { id: 'olive', label: t('Olive'), hex: '#2F4A37' }
    ]
  },
  {
    id: 'paddock', code: 'S26 · 03', token: '[S26·03]', name: 'PADDOCK',
    manifesto: t('Built for the grid. Ten pieces, race weekend only.'),
    pieces: 10, window: t('until 30 Sep'), badge: t('UNTIL 30 SEP'),
    hero: 0, heroImage: 'assets/products/hero-paddock.webp',
    bg: '#080808', accent: '#FFFFFF', fg: '#FFFFFF',
    colours: [
      { id: 'black', label: t('Black'), hex: '#1A1A1A' },
      { id: 'grey', label: t('Grey'), hex: '#9A9A9A' },
      { id: 'navy', label: t('Navy'), hex: '#243A5E' }
    ]
  },
  {
    id: 'silence-is-loud', code: 'S26 · 04', token: '[S26·04]', name: 'SILENCE IS LOUD',
    manifesto: t('the loudest thing in the room sometimes is absolute control'),
    preview: true, pieces: 0, window: t('Coming soon'), badge: t('COLLECTION PREVIEW'),
    hero: 0, heroImage: 'assets/fashion/silence-is-loud/slim-face-20260909/near-poster.webp',
    bg: '#B9B7B2', accent: '#171717', fg: '#171717',
    colours: [{ id: 'black', label: t('Black'), hex: '#171717' }]
  }
];

export const COLLECTION_IDS = COLLECTIONS.map(c => c.id);
export const DEFAULT_COLLECTION = 'rockstar';

// slug = image filename stem. Order per collection = the artboards' order.
// flag: index 0 carries [LIMITED] (accent flag), index 1 carries [NEW] (neutral) — Shop.dc.
// XL is out of stock on the three PDP hero pieces — Product.dc.
const LIMITED = { text: '[LIMITED]', tone: 'accent' };
const NEW = { text: '[NEW]', tone: 'neutral' };

function product(collection, slug, name, price, category, sizes, flag = null) {
  return {
    slug, name, price, category, collection, sizes, flag,
    image: 'assets/products/' + slug + '.webp',
    sized: sizes.length > 1
  };
}

export const PRODUCTS = [
  product('rockstar', 'p-rockstar-riot-tee', 'Riot Tee', 420, 'Tees', APP(), LIMITED),
  product('rockstar', 'p-rockstar-encore-leather-jacket', 'Encore Leather Jacket', 2880, 'Outerwear', APP(['XL']), NEW),
  product('rockstar', 'p-rockstar-feedback-cap', 'Feedback Cap', 380, 'Accessories', ONE_SIZE()),
  product('rockstar', 'p-rockstar-setlist-tote', 'Setlist Tote', 520, 'Accessories', ONE_SIZE()),
  product('rockstar', 'p-rockstar-backline-hoodie', 'Backline Hoodie', 980, 'Tees', APP()),
  product('rockstar', 'p-rockstar-pick-keyring', 'Pick Keyring', 180, 'Accessories', ONE_SIZE()),

  product('beach', 'p-beach-cabana-shirt', 'Cabana Shirt', 880, 'Outerwear', APP(['XL']), LIMITED),
  product('beach', 'p-beach-tideline-shorts', 'Tideline Shorts', 620, 'Accessories', APP(), NEW),
  product('beach', 'p-beach-salt-towel', 'Salt Towel', 460, 'Accessories', ONE_SIZE()),
  product('beach', 'p-beach-noon-cap', 'Noon Cap', 380, 'Accessories', ONE_SIZE()),
  product('beach', 'p-beach-boardwalk-tote', 'Boardwalk Tote', 520, 'Accessories', ONE_SIZE()),
  product('beach', 'p-beach-shell-pendant', 'Shell Pendant', 720, 'Accessories', ONE_SIZE()),

  product('paddock', 'p-paddock-pit-wall-jacket', 'Pit Wall Jacket', 2480, 'Outerwear', APP(['XL']), LIMITED),
  product('paddock', 'p-paddock-grid-tee', 'Grid Tee', 460, 'Tees', APP(), NEW),
  product('paddock', 'p-paddock-visor-cap', 'Visor Cap', 420, 'Accessories', ONE_SIZE()),
  product('paddock', 'p-paddock-lap-timer-tote', 'Lap Timer Tote', 560, 'Accessories', ONE_SIZE()),
  product('paddock', 'p-paddock-chequer-scarf', 'Chequer Scarf', 680, 'Accessories', ONE_SIZE()),
  product('paddock', 'p-paddock-paddock-pass-lanyard', 'Paddock Pass Lanyard', 220, 'Accessories', ONE_SIZE())
];

// ── lookups ──────────────────────────────────────────────────────────────────
export function getCollection(id) {
  return COLLECTIONS.find(c => c.id === id) || null;
}
export function getProduct(slug) {
  return PRODUCTS.find(p => p.slug === slug) || null;
}
export function productsOf(collectionId) {
  return PRODUCTS.filter(p => p.collection === collectionId);
}
export function heroProduct(collectionId) {
  const col = getCollection(collectionId);
  if (!col) return null;
  return productsOf(collectionId)[col.hero] || null;
}
export function relatedProducts(slug, n = 3) {
  const p = getProduct(slug);
  if (!p) return [];
  return productsOf(p.collection).filter(x => x.slug !== slug).slice(0, n);
}
export function coloursOf(product) {
  const col = getCollection(product.collection);
  return (product.colours || (col && col.colours) || []).slice();
}
export function sizeOf(product, sizeLike) {
  if (!product) return null;
  if (sizeLike && typeof sizeLike === 'object' && sizeLike.label) return sizeLike;
  const key = String(sizeLike ?? '').trim().toLowerCase();
  if (!key) return product.sizes[0] || null;
  return product.sizes.find(s => s.id === key || s.label.toLowerCase() === key) || null;
}

// ── size guide (ZTOR_SHOP.reference, ported from Product.dc.html) ─────────────
// All numbers are mock data. groups are shared per body type; guides are per ARCHETYPE.
export const SIZE_GUIDE = {
  groups: {
    upper: {
      standards: {
        intl: ['XS', 'S', 'M', 'L', 'XL'],
        us: ['XS (34)', 'S (36)', 'M (38)', 'L (40)', 'XL (42)'],
        eu: ['44', '46', '48', '50', '52'],
        jp: ['XS', 'S', 'M', 'L', 'LL']
      },
      // [label, hMinCm, hMaxCm, wMinKg, wMaxKg]
      bodyMatrix: [
        ['XS', 147, 157, 38, 47], ['S', 155, 165, 45, 55], ['M', 163, 173, 53, 65],
        ['L', 170, 180, 63, 75], ['XL', 178, 188, 73, 88]
      ],
      measure: {
        steps: [
          [t('A Chest'), t('Measure around the fullest part of the chest, tape level and snug but not tight.')],
          [t('B Waist'), t('Measure around the narrowest part of the waist, just above the navel.')],
          [t('C Hip'), t('Feet together, measure around the fullest part of the hips.')]
        ]
      }
    }
  },
  guides: {
    tee: {
      title: t('T-shirt'), group: 'upper', cols: [t('Chest'), t('Length'), t('Shoulder')],
      rows: [['XS', 46, 63, 40], ['S', 49, 66, 42], ['M', 52, 69, 44], ['L', 55, 72, 46], ['XL', 58, 75, 48]],
      fit: t('Relaxed regular fit. Model 178 cm / 66 kg, wearing M.'),
      between: t('Between two sizes — size down.')
    },
    hoodie: {
      title: t('Hoodie'), group: 'upper', cols: [t('Chest'), t('Length'), t('Shoulder')],
      rows: [['XS', 51, 63, 44], ['S', 54, 66, 46], ['M', 57, 69, 48], ['L', 60, 72, 50], ['XL', 63, 75, 52]],
      fit: t('Oversized, dropped shoulder. Model 178 cm / 66 kg, wearing M.'),
      between: t('For a looser look — size up.')
    },
    jacket: {
      title: t('Jacket'), group: 'upper', cols: [t('Chest'), t('Length'), t('Sleeve')],
      rows: [['XS', 52, 64, 58], ['S', 55, 66, 60], ['M', 58, 68, 62], ['L', 61, 70, 64], ['XL', 64, 72, 66]],
      fit: t('Standard fit; size up if you layer a hoodie underneath. Model 180 cm / 72 kg, wearing L.'),
      between: t('Between two sizes — size up.')
    },
    longsleeve: {
      title: t('Long sleeve'), group: 'upper', cols: [t('Chest'), t('Length'), t('Sleeve')],
      rows: [['XS', 47, 65, 56], ['S', 50, 68, 58], ['M', 53, 71, 60], ['L', 56, 74, 62], ['XL', 59, 77, 64]],
      fit: t('Standard fit. Model 178 cm / 66 kg, wearing M.'),
      between: t('Between two sizes — size down.')
    }
  },
  // first substring hit on the lowercased product name wins; longsleeve before tee on purpose
  keywords: [
    ['longsleeve', 'longsleeve'], ['long-sleeve', 'longsleeve'],
    ['hoodie', 'hoodie'],
    ['fleece', 'jacket'], ['jacket', 'jacket'], ['coat', 'jacket'],
    ['shirt', 'tee'], ['tee', 'tee'], ['tshirt', 'tee'], ['t-shirt', 'tee']
  ],
  standards: [['intl', 'INTL'], ['us', 'US'], ['eu', 'EU'], ['jp', 'JP']],
  units: [['cm', 'CM'], ['in', 'IN']],
  notes: {
    body: t('※ Fit guidance is based on a regular build; when in doubt the flat-lay table above is the more accurate reference.'),
    flat: t('※ Garment measurements are taken flat, in centimetres; different materials may vary by 1–2 cm.')
  }
};

// resolve product → guide key (refGuideFor): explicit product.sizeGuide, else the keyword router.
// One-size pieces and no-hit pieces return null — the trigger is not rendered (PORT.md rule 3).
export function guideKeyFor(product) {
  if (!product || !product.sized) return null;
  if (product.sizeGuide && SIZE_GUIDE.guides[product.sizeGuide]) return product.sizeGuide;
  const name = String(product.name || product.slug).toLowerCase();
  const hit = SIZE_GUIDE.keywords.find(([token]) => name.includes(token));
  return hit ? hit[1] : null;
}
export function guideFor(product) {
  const key = guideKeyFor(product);
  if (!key) return null;
  const guide = SIZE_GUIDE.guides[key];
  return { key, ...guide, groupData: SIZE_GUIDE.groups[guide.group] || null };
}

// conversions (refCm / refFtIn / refLb) — exact
export function cmToIn(v) {
  return typeof v === 'number' ? Math.round(v / 2.54 * 10) / 10 : v;
}
export function cmToFtIn(cm) {
  const inches = cm / 2.54;
  let ft = Math.floor(inches / 12);
  let rem = Math.round(inches % 12);
  if (rem === 12) { ft += 1; rem = 0; }
  return ft + "'" + rem + '"';
}
export function kgToLb(kg) {
  return Math.round(kg * 2.2046);
}
export function sizeLabel(groupData, std, rowIndex, fallback) {
  const list = groupData && groupData.standards && groupData.standards[std];
  return (list && list[rowIndex]) ?? fallback;
}
