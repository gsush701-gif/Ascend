/**
 * Small, pure array helpers shared by every resume-section list (education,
 * experience, projects, certifications, awards, and the bullet/skill lists
 * nested inside them) for their add/remove/reorder UI. No drag-and-drop
 * library exists in this project and adding one isn't justified for this
 * scope — reordering is deliberately just up/down move buttons.
 */

/**
 * Move the item at `index` one position up (-1) or down (+1), returning a
 * new array. Out-of-range moves (already at the top/bottom, or an invalid
 * index) are a no-op that still returns a fresh copy, so callers can always
 * treat the result as the new state.
 */
export function moveArrayItem<T>(array: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= array.length || target < 0 || target >= array.length) {
    return array.slice();
  }
  const next = array.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** Returns a new array with the item at `index` removed. */
export function removeArrayItem<T>(array: T[], index: number): T[] {
  return array.filter((_, i) => i !== index);
}

/** Returns a new array with the item at `index` replaced by `value`. */
export function updateArrayItem<T>(array: T[], index: number, value: T): T[] {
  return array.map((item, i) => (i === index ? value : item));
}
