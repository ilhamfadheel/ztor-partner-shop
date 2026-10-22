// Native scroll distances (viewport units). Every endpoint has its own charge
// runway; the fold occupies real scroll space, so it can stop and reverse.
import { COLLECTIONS } from './data.js';
export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
let cursor = 0;
export const chapters = COLLECTIONS.map((collection, index) => {
  const approach = collection.id === 'paddock' ? 1.2 : 1.4;
  const start = cursor;
  const far = index ? .65 : 0;
  const near = .18;
  const charge = 1.1;
  const turn = index < COLLECTIONS.length - 1 ? .85 : 0;
  const walkStart = start + far;
  const nearStart = walkStart + approach;
  const chargeStart = nearStart + near;
  const foldStart = chargeStart + charge;
  cursor = foldStart + turn;
  return Object.freeze({ start, far, approach, near, charge, turn, walkStart, nearStart, chargeStart, foldStart, end: cursor });
});
export const travel = cursor;

export function stageAt(distance) {
  const index = Math.max(0, chapters.findLastIndex(chapter => distance >= chapter.start));
  const chapter = chapters[index];
  const depth = clamp((distance - chapter.walkStart) / chapter.approach);
  const fold = chapter.turn ? clamp((distance - chapter.foldStart) / chapter.turn) : 0;
  const previous = chapter.far ? clamp((chapter.walkStart - distance) / chapter.far) : 0;
  // Fill from the first approach scroll, keeping the existing 90% action and
  // full-charge/fold positions. Both spans are linear and meet at the same value.
  const readyAt = chapter.chargeStart + chapter.charge * .9;
  const next = distance < readyAt
    ? .9 * clamp((distance - chapter.walkStart) / (readyAt - chapter.walkStart))
    : clamp((distance - chapter.chargeStart) / chapter.charge);
  return { index, chapter, depth, fold, previous, next };
}
