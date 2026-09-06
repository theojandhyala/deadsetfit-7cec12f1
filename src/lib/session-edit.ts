/**
 * Index bookkeeping for editing a live session. Adding, removing and
 * reordering movements mid-workout all shift the list under the athlete's
 * feet; these keep the screen pointed at the movement they were looking at.
 */

/** Move one item, returning a new array. Out-of-range moves are a no-op. */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length) return items;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next;
}

/**
 * Where the cursor lands after a move. Following the moved item matters most:
 * if you reorder the exercise you are mid-way through, you expect to still be
 * looking at it.
 */
export function indexAfterMove(active: number, index: number, direction: -1 | 1): number {
  const target = index + direction;
  if (active === index) return target;
  if (active === target) return index;
  return active;
}

/**
 * Where the cursor lands after a removal, given the list length BEFORE it.
 * Removing the last movement while looking at it steps back rather than
 * running off the end.
 */
export function indexAfterRemoval(active: number, removed: number, lengthBefore: number): number {
  const lastIndex = Math.max(0, lengthBefore - 2);
  if (active > removed) return Math.max(0, active - 1);
  return Math.min(active, lastIndex);
}
